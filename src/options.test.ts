import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOptions } from './options';

describe('parseOptions', () => {
  it('defaults to a finale-report folder that opens on failure', () => {
    assert.deepEqual(parseOptions(), {
      outputFolder: 'finale-report',
      outputExplicit: false,
      open: 'on-failure',
      screenshots: 'failure',
      steps: 'user',
      company: 'Sandata',
      accent: 'green',
      showLogs: true,
      showFiles: true,
      overview: 'chart',
    });
  });

  it('rejects an unknown overview', () => {
    assert.throws(() => parseOptions({ overview: 'pie' as 'chart' }), /overview must be/);
    assert.equal(parseOptions({ overview: 'timeline' }).overview, 'timeline');
  });

  it('rejects a blank company name and an unknown accent', () => {
    assert.throws(() => parseOptions({ company: '   ' }), /company must be/);
    assert.throws(() => parseOptions({ accent: 'pink' as 'green' }), /accent must be/);
  });

  it('rejects an unknown screenshot mode', () => {
    assert.throws(() => parseOptions({ screenshots: 'always' as 'off' }), /screenshots must be/);
  });

  it('rejects an unknown open mode', () => {
    assert.throws(() => parseOptions({ open: 'sometimes' as 'always' }), /open must be/);
  });

  it('remembers when the folder was set explicitly', () => {
    const parsed = parseOptions({ outputFolder: 'custom', open: 'never' });
    assert.equal(parsed.outputFolder, 'custom');
    assert.equal(parsed.outputExplicit, true);
    assert.equal(parsed.open, 'never');
  });
});
