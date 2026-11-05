import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOptions } from './options';

describe('parseOptions', () => {
  it('does not open a report automatically in CI and honors an explicit choice', () => {
    const previous = process.env.CI;
    process.env.CI = '1';
    try {
      assert.equal(parseOptions().open, 'never');
      assert.equal(parseOptions({ open: 'always' }).open, 'always');
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });

  it('validates hidden project filter options', () => {
    assert.throws(() => parseOptions({ showProjectFilter: 'yes' as unknown as boolean }), /showProjectFilter/);
    assert.throws(() => parseOptions({ reportFileName: 123 as unknown as string }), /reportFileName/);
  });
  it('defaults to a reborn-report folder that opens on failure', () => {
    assert.deepEqual(parseOptions(), {
      outputFolder: 'reborn-report',
      outputExplicit: false,
      open: process.env.CI ? 'never' : 'on-failure',
      screenshots: 'failure',
      steps: 'user',
      company: '',
      accent: 'green',
      showLogs: true,
      showFiles: true,
      overview: 'chart',
      inline: true,
      reportFileName: 'index.html',
      suite: '',
      user: '',
      environment: '',
      state: '',
      defects: [],
      productSubtitle: 'Test Automation',
      brandName: 'Reborn',
      brandCaption: 'Test reports',
      dashboardTitle: 'Run overview',
      history: 0,
      showCredit: false,
      showPlaywrightVersion: false,
      showProjects: false,
      showProjectFilter: false,
      commitShort: true,
      chartStyle: 'bar',
      ignoreTags: '^@?HC2T-',
    });
  });

  it('rejects an unknown chart style', () => {
    assert.throws(() => parseOptions({ chartStyle: 'donut' as 'pie' }), /chartStyle must be/);
    assert.equal(parseOptions({ ignoreTags: false }).ignoreTags, '');
  });

  it('rejects a path in the report file name', () => {
    assert.throws(() => parseOptions({ reportFileName: '../index.html' }), /reportFileName must be/);
    assert.equal(parseOptions({ inline: false, defects: 'PAY-1' }).defects[0], 'PAY-1');
  });

  it('rejects an unknown overview', () => {
    assert.throws(() => parseOptions({ overview: 'pie' as 'chart' }), /overview must be/);
    assert.equal(parseOptions({ overview: 'timeline' }).overview, 'timeline');
  });

  it('takes a brand name, caption, and dashboard title with the same text rules as company', () => {
    const parsed = parseOptions({ brandName: '  Acme Labs ', brandCaption: 'Example QA', dashboardTitle: 'Nightly run' });
    assert.equal(parsed.brandName, 'Acme Labs');
    assert.equal(parsed.brandCaption, 'Example QA');
    assert.equal(parsed.dashboardTitle, 'Nightly run');
    assert.equal(parseOptions({ brandCaption: '' }).brandCaption, '');
    assert.equal(parseOptions({ productSubtitle: '  ' }).productSubtitle, '');
    assert.throws(() => parseOptions({ brandName: '   ' }), /brandName must be/);
    assert.throws(() => parseOptions({ dashboardTitle: '' }), /dashboardTitle must be/);
    assert.throws(() => parseOptions({ brandCaption: 3 as unknown as string }), /brandCaption must be text/);
  });

  it('accepts a whole number of earlier runs to keep', () => {
    assert.equal(parseOptions({ history: 5 }).history, 5);
    assert.throws(() => parseOptions({ history: -1 }), /history must be/);
    assert.throws(() => parseOptions({ history: 1.5 }), /history must be/);
    assert.throws(() => parseOptions({ history: '3' as unknown as number }), /history must be/);
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
