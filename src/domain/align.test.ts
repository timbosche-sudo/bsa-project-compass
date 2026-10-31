import { describe, expect, it } from 'vitest'
import { createDemoProject, PEOPLE } from '@/data/seed/demoProject'
import { alignmentGaps, alignmentStatusOf, latestAlignedDirection } from './alignment'
import { applyCommand, DomainError } from './commands'
import { normalizeProjectData } from './normalize'
import { PermissionError } from './permissions'
import type { AlignmentStatus, ProjectData } from './types'
import { meetingSummary } from './workshop'

let clock = Date.parse('2026-11-05T15:00:00.000Z')
const run = (data: ProjectData, actor: string, cmd: unknown) => applyCommand(data, cmd, { actorId: actor, now: new Date((clock += 60_000)).toISOString() })
const ADMIN = PEOPLE.avery.id
const EDITOR = PEOPLE.jordan.id
const VIEWER = PEOPLE.casey.id
const empty = { feedback: '', refinements: '', questions: '', ownerComments: '' }
const record = (d: ProjectData, type: 'winTheme' | 'principle', id: string, status: AlignmentStatus, extra = {}) =>
  run(d, ADMIN, { type: 'alignment.record', sessionId: 'ws-2', target: { type, id }, response: { status, ...empty, ...extra } }).data

describe('alignment capture', () => {
  it('records one response per item per session and updates it in place', () => {
    let d = createDemoProject()
    expect(alignmentStatusOf(d, 'winTheme', 'wt-1')).toBe('not_reviewed')
    d = record(d, 'winTheme', 'wt-1', 'needs_discussion')
    d = record(d, 'winTheme', 'wt-1', 'aligned_with_refinements', { refinements: 'Say “every tomorrow” means growth and resilience.' })
    const rs = d.alignment.filter((r) => r.target.id === 'wt-1')
    expect(rs).toHaveLength(1)
    expect(rs[0]).toMatchObject({ status: 'aligned_with_refinements', recordedBy: ADMIN })
    expect(alignmentStatusOf(d, 'winTheme', 'wt-1')).toBe('aligned_with_refinements')
  })

  it('the latest session wins; earlier sessions stay on record', () => {
    let d = createDemoProject()
    expect(alignmentStatusOf(d, 'principle', 'gp-3')).toBe('needs_discussion')
    d = record(d, 'principle', 'gp-3', 'aligned')
    expect(alignmentStatusOf(d, 'principle', 'gp-3')).toBe('aligned')
    expect(d.alignment.filter((r) => r.target.id === 'gp-3')).toHaveLength(2)
  })

  it('is restricted to facilitators and validates targets', () => {
    const d = createDemoProject()
    expect(() => run(d, VIEWER, { type: 'alignment.record', sessionId: 'ws-2', target: { type: 'principle', id: 'gp-1' }, response: { status: 'aligned', ...empty } })).toThrow(PermissionError)
    expect(() => record(d, 'principle', 'gp-404', 'aligned')).toThrow(DomainError)
  })

  it('logs responses in the live session without approving anything', () => {
    let d = run(createDemoProject(), ADMIN, { type: 'workshop.start', id: 'ws-2' }).data
    const before = d.principles.find((p) => p.id === 'gp-6')!.status
    d = record(d, 'principle', 'gp-6', 'aligned')
    expect(d.principles.find((p) => p.id === 'gp-6')!.status).toBe(before)
    expect(d.workshops.find((w) => w.id === 'ws-2')!.log.at(-1)!.summary).toMatch(/GP-06: Aligned/)
  })
})

