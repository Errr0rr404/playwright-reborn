import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = path.join(root, 'dist', 'ui', 'fonts');
await mkdir(fonts, { recursive: true });
await cp(path.join(root, 'ui', 'report.css'), path.join(root, 'dist', 'ui', 'report.css'));
await cp(path.join(root, 'ui', 'report.js'), path.join(root, 'dist', 'ui', 'report.js'));

const files = [
  ['node_modules/@fontsource/geist/files/geist-latin-400-normal.woff2', 'geist-latin-400-normal.woff2'],
  ['node_modules/@fontsource/geist/files/geist-latin-500-normal.woff2', 'geist-latin-500-normal.woff2'],
  ['node_modules/@fontsource/geist/files/geist-latin-600-normal.woff2', 'geist-latin-600-normal.woff2'],
  ['node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', 'jetbrains-mono-latin-500-normal.woff2'],
  ['node_modules/@fontsource/geist/LICENSE', 'Geist-OFL.txt'],
  ['node_modules/@fontsource/jetbrains-mono/LICENSE', 'JetBrainsMono-OFL.txt'],
];

for (const [from, name] of files) {
  await cp(path.join(root, from), path.join(fonts, name));
}
