import fs from 'node:fs/promises';
import path from 'node:path';
import { embedJson } from './format';
import type { HistoryRun, ReportHistory, RunStatus } from './model';
import { DATA_TAG, findReportFile } from './paths';

const DATA_BLOCK = /(<script id="reborn-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
const RUN_HREF = /^history\/([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+\.html$/;
const STATUSES = new Set<RunStatus>(['passed', 'failed', 'timedout', 'interrupted']);

export type PreviousReport = {
  file: string;
  generatedAt: string;
  status: RunStatus;
  summary: string;
  runs: HistoryRun[];
};

type Move = { from: string; to: string };

export function readReportData(html: string): Record<string, unknown> | null {
  const match = html.match(DATA_BLOCK);
  if (!match) return null;
  try {
    const data = JSON.parse(match[2]);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function runId(href: string): string {
  return RUN_HREF.exec(href)?.[1] || '';
}

function validRun(value: unknown): value is HistoryRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Record<string, unknown>;
  return typeof run.href === 'string' && Boolean(runId(run.href))
    && typeof run.generatedAt === 'string'
    && typeof run.summary === 'string'
    && STATUSES.has(run.status as RunStatus);
}

async function isFolder(target: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(target);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

// Reads the report this run is about to replace. Anything that is not a
// readable Reborn report is left to prepareOutput, which refuses or clears it.
export async function readPrevious(outputDir: string): Promise<PreviousReport | null> {
  if (!(await isFolder(outputDir))) return null;
  const file = await findReportFile(outputDir);
  if (!file) return null;
  const data = readReportData(await fs.readFile(path.join(outputDir, file), 'utf8'));
  if (!data || typeof data.generatedAt !== 'string' || !STATUSES.has(data.status as RunStatus)) return null;
  const history = data.history as Partial<ReportHistory> | undefined;
  const runs: HistoryRun[] = [];
  for (const run of Array.isArray(history?.runs) ? history.runs : []) {
    if (validRun(run) && (await isFolder(path.join(outputDir, 'history', runId(run.href))))) runs.push(run);
  }
  return {
    file,
    generatedAt: data.generatedAt,
    status: data.status as RunStatus,
    summary: typeof data.summary === 'string' ? data.summary : '',
    runs,
  };
}

function folderName(generatedAt: string, taken: Set<string>): string {
  const base = generatedAt.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '') || 'run';
  let name = base;
  for (let index = 2; taken.has(name); index += 1) name = `${base}-${index}`;
  return name;
}

// The newest earlier run comes first. `keep` caps how many stay.
export function nextHistory(previous: PreviousReport | null, keep: number, reportFileName: string): ReportHistory {
  const runs: HistoryRun[] = [];
  if (previous && keep > 0) {
    const older = previous.runs.slice(0, keep - 1);
    const id = folderName(previous.generatedAt, new Set(older.map((run) => runId(run.href))));
    runs.push({
      href: `history/${id}/${previous.file}`,
      generatedAt: previous.generatedAt,
      status: previous.status,
      summary: previous.summary,
    }, ...older);
  }
  return { base: '', latest: reportFileName, archived: false, runs };
}

async function move(moves: Move[], from: string, to: string): Promise<void> {
  await fs.rename(from, to);
  moves.push({ from, to });
}

// Moves the previous report into staging/history/<id>/ and carries kept runs
// along. If a move fails, every earlier move is put back.
export async function archivePrevious(outputDir: string, staging: string, history: ReportHistory): Promise<void> {
  const newest = history.runs[0];
  if (!newest) return;
  const keepIds = new Set(history.runs.map((run) => runId(run.href)));
  const id = runId(newest.href);
  const historyDir = path.join(staging, 'history');
  const moves: Move[] = [];
  try {
    await fs.mkdir(historyDir);
    const oldHistory = path.join(outputDir, 'history');
    if (await isFolder(oldHistory)) {
      for (const entry of await fs.readdir(oldHistory)) {
        if (keepIds.has(entry)) await move(moves, path.join(oldHistory, entry), path.join(historyDir, entry));
      }
    }
    const destination = path.join(historyDir, id);
    await fs.mkdir(destination);
    for (const entry of await fs.readdir(outputDir)) {
      if (entry === 'history') continue;
      await move(moves, path.join(outputDir, entry), path.join(destination, entry));
    }
  } catch (error) {
    for (const step of moves.reverse()) await fs.rename(step.to, step.from).catch(() => undefined);
    throw error;
  }
  // Only runs past the `history` limit are left behind.
  await fs.rm(path.join(outputDir, 'history'), { recursive: true, force: true });
  try {
    await markArchived(path.join(historyDir, id, newest.href.split('/').pop() || ''), history.latest);
  } catch {
    // The archived page still opens; it only lacks the link back to the newest run.
  }
}

// An archived page links back to the newest report instead of listing runs
// that later runs may have removed.
async function markArchived(file: string, latest: string): Promise<void> {
  const html = await fs.readFile(file, 'utf8');
  const data = readReportData(html);
  if (!data || !html.includes(DATA_TAG)) return;
  data.history = { base: '../../', latest, archived: true, runs: [] } satisfies ReportHistory;
  const json = embedJson(data);
  await fs.writeFile(file, html.replace(DATA_BLOCK, (_match, open: string, _json: string, close: string) => open + json + close), 'utf8');
}
