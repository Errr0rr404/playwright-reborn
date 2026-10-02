import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestError } from '@playwright/test/reporter';
import type { ReportError, RunStatus } from './model';
import { openReport } from './open';
import { parseOptions, type RebornOptions } from './options';
import { resolveOutputFolder } from './paths';
import { writeReport } from './render';
import { buildReport } from './serialize';
import { capText, stripAnsi } from './format';
import { infoRows, listValue, shortSha, textValue } from './info';

class RebornReporter implements Reporter {
  private readonly parsed: ReturnType<typeof parseOptions>;
  private suite: Suite | undefined;
  private config: FullConfig | undefined;
  private readonly errors: ReportError[] = [];

  constructor(options: RebornOptions = {}) {
    this.parsed = parseOptions(options);
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    process.env.REBORN_SCREENSHOTS = this.parsed.screenshots;
  }

  onError(error: TestError): void {
    const message = capText(stripAnsi(error.message || error.value || 'Runner error'), 20_000);
    const entry: ReportError = { message };
    if (error.stack) entry.stack = capText(stripAnsi(error.stack), 20_000);
    this.errors.push(entry);
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      await this.finish(result);
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      process.stderr.write(`\nReborn reporter failed.\n${message}\n`);
      throw error;
    }
  }

  private outputBase(): string {
    if (this.config?.configFile) return path.dirname(this.config.configFile);
    return process.cwd();
  }

  private metadata(key: string): unknown {
    const metadata = this.config?.metadata as Record<string, unknown> | undefined;
    return metadata ? metadata[key] : undefined;
  }

  private runInfo() {
    const config = this.config;
    const baseURL = textValue(this.metadata('baseURL')) || config?.projects.map((project) => textValue(project.use.baseURL)).find(Boolean) || '';
    const defects = [
      ...this.parsed.defects,
      ...listValue(this.metadata('defects')),
      ...listValue(this.metadata('jira')),
    ];
    return infoRows({
      suite: this.parsed.suite || textValue(this.metadata('suite')) || textValue(this.metadata('suiteName')),
      user: this.parsed.user || textValue(this.metadata('user')) || process.env.BUILD_USER || process.env.GITHUB_ACTOR || process.env.USER || '',
      environment: this.parsed.environment || textValue(this.metadata('environment')) || process.env.TEST_ENV || '',
      state: this.parsed.state || textValue(this.metadata('state')) || process.env.TEST_STATE || '',
      defects: [...new Set(defects)].join(', '),
      baseURL,
      branch: textValue(this.metadata('branch')) || process.env.GITHUB_REF_NAME || process.env.GIT_BRANCH || process.env.BRANCH_NAME || '',
      sha: shortSha(
        textValue(this.metadata('sha')) || textValue(this.metadata('githubSha')) || process.env.GITHUB_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA || '',
        this.parsed.commitShort,
      ),
      projects: this.parsed.showProjects ? config?.projects.map((project) => project.name).filter(Boolean).join(', ') || '' : '',
      workers: config ? String(config.workers) : '',
      shard: config?.shard ? `${config.shard.current}/${config.shard.total}` : '',
      playwright: this.parsed.showPlaywrightVersion ? config?.version || '' : '',
    });
  }

  private folderFor(config: FullConfig): string {
    if (this.parsed.outputExplicit || !config.shard) return this.parsed.outputFolder;
    return `${this.parsed.outputFolder}-shard-${config.shard.current}`;
  }

  private async finish(result: FullResult): Promise<void> {
    if (!this.config || !this.suite) return;
    const outputDir = resolveOutputFolder(this.outputBase(), this.folderFor(this.config));
    const status = result.status as RunStatus;
    const { report, files } = buildReport({
      tests: this.suite.allTests() as unknown as import('./serialize').SourceTest[],
      rootDir: this.outputBase(),
      playwrightVersion: this.config.version,
      projectName: path.basename(this.outputBase()),
      projects: this.config.projects.map((project) => project.name),
      workers: this.config.workers,
      shard: this.config.shard ? `${this.config.shard.current}/${this.config.shard.total}` : null,
      status,
      startTime: result.startTime,
      duration: result.duration,
      generatedAt: new Date().toISOString(),
      errors: this.errors,
      screenshots: this.parsed.screenshots,
      stepDetail: this.parsed.steps,
      company: this.parsed.company,
      accent: this.parsed.accent,
      showLogs: this.parsed.showLogs,
      showFiles: this.parsed.showFiles,
      overview: this.parsed.overview,
      chartStyle: this.parsed.chartStyle,
      productSubtitle: this.parsed.productSubtitle,
      showCredit: this.parsed.showCredit,
      showPlaywrightVersion: this.parsed.showPlaywrightVersion,
      showProjects: this.parsed.showProjects,
      showProjectFilter: this.parsed.showProjectFilter,
      ignoreTags: this.parsed.ignoreTags,
      info: this.runInfo(),
    });
    const indexPath = await writeReport(outputDir, report, files, path.join(__dirname, 'ui'), {
      inline: this.parsed.inline,
      reportFileName: this.parsed.reportFileName,
    });
    process.stdout.write(`\nReborn report: ${indexPath}\n`);
    const failed = status !== 'passed';
    if (this.parsed.open === 'always' || (this.parsed.open === 'on-failure' && failed)) {
      openReport(indexPath);
    }
  }
}

export default RebornReporter;
export type { RebornOptions, RebornOpen } from './options';
