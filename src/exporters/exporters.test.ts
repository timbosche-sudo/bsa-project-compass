import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/data/seed/demoProject'
import { reportReadiness } from './common'
import { escapeCell, toCsv } from './csv'
import { driverRegisterTable, traceabilityTable } from './tables'
import { clean } from './pdf'

describe('exporters', () => {
  it('neutralizes spreadsheet formula injection and quotes CSV', () => {
    expect(escapeCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(escapeCell('+1')).toBe("'+1")
    expect(escapeCell('a,b')).toBe('"a,b"')
    expect(escapeCell(null)).toBe('')
  })

  it('writes unknown values explicitly rather than inventing them', () => {
    const t = driverRegisterTable(createDemoProject())
    const dd1 = t.rows.find((r) => r.code === 'DD-01')!
    expect(dd1.target).toBe('Not set')
    expect(dd1.baseline).toBe('Unknown')
    expect(dd1.current).toBe('Not yet measured')
    expect(dd1.approval).toMatch(/^DRAFT/)
  })

  it('labels derived traceability links and carries provenance in CSV', () => {
    const d = createDemoProject()
    const t = traceabilityTable(d)
    const row = t.rows.find((r) => r.statement === 'ST-024')!
    expect(String(row.principles)).toContain('(via theme)')
    const csv = toCsv(t, ['SYNTHETIC DEMONSTRATION DATA'])
    expect(csv.split('\r\n')[0]).toContain('SYNTHETIC')
  })

  it('titles reports as draft until the framework is approved', () => {
    const d = createDemoProject()
    expect(reportReadiness(d).final).toBe(false)
    d.winThemes[0].status = 'approved'
    d.principles.forEach((p) => (p.status = 'approved'))
    expect(reportReadiness(d).final).toBe(true)
  })

  it('normalizes characters for standard PDF fonts', () => {
    expect(clean('“Every Dose” — ≥ 75%')).toBe('"Every Dose" - >= 75%')
  })
})
