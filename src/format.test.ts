import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachmentKind,
  embedJson,
  extensionFor,
  durationBand,
  formatDuration,
  parseShotName,
  safeFileName,
  stripAnsi,
} from './format';

describe('formatDuration', () => {
  it('formats milliseconds, seconds, and minutes', () => {
    assert.equal(formatDuration(0), '0ms');
    assert.equal(formatDuration(842), '842ms');
    assert.equal(formatDuration(1400), '1.4s');
    assert.equal(formatDuration(12400), '12s');
    assert.equal(formatDuration(65000), '1m 05s');
    assert.equal(formatDuration(Number.NaN), '0ms');
  });
});

describe('durationBand', () => {
  it('splits a run at 1, 3, and 5 minutes', () => {
    assert.equal(durationBand(0), 'under1');
    assert.equal(durationBand(59_999), 'under1');
    assert.equal(durationBand(60_000), '1to3');
    assert.equal(durationBand(179_999), '1to3');
    assert.equal(durationBand(180_000), '3to5');
    assert.equal(durationBand(299_999), '3to5');
    assert.equal(durationBand(300_000), 'over5');
    assert.equal(durationBand(Number.NaN), 'under1');
  });
});

describe('embedJson', () => {
  it('keeps a closing script tag from breaking the HTML', () => {
    const raw = embedJson({ message: '</script><script>alert(1)</script>' });
    assert.equal(raw.includes('<'), false);
    assert.deepEqual(JSON.parse(raw), { message: '</script><script>alert(1)</script>' });
  });
});

describe('stripAnsi', () => {
  it('removes color codes', () => {
    assert.equal(stripAnsi('\u001b[31mfailed\u001b[0m'), 'failed');
  });
});

describe('attachment names', () => {
  it('builds a safe file name and kind', () => {
    assert.equal(safeFileName('../../Screenshot 1', 2, '.png'), '002-screenshot-1.png');
    assert.equal(safeFileName('', 0, '.txt'), '000-file.txt');
    assert.equal(safeFileName('note', 1, 'png'), '001-note');
    assert.equal(extensionFor('image/png; charset=binary'), '.png');
    assert.equal(attachmentKind('trace', 'application/zip'), 'trace');
    assert.equal(attachmentKind('notes', 'application/zip'), 'file');
    assert.equal(attachmentKind('cart', 'image/png'), 'image');
    assert.equal(attachmentKind('clip', 'video/webm'), 'video');
  });
});

describe('parseShotName', () => {
  it('reads Marquee shot prefixes', () => {
    assert.deepEqual(parseShotName('marquee:step:read the receipt'), {
      name: 'read the receipt',
      role: 'step',
      stepTitle: 'read the receipt',
    });
    assert.deepEqual(parseShotName('marquee:failure'), { name: 'Failure', role: 'failure' });
    assert.deepEqual(parseShotName('marquee:last'), { name: 'Last step', role: 'last' });
    assert.equal(parseShotName('cart').name, 'cart');
    assert.equal(parseShotName('cart').role, undefined);
  });
});
