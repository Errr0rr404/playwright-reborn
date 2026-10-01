import path from 'node:path';
import type { TestError } from '@playwright/test/reporter';
import {
  attachmentKind,
  capText,
  extensionFor,
  joinChunks,
  parseShotName,
  safeFileName,
  stripAnsi,
} from './format';
import type { Accent, Attempt, PendingFile, Report, ReportAttachment, ReportError, RunStatus, ShotMode, Step, StepDetail } from './model';
import { relativePosix } from './paths';
import { countTests, displayStatus, isExpectedFailure, outcomeWord, summaryLine } from './status';

export type SourceSuite = {
  title: string;
  type: 'root' | 'project' | 'file' | 'describe';
  parent?: SourceSuite;
  location?: { file: string; line: number; column: number };
};

export type SourceStep = {
  title: string;
  subtitle?: string;
  category: string;
  duration: number;
  error?: TestError;
  location?: { file: string; line: number; column: number };
  attachments?: SourceAttachment[];
  steps?: SourceStep[];
};

export type SourceAttachment = {
  name: string;
  contentType: string;
  path?: string;
  body?: Buffer;
};

export type SourceResult = {
  retry: number;
  status: Attempt['status'];
  duration: number;
  startTime: Date;
  workerIndex: number;
  error?: TestError;
  errors?: TestError[];
  stdout?: Array<string | Buffer>;
  stderr?: Array<string | Buffer>;
  steps?: SourceStep[];
  attachments?: SourceAttachment[];
};

export type SourceTest = {
  id: string;
  title: string;
  location: { file: string; line: number; column: number };
  parent: SourceSuite;
  annotations: { type: string; description?: string }[];
  tags: string[];
  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky';
  results: SourceResult[];
};

export type BuildInput = {
  tests: SourceTest[];
  rootDir: string;
  playwrightVersion: string;
  projectName: string;
  projects: string[];
  workers: number;
  shard: string | null;
  status: RunStatus;
  startTime: Date;
  duration: number;
  generatedAt: string;
  errors: ReportError[];
  screenshots?: ShotMode;
  stepDetail?: StepDetail;
  company?: string;
  accent?: Accent;
  showLogs?: boolean;
  showFiles?: boolean;
  overview?: 'chart' | 'timeline';
};

function walkSuites(test: SourceTest): SourceSuite[] {
  const chain: SourceSuite[] = [];
  let suite: SourceSuite | undefined = test.parent;
  while (suite) {
    chain.unshift(suite);
    suite = suite.parent;
  }
  return chain;
}

function projectOf(test: SourceTest): string {
  for (const suite of walkSuites(test)) {
    if (suite.type === 'project') return suite.title;
  }
  return '';
}

function groupOf(test: SourceTest): string[] {
  return walkSuites(test)
    .filter((suite) => suite.type === 'describe' && suite.title)
    .map((suite) => suite.title);
}

function stepLocation(rootDir: string, step: SourceStep): string | undefined {
  if (!step.location) return undefined;
  const file = relativePosix(rootDir, step.location.file);
  if (file.includes('node_modules')) return undefined;
  return `${file}:${step.location.line}`;
}

function errorMessage(error: TestError): string {
  const main = error.message || error.value || '';
  const cause = error.cause ? error.cause.message || error.cause.value || '' : '';
  const combined = cause && !main.includes(cause) ? `${main}\n${cause}` : main;
  const text = capText(stripAnsi(combined), 20_000).trim();
  return text || 'The test failed.';
}

function simplifyError(error: TestError, rootDir: string): ReportError {
  const simplified: ReportError = { message: errorMessage(error) };
  if (error.stack) simplified.stack = capText(stripAnsi(error.stack), 20_000);
  if (error.snippet) simplified.snippet = capText(stripAnsi(error.snippet), 20_000);
  if (error.location) {
    simplified.location = `${relativePosix(rootDir, error.location.file)}:${error.location.line}`;
  }
  return simplified;
}

function mapSteps(steps: SourceStep[] | undefined, rootDir: string, depth: number, detail: StepDetail): Step[] {
  if (!steps || depth > 12) return [];
  const mapped: Step[] = [];
  for (const step of steps) {
    const kids = mapSteps(step.steps, rootDir, depth + 1, detail);
    const hide = detail === 'user' && (step.category === 'pw:api' || step.category === 'fixture');
    if (hide) {
      mapped.push(...kids);
      continue;
    }
    const next: Step = {
      title: step.title,
      category: step.category,
      duration: step.duration,
      steps: kids,
    };
    if (step.subtitle && step.subtitle !== step.title) next.subtitle = step.subtitle;
    const location = stepLocation(rootDir, step);
    if (location) next.location = location;
    if (step.error) {
      const message = errorMessage(step.error);
      if (message) next.error = message;
    }
    mapped.push(next);
  }
  return mapped;
}

