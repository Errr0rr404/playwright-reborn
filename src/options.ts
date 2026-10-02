import type { Accent, ChartStyle, OverviewMode, ShotMode, StepDetail } from './model';

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
  productSubtitle?: string;
  showCredit?: boolean;
  showPlaywrightVersion?: boolean;
  showProjects?: boolean;
  showProjectFilter?: boolean;
  commitShort?: boolean;
  chartStyle?: ChartStyle;
  ignoreTags?: string | false;
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
  productSubtitle: string;
  showCredit: boolean;
  showPlaywrightVersion: boolean;
  showProjects: boolean;
  showProjectFilter: boolean;
  commitShort: boolean;
  chartStyle: ChartStyle;
  ignoreTags: string;
};

const OPENS = new Set<RebornOpen>(['always', 'never', 'on-failure']);
const SHOTS = new Set<ShotMode>(['off', 'failure', 'last', 'steps']);
const STEP_DETAILS = new Set<StepDetail>(['user', 'all']);
const ACCENTS = new Set<Accent>(['green', 'red', 'blue', 'amber', 'violet']);
const OVERVIEWS = new Set<OverviewMode>(['chart', 'timeline']);
const CHARTS = new Set<ChartStyle>(['pie', 'bar', 'both']);

export function parseOptions(options: RebornOptions = {}): ParsedOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Reborn options must be an object.');
  }
  const open = options.open ?? (process.env.CI ? 'never' : 'on-failure');
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
  const showCredit = flag(options.showCredit, 'showCredit', false);
  const showPlaywrightVersion = flag(options.showPlaywrightVersion, 'showPlaywrightVersion', false);
  const showProjects = flag(options.showProjects, 'showProjects', false);
  const projectFilter = flag(options.showProjectFilter, 'showProjectFilter', false);
  const showProjectFilter = showProjects && projectFilter;
  const commitShort = flag(options.commitShort, 'commitShort', true);
  const overview = options.overview ?? 'chart';
  if (!OVERVIEWS.has(overview)) {
    throw new Error('Reborn overview must be "chart" or "timeline".');
  }
  const chartStyle = options.chartStyle ?? 'both';
  if (!CHARTS.has(chartStyle)) {
    throw new Error('Reborn chartStyle must be "pie", "bar", or "both".');
  }
  const outputExplicit = options.outputFolder !== undefined;
  const outputFolder = options.outputFolder ?? 'reborn-report';
  if (typeof outputFolder !== 'string' || !outputFolder.trim()) {
    throw new Error('Reborn outputFolder must be a non-empty path.');
  }
  const reportFileName = options.reportFileName ?? 'index.html';
  if (typeof reportFileName !== 'string' || !/^[A-Za-z0-9._-]+\.html$/.test(reportFileName)) {
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
    productSubtitle: subtitle(options.productSubtitle),
    showCredit,
    showPlaywrightVersion,
    showProjects,
    showProjectFilter,
    commitShort,
    chartStyle,
    ignoreTags: ignorePattern(options.ignoreTags),
  };
}

function subtitle(value: string | undefined): string {
  if (value === undefined) return 'Test Automation';
  if (typeof value !== 'string') {
    throw new Error('Reborn productSubtitle must be text.');
  }
  return value.trim();
}

function ignorePattern(value: string | false | undefined): string {
  if (value === false) return '';
  const pattern = value === undefined ? '^@?HC2T-' : value;
  if (typeof pattern !== 'string') {
    throw new Error('Reborn ignoreTags must be a pattern or false.');
  }
  if (!pattern.trim()) return '';
  try {
    new RegExp(pattern, 'i');
  } catch {
    throw new Error('Reborn ignoreTags must be a valid pattern.');
  }
  return pattern.trim();
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

function flag(value: boolean | undefined, name: string, fallback = true): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Reborn ${name} must be true or false.`);
  }
  return value;
}
