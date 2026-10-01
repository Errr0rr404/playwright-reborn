import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = process.cwd();
const htmlPath = path.join(root, 'reborn-report', 'index.html');
assert.equal(fs.existsSync(htmlPath), true, 'reborn-report/index.html was not written');

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script id="reborn-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match, 'report data was not embedded');
const data = JSON.parse(match[1]);
assert.equal(data.status, 'failed');
assert.equal(data.company, 'playwrightReport');
assert.equal(html.includes('assets/report.css'), false);
assert.equal(html.includes('<style>'), true);
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
await page.getByRole('heading', { level: 1, name: 'playwrightReport' }).waitFor();
await page.getByText('Open source by World of Z').first().waitFor();
await page.waitForFunction(() => document.querySelector('#legend .count[data-status="failed"] .n')?.textContent === '1');
const ran = data.tests.filter((test) => test.status !== 'skipped');
const inBand = (min, max) => ran.filter((test) => test.duration >= min && (max == null || test.duration < max)).length;
assert.equal(await page.locator('#duration [data-band="under1"] .n').innerText(), String(inBand(0, 60000)));
assert.equal(await page.locator('#duration [data-band="1to3"] .n').innerText(), String(inBand(60000, 180000)));
assert.equal(await page.locator('#duration [data-band="3to5"] .n').innerText(), String(inBand(180000, 300000)));
assert.equal(await page.locator('#duration [data-band="over5"] .n').innerText(), String(inBand(300000, null)));
assert.equal(await page.getByRole('heading', { name: 'Slowest' }).count(), 0);
assert.equal(await page.locator('#strip-window').isHidden(), true);
await page.getByRole('button', { name: 'Timeline', exact: true }).click();
const failed = data.tests.find((test) => test.status === 'failed');
const failedRow = page.locator('#strip .run-row[data-status="failed"]');
const failedText = await failedRow.innerText();
assert.ok(failedText.includes('Failed') && failedText.includes(failed.title), failedText);
const bar = await failedRow.evaluate((node) => {
  const fill = node.querySelector('.run-fill').getBoundingClientRect().width;
  const track = node.querySelector('.run-track').getBoundingClientRect().width;
  const name = getComputedStyle(node.querySelector('.run-name')).color;
  const bg = getComputedStyle(node).backgroundColor;
  return { fill, track, name, bg };
});
assert.notEqual(bar.bg, 'rgb(0, 255, 136)', 'failed row must not be a solid green bar');
assert.notEqual(bar.name, bar.bg, 'failed test name must stay readable');
assert.ok(bar.fill < bar.track * 0.6, `duration bar filled the track (${bar.fill} of ${bar.track})`);
await page.getByRole('button', { name: 'Chart', exact: true }).click();
assert.equal(await page.locator('#strip-window').isHidden(), true);
assert.equal(await page.locator('#panel-tests').isHidden(), true);
assert.equal(await page.locator('#gallery img').count(), 0);
const strip = await page.locator('#strip').elementHandle();
assert.equal(await page.locator('#now').count(), 0);
await page.screenshot({ path: '/tmp/reborn-landing.png', fullPage: true });

await page.locator('#duration [data-band="under1"]').click();
const longest = data.tests.slice().sort((a, b) => (b.duration || 0) - (a.duration || 0) || a.title.localeCompare(b.title))[0];
assert.equal(await page.locator('.band-clear').innerText(), 'Under 1 minute');
assert.equal(await page.locator('#order [data-order="slowest"]').getAttribute('aria-pressed'), 'true');
assert.equal(await page.locator('#tests .row .row-title').first().innerText(), longest.title);
await page.locator('.band-clear').click();
assert.equal(await page.locator('.band-clear').count(), 0);

await page.getByRole('button', { name: 'Grouped', exact: true }).click();
await page.getByText('1842', { exact: false }).first().waitFor();
await page.getByRole('button', { name: 'Slowest', exact: true }).click();
assert.equal(await page.locator('#tests .row .row-title').first().innerText(), longest.title);
await page.screenshot({ path: '/tmp/reborn-tests.png', fullPage: true });

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
await page.screenshot({ path: '/tmp/reborn-shots.png', fullPage: false });

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
await page.screenshot({ path: '/tmp/reborn-mobile.png', fullPage: true });

assert.deepEqual(errors, []);
await browser.close();
console.log('Reborn report verified');
