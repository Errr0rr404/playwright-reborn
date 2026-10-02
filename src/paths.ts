import fs from 'node:fs/promises';
import path from 'node:path';

export function relativePosix(rootDir: string, file: string): string {
  const relative = path.relative(rootDir, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return file.split(path.sep).join('/');
  }
  return relative.split(path.sep).join('/');
}

export function resolveOutputFolder(rootDir: string, outputFolder: string): string {
  if (!outputFolder.trim()) throw new Error('Reborn outputFolder must be a non-empty path.');
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, outputFolder);
  if (resolved === path.parse(resolved).root) {
    throw new Error('Reborn output folder must be a dedicated directory, not a drive root.');
  }
  if (path.isAbsolute(outputFolder)) {
    if (resolved === root) {
      throw new Error('Reborn output folder must not be the project root.');
    }
    const fromOutput = path.relative(resolved, root);
    if (fromOutput && fromOutput !== '..' && !fromOutput.startsWith(`..${path.sep}`) && !path.isAbsolute(fromOutput)) {
      throw new Error('Reborn output folder must not be an ancestor of the project root.');
    }
    return resolved;
  }
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Reborn output folder must be a subdirectory of the project.');
  }
  return resolved;
}

async function isRebornReport(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const html = await fs.readFile(path.join(dir, entry.name), 'utf8');
    if (html.includes('<script id="reborn-data" type="application/json">')) return true;
  }
  return false;
}

export async function prepareOutput(dir: string): Promise<void> {
  let stat: Awaited<ReturnType<typeof fs.stat>> | undefined;
  try {
    stat = await fs.lstat(dir);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') throw error;
  }
  if (stat?.isSymbolicLink()) {
    throw new Error(`Refusing to replace symbolic link ${dir}.`);
  }
  if (stat && !stat.isDirectory()) {
    throw new Error(`Reborn output folder ${dir} exists and is not a directory.`);
  }
  if (stat) {
    const empty = (await fs.readdir(dir)).length === 0;
    const ours = await isRebornReport(dir);
    if (!empty && !ours) {
      throw new Error(`Refusing to replace ${dir} because it is not a Reborn report folder.`);
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
  await fs.mkdir(dir, { recursive: true });
}
