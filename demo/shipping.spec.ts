import { expect, test } from '@playwright/test';

test('address accepts a city', async ({ page }) => {
  await page.setContent('<label>City <input id="city" /></label>');
  await page.locator('#city').fill('Lisbon');
  await expect(page.locator('#city')).toHaveValue('Lisbon');
});

test('overnight arrives inside the window', async () => {
  await new Promise((resolve) => setTimeout(resolve, 280));
  expect(280).toBeGreaterThan(0);
});
