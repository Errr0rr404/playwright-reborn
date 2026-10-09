(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var app = document.getElementById('app');
  var raw = document.getElementById('reborn-data');
  var data;
  try {
    data = JSON.parse((raw && raw.textContent) || '');
  } catch (error) {
    app.textContent = 'This report could not be read.';
    return;
  }
  if (!data || !Array.isArray(data.tests)) {
    app.textContent = 'This report could not be read.';
    return;
  }

  var TABS = ['overview', 'tests', 'screenshots'];
  if (data.showLogs !== false) TABS.push('logs');
  if (data.showFiles !== false) TABS.push('files');
  var testIndex = new Map(data.tests.map(function (test) { return [test.id, test]; }));
  var route = readRoute();
  var state = {
    tab: route.tab,
    filter: 'all',
    query: '',
    selectedId: testIndex.has(route.id) ? route.id : initialFailure(),
    attempt: 0,
    showApi: false,
    testPane: 'steps',
    listLimit: 200,
    timelineLimit: 200,
    shotFilter: 'all',
    logQuery: '',
    tag: null,
    projectFilter: null,
    overview: data.overview === 'timeline' ? 'timeline' : 'chart',
    order: 'grouped',
    band: 'all',
  };
  var selected = testById(state.selectedId);
  if (selected) {
    state.attempt = failedAttempt(selected);
    state.testPane = defaultPane(selected);
  }

  var built = { tests: false, screenshots: false, logs: false, files: false };
  var findTimer = 0;

  app.innerHTML = [
    '<div class="shell">',
    '<aside class="rail">',
    '<div class="sidebar-brand">' + icon('brand') + '<span>Reborn<span class="brand-caption">Test reports</span></span></div>',
    '<div class="project-card">' + icon('folder') + '<div><span class="project-caption">Workspace</span><strong id="workspace-name"></strong></div></div>',
    '<p class="nav-caption">Run workspace</p>',
    '<div class="tabbar" role="tablist" aria-label="Report" aria-orientation="vertical">',

    TABS.map(function (id) {
      return tabButton(id, id === 'overview' ? 'Dashboard' : id.charAt(0).toUpperCase() + id.slice(1));
    }).join(''),
    '</div>',
    '<div class="sidebar-bottom"><p class="nav-caption">Current run</p><p class="sidebar-state run-state" id="sidebar-state"></p><p class="sidebar-note">Completed <span id="sidebar-time"></span></p><div class="keyboard-hint"><kbd>/</kbd><span>Find a test</span></div></div>',
    '</aside>',
    '<div class="stage">',
    '<header class="workspace-bar"><div class="breadcrumb"><span id="breadcrumb-company"></span><span class="breadcrumb-separator">/</span><strong id="page-name">Dashboard</strong></div><button class="theme-toggle" id="theme-toggle" type="button" role="switch" aria-checked="false" aria-label="Dark mode">' + icon('moon') + '<span>Dark mode</span><span class="theme-switch" aria-hidden="true"></span></button></header>',
    '<div class="report-content">',
    '<div id="panel-overview" role="tabpanel"></div>',
    '<div id="panel-tests" role="tabpanel" hidden></div>',
    '<div id="panel-screenshots" role="tabpanel" hidden></div>',
    '<div id="panel-logs" role="tabpanel" hidden></div>',
    '<div id="panel-files" role="tabpanel" hidden></div>',
    '<p class="foot" id="foot"></p>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');

  document.body.dataset.accent = accentName();
  applyTheme(readTheme());
  document.title = companyName() + (data.summary ? ' · ' + data.summary : '');
  document.getElementById('workspace-name').textContent = companyName();
  document.getElementById('breadcrumb-company').textContent = companyName();
  document.getElementById('sidebar-time').textContent = formatWhen(data.generatedAt);
  setRunState(document.getElementById('sidebar-state'));
  var footBits = [];
  if (data.showCredit === true) footBits.push(el('span', null, ['Open source by World of Z']));
  footBits.push(el('span', null, [formatWhen(data.generatedAt)]));
  footBits.push(el('span', null, ['Keys 1 onward switch pages. Press / to find a test.']));
  fill(document.getElementById('foot'), footBits);
  var BANDS = [
    ['under1', 'Under 1 minute'],
    ['1to3', '1 to 3 minutes'],
    ['3to5', '3 to 5 minutes'],
    ['over5', 'Over 5 minutes'],
  ];
  var CHART_COLORS = ['var(--heading)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

  syncTabOrientation();
  window.addEventListener('resize', syncTabOrientation);
  paintOverview();
  showTab(state.tab, true);
  bind();


  function icon(name) {
    var paths = {
      brand: '<path d="m8 5-5 7 5 7m8-14 5 7-5 7m-8-7 3 3 5-6"/>',
      overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      tests: '<path d="m9 11 2 2 4-4"/><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/>',
      screenshots: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
      logs: '<path d="m5 6 4 4-4 4m7 3h7"/><rect x="2" y="2" width="20" height="20" rx="3"/>',
      files: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h5"/>',
      folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      alert: '<path d="m12 3 10 18H2Z M12 9v4m0 3v1"/>',
      moon: '<path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
      arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    };
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.tests) + '</svg>';
  }

  function syncTabOrientation() {
    document.querySelector('.tabbar').setAttribute('aria-orientation', window.innerWidth <= 800 ? 'horizontal' : 'vertical');
  }

  function setRunState(node) {
    node.dataset.status = data.status;
    node.textContent = { passed: 'Run passed', failed: 'Run failed', timedout: 'Run timed out', interrupted: 'Run interrupted' }[data.status] || 'Run finished';
  }

  function companyName() {
    var name = typeof data.company === 'string' ? data.company.trim() : '';
    return name || 'Report';
  }

  function accentName() {
    var allowed = { green: 1, red: 1, blue: 1, amber: 1, violet: 1 };
    return allowed[data.accent] ? data.accent : 'green';
  }

  function readTheme() {
    try {
      var saved = localStorage.getItem('reborn-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) { /* Storage may be unavailable for local reports. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    document.getElementById('theme-toggle').setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  }

  function tabButton(id, label) {
    var count = id === 'tests' ? data.tests.length : null;
    return '<button id="tab-' + id + '" class="tab" role="tab" type="button" data-tab="' + id + '" aria-selected="false" aria-controls="panel-' + id + '">' + icon(id) + '<span>' + label + '</span>' + (count === null ? '' : '<span class="nav-count" aria-hidden="true">' + count + '</span>') + '</button>';
  }

  function readRoute() {
    var hash = location.hash.slice(1);
    try {
      if (hash.indexOf('tests/') === 0) return { tab: 'tests', id: decodeURIComponent(hash.slice(6)) };
      hash = decodeURIComponent(hash);
    } catch (error) { return { tab: 'overview' }; }
    if (TABS.indexOf(hash) !== -1) return { tab: hash };
    if (testIndex.has(hash)) return { tab: 'tests', id: hash };
    return { tab: 'overview' };
  }

  function initialFailure() {
    var problem = data.tests.find(isProblem);
    return problem ? problem.id : (data.tests[0] && data.tests[0].id) || null;
  }

  function showTab(tab, quiet) {
    if (TABS.indexOf(tab) === -1) tab = 'overview';
    state.tab = tab;
    document.getElementById('page-name').textContent = tab === 'overview' ? 'Dashboard' : tab.charAt(0).toUpperCase() + tab.slice(1);
    document.querySelectorAll('[role="tab"]').forEach(function (button) {
      button.setAttribute('aria-selected', button.dataset.tab === tab ? 'true' : 'false');
      button.tabIndex = button.dataset.tab === tab ? 0 : -1;
    });
    TABS.forEach(function (name) {
      var panel = document.getElementById('panel-' + name);
      var on = name === tab;
      panel.hidden = !on;
      panel.setAttribute('aria-labelledby', 'tab-' + name);
      panel.classList.toggle('panel', true);
      if (on && !quiet && !reduce) {
        panel.classList.remove('panel-enter');
        void panel.offsetWidth;
        panel.classList.add('panel-enter');
      }
    });
    if (tab === 'tests') ensureTests();
    if (tab === 'screenshots') ensureShots();
    if (tab === 'logs') ensureLogs();
    if (tab === 'files') ensureFiles();
    writeHash(!quiet);

  }

  function writeHash(push) {
    var next = state.tab === 'overview' ? 'overview' : state.tab;
    if (state.tab === 'tests' && state.selectedId) next = 'tests/' + encodeURIComponent(state.selectedId);
    if (location.hash === '#' + next) return;
    if (window.history && history.replaceState) {
      var url = location.protocol === 'about:' ? location.href.split('#')[0] + '#' + next : '#' + next;
      try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (error) { /* Some artifact viewers block history updates. */ }
    }
  }

  function paintOverview() {
    var host = document.getElementById('panel-overview');
    host.innerHTML = [
      '<header class="hero">',
      '<div><p class="dashboard-kicker">Run overview</p><h1 class="word">Dashboard</h1><p class="product" id="product"></p><p class="summary" id="summary"></p></div>',
      '<p class="run-state" id="run-state"></p>',
      '</header>',
      '<p class="meta" id="meta"></p>',
      '<div id="errors"></div>',
      '<div class="metric-grid" id="metrics"></div>',
      '<div class="dashboard-grid">',
      '<section class="dashboard-card result-card"><div class="card-heading"><h2>Test results</h2><span class="card-detail">This run</span></div>',
      '<div class="result-body"><div class="result-ring" id="result-ring"><div><strong id="pass-percent"></strong><span>Passed</span></div></div>',
      '<div class="legend" id="legend"></div></div><p class="card-note" id="result-note"></p></section>',
      '<section class="dashboard-card console"><div class="console-body">',
      '<div class="range-head"><h2 class="section-label" id="range-label">Duration</h2>',
      '<div class="views" role="group" aria-label="Overview shape"><button type="button" class="view" data-overview="chart">Chart</button><button type="button" class="view" data-overview="timeline">Timeline</button></div></div>',
      '<p class="section-note" id="range-note"></p><div class="charts" id="duration"></div>',
      '<div class="strip-window" id="strip-window"><div class="strip-scroll"><div class="strip" id="strip" role="group" aria-label="Tests by time"></div></div></div>',
      '</div></section>',
      '<section class="dashboard-card attention-card"><div class="card-heading"><h2>Needs attention</h2><button type="button" class="dashboard-link" data-go-tests>View all tests ' + icon('arrow') + '</button></div><div id="attention-list"></div></section>',
      '<section class="dashboard-card environment-card"><div class="card-heading"><h2>Run details</h2>' + icon('folder') + '</div><dl class="run-details" id="run-details"></dl><dl class="info" id="info"></dl></section>',
      '</div>',
    ].join('');
    var subtitle = typeof data.productSubtitle === 'string' ? data.productSubtitle.trim() : 'Test Automation';
    document.getElementById('product').textContent = subtitle;
    document.getElementById('product').hidden = !subtitle;
    document.getElementById('summary').textContent = data.summary || '';
    fill(document.getElementById('meta'), metaBits().map(function (bit) { return el('span', null, [bit]); }));
    setRunState(document.getElementById('run-state'));
    paintDashboard();
    paintErrors();
    paintInfo();
    paintCounts(document.getElementById('legend'), false);
    paintDuration();
    paintStrip();
    applyOverview();
  }

  function paintDashboard() {
    var counts = data.counts || {};
    var total = data.tests.length;
    var passed = counts.passed || 0;
    var percent = total ? Math.round(passed / total * 100) : 0;
    var problems = data.tests.filter(isProblem);
    var metrics = [
      ['tests', 'Total tests', String(total), 'Across ' + uniqueValues(function (test) { return [test.file]; }).length + ' test files', ''],
      ['check', 'Pass rate', total ? percent + '%' : '—', passed + ' of ' + total + ' tests passed', 'positive'],
      ['clock', 'Run duration', formatDuration(data.duration || 0), 'Wall time including retries', ''],
      ['alert', 'Needs attention', String(problems.length), 'Failed, flaky or interrupted', problems.length ? 'warning' : 'positive'],
    ];
    fill(document.getElementById('metrics'), metrics.map(function (metric) {
      var node = el('div', { class: 'metric ' + metric[4] }, [
        el('div', { class: 'metric-label' }, [metric[1]]),
        el('strong', { class: 'metric-value' }, [metric[2]]),
        el('span', { class: 'metric-note' }, [metric[3]]),
      ]);
      node.querySelector('.metric-label').insertAdjacentHTML('beforeend', icon(metric[0]));
      return node;
    }));
    document.getElementById('pass-percent').textContent = total ? percent + '%' : '—';
    var colors = { passed: 'var(--pass)', failed: 'var(--fail)', timedOut: 'var(--fail)', flaky: 'var(--flaky)', skipped: 'var(--skip)', interrupted: 'var(--timeout)' };
    var offset = 0;
    var stops = [];
    Object.keys(colors).forEach(function (status) {
      var amount = counts[status] || 0;
      if (!amount || !total) return;
      var next = offset + amount / total * 100;
      stops.push(colors[status] + ' ' + offset + '% ' + next + '%');
      offset = next;
    });
    document.getElementById('result-ring').style.background = stops.length ? 'conic-gradient(' + stops.join(',') + ')' : 'var(--hairline)';
    document.getElementById('result-note').textContent = 'Select a result to explore its tests. Pass rate includes skipped tests in the total.';
    var attention = problems.slice(0, 5).map(function (test) {
      return el('button', { type: 'button', class: 'attention-row open-test', 'data-id': test.id, 'data-attempt': String(failedAttempt(test)) }, [
        el('span', { class: 'attention-status sw', 'data-status': test.status }, [statusLabel(test)]),
        el('span', { class: 'attention-test' }, [el('strong', null, [test.title]), el('span', null, [test.file])]),
        el('span', { class: 'attention-time' }, [formatDuration(test.duration)]),
      ]);
    });
    if (!attention.length) attention.push(el('p', { class: 'empty' }, [total ? 'No tests need attention. Your run is looking good.' : 'No tests ran. Run your test suite to see results here.']));
    if (problems.length > 5) attention.push(el('p', { class: 'card-note' }, ['Showing 5 of ' + problems.length + ' tests. View all tests to explore the rest.']));
    fill(document.getElementById('attention-list'), attention);
    var rows = [['Started', formatWhen(data.startTime)], ['Workers', String(data.workers || 0)], ['Screenshots', { off: 'Off', failure: 'On failure', last: 'Last step', steps: 'Every step' }[data.screenshots] || 'Off']];
    if (data.showProjects === true && (data.projects || []).length) rows.push(['Projects', data.projects.join(', ')]);
    if (data.shard) rows.push(['Shard', data.shard]);
    var customLabels = (data.info || []).map(function (row) { return String(row.label).toLowerCase(); });
    rows = rows.filter(function (row) { return customLabels.indexOf(row[0].toLowerCase()) === -1; });
    fill(document.getElementById('run-details'), rows.map(function (row) {
      return el('div', null, [el('dt', null, [row[0]]), el('dd', null, [row[1]])]);
    }));
  }

  function paintInfo() {
    var host = document.getElementById('info');
    if (!host) return;
    var rows = Array.isArray(data.info) ? data.info : [];
    if (!rows.length) {
      host.hidden = true;
      return;
    }
    fill(host, rows.map(function (row) {
      return el('div', { class: 'info-row' }, [
        el('dt', null, [row.label]),
        el('dd', null, [row.value]),
      ]);
    }));
  }

  function bandLabel(id) {
    var found = BANDS.find(function (band) { return band[0] === id; });
    return found ? found[1] : '';
  }

  // Same cuts as durationBand in src/format.ts: 1:00, 3:00, and 5:00.
  function durationBand(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    if (ms < 60000) return 'under1';
    if (ms < 180000) return '1to3';
    if (ms < 300000) return '3to5';
    return 'over5';
  }

  function countedTests() {
    return data.tests.filter(function (test) { return test.status !== 'skipped'; });
  }

  function bandCounts() {
    var counts = { under1: 0, '1to3': 0, '3to5': 0, over5: 0 };
    countedTests().forEach(function (test) {
      counts[durationBand(test.duration)] += 1;
    });
    return counts;
  }

  function chartStyle() {
    return data.chartStyle === 'pie' || data.chartStyle === 'bar' ? data.chartStyle : 'both';
  }

  function polar(cx, cy, radius, degrees) {
    var rad = (degrees - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function piePath(start, end) {
    var span = end - start;
    if (span >= 359.99) return '';
    var from = polar(110, 110, 96, start);
    var to = polar(110, 110, 96, end);
    var large = span > 180 ? 1 : 0;
    return 'M 110 110 L ' + from.x.toFixed(2) + ' ' + from.y.toFixed(2) + ' A 96 96 0 ' + large + ' 1 ' + to.x.toFixed(2) + ' ' + to.y.toFixed(2) + ' Z';
  }

  function paintPie(counts) {
    var total = 0;
    BANDS.forEach(function (band) { total += counts[band[0]]; });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'pie');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Tests by duration');
    if (!total) {
      var empty = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      empty.setAttribute('cx', '110');
      empty.setAttribute('cy', '110');
      empty.setAttribute('r', '96');
      empty.setAttribute('fill', 'var(--hairline)');
      svg.appendChild(empty);
      return svg;
    }
    var angle = 0;
    var full = null;
    BANDS.forEach(function (band, index) {
      var count = counts[band[0]];
      if (!count) return;
      var sweep = (count / total) * 360;
      if (sweep >= 359.99) {
        full = index;
        angle += sweep;
        return;
      }
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', piePath(angle, angle + sweep));
      path.setAttribute('fill', CHART_COLORS[index]);
      path.setAttribute('data-slice', band[0]);
      path.setAttribute('class', 'slice');
      svg.appendChild(path);
      angle += sweep;
    });
    if (full !== null) {
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '110');
      circle.setAttribute('cy', '110');
      circle.setAttribute('r', '96');
      circle.setAttribute('fill', CHART_COLORS[full]);
      circle.setAttribute('data-slice', BANDS[full][0]);
      circle.setAttribute('class', 'slice');
      svg.appendChild(circle);
    }
    return svg;
  }

  function paintDuration() {
    var host = document.getElementById('duration');
    if (!host) return;
    var counts = bandCounts();
    var max = 1;
    BANDS.forEach(function (band) { max = Math.max(max, counts[band[0]]); });
    var style = chartStyle();
    var nodes = [];
    if (style !== 'bar') nodes.push(paintPie(counts));
    if (style !== 'pie') {
      nodes.push(el('div', { class: 'bars' }, BANDS.map(function (band, index) {
        var fillBar = el('span', { class: 'band-fill' });
        fillBar.style.width = Math.round((counts[band[0]] / max) * 100) + '%';
        fillBar.style.background = CHART_COLORS[index];
        return el('button', {
          class: 'band',
          type: 'button',
          'data-band': band[0],
          'aria-pressed': state.band === band[0] ? 'true' : 'false',
        }, [
          el('span', { class: 'swatch' }),
          el('span', { class: 'band-label' }, [band[1]]),
          el('span', { class: 'n' }, [String(counts[band[0]])]),
          el('span', { class: 'band-track' }, [fillBar]),
        ]);
      })));
    } else {
      nodes.push(el('div', { class: 'bars' }, BANDS.map(function (band, index) {
        return el('button', {
          class: 'band band-key',
          type: 'button',
          'data-band': band[0],
          'aria-pressed': state.band === band[0] ? 'true' : 'false',
        }, [
          el('span', { class: 'swatch' }),
          el('span', { class: 'band-label' }, [band[1]]),
          el('span', { class: 'n' }, [String(counts[band[0]])]),
        ]);
      })));
    }
    fill(host, nodes);
    host.querySelectorAll('.swatch').forEach(function (swatch, index) {
      swatch.style.background = CHART_COLORS[index % CHART_COLORS.length];
    });
  }

  function applyOverview() {
    var chart = state.overview !== 'timeline';
    var duration = document.getElementById('duration');
    var strip = document.getElementById('strip-window');
    var label = document.getElementById('range-label');
    var note = document.getElementById('range-note');
    if (duration) duration.hidden = !chart;
    if (strip) strip.hidden = chart;
    if (label) label.textContent = chart ? 'Duration' : 'Timeline';
    if (note) {
      var text = chart
        ? 'How many tests landed in each range. The time includes retries.'
        : 'Tests in the order they started. The bar is how long each one took.';
      if (chart && data.counts && data.counts.skipped) text += ' Skipped tests are not in these counts.';
      note.textContent = text;
    }
    document.querySelectorAll('.view').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.overview === state.overview ? 'true' : 'false');
    });
  }

  function paintErrors() {
    var host = document.getElementById('errors');
    var items = [];
    (data.errors || []).forEach(function (error) {
      items.push(el('div', { class: 'banner' }, [el('pre', null, [error.message || 'Runner error'])]));
    });
    (data.warnings || []).forEach(function (warning) {
      items.push(el('div', { class: 'banner' }, [el('p', null, [warning])]));
    });
    fill(host, items);
  }

  function paintCounts(host, withFind) {
    var counts = data.counts || {};
    var filters = [
      ['all', 'tests', counts.total || 0],
      ['passed', 'passed', counts.passed || 0],
      ['failed', 'failed', counts.failed || 0],
      ['flaky', 'flaky', counts.flaky || 0],
      ['skipped', 'skipped', counts.skipped || 0],
    ];
    if (counts.timedOut) filters.push(['timedOut', 'timed out', counts.timedOut]);
    if (counts.interrupted) filters.push(['interrupted', 'interrupted', counts.interrupted]);
    var buttons = filters.map(function (filter) {
      return el('button', { class: 'count', type: 'button', 'data-status': filter[0], 'aria-pressed': 'false' }, [
        el('span', { class: 'n' }, [String(filter[2])]),
        ' ' + filter[1],
      ]);
    });
    var children = buttons;
    if (withFind) {
      children = buttons.concat([el('div', { class: 'find-wrap' }, [
        el('input', { id: 'find', class: 'find', type: 'search', placeholder: 'Find a test', 'aria-label': 'Find a test', autocomplete: 'off' }),
      ])]);
    }
    fill(host, children);
    syncPressed();
  }

  function syncPressed() {
    document.querySelectorAll('.count[data-status]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.status === state.filter ? 'true' : 'false');
    });
  }

  function spanOf(test) {
    var start = Infinity;
    var end = 0;
    (test.attempts || []).forEach(function (attempt) {
      var began = new Date(attempt.startTime).getTime();
      if (!isFinite(began)) return;
      start = Math.min(start, began);
      end = Math.max(end, began + (attempt.duration || 0));
    });
    if (!isFinite(start) || start === Infinity) return null;
    return { start: start, end: Math.max(end, start + 1) };
  }

  function paintStrip() {
    var strip = document.getElementById('strip');
    if (!data.tests.length) {
      fill(strip, [el('p', { class: 'empty' }, ['No tests ran.'])]);
      return;
    }
    var max = data.tests.reduce(function (hi, test) { return Math.max(hi, test.duration || 0); }, 1);
    var ordered = data.tests.slice().sort(function (a, b) {
      return (spanOf(a) ? spanOf(a).start : Infinity) - (spanOf(b) ? spanOf(b).start : Infinity);
    });
    strip.className = 'run-list';
    strip.style.height = '';
    var nodes = ordered.slice(0, state.timelineLimit).map(function (test) {
      var fillBar = el('span', { class: 'run-fill', 'data-status': test.status });
      fillBar.style.width = Math.max(2, Math.round(((test.duration || 0) / max) * 100)) + '%';
      return el('button', {
        class: 'run-row',
        type: 'button',
        'data-id': test.id,
        'data-status': test.status,
        'aria-label': statusLabel(test) + ', ' + test.title + ', ' + formatDuration(test.duration),
      }, [
        el('span', { class: 'sw', 'data-status': test.status }, [statusLabel(test)]),
        el('span', { class: 'run-name' }, [test.title]),
        el('span', { class: 'run-track' }, [fillBar]),
        el('span', { class: 'run-time' }, [formatDuration(test.duration)]),
      ]);
    });
    if (ordered.length > state.timelineLimit) nodes.push(el('button', { class: 'more', type: 'button', id: 'show-more-timeline' }, ['Show more tests']));
    fill(strip, nodes);
    markStrip();
  }

  function canvasColor(status) {
    var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#00ff88';
    if (status === 'failed' || status === 'timedOut' || status === 'flaky') return accent;
    if (status === 'passed') return 'rgba(255, 255, 255, 0.22)';
    return '#1a1a1a';
  }

  function markStrip() {
    var visible = Object.create(null);
    filteredTests().forEach(function (test) { visible[test.id] = true; });
    document.querySelectorAll('.run-row').forEach(function (segment) {
      segment.classList.toggle('is-dim', !visible[segment.dataset.id]);
      if (segment.dataset.id === state.selectedId) segment.setAttribute('aria-current', 'true');
      else segment.removeAttribute('aria-current');
    });
  }

  function keptTag(tag) {
    var pattern = typeof data.ignoreTags === 'string' ? data.ignoreTags : '^@?HC2T-';
    if (!pattern) return true;
    try {
      return !new RegExp(pattern, 'i').test(tag);
    } catch (error) {
      return true;
    }
  }

  function uniqueValues(pick) {
    var seen = Object.create(null);
    data.tests.forEach(function (test) {
      pick(test).forEach(function (value) {
        if (value) seen[value] = true;
      });
    });
    return Object.keys(seen).sort();
  }

  function selectControl(id, label, choices, current) {
    var select = el('select', { id: id, class: 'filter-select' }, choices.map(function (choice) {
      return el('option', { value: choice[0] }, [choice[1]]);
    }));
    select.value = current || '';
    return el('label', { class: 'filter-control', for: id }, [el('span', null, [label]), select]);
  }

  function paintTags() {
    var host = document.getElementById('tags');
    if (!host) return;
    var tags = uniqueValues(function (test) { return (test.tags || []).filter(keptTag); });
    var projects = uniqueValues(function (test) { return test.project ? [test.project] : []; });
    var nodes = [selectControl('tag-select', 'Tags', [['', 'All tags']].concat(tags.map(function (tag) { return [tag, tag]; })), state.tag)];
    if (data.showProjectFilter === true && projects.length > 1) {
      nodes.push(selectControl('project-select', 'Project', [['', 'All projects']].concat(projects.map(function (project) { return [project, project]; })), state.projectFilter));
    }
    fill(host, nodes);
    if (!tags.length) document.getElementById('tag-select').disabled = true;
  }

  function sortTests(tests) {
    var copy = tests.slice();
    if (state.order === 'fastest') {
      copy.sort(function (a, b) { return (a.duration || 0) - (b.duration || 0) || a.title.localeCompare(b.title); });
    } else if (state.order === 'started') {
      copy.sort(function (a, b) {
        return (spanOf(a) ? spanOf(a).start : Infinity) - (spanOf(b) ? spanOf(b).start : Infinity);
      });
    } else if (state.order === 'slowest') {
      copy.sort(function (a, b) { return (b.duration || 0) - (a.duration || 0) || a.title.localeCompare(b.title); });
    }
    return copy;
  }

  function paintOrder() {
    var host = document.getElementById('order');
    if (!host) return;
    var orders = [['grouped', 'Grouped'], ['slowest', 'Slowest first'], ['fastest', 'Fastest first'], ['started', 'Start time']];
    var nodes = [selectControl('sort-select', 'Sort', orders, state.order)];
    if (state.band !== 'all') {
      nodes.push(el('button', { class: 'band-clear', type: 'button', 'aria-label': 'Clear duration filter: ' + bandLabel(state.band) }, [bandLabel(state.band), el('span', { 'aria-hidden': 'true' }, [' ×'])]));
    }
    fill(host, nodes);
  }

  function ensureTests() {
    if (built.tests) return;
    built.tests = true;
    var host = document.getElementById('panel-tests');
    host.innerHTML = '<div class="page-heading"><h2>Tests</h2><p>Explore results, retries and the steps behind every test.</p></div><div class="legend" id="test-tools"></div><div class="filter-toolbar"><div class="tags" id="tags"></div><div class="order" id="order"></div></div><div class="list-summary" id="list-summary"></div><div class="split"><div id="tests"></div><section class="detail" id="detail"></section></div>';
    paintCounts(document.getElementById('test-tools'), true);
    paintTags();
    paintOrder();
    paintList();
    paintDetail();
    markStrip();
  }

  function paintList() {
    var host = document.getElementById('tests');
    if (!host) return;
    var tests = filteredTests();
    var summary = document.getElementById('list-summary');
    if (summary) fill(summary, [
      el('span', { role: 'status', 'aria-live': 'polite' }, [tests.length + ' of ' + data.tests.length + ' tests']),
      hasFilters() ? el('button', { type: 'button', class: 'reset-filters' }, ['Clear filters']) : null,
    ]);
    if (!tests.length) {
      fill(host, [el('p', { class: 'empty' }, [data.tests.length ? 'No tests match. Clear filters or try another search.' : 'No tests ran.'])]);
      return;
    }
    if (state.order !== 'grouped') {
      var sorted = sortTests(tests);
      var shown = sorted.slice(0, state.listLimit);
      var flat = shown.map(function (test) { return rowButton(test, true); });
      if (shown.length < sorted.length) {
        flat.push(el('button', { class: 'more', type: 'button', id: 'show-rest' }, ['Show more tests']));
      }
      fill(host, flat);
      return;
    }
    var groups = [];
    var problemIds = Object.create(null);
    var problems = tests.filter(isProblem);
    if (state.filter === 'all' && !state.query && problems.length && problems.length !== tests.length) {
      problems.forEach(function (test) { problemIds[test.id] = true; });
      groups.push({ name: 'Problems', tests: problems });
    }
    var byFile = [];
    var index = Object.create(null);
    tests.forEach(function (test) {
      if (problemIds[test.id]) return;
      if (index[test.file] == null) {
        index[test.file] = byFile.length;
        byFile.push({ name: test.file, tests: [] });
      }
      byFile[index[test.file]].tests.push(test);
    });
    var rendered = 0;
    var truncated = false;
    var nodes = groups.concat(byFile).map(function (group) {
      var rows = [];
      group.tests.forEach(function (test) {
        if (rendered >= state.listLimit) {
          truncated = true;
          return;
        }
        rendered += 1;
        rows.push(rowButton(test, group.name === 'Problems'));
      });
      if (!rows.length) return null;
      return el('div', { class: 'group' }, [el('p', { class: 'file-name' }, [group.name])].concat(rows));
    }).filter(Boolean);
    if (truncated) {
      nodes.push(el('button', { class: 'more', type: 'button', id: 'show-rest' }, ['Show more tests']));
    }
    fill(host, nodes);
  }

  function rowButton(test, showFile) {
    var meta = [el('span', { class: 'sw', 'data-status': test.status }, [statusLabel(test)])];
    if (showFile) meta.push(el('span', null, [test.file]));
    if ((test.attempts || []).length > 1) meta.push(el('span', null, [test.attempts.length + ' attempts']));
    var button = el('button', { class: 'row', type: 'button', 'data-id': test.id, 'data-status': test.status }, [
      el('span', { class: 'row-title' }, [test.title]),
      el('span', { class: 'row-time' }, [formatDuration(test.duration)]),
      el('span', { class: 'row-meta' }, meta),
    ]);
    if (test.id === state.selectedId) button.setAttribute('aria-current', 'true');
    return button;
  }

  function paintDetail() {
    var host = document.getElementById('detail');
    if (!host) return;
    var test = testById(state.selectedId);
    if (!test) {
      fill(host, [el('p', { class: 'empty' }, ['Select a test to read its steps and logs.'])]);
      return;
    }
    if (state.attempt >= test.attempts.length) state.attempt = Math.max(0, test.attempts.length - 1);
    var attempt = test.attempts[state.attempt] || null;
    var panes = [
      ['steps', 'Steps'],
      ['error', 'Error'],
      ['logs', 'Logs'],
      ['shots', 'Screenshots'],
    ];
    var tabs = el('div', { class: 'subtabs', role: 'group', 'aria-label': 'Test details' }, panes.map(function (pane) {
      return el('button', {
        class: 'subtab',
        type: 'button',
        'data-pane': pane[0],
        'aria-pressed': state.testPane === pane[0] ? 'true' : 'false',
      }, [pane[1]]);
    }));
    var body = [headerBlock(test), tabs];
    if (test.attempts.length > 1) body.push(attemptTabs(test));
    if (attempt) body.push(paneBody(test, attempt));
    else body.push(el('p', { class: 'empty block' }, ['This test did not run.']));
    fill(host, [el('div', { class: 'detail-body' }, body)]);
  }

  function paneBody(test, attempt) {
    if (state.testPane === 'error') return errorBlock(attempt) || el('p', { class: 'empty' }, ['No error on this attempt.']);
    if (state.testPane === 'logs') return logBlock(attempt) || el('p', { class: 'empty' }, ['No logs for this attempt.']);
    if (state.testPane === 'shots') return shotBlock(attempt) || el('p', { class: 'empty' }, ['No screenshots for this attempt.']);
    return stepsBlock(attempt) || el('p', { class: 'empty' }, ['No steps recorded.']);
  }

  function headerBlock(test) {
    var bits = [];
    if (test.group && test.group.length) bits.push(el('p', { class: 'kicker' }, [test.group.join(' / ')]));
    bits.push(el('h2', null, [test.title]));
    var where = [el('span', null, [test.file + ':' + test.line])];
    if (data.showProjects === true && test.project) where.push(el('span', null, [test.project]));
    (test.tags || []).forEach(function (tag) { where.push(el('span', null, [tag])); });
    bits.push(el('p', { class: 'where' }, where));
    bits.push(el('p', { class: 'status-line' }, [
      el('span', { class: 'sw', 'data-status': test.status }, [statusLabel(test)]),
      ' in ' + formatDuration(test.duration),
    ]));
    if (test.expectedFailure) bits.push(el('p', { class: 'note' }, ['This failure was expected.']));
    (test.annotations || []).forEach(function (annotation) {
      if (!annotation.description) return;
      bits.push(el('p', { class: 'note' }, [annotation.type + ': ' + annotation.description]));
    });
    return el('div', null, bits);
  }

  function attemptTabs(test) {
    return el('div', { class: 'attempts' }, test.attempts.map(function (attempt, index) {
      return el('button', {
        class: 'attempt',
        type: 'button',
        'data-index': String(index),
        'aria-pressed': index === state.attempt ? 'true' : 'false',
      }, ['Attempt ' + (index + 1) + ' ' + attemptLabel(attempt.status)]);
    }));
  }

  function errorBlock(attempt) {
    if (!attempt.errors || !attempt.errors.length) return null;
    var images = (attempt.attachments || []).filter(function (item) { return item.kind === 'image' && safeSrc(item.path); });
    var image = images.find(function (item) { return item.role === 'failure'; }) || images[images.length - 1];
    var messages = attempt.errors.map(function (error) {
      var nodes = [el('pre', null, [error.message || 'The test failed.'])];
      if (error.location) nodes.push(el('p', { class: 'where-error' }, [error.location]));
      if (error.snippet) nodes.push(el('details', { class: 'stack' }, [el('summary', null, ['Source']), el('pre', null, [error.snippet])]));
      if (error.stack) nodes.push(el('details', { class: 'stack' }, [el('summary', null, ['Stack']), el('pre', null, [error.stack])]));
      return el('div', { class: 'error' }, nodes);
    });
    var column = el('div', { class: 'evidence-copy' }, messages);
    if (!image) return el('div', { class: 'block' }, [el('h3', null, ['Error'])].concat(messages));
    return el('div', { class: 'block' }, [
      el('h3', null, ['Error']),
      el('div', { class: 'evidence' }, [column, shotButton(image)]),
    ]);
  }

  function stepsBlock(attempt) {
    var steps = attempt.steps || [];
    if (!steps.length) return null;
    var visible = data.steps === 'all' ? visibleSteps(steps, state.showApi) : steps;
    var head = [el('h3', null, ['Steps'])];
    if (data.steps === 'all' && hasApi(steps)) {
      head.push(el('button', {
        id: 'api-toggle',
        class: 'ghost',
        type: 'button',
        'aria-pressed': state.showApi ? 'true' : 'false',
      }, [state.showApi ? 'Hide browser calls' : 'Browser calls']));
    }
    var nodes = [el('div', { class: 'block-head' }, head)];
    if (!visible.length) nodes.push(el('p', { class: 'empty' }, ['No steps recorded.']));
    else nodes.push(renderSteps(visible, 0, Boolean(attempt.errors && attempt.errors.length)));
    return el('div', { class: 'block' }, nodes);
  }

  function renderSteps(steps, depth, suppressError) {
    return el('div', { class: depth ? 'children' : '' }, steps.map(function (step) {
      var bad = Boolean(step.error) || hasBad(step.steps || []);
      var title = [step.title || 'Step'];
      if (step.subtitle) title.push(el('span', { class: 'sub' }, [' ' + step.subtitle]));
      var row = el('div', { class: bad ? 'step bad' : 'step' }, [
        el('span', { class: 'mark' }),
        el('span', null, title),
        el('span', { class: 'loc' }, [formatDuration(step.duration || 0)]),
      ]);
      var kids = (step.steps && step.steps.length) ? [row, renderSteps(step.steps, depth + 1, suppressError)] : [row];
      if (step.error && !suppressError) kids.push(el('p', { class: 'where-error' }, [step.error]));
      return el('div', null, kids);
    }));
  }

  function logBlock(attempt) {
    if (!attempt.stdout && !attempt.stderr) return null;
    var nodes = [el('h3', null, ['Logs'])];
    if (attempt.stdout) nodes.push(el('div', { class: 'well' }, [el('p', null, ['Output']), el('pre', null, [attempt.stdout])]));
    if (attempt.stderr) nodes.push(el('div', { class: 'well' }, [el('p', null, ['Error output']), el('pre', null, [attempt.stderr])]));
    return el('div', { class: 'block' }, nodes);
  }

  function shotBlock(attempt) {
    var images = (attempt.attachments || []).filter(function (item) { return item.kind === 'image' && safeSrc(item.path); });
    if (!images.length) return null;
    return el('div', { class: 'block' }, [el('h3', null, ['Screenshots'])].concat(images.map(shotButton)));
  }

  function shotButton(item) {
    var src = safeSrc(item.path);
    return el('button', { class: 'shot', type: 'button', 'data-src': src, 'data-alt': item.name || 'Screenshot' }, [
      el('img', { src: src, alt: item.name || 'Screenshot', loading: 'lazy', decoding: 'async' }),
    ]);
  }

  function ensureShots() {
    if (built.screenshots) return;
    built.screenshots = true;
    var host = document.getElementById('panel-screenshots');
    var filters = el('div', { class: 'legend', id: 'shot-filters' }, [
      shotFilter('all', 'All'),
      shotFilter('step', 'Every step'),
      shotFilter('failure', 'Last failing step'),
      shotFilter('last', 'Last step'),
    ]);
    var tiles = [];
    data.tests.forEach(function (test) {
      (test.attempts || []).forEach(function (attempt, index) {
        (attempt.attachments || []).forEach(function (file) {
          if (file.kind !== 'image' || !safeSrc(file.path)) return;
          var src = safeSrc(file.path);
          var copy = el('div', { class: 'tile-copy' }, [
            el('p', { class: 'tile-title' }, [test.title]),
            el('p', { class: 'tile-meta' }, ['Attempt ' + (index + 1) + ' · ' + attemptLabel(attempt.status)]),
            el('p', { class: 'tile-meta' }, [file.stepTitle || file.name || 'Screenshot']),
            el('button', { class: 'open-test', type: 'button', 'data-id': test.id, 'data-attempt': String(index), 'data-open-pane': 'shots' }, ['Open test']),
          ]);
          var tile = el('div', { class: 'tile', 'data-role': file.role || '', 'data-status': test.status }, [
            el('button', { class: 'shot', type: 'button', 'data-src': src, 'data-alt': file.name || test.title }, [
              el('img', { alt: file.name || test.title, loading: 'lazy', decoding: 'async' }),
            ]),
            copy,
          ]);
          tile.style.setProperty('--edge', canvasColor(test.status));
          tiles.push(tile);
        });
      });
    });
    var empty = el('p', { class: 'empty', id: 'shot-empty' }, ['']);
    fill(host, [el('h2', null, ['Screenshots']), filters, empty, el('div', { class: 'gallery', id: 'gallery' }, tiles)]);
    document.querySelectorAll('#gallery img').forEach(function (img) {
      img.src = img.parentElement.dataset.src;
    });
    applyShotFilter();
  }

  function shotFilter(id, label) {
    return el('button', { class: 'count shot-filter', type: 'button', 'data-shot': id, 'aria-pressed': 'false' }, [label]);
  }

  function applyShotFilter() {
    var visible = 0;
    document.querySelectorAll('#gallery .tile').forEach(function (tile) {
      var role = tile.dataset.role || '';
      var show = state.shotFilter === 'all' || role === state.shotFilter;
      tile.hidden = !show;
      if (show) visible += 1;
    });
    document.querySelectorAll('.shot-filter').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.shot === state.shotFilter ? 'true' : 'false');
    });
    var empty = document.getElementById('shot-empty');
    if (!empty) return;
    empty.hidden = visible > 0;
    if (!visible) empty.textContent = emptyShotMessage();
  }

  function emptyShotMessage() {
    if (state.shotFilter === 'step') return 'No step screenshots. Set screenshots to steps and use step().';
    if (state.shotFilter === 'failure') return 'No failing screenshot in this run.';
    if (state.shotFilter === 'last') return 'No final screenshot of a passing attempt.';
    return 'No screenshots in this run.';
  }

  function ensureLogs() {
    if (built.logs) return;
    built.logs = true;
    var host = document.getElementById('panel-logs');
    var cards = [];
    data.tests.forEach(function (test) {
      (test.attempts || []).forEach(function (attempt, index) {
        if (!attempt.stdout && !attempt.stderr) return;
        var blob = (test.title + ' ' + (attempt.stdout || '') + ' ' + (attempt.stderr || '')).toLowerCase();
        var nodes = [
          el('h3', null, [test.title]),
          el('p', { class: 'tile-meta' }, ['Attempt ' + (index + 1) + ' · ' + attemptLabel(attempt.status)]),
        ];
        if (attempt.stdout) nodes.push(el('div', { class: 'well' }, [el('p', null, ['Output']), el('pre', null, [attempt.stdout])]));
        if (attempt.stderr) nodes.push(el('div', { class: 'well' }, [el('p', null, ['Error output']), el('pre', null, [attempt.stderr])]));
        nodes.push(el('button', { class: 'open-test', type: 'button', 'data-id': test.id, 'data-attempt': String(index), 'data-open-pane': 'logs' }, ['Open test']));
        var card = el('article', { class: 'log-card', 'data-blob': blob }, nodes);
        cards.push(card);
      });
    });
    fill(host, [
      el('h2', null, ['Logs']),
      el('input', { id: 'log-find', class: 'find', type: 'search', placeholder: 'Find in logs', 'aria-label': 'Find in logs' }),
      el('p', { class: 'empty', id: 'log-empty', hidden: cards.length > 0 }, ['No logs in this run.']),
      el('div', { id: 'log-list' }, cards),
    ]);
  }

  function applyLogFilter() {
    var query = state.logQuery.trim().toLowerCase();
    var visible = 0;
    document.querySelectorAll('.log-card').forEach(function (card) {
      card.hidden = Boolean(query) && card.dataset.blob.indexOf(query) === -1;
      if (!card.hidden) visible += 1;
    });
    var empty = document.getElementById('log-empty');
    empty.hidden = visible > 0;
    empty.textContent = query ? 'No logs match. Try another search.' : 'No logs in this run.';
  }

  function ensureFiles() {
    if (built.files) return;
    built.files = true;
    var host = document.getElementById('panel-files');
    var groups = [];
    data.tests.forEach(function (test) {
      var rows = [];
      (test.attempts || []).forEach(function (attempt, index) {
        (attempt.attachments || []).forEach(function (file) {
          if (file.kind === 'image') return;
          var label = file.kind === 'trace' ? 'Trace' : file.kind === 'video' ? 'Video' : 'File';
          var line = [el('span', { class: 'file-kind' }, [label])];
          if ((test.attempts || []).length > 1) line.push(el('span', { class: 'now-file' }, ['Attempt ' + (index + 1)]));
          if (file.omitted || !safeSrc(file.path)) {
            line.push(el('span', { class: 'now-file' }, ['Not copied']));
          } else if (file.kind === 'video') {
            line.push(el('video', { class: 'video', controls: 'true', preload: 'metadata', src: safeSrc(file.path) }));
          } else {
            var href = safeSrc(file.path);
            var linkText = file.kind === 'trace' ? 'Download' : (file.name || 'Download');
            line.push(el('a', { class: 'file-link', href: href, download: '' }, [linkText]));
            if (file.kind === 'trace') {
              line.push(el('span', { class: 'now-file' }, ['npx playwright show-trace ' + href]));
            }
          }
          rows.push(el('div', { class: 'file-row' }, line));
        });
      });
      if (rows.length) groups.push(el('section', { class: 'file-group' }, [el('h3', null, [test.title])].concat(rows)));
    });
    fill(host, [el('h2', null, ['Files'])].concat(groups.length ? groups : [el('p', { class: 'empty' }, ['No other files were attached.'])]));
  }

  function bind() {
    window.addEventListener('hashchange', function () {
      var next = readRoute();
      if (next.tab === 'tests' && next.id && testById(next.id)) {
        resetFilters();
        state.selectedId = next.id;
        state.attempt = failedAttempt(testById(next.id));
        state.testPane = defaultPane(testById(next.id));
        if (built.tests) { paintTags(); paintOrder(); paintList(); paintDetail(); syncPressed(); }
      }
      showTab(next.tab, true);
    });
    document.querySelector('.skip').addEventListener('click', function (event) {
      event.preventDefault();
      showTab('tests');
      document.getElementById('find').focus();
    });
    app.addEventListener('click', function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('.reset-filters')) {
        resetFilters(); keepSelectionInFilter(); paintTags(); paintOrder(); paintDuration(); paintList(); paintDetail(); syncPressed();
        document.getElementById('find').focus();
        return;
      }
      if (target.closest('#theme-toggle')) {
        var theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(theme);
        try { localStorage.setItem('reborn-theme', theme); } catch (error) { /* Theme still works without storage. */ }
        return;
      }
      if (target.closest('[data-go-tests]')) {
        showTab('tests');
        document.getElementById('find').focus();
        return;
      }
      var tab = target.closest('.tab');
      if (tab) {
        showTab(tab.dataset.tab);
        return;
      }
      var shotMode = target.closest('.shot-filter');
      if (shotMode) {
        state.shotFilter = shotMode.dataset.shot || 'all';
        applyShotFilter();
        return;
      }
      var opener = target.closest('.open-test');
      if (opener) {
        openTest(opener.dataset.id, Number(opener.dataset.attempt || 0), opener.dataset.openPane);
        return;
      }
      var view = target.closest('.view');
      if (view) {
        state.overview = view.dataset.overview === 'timeline' ? 'timeline' : 'chart';
        applyOverview();
        return;
      }
      var band = target.closest('.band') || target.closest('.slice');
      if (band) {
        var bandId = band.dataset.band || band.getAttribute('data-slice');
        state.band = state.band === bandId ? 'all' : bandId;
        state.order = state.band === 'all' ? state.order : 'slowest';
        state.listLimit = 200;
        keepSelectionInFilter();
        if (built.tests) {
          paintOrder();
          paintList();
          paintDetail();
        }
        paintDuration();
        showTab('tests');
        return;
      }
      var clearBand = target.closest('.band-clear');
      if (clearBand) {
        state.band = 'all';
        keepSelectionInFilter();
        paintDuration();
        paintOrder();
        paintList();
        paintDetail();
        return;
      }
      var count = target.closest('.count');
      if (count && !count.classList.contains('shot-filter') && !count.classList.contains('count-static')) {
        state.filter = count.dataset.status || 'all';
        state.listLimit = 200;
        syncPressed();
        keepSelectionInFilter();
        if (count.closest('#legend')) showTab('tests');
        if (built.tests) {
          paintList();
          paintDetail();
          markStrip();
        }
        return;
      }
      var segment = target.closest('.run-row');
      if (segment) {
        choose(segment.dataset.id, true);
        return;
      }
      var row = target.closest('.row, .bar-row');
      if (row) {
        choose(row.dataset.id, false);
        return;
      }
      var pane = target.closest('.subtab');
      if (pane) {
        state.testPane = pane.dataset.pane || 'steps';
        paintDetail();
        document.querySelector('.subtab[data-pane="' + state.testPane + '"]').focus();
        return;
      }
      var attempt = target.closest('.attempt');
      if (attempt) {
        state.attempt = Number(attempt.dataset.index || 0);
        paintDetail();
        document.querySelector('.attempt[data-index="' + state.attempt + '"]').focus();
        return;
      }
      if (target.closest('#api-toggle')) {
        state.showApi = !state.showApi;
        paintDetail();
        var toggle = document.getElementById('api-toggle');
        if (toggle) toggle.focus();
        return;
      }
      if (target.closest('#show-more-timeline')) {
        state.timelineLimit += 200; paintStrip();
        var moreTimeline = document.getElementById('show-more-timeline');
        if (moreTimeline) moreTimeline.focus();
        return;
      }
      if (target.closest('#show-rest')) {
        state.listLimit += 200;
        paintList();
        var more = document.getElementById('show-rest');
        if (more) more.focus();
        return;
      }
      var shot = target.closest('.shot');
      if (shot) openShot(shot.dataset.src, shot.dataset.alt || 'Screenshot');
    });

    app.addEventListener('change', function (event) {
      var control = event.target;
      if (!control || ['tag-select', 'project-select', 'sort-select'].indexOf(control.id) === -1) return;
      if (control.id === 'tag-select') state.tag = control.value || null;
      if (control.id === 'project-select') state.projectFilter = control.value || null;
      if (control.id === 'sort-select') state.order = control.value || 'grouped';
      state.listLimit = 200;
      keepSelectionInFilter();
      paintList();
      paintDetail();
      markStrip();
    });

    app.addEventListener('input', function (event) {
      if (!event.target) return;
      if (event.target.id === 'find') {
        window.clearTimeout(findTimer);
        var value = event.target.value;
        findTimer = window.setTimeout(function () {
          state.query = value;
          state.listLimit = 200;
          keepSelectionInFilter();
          paintList();
          paintDetail();
          markStrip();
        }, 80);
      }
      if (event.target.id === 'log-find') {
        state.logQuery = event.target.value;
        applyLogFilter();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      if (event.target instanceof HTMLSelectElement) return;
      var typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target.isContentEditable;
      if (typing) {
        if (event.key === 'Escape') {
          window.clearTimeout(findTimer);
          event.target.value = '';
          if (event.target.id === 'find') {
            state.query = '';
            keepSelectionInFilter();
            paintList();
            paintDetail();
            markStrip();
          }
          if (event.target.id === 'log-find') {
            state.logQuery = '';
            applyLogFilter();
          }
        }
        return;
      }
      if (event.key >= '1' && event.key <= '5') {
        var destination = TABS[Number(event.key) - 1];
        if (destination) showTab(destination);
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        showTab('tests');
        var find = document.getElementById('find');
        if (find) find.focus();
        return;
      }
      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') && event.target.closest && event.target.closest('.tabbar')) {
        event.preventDefault();
        var index = TABS.indexOf(state.tab);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = TABS.length - 1;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % TABS.length;
        else index = (index - 1 + TABS.length) % TABS.length;
        showTab(TABS[index]);
        var next = document.querySelector('.tab[data-tab="' + TABS[index] + '"]');
        if (next) next.focus();
        return;
      }
      if (state.tab !== 'tests' || !event.target.closest || !event.target.closest('#tests') || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
      var rows = Array.prototype.slice.call(document.querySelectorAll('#tests .row'));
      if (!rows.length) return;
      event.preventDefault();
      var current = -1;
      rows.forEach(function (row, i) { if (row.dataset.id === state.selectedId) current = i; });
      var nextIndex = event.key === 'ArrowDown' ? current + 1 : current - 1;
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= rows.length) nextIndex = rows.length - 1;
      choose(rows[nextIndex].dataset.id, false);
    });
  }

  function choose(id, resetFilter) {
    if (!id || !testById(id)) return;
    if (resetFilter) resetFilters();
    if (state.selectedId !== id) {
      var test = testById(id);
      state.selectedId = id;
      state.attempt = failedAttempt(test);
      state.testPane = defaultPane(test);
    }
    var position = filteredTests().findIndex(function (test) { return test.id === id; });
    state.listLimit = Math.max(state.listLimit, position + 1);
    showTab('tests');
    if (built.tests) {
      syncPressed();
      paintTags();
      paintOrder();
      paintList();
      paintDetail();
      markStrip();
    }
    paintDuration();
    var row = document.querySelector('#tests .row[data-id="' + cssEscape(id) + '"]');
    if (row) row.focus({ preventScroll: true });
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }

  function hasFilters() {
    return state.filter !== 'all' || state.query.trim() || state.band !== 'all' || state.tag !== null || state.projectFilter !== null;
  }

  function resetFilters() {
    window.clearTimeout(findTimer);
    state.filter = 'all'; state.query = ''; state.band = 'all'; state.tag = null; state.projectFilter = null;
    state.listLimit = 200;
    var find = document.getElementById('find');
    if (find) find.value = '';
  }

  function keepSelectionInFilter() {
    var tests = filteredTests();
    markStrip();
    if (tests.some(function (test) { return test.id === state.selectedId; })) return;
    var next = tests[0];
    if (!next) {
      state.selectedId = null;
      writeHash();
      return;
    }
    state.selectedId = next.id;
    state.attempt = failedAttempt(next);
    state.testPane = defaultPane(next);
    writeHash();
  }

  function openTest(id, attempt, pane) {
    var test = testById(id);
    if (!test) return;
    resetFilters();
    state.selectedId = id;
    state.attempt = attempt;
    state.testPane = pane === 'logs' ? 'logs' : 'shots';
    showTab('tests');
    if (built.tests) {
      paintTags();
      paintOrder();
      paintList();
      paintDetail();
      markStrip();
    }
    syncPressed();
    paintDuration();
    document.getElementById('detail').scrollIntoView({ block: 'nearest' });
  }

  function openShot(src, alt) {
    var safe = safeSrc(src);
    if (!safe) return;
    var close = el('button', { class: 'close-shot', type: 'button' }, ['Close']);
    var returnFocus = document.activeElement;
    var dialog = el('dialog', { 'aria-label': alt || 'Screenshot' }, [close, el('img', { src: safe, alt: alt })]);
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () { dialog.remove(); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); });
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function filteredTests() {
    var query = state.query.trim().toLowerCase();
    return data.tests.filter(function (test) {
      if (state.filter !== 'all' && test.status !== state.filter) return false;
      if (state.tag !== null && (test.tags || []).indexOf(state.tag) === -1) return false;
      if (state.projectFilter !== null && test.project !== state.projectFilter) return false;
      if (state.band !== 'all' && (test.status === 'skipped' || durationBand(test.duration) !== state.band)) return false;
      if (!query) return true;
      var blob = [test.title, test.file, test.project].concat(test.group || [], test.tags || []).join(' ').toLowerCase();
      if (blob.indexOf(query) !== -1) return true;
      return (test.attempts || []).some(function (attempt) {
        return (attempt.errors || []).some(function (error) {
          return (error.message || '').toLowerCase().indexOf(query) !== -1;
        });
      });
    });
  }

  function testById(id) {
    return testIndex.get(id) || null;
  }

  function failedAttempt(test) {
    if (!test || !test.attempts || !test.attempts.length) return 0;
    var index = -1;
    test.attempts.forEach(function (attempt, i) {
      if (index === -1 && attempt.status !== 'passed' && attempt.status !== 'skipped') index = i;
    });
    return index === -1 ? test.attempts.length - 1 : index;
  }

  function defaultPane(test) {
    if (!test) return 'steps';
    if (isProblem(test)) return 'error';
    return 'steps';
  }

  function isProblem(test) {
    return test.status === 'failed' || test.status === 'timedOut' || test.status === 'interrupted' || test.status === 'flaky';
  }

  function statusLabel(test) {
    if (test.status === 'passed' && test.expectedFailure) return 'Expected fail';
    if (test.status === 'timedOut') return 'Timed out';
    var status = test.status || 'passed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function attemptLabel(status) {
    if (status === 'timedOut') return 'Timed out';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function visibleSteps(steps, showApi) {
    var out = [];
    steps.forEach(function (step) {
      var kids = visibleSteps(step.steps || [], showApi);
      var api = step.category === 'pw:api' || step.category === 'fixture';
      var quietHook = step.category === 'hook' && !step.error && kids.length === 0;
      if (!showApi && api) {
        out = out.concat(kids);
        return;
      }
      if (!showApi && quietHook) return;
      out.push(Object.assign({}, step, { steps: kids }));
    });
    return out;
  }

  function hasApi(steps) {
    return steps.some(function (step) {
      return step.category === 'pw:api' || step.category === 'fixture' || hasApi(step.steps || []);
    });
  }

  function hasBad(steps) {
    return steps.some(function (step) { return step.error || hasBad(step.steps || []); });
  }

  function safeSrc(value) {
    if (typeof value !== 'string' || !value) return '';
    if (value.indexOf('data:image/') === 0 && value.indexOf(' ') === -1) return value;
    if (!value.startsWith('assets/attachments/')) return '';
    if (value.indexOf('..') !== -1 || value.indexOf('\\') !== -1 || value.indexOf('://') !== -1) return '';
    return value;
  }

  function commitText() {
    var row = (data.info || []).find(function (item) { return item.label === 'Commit'; });
    return row && row.value ? row.value : '';
  }

  function metaBits() {
    var bits = [];
    if (data.showProjects === true && data.projectName) bits.push(data.projectName);
    if (data.showProjects === true && Array.isArray(data.projects) && data.projects.length) bits.push(data.projects.join(', '));
    if (data.startTime) bits.push(formatWhen(data.startTime));
    var sha = commitText();
    if (sha) bits.push(sha);
    if (data.showPlaywrightVersion === true && data.playwrightVersion) bits.push('Playwright ' + data.playwrightVersion);
    if (data.shard) bits.push('Shard ' + data.shard);
    return bits;
  }

  function formatDuration(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    if (ms < 1000) return Math.round(ms) + 'ms';
    if (ms < 60000) {
      var seconds = ms / 1000;
      var text = seconds >= 10 ? String(Math.round(seconds)) : seconds.toFixed(1).replace(/\.0$/, '');
      return text + 's';
    }
    var total = Math.round(ms / 1000);
    return Math.floor(total / 60) + 'm ' + String(total % 60).padStart(2, '0') + 's';
  }

  function formatWhen(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(date);
  }

  function countUp(node, target, format) {
    if (!node) return;
    if (reduce || target <= 0) {
      node.textContent = format(target);
      return;
    }
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / 800);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    var props = attrs || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function fill(node, children) {
    var nodes = [];
    children.forEach(function (child) {
      if (child == null || child === false) return;
      nodes.push(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    node.replaceChildren.apply(node, nodes);
  }
})();
