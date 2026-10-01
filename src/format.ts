const LOG_LIMIT = 100_000;

export function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

export function capText(value: string, limit = LOG_LIMIT): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n… truncated\n`;
}

export function joinChunks(chunks: Array<string | Buffer> | undefined): string {
  if (!chunks || chunks.length === 0) return '';
  const text = chunks.map((chunk) => (typeof chunk === 'string' ? chunk : chunk.toString('utf8'))).join('');
  return capText(stripAnsi(text));
}

export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) {
    const seconds = ms / 1000;
    const text = seconds >= 10 ? String(Math.round(seconds)) : seconds.toFixed(1).replace(/\.0$/, '');
    return `${text}s`;
  }
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function baseType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'text/html': '.html',
  'application/json': '.json',
};

export function extensionFor(contentType: string, sourcePath?: string): string {
  const mapped = EXTENSIONS[baseType(contentType)];
  if (mapped) return mapped;
  if (!sourcePath) return '';
  const match = sourcePath.match(/(\.[a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : '';
}

export function attachmentKind(name: string, contentType: string): 'image' | 'video' | 'trace' | 'file' {
  const type = baseType(contentType);
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (name.toLowerCase() === 'trace') return 'trace';
  return 'file';
}

export function parseShotName(name: string): { name: string; role?: 'step' | 'last' | 'failure'; stepTitle?: string } {
  if (name.startsWith('marquee:step:')) {
    const stepTitle = name.slice('marquee:step:'.length).trim() || 'Step';
    return { name: stepTitle, role: 'step', stepTitle };
  }
  if (name === 'marquee:failure') return { name: 'Failure', role: 'failure' };
  if (name === 'marquee:last') return { name: 'Last step', role: 'last' };
  return { name: name || 'file' };
}

export type DurationBand = 'under1' | '1to3' | '3to5' | 'over5';

export function durationBand(ms: number): DurationBand {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (ms < 60_000) return 'under1';
  if (ms < 180_000) return '1to3';
  if (ms < 300_000) return '3to5';
  return 'over5';
}

export function safeFileName(name: string, index: number, ext: string): string {
  const cleanExt = /^\.[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : '';
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
  return `${String(index).padStart(3, '0')}-${base}${cleanExt}`;
}
