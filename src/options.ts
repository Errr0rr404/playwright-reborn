import type { Accent, OverviewMode, ShotMode, StepDetail } from './model';

export type RebornOpen = 'always' | 'never' | 'on-failure';

export type RebornOptions = {
  outputFolder?: string;
  open?: RebornOpen;
  screenshots?: ShotMode;
  steps?: StepDetail;
  company?: string;
  accent?: Accent;
  showLogs?: boolean;
  showFiles?: boolean;
  overview?: OverviewMode;
};

export type ParsedOptions = {
  outputFolder: string;
  outputExplicit: boolean;
  open: RebornOpen;
  screenshots: ShotMode;
  steps: StepDetail;
  company: string;
  accent: Accent;
  showLogs: boolean;
  showFiles: boolean;
  overview: OverviewMode;
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
  const company = options.company ?? 'Sandata';
  if (typeof company !== 'string' || !company.trim()) {
    throw new Error('Reborn company must be a non-empty name.');
  }
  const accent = options.accent ?? 'green';
  if (!ACCENTS.has(accent)) {
    throw new Error('Reborn accent must be "green", "red", "blue", "amber", or "violet".');
  }
  const showLogs = flag(options.showLogs, 'showLogs');
  const showFiles = flag(options.showFiles, 'showFiles');
  const overview = options.overview ?? 'chart';
  if (!OVERVIEWS.has(overview)) {
    throw new Error('Reborn overview must be "chart" or "timeline".');
  }
  const outputExplicit = options.outputFolder !== undefined;
  const outputFolder = options.outputFolder ?? 'reborn-report';
  if (typeof outputFolder !== 'string' || !outputFolder.trim()) {
    throw new Error('Reborn outputFolder must be a non-empty path.');
  }
  return { outputFolder, outputExplicit, open, screenshots, steps, company: company.trim(), accent, showLogs, showFiles, overview };
}

function flag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    throw new Error(`Reborn ${name} must be true or false.`);
  }
  return value;
}
