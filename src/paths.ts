import fs from 'node:fs/promises';
import path from 'node:path';

export function relativePosix(rootDir: string, file: string): string {
  const relative = path.relative(rootDir, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return file.split(path.sep).join('/');
  }
  return relative.split(path.sep).join('/');
}

export function resolveOutputFolder(rootDir: string, outputFolder: string): string {
  if (!outputFolder.trim()) throw new Error('Finale outputFolder must be a non-empty path.');
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, outputFolder);
  if (resolved === path.parse(resolved).root) {
    throw new Error('Finale output folder must be a dedicated directory, not a drive root.');
  }
  if (path.isAbsolute(outputFolder)) {
    if (resolved === root) {
      throw new Error('Finale output folder must not be the project root.');
    }
    return resolved;
  }
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Finale output folder must be a subdirectory of the project.');
  }
  return resolved;
}

async function isFinaleReport(dir: string): Promise<boolean> {
  try {
    const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    return html.includes('id="finale-data"');
  } catch {
    return false;
  }
}

export async function prepareOutput(dir: string): Promise<void> {
  let stat: Awaited<ReturnType<typeof fs.stat>> | undefined;
  try {
    stat = await fs.stat(dir);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') throw error;
  }
  if (stat && !stat.isDirectory()) {
    throw new Error(`Finale output folder ${dir} exists and is not a directory.`);
  }
  if (stat) {
    const base = path.basename(dir);
    const named = base === 'finale-report' || base.startsWith('finale-report-');
    const ours = await isFinaleReport(dir);
    if (!named && !ours) {
      throw new Error(`Refusing to replace ${dir} because it is not a Finale report folder.`);
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
  await fs.mkdir(dir, { recursive: true });
}
