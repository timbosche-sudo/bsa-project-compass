import { describe, expect, it } from 'vitest'
import { createDemoProject, PEOPLE } from '@/data/seed/demoProject'
import { applyCommand, DomainError } from './commands'
import { PermissionError } from './permissions'
import type { ProjectData } from './types'

const NOW = '2026-10-30T12:00:00.000Z'
const as = (actor: string) => ({ actorId: actor, now: NOW })
const run = (data: ProjectData, actor: string, cmd: unknown) => applyCommand(data, cmd, as(actor))

const ADMIN = PEOPLE.avery.id
const EDITOR = PEOPLE.jordan.id
const CONTRIB = PEOPLE.sam.id
const REVIEWER = PEOPLE.morgan.id
const REVIEWER2 = PEOPLE.priya.id
const VIEWER = PEOPLE.casey.id

describe('command validation and authorization', () => {
  it('rejects malformed payloads with a validation error', () => {
    const d = createDemoProject()
    expect(() => run(d, ADMIN, { type: 'source.create', source: { title: '' } })).toThrow(DomainError)
    expect(() => run(d, ADMIN, { type: 'not.a.command' })).toThrow(/Invalid input/)
  })

  it('enforces role capabilities server-side, not just in the UI', () => {
    const d = createDemoProject()
    const cmd = { type: 'question.create', question: 'Is this allowed?', context: [] }
    expect(() => run(d, VIEWER, cmd)).toThrow(PermissionError)
    expect(() => run(d, 'p-stranger', cmd)).toThrow(PermissionError)
    expect(run(d, CONTRIB, cmd).createdId).toBeTruthy()
  })

  it('never mutates the input aggregate and appends an audit event', () => {
    const d = createDemoProject()
    const before = JSON.stringify(d)
    const { data } = run(d, ADMIN, { type: 'question.create', question: 'Q?', context: [] })
    expect(JSON.stringify(d)).toBe(before)
    expect(data.revision).toBe(d.revision + 1)
    expect(data.audit[0]).toMatchObject({ actorId: ADMIN, action: 'question.create' })
  })

  it('validates file type and size for source metadata', () => {
    const d = createDemoProject()
    const base = { title: 'X', type: 'pdf', author: '', organization: '', date: '2026-10-01', confidentiality: 'internal', description: '', possibleDuplicateOf: null }
    expect(() => run(d, CONTRIB, { type: 'source.create', source: { ...base, file: { name: 'a.exe', mimeType: 'application/x-msdownload', sizeBytes: 10, storagePath: null } } })).toThrow(/Unsupported file type/)
    expect(() => run(d, CONTRIB, { type: 'source.create', source: { ...base, file: { name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 60 * 1024 * 1024, storagePath: null } } })).toThrow(/50 MB/)
    expect(() => run(d, CONTRIB, { type: 'source.create', source: { ...base, file: { name: '../a.pdf', mimeType: 'application/pdf', sizeBytes: 10, storagePath: null } } })).toThrow(/Invalid file name/)
    const { data, createdId } = run(d, CONTRIB, { type: 'source.create', source: { ...base, file: { name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10, storagePath: null } } })
    expect(data.sources.find((s) => s.id === createdId)?.code).toBe('SRC-013')
  })
})

describe('source statements and transcription', () => {
  it('preserves original wording through attributed correction revisions', () => {
    const d = createDemoProject()
    const { data } = run(d, REVIEWER, { type: 'statement.correctTranscription', id: 'st-27', text: 'Be a good neighbor — jobs + training for our community', note: 'Re-read "the" as "our"', uncertainWords: [] })
    const s = data.statements.find((x) => x.id === 'st-27')!
    expect(s.originalText).toContain('our community')
    expect(s.revisions.at(-1)).toMatchObject({ text: 'Be a good neighbor — jobs + training for the community', by: REVIEWER })
    expect(s.transcriptionStatus).toBe('unverified')
  })

  it('refuses to verify a transcription with uncertain words', () => {
    const d = createDemoProject()
    expect(() => run(d, REVIEWER, { type: 'statement.setTranscriptionStatus', id: 'st-8', status: 'verified' })).toThrow(/uncertain words/)
    const fixed = run(d, REVIEWER, { type: 'statement.correctTranscription', id: 'st-8', text: 'Room to grow w/o shutting down', note: 'Confirmed with author', uncertainWords: [] }).data
    const verified = run(fixed, REVIEWER, { type: 'statement.setTranscriptionStatus', id: 'st-8', status: 'verified' }).data
    expect(verified.statements.find((s) => s.id === 'st-8')).toMatchObject({ transcriptionStatus: 'verified', reviewedBy: REVIEWER })
  })

  it('cascades source deletion to statements and their relationships', () => {
    const d = createDemoProject()
    const { data } = run(d, ADMIN, { type: 'source.delete', id: 'src-8' })
    expect(data.statements.some((s) => s.sourceId === 'src-8')).toBe(false)
    expect(data.relationships.some((r) => r.from.id === 'st-16' || r.to.id === 'st-16')).toBe(false)
    expect(() => run(d, EDITOR, { type: 'source.delete', id: 'src-8' })).toThrow(PermissionError)
  })
})

