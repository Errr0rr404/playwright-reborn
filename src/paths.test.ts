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
  });
});

describe('relativePosix', () => {
  it('uses forward slashes for files inside the project', () => {
    const root = path.join(os.tmpdir(), 'proj');
    assert.equal(relativePosix(root, path.join(root, 'demo', 'cart.spec.ts')), 'demo/cart.spec.ts');
  });
});

describe('prepareOutput', () => {
  it('replaces a previous Reborn folder and refuses an unrelated one', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reborn-out-'));
    const report = path.join(dir, 'reborn-report');
    await fs.mkdir(report);
    await fs.writeFile(path.join(report, 'keep.txt'), 'old');
    await prepareOutput(report);
    assert.equal(await fs.access(path.join(report, 'keep.txt')).then(() => true, () => false), false);

    const other = path.join(dir, 'notes');
    await fs.mkdir(other);
    await fs.writeFile(path.join(other, 'note.txt'), 'keep');
    await assert.rejects(prepareOutput(other), /Refusing to replace/);
    assert.equal(await fs.readFile(path.join(other, 'note.txt'), 'utf8'), 'keep');
  });
});
