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
}]
```

| Setting | Default | Allowed |
|---|---|---|
| `company` | Project folder name | Any name. This is the large title. It does not change when a run fails. |
| `accent` | `green` | `green`, `red`, `blue`, `amber`, `violet`. Colors the light field, failure marks, and links. |
| `open` | `on-failure` | `always`, `never`, `on-failure`. When to open the HTML file after the run. Use `never` when `CI` is set. |
| `outputFolder` | `reborn-report` | A folder path. Each run replaces that folder. If you leave this unset, a sharded run writes `reborn-report-shard-1` and so on. |
| `reportFileName` | `index.html` | One `.html` file name, with no folders. Jenkins HTML Publisher can point at this file. |
| `inline` | `true` | `true` or `false`. `true` writes one HTML file with the CSS, script, and fonts inside it, and embeds screenshots. Traces and other files stay as relative links in the report folder. |
| `overview` | `chart` | `chart` or `timeline`. Which view the overview opens on. The buttons on the page can still switch it. |
| `screenshots` | `failure` | `off`, `failure`, `last`, or `steps`. When the fixture takes a picture. The reporter sets `REBORN_SCREENSHOTS` in `onBegin`. Do not set that variable yourself. The Screenshots page stays in the report either way. |
| `steps` | `user` | `user` or `all`. `user` keeps the steps you wrote and the expectations, and leaves hooks and Playwright's own API calls out. `all` keeps those calls too. |
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

const order = await step('read the receipt', async () => {
  return page.locator('#order').textContent();
});
await expect(order).toBe('1842');
```

`step` returns the value of its body, the same way `test.step` does. `test` is a normal Playwright test object, so a suite can `test.extend(...)` with its own fixtures.

The page fixture keeps each screenshot on the test that is running, including when tests run in parallel.

`failure` and `last` take one picture at the end of an attempt, for tests that use `page`. `steps` also takes a picture after each `step()`. A plain `test.step` is not photographed. Turn Playwright's own `screenshot` option off if you do not want a second copy of the same picture.

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

Set `open: 'never'` when `CI` is set so the reporter does not launch a browser on the agent.

## License

Open source by World of Z. The code is MIT.

Geist and JetBrains Mono are included under the SIL Open Font License. Those license files are copied into each report.
