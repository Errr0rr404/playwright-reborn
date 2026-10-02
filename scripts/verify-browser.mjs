import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runUiChecks } from './ui-regressions.mjs';

const report = path.resolve(process.argv[2] || 'reborn-report/index.html');
const target = path.resolve(process.argv[3] || '/tmp/reborn-browser-checks.html');
const html = await fs.readFile(report, 'utf8');
const source = `const runUiChecks = ${runUiChecks.toString()};
runUiChecks(${JSON.stringify(html)}).then(results => {
  const failed = results.filter(result => !result.passed);
  document.getElementById('result').textContent = failed.length ? failed.length + ' checks failed' : results.length + ' checks passed';
  document.title = document.getElementById('result').textContent;
  window.scrollTo(0, 0);
  if (location.protocol !== 'file:') fetch('/results', {method:'POST', body:JSON.stringify(results)});
}).catch(error => { document.getElementById('result').textContent = error.stack; });`;
await fs.writeFile(target, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Checking report…</title>
<style>body{font:16px system-ui;background:#080808;color:#eee;padding:24px}li{margin:8px 0}h1{font-size:28px}</style>
<h1 id="result">Checking report…</h1><ol id="check-results"></ol><script>${source.replace(/<\/script/gi, '<\\/script')}</script></html>`);
console.log(`Open ${pathToFileURL(target).href} in your browser.`);
