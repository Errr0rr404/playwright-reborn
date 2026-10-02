import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildReport, type BuildInput } from './serialize';
import type { ReportAttachment } from './model';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { embedFontUrls, renderHtml, writeReport } from './render';

describe('embedFontUrls', () => {
  it('turns font files into data URIs', () => {
    const css = embedFontUrls('@font-face { src: url("fonts/geist.woff2"); }', () => 'data:font/woff2;base64,QQ');
    assert.equal(css.includes('fonts/geist.woff2'), false);
    assert.equal(css.includes('data:font/woff2;base64,QQ'), true);
  });
});

describe('renderHtml', () => {
  it('inlines the stylesheet and the page script', () => {
    const html = renderHtml('{}', { css: 'body{}', js: 'var ready = true;' });
    assert.equal(html.includes('assets/report.css'), false);
    assert.equal(html.includes('<style>body{}</style>'), true);
    assert.equal(html.includes('<script>var ready = true;</script>'), true);
  });
});

describe('writeReport', () => {
  it('writes custom filenames repeatedly, preserves attachment sources, and reports missing and oversized files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-render-'));
    try {
      const ui = path.join(__dirname, 'ui');
      const output = path.join(root, 'custom');
      const initial = buildReport(input()).report;
      await writeReport(output, initial, [], ui, { inline: true, reportFileName: 'qa.html' });
      const source = path.join(output, 'source.txt');
      await fs.writeFile(source, 'keep this attachment');
      const attachments: ReportAttachment[] = [
        { name: 'note', path: 'assets/attachments/note.txt', kind: 'file', contentType: 'text/plain' },
        { name: 'shot', path: 'assets/attachments/shot.png', kind: 'image', contentType: 'image/png; charset=binary' },
        { name: 'missing', path: 'assets/attachments/missing.txt', kind: 'file', contentType: 'text/plain' },
        { name: 'large', path: 'assets/attachments/large.bin', kind: 'file', contentType: 'application/octet-stream' },
      ];
      const { report } = buildReport(input());
      report.tests[0].attempts[0].attachments = attachments;
      await writeReport(output, report, [
        { name: 'note', target: attachments[0].path, sourcePath: source },
        { name: 'shot', target: attachments[1].path, body: Buffer.from('png'), contentType: attachments[1].contentType },
        { name: 'missing', target: attachments[2].path, sourcePath: path.join(root, 'missing') },
        { name: 'large', target: attachments[3].path, body: Buffer.alloc(25 * 1024 * 1024 + 1) },
      ], ui, { inline: true, reportFileName: 'qa.html' });
      assert.equal(await fs.readFile(path.join(output, 'assets/attachments/note.txt'), 'utf8'), 'keep this attachment');
      assert.equal(report.tests[0].attempts[0].attachments[1].path, 'data:image/png;base64,cG5n');
      assert.equal(report.tests[0].attempts[0].attachments.length, 3);
      assert.equal(report.tests[0].attempts[0].attachments[2].omitted, true);
      assert.equal(report.warnings.length, 2);
      assert.ok((await fs.readFile(path.join(output, 'qa.html'), 'utf8')).includes('data:font/woff2;base64,'));
      assert.ok(await fs.readFile(path.join(output, 'assets/fonts/Geist-OFL.txt'), 'utf8'));
      await writeReport(output, buildReport(input()).report, [], ui, { inline: false, reportFileName: 'renamed.html' });
      assert.ok((await fs.readFile(path.join(output, 'renamed.html'), 'utf8')).includes('assets/report.css'));
      assert.ok(await fs.readFile(path.join(output, 'assets/fonts/geist-latin-400-normal.woff2')));
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('leaves the previous report intact when UI assets are missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-assets-'));
    try {
      const output = path.join(root, 'report');
      const ui = path.join(__dirname, 'ui');
      await writeReport(output, buildReport(input()).report, [], ui);
      const before = await fs.readFile(path.join(output, 'index.html'), 'utf8');
      await assert.rejects(writeReport(output, buildReport(input()).report, [], path.join(root, 'no-ui')), /assets are missing/);
      assert.equal(await fs.readFile(path.join(output, 'index.html'), 'utf8'), before);
      assert.deepEqual(await fs.readdir(root), ['report']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});

function input(): BuildInput {
  const startTime = new Date('2026-10-01T15:00:00Z');
  return {
    tests: [{ id: 'one', title: 'one', parent: { title: 'test', type: 'file' },
      location: { file: '/repo/test.ts', line: 1, column: 1 }, tags: [], annotations: [], outcome: () => 'expected',
      results: [{ retry: 0, status: 'passed', duration: 10, startTime, workerIndex: 0 }] }],
    rootDir: '/repo', playwrightVersion: '1.63.0', projectName: 'Example', projects: [], workers: 1,
    shard: null, status: 'passed', startTime, duration: 10, generatedAt: startTime.toISOString(), errors: [],
  };
}