describe('relationships', () => {
  it('contributor links are proposed; editor links are accepted', () => {
    const d = createDemoProject()
    const link = { type: 'relationship.create', from: { type: 'statement', id: 'st-19' }, to: { type: 'theme', id: 'th-4' }, relType: 'supports', explanation: '', confidence: 'medium' }
    const a = run(d, CONTRIB, link)
    expect(a.data.relationships.find((r) => r.id === a.createdId)?.status).toBe('proposed')
    const b = run(d, EDITOR, link)
    expect(b.data.relationships.find((r) => r.id === b.createdId)?.status).toBe('accepted')
  })

  it('rejects links to nodes in other projects or missing nodes', () => {
    const d = createDemoProject()
    expect(() => run(d, EDITOR, { type: 'relationship.create', from: { type: 'statement', id: 'st-1' }, to: { type: 'theme', id: 'rgp-1' }, relType: 'supports', explanation: '', confidence: 'low' })).toThrow(/must exist/)
  })
})

describe('themes', () => {
  it('merges, splits and promotes themes while keeping evidence', () => {
    let d = createDemoProject()
    d = run(d, EDITOR, { type: 'theme.merge', fromId: 'th-7', intoId: 'th-1' }).data
    expect(d.themes.find((t) => t.id === 'th-7')?.status).toBe('archived')
    expect(d.relationships.some((r) => r.from.id === 'st-20' && r.to.id === 'th-1')).toBe(true)
    const split = run(d, EDITOR, { type: 'theme.split', id: 'th-1', title: 'Hazardous separation', statementIds: ['st-20'] })
    expect(split.data.relationships.some((r) => r.from.id === 'st-20' && r.to.id === split.createdId)).toBe(true)
    const promoted = run(split.data, EDITOR, { type: 'theme.promote', id: split.createdId!, category: 'facility_outcomes' })
    const p = promoted.data.principles.find((x) => x.id === promoted.createdId)!
    expect(p).toMatchObject({ title: 'Hazardous separation', status: 'proposed', code: 'GP-07' })
  })
})

