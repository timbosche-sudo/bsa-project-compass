import type { Table } from './common'

/**
 * RFC 4180 CSV. Cells that a spreadsheet would interpret as a formula are
 * prefixed with an apostrophe to prevent CSV/formula injection.
 */
export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(table: Table, preamble: string[] = []): string {
  const lines = [
    ...preamble.map((l) => escapeCell(`# ${l}`)),
    table.columns.map((c) => escapeCell(c.label)).join(','),
    ...table.rows.map((r) => table.columns.map((c) => escapeCell(r[c.key])).join(',')),
  ]
  return '﻿' + lines.join('\r\n') + '\r\n'
}
