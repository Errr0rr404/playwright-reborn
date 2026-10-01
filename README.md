# Marquee

A Playwright reporter. It watches the run, then writes one HTML file you can open or archive.

Add it beside the list reporter:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['playwright-marquee', {
      outputFolder: 'marquee-report',
      open: 'on-failure',
      screenshots: 'failure',
      steps: 'user',
    }],
  ],
});
```

From this repo, point at the built file instead of the package name:

```ts
['./dist/index.js', { outputFolder: 'marquee-report', open: 'on-failure', screenshots: 'steps' }]
```

`open` is `always`, `never`, or `on-failure`. The default is `on-failure`.

`company` is the name shown large on every report. It does not change when a run fails. The default is `Sandata`.

`accent` is `green`, `red`, `blue`, `amber`, or `violet`. The default is `green`. It colors the light field, the failure marks, and the links.

`showLogs` and `showFiles` are `true` or `false`. Both default to `true`. Set either to `false` to leave that page out of the report.

`screenshots` is `off`, `failure`, `last`, or `steps`. The default is `failure`.

`steps` is `user` or `all`. `user` keeps the steps you wrote and the expectations, and leaves Playwright's own API calls out of the file. `all` keeps those calls too.

Each run replaces `marquee-report/` and writes `index.html` plus screenshots, video, and traces. Open the HTML file directly. It does not need a server. On a sharded run, an unset folder becomes `marquee-report-shard-1` and so on.

The report has five tabs.

- Overview is the outcome, the total time, the counts, the duration strip, and the longest tests.
- Tests is the list and one test. That test has Steps, Error, Logs, and Screenshots.
- Screenshots is the gallery. Filter it to every step, the last failing step, or the last step of a passing attempt.
- Logs is output from the whole run.
- Files is traces, video, and anything that is not a picture.

`#overview`, `#tests`, `#screenshots`, `#logs`, and `#files` open those tabs. `#tests/<id>` opens one test. Keys 1 through 5 switch tabs. `/` jumps to the find field.

## Screenshots from the fixture

The reporter cannot photograph the page. Import the fixture in the tests that should capture shots:

```ts
import { test, expect, step } from 'playwright-marquee/fixture';

await step('read the receipt', async () => {
  await expect(page.locator('#order')).toHaveText('1842');
});
```

`failure` and `last` take one picture at the end of an attempt, for tests that use `page`. `steps` also takes a picture after each `step()`. A plain `test.step` is not photographed. Turn Playwright's own `screenshot` option off if you do not want a second copy of the same picture.

Files larger than 25MB are listed and not copied.

## Demo

The suite in `demo/` fails one test on purpose, so the report includes a failure, a flake, a skip, logs, and screenshots.

```bash
npm install
npx playwright install chromium
npm run demo
```

`npm run demo` exits with code 1 because the receipt test fails. The report is `marquee-report/index.html`.

Geist and JetBrains Mono are included under the SIL Open Font License. The license files are copied into each report's `assets/fonts/` folder.

Open source by World of Z. The code is MIT. See `LICENSE`.
