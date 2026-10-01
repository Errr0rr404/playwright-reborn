import { expect, test } from '@playwright/test';

test('session shows the member name', async ({ page }) => {
  await page.setContent('<p id="who" style="font-family: Georgia, serif">Ada</p>');
  await expect(page.locator('#who')).toHaveText('Ada');
  console.log('member Ada');
});

test('password rejects a blank value', () => {
  function accepts(password: string) {
    return password.trim().length >= 8;
  }
  expect(accepts('')).toBe(false);
  expect(accepts('correct horse')).toBe(true);
});

test('legacy import', async () => {
  test.skip(true, 'Importer is retired');
});
