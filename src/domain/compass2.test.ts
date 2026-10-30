import { describe, expect, it } from 'vitest'
import { createDemoProject, PEOPLE } from '@/data/seed/demoProject'
import { applyCommand, DomainError } from './commands'
import { normalizeProjectData } from './normalize'
import { PermissionError } from './permissions'
import { evidenceFor, nodeExists, nodePath } from './traceability'
import type { ProjectData } from './types'

const NOW = '2026-10-30T12:00:00.000Z'
const run = (data: ProjectData, actor: string, cmd: unknown) => applyCommand(data, cmd, { actorId: actor, now: NOW })
const EDITOR = PEOPLE.jordan.id
const CONTRIB = PEOPLE.sam.id
const VIEWER = PEOPLE.casey.id

const opp = { title: 'New opportunity', description: '', principleIds: ['gp-1'], state: 'emerging', inPresentation: false, linkedDriverIds: [] }
const outcome = { statement: 'Something improves.', principleId: 'gp-1', opportunityId: null, category: 'qualitative', state: 'emerging', aspiration: false, possibleMeasures: '', inPresentation: false }

describe('Compass 2.0 — Understand', () => {
  it('creates, edits, reviews and reorders What We Heard items', () => {
    let d = createDemoProject()
    const r = run(d, EDITOR, { type: 'heard.create', item: { section: 'tension', title: 'A tension', narrative: 'x', evidence: [{ type: 'statement', id: 'st-1' }], inPresentation: true } })
    d = r.data
    const item = d.heard.find((h) => h.id === r.createdId)!
    expect(item).toMatchObject({ origin: 'human', updatedBy: EDITOR })
    d = run(d, EDITOR, { type: 'heard.update', id: item.id, patch: { reviewed: true, title: 'Renamed' } }).data
    expect(d.heard.find((h) => h.id === item.id)).toMatchObject({ reviewed: true, title: 'Renamed' })
    const ids = d.heard.map((h) => h.id).reverse()
    d = run(d, EDITOR, { type: 'heard.reorder', orderedIds: ids }).data
    expect([...d.heard].sort((a, b) => a.order - b.order).map((h) => h.id)).toEqual(ids)
    d = run(d, EDITOR, { type: 'heard.delete', id: item.id }).data
    expect(d.heard.some((h) => h.id === item.id)).toBe(false)
  })

  it('rejects evidence that does not exist and blocks viewers', () => {
    const d = createDemoProject()
    expect(() => run(d, EDITOR, { type: 'heard.create', item: { section: 'theme', title: 't', narrative: '', evidence: [{ type: 'statement', id: 'st-999' }], inPresentation: true } })).toThrow(DomainError)
    expect(() => run(d, VIEWER, { type: 'heard.delete', id: 'hd-1' })).toThrow(PermissionError)
  })
})

describe('Compass 2.0 — Interpret', () => {
  it('versions the point of view and allows a single recommended alternative', () => {
    const d = createDemoProject()
    const content = { ...d.pointOfView!, history: undefined, updatedAt: undefined, updatedBy: undefined }
    delete content.history
    delete content.updatedAt
    delete content.updatedBy
    const next = run(d, EDITOR, { type: 'pov.update', content: { ...content, centralAmbition: 'Changed.' } }).data
    expect(next.pointOfView!.centralAmbition).toBe('Changed.')
    expect(next.pointOfView!.history.length).toBe(d.pointOfView!.history.length + 1)
    const two = content.alternatives.map((a) => ({ ...a, recommended: true }))
    expect(() => run(d, EDITOR, { type: 'pov.update', content: { ...content, alternatives: two } })).toThrow(/one/i)
  })

  it('keeps principle support text outside the versioned wording', () => {
    const d = createDemoProject()
    const p = d.principles[0]
    const next = run(d, EDITOR, { type: 'principle.updateSupport', id: p.id, whyItMatters: 'Because.' }).data
    const q = next.principles[0]
    expect(q.whyItMatters).toBe('Because.')
    expect(q.version).toBe(p.version)
    expect(q.statement).toBe(p.statement)
  })

  it('creates opportunities and outcomes with sequential codes and valid links', () => {
    let d = createDemoProject()
    const n = d.opportunities.length
    const r = run(d, EDITOR, { type: 'opportunity.create', content: opp })
    d = r.data
    expect(d.opportunities.find((o) => o.id === r.createdId)!.code).toBe(`DO-${String(n + 1).padStart(2, '0')}`)
    expect(() => run(d, EDITOR, { type: 'opportunity.create', content: { ...opp, principleIds: ['gp-404'] } })).toThrow(DomainError)
    const o = run(d, EDITOR, { type: 'outcome.create', content: { ...outcome, opportunityId: r.createdId } })
    expect(o.data.outcomes.find((x) => x.id === o.createdId)!.code).toMatch(/^PO-\d{2}$/)
    expect(() => run(d, CONTRIB, { type: 'outcome.create', content: outcome })).toThrow(PermissionError)
  })

  it('records evidence of progress and removes it again', () => {
    let d = createDemoProject()
    d = run(d, EDITOR, { type: 'outcome.addProgress', id: 'po-1', date: '2026-10-30', kind: 'design_study', note: 'Study complete.' }).data
    const added = d.outcomes.find((o) => o.id === 'po-1')!.evidenceOfProgress.at(-1)!
    expect(added).toMatchObject({ note: 'Study complete.', addedBy: EDITOR })
    d = run(d, EDITOR, { type: 'outcome.removeProgress', id: 'po-1', progressId: added.id }).data
    expect(d.outcomes.find((o) => o.id === 'po-1')!.evidenceOfProgress.some((p) => p.id === added.id)).toBe(false)
  })

  it('opportunities and outcomes inherit evidence from their principles', () => {
    const d = createDemoProject()
    const fromPrinciple = evidenceFor(d, { type: 'principle', id: 'gp-1' }).all.map((s) => s.id).sort()
    expect(evidenceFor(d, { type: 'opportunity', id: 'do-1' }).inherited.map((s) => s.id).sort()).toEqual(fromPrinciple)
    expect(evidenceFor(d, { type: 'outcome', id: 'po-1' }).all.length).toBeGreaterThan(0)
    expect(nodeExists(d, { type: 'outcome', id: 'po-1' })).toBe(true)
    expect(nodePath(d.project.id, { type: 'opportunity', id: 'do-1' })).toContain('/interpret/opportunities')
  })

  it('removes deleted principles from opportunity links', () => {
    const d = createDemoProject()
    const pid = d.opportunities.find((o) => o.principleIds.length > 1)!.principleIds[1]
    const del = run(d, PEOPLE.avery.id, { type: 'framework.delete', kind: 'principle', id: pid })
    expect(del.data.opportunities.every((o) => !o.principleIds.includes(pid))).toBe(true)
  })
})

describe('normalize', () => {
  it('adds Compass 2.0 collections to older saved projects', () => {
    const d = createDemoProject() as Partial<ProjectData>
    delete d.heard
    delete d.pointOfView
    delete d.opportunities
    delete d.outcomes
    const n = normalizeProjectData(d as ProjectData)
    expect(n).toMatchObject({ heard: [], pointOfView: null, opportunities: [], outcomes: [] })
  })
})
