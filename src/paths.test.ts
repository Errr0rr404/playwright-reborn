import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { prepareOutput, relativePosix, resolveOutputFolder } from './paths';

describe('resolveOutputFolder', () => {
  const root = path.join(os.tmpdir(), 'reborn-root');

  it('keeps a relative folder inside the project', () => {
    assert.equal(resolveOutputFolder(root, 'reborn-report'), path.join(root, 'reborn-report'));
  });

  it('allows an absolute folder', () => {
    const absolute = path.join(os.tmpdir(), 'reborn-absolute');
    assert.equal(resolveOutputFolder(root, absolute), absolute);
  });

  it('rejects the project root and parent paths', () => {
    assert.throws(() => resolveOutputFolder(root, '.'), /subdirectory/);
    assert.throws(() => resolveOutputFolder(root, '..'), /subdirectory/);
    assert.throws(() => resolveOutputFolder(root, root), /project root/);
    assert.throws(() => resolveOutputFolder(root, path.dirname(root)), /ancestor/);
  });
});

describe('relativePosix', () => {
  it('uses forward slashes for files inside the project', () => {
    const root = path.join(os.tmpdir(), 'proj');
    assert.equal(relativePosix(root, path.join(root, 'demo', 'cart.spec.ts')), 'demo/cart.spec.ts');
    assert.equal(relativePosix(root, path.join(root, '..notes', 'cart.spec.ts')), '..notes/cart.spec.ts');
  });
});

describe('prepareOutput', () => {
  it('accepts empty custom folders and protects unrelated files even in a report-named folder', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-safe-'));
    try {
      const empty = path.join(root, 'custom');
      await fs.mkdir(empty);
      await prepareOutput(empty);
      const unrelated = path.join(root, 'reborn-report');
      await fs.mkdir(unrelated);
      await fs.writeFile(path.join(unrelated, 'notes.txt'), 'keep');
      await assert.rejects(prepareOutput(unrelated), /Refusing/);
      assert.equal(await fs.readFile(path.join(unrelated, 'notes.txt'), 'utf8'), 'keep');
      const link = path.join(root, 'reborn-report-link');
      await fs.symlink(unrelated, link, 'dir');
      await assert.rejects(prepareOutput(link), /symbolic link/);
      assert.equal(await fs.readFile(path.join(unrelated, 'notes.txt'), 'utf8'), 'keep');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  it('replaces a previous Reborn folder and refuses an unrelated one', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-out-'));
    const report = path.join(dir, 'reborn-report');
    await fs.mkdir(report);
    await fs.writeFile(path.join(report, 'keep.txt'), 'old');
    await fs.writeFile(path.join(report, 'qa.html'), '<script id="reborn-data" type="application/json">{}</script>');
    await prepareOutput(report);
    assert.equal(await fs.access(path.join(report, 'keep.txt')).then(() => true, () => false), false);

    const other = path.join(dir, 'notes');
    await fs.mkdir(other);
    await fs.writeFile(path.join(other, 'note.txt'), 'keep');
    await assert.rejects(prepareOutput(other), /Refusing to replace/);
    assert.equal(await fs.readFile(path.join(other, 'note.txt'), 'utf8'), 'keep');
  });
});
