import type { Accent, ShotMode, StepDetail } from './model';

export type MarqueeOpen = 'always' | 'never' | 'on-failure';

export type MarqueeOptions = {
  outputFolder?: string;
  open?: MarqueeOpen;
  screenshots?: ShotMode;
  steps?: StepDetail;
  company?: string;
  accent?: Accent;
  showLogs?: boolean;
  showFiles?: boolean;
};

export type ParsedOptions = {
  outputFolder: string;
  outputExplicit: boolean;
  open: MarqueeOpen;
  screenshots: ShotMode;
  steps: StepDetail;
  company: string;
  accent: Accent;
  showLogs: boolean;
  showFiles: boolean;
};

const OPENS = new Set<MarqueeOpen>(['always', 'never', 'on-failure']);
const SHOTS = new Set<ShotMode>(['off', 'failure', 'last', 'steps']);
const STEP_DETAILS = new Set<StepDetail>(['user', 'all']);
const ACCENTS = new Set<Accent>(['green', 'red', 'blue', 'amber', 'violet']);

export function parseOptions(options: MarqueeOptions = {}): ParsedOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Marquee options must be an object.');
  }
  const open = options.open ?? 'on-failure';
  if (!OPENS.has(open)) {
    throw new Error('Marquee open must be "always", "never", or "on-failure".');
  }
  const screenshots = options.screenshots ?? 'failure';
  if (!SHOTS.has(screenshots)) {
    throw new Error('Marquee screenshots must be "off", "failure", "last", or "steps".');
  }
  const steps = options.steps ?? 'user';
  if (!STEP_DETAILS.has(steps)) {
    throw new Error('Marquee steps must be "user" or "all".');
  }
  const company = options.company ?? 'Sandata';
  if (typeof company !== 'string' || !company.trim()) {
    throw new Error('Marquee company must be a non-empty name.');
  }
  const accent = options.accent ?? 'green';
  if (!ACCENTS.has(accent)) {
    throw new Error('Marquee accent must be "green", "red", "blue", "amber", or "violet".');
  }
  const showLogs = flag(options.showLogs, 'showLogs');
  const showFiles = flag(options.showFiles, 'showFiles');
  const outputExplicit = options.outputFolder !== undefined;
  const outputFolder = options.outputFolder ?? 'marquee-report';
  if (typeof outputFolder !== 'string' || !outputFolder.trim()) {
    throw new Error('Marquee outputFolder must be a non-empty path.');
  }
  return { outputFolder, outputExplicit, open, screenshots, steps, company: company.trim(), accent, showLogs, showFiles };
}

function flag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    throw new Error(`Marquee ${name} must be true or false.`);
  }
  return value;
}
