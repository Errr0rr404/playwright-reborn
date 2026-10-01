import type { Accent, OverviewMode, ShotMode, StepDetail } from './model';

export type FinaleOpen = 'always' | 'never' | 'on-failure';

export type FinaleOptions = {
  outputFolder?: string;
  open?: FinaleOpen;
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
  open: FinaleOpen;
  screenshots: ShotMode;
  steps: StepDetail;
  company: string;
  accent: Accent;
  showLogs: boolean;
  showFiles: boolean;
  overview: OverviewMode;
};

const OPENS = new Set<FinaleOpen>(['always', 'never', 'on-failure']);
const SHOTS = new Set<ShotMode>(['off', 'failure', 'last', 'steps']);
const STEP_DETAILS = new Set<StepDetail>(['user', 'all']);
const ACCENTS = new Set<Accent>(['green', 'red', 'blue', 'amber', 'violet']);
const OVERVIEWS = new Set<OverviewMode>(['chart', 'timeline']);

export function parseOptions(options: FinaleOptions = {}): ParsedOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Finale options must be an object.');
  }
  const open = options.open ?? 'on-failure';
  if (!OPENS.has(open)) {
    throw new Error('Finale open must be "always", "never", or "on-failure".');
  }
  const screenshots = options.screenshots ?? 'failure';
  if (!SHOTS.has(screenshots)) {
    throw new Error('Finale screenshots must be "off", "failure", "last", or "steps".');
  }
  const steps = options.steps ?? 'user';
  if (!STEP_DETAILS.has(steps)) {
    throw new Error('Finale steps must be "user" or "all".');
  }
  const company = options.company ?? 'Sandata';
  if (typeof company !== 'string' || !company.trim()) {
    throw new Error('Finale company must be a non-empty name.');
  }
  const accent = options.accent ?? 'green';
  if (!ACCENTS.has(accent)) {
    throw new Error('Finale accent must be "green", "red", "blue", "amber", or "violet".');
  }
  const showLogs = flag(options.showLogs, 'showLogs');
  const showFiles = flag(options.showFiles, 'showFiles');
  const overview = options.overview ?? 'chart';
  if (!OVERVIEWS.has(overview)) {
    throw new Error('Finale overview must be "chart" or "timeline".');
  }
  const outputExplicit = options.outputFolder !== undefined;
  const outputFolder = options.outputFolder ?? 'finale-report';
  if (typeof outputFolder !== 'string' || !outputFolder.trim()) {
    throw new Error('Finale outputFolder must be a non-empty path.');
  }
  return { outputFolder, outputExplicit, open, screenshots, steps, company: company.trim(), accent, showLogs, showFiles, overview };
}

function flag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    throw new Error(`Finale ${name} must be true or false.`);
  }
  return value;
}
