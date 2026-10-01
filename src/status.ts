import type { Counts, DisplayStatus, RunStatus } from './model';

export function displayStatus(pwOutcome: string, status: string): DisplayStatus {
  if (pwOutcome === 'flaky') return 'flaky';
  if (pwOutcome === 'skipped' || status === 'skipped') return 'skipped';
  if (status === 'timedOut') return 'timedOut';
  if (status === 'interrupted') return 'interrupted';
  if (pwOutcome === 'unexpected') return 'failed';
  if (status === 'failed') return 'passed';
  return 'passed';
}

export function isExpectedFailure(pwOutcome: string, status: string): boolean {
  return pwOutcome === 'expected' && status === 'failed';
}

export function emptyCounts(): Counts {
  return { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0, interrupted: 0 };
}

export function countTests(statuses: DisplayStatus[]): Counts {
  const counts = emptyCounts();
  counts.total = statuses.length;
  for (const status of statuses) counts[status] += 1;
  return counts;
}

export function outcomeWord(status: RunStatus): string {
  switch (status) {
    case 'passed':
      return 'Clear';
    case 'failed':
      return 'Broken';
    case 'timedout':
      return 'Timed out';
    case 'interrupted':
      return 'Stopped';
  }
}

export function summaryLine(counts: Counts): string {
  if (counts.total === 0) return 'No tests ran.';
  const problems: string[] = [];
  if (counts.failed) problems.push(`${counts.failed} failed`);
  if (counts.timedOut) problems.push(`${counts.timedOut} timed out`);
  if (counts.interrupted) problems.push(`${counts.interrupted} interrupted`);
  if (counts.flaky) problems.push(`${counts.flaky} flaky`);
  if (problems.length === 0 && counts.skipped === 0) {
    return counts.passed === 1 ? '1 passed.' : `${counts.passed} passed.`;
  }
  if (problems.length === 0) {
    return `${counts.passed} passed, ${counts.skipped} skipped. ${counts.total} ran.`;
  }
  return `${problems.join(', ')}. ${counts.total} ran.`;
}
