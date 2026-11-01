# Project review — October 2, 2026

Reviewed the reporter, screenshot fixture, serialization, status mapping, formatting, output paths, HTML generation, all five UI pages, demo/configuration, packaging, tests, and documentation. Existing serializer and documentation edits were preserved.

## Fixed

- Prevent deleting unrelated directories solely because their name resembles a report folder. Refuse project ancestors and output symlinks; allow empty custom directories and repeat runs with custom HTML filenames.
- Build the report before replacing its predecessor, keeping attachment sources readable and preserving the old report if assets are missing.
- Count interrupted tests correctly, explain unexpected passes, and use consistent failure screenshot roles for final attempts.
- Deduplicate attachments shared by Playwright results and steps while retaining deliberate repeats; normalize embedded image MIME types and index attachment updates.
- Preserve UTF-8 characters split across output buffers and remove terminal cursor controls and links.
- Keep test IDs unique, validate hidden options, and avoid automatic browser opening in CI.
- Repair routes, browser back, malformed percent escapes, filter URLs, log-to-test links, pending-search cancellation, unavailable shortcuts, and keyboard focus.
- Add clear-filter actions, result counts, log empty states, accessible tab labels, screenshot dialog focus restoration, and bounded list/timeline pagination.
- Support special filenames/tags and project names that previously collided with JavaScript object keys or the filter reset value.
- Improve run status, outcome colors, contrast, spacing, search fields, screenshot previews, bar-only charts, sticky detail placement, mobile controls, and long content.
- Remove unused interaction code and pause background drawing when the report is hidden.
- Make verification stop on build failures or unexpected demo results and add a portable browser verification page.

## Validation

- `npm test`: 40 checks pass. Includes real Playwright runs with two workers in all four screenshot modes. Only browser I/O is stubbed in that integration test.
- Browser regression page: 21 checks pass in Arc. Covers every page, routes and back navigation, filtering, keyboard controls, dialogs, empty states, 450-test pagination, bar-only layout, special names, and long content at 320px, 390px, and 768px.
- Inspected exported Overview and Tests screenshots captured by Arc's renderer.
- TypeScript build, JavaScript syntax checks, whitespace checks, and npm package-content checks pass.

The full demo command with a newly launched browser was not rerun: Arc does not accept Playwright's direct launch here. Browser checks used the existing report data, refreshed with the current renderer and UI. No npm release or remote deployment was performed.
