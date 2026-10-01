import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = process.cwd();
const htmlPath = path.join(root, 'marquee-report', 'index.html');
assert.equal(fs.existsSync(htmlPath), true, 'marquee-report/index.html was not written');

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script id="marquee-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match, 'report data was not embedded');
const data = JSON.parse(match[1]);
assert.equal(data.status, 'failed');
assert.equal(data.company, 'Sandata');
assert.equal(data.accent, 'green');
assert.equal(data.version, 2);
assert.ok(data.counts.failed >= 1 && data.counts.flaky >= 1 && data.counts.skipped >= 1 && data.counts.passed >= 1);
assert.ok(data.tests.some((test) => (test.attempts || []).some((attempt) => (attempt.stdout || '').includes('total is $14'))));
assert.ok(data.tests.some((test) => (test.attempts || []).some((attempt) => (attempt.stderr || '').includes('stock service slow'))));
const flaky = data.tests.find((test) => test.status === 'flaky');
assert.equal(flaky.attempts.length, 2);
assert.ok(data.tests.some((test) => test.attempts.some((attempt) => attempt.attachments.some((file) => file.role === 'step'))));
assert.ok(data.tests.some((test) => test.attempts.some((attempt) => attempt.attachments.some((file) => file.role === 'failure'))));
assert.equal(data.steps, 'user');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(pathToFileURL(htmlPath).href);
await page.evaluate(() => document.fonts.ready);
await page.getByRole('heading', { level: 1, name: 'Sandata' }).waitFor();
await page.getByText('Open source by World of Z').first().waitFor();
await page.waitForFunction(() => document.querySelector('#legend .count[data-status="failed"] .n')?.textContent === '1');
assert.equal(await page.locator('#panel-tests').isHidden(), true);
assert.equal(await page.locator('#gallery img').count(), 0);
const strip = await page.locator('#strip').elementHandle();
await page.screenshot({ path: '/tmp/marquee-landing.png', fullPage: true });

await page.getByRole('tab', { name: 'Tests' }).click();
await page.getByText('1842', { exact: false }).first().waitFor();
await page.screenshot({ path: '/tmp/marquee-tests.png', fullPage: true });

await page.getByRole('tab', { name: 'Screenshots' }).click();
await page.locator('#gallery img').first().waitFor();
await page.getByRole('button', { name: 'Every step' }).click();
await page.locator('#gallery .tile:not([hidden])').first().waitFor();
const stepRoles = await page.locator('#gallery .tile:not([hidden])').evaluateAll((nodes) => nodes.map((node) => node.dataset.role));
assert.ok(stepRoles.every((role) => role === 'step'));
await page.getByRole('button', { name: 'Last failing step' }).click();
await page.locator('#gallery .tile:not([hidden]) .shot').first().click();
await page.locator('dialog img').waitFor();
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Open test' }).first().click();
await page.locator('#detail').waitFor();
await page.screenshot({ path: '/tmp/marquee-shots.png', fullPage: false });

await page.getByRole('tab', { name: 'Logs' }).click();
await page.getByText('order text', { exact: false }).first().waitFor();
await page.getByText('stock service slow', { exact: false }).first().waitFor();

await page.getByRole('tab', { name: 'Files' }).click();
await page.getByText('show-trace', { exact: false }).first().waitFor();
assert.equal(await page.locator('#panel-files img').count(), 0);

await page.getByRole('tab', { name: 'Tests' }).click();
await page.locator('#find').fill('session');
await page.waitForTimeout(120);
const sameStrip = await page.evaluate((node) => node === document.querySelector('#strip'), strip);
assert.equal(sameStrip, true);
await page.locator('#tests .row').first().waitFor();

await page.setViewportSize({ width: 390, height: 844 });
const overflow = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
assert.ok(overflow.scroll <= overflow.client + 1, `page overflows by ${overflow.scroll - overflow.client}px`);
await page.screenshot({ path: '/tmp/marquee-mobile.png', fullPage: true });

assert.deepEqual(errors, []);
await browser.close();
console.log('Marquee report verified');
