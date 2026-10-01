import fs from 'node:fs/promises';
import path from 'node:path';
import { embedJson } from './format';
import type { PendingFile, Report } from './model';
import { prepareOutput } from './paths';

export function embedFontUrls(css: string, dataUri: (file: string) => string): string {
  return css.replace(/url\("fonts\/([^"]+)"\)/g, (_match, file: string) => `url("${dataUri(file)}")`);
}

function escapeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

function escapeScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

export function renderHtml(json: string, assets?: { css: string; js: string }): string {
  const style = assets
    ? `<style>${escapeStyle(assets.css)}</style>`
    : '<link rel="stylesheet" href="assets/report.css">';
  const script = assets
    ? `<script>${escapeScript(assets.js)}</script>`
    : '<script src="assets/report.js"></script>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Report</title>
${style}
</head>
<body style="margin:0;background:#080808;color:#f0f0f0">
<div class="light"></div>
<a class="skip" href="#tests">Skip to tests</a>
<main class="page" id="app"></main>
<script id="reborn-data" type="application/json">${json}</script>
${script}
</body>
</html>
`;
}

function removeAttachment(report: Report, target: string): void {
  for (const test of report.tests) {
    for (const attempt of test.attempts) {
      attempt.attachments = attempt.attachments.filter((attachment) => attachment.path !== target);
    }
  }
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

async function tooLarge(file: PendingFile): Promise<boolean> {
  if (file.body && file.body.length > MAX_ATTACHMENT_BYTES) return true;
  if (!file.sourcePath) return false;
  try {
    const stat = await fs.stat(file.sourcePath);
    return stat.size > MAX_ATTACHMENT_BYTES;
  } catch {
    return false;
  }
}

function markOmitted(report: Report, target: string): void {
  for (const test of report.tests) {
    for (const attempt of test.attempts) {
      for (const attachment of attempt.attachments) {
        if (attachment.path !== target) continue;
        attachment.omitted = true;
        attachment.path = '';
      }
    }
  }
}

async function writePending(outputDir: string, file: PendingFile): Promise<void> {
  const destination = path.join(outputDir, ...file.target.split('/'));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (file.sourcePath) {
    await fs.copyFile(file.sourcePath, destination);
    return;
  }
  if (file.body) {
    await fs.writeFile(destination, file.body);
    return;
  }
  throw new Error('Attachment had no file and no body.');
}

async function fileBody(file: PendingFile): Promise<Buffer> {
  if (file.body) return file.body;
  if (file.sourcePath) return fs.readFile(file.sourcePath);
  throw new Error('Attachment had no file and no body.');
}

function replacePath(report: Report, target: string, next: string): void {
  for (const test of report.tests) {
    for (const attempt of test.attempts) {
      for (const attachment of attempt.attachments) {
        if (attachment.path === target) attachment.path = next;
      }
    }
  }
}

function isImage(file: PendingFile): boolean {
  return (file.contentType || '').toLowerCase().startsWith('image/');
}

async function inlineDocument(uiDir: string): Promise<{ css: string; js: string }> {
  const css = await fs.readFile(path.join(uiDir, 'report.css'), 'utf8');
  const js = await fs.readFile(path.join(uiDir, 'report.js'), 'utf8');
  return { css: await replaceFontFiles(css, path.join(uiDir, 'fonts')), js };
}

async function replaceFontFiles(css: string, fontDir: string): Promise<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/url\("fonts\/([^"]+)"\)/g)) names.add(match[1]);
  const uris = new Map<string, string>();
  for (const name of names) {
    const body = await fs.readFile(path.join(fontDir, name));
    uris.set(name, `data:font/woff2;base64,${body.toString('base64')}`);
  }
  return embedFontUrls(css, (file) => uris.get(file) || `fonts/${file}`);
}

export async function writeReport(
  outputDir: string,
  report: Report,
  files: PendingFile[],
  uiDir: string,
  output: { inline: boolean; reportFileName: string } = { inline: true, reportFileName: 'index.html' },
): Promise<string> {
  const stylesheet = path.join(uiDir, 'report.css');
  const script = path.join(uiDir, 'report.js');
  try {
    await fs.access(stylesheet);
    await fs.access(script);
  } catch {
    throw new Error('Reborn UI assets are missing. Build the package before running tests.');
  }

  await prepareOutput(outputDir);
  const assets = path.join(outputDir, 'assets');
  await fs.mkdir(path.join(assets, 'attachments'), { recursive: true });
  if (!output.inline) {
    await fs.copyFile(stylesheet, path.join(assets, 'report.css'));
    await fs.copyFile(script, path.join(assets, 'report.js'));
    await fs.cp(path.join(uiDir, 'fonts'), path.join(assets, 'fonts'), { recursive: true });
  }

  for (const file of files) {
    if (await tooLarge(file)) {
      markOmitted(report, file.target);
      report.warnings.push(`Did not copy ${file.name} because it is larger than 25MB.`);
      continue;
    }
    try {
      if (output.inline && isImage(file)) {
        const body = await fileBody(file);
        const type = file.contentType || 'image/png';
        replacePath(report, file.target, `data:${type};base64,${body.toString('base64')}`);
        continue;
      }
      await writePending(outputDir, file);
    } catch {
      report.warnings.push(`Could not save attachment ${file.name}.`);
      removeAttachment(report, file.target);
    }
  }

  const indexPath = path.join(outputDir, output.reportFileName);
  const json = embedJson(report);
  if (!output.inline) {
    await fs.writeFile(indexPath, renderHtml(json), 'utf8');
    return indexPath;
  }
  const documentAssets = await inlineDocument(uiDir);
  await fs.writeFile(indexPath, renderHtml(json, documentAssets), 'utf8');
  return indexPath;
}