describe('Win Theme and principle governance', () => {
  it('locks approved principles until a revision is opened', () => {
    const d = createDemoProject()
    const content = { title: 'Reliability by Design', statement: 'Changed silently', intent: '', category: 'facility_outcomes' }
    expect(() => run(d, EDITOR, { type: 'principle.edit', id: 'gp-1', content, note: '' })).toThrow(/locked/)
    const opened = run(d, EDITOR, { type: 'framework.openRevision', kind: 'principle', id: 'gp-1' }).data
    const edited = run(opened, EDITOR, { type: 'principle.edit', id: 'gp-1', content, note: 'Tighten' }).data
    const p = edited.principles.find((x) => x.id === 'gp-1')!
    expect(p.status).toBe('proposed')
    expect(p.approval?.version).toBeLessThan(p.version)
    expect(p.versions.some((v) => v.status === 'approved' && v.snapshot.statement !== 'Changed silently')).toBe(true)
  })

  it('restores an earlier version as a new version', () => {
    const d = createDemoProject()
    const opened = run(d, EDITOR, { type: 'framework.openRevision', kind: 'principle', id: 'gp-1' }).data
    const restored = run(opened, EDITOR, { type: 'framework.restore', kind: 'principle', id: 'gp-1', version: 1 }).data
    const p = restored.principles.find((x) => x.id === 'gp-1')!
    expect(p.title).toBe('Reliability First')
    expect(p.versions.at(-1)?.note).toMatch(/Restored content from v1/)
  })

  it('requires the accountable approver and the reviewer role', () => {
    const d = createDemoProject()
    // GP-06 is in review with Priya as accountable approver.
    expect(() => run(d, EDITOR, { type: 'framework.approve', kind: 'principle', id: 'gp-6', note: '' })).toThrow(PermissionError)
    expect(() => run(d, REVIEWER, { type: 'framework.approve', kind: 'principle', id: 'gp-6', note: '' })).toThrow(/accountable approver/)
    const ok = run(d, REVIEWER2, { type: 'framework.approve', kind: 'principle', id: 'gp-6', note: 'OK' }).data
    expect(ok.principles.find((x) => x.id === 'gp-6')).toMatchObject({ status: 'approved', approval: { approvedBy: REVIEWER2 } })
  })

  it('approving a Win Theme supersedes the previously approved one', () => {
    let d = createDemoProject()
    d = run(d, REVIEWER, { type: 'framework.approve', kind: 'winTheme', id: 'wt-1', note: '' }).data
    d = run(d, EDITOR, { type: 'framework.submit', kind: 'winTheme', id: 'wt-2' }).data
    d = run(d, REVIEWER, { type: 'framework.approve', kind: 'winTheme', id: 'wt-2', note: '' }).data
    expect(d.winThemes.map((w) => w.status)).toEqual(['superseded', 'approved'])
  })

  it('does not let assistant wording suggestions overwrite approved text', () => {
    let d = createDemoProject()
    d = run(d, EDITOR, {
      type: 'suggestion.add',
      suggestions: [{ kind: 'principle_wording', title: 'Tighter wording', body: '', evidence: [], target: { type: 'principle', id: 'gp-1' }, payload: { principleId: 'gp-1', statement: 'New words' }, origin: 'ai', provider: 'test' }],
    }).data
    const sid = d.suggestions[0].id
    expect(() => run(d, EDITOR, { type: 'suggestion.accept', id: sid })).toThrow(/locked/)
    expect(d.principles.find((p) => p.id === 'gp-1')?.statement).not.toBe('New words')
  })
})

describe('Design Driver workflow', () => {
  it('never invents a target: drivers without a target start "not set"', () => {
    const d = createDemoProject()
    const base = structuredClone(d.drivers.find((x) => x.id === 'dd-10')!)
    const { title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds } = base
    const r = run(d, EDITOR, { type: 'driver.create', content: { title: title + ' 2', description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds }, principleIds: ['gp-5'] })
    const created = r.data.drivers.find((x) => x.id === r.createdId)!
    expect(created.measure).toMatchObject({ target: null, targetStatus: 'not_set', current: null })
    expect(created.code).toBe('DD-13')
  })

  it('requires approval, approved target, observed value, evidence and a reviewer to verify', () => {
    const d = createDemoProject()
    // DD-05: under review — cannot verify
    expect(() => run(d, REVIEWER, { type: 'driver.verify', id: 'dd-5', outcome: 'achieved', evidence: 'Long enough evidence description here.', verifiedAt: '2026-10-30' })).toThrow(/approved drivers/)
    // DD-02: approved but not yet measured
    expect(() => run(d, REVIEWER, { type: 'driver.verify', id: 'dd-2', outcome: 'achieved', evidence: 'Long enough evidence description here.', verifiedAt: '2026-10-30' })).toThrow(/observed value/)
    // evidence too short
    expect(() => run(d, REVIEWER, { type: 'driver.verify', id: 'dd-3', outcome: 'achieved', evidence: 'done', verifiedAt: '2026-10-30' })).toThrow(/20\+ characters/)
    // editors cannot verify; reviewers can
    expect(() => run(d, EDITOR, { type: 'driver.verify', id: 'dd-3', outcome: 'achieved', evidence: 'Flow model review at DD 50% shows zero crossings.', verifiedAt: '2026-10-30' })).toThrow(PermissionError)
    const ok = run(d, REVIEWER, { type: 'driver.verify', id: 'dd-3', outcome: 'achieved', evidence: 'Flow model review at DD 50% shows zero crossings.', verifiedAt: '2026-10-30' }).data
    expect(ok.drivers.find((x) => x.id === 'dd-3')).toMatchObject({ performanceStatus: 'verified', verification: { reviewerId: REVIEWER } })
  })

  it('cannot mark a driver verified through a status change', () => {
    const d = createDemoProject()
    expect(() => run(d, EDITOR, { type: 'driver.setPerformance', id: 'dd-3', status: 'verified' })).toThrow(/Invalid input/)
    expect(() => run(d, EDITOR, { type: 'driver.setPerformance', id: 'dd-8', status: 'in_progress' })).toThrow(/final/)
  })

  it('locks commitment fields of approved drivers but allows owner reassignment', () => {
    const d = createDemoProject()
    const dr = d.drivers.find((x) => x.id === 'dd-3')!
    const { title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds } = dr
    const content = { title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId: PEOPLE.sam.id, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds }
    expect(run(d, EDITOR, { type: 'driver.edit', id: 'dd-3', content, note: 'Reassign' }).data.drivers.find((x) => x.id === 'dd-3')?.ownerPersonId).toBe(PEOPLE.sam.id)
    expect(() => run(d, EDITOR, { type: 'driver.edit', id: 'dd-3', content: { ...content, measure: { ...measure, target: '2' } }, note: '' })).toThrow(/locked/)
  })

  it('separates target proposal from target approval', () => {
    let d = createDemoProject()
    d = run(d, EDITOR, { type: 'driver.proposeTarget', id: 'dd-1', baseline: null, target: '72', unit: 'hours', methodology: 'Calc' }).data
    expect(d.drivers.find((x) => x.id === 'dd-1')?.measure.targetStatus).toBe('proposed')
    expect(() => run(d, EDITOR, { type: 'driver.approveTarget', id: 'dd-1' })).toThrow(PermissionError)
    d = run(d, REVIEWER, { type: 'driver.approveTarget', id: 'dd-1' }).data
    expect(d.drivers.find((x) => x.id === 'dd-1')?.measure.targetStatus).toBe('approved')
  })

  it('requires a principle link and a target or criteria before review', () => {
    const d = createDemoProject()
    const unlinked = run(d, EDITOR, { type: 'driver.setPrinciples', id: 'dd-6', principleIds: [] }).data
    expect(() => run(unlinked, EDITOR, { type: 'driver.submit', id: 'dd-6' })).toThrow(/guiding principle/)
    expect(() => run(d, EDITOR, { type: 'driver.submit', id: 'dd-10' })).toThrow(/target or qualitative/)
  })
})

