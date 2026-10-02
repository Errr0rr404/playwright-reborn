import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
const startedAt = Date.now();
const run = spawnSync(process.execPath, [cli, 'test'], { stdio: 'inherit' });
if (run.error) throw run.error;
// The demo intentionally contains one failing and one flaky test. The UI
// verifier checks those exact counts, so unexpected failures cannot be hidden.
assert.equal(run.status, 1, 'The demo must finish with its intentional failure');
const html = await fs.readFile(path.resolve('reborn-report/index.html'), 'utf8');
const report = JSON.parse(html.match(/<script id="reborn-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || 'null');
assert.ok(report && Date.parse(report.generatedAt) >= startedAt, 'The demo did not write a fresh report');
await import('./verify-ui.mjs');
