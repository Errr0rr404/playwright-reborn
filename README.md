# playwright-reborn

A Playwright reporter. When a run finishes, it writes one HTML file you can open or archive. The file carries its own styles, fonts, and pictures. It does not need a server.

## Install

```bash
npm install -D playwright-reborn
```

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['playwright-reborn'],
  ],
});
```

That is the whole install. Overview, Tests, and Screenshots are always in the report. Logs and Files are included unless you turn them off.

## Pages

- **Overview** shows the company name, how long the run took, the counts, and a duration chart. The chart counts tests under 1 minute, from 1 to 3 minutes, from 3 to 5 minutes, and over 5 minutes. **Chart** and **Timeline** switch that section. Timeline lists every test by name.
- **Tests** is the list and one test. A test has Steps, Error, Logs, and Screenshots. **Order** can group the list by file, or sort it slowest, fastest, or by the time it started.
- **Screenshots** is the gallery. Filter it to every step, the last failing step, or the last step of a passing attempt.
- **Logs** is output from the whole run. It is on by default.
- **Files** is traces, video, and other files that are not pictures. It is on by default.

`#overview`, `#tests`, `#screenshots`, `#logs`, and `#files` open those pages. `#tests/<id>` opens one test. Keys `1` onward switch the pages that are present. `/` jumps to the find field.

## Settings

Pass any of these next to the reporter. Omitted settings use the default.

```ts
['playwright-reborn', {
  company: 'Your company',
  accent: 'green',
  open: process.env.CI ? 'never' : 'on-failure',
  outputFolder: 'reborn-report/qa',
  reportFileName: 'index.html',
  inline: true,
  overview: 'chart',
  screenshots: 'failure',
  steps: 'user',
  showLogs: true,
  showFiles: true,
  suite: 'Checkout',
  environment: 'qa',
  user: 'ada',
  state: 'CA',
  defects: ['PAY-14'],
  productSubtitle: 'Test Automation',
  chartStyle: 'both',
}]
```

| Setting | Default | Allowed |
|---|---|---|
| `company` | Project folder name | Any name. This is the large title. It does not change when a run fails. |
| `accent` | `green` | `green`, `red`, `blue`, `amber`, `violet`. Colors the light field, selection, charts, and links. Failures stay coral and flaky results stay amber for consistent recognition. |
| `open` | `on-failure`, or `never` in CI | `always`, `never`, `on-failure`. When to open the HTML file after the run. Use `never` when `CI` is set. |
| `outputFolder` | `reborn-report` | A dedicated folder path. Each run replaces its previous report. Existing empty folders are accepted; unrelated non-empty folders and symbolic links are refused. If you leave this unset, a sharded run writes `reborn-report-shard-1` and so on. |
| `reportFileName` | `index.html` | One `.html` file name, with no folders. Jenkins HTML Publisher can point at this file. |
| `inline` | `true` | `true` or `false`. `true` writes one HTML file with the CSS, script, and fonts inside it, and embeds screenshots. Traces and other files stay as relative links in the report folder. |
| `overview` | `chart` | `chart` or `timeline`. Which view the overview opens on. The buttons on the page can still switch it. |
| `chartStyle` | `both` | `pie`, `bar`, or `both`. The duration chart. `chart` opens on these charts. |
| `productSubtitle` | `Test Automation` | The line under the company name. An empty string hides it. |
| `showCredit` | `false` | `true` shows “Open source by World of Z” in the footer. It is not on the overview. |
| `showPlaywrightVersion` | `false` | `true` shows the Playwright version in the header and the info grid. |
| `showProjects` | `false` | `true` shows project names in the header and the info grid. |
| `showProjectFilter` | `false` | `true` adds a Project filter on Tests. It stays off when `showProjects` is `false`. |
| `commitShort` | `true` | `true` shows the first 7 characters of the commit. `false` shows the full value. |
| `ignoreTags` | `^@?HC2T-` | A pattern for tags to hide, or `false` to keep every tag. |
| `screenshots` | `failure` | `off`, `failure`, `last`, or `steps`. When the fixture takes a picture. The reporter sets `REBORN_SCREENSHOTS` in `onBegin`. Do not set that variable yourself. The Screenshots page stays in the report either way. |
| `steps` | `user` | `user` or `all`. `user` shows the steps a person would follow. It leaves expectations, `test.attach` calls, hooks, and Playwright's own API calls out. `all` keeps those calls too. |
| `showLogs` | `true` | `true` or `false`. `false` leaves the Logs page out. |
| `showFiles` | `true` | `true` or `false`. `false` leaves the Files page out. |
| `suite` | empty | Suite name shown on the overview. |
| `user` | `USER` when set | Who ran the suite. A reporter option wins over `BUILD_USER`, `GITHUB_ACTOR`, and `USER`. |
| `environment` | `TEST_ENV` when set | For example `qa`. |
| `state` | `TEST_STATE` when set | A region or tenant, when the suite has one. |
| `defects` | empty | One defect id, or a list. Playwright `metadata.defects` and `metadata.jira` are added too. |