describe('Decision Lab', () => {
  it('requires a complete CBA before recommending', () => {
    const d = createDemoProject()
    expect(() => run(d, EDITOR, { type: 'decision.recommend', id: 'dec-2', alternativeId: 'b2', rationale: 'Modular is better for refresh.' })).toThrow(/incomplete/)
  })

  it('separates recommender and approver, then locks the decision', () => {
    const d = createDemoProject()
    expect(() => run(d, ADMIN, { type: 'decision.approve', id: 'dec-1', alternativeId: 'a3', note: 'Mezzanine instead please' })).toThrow(/mandatory requirement/)
    const approved = run(d, REVIEWER, { type: 'decision.approve', id: 'dec-1', alternativeId: 'a1', note: '' }).data
    expect(approved.decisions.find((x) => x.id === 'dec-1')).toMatchObject({ status: 'approved', approval: { by: REVIEWER } })
    expect(() => run(approved, EDITOR, { type: 'decision.update', id: 'dec-1', patch: { question: 'Changed?' }, note: '' })).toThrow(/locked/)
    const reopened = run(approved, REVIEWER, { type: 'decision.reopen', id: 'dec-1', note: 'New site constraint' }).data
    expect(reopened.decisions.find((x) => x.id === 'dec-1')?.status).toBe('evaluating')
  })

  it('withdraws a recommendation when the evaluation changes', () => {
    const d = createDemoProject()
    const dec = d.decisions.find((x) => x.id === 'dec-1')!
    const factors = structuredClone(dec.factors)
    factors[1].advantages.a2.importance = 80
    const r = run(d, EDITOR, { type: 'decision.update', id: 'dec-1', patch: { factors }, note: 'Re-judged' }).data
    expect(r.decisions.find((x) => x.id === 'dec-1')).toMatchObject({ status: 'evaluating', recommendation: null })
  })

  it('requires a rationale when the approver departs from the recommendation', () => {
    const d = createDemoProject()
    expect(() => run(d, REVIEWER, { type: 'decision.approve', id: 'dec-1', alternativeId: 'a2', note: '' })).toThrow(/differs/)
  })
})

describe('membership', () => {
  it('keeps at least one administrator', () => {
    const d = createDemoProject()
    expect(() => run(d, ADMIN, { type: 'member.setRole', personId: ADMIN, role: 'editor' })).toThrow(/at least one administrator/)
  })
})
