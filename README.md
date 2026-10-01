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
  company: 'Sandata',
  accent: 'green',
  open: 'on-failure',
  outputFolder: 'reborn-report',
  overview: 'chart',
  screenshots: 'failure',
  steps: 'user',
  showLogs: true,
  showFiles: true,
}]
```

| Setting | Default | Allowed |
|---|---|---|
| `company` | `Sandata` | Any name. This is the large title. It does not change when a run fails. |
| `accent` | `green` | `green`, `red`, `blue`, `amber`, `violet`. Colors the light field, failure marks, and links. |
| `open` | `on-failure` | `always`, `never`, `on-failure`. When to open the HTML file after the run. |
| `outputFolder` | `reborn-report` | A folder path. Each run replaces that folder. If you leave this unset, a sharded run writes `reborn-report-shard-1` and so on. |
| `overview` | `chart` | `chart` or `timeline`. Which view the overview opens on. The buttons on the page can still switch it. |
| `screenshots` | `failure` | `off`, `failure`, `last`, or `steps`. When the fixture takes a picture. The Screenshots page stays in the report either way. |
| `steps` | `user` | `user` or `all`. `user` keeps the steps you wrote and the expectations. `all` also keeps Playwright's own API calls. |
| `showLogs` | `true` | `true` or `false`. `false` leaves the Logs page out. |
| `showFiles` | `true` | `true` or `false`. `false` leaves the Files page out. |

## Screenshots

The reporter cannot photograph the page. Import the fixture in the tests that should capture shots:

```ts
import { test, expect, step } from 'playwright-reborn/fixture';

await step('read the receipt', async () => {
  await expect(page.locator('#order')).toHaveText('1842');
});
```

`failure` and `last` take one picture at the end of an attempt, for tests that use `page`. `steps` also takes a picture after each `step()`. A plain `test.step` is not photographed. Turn Playwright's own `screenshot` option off if you do not want a second copy of the same picture.

Files larger than 25MB are listed and not copied.

## License

Open source by World of Z. The code is MIT.

Geist and JetBrains Mono are included under the SIL Open Font License. Those license files are copied into each report.
