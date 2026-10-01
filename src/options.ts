import type { Accent, OverviewMode, ShotMode, StepDetail } from './model';

export type RebornOpen = 'always' | 'never' | 'on-failure';

export type RebornOptions = {
  outputFolder?: string;
  reportFileName?: string;
  open?: RebornOpen;
  screenshots?: ShotMode;
  steps?: StepDetail;
  company?: string;
  accent?: Accent;
  showLogs?: boolean;
  showFiles?: boolean;
  overview?: OverviewMode;
  inline?: boolean;
  suite?: string;
  user?: string;
  environment?: string;
  state?: string;
  defects?: string | string[];
};

export type ParsedOptions = {
  outputFolder: string;
  outputExplicit: boolean;
  reportFileName: string;
  open: RebornOpen;
  screenshots: ShotMode;
  steps: StepDetail;
  company: string;
  accent: Accent;
  showLogs: boolean;
  showFiles: boolean;
  overview: OverviewMode;
  inline: boolean;
  suite: string;
  user: string;
  environment: string;
  state: string;
  defects: string[];
};

const OPENS = new Set<RebornOpen>(['always', 'never', 'on-failure']);
const SHOTS = new Set<ShotMode>(['off', 'failure', 'last', 'steps']);
const STEP_DETAILS = new Set<StepDetail>(['user', 'all']);
const ACCENTS = new Set<Accent>(['green', 'red', 'blue', 'amber', 'violet']);
const OVERVIEWS = new Set<OverviewMode>(['chart', 'timeline']);

export function parseOptions(options: RebornOptions = {}): ParsedOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Reborn options must be an object.');
  }
  const open = options.open ?? 'on-failure';
  if (!OPENS.has(open)) {
    throw new Error('Reborn open must be "always", "never", or "on-failure".');
  }
  const screenshots = options.screenshots ?? 'failure';
  if (!SHOTS.has(screenshots)) {
    throw new Error('Reborn screenshots must be "off", "failure", "last", or "steps".');
  }
  const steps = options.steps ?? 'user';
  if (!STEP_DETAILS.has(steps)) {
    throw new Error('Reborn steps must be "user" or "all".');
  }
  const company = optionalText(options.company, 'company');
  const accent = options.accent ?? 'green';
  if (!ACCENTS.has(accent)) {
    throw new Error('Reborn accent must be "green", "red", "blue", "amber", or "violet".');
  }
  const showLogs = flag(options.showLogs, 'showLogs');
  const showFiles = flag(options.showFiles, 'showFiles');
  const inline = flag(options.inline, 'inline');
  const overview = options.overview ?? 'chart';
  if (!OVERVIEWS.has(overview)) {
    throw new Error('Reborn overview must be "chart" or "timeline".');
  }
  const outputExplicit = options.outputFolder !== undefined;
  const outputFolder = options.outputFolder ?? 'reborn-report';
  if (typeof outputFolder !== 'string' || !outputFolder.trim()) {
    throw new Error('Reborn outputFolder must be a non-empty path.');
  }
  const reportFileName = options.reportFileName ?? 'index.html';
  if (!/^[A-Za-z0-9._-]+\.html$/.test(reportFileName)) {
    throw new Error('Reborn reportFileName must be a single .html file name.');
  }
  return {
    outputFolder,
    outputExplicit,
    reportFileName,
    open,
    screenshots,
    steps,
    company,
    accent,
    showLogs,
    showFiles,
    overview,
    inline,
    suite: optionalText(options.suite, 'suite'),
    user: optionalText(options.user, 'user'),
    environment: optionalText(options.environment, 'environment'),
    state: optionalText(options.state, 'state'),
    defects: defectsOf(options.defects),
  };
}

function optionalText(value: string | undefined, name: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Reborn ${name} must be a non-empty name.`);
  }
  return value.trim();
}

function defectsOf(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  if (items.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('Reborn defects must be a name or a list of names.');
  }
  return items.map((item) => item.trim());
}

function flag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    throw new Error(`Reborn ${name} must be true or false.`);
  }
  return value;
}
