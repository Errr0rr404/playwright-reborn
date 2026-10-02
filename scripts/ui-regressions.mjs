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
  const input = (selector, value) => {
    const node = query(selector); node.focus(); node.value = value;
    node.dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const load = async (data = base, width = 1280, hash = '') => {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = 'Report under test';
    frame.style.cssText = `width:${width}px;height:860px;border:1px solid #333;max-width:100%;display:block;margin-top:24px`;
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
    const title = opener.closest('.log-card').querySelector('h3').textContent;
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
    assert(query('[data-order="slowest"]').getAttribute('aria-pressed') === 'true', 'Wrong order');
    assert(!query('#tests .row[data-status="skipped"]'), 'Skipped test entered duration filter');
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
    await load(data); click('[data-tab="tests"]'); click('.project-btn[data-value="all"]');
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
    assert(query('.tag-btn[data-value="__proto__"]'), 'Tag disappeared');
    click('.tag-btn[data-value="__proto__"]');
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
  });
  await check('Long names fit mobile on every report page', async () => {
    const data = clone(); data.company = 'Company'.repeat(18);
    data.info = [{ label: 'Base URL', value: 'https://example.test/' + 'segment'.repeat(30) }];
    data.tests[0].title = 'LongTestName'.repeat(20); data.tests[0].file = 'LongFileName'.repeat(25);
    for (const width of [320, 390, 768]) {
    await load(data, width);
    for (const tab of ['overview', 'tests', 'screenshots', 'logs', 'files']) {
      click(`[data-tab="${tab}"]`);
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, `${tab} overflows by ${doc.documentElement.scrollWidth - doc.documentElement.clientWidth}px`);
    }
    assert(win.__errors.length === 0, win.__errors.join(', '));
    }
  });
  if (frame) frame.remove();
  return results;
}
