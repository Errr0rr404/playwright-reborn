import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Page, TestInfo } from '@playwright/test';
import { forgetPage, pageFor, rememberPage } from './context';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('pageFor', () => {
  it('keeps each screenshot page on its own test', async () => {
    const first = {} as TestInfo;
    const second = {} as TestInfo;
    const third = {} as TestInfo;
    const fourth = {} as TestInfo;
    rememberPage(first, { id: 'a' } as unknown as Page);
    rememberPage(second, { id: 'b' } as unknown as Page);
    rememberPage(third, { id: 'c' } as unknown as Page);
    rememberPage(fourth, { id: 'd' } as unknown as Page);
    const seen: string[] = [];
    await Promise.all([
      delay(30).then(() => seen.push((pageFor(first) as unknown as { id: string }).id)),
      delay(5).then(() => seen.push((pageFor(second) as unknown as { id: string }).id)),
      delay(15).then(() => seen.push((pageFor(third) as unknown as { id: string }).id)),
      delay(1).then(() => seen.push((pageFor(fourth) as unknown as { id: string }).id)),
    ]);
    forgetPage(first);
    assert.equal(pageFor(first), undefined);
    assert.deepEqual(seen.sort(), ['a', 'b', 'c', 'd']);
  });
});
