import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

let activePage: Page | undefined;
let activeInfo: TestInfo | undefined;

async function shot(name: string): Promise<void> {
  if (!activePage || !activeInfo) return;
  try {
    const body = await activePage.screenshot({ timeout: 5_000 });
    await activeInfo.attach(name, { body, contentType: 'image/png' });
  } catch {
    // A closed page should not hide the test result.
  }
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    activePage = page;
    activeInfo = testInfo;
    try {
      await use(page);
      const mode = process.env.REBORN_SCREENSHOTS || 'failure';
      const failed = testInfo.status === 'failed' || testInfo.status === 'timedOut';
      if (mode === 'last' || (mode === 'steps' && !failed)) await shot('reborn:last');
      if ((mode === 'failure' || mode === 'steps') && failed) await shot('reborn:failure');
    } finally {
      activePage = undefined;
      activeInfo = undefined;
    }
  },
});

export { expect };

export async function step(title: string, body: () => Promise<void>): Promise<void> {
  await test.step(title, async () => {
    try {
      await body();
    } catch (error) {
      if (process.env.REBORN_SCREENSHOTS === 'steps') await shot(`reborn:step:${title}`);
      throw error;
    }
    if (process.env.REBORN_SCREENSHOTS === 'steps') await shot(`reborn:step:${title}`);
  });
}
