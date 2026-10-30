import { isActiveFramework, wordingOf } from './wording'
import type { ApprovalStatus, GuidingPrinciple, ID, ProjectData, WinTheme, WorkshopSession } from './types'

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
  }
}