describe('direction snapshots', () => {
  it('starting and ending a session preserve proposed and Owner-reviewed directions', () => {
    let d = run(createDemoProject(), ADMIN, { type: 'workshop.start', id: 'ws-2' }).data
    expect(d.directions.filter((s) => s.sessionId === 'ws-2').map((s) => s.state)).toContain('bsa_proposed')
    d = run(d, ADMIN, { type: 'workshop.end', id: 'ws-2' }).data
    expect(d.directions.at(-1)).toMatchObject({ state: 'owner_reviewed', sessionId: 'ws-2' })
  })

  it('refuses to record "aligned" while any item is not reviewed or under discussion', () => {
    let d = createDemoProject()
    expect(() => run(d, ADMIN, { type: 'direction.snapshot', label: 'Aligned', state: 'aligned', sessionId: 'ws-2', note: '' })).toThrow(/GP-03.*needs further discussion/)
    for (const p of d.principles.filter((x) => x.status !== 'superseded')) d = record(d, 'principle', p.id, 'aligned')
    expect(alignmentGaps(d).ready).toBe(false) // vision not yet reviewed
    d = record(d, 'winTheme', 'wt-1', 'aligned')
    expect(alignmentGaps(d)).toEqual({ ready: true, blocking: [] })
    const r = run(d, ADMIN, { type: 'direction.snapshot', label: 'Aligned at WS-02', state: 'aligned', sessionId: 'ws-2', note: '' })
    expect(latestAlignedDirection(r.data)?.id).toBe(r.createdId)
    expect(latestAlignedDirection(r.data)!.content.alignment.filter((a) => a.type === 'principle').every((a) => a.status === 'aligned')).toBe(true)
  })

  it('editors can save revisions; viewers and contributors cannot save directions', () => {
    const d = createDemoProject()
    expect(run(d, EDITOR, { type: 'direction.snapshot', label: 'Revision after DD review', state: 'revision', sessionId: null, note: '' }).createdId).toBeTruthy()
    expect(() => run(d, VIEWER, { type: 'direction.snapshot', label: 'x', state: 'revision', sessionId: null, note: '' })).toThrow(PermissionError)
    expect(() => run(d, PEOPLE.sam.id, { type: 'direction.snapshot', label: 'x', state: 'owner_reviewed', sessionId: null, note: '' })).toThrow(PermissionError)
  })

  it('snapshots are immutable and restoring creates new versions instead of overwriting', () => {
    let d = createDemoProject()
    const snap = d.directions[0]
    const original = snap.content.principles.find((p) => p.id === 'gp-3')!.statement
    d = run(d, EDITOR, { type: 'principle.edit', id: 'gp-3', content: { ...pick(d, 'gp-3'), statement: 'Changed after the meeting.' }, note: '' }).data
    expect(d.directions[0].content.principles.find((p) => p.id === 'gp-3')!.statement).toBe(original)
    const versions = d.principles.find((p) => p.id === 'gp-3')!.versions.length
    d = run(d, EDITOR, { type: 'direction.restore', id: snap.id }).data
    const gp3 = d.principles.find((p) => p.id === 'gp-3')!
    expect(gp3.statement).toBe(original)
    expect(gp3.versions.length).toBe(versions + 1)
    expect(gp3.versions.at(-1)!.note).toBe(`Restored from ${snap.code}`)
  })

  it('never overwrites approved wording when restoring', () => {
    let d = createDemoProject()
    const approved = d.principles.find((p) => p.status === 'approved')!
    d.directions[0].content.principles.find((p) => p.id === approved.id)!.statement = 'Old wording.'
    const r = run(d, EDITOR, { type: 'direction.restore', id: d.directions[0].id })
    expect(r.data.principles.find((p) => p.id === approved.id)!.statement).toBe(approved.statement)
    expect(r.data.audit[0].summary).toMatch(new RegExp(`${approved.code} \\(approved`))
  })
})

describe('meeting summary', () => {
  it('reports alignment, items not reviewed, direction and open questions', () => {
    let d = run(createDemoProject(), ADMIN, { type: 'workshop.start', id: 'ws-2' }).data
    d = record(d, 'principle', 'gp-3', 'aligned_with_refinements', { refinements: 'Name automation refresh.', questions: 'How often is automation replaced?' })
    const s = meetingSummary(d, 'ws-2')
    expect(s.alignment).toEqual([expect.objectContaining({ code: 'GP-03', status: 'aligned_with_refinements', refinements: 'Name automation refresh.' })])
    expect(s.notReviewed.map((n) => n.code)).toContain('WT-01')
    expect(s.direction.principles.find((p) => p.code === 'GP-03')!.status).toBe('aligned_with_refinements')
    expect(s.strategicQuestions[0]).toBe('GP-03: How often is automation replaced?')
    expect(s.direction.outcomesToValidate.every((o) => o.code.startsWith('PO-'))).toBe(true)
  })
})

it('normalizes older data with empty alignment and directions', () => {
  const d = createDemoProject() as Partial<ProjectData>
  delete d.alignment
  delete d.directions
  expect(normalizeProjectData(d as ProjectData)).toMatchObject({ alignment: [], directions: [] })
})

function pick(d: ProjectData, id: string) {
  const p = d.principles.find((x) => x.id === id)!
  return { title: p.title, statement: p.statement, intent: p.intent, category: p.category }
}
