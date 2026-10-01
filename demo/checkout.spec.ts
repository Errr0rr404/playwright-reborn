import { expect, step, test } from '../dist/fixture.js';

test.describe('cart', () => {
  test('total matches the items', { tag: '@cart' }, async ({ page }) => {
    await page.setContent(`
      <main style="font-family: Georgia, serif; background:#f4efe6; color:#1c1915; padding:28px">
        <h1>Cart</h1>
        <ul>
          <li>Notebook <span>$12</span></li>
          <li>Pencil <span>$2</span></li>
        </ul>
        <p id="total">$14</p>
      </main>
    `);
    await step('add the notebook and the pencil', async () => {
      await expect(page.getByRole('listitem')).toHaveCount(2);
    });
    await step('read the total', async () => {
      await expect(page.locator('#total')).toHaveText('$14');
      console.log('total is $14');
    });
    await test.info().attach('cart', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await test.info().attach('note', {
      body: Buffer.from('Two lines, total $14.'),
      contentType: 'text/plain',
    });
  });

  test('receipt shows the order id', async ({ page }) => {
    await page.setContent(`
      <main style="font-family: Georgia, serif; background:#f6f1e8; color:#241c16; padding:32px">
        <p>Receipt</p>
        <p id="order"></p>
      </main>
    `);
    await step('read the receipt', async () => {
      const text = await page.locator('#order').textContent();
      console.log(`order text ${JSON.stringify(text)}`);
      expect(text).toBe('1842');
    });
  });

  test('tax line is rounded', () => {
    function taxCents(cents: number) {
      return Math.round(cents * 0.08);
    }
    expect(taxCents(1000)).toBe(80);
  });
});

test('ledger rebuilds the day', async () => {
  console.error('stock service slow');
  await new Promise((resolve) => setTimeout(resolve, 650));
});

test.describe('payment', () => {
  test.describe.configure({ retries: 1 });

  test('payment clears on the second attempt', async ({}, testInfo) => {
    console.log(`attempt ${testInfo.retry}`);
    expect(testInfo.retry).toBe(1);
  });
});
