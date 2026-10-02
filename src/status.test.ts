import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countTests, displayStatus, isExpectedFailure, outcomeWord, summaryLine } from './status';

describe('displayStatus', () => {
  it('maps Playwright outcomes onto the report', () => {
    assert.equal(displayStatus('expected', 'passed'), 'passed');
    assert.equal(displayStatus('expected', 'failed'), 'passed');
    assert.equal(displayStatus('unexpected', 'passed'), 'failed');
    assert.equal(displayStatus('unexpected', 'failed'), 'failed');
    assert.equal(displayStatus('unexpected', 'timedOut'), 'timedOut');
    assert.equal(displayStatus('unexpected', 'interrupted'), 'interrupted');
    assert.equal(displayStatus('flaky', 'passed'), 'flaky');
    assert.equal(displayStatus('skipped', 'skipped'), 'skipped');
    assert.equal(displayStatus('skipped', 'interrupted'), 'interrupted');
    assert.equal(isExpectedFailure('expected', 'failed'), true);
    assert.equal(isExpectedFailure('unexpected', 'failed'), false);
  });
});

describe('summaryLine', () => {
  it('describes the run', () => {
    assert.equal(outcomeWord('failed'), 'Broken');
    assert.equal(outcomeWord('passed'), 'Clear');
    assert.equal(outcomeWord('timedout'), 'Timed out');
    assert.equal(summaryLine(countTests([])), 'No tests ran.');
    assert.equal(summaryLine(countTests(['passed', 'passed'])), '2 passed.');
    assert.equal(
      summaryLine(countTests(['failed', 'flaky', 'passed'])),
      '1 failed, 1 flaky. 3 tests.',
    );
    assert.equal(
      summaryLine(countTests(['passed', 'skipped'])),
      '1 passed, 1 skipped. 2 tests.',
    );
  });
});
