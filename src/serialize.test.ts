import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReport, type SourceSuite, type SourceTest } from './serialize';

function suite(type: SourceSuite['type'], title: string, parent?: SourceSuite): SourceSuite {
  return { type, title, parent };
}

describe('buildReport', () => {
  it('counts outcomes, orders by start time, and names attachment files', () => {
    const project = suite('project', 'chromium', suite('root', ''));
    const file = suite('file', 'demo/cart.spec.ts', project);
    const group = suite('describe', 'cart', file);
    const started = new Date('2026-10-01T15:00:00.000Z');

    const pass: SourceTest = {
      id: 'pass',
      title: 'total matches',
      location: { file: '/repo/demo/cart.spec.ts', line: 4, column: 1 },
      parent: group,
      annotations: [],
      tags: ['@cart', '@HC2T-9'],
      outcome: () => 'expected',
      results: [{
        retry: 0,
        status: 'passed',
        duration: 40,
        startTime: new Date(started.getTime() + 500),
        workerIndex: 1,
        stdout: ['total is $14\n'],
        stderr: [],
        steps: [{
          title: 'read the total',
          category: 'test.step',
          duration: 10,
          steps: [{ title: 'Click', category: 'pw:api', duration: 2, steps: [] }],
        }],
        attachments: [
          { name: 'cart', contentType: 'image/png', body: Buffer.from('png') },
          { name: 'reborn:step:read the total', contentType: 'image/png', body: Buffer.from('step') },
        ],
      }],
    };
    const fail: SourceTest = {
      id: 'fail',
      title: 'receipt shows the order id',
      location: { file: '/repo/demo/cart.spec.ts', line: 20, column: 1 },
      parent: group,
      annotations: [],
      tags: [],
      outcome: () => 'unexpected',
      results: [{
        retry: 0,
        status: 'failed',
        duration: 80,
        startTime: started,
        workerIndex: 0,
        errors: [{ message: '\u001b[31mExpected 1842\u001b[0m' }],
        stdout: [],
        stderr: [],
        steps: [
          {
            title: 'Before Hooks',
            category: 'hook',
            duration: 1,
            steps: [{ title: 'Click', category: 'pw:api', duration: 1, steps: [] }],
          },
          { title: 'read the receipt', category: 'test.step', duration: 5, steps: [] },
        ],
        attachments: [],
      }],
    };
    const skip: SourceTest = {
      id: 'skip',
      title: 'legacy import',
      location: { file: '/repo/demo/account.spec.ts', line: 8, column: 1 },
      parent: file,
      annotations: [{ type: 'skip', description: 'Importer is retired' }],
      tags: [],
      outcome: () => 'skipped',
      results: [{
        retry: 0,
        status: 'skipped',
        duration: 0,
        startTime: new Date(started.getTime() + 50),
        workerIndex: -1,
        stdout: [],
        stderr: [],
        steps: [],
        attachments: [],
      }],
    };

    const { report, files } = buildReport({
      tests: [pass, fail, skip],
      rootDir: '/repo',
      playwrightVersion: '1.63.0',
      projectName: 'playwrightReport',
      projects: ['chromium'],
      workers: 2,
      shard: null,
      status: 'failed',
      startTime: started,
      duration: 900,
      generatedAt: started.toISOString(),
      errors: [],
      info: [{ label: 'Environment', value: 'qa' }],
    });

    assert.equal(report.word, 'Broken');
    assert.equal(report.company, 'playwrightReport');
    assert.deepEqual(report.info, [{ label: 'Environment', value: 'qa' }]);
    assert.equal(report.accent, 'green');
    assert.equal(report.overview, 'chart');
    assert.equal(report.summary, '1 failed. 3 tests.');
    assert.deepEqual(report.tests.map((test) => test.title), [
      'receipt shows the order id',
      'legacy import',
      'total matches',
    ]);
    assert.equal(report.tests[0].status, 'failed');
    assert.deepEqual(report.tests[0].attempts[0].steps.map((step) => step.title), ['read the receipt']);
    assert.equal(report.tests[0].attempts[0].errors[0].message, 'Expected 1842');
    assert.deepEqual(report.tests[2].group, ['cart']);
    assert.equal(report.tests[2].file, 'demo/cart.spec.ts');
    assert.deepEqual(report.tests[2].tags, ['@cart']);
    assert.equal(report.tests[2].attempts[0].stdout, 'total is $14\n');
    assert.equal(files.length, 2);
    assert.equal(files[0].target, 'assets/attachments/000-cart.png');
    assert.equal(report.tests[2].attempts[0].attachments[0].kind, 'image');
    assert.equal(report.tests[2].attempts[0].attachments[1].role, 'step');
    assert.equal(report.tests[2].attempts[0].attachments[1].name, 'read the total');
    assert.equal(report.tests[2].attempts[0].steps[0].steps.length, 0);
    assert.equal(report.steps, 'user');
    assert.equal(report.counts.skipped, 1);
  });

  it('hides expectations and attachment calls from the user step tree', () => {
    const project = suite('project', 'chromium', suite('root', ''));
    const file = suite('file', 'demo/cart.spec.ts', project);
    const started = new Date('2026-10-01T15:00:00.000Z');
    const steps = [
      {
        title: 'Before Hooks',
        category: 'hook',
        duration: 1,
        steps: [{ title: 'Click', category: 'pw:api', duration: 1, steps: [] }],
      },
      {
        title: 'read the receipt',
        category: 'test.step',
        duration: 5,
        error: { message: 'Expected 1842' },
        steps: [
          {
            title: 'Expect "toBe"',
            category: 'expect',
            duration: 2,
            error: { message: 'Expected 1842' },
            steps: [{ title: 'Get text', category: 'pw:api', duration: 1, steps: [] }],
          },
          { title: 'Attach "note"', category: 'test.attach', duration: 1, steps: [] },
        ],
      },
      { title: 'Attach "cart"', category: 'test.attach', duration: 1, steps: [] },
      { title: 'fixture: page', category: 'fixture', duration: 1, steps: [] },
      {
        title: 'Expect "toBe"',
        category: 'expect',
        duration: 1,
        steps: [{ title: 'check the ledger', category: 'test.step', duration: 1, steps: [] }],
      },
    ];
    const test: SourceTest = {
      id: 'one',
      title: 'receipt shows the order id',
      location: { file: '/repo/demo/cart.spec.ts', line: 20, column: 1 },
      parent: file,
      annotations: [],
      tags: [],
      outcome: () => 'unexpected',
      results: [{
        retry: 0,
        status: 'failed',
        duration: 40,
        startTime: started,
        workerIndex: 0,
        errors: [{ message: 'Expected 1842' }],
        stdout: [],
        stderr: [],
        steps,
        attachments: [{ name: 'note', contentType: 'text/plain', body: Buffer.from('hi') }],
      }],
    };
    const input = {
      tests: [test],
      rootDir: '/repo',
      playwrightVersion: '1.63.0',
      projectName: 'playwrightReport',
      projects: ['chromium'],
      workers: 1,
      shard: null,
      status: 'failed' as const,
      startTime: started,
      duration: 40,
      generatedAt: started.toISOString(),
      errors: [],
    };

    const user = buildReport({ ...input, stepDetail: 'user' });
    const userSteps = user.report.tests[0].attempts[0].steps;
    assert.deepEqual(userSteps.map((step) => step.title), ['read the receipt', 'check the ledger']);
    assert.equal(userSteps[0].steps.length, 0);
    assert.equal(userSteps[0].error, 'Expected 1842');
    assert.equal(user.report.tests[0].attempts[0].errors[0].message, 'Expected 1842');
    assert.equal(user.report.tests[0].attempts[0].attachments[0].name, 'note');

    const all = buildReport({ ...input, stepDetail: 'all' });
    assert.deepEqual(all.report.tests[0].attempts[0].steps.map((step) => step.title), [
      'Before Hooks',
      'read the receipt',
      'Attach "cart"',
      'fixture: page',
      'Expect "toBe"',
    ]);
    assert.deepEqual(all.report.tests[0].attempts[0].steps[1].steps.map((step) => step.title), [
      'Expect "toBe"',
      'Attach "note"',
    ]);
  });
});

