import { describe, expect, it } from 'vitest'
import { createDemoProject, PEOPLE } from '@/data/seed/demoProject'
import { applyCommand, AUTOSAVE_NOTE } from './commands'
import { normalizeProjectData } from './normalize'
import { PermissionError } from './permissions'
import type { ProjectData } from './types'
import { wordingOf } from './wording'
import { meetingSummary } from './workshop'

let clock = Date.parse('2026-11-05T15:00:00.000Z')
const tick = (ms = 1000) => new Date((clock += ms)).toISOString()
const run = (d: ProjectData, actor: string, cmd: unknown) => applyCommand(d, cmd, { actorId: actor, now: tick() })
const FAC = PEOPLE.avery.id // project admin (facilitator)
const EDITOR = PEOPLE.jordan.id
const OWNER = PEOPLE.morgan.id
const OWNER2 = PEOPLE.priya.id
const VIEWER = PEOPLE.casey.id

const gp = (d: ProjectData, id: string) => d.principles.find((p) => p.id === id)!
const content = (d: ProjectData, id: string) => {
  const p = gp(d, id)
  return { title: p.title, statement: p.statement, intent: p.intent, category: p.category }
}
function liveWorkshop() {
  let d = createDemoProject()
  d = run(d, FAC, { type: 'workshop.start', id: 'ws-2' }).data
  return d
}

describe('review statuses', () => {
  it('supports Proposed → Discussing → Needs Refinement → Not Adopted, but not on approved items', () => {
    let d = createDemoProject()
    for (const status of ['in_review', 'needs_refinement', 'not_adopted', 'proposed'] as const) {
      d = run(d, EDITOR, { type: 'framework.setReviewStatus', kind: 'principle', id: 'gp-5', status }).data
      expect(gp(d, 'gp-5').status).toBe(status)
    }
    expect(() => run(d, EDITOR, { type: 'framework.setReviewStatus', kind: 'principle', id: 'gp-1', status: 'in_review' })).toThrow(/approved/)
    expect(() => run(d, VIEWER, { type: 'framework.setReviewStatus', kind: 'principle', id: 'gp-5', status: 'in_review' })).toThrow(PermissionError)
  })
})

describe('Owner approval of exact wording', () => {
  it('a facilitator records the Owner representative’s approval of the exact wording during a live session', () => {
    let d = liveWorkshop()
    const wording = wordingOf(gp(d, 'gp-3'))
    d = run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '', expectedWording: wording, onBehalfOf: OWNER, sessionId: 'ws-2' }).data
    expect(gp(d, 'gp-3').approval).toMatchObject({ approvedBy: OWNER, recordedBy: FAC, wording, sessionId: 'ws-2' })
    expect(d.workshops.find((w) => w.id === 'ws-2')!.log.at(-1)).toMatchObject({ action: 'framework.approve' })
  })

  it('refuses approval if the wording changed after it was shown', () => {
    const d = liveWorkshop()
    expect(() => run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '', expectedWording: 'older wording', onBehalfOf: OWNER, sessionId: 'ws-2' })).toThrow(/wording changed/)
  })

  it('requires a live session, an approver role and the accountable approver', () => {
    const planned = createDemoProject()
    expect(() => run(planned, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '', onBehalfOf: OWNER, sessionId: 'ws-2' })).toThrow(/live workshop/)
    const d = liveWorkshop()
    expect(() => run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '', onBehalfOf: EDITOR, sessionId: 'ws-2' })).toThrow(/approval role/)
    // GP-06's accountable approver is Priya.
    expect(() => run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-6', note: '', onBehalfOf: OWNER, sessionId: 'ws-2' })).toThrow(/accountable approver/)
    expect(run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-6', note: '', onBehalfOf: OWNER2, sessionId: 'ws-2' }).data.principles.find((p) => p.id === 'gp-6')!.status).toBe('approved')
    // Editors cannot approve for themselves.
    expect(() => run(d, EDITOR, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '' })).toThrow(PermissionError)
  })

  it('approved wording is protected; a revision keeps the approved wording on record', () => {
    let d = createDemoProject()
    const approvedWording = gp(d, 'gp-1').approval!.wording
    expect(() => run(d, EDITOR, { type: 'principle.edit', id: 'gp-1', content: { ...content(d, 'gp-1'), title: 'Changed' }, note: '' })).toThrow(/locked/)
    d = run(d, EDITOR, { type: 'framework.openRevision', kind: 'principle', id: 'gp-1' }).data
    d = run(d, EDITOR, { type: 'principle.edit', id: 'gp-1', content: { ...content(d, 'gp-1'), title: 'Reliability, by Design' }, note: '' }).data
    expect(gp(d, 'gp-1')).toMatchObject({ status: 'proposed', title: 'Reliability, by Design' })
    expect(gp(d, 'gp-1').approval!.wording).toBe(approvedWording)
  })
})

