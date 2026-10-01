export type InfoRow = { label: string; value: string };

const FIELDS: Array<[string, string]> = [
  ['suite', 'Suite'],
  ['user', 'User'],
  ['environment', 'Environment'],
  ['state', 'State'],
  ['defects', 'Defects'],
  ['baseURL', 'Base URL'],
  ['branch', 'Branch'],
  ['sha', 'Commit'],
  ['projects', 'Projects'],
  ['workers', 'Workers'],
  ['shard', 'Shard'],
  ['playwright', 'Playwright'],
];

export function infoRows(fields: Record<string, string | undefined>): InfoRow[] {
  const rows: InfoRow[] = [];
  for (const [key, label] of FIELDS) {
    const value = fields[key]?.trim();
    if (!value) continue;
    rows.push({ label, value });
  }
  return rows;
}

export function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function listValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => listValue(item));
  }
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}
