# Changelog

## 0.2.2

- The company name has a subtitle. The default is Test Automation.
- The overview no longer shows the open-source credit, the Playwright version, or project names unless you turn those on.
- The commit is the first 7 characters. Projects are off the info grid unless `showProjects` is true.
- The Tests page keeps the tag filter and hides the project filter unless `showProjectFilter` is true.
- Tags that look like `HC2T-` ids are hidden. Set `ignoreTags` to `false` to keep them.
- The duration view is a pie chart and a bar chart. `chartStyle` can be `pie`, `bar`, or `both`.

## 0.2.1

- The Timeline view no longer keeps the duration chart on screen.
- Run info lines up to the left.
- A file row names the kind once and links the file.
- Font license files are written to `assets/fonts/` even when the HTML file is self-contained.

## 0.2.0

- `step()` returns the value of its body.
- Screenshots stay on the test that took them when tests run in parallel.
- The report is one HTML file by default. CSS, the page script, fonts, and screenshots are inside it.
- The overview lists run metadata: suite, user, environment, state, defects, base URL, branch, commit, projects, workers, shard, and Playwright version.
- Tests can be filtered by tag and by project.
- `steps: 'user'` leaves hooks and Playwright's own API calls out of the step tree.
- The company title is the name you pass. If you omit it, the title is the project folder name.
- `showLogs` and `showFiles` still default to on. Set either to `false` to leave that page out.

## 0.1.0

- First npm release of the end-of-run HTML reporter.
