import { alignmentItems } from './alignment'
import { isActiveFramework, wordingOf } from './wording'
import type { AlignmentStatus, ApprovalStatus, GuidingPrinciple, ID, ProjectData, WinTheme, WorkshopSession } from './types'

export type FrameworkKind = 'winTheme' | 'principle'
export type FrameworkItem = (WinTheme & { kind: 'winTheme' }) | (GuidingPrinciple & { kind: 'principle' })

export const itemKey = (kind: FrameworkKind, id: ID) => `${kind}:${id}`

export function frameworkItems(data: ProjectData, opts: { includeInactive?: boolean } = {}): FrameworkItem[] {
  const keep = (s: ApprovalStatus) => opts.includeInactive || isActiveFramework(s)
  return [
    ...data.winThemes.filter((w) => keep(w.status)).map((w) => ({ ...w, kind: 'winTheme' as const })),
    ...[...data.principles].sort((a, b) => a.order - b.order).filter((p) => keep(p.status)).map((p) => ({ ...p, kind: 'principle' as const })),
  ]
}

export function itemTitle(i: FrameworkItem): string {
  return i.kind === 'principle' ? i.title : i.statement
}

export function liveSession(data: ProjectData): WorkshopSession | null {
  return data.workshops.find((w) => w.status === 'live') ?? null
}

export interface SummaryItem {
  kind: FrameworkKind
  id: ID
  code: string
  title: string
  status: ApprovalStatus
  wording: string
  note: string
}

export interface AdoptedItem extends SummaryItem {
  approvedBy: string
  recordedBy: string | null
  approvedAt: string
  version: number
}

export interface WordingChange {
  kind: FrameworkKind
  code: string
  before: string
  after: string
}

export interface MeetingSummary {
  session: WorkshopSession
  draft: boolean
  window: { from: string; to: string }
  adopted: AdoptedItem[]
  discussing: SummaryItem[]
  needsRefinement: SummaryItem[]
  notAdopted: SummaryItem[]
  proposed: SummaryItem[]
  created: SummaryItem[]
  deleted: { code: string; title: string }[]
  merges: string[]
  wordingChanges: WordingChange[]
  changeCount: number
  /** Owner responses recorded in this session, in presentation order. */
  alignment: AlignmentEntry[]
  /** Items presented for alignment with no response recorded in this session. Silence is not alignment. */
  notReviewed: { code: string; title: string }[]
  direction: {
    vision: { code: string; statement: string; narrative: string; status: ApprovalStatus } | null
    principles: { code: string; title: string; statement: string; status: AlignmentStatus }[]
    opportunities: { code: string; title: string; principles: string[] }[]
    outcomesToValidate: { code: string; statement: string; principle: string }[]
  }
  strategicQuestions: string[]
}

export interface AlignmentEntry {
  code: string
  title: string
  status: AlignmentStatus
  feedback: string
  refinements: string
  questions: string
  ownerComments: string
}

/**
 * Builds a meeting summary from recorded data only: session timing, approval
 * records, version history, the session log and facilitator notes.
 */