describe('autosave coalescing', () => {
  it('rapid autosaves amend one version; manual saves create new versions', () => {
    let d = createDemoProject()
    const v0 = gp(d, 'gp-5').version
    for (const s of ['A', 'AB', 'ABC']) d = run(d, EDITOR, { type: 'principle.edit', id: 'gp-5', content: { ...content(d, 'gp-5'), statement: s }, note: '', coalesce: true }).data
    expect(gp(d, 'gp-5').version).toBe(v0 + 1)
    expect(gp(d, 'gp-5').versions.at(-1)).toMatchObject({ note: AUTOSAVE_NOTE, snapshot: { statement: 'ABC' } })
    // Another person's autosave starts a new version.
    d = run(d, FAC, { type: 'principle.edit', id: 'gp-5', content: { ...content(d, 'gp-5'), statement: 'ABCD' }, note: '', coalesce: true }).data
    expect(gp(d, 'gp-5').version).toBe(v0 + 2)
  })
})

describe('add, duplicate, delete, merge, reorder', () => {
  it('duplicates with evidence and places the copy after the original', () => {
    const r = run(createDemoProject(), EDITOR, { type: 'framework.duplicate', kind: 'principle', id: 'gp-2' })
    const copy = gp(r.data, r.createdId!)
    expect(copy).toMatchObject({ title: 'One Seamless Operation (copy)', status: 'proposed', order: 3 })
    expect(r.data.relationships.some((x) => x.to.id === copy.id && x.from.type === 'theme')).toBe(true)
    expect(r.data.relationships.some((x) => x.from.type === 'driver' && x.to.id === copy.id)).toBe(false)
  })

  it('deletes only never-approved items, recoverably', () => {
    let d = createDemoProject()
    expect(() => run(d, EDITOR, { type: 'framework.delete', kind: 'principle', id: 'gp-1' })).toThrow(/approved/)
    const linksBefore = d.relationships.filter((x) => x.to.id === 'gp-5' || x.from.id === 'gp-5').length
    const del = run(d, EDITOR, { type: 'framework.delete', kind: 'principle', id: 'gp-5' })
    d = del.data
    expect(d.principles.some((p) => p.id === 'gp-5')).toBe(false)
    d = run(d, EDITOR, { type: 'framework.undelete', trashId: del.createdId! }).data
    expect(gp(d, 'gp-5')).toBeTruthy()
    expect(d.relationships.filter((x) => x.to.id === 'gp-5' || x.from.id === 'gp-5').length).toBe(linksBefore)
    expect(d.trash).toHaveLength(0)
  })

  it('merges principles: evidence and drivers move, sources are superseded, approved targets become a revision', () => {
    let d = createDemoProject()
    d = run(d, EDITOR, { type: 'principle.merge', intoId: 'gp-2', fromIds: ['gp-6'], content: { ...content(d, 'gp-2'), title: 'One Seamless, Certain Operation' } }).data
    expect(gp(d, 'gp-2')).toMatchObject({ title: 'One Seamless, Certain Operation', status: 'proposed' })
    expect(gp(d, 'gp-6').status).toBe('superseded')
    expect(d.relationships.some((r) => r.from.id === 'dd-11' && r.to.id === 'gp-2')).toBe(true)
    expect(d.relationships.some((r) => r.to.id === 'gp-6' || r.from.id === 'gp-6')).toBe(false)
    // Reinstate a merged principle if the merge was a mistake.
    d = run(d, EDITOR, { type: 'framework.setReviewStatus', kind: 'principle', id: 'gp-6', status: 'proposed' }).data
    expect(gp(d, 'gp-6').status).toBe('proposed')
  })
})

