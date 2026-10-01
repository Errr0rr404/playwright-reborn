import fs from 'node:fs/promises';
import path from 'node:path';
import { embedJson } from './format';
import type { PendingFile, Report } from './model';
import { prepareOutput } from './paths';

export function renderHtml(json: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Report</title>
<link rel="stylesheet" href="assets/report.css">
</head>
<body style="margin:0;background:#080808;color:#f0f0f0">
<div class="light"></div>
<a class="skip" href="#tests">Skip to tests</a>
<main class="page" id="app"></main>
<script id="finale-data" type="application/json">${json}</script>
<script src="assets/report.js"></script>
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

export async function writeReport(outputDir: string, report: Report, files: PendingFile[], uiDir: string): Promise<string> {
  const stylesheet = path.join(uiDir, 'report.css');
  const script = path.join(uiDir, 'report.js');
  try {
    await fs.access(stylesheet);
    await fs.access(script);
  } catch {
    throw new Error('Finale UI assets are missing. Build the package before running tests.');
  }

  await prepareOutput(outputDir);
  const assets = path.join(outputDir, 'assets');
  await fs.mkdir(path.join(assets, 'attachments'), { recursive: true });
  await fs.copyFile(stylesheet, path.join(assets, 'report.css'));
  await fs.copyFile(script, path.join(assets, 'report.js'));
  await fs.cp(path.join(uiDir, 'fonts'), path.join(assets, 'fonts'), { recursive: true });

  for (const file of files) {
    if (await tooLarge(file)) {
      markOmitted(report, file.target);
      report.warnings.push(`Did not copy ${file.name} because it is larger than 25MB.`);
      continue;
    }
    try {
      await writePending(outputDir, file);
    } catch {
      report.warnings.push(`Could not save attachment ${file.name}.`);
      removeAttachment(report, file.target);
    }
  }

  const indexPath = path.join(outputDir, 'index.html');
  await fs.writeFile(indexPath, renderHtml(embedJson(report)), 'utf8');
  return indexPath;
}