describe('report edge cases', () => {
  const started = new Date('2026-10-01T15:00:00Z');
  const base: SourceTest = {
    id: 'one', title: 'example', parent: suite('file', 'test.ts'),
    location: { file: '/repo/test.ts', line: 1, column: 1 }, tags: [], annotations: [],
    outcome: () => 'expected',
    results: [{ retry: 0, status: 'passed', duration: 10, startTime: started, workerIndex: 0 }],
  };
  const input = {
    rootDir: '/repo', playwrightVersion: '1.63.0', projectName: 'Example', projects: [], workers: 1,
    shard: null, status: 'passed' as const, startTime: started, duration: 10,
    generatedAt: started.toISOString(), errors: [],
  };

  it('deduplicates attachments shared between the result and its steps without merging distinct bodies', () => {
    const attachment = { name: 'shot', contentType: 'image/png', body: Buffer.from('png') };
    const other = { ...attachment, body: Buffer.from('png') };
    const result = { ...base.results[0], attachments: [attachment, other], steps: [{
      title: 'step', category: 'test.step', duration: 1, attachments: [attachment, { ...attachment }],
    }] };
    const built = buildReport({ ...input, tests: [{ ...base, results: [result] }] });
    assert.equal(built.files.length, 2);
    assert.equal(built.report.tests[0].attempts[0].attachments.length, 2);
  });

  it('keeps generated ids unique when duplicate ids overlap existing suffixes', () => {
    const built = buildReport({ ...input, tests: [base, { ...base }, { ...base, id: 'one-1' }] });
    assert.equal(new Set(built.report.tests.map(test => test.id)).size, 3);
  });

  it('explains an unexpected pass and counts interrupted results correctly', () => {
    const built = buildReport({ ...input, tests: [
      { ...base, expectedStatus: 'failed', outcome: () => 'unexpected' },
      { ...base, id: 'interrupted', outcome: () => 'skipped', results: [{ ...base.results[0], status: 'interrupted' }] },
    ] });
    assert.equal(built.report.counts.failed, 1);
    assert.equal(built.report.counts.interrupted, 1);
    assert.equal(built.report.counts.skipped, 0);
    assert.equal(built.report.tests.find(test => test.id === 'one')?.attempts[0].errors[0].message, 'Expected to fail, but passed.');
  });
});
