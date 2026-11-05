// Runs in a real browser. All helpers stay inside the function so Playwright
// can also execute it with page.evaluate(runUiChecks, reportHtml).
export async function runUiChecks(reportHtml) {
  const base = JSON.parse(reportHtml.match(/<script id="reborn-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const results = [];
  let frame;
  let win;
  let doc;
    const assert = (value, message) => { if (!value) throw new Error(message); };
  const waitFor = async predicate => {
    const deadline = Date.now() + 4000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for UI');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  const query = selector => doc.querySelector(selector);
  const click = selector => { const node = query(selector); assert(node, `Missing ${selector}`); node.click(); };
  const key = (node, value, extra = {}) => node.dispatchEvent(new win.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra }));
  const select = (selector, value) => {
    const node = query(selector); assert(node, `Missing ${selector}`); node.focus(); node.value = value;
    node.dispatchEvent(new win.Event('change', { bubbles: true }));
  };
  const input = (selector, value) => {
    const node = query(selector); node.focus(); node.value = value;
    node.dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const load = async (data = base, width = 1280, hash = '') => {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = 'Report under test';
    frame.style.cssText = `width:${width}px;height:860px;border:0;outline:1px solid #333;display:block;margin-top:24px`;
    document.body.append(frame);
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const prelude = `<script>window.__errors=[];window.addEventListener('error',function(e){window.__errors.push(e.message)});window.matchMedia=function(){return {matches:true}};history.replaceState(null,'',location.href.split('#')[0]+${JSON.stringify('#' + hash)});<\/script>`;
    const html = reportHtml.replace(/(<script id="reborn-data" type="application\/json">)[\s\S]*?(<\/script>)/, '$1' + json.replace(/\$/g, '$$$$') + '$2');
    const loaded = new Promise(resolve => frame.onload = resolve);
    frame.srcdoc = html.replace('<div class="light">', prelude + '<div class="light">');
    await loaded;
    win = frame.contentWindow; doc = frame.contentDocument;
    assert(query('.tabbar'), 'Report failed to start');
    await doc.fonts.ready;
  };
  const check = async (name, test) => {
    try { await test(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.message }); }
    const host = document.getElementById('check-results');
    if (host) {
      const item = document.createElement('li');
      item.textContent = (results.at(-1).passed ? 'PASS ' : 'FAIL ') + name + (results.at(-1).error ? ': ' + results.at(-1).error : '');
      host.append(item);
    }
  };
  const clone = () => JSON.parse(JSON.stringify(base));

  await load();
  await check('Dashboard metrics and attention links reflect the run', async () => {
    assert(query('.word').textContent === 'Run overview', 'Overview heading is missing');
    const metrics = [...doc.querySelectorAll('.metric-value')].map(node => node.textContent);
    const problems = base.tests.filter(test => ['failed', 'timedOut', 'interrupted', 'flaky'].includes(test.status));
    assert(metrics[0] === String(base.tests.length), 'Total tests is incorrect');
    assert(metrics[1] === String(base.counts.passed), 'Passed count is incorrect');
    const executed = base.tests.filter(test => test.status !== 'skipped').length;
    assert(query('#pass-percent').textContent === Math.round(base.counts.passed / executed * 100) + '%', 'Skipped tests lowered the pass rate');
    assert(metrics[3] === String(problems.length), 'Attention count is incorrect');
    const opener = query('.attention-row'); assert(opener, 'Attention links are missing');
    const selected = base.tests.find(test => test.id === opener.dataset.id);
    opener.click();
    assert(query('#detail h2').textContent === selected.title, 'Attention link opened the wrong test');
    assert(query('.subtab[aria-pressed="true"]').dataset.pane === 'error', 'Attention link did not open the error');
    assert(doc.activeElement.id === 'detail-title', 'Attention link did not focus the selected test');
    click('[data-tab="overview"]');
  });
  await check('Sidebar stays visible and vertical navigation works', async () => {
    const rail = query('.rail');
    assert(query('.tabbar').getAttribute('aria-orientation') === 'vertical', 'Missing sidebar orientation');
    const before = rail.getBoundingClientRect().top;
    win.scrollTo(0, 500);
    await new Promise(resolve => win.requestAnimationFrame(resolve));
    assert(Math.abs(rail.getBoundingClientRect().top - before) < 1, 'Sidebar moved out of view');
    win.scrollTo(0, 0);
    const tab = query('[data-tab="overview"]'); tab.focus(); key(tab, 'ArrowDown');
    assert(query('[data-tab="tests"]').getAttribute('aria-selected') === 'true', 'Vertical navigation failed');
    click('[data-tab="overview"]');
    assert(!query('.search-jump'), 'Removed search button is still present');
    key(doc.body, '/');
    assert(doc.activeElement.id === 'find', 'Search shortcut did not focus the search');
  });
  await check('All report pages render without script errors', async () => {
    for (const tab of ['overview', 'tests', 'screenshots', 'logs', 'files']) {
      click(`[data-tab="${tab}"]`);
      assert(!query(`#panel-${tab}`).hidden, `${tab} is hidden`);
      assert(query(`#panel-${tab}`).getAttribute('aria-labelledby') === `tab-${tab}`, `${tab} has no label`);
    }
    assert(win.__errors.length === 0, win.__errors.join(', '));
  });
  await check('Log links open the correct test attempt and Logs pane', async () => {
    click('[data-tab="logs"]');
    const opener = query('.log-card .open-test'); assert(opener, 'Missing log link');
    const title = opener.closest('.log-card').querySelector('h2').textContent;
    opener.click();
    assert(query('#detail h2').textContent === title, 'Wrong test opened');
    assert(query('.subtab[aria-pressed="true"]').dataset.pane === 'logs', 'Wrong detail pane');
    assert(query('#test-tools [data-status="all"]').getAttribute('aria-pressed') === 'true', 'Filter state is stale');
  });
  await check('Unmatched log search provides an empty state', async () => {
    click('[data-tab="logs"]'); input('#log-find', 'no-such-log-92871');
    assert(!query('#log-empty').hidden && query('#log-empty').textContent.includes('No logs match'), 'Missing empty state');
    key(query('#log-find'), 'Escape');
    assert(query('#log-empty').hidden, 'Escape did not clear log search');
  });
  await check('Escape cancels a pending test search', async () => {
    click('[data-tab="tests"]'); input('#find', 'no-such-test-92871'); key(query('#find'), 'Escape');
    await new Promise(resolve => setTimeout(resolve, 120));
    assert(query('#find').value === '', 'Search input is stale');
    assert(doc.querySelectorAll('#tests .row').length === base.tests.length, 'Pending search returned after Escape');
  });
  await check('Test filters update the URL and can be cleared', async () => {
    input('#find', 'no-such-test-92871');
    await waitFor(() => doc.querySelectorAll('#tests .row').length === 0);
    assert(win.location.hash === '#tests', 'URL still points to an invisible test');
    click('.reset-filters');
    assert(doc.querySelectorAll('#tests .row').length === base.tests.length, 'Filters did not clear');
    assert(!query('.reset-filters'), 'Clear filters is stale');
  });
  await check('Duration filters exclude skipped tests and use slowest ordering', async () => {
    click('[data-tab="overview"]'); click('[data-band="under1"]');
    assert(query('#sort-select').value === 'slowest', 'Wrong order');
    assert(!query('#tests .row[data-status="skipped"]'), 'Skipped test entered duration filter');
    click('.reset-filters');
  });
  await check('Overview result links clear filters from previous searches', async () => {
    click('[data-tab="tests"]'); input('#find', 'no-such-test-92871');
    await waitFor(() => doc.querySelectorAll('#tests .row').length === 0);
    click('[data-tab="overview"]'); click('#legend [data-status="passed"]');
    assert(query('#find').value === '', 'Result link kept a stale search');
    assert(doc.querySelectorAll('#tests .row').length === base.counts.passed, 'Result link did not show the advertised tests');
    click('[data-tab="overview"]'); click('[data-go-tests]');
    assert(doc.querySelectorAll('#tests .row').length === base.tests.length, 'View all tests kept a stale status filter');
    input('#find', 'no-such-test-92871');
    await waitFor(() => doc.querySelectorAll('#tests .row').length === 0);
    click('[data-tab="overview"]'); click('[data-band="under1"]');
    assert(query('#find').value === '', 'Duration link kept a stale search');
    assert(doc.querySelectorAll('#tests .row').length > 0, 'Duration link hid its tests');
    click('.reset-filters');
  });
  await check('Detail controls preserve keyboard focus after rendering', async () => {
    click('[data-pane="steps"]');
    assert(doc.activeElement.dataset.pane === 'steps', 'Detail control lost focus');
    const first = query('#tests .row'); first.focus(); key(first, 'ArrowDown');
    assert(doc.activeElement.classList.contains('row'), 'Row navigation lost focus');
    assert(doc.activeElement.getAttribute('aria-current') === 'true', 'Focus and selection differ');
  });
  await check('Tab keyboard navigation uses one tab stop and honors modifiers', async () => {
    const tab = query('[data-tab="tests"]'); tab.focus(); key(tab, 'ArrowRight');
    assert(query('[data-tab="screenshots"]').getAttribute('aria-selected') === 'true', 'Arrow key did not change page');
    assert(doc.querySelectorAll('.tab[tabindex="0"]').length === 1, 'Multiple tab stops');
    key(doc.body, '1', { ctrlKey: true });
    assert(query('[data-tab="screenshots"]').getAttribute('aria-selected') === 'true', 'Shortcut intercepted modifier');
  });
  await check('Screenshot dialog traps navigation shortcuts and restores focus', async () => {
    const shot = query('.tile:not([hidden]) .shot'); assert(shot, 'No screenshot'); shot.focus(); shot.click();
    assert(query('dialog[open]'), 'Dialog did not open'); key(query('dialog .close-shot'), '1');
    assert(query('[data-tab="screenshots"]').getAttribute('aria-selected') === 'true', 'Shortcut changed page under modal');
    query('dialog').close(); await waitFor(() => !query('dialog'));
    assert(doc.activeElement === shot, 'Dialog lost the opener focus');
  });
  await check('Skip link opens Tests and focuses search', async () => {
    click('[data-tab="overview"]'); click('.skip');
    assert(!query('#panel-tests').hidden && doc.activeElement.id === 'find', 'Skip link is broken');
  });
  await check('Hash changes navigate after initial load', async () => {
    win.location.hash = '#logs'; await waitFor(() => !query('#panel-logs').hidden);
    const test = base.tests.find(test => test.status === 'passed');
    win.location.hash = '#tests/' + encodeURIComponent(test.id);
    await waitFor(() => query('#detail h2')?.textContent === test.title);
  });
  await check('Browser back restores the previous report page', async () => {
    await load(); click('[data-tab="tests"]'); click('[data-tab="logs"]');
    win.history.back(); await waitFor(() => !query('#panel-tests').hidden);
  });
  await check('A project named all can be filtered independently', async () => {
    const data = clone(); data.showProjects = true; data.showProjectFilter = true;
    data.tests[0].project = 'all';
    await load(data); click('[data-tab="tests"]'); select('#project-select', 'all');
    assert(doc.querySelectorAll('#tests .row').length === 1, 'Project all acted as a reset');
    click('.reset-filters'); assert(doc.querySelectorAll('#tests .row').length === base.tests.length, 'Project filter did not clear');
  });
  await check('Encoded percent signs in test IDs do not crash routing', async () => {
    const data = clone(); data.tests[0].id = 'percent%id/with space';
    await load(data, 1280, 'tests/' + encodeURIComponent(data.tests[0].id));
    assert(query('#detail h2')?.textContent === data.tests[0].title, 'Encoded ID failed');
    assert(win.__errors.length === 0, win.__errors.join(', '));
  });
  await check('Malformed hash escapes fall back safely', async () => {
    await load(base, 1280, 'tests/%broken');
    assert(!query('#panel-overview').hidden, 'Malformed hash did not fall back');
    assert(win.__errors.length === 0, win.__errors.join(', '));
  });
  await check('Prototype-like filenames and tags remain usable', async () => {
    const data = clone(); data.tests[0].file = '__proto__'; data.tests[0].tags = ['__proto__', 'constructor'];
    await load(data); click('[data-tab="tests"]');
    assert(doc.querySelectorAll('#tests .row').length === base.tests.length, 'Grouping lost tests');
    assert([...query('#tag-select').options].some(option => option.value === '__proto__'), 'Tag disappeared');
    select('#tag-select', '__proto__');
    assert(doc.querySelectorAll('#tests .row').length === 1, 'Tag filter failed');
  });
  await check('Hidden pages ignore unavailable number shortcuts', async () => {
    const data = clone(); data.showLogs = false; data.showFiles = false;
    await load(data); click('[data-tab="tests"]'); key(doc.body, '5');
    assert(!query('#panel-tests').hidden, 'Unavailable shortcut changed page');
  });
  await check('Empty reports render all empty states', async () => {
    const data = clone(); data.tests = []; Object.keys(data.counts).forEach(key => data.counts[key] = 0);
    await load(data);
    for (const tab of ['tests', 'screenshots', 'logs', 'files']) {
      click(`[data-tab="${tab}"]`); assert(query(`#panel-${tab} .empty`), `No ${tab} empty state`);
    }
    assert(win.__errors.length === 0, win.__errors.join(', '));
  });
  await check('Bar-only charts fill the available column', async () => {
    const data = clone(); data.chartStyle = 'bar';
    await load(data);
    assert(!query('.pie'), 'Pie appeared in bar mode');
    assert(query('.bars').getBoundingClientRect().width > query('.charts').getBoundingClientRect().width * 0.9, 'Bar chart is constrained to pie column');
  });
  await check('Large reports reveal more tests in bounded batches', async () => {
    const data = clone(); data.tests = Array.from({ length: 450 }, (_, i) => ({ ...data.tests[0], id: 'test-' + i, title: 'Test ' + i }));
    await load(data); click('[data-overview="timeline"]');
    assert(doc.querySelectorAll('.run-row').length === 200, 'Timeline is unbounded');
    click('#show-more-timeline'); assert(doc.querySelectorAll('.run-row').length === 400, 'Timeline pagination failed');
    click('[data-tab="tests"]');
    assert(doc.querySelectorAll('#tests .row').length === 200, 'Initial list is unbounded');
    click('#show-rest'); assert(doc.querySelectorAll('#tests .row').length === 400, 'More button did not paginate');
    click('#show-rest'); assert(doc.querySelectorAll('#tests .row').length === 450, 'Final batch failed');
    assert(doc.activeElement.classList.contains('row'), 'Final pagination lost keyboard focus');
  });
  await check('Late deep links and sorted selections stay visible in large reports', async () => {
    const data = clone();
    const source = data.tests.find(test => test.status === 'passed');
    data.tests = Array.from({ length: 450 }, (_, i) => ({ ...source, id: 'late-' + i, title: 'Test ' + i, duration: i, attempts: [] }));
    data.counts = { total: 450, passed: 450, failed: 0, flaky: 0, skipped: 0, timedOut: 0, interrupted: 0 };
    await load(data, 1280, 'tests/late-449');
    assert(query('#tests .row[aria-current="true"]')?.dataset.id === 'late-449', 'Deep-linked test is absent from the list');
    assert(doc.querySelectorAll('#tests .row').length === 201, 'Deep link rendered an unbounded list');
    select('#sort-select', 'fastest');
    assert(query('.pinned-selection .row')?.dataset.id === 'late-449', 'Sorting hid the selected test');
    click('#show-rest'); click('#show-rest');
    assert(!query('.pinned-selection'), 'Selected test was not restored to its regular position');
    assert(doc.querySelectorAll('#tests .row').length === 450, 'Pinned test was duplicated');
    assert(doc.activeElement.dataset.id === 'late-400', 'Pagination did not focus the first new result');
  });
  await check('Skipped-only and runner-error reports explain their outcomes', async () => {
    const data = clone(); data.status = 'passed';
    data.tests = data.tests.filter(test => test.status === 'skipped');
    data.counts = { total: data.tests.length, passed: 0, failed: 0, flaky: 0, skipped: data.tests.length, timedOut: 0, interrupted: 0 };
    await load(data);
    assert(query('#run-state').textContent === 'No tests ran', 'Skipped-only run was presented as a pass');
    assert(query('#pass-percent').textContent === '—', 'Skipped-only run has a pass percentage');
    assert(query('#attention-list').textContent.includes('No tests ran'), 'Skipped-only run is misleading');
    data.status = 'failed'; data.errors = [{ message: 'Configuration could not be loaded.' }];
    await load(data);
    assert(query('#run-state').textContent === 'Run failed', 'Runner failure was hidden');
    assert(query('.banner').textContent.includes('Configuration could not be loaded.'), 'Run error was omitted');
  });
  await check('Files can be opened in the matching test attempt', async () => {
    await load(); click('[data-tab="files"]');
    const group = query('.file-group'); assert(group, 'Demo contains no files');
    const title = group.querySelector('h2').textContent;
    group.querySelector('.open-test').click();
    assert(query('#detail h2').textContent === title, 'File link opened the wrong test');
    assert(query('.subtab[aria-pressed="true"]').dataset.pane === 'files', 'File link did not open Files');
    assert(query('#detail .file-row'), 'Test files are missing');
    assert(doc.activeElement.id === 'detail-title', 'File link lost focus');
    const data = clone();
    const retry = data.tests.find(test => test.attempts.length > 1);
    const attached = data.tests.flatMap(test => test.attempts.flatMap(attempt => attempt.attachments)).find(file => file.kind !== 'image');
    retry.attempts.forEach(attempt => attempt.attachments = []);
    retry.attempts[1].attachments = [attached];
    data.tests = [retry];
    await load(data); click('[data-tab="files"]'); click('.file-group .open-test');
    assert(query('.attempt[aria-pressed="true"]').dataset.index === '1', 'File link selected an attempt without files');
    assert(query('#detail .file-row'), 'Retry attachment is missing');
  });
  await check('Selecting a mobile test brings its details into view', async () => {
    await load(base, 390); click('[data-tab="tests"]');
    const row = query('#tests .row[data-status="passed"]'); assert(row, 'No passed test');
    const title = row.querySelector('.row-title').textContent;
    row.click();
    assert(query('#detail h2').textContent === title, 'Mobile selection opened the wrong test');
    assert(doc.activeElement.id === 'detail-title', 'Mobile selection did not focus the details');
    const heading = query('#detail h2').getBoundingClientRect();
    assert(heading.top >= -1 && heading.bottom <= win.innerHeight, 'Selected details are out of view');
    const selected = query('#tests .row[aria-current="true"]'); selected.focus(); key(selected, 'ArrowDown');
    assert(doc.activeElement.classList.contains('row'), 'Mobile keyboard navigation jumped out of the list');
  });
  await check('Tag and sort dropdowns share a row, preserve focus and combine filters', async () => {
    await load(); click('[data-tab="tests"]');
    const tag = base.tests.flatMap(test => test.tags || []).find(tag => [...query('#tag-select').options].some(option => option.value === tag));
    assert(tag, 'Demo has no selectable tag');
    const tagsTop = query('#tag-select').getBoundingClientRect().top;
    assert(Math.abs(tagsTop - query('#sort-select').getBoundingClientRect().top) < 1, 'Tags and Sort are not aligned');
    select('#tag-select', tag);
    assert(doc.activeElement.id === 'tag-select', 'Tag dropdown lost focus');
    assert(doc.querySelectorAll('#tests .row').length === base.tests.filter(test => test.tags.includes(tag)).length, 'Tag filtering failed');
    select('#sort-select', 'slowest');
    const expected = base.tests.filter(test => test.tags.includes(tag)).sort((a, b) => b.duration - a.duration || a.title.localeCompare(b.title));
    assert(query('#tests .row').dataset.id === expected[0].id, 'Sort and tag filters did not combine');
    assert(doc.activeElement.id === 'sort-select', 'Sort dropdown lost focus');
    key(query('#sort-select'), 'Escape');
    assert(query('#sort-select').value === 'slowest', 'Escape cleared sort');
    click('.reset-filters');
    assert(query('#tag-select').value === '', 'Clear filters left a stale tag');
    assert(query('#sort-select').value === 'slowest', 'Clearing filters changed sort');
  });
  await check('Theme switching works on every page and preserves test filters', async () => {
    await load(); click('[data-tab="tests"]'); select('#sort-select', 'fastest');
    const first = query('#tests .row').dataset.id;
    if (doc.body.dataset.theme !== 'light') click('#theme-toggle');
    const lightSurface = win.getComputedStyle(query('.rail')).backgroundColor;
    click('#theme-toggle');
    assert(doc.body.dataset.theme === 'dark' && query('#theme-toggle').getAttribute('aria-checked') === 'true', 'Dark theme did not activate');
    assert(win.getComputedStyle(query('.rail')).backgroundColor !== lightSurface, 'Dark palette did not change the surface');
    for (const tab of ['overview', 'screenshots', 'logs', 'files', 'tests']) {
      click(`[data-tab="${tab}"]`);
      assert(doc.body.dataset.theme === 'dark', 'Theme changed during navigation');
    }
    assert(query('#sort-select').value === 'fastest' && query('#tests .row').dataset.id === first, 'Theme switching changed test ordering');
    click('#theme-toggle');
    assert(doc.body.dataset.theme === 'light' && query('#theme-toggle').getAttribute('aria-checked') === 'false', 'Light theme did not restore');
    assert(win.__errors.length === 0, win.__errors.join(', '));
  });
  await check('Long names fit mobile on every report page', async () => {
    const data = clone(); data.company = 'Company'.repeat(18);
    data.info = [{ label: 'Base URL', value: 'https://example.test/' + 'segment'.repeat(30) }];
    data.tests[0].title = 'LongTestName'.repeat(20); data.tests[0].file = 'LongFileName'.repeat(25);
    for (const width of [320, 390, 768]) {
    await load(data, width);
    assert(query('.tabbar').getAttribute('aria-orientation') === 'horizontal', 'Mobile tab orientation is incorrect');
    assert(query('#theme-toggle').getAttribute('aria-label') === 'Dark mode', 'Theme switch has no accessible label');
    for (const theme of ['light', 'dark']) {
    if (doc.body.dataset.theme !== theme) click('#theme-toggle');
    for (const tab of ['overview', 'tests', 'screenshots', 'logs', 'files']) {
      click(`[data-tab="${tab}"]`);
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, `${tab} overflows by ${doc.documentElement.scrollWidth - doc.documentElement.clientWidth}px`);
    }
    assert(win.__errors.length === 0, win.__errors.join(', '));
    }
    }
  });
  await check('Brand name and caption stay on one line in the sidebar', async () => {
    for (const [name, caption] of [['Monarch EVV', 'Test reports'], ['Monarch Electronic Visit Verification', 'Nightly regression for every state']]) {
      const data = clone(); data.brandName = name; data.brandCaption = caption; data.dashboardTitle = 'EVV regression';
      for (const width of [1440, 390]) {
        await load(data, width);
        await new Promise(resolve => win.requestAnimationFrame(resolve));
        const brand = query('#brand-name');
        assert(brand.textContent === name, 'Sidebar brand name is missing');
        assert(query('#brand-caption').textContent === caption, 'Sidebar brand caption is missing');
        assert(query('.word').textContent === 'EVV regression', 'Dashboard title is missing');
        assert(query('.sidebar-brand').title.startsWith(name), 'Sidebar brand has no full-text title');
        const lineHeight = parseFloat(win.getComputedStyle(brand).lineHeight);
        assert(brand.getBoundingClientRect().height < lineHeight * 1.5, `${name} wraps at ${width}px`);
        if (name.length < 20) assert(brand.scrollWidth <= brand.clientWidth, `${name} is cut off at ${width}px`);
        assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, `Brand overflows the page at ${width}px`);
      }
    }
  });
  if (frame) frame.remove();
  return results;
}