function collectAttachments(result: SourceResult): SourceAttachment[] {
  const found: SourceAttachment[] = [];
  const seen = new Set<string>();
  const visit = (attachments: SourceAttachment[] | undefined) => {
    for (const attachment of attachments || []) {
      const key = attachment.path
        ? `path:${attachment.path}`
        : `body:${attachment.name}:${attachment.contentType}:${attachment.body?.length || 0}:${found.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(attachment);
    }
  };
  visit(result.attachments);
  const visitSteps = (steps: SourceStep[] | undefined) => {
    for (const step of steps || []) {
      visit(step.attachments);
      visitSteps(step.steps);
    }
  };
  visitSteps(result.steps);
  return found;
}

export function buildReport(input: BuildInput): { report: Report; files: PendingFile[] } {
  const files: PendingFile[] = [];
  let fileIndex = 0;
  const seenIds = new Map<string, number>();

  const sorted = [...input.tests].sort((a, b) => {
    const aStart = a.results[0]?.startTime ? a.results[0].startTime.getTime() : Number.POSITIVE_INFINITY;
    const bStart = b.results[0]?.startTime ? b.results[0].startTime.getTime() : Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart - bStart;
    return a.title.localeCompare(b.title);
  });

  const tests = sorted.map((test, order) => {
    const count = seenIds.get(test.id) || 0;
    seenIds.set(test.id, count + 1);
    const id = count === 0 ? test.id : `${test.id}-${count}`;
    const results = test.results || [];
    const last = results[results.length - 1];
    const rawStatus = last?.status || 'skipped';
    let pwOutcome: ReturnType<SourceTest['outcome']> = 'skipped';
    try {
      pwOutcome = test.outcome();
    } catch {
      pwOutcome = 'skipped';
    }
    const attempts: Attempt[] = results.map((result) => {
      const errors = (result.errors && result.errors.length > 0 ? result.errors : result.error ? [result.error] : [])
        .map((error) => simplifyError(error, input.rootDir));
      const attachments: ReportAttachment[] = collectAttachments(result).map((attachment) => {
        const parsed = parseShotName(attachment.name || 'file');
        const ext = extensionFor(attachment.contentType, attachment.path);
        const targetName = safeFileName(parsed.name, fileIndex, ext);
        fileIndex += 1;
        const target = path.posix.join('assets', 'attachments', targetName);
        files.push({
          name: parsed.name,
          target,
          sourcePath: attachment.path,
          body: attachment.body,
        });
        const reportAttachment: ReportAttachment = {
          name: parsed.name,
          contentType: attachment.contentType,
          path: target,
          kind: attachmentKind(parsed.name, attachment.contentType),
        };
        if (parsed.role) reportAttachment.role = parsed.role;
        if (parsed.stepTitle) reportAttachment.stepTitle = parsed.stepTitle;
        return reportAttachment;
      });
      const stdout = joinChunks(result.stdout);
      const stderr = joinChunks(result.stderr);
      const attempt: Attempt = {
        retry: result.retry,
        status: result.status,
        duration: result.duration,
        startTime: result.startTime.toISOString(),
        workerIndex: result.workerIndex,
        errors,
        steps: mapSteps(result.steps, input.rootDir, 0, input.stepDetail || 'user'),
        attachments,
      };
      if (stdout) attempt.stdout = stdout;
      if (stderr) attempt.stderr = stderr;
      return attempt;
    });

    return {
      id,
      title: test.title,
      file: relativePosix(input.rootDir, test.location.file),
      line: test.location.line,
      project: projectOf(test),
      group: groupOf(test),
      tags: test.tags.slice(0, 20),
      annotations: test.annotations.slice(0, 40).map((annotation) => ({
        type: annotation.type,
        description: annotation.description ? capText(annotation.description, 500) : undefined,
      })),
      expectedFailure: isExpectedFailure(pwOutcome, rawStatus),
      status: displayStatus(pwOutcome, rawStatus),
      duration: results.reduce((sum, result) => sum + (result.duration || 0), 0),
      order,
      attempts,
    };
  });

  const counts = countTests(tests.map((test) => test.status));
  const report: Report = {
    version: 2,
    screenshots: input.screenshots || 'failure',
    steps: input.stepDetail || 'user',
    generatedAt: input.generatedAt,
    playwrightVersion: input.playwrightVersion,
    status: input.status,
    word: outcomeWord(input.status),
    company: (input.company || 'Sandata').trim() || 'Sandata',
    accent: input.accent || 'green',
    showLogs: input.showLogs !== false,
    showFiles: input.showFiles !== false,
    overview: input.overview === 'timeline' ? 'timeline' : 'chart',
    summary: summaryLine(counts),
    startTime: input.startTime.toISOString(),
    duration: input.duration,
    projectName: input.projectName,
    projects: input.projects,
    workers: input.workers,
    shard: input.shard,
    counts,
    warnings: [],
    errors: input.errors,
    tests,
  };
  return { report, files };
}
