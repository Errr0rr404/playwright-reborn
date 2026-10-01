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
      tags: ['@cart'],
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
        steps: [],
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
    });

    assert.equal(report.word, 'Broken');
    assert.equal(report.company, 'Sandata');
    assert.equal(report.accent, 'green');
    assert.equal(report.overview, 'chart');
    assert.equal(report.summary, '1 failed. 3 ran.');
    assert.deepEqual(report.tests.map((test) => test.title), [
      'receipt shows the order id',
      'legacy import',
      'total matches',
    ]);
    assert.equal(report.tests[0].status, 'failed');
    assert.equal(report.tests[0].attempts[0].errors[0].message, 'Expected 1842');
    assert.deepEqual(report.tests[2].group, ['cart']);
    assert.equal(report.tests[2].file, 'demo/cart.spec.ts');
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
});