export function meetingSummary(data: ProjectData, sessionId: ID, now = new Date().toISOString()): MeetingSummary {
  const session = data.workshops.find((w) => w.id === sessionId)
  if (!session) throw new Error('Workshop session not found.')
  const from = session.startedAt ?? `${session.date}T00:00:00.000Z`
  const to = session.endedAt ?? now
  const inWindow = (at: string) => at >= from && at <= to
  const person = (id: string | null | undefined) => (id ? (data.people.find((p) => p.id === id)?.name ?? 'Unknown') : null)

  const items = frameworkItems(data, { includeInactive: true })
  const toItem = (i: FrameworkItem): SummaryItem => ({
    kind: i.kind,
    id: i.id,
    code: i.code,
    title: itemTitle(i),
    status: i.status,
    wording: wordingOf(i),
    note: session.notes[itemKey(i.kind, i.id)] ?? '',
  })

  const adopted: AdoptedItem[] = items
    .filter((i) => i.approval && (i.approval.sessionId === session.id || (!i.approval.sessionId && inWindow(i.approval.approvedAt))))
    .map((i) => ({
      ...toItem(i),
      wording: i.approval!.wording ?? wordingOf(i.versions.find((v) => v.version === i.approval!.version)?.snapshot ?? i),
      approvedBy: person(i.approval!.approvedBy) ?? 'Unknown',
      recordedBy: i.approval!.recordedBy && i.approval!.recordedBy !== i.approval!.approvedBy ? person(i.approval!.recordedBy) : null,
      approvedAt: i.approval!.approvedAt,
      version: i.approval!.version,
    }))

  const touched = items.filter((i) => i.versions.some((v) => inWindow(v.changedAt)))
  const wordingChanges: WordingChange[] = []
  const created: SummaryItem[] = []
  for (const i of touched) {
    const before = [...i.versions].filter((v) => v.changedAt < from).at(-1)
    const after = [...i.versions].filter((v) => inWindow(v.changedAt)).at(-1)!
    if (!before) {
      created.push(toItem(i))
      continue
    }
    const b = wordingOf(before.snapshot as never)
    const a = wordingOf(after.snapshot as never)
    if (a !== b) wordingChanges.push({ kind: i.kind, code: i.code, before: b, after: a })
  }

  const byStatus = (s: ApprovalStatus) => items.filter((i) => i.status === s && (touched.includes(i) || session.notes[itemKey(i.kind, i.id)])).map(toItem)

  return {
    session,
    draft: session.status !== 'closed',
    window: { from, to },
    adopted,
    discussing: byStatus('in_review'),
    needsRefinement: byStatus('needs_refinement'),
    notAdopted: byStatus('not_adopted'),
    proposed: byStatus('proposed'),
    created,
    deleted: data.trash.filter((t) => inWindow(t.deletedAt)).map((t) => ({ code: t.entity.code, title: 'title' in t.entity ? t.entity.title : t.entity.statement })),
    merges: session.log.filter((l) => l.action === 'principle.merge').map((l) => l.summary),
    wordingChanges,
    changeCount: session.log.length,
    ...alignmentSummary(data, session),
  }
}

function alignmentSummary(data: ProjectData, session: WorkshopSession) {
  const items = alignmentItems(data)
  const inSession = (type: string, id: ID) => data.alignment.find((r) => r.sessionId === session.id && r.target.type === type && r.target.id === id)
  const alignment: AlignmentEntry[] = []
  const notReviewed: { code: string; title: string }[] = []
  for (const i of items) {
    const r = inSession(i.type, i.id)
    if (!r || r.status === 'not_reviewed') notReviewed.push({ code: i.code, title: i.title })
    else alignment.push({ code: i.code, title: i.title, status: r.status, feedback: r.feedback, refinements: r.refinements, questions: r.questions, ownerComments: r.ownerComments })
  }
  const vision =
    data.winThemes.find((w) => w.status === 'approved') ??
    data.winThemes.find((w) => isActiveFramework(w.status) && w.status !== 'not_adopted' && ['aligned', 'aligned_with_refinements'].includes(inSession('winTheme', w.id)?.status ?? '')) ??
    data.winThemes.find((w) => w.status === 'in_review') ??
    data.winThemes.find((w) => isActiveFramework(w.status) && w.status !== 'not_adopted') ??
    null
  const principles = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => isActiveFramework(p.status) && p.status !== 'not_adopted')
  const code = (pid: ID) => data.principles.find((p) => p.id === pid)?.code ?? ''
  const strategicQuestions = [
    ...alignment.filter((a) => a.questions.trim()).map((a) => `${a.code}: ${a.questions.trim()}`),
    ...data.questions.filter((q) => q.status === 'open').map((q) => q.question),
  ]
  return {
    alignment,
    notReviewed,
    direction: {
      vision: vision ? { code: vision.code, statement: vision.statement, narrative: vision.narrative, status: vision.status } : null,
      principles: principles.map((p) => ({ code: p.code, title: p.title, statement: p.statement, status: inSession('principle', p.id)?.status ?? 'not_reviewed' })),
      opportunities: data.opportunities.filter((o) => o.inPresentation).sort((a, b) => a.order - b.order).map((o) => ({ code: o.code, title: o.title, principles: o.principleIds.map(code).filter(Boolean) })),
      outcomesToValidate: data.outcomes
        .filter((o) => o.inPresentation && o.state !== 'validated_with_owner')
        .sort((a, b) => a.order - b.order)
        .map((o) => ({ code: o.code, statement: o.statement, principle: code(o.principleId) })),
    },
    strategicQuestions,
  }
}
