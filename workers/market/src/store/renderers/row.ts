import type { Row } from '../../types.js';

export function rowText(row: Row, key: string): string {
  const value = row[key];
  return value === undefined || value === null ? '' : String(value);
}

export function rowOptionalText(row: Row, key: string): string | undefined {
  const value = row[key];
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

export function rowBool(row: Row, key: string): boolean {
  return Boolean(row[key]);
}

export function rowNumber(row: Row, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value || 0);
}
