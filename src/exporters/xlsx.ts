import type { Table } from './common'

/** Builds an .xlsx workbook (lazy-loaded) with an "About" sheet carrying provenance. */
export async function toXlsx(table: Table, sheetName: string, provenance: string[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const header = table.columns.map((c) => ({ value: c.label, fontWeight: 'bold' as const, backgroundColor: '#E2F4F6' }))
  const body = table.rows.map((r) => table.columns.map((c) => {
    const v = r[c.key]
    if (v === null || v === undefined || v === '') return null
    return typeof v === 'number' ? { value: v, type: Number } : { value: String(v), type: String, wrap: true }
  }))
  const about = provenance.map((l) => [{ value: l, type: String }])
  return writeXlsxFile(
    [
      { data: [header, ...body], sheet: sheetName.slice(0, 31), columns: table.columns.map((c) => ({ width: c.width ?? 18 })), stickyRowsCount: 1 },
      { data: [[{ value: 'About this export', fontWeight: 'bold' as const }], ...about], sheet: 'About', columns: [{ width: 110 }] },
    ] as never,
  ).toBlob()
}
