import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestError } from '@playwright/test/reporter';
import type { ReportError, RunStatus } from './model';
import { openReport } from './open';
import { parseOptions, type MarqueeOptions } from './options';
import { resolveOutputFolder } from './paths';
import { writeReport } from './render';
import { buildReport } from './serialize';
import { capText, stripAnsi } from './format';

class MarqueeReporter implements Reporter {
  private readonly parsed: ReturnType<typeof parseOptions>;
  private suite: Suite | undefined;
  private config: FullConfig | undefined;
  private readonly errors: ReportError[] = [];

  constructor(options: MarqueeOptions = {}) {
    this.parsed = parseOptions(options);
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    process.env.MARQUEE_SCREENSHOTS = this.parsed.screenshots;
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
      process.stderr.write(`\nMarquee reporter failed.\n${message}\n`);
      throw error;
    }
  }

  private outputBase(): string {
    if (this.config?.configFile) return path.dirname(this.config.configFile);
    return process.cwd();
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
    });
    const indexPath = await writeReport(outputDir, report, files, path.join(__dirname, 'ui'));
    process.stdout.write(`\nMarquee report: ${indexPath}\n`);
    const failed = status !== 'passed';
    if (this.parsed.open === 'always' || (this.parsed.open === 'on-failure' && failed)) {
      openReport(indexPath);
    }
  }
}

export default MarqueeReporter;
export type { MarqueeOptions, MarqueeOpen } from './options';
