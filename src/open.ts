import { spawn } from 'node:child_process';
import path from 'node:path';

export function openReport(filePath: string): void {
  const file = path.resolve(filePath);
  const child = process.platform === 'darwin'
    ? spawn('open', [file], { detached: true, stdio: 'ignore' })
    : process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', file], { detached: true, stdio: 'ignore', windowsHide: true })
      : spawn('xdg-open', [file], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}