The overview also shows base URL, git branch, commit, projects, workers, shard, and the Playwright version when those values are present. Set them with the options above or with `metadata` in `playwright.config.ts`. `metadata.baseURL` wins over the project `baseURL`. Branch and commit are read from `GITHUB_REF_NAME`, `GIT_BRANCH`, `BRANCH_NAME`, `GITHUB_SHA`, `GIT_COMMIT`, and `COMMIT_SHA`.

## Screenshots

The reporter cannot photograph the page. Import the fixture in the tests that should capture shots:

```ts
import { test, expect, step } from 'playwright-reborn/fixture';

test('receipt shows the order id', async ({ page }) => {
  await page.setContent('<p id="order">1842</p>');
  const order = await step('read the receipt', async () => {
    return page.locator('#order').textContent();
  });
  expect(order).toBe('1842');
});
```

`step` returns the value of its body, the same way `test.step` does. `test` is a normal Playwright test object, so a suite can `test.extend(...)` with its own fixtures.

The page fixture keeps each screenshot on the test that is running, including when tests run in parallel.

`failure` takes a picture of failing attempts. `last` takes one picture at the end of every attempt, for tests that use `page`; failing attempts appear under Last failing step. `steps` also takes a picture after each `step()`. A plain `test.step` is not photographed. Turn Playwright's own `screenshot` option off if you do not want a second copy of the same picture.

Files larger than 25MB are listed and not copied.

## Jenkins

Publish the report folder. The HTML Publisher index is `index.html`. The JUnit file stays separate for the JUnit plugin.

```groovy
publishHTML([
  reportDir: 'reborn-report/qa',
  reportFiles: 'index.html',
  reportName: 'Reborn Report',
])
```

`inline: true` is the default, so that HTML file opens from a Jenkins artifact or from disk without a CDN and without `assets/report.css`. Keep the report folder together if the Files page should still download traces and video. Those links are relative paths inside the folder.

When `CI` is set, automatic opening defaults to `never`. An explicit `open` option still wins.

## Development and verification

Run `npm test` to build and run the unit tests plus real Playwright reporter/fixture integration tests. The integration tests stub browser I/O and check parallel screenshot isolation, return values, failures, and every screenshot mode.

Run `npm run verify` for the full demo and browser checks. The demo deliberately includes one failed test and one flaky test. The verifier requires those exact outcomes and fails on additional failures. `REBORN_BROWSER_EXECUTABLE` selects a browser executable for both the demo and verifier; `REBORN_BROWSER_CDP_URL` can connect the verifier to an existing compatible browser.

To check an existing exported report in your normal browser without launching Playwright, run:

```bash
npm run verify:browser -- reborn-report/index.html /tmp/reborn-browser-checks.html
```

Open the generated HTML file. It runs the same interaction regressions in browser frames, including navigation, keyboard focus, filters, empty reports, pagination, and long content at 320px, 390px, and 768px widths. This verifier expects the demo report's logs and screenshots. Both reports and this verification page work from disk.

## License

Open source by World of Z. The code is MIT.

Geist and JetBrains Mono are included under the SIL Open Font License. With `inline: true`, the fonts are embedded in the HTML file. The license files are still written to `assets/fonts/` in the report folder.

Release notes are in `CHANGELOG.md`.
