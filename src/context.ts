import type { Page, TestInfo } from '@playwright/test';

const pages = new WeakMap<TestInfo, Page>();

export function rememberPage(testInfo: TestInfo, page: Page): void {
  pages.set(testInfo, page);
}

export function forgetPage(testInfo: TestInfo): void {
  pages.delete(testInfo);
}

export function pageFor(testInfo: TestInfo): Page | undefined {
  return pages.get(testInfo);
}
