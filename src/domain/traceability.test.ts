import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/data/seed/demoProject'
import { buildGraph, evidenceFor, focusSet, gapReport, traceRows } from './traceability'
import { dashboardModel } from './metrics'
import { driverCompleteness, driverStatus, measurementState } from './drivers'

describe('traceability', () => {
  const d = createDemoProject()

  it('resolves direct and theme-derived evidence for principles', () => {
    const e = evidenceFor(d, { type: 'principle', id: 'gp-1' })
    expect(e.viaThemes.map((s) => s.id)).toEqual(expect.arrayContaining(['st-1', 'st-2', 'st-6']))
    const dr = evidenceFor(d, { type: 'driver', id: 'dd-2' })
    expect(dr.direct.map((s) => s.id)).toEqual(expect.arrayContaining(['st-2', 'st-24']))
    expect(dr.inherited.length).toBeGreaterThan(0)
  })

  it('finds orphans, unsupported themes and overlooked requirements', () => {
    const g = gapReport(d)
    expect(g.orphanStatements.map((s) => s.id)).toEqual(expect.arrayContaining(['st-5', 'st-19']))
    expect(g.requirementsNotInFramework.map((s) => s.id)).toEqual(['st-5'])
    expect(g.themesWithoutOwnerSupport).toContain('th-7')
    expect(g.pendingRelationships).toHaveLength(1)
    expect(g.conflicts).toHaveLength(1)
  })

  it('does not rank by frequency: criticality is explicit', () => {
    const rows = traceRows(d)
    const st5 = rows.find((r) => r.statementId === 'st-5')!
    expect(st5.criticality).toBe('critical')
    expect(st5.themes).toHaveLength(0)
  })

  it('builds matrix rows through the full chain', () => {
    const row = traceRows(d).find((r) => r.statementId === 'st-24')!
    expect(row.themes.map((t) => t.code)).toEqual(['TH-01'])
    expect(row.principles.map((p) => p.code)).toContain('GP-01')
    expect(row.drivers.map((x) => x.code)).toContain('DD-02')
    expect(row.decisions.map((x) => x.code)).toContain('DEC-001')
  })

  it('focuses the upstream and downstream chain of a node', () => {
    const g = buildGraph(d)
    const set = focusSet(g, 'driver:dd-2')
    expect(set.has('principle:gp-1')).toBe(true)
    expect(set.has('decision:dec-1')).toBe(true)
    expect(set.has('source:src-10')).toBe(true)
    expect(set.has('driver:dd-9')).toBe(false)
  })
})

describe('dashboard metrics', () => {
  const d = createDemoProject()

  it('reports completeness separately from achievement and exposes unknowns', () => {
    const m = dashboardModel(d, {}, '2026-10-30')
    expect(m.verified.map((x) => x.code)).toEqual(['DD-08'])
    expect(m.achievementRate).toBe(1)
    expect(m.completeness).toBeGreaterThan(0)
    expect(m.completeness).toBeLessThan(1)
    expect(m.withoutOwner.map((x) => x.code)).toEqual(['DD-06'])
    expect(m.awaitingTargetApproval.map((x) => x.code)).toEqual(['DD-05'])
    expect(m.targetNotSet.map((x) => x.code)).toEqual(expect.arrayContaining(['DD-01', 'DD-10']))
    expect(m.notYetMeasured.map((x) => x.code)).toEqual(['DD-02'])
    expect(m.decisionsAwaitingApproval.map((x) => x.code)).toEqual(['DEC-001'])
    expect(m.upcomingMilestones[0].name).toMatch(/mock-up/)
  })

  it('filters by principle, organization and phase', () => {
    expect(dashboardModel(d, { principleId: 'gp-6' }).drivers.map((x) => x.code).sort()).toEqual(['DD-02', 'DD-11', 'DD-12'])
    expect(dashboardModel(d, { organization: 'Fieldstone Engineering' }).drivers).toHaveLength(3)
    expect(dashboardModel(d, { phase: 'construction' }).drivers.map((x) => x.code)).toEqual(['DD-11'])
  })

  it('derives combined status and measurement state', () => {
    const byCode = (c: string) => d.drivers.find((x) => x.code === c)!
    expect(driverStatus(byCode('DD-07'))).toBe('at_risk')
    expect(driverStatus(byCode('DD-05'))).toBe('under_review')
    expect(measurementState(byCode('DD-03'))).toBe('measured')
    expect(driverCompleteness(d, byCode('DD-06')).missing).toContain('Accountable owner')
  })
})
