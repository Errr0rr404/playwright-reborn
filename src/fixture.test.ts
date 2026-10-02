import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import type { Report } from './model';

it('runs the reporter and screenshot fixture through Playwright in parallel for every mode', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-fixture-'));
  try {
    const fixture = path.join(__dirname, 'fixture.js');
    const runner = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    await fs.writeFile(path.join(root, 'fixture.spec.js'), `
      const { test: base, expect, step } = require(${JSON.stringify(fixture)});
      // Stub only browser I/O; Playwright runs the real fixture lifecycle and reporter.
      const test = base.extend({ context: async ({}, use, info) => {
        await use({ newPage: async () => ({ screenshot: async () => Buffer.from(info.title) }) });
      }});
      test.describe.configure({ mode: 'parallel' });
      for (const name of ['alpha', 'beta']) test(name, async ({ page }) => {
        expect(await step('returns a value', async () => 42)).toBe(42);
      });
      test('failure', async ({ page }) => {
        await step('fails here', async () => { throw new Error('intentional failure'); });
      });
      test('unexpected pass', async ({ page }) => { test.fail(); });
    `);
    for (const mode of ['steps', 'failure', 'last', 'off'] as const) {
      const output = path.join(root, `report-${mode}`);
      await fs.writeFile(path.join(root, 'playwright.config.js'), `module.exports = {
        testDir: '.', workers: 2, reporter: [[${JSON.stringify(path.join(__dirname, 'index.js'))}, {
          open: 'never', screenshots: '${mode}', outputFolder: ${JSON.stringify(output)}, reportFileName: 'qa.html'
        }]],
      };`);
      const run = spawnSync(process.execPath, [runner, 'test', '--config', path.join(root, 'playwright.config.js')], {
        cwd: root, encoding: 'utf8', timeout: 30_000,
      });
      assert.equal(run.error, undefined);
      assert.equal(run.status, 1, run.stdout + run.stderr);
      const html = await fs.readFile(path.join(output, 'qa.html'), 'utf8');
      const report: Report = JSON.parse(html.match(/<script id="reborn-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
      assert.equal(report.counts.passed, 2, run.stdout + run.stderr);
      assert.equal(report.counts.failed, 2);
      for (const entry of report.tests) {
        const attachments = entry.attempts[0].attachments.filter(attachment => attachment.kind === 'image');
        if (mode === 'off') { assert.equal(attachments.length, 0); continue; }
        const failed = entry.status === 'failed';
        const expectedCount = mode === 'steps' ? (entry.title === 'unexpected pass' ? 1 : 2) : failed || mode === 'last' ? 1 : 0;
        assert.equal(attachments.length, expectedCount, `${mode}: ${entry.title} ${JSON.stringify(attachments.map(({name, role}) => ({name, role})))}`);
        for (const attachment of attachments) {
          assert.equal(Buffer.from(attachment.path.split(',')[1], 'base64').toString(), entry.title);
        }
        if (failed) assert.equal(attachments.at(-1)?.role, 'failure');
        else if (mode === 'steps' || mode === 'last') assert.equal(attachments.at(-1)?.role, 'last');
      }
      assert.equal(report.tests.find(test => test.title === 'unexpected pass')?.attempts[0].errors[0].message, 'Expected to fail, but passed.');
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
