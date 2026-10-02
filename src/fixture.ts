import { test as base, expect, type TestInfo } from '@playwright/test';
import { forgetPage, pageFor, rememberPage } from './context';

async function shot(name: string, testInfo?: TestInfo): Promise<void> {
  let info = testInfo;
  if (!info) {
    try {
      info = test.info();
    } catch {
      return;
    }
  }
  const page = pageFor(info);
  if (!page) return;
  try {
    const body = await page.screenshot({ timeout: 5_000 });
    await info.attach(name, { body, contentType: 'image/png' });
  } catch {
    // A closed page should not hide the test result.
  }
}

function screenshotMode(): string {
  return process.env.REBORN_SCREENSHOTS || 'failure';
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    rememberPage(testInfo, page);
    try {
      await use(page);
      const mode = screenshotMode();
      const failed = testInfo.status === 'failed' || testInfo.status === 'timedOut' || testInfo.status === 'interrupted'
        || (testInfo.status === 'passed' && testInfo.expectedStatus === 'failed');
      if ((mode === 'last' || mode === 'steps') && !failed) await shot('reborn:last', testInfo);
      if ((mode === 'failure' || mode === 'last' || mode === 'steps') && failed) await shot('reborn:failure', testInfo);
    } finally {
      forgetPage(testInfo);
    }
  },
});

export { expect };

export async function step<T>(title: string, body: () => Promise<T> | T): Promise<T> {
  const testInfo = test.info();
  return test.step(title, async () => {
    try {
      const value = await body();
      if (screenshotMode() === 'steps') await shot(`reborn:step:${title}`, testInfo);
      return value;
    } catch (error) {
      if (screenshotMode() === 'steps') await shot(`reborn:step:${title}`, testInfo);
      throw error;
    }
  });
}
