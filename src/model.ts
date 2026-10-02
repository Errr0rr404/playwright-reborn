export type DisplayStatus = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedOut' | 'interrupted';

export type RunStatus = 'passed' | 'failed' | 'timedout' | 'interrupted';

export type AttachmentKind = 'image' | 'video' | 'trace' | 'file';

export type ShotRole = 'step' | 'last' | 'failure';

export type ShotMode = 'off' | 'failure' | 'last' | 'steps';

export type Accent = 'green' | 'red' | 'blue' | 'amber' | 'violet';

export type OverviewMode = 'chart' | 'timeline';

export type ChartStyle = 'pie' | 'bar' | 'both';

export type StepDetail = 'user' | 'all';

export type Counts = {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  timedOut: number;
  interrupted: number;
};

export type Step = {
  title: string;
  subtitle?: string;
  category: string;
  duration: number;
  error?: string;
  location?: string;
  steps: Step[];
};

export type ReportError = {
  message: string;
  stack?: string;
  snippet?: string;
  location?: string;
};

export type ReportAttachment = {
  name: string;
  contentType: string;
  path: string;
  kind: AttachmentKind;
  role?: ShotRole;
  stepTitle?: string;
  omitted?: boolean;
};

export type Attempt = {
  retry: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  startTime: string;
  workerIndex: number;
  errors: ReportError[];
  stdout?: string;
  stderr?: string;
  steps: Step[];
  attachments: ReportAttachment[];
};

export type ReportTest = {
  id: string;
  title: string;
  file: string;
  line: number;
  project: string;
  group: string[];
  tags: string[];
  annotations: { type: string; description?: string }[];
  expectedFailure: boolean;
  status: DisplayStatus;
  duration: number;
  order: number;
  attempts: Attempt[];
};

export type InfoRow = { label: string; value: string };

export type Report = {
  version: 2;
  screenshots: ShotMode;
  steps: StepDetail;
  generatedAt: string;
  playwrightVersion: string;
  status: RunStatus;
  word: string;
  company: string;
  accent: Accent;
  showLogs: boolean;
  showFiles: boolean;
  overview: OverviewMode;
  chartStyle: ChartStyle;
  productSubtitle: string;
  showCredit: boolean;
  showPlaywrightVersion: boolean;
  showProjects: boolean;
  showProjectFilter: boolean;
  ignoreTags: string;
  summary: string;
  startTime: string;
  duration: number;
  projectName: string;
  info: InfoRow[];
  projects: string[];
  workers: number;
  shard: string | null;
  counts: Counts;
  warnings: string[];
  errors: ReportError[];
  tests: ReportTest[];
};

export type PendingFile = {
  name: string;
  target: string;
  contentType?: string;
  sourcePath?: string;
  body?: Buffer;
};
