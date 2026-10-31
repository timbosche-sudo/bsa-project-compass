import { FileDown, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { formatDate } from '@/components/Collaboration'
import { Dialog } from '@/components/Dialog'
import { ApprovalBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { Button, Callout, Field, IconButton, Input, optionsFrom, Select, Textarea } from '@/components/ui'
import { CATEGORY_LABELS } from '@/domain/labels'
import { can as roleCan, roleFor } from '@/domain/permissions'
import type { GuidingPrinciple, PrincipleCategory, PrincipleContent, WinTheme, WorkshopAttendee, WorkshopSession } from '@/domain/types'
import { wordingOf } from '@/domain/wording'
import { ALIGNMENT_STATUS_LABELS } from '@/domain/labels'
import { meetingSummary, type FrameworkKind } from '@/domain/workshop'

// ---------------------------------------------------------------------------
// Record Owner approval of the exact wording
// ---------------------------------------------------------------------------

export function ApproveDialog({ open, onOpenChange, kind, item, session }: { open: boolean; onOpenChange: (o: boolean) => void; kind: FrameworkKind; item: WinTheme | GuidingPrinciple; session: WorkshopSession | null }) {
  const { data, run, can, pending } = useProject()
  const { actor } = useSession()
  const approvers = data.project.members.filter((m) => roleCan(m.role, 'framework.approve')).map((m) => data.people.find((p) => p.id === m.personId)!).filter(Boolean)
  const accountable = 'accountableApproverId' in item ? item.accountableApproverId : null
  const [approverId, setApproverId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [note, setNote] = useState('')
  const wording = wordingOf(item)
  useEffect(() => {
    if (open) {
      setApproverId(accountable ?? approvers.find((p) => p.organization === data.project.owner.name)?.id ?? approvers[0]?.id ?? '')
      setConfirmed(false)
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selfApproval = approverId === actor?.id && can('framework.approve')
  const needsSession = !selfApproval && !session
  const notPermitted = !selfApproval && !can('workshop.facilitate')
  const submit = async () => {
    if (item.status !== 'in_review') {
      if ((await run({ type: 'framework.setReviewStatus', kind, id: item.id, status: 'in_review' })) === undefined) return
    }
    const ok = await run(
      { type: 'framework.approve', kind, id: item.id, note, expectedWording: wording, ...(selfApproval ? {} : { onBehalfOf: approverId }), sessionId: session?.id },
      `${item.code} adopted — approved wording recorded`,
    )
    if (ok !== undefined) onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Record approval of ${item.code}`}
      description="The exact wording below is frozen as the adopted text, with the approver, the person recording it, the time and the workshop session."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" icon={<ShieldCheck className="size-4" />} loading={pending} disabled={!confirmed || !approverId || needsSession || notPermitted} onClick={submit}>
            Record approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <figure className="rounded-lg border-2 border-ok/40 bg-ok-soft/40 p-4">
          <figcaption className="eyebrow mb-2">Exact wording to be adopted</figcaption>
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{wording}</div>
        </figure>
        {notPermitted && <Callout tone="warn">Your role cannot record approvals on someone else's behalf.</Callout>}
        {needsSession && !notPermitted && <Callout tone="warn" title="Start the workshop session first">Approvals given in the room are recorded against a live session. Start the session from the top bar, then record the approval.</Callout>}
        <Field label="Approved by" hint={accountable ? 'This principle has an accountable approver.' : 'People who hold an approval role on this project.'}>
          {(id) => <Select id={id} value={approverId} disabled={!!accountable} onChange={(e) => setApproverId(e.target.value)} options={approvers.map((p) => ({ value: p.id, label: `${p.name} — ${p.organization}` }))} />}
        </Field>
        <Field label="Note (optional)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved by consensus of the steering group" maxLength={500} />}</Field>
        <label className="flex items-start gap-3 rounded-md border border-line p-3 text-[13.5px]">
          <input type="checkbox" className="mt-0.5 accent-[var(--c-accent)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            I confirm that <strong>{data.people.find((p) => p.id === approverId)?.name ?? 'the approver'}</strong> approved this exact wording.
            <span className="block text-[12px] text-muted">After approval the wording is locked. Later edits create a new proposed revision; this approved wording stays on record.</span>
          </span>
        </label>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Merge principles
// ---------------------------------------------------------------------------

export function MergeDialog({ open, onOpenChange, into, onMerged }: { open: boolean; onOpenChange: (o: boolean) => void; into: GuidingPrinciple; onMerged?: () => void }) {
  const { data, run, pending } = useProject()
  const candidates = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => p.id !== into.id && p.status !== 'superseded')
  const [ids, setIds] = useState<string[]>([])
  const [content, setContent] = useState<PrincipleContent>({ title: '', statement: '', intent: '', category: into.category })
  useEffect(() => {
    if (open) {
      setIds([])
      setContent({ title: into.title, statement: into.statement, intent: into.intent, category: into.category })
    }
  }, [open, into])
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    setIds(next)
    const merged = [into, ...candidates.filter((c) => next.includes(c.id))]
    setContent((c) => ({ ...c, intent: merged.map((m) => m.intent).filter(Boolean).join('\n\n') }))
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`Merge principles into ${into.code}`}
      description="Evidence, Design Drivers and decisions move to the combined principle. Merged principles are kept as superseded and can be reinstated."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={ids.length === 0 || !content.title.trim() || !content.statement.trim()}
            onClick={async () => {
              if ((await run({ type: 'principle.merge', intoId: into.id, fromIds: ids, content }, 'Principles merged')) !== undefined) {
                onOpenChange(false)
                onMerged?.()
              }
            }}
          >
            Merge {ids.length || ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="eyebrow mb-2">Merge these into {into.code}</div>
          <ul className="divide-y divide-line rounded-md border border-line">
            {candidates.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-sunken">
                  <input type="checkbox" className="mt-1 accent-[var(--c-accent)]" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Merge ${p.code}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted">{p.code}</span>
                      <span className="font-medium">{p.title}</span>
                      <ApprovalBadge status={p.status} />
                    </span>
                    <span className="line-clamp-2 text-[12.5px] text-muted">{p.statement}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {into.status === 'approved' && <p className="mt-2 text-[12px] text-warn">{into.code} is approved: merging opens a proposed revision. Its approved wording stays on record.</p>}
        </div>
        <div className="space-y-4">
          <div className="eyebrow">Combined wording</div>
          <Field label="Title" required>{(id) => <Input id={id} value={content.title} onChange={(e) => setContent({ ...content, title: e.target.value })} />}</Field>
          <Field label="Statement" required>{(id) => <Textarea id={id} rows={3} value={content.statement} onChange={(e) => setContent({ ...content, statement: e.target.value })} />}</Field>
          <Field label="Intent">{(id) => <Textarea id={id} rows={5} value={content.intent} onChange={(e) => setContent({ ...content, intent: e.target.value })} />}</Field>
          <Field label="Category">{(id) => <Select id={id} value={content.category} onChange={(e) => setContent({ ...content, category: e.target.value as PrincipleCategory })} options={optionsFrom(CATEGORY_LABELS)} />}</Field>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Session setup
// ---------------------------------------------------------------------------

export function SessionDialog({ open, onOpenChange, session, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; session?: WorkshopSession; onCreated?: (id: string) => void }) {
  const { data, run, pending } = useProject()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [attendees, setAttendees] = useState<WorkshopAttendee[]>([])
  useEffect(() => {
    if (!open) return
    setTitle(session?.title ?? 'Owner Alignment Workshop')
    setDate(session?.date ?? new Date().toISOString().slice(0, 10))
    setAttendees(session?.attendees ?? data.project.members.map((m) => data.people.find((p) => p.id === m.personId)!).filter((p) => p && roleFor(data.project, p.id) !== 'viewer').map((p) => ({ name: p.name, organization: p.organization, role: p.title })))
  }, [open, session, data])
  const save = async () => {
    const list = attendees.filter((a) => a.name.trim())
    if (session) {
      if ((await run({ type: 'workshop.update', id: session.id, patch: { title, date, attendees: list } }, 'Session updated')) !== undefined) onOpenChange(false)
    } else {
      const id = await run({ type: 'workshop.create', title, date, attendees: list }, 'Session planned')
      if (id) {
        onOpenChange(false)
        onCreated?.(id)
      }
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={session ? `Edit ${session.code}` : 'Plan a workshop session'}
      description="Use fictional names in demo mode."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!title.trim() || !date} onClick={save}>
            Save session
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Title" required>{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label="Date" required>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink-2">Attendees</span>
            <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAttendees([...attendees, { name: '', organization: '', role: '' }])}>
              Add attendee
            </Button>
          </div>
          <ul className="space-y-2">
            {attendees.map((a, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                {(['name', 'organization', 'role'] as const).map((k) => (
                  <Input key={k} aria-label={`Attendee ${i + 1} ${k}`} placeholder={k[0].toUpperCase() + k.slice(1)} value={a[k]} onChange={(e) => setAttendees(attendees.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                ))}
                <IconButton label={`Remove attendee ${i + 1}`} onClick={() => setAttendees(attendees.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Meeting summary
// ---------------------------------------------------------------------------

export function SummaryDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (o: boolean) => void; session: WorkshopSession }) {
  const { data, personName } = useProject()
  const notify = useToast()
  const s = useMemo(() => (open ? meetingSummary(data, session.id) : null), [open, data, session.id])
  const [busy, setBusy] = useState(false)
  if (!s) return null
  const download = async (format: 'pdf' | 'docx' = 'pdf') => {
    setBusy(true)
    try {
      const x = await import('@/exporters/workshopPdf')
      await (format === 'pdf' ? x.meetingSummaryPdf : x.meetingSummaryDocx)(data, session.id)
      notify('ok', 'Meeting summary downloaded')
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const List = ({ title, items, empty }: { title: string; items: { code: string; title: string; note?: string }[]; empty: string }) => (
    <section>
      <h3 className="eyebrow mb-2">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.code} className="text-[13.5px]">
              <span className="font-mono text-[11.5px] text-muted">{i.code}</span> {i.title}
              {i.note && <span className="block pl-12 text-[12.5px] text-ink-2">Note: {i.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`Meeting summary — ${session.code} ${session.title}`}
      description={`Generated from the recorded session${s.draft ? ' · DRAFT until the session is ended' : ''}. Review before distribution.`}
      footer={
        <>
          <Button icon={<FileDown className="size-4" />} disabled={busy} onClick={() => download('docx')}>
            Download Word (editable)
          </Button>
          <Button variant="primary" icon={<FileDown className="size-4" />} loading={busy} onClick={() => download('pdf')}>
            Download PDF
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 text-[13px] sm:grid-cols-3">
          <div>
            <div className="eyebrow">Date</div>
            {formatDate(session.date)}
          </div>
          <div>
            <div className="eyebrow">Facilitator</div>
            {personName(session.facilitatorId)}
          </div>
          <div>
            <div className="eyebrow">Recorded changes</div>
            {s.changeCount}
          </div>
        </div>
        <section>
          <h3 className="eyebrow mb-2">Attendees</h3>
          <p className="text-[13px] text-ink-2">{session.attendees.map((a) => `${a.name}${a.organization ? ` (${a.organization})` : ''}`).join(' · ') || 'None recorded'}</p>
        </section>
        <section>
          <h3 className="eyebrow mb-2">Owner responses ({s.alignment.length})</h3>
          {s.alignment.length === 0 ? (
            <p className="text-[13px] text-muted">No Owner responses were recorded in this session.</p>
          ) : (
            <ul className="space-y-2">
              {s.alignment.map((a) => (
                <li key={a.code} className="text-[13.5px]">
                  <span className="font-mono text-[11.5px] text-muted">{a.code}</span> {a.title} — <strong>{ALIGNMENT_STATUS_LABELS[a.status]}</strong>
                  {a.refinements && <span className="block pl-12 text-[12.5px] text-ink-2">Refinements: {a.refinements}</span>}
                  {a.questions && <span className="block pl-12 text-[12.5px] text-muted">Question: {a.questions}</span>}
                </li>
              ))}
            </ul>
          )}
          {s.notReviewed.length > 0 && <p className="mt-2 text-[12.5px] text-muted">Not yet reviewed: {s.notReviewed.map((n) => n.code).join(', ')}. These are not treated as aligned.</p>}
        </section>
        <section>
          <h3 className="eyebrow mb-2">Adopted — exact approved wording ({s.adopted.length})</h3>
          {s.adopted.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing was approved in this session.</p>
          ) : (
            <ul className="space-y-3">
              {s.adopted.map((a) => (
                <li key={a.code} className="rounded-md border border-ok/40 bg-ok-soft/40 p-3">
                  <div className="text-[12px] text-ok">
                    <span className="font-mono">{a.code}</span> · approved by {a.approvedBy}
                    {a.recordedBy && ` (recorded by ${a.recordedBy})`} · {formatDate(a.approvedAt, true)} · v{a.version}
                  </div>
                  <p className="mt-1 text-[13.5px] whitespace-pre-wrap text-ink">{a.wording}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="grid gap-6 md:grid-cols-2">
          <List title="Needs refinement" items={s.needsRefinement} empty="None." />
          <List title="Still in discussion" items={[...s.discussing, ...s.proposed]} empty="None." />
          <List title="Not adopted" items={s.notAdopted} empty="None." />
          <List title="Added during the session" items={s.created} empty="None." />
        </div>
        {s.wordingChanges.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2">Wording changes ({s.wordingChanges.length})</h3>
            <ul className="space-y-3">
              {s.wordingChanges.map((w) => (
                <li key={w.code} className="grid gap-2 text-[12.5px] md:grid-cols-2">
                  <div className="rounded-md bg-sunken p-2.5">
                    <div className="eyebrow mb-1">{w.code} before</div>
                    <p className="whitespace-pre-wrap text-muted">{w.before}</p>
                  </div>
                  <div className="rounded-md border border-line p-2.5">
                    <div className="eyebrow mb-1">{w.code} after</div>
                    <p className="whitespace-pre-wrap">{w.after}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(s.merges.length > 0 || s.deleted.length > 0) && (
          <section className="text-[13px]">
            <h3 className="eyebrow mb-2">Structural changes</h3>
            <ul className="list-disc space-y-1 pl-5">
              {s.merges.map((m) => (
                <li key={m}>{m}</li>
              ))}
              {s.deleted.map((d) => (
                <li key={d.code}>
                  Deleted {d.code} {d.title}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="eyebrow mb-2">Action items ({session.actions.length})</h3>
          {session.actions.length === 0 ? (
            <p className="text-[13px] text-muted">None recorded.</p>
          ) : (
            <ul className="space-y-1 text-[13.5px]">
              {session.actions.map((a) => (
                <li key={a.id}>
                  {a.done ? '☑' : '☐'} {a.text}
                  {a.owner && <span className="text-muted"> — {a.owner}</span>}
                  {a.due && <span className="text-muted"> · due {formatDate(a.due)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        {session.generalNotes && (
          <section>
            <h3 className="eyebrow mb-2">Notes</h3>
            <p className="text-[13.5px] whitespace-pre-wrap">{session.generalNotes}</p>
          </section>
        )}
      </div>
    </Dialog>
  )
}