describe('workshop sessions and meeting summary', () => {
  it('allows one live session, logs framework changes, and summarizes outcomes', () => {
    let d = liveWorkshop()
    const wsStart = d.workshops.find((w) => w.id === 'ws-2')!.startedAt!
    expect(() => run(d, FAC, { type: 'workshop.start', id: 'ws-1' })).toThrow(/closed|ended|already live/)
    expect(() => run(d, VIEWER, { type: 'workshop.setNote', id: 'ws-2', itemKey: 'principle:gp-3', text: 'x' })).toThrow(PermissionError)

    d = run(d, FAC, { type: 'principle.edit', id: 'gp-3', content: { ...content(d, 'gp-3'), statement: 'The facility absorbs growth and automation refresh without interrupting service.' }, note: '', coalesce: true }).data
    d = run(d, FAC, { type: 'framework.approve', kind: 'principle', id: 'gp-3', note: '', expectedWording: wordingOf(gp(d, 'gp-3')), onBehalfOf: OWNER, sessionId: 'ws-2' }).data
    d = run(d, FAC, { type: 'framework.setReviewStatus', kind: 'principle', id: 'gp-5', status: 'needs_refinement' }).data
    d = run(d, FAC, { type: 'workshop.setNote', id: 'ws-2', itemKey: 'principle:gp-5', text: 'Owner wants community partners named.' }).data
    const dup = run(d, FAC, { type: 'framework.duplicate', kind: 'winTheme', id: 'wt-2' })
    d = dup.data
    d = run(d, FAC, { type: 'framework.setReviewStatus', kind: 'winTheme', id: dup.createdId!, status: 'not_adopted' }).data
    d = run(d, FAC, { type: 'workshop.update', id: 'ws-2', patch: { actions: [{ id: 'a1', text: 'Name community partners', owner: 'Owner', due: null, done: false }] } }).data
    d = run(d, FAC, { type: 'workshop.end', id: 'ws-2' }).data

    const s = meetingSummary(d, 'ws-2')
    expect(s.draft).toBe(false)
    expect(s.window.from).toBe(wsStart)
    expect(s.adopted.map((a) => a.code)).toEqual(['GP-03'])
    expect(s.adopted[0]).toMatchObject({ approvedBy: 'Dr. Morgan Ellery', recordedBy: 'Avery Lindqvist' })
    expect(s.adopted[0].wording).toContain('automation refresh')
    expect(s.wordingChanges.map((w) => w.code)).toContain('GP-03')
    expect(s.needsRefinement).toEqual([expect.objectContaining({ code: 'GP-05', note: 'Owner wants community partners named.' })])
    expect(s.notAdopted.map((x) => x.kind)).toEqual(['winTheme'])
    expect(s.created).toHaveLength(1)
    expect(s.changeCount).toBeGreaterThanOrEqual(5)
    expect(s.session.actions).toHaveLength(1)
  })

  it('normalizes aggregates saved before workshops existed', () => {
    const old = createDemoProject() as Partial<ProjectData>
    delete old.workshops
    delete old.trash
    const n = normalizeProjectData(old as ProjectData)
    expect(n.workshops).toEqual([])
    expect(n.trash).toEqual([])
  })
})
