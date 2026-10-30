import { ArrowDown, ArrowUp, CheckCircle2, GitBranch, Lock, MessageSquare, Pencil, Plus, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { CommentThread, formatDate, VersionHistory } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { EvidencePanel } from '@/components/Evidence'
import { ApprovalBadge, DriverStatusBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, Card, CardHeader, cx, EmptyState, Field, Input, KeyValue, optionsFrom, PageHeader, Select, Tabs, Textarea } from '@/components/ui'
import { driverStatus, principleDriverIds } from '@/domain/drivers'
import { CATEGORY_LABELS } from '@/domain/labels'
import { evidenceFor, isOwnerEvidence, isWorkshopEvidence } from '@/domain/traceability'
import type { GuidingPrinciple, PrincipleCategory, PrincipleContent, WinTheme } from '@/domain/types'

export default function VisionPage() {
  const { data } = useProject()
  const t = data.project.terminology
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Layers one and two"
        title="Vision & Principles"
        description={`The ${t.winTheme} communicates why the project matters. ${t.guidingPrinciple}s define what success must look like. Approved text is locked: neither edits nor the assistant can silently change it.`}
      />
      <WinThemes />
      <Principles />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Win Themes
// ---------------------------------------------------------------------------

function useGovernance(kind: 'winTheme' | 'principle') {
  const { run } = useProject()
  const confirm = useConfirm()
  return {
    submit: (id: string, code: string) => run({ type: 'framework.submit', kind, id }, `${code} submitted for review`),
    approve: async (id: string, code: string, text: string) => {
      const r = await confirm({
        title: `Approve ${code}?`,
        body: (
          <div className="space-y-2">
            <p>This records a formal approval in your name. The approved text becomes locked against silent modification.</p>
            <blockquote className="border-l-2 border-ink pl-3 text-ink">{text}</blockquote>
            {kind === 'winTheme' && <p className="text-muted">Any previously approved Win Theme will be superseded.</p>}
          </div>
        ),
        confirmLabel: 'Approve',
        requireNote: { label: 'Approval note (e.g. meeting or authority)', minLength: 0 },
      })
      if (r.confirmed) await run({ type: 'framework.approve', kind, id, note: r.note }, `${code} approved`)
    },
    openRevision: async (id: string, code: string) => {
      const r = await confirm({ title: `Open a revision of ${code}?`, body: 'The approved version stays in history. The item returns to Proposed and needs re-approval.', confirmLabel: 'Open revision' })
      if (r.confirmed) await run({ type: 'framework.openRevision', kind, id }, `Revision opened for ${code}`)
    },
    supersede: async (id: string, code: string) => {
      const r = await confirm({ title: `Supersede ${code}?`, body: 'Superseded items remain in history but are no longer active.', confirmLabel: 'Supersede', tone: 'danger', requireNote: { label: 'Reason', minLength: 5 } })
      if (r.confirmed) await run({ type: 'framework.supersede', kind, id, note: r.note }, `${code} superseded`)
    },
    restore: (id: string, version: number) => run({ type: 'framework.restore', kind, id, version }, `Restored v${version} content`),
  }
}

function WinThemes() {
  const { data, can } = useProject()
  const [editing, setEditing] = useState<WinTheme | 'new' | null>(null)
  const [showSuperseded, setShowSuperseded] = useState(false)
  const t = data.project.terminology
  const items = data.winThemes.filter((w) => showSuperseded || w.status !== 'superseded')
  return (
    <section aria-labelledby="wt">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Layer one</div>
          <h2 id="wt" className="text-[20px] font-semibold tracking-tight">
            {t.winTheme} alternatives
          </h2>
          <p className="text-[13px] text-muted">Compare candidate narratives side by side. Inspirational, concise, and traceable to evidence.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            <input type="checkbox" className="accent-[var(--c-accent)]" checked={showSuperseded} onChange={(e) => setShowSuperseded(e.target.checked)} /> Show superseded
          </label>
          {can('framework.edit') && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              New alternative
            </Button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title={`No ${t.winTheme} yet`}>Draft one or more alternatives grounded in stakeholder and Owner evidence.</EmptyState>
      ) : (
        <div className={cx('grid gap-4', items.length > 1 && 'lg:grid-cols-2', items.length > 2 && '2xl:grid-cols-3')}>
          {items.map((w) => (
            <WinThemeCard key={w.id} w={w} onEdit={() => setEditing(w)} />
          ))}
        </div>
      )}
      <WinThemeDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} winTheme={editing === 'new' ? undefined : (editing ?? undefined)} />
    </section>
  )
}

function WinThemeCard({ w, onEdit }: { w: WinTheme; onEdit: () => void }) {
  const { data, can, personName } = useProject()
  const gov = useGovernance('winTheme')
  const [tab, setTab] = useState<'evidence' | 'comments' | 'history'>('evidence')
  const evidence = evidenceFor(data, { type: 'winTheme', id: w.id }).all
  const comments = data.comments.filter((c) => c.target.type === 'winTheme' && c.target.id === w.id && !c.resolved).length
  const locked = w.status === 'approved'
  return (
    <Card className={cx(w.status === 'approved' && 'border-ok/50', w.status === 'superseded' && 'opacity-60')}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="code-tag">
            {w.code} · v{w.version}
          </span>
          <ApprovalBadge status={w.status} />
          {locked && (
            <Badge tone="ok">
              <Lock className="size-3" /> Locked
            </Badge>
          )}
          <Badge tone={evidence.length ? 'outline' : 'warn'}>{evidence.length} evidence statement(s)</Badge>
        </div>
        <p className="mt-3 text-[26px] leading-[1.1] font-semibold tracking-[-0.025em]">{w.statement}</p>
        {w.narrative && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{w.narrative}</p>}
        {w.approval && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ok">
            <CheckCircle2 className="size-3.5" /> Approved v{w.approval.version} by {personName(w.approval.approvedBy)} · {formatDate(w.approval.approvedAt)}
            {w.approval.note && ` — ${w.approval.note}`}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {can('framework.edit') && !locked && w.status !== 'superseded' && (
            <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {can('framework.edit') && w.status === 'proposed' && (
            <Button size="sm" icon={<Send className="size-3.5" />} onClick={() => gov.submit(w.id, w.code)}>
              Submit for review
            </Button>
          )}
          {can('framework.approve') && w.status === 'in_review' && (
            <Button size="sm" variant="primary" icon={<ShieldCheck className="size-3.5" />} onClick={() => gov.approve(w.id, w.code, w.statement)}>
              Approve
            </Button>
          )}
          {can('framework.edit') && locked && (
            <Button size="sm" icon={<GitBranch className="size-3.5" />} onClick={() => gov.openRevision(w.id, w.code)}>
              Open revision
            </Button>
          )}
          {can('framework.approve') && w.status !== 'superseded' && w.status !== 'approved' && (
            <Button size="sm" variant="ghost" onClick={() => gov.supersede(w.id, w.code)}>
              Supersede
            </Button>
          )}
        </div>
      </div>
      <div className="border-t border-line px-5">
        <Tabs
          label={`${w.code} details`}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'evidence', label: 'Evidence', count: evidence.length },
            { value: 'comments', label: 'Comments', count: comments },
            { value: 'history', label: 'History', count: w.versions.length },
          ]}
        />
        <div className="py-4">
          {tab === 'evidence' && <EvidencePanel target={{ type: 'winTheme', id: w.id }} allowLink={!locked} />}
          {tab === 'comments' && <CommentThread target={{ type: 'winTheme', id: w.id }} />}
          {tab === 'history' && (
            <VersionHistory
              versions={w.versions}
              current={w.version}
              approvedVersion={w.approval?.version}
              canRestore={can('framework.edit') && !locked && w.status !== 'superseded'}
              onRestore={(v) => gov.restore(w.id, v)}
              render={(s) => (
                <>
                  <p className="font-semibold">{s.statement}</p>
                  <p className="mt-1 text-muted">{s.narrative}</p>
                </>
              )}
            />
          )}
        </div>
      </div>
    </Card>
  )
}

function WinThemeDialog({ open, onOpenChange, winTheme }: { open: boolean; onOpenChange: (o: boolean) => void; winTheme?: WinTheme }) {
  const { run, pending } = useProject()
  const [statement, setStatement] = useState('')
  const [narrative, setNarrative] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setStatement(winTheme?.statement ?? '')
      setNarrative(winTheme?.narrative ?? '')
      setNote('')
    }
  }, [open, winTheme])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={winTheme ? `Edit ${winTheme.code}` : 'New Win Theme alternative'}
      description="Each save creates a new version. Keep it concise, memorable and mission-aligned."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!statement.trim()}
            onClick={async () => {
              const ok = winTheme
                ? await run({ type: 'winTheme.edit', id: winTheme.id, content: { statement, narrative }, note }, 'New version saved')
                : await run({ type: 'winTheme.create', content: { statement, narrative } }, 'Alternative created')
              if (ok !== undefined) onOpenChange(false)
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Win Theme statement" required hint={`${statement.length}/200 · aim for a line people can repeat from memory`}>
          {(id) => <Input id={id} value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={200} className="text-[16px] font-semibold" />}
        </Field>
        <Field label="Narrative">
          {(id) => <Textarea id={id} value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} />}
        </Field>
        {winTheme && (
          <Field label="Change note">
            {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Guiding Principles
// ---------------------------------------------------------------------------

function Principles() {
  const { data, can, run } = useProject()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const t = data.project.terminology
  const list = [...data.principles].sort((a, b) => a.order - b.order)
  const active = list.filter((p) => p.status !== 'superseded')
  const selectedId = params.get('principle') ?? active[0]?.id
  const selected = data.principles.find((p) => p.id === selectedId)

  useEffect(() => {
    if (params.get('principle')) document.getElementById('principles')?.scrollIntoView({ block: 'start' })
  }, [params])

  const move = (id: string, dir: -1 | 1) => {
    const ids = active.map((p) => p.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    run({ type: 'principle.reorder', orderedIds: ids })
  }

  return (
    <section id="principles" aria-labelledby="gp" className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Layer two</div>
          <h2 id="gp" className="text-[20px] font-semibold tracking-tight">
            {t.guidingPrinciple}s
          </h2>
          <p className="text-[13px] text-muted">
            Durable commitments for design and delivery. Typically four to seven — {active.length} active.
          </p>
        </div>
        {can('framework.edit') && (
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New principle
          </Button>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card as="div">
            <ul className="divide-y divide-line" aria-label={`${t.guidingPrinciple}s`}>
              {list.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">No principles yet.</li>}
              {list.map((p) => {
                const isActive = p.status !== 'superseded'
                return (
                  <li key={p.id} className={cx('flex items-stretch', p.id === selectedId && 'bg-sunken', !isActive && 'opacity-55')}>
                    <button className="min-w-0 flex-1 px-4 py-3 text-left" aria-current={p.id === selectedId} onClick={() => setParams({ principle: p.id })}>
                      <div className="flex items-center gap-2">
                        <span className="code-tag">{p.code}</span>
                        <ApprovalBadge status={p.status} />
                      </div>
                      <div className="mt-1 text-[14.5px] font-semibold tracking-tight text-ink">{p.title}</div>
                      <div className="text-[11.5px] text-muted">
                        {CATEGORY_LABELS[p.category]} · {principleDriverIds(data, p.id).length} drivers
                      </div>
                    </button>
                    {can('framework.edit') && isActive && (
                      <div className="flex flex-col justify-center pr-2">
                        <button aria-label={`Move ${p.code} up`} className="rounded p-1 text-faint hover:bg-surface hover:text-ink" onClick={() => move(p.id, -1)}>
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button aria-label={`Move ${p.code} down`} className="rounded p-1 text-faint hover:bg-surface hover:text-ink" onClick={() => move(p.id, 1)}>
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
          <CoverageTable />
        </div>
        {selected ? <PrincipleDetail p={selected} /> : <EmptyState title="Select a principle" />}
      </div>
      <PrincipleDialog open={creating} onOpenChange={setCreating} />
    </section>
  )
}

function CoverageTable() {
  const { data } = useProject()
  const rows = data.principles
    .filter((p) => p.status !== 'superseded')
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const e = evidenceFor(data, { type: 'principle', id: p.id })
      return { p, total: e.all.length, owner: e.all.filter((s) => isOwnerEvidence(data, s)).length, workshop: e.all.filter((s) => isWorkshopEvidence(data, s)).length, drivers: principleDriverIds(data, p.id).length }
    })
  return (
    <Card>
      <CardHeader title="Evidence coverage" description="Owner = RFP, mission, regulation or stated requirement." />
      <div className="overflow-x-auto scroll-thin">
      <table className="table-base">
        <thead>
          <tr>
            <th>Principle</th>
            <th className="text-right">Evidence</th>
            <th className="text-right">Owner</th>
            <th className="text-right">Workshop</th>
            <th className="text-right">Drivers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, total, owner, workshop, drivers }) => (
            <tr key={p.id}>
              <td className="font-mono text-[11.5px]">{p.code}</td>
              <td className={cx('text-right tabular-nums', total === 0 && 'font-semibold text-danger')}>{total}</td>
              <td className={cx('text-right tabular-nums', owner === 0 && 'text-warn')}>{owner}</td>
              <td className="text-right tabular-nums">{workshop}</td>
              <td className={cx('text-right tabular-nums', drivers === 0 && 'text-warn')}>{drivers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  )
}

function PrincipleDetail({ p }: { p: GuidingPrinciple }) {
  const { data, can, run, personName } = useProject()
  const gov = useGovernance('principle')
  const [tab, setTab] = useState<'evidence' | 'drivers' | 'comments' | 'history'>('evidence')
  const [editing, setEditing] = useState(false)
  const locked = p.status === 'approved'
  const driverIds = principleDriverIds(data, p.id)
  const drivers = data.drivers.filter((d) => driverIds.includes(d.id))
  const measurable = drivers.filter((d) => d.measure.target || d.measure.acceptanceCriteria).length
  const comments = data.comments.filter((c) => c.target.type === 'principle' && c.target.id === p.id && !c.resolved).length
  const approvers = data.project.members.filter((m) => ['reviewer', 'project_admin', 'org_admin', 'system_admin'].includes(m.role))
  const t = data.project.terminology

  return (
    <Card>
      <div className="px-6 pt-6 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="code-tag">
            {p.code} · v{p.version}
          </span>
          <ApprovalBadge status={p.status} />
          <Badge tone="outline">{CATEGORY_LABELS[p.category]}</Badge>
          {locked && (
            <Badge tone="ok">
              <Lock className="size-3" /> Locked against silent modification
            </Badge>
          )}
        </div>
        <h3 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.025em]">{p.title}</h3>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{p.statement}</p>
        {p.intent && <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{p.intent}</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <KeyValue
            items={[
              [
                'Accountable approver',
                can('framework.edit') && !locked ? (
                  <Select
                    aria-label="Accountable approver"
                    className="h-8 py-1"
                    value={p.accountableApproverId ?? ''}
                    onChange={(e) => run({ type: 'principle.setApprover', id: p.id, personId: e.target.value || null }, 'Approver updated')}
                    options={[{ value: '', label: 'Any reviewer' }, ...approvers.map((m) => ({ value: m.personId, label: personName(m.personId) }))]}
                  />
                ) : (
                  personName(p.accountableApproverId)
                ),
              ],
              ['Approval', p.approval ? `v${p.approval.version} by ${personName(p.approval.approvedBy)}, ${formatDate(p.approval.approvedAt)}` : 'Not yet approved'],
            ]}
          />
          <div className={cx('rounded-md border px-3 py-2.5 text-[12.5px]', drivers.length ? 'border-line' : 'border-warn/40 bg-warn-soft')}>
            <div className="font-semibold text-ink">Decision-making test</div>
            <p className="mt-0.5 text-ink-2">
              {drivers.length
                ? `${drivers.length} ${t.designDriver.toLowerCase()}(s) turn this commitment into actionable criteria; ${measurable} have a target or acceptance criteria.`
                : `No ${t.designDriver.toLowerCase()}s yet — this is still inspirational messaging, not a decision-making criterion.`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {can('framework.edit') && !locked && p.status !== 'superseded' && (
            <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {can('framework.edit') && p.status === 'proposed' && (
            <Button size="sm" icon={<Send className="size-3.5" />} onClick={() => gov.submit(p.id, p.code)}>
              Submit for review
            </Button>
          )}
          {can('framework.approve') && p.status === 'in_review' && (
            <Button size="sm" variant="primary" icon={<ShieldCheck className="size-3.5" />} onClick={() => gov.approve(p.id, p.code, `${p.title} — ${p.statement}`)}>
              Approve
            </Button>
          )}
          {can('framework.edit') && locked && (
            <Button size="sm" icon={<GitBranch className="size-3.5" />} onClick={() => gov.openRevision(p.id, p.code)}>
              Open revision
            </Button>
          )}
          {can('framework.approve') && p.status !== 'superseded' && (
            <Button size="sm" variant="ghost" onClick={() => gov.supersede(p.id, p.code)}>
              Supersede
            </Button>
          )}
        </div>
        {p.status === 'in_review' && !can('framework.approve') && (
          <div className="mt-4">
            <Callout tone="info">Awaiting review by {p.accountableApproverId ? personName(p.accountableApproverId) : 'a reviewer'}.</Callout>
          </div>
        )}
      </div>
      <div className="border-t border-line px-6">
        <Tabs
          label={`${p.code} details`}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'evidence', label: 'Supporting evidence', count: evidenceFor(data, { type: 'principle', id: p.id }).all.length },
            { value: 'drivers', label: `${t.designDriver}s`, count: drivers.length },
            { value: 'comments', label: <span className="flex items-center gap-1"><MessageSquare className="size-3.5" />Comments</span>, count: comments },
            { value: 'history', label: 'Version history', count: p.versions.length },
          ]}
        />
        <div className="py-5">
          {tab === 'evidence' && <EvidencePanel target={{ type: 'principle', id: p.id }} allowLink={!locked} />}
          {tab === 'drivers' &&
            (drivers.length === 0 ? (
              <EmptyState title={`No linked ${t.designDriver.toLowerCase()}s`}>Create drivers in the Design Driver register and link them to this principle.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {drivers.map((d) => (
                  <li key={d.id}>
                    <Link to={`/projects/${data.project.id}/drivers/${d.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-sunken">
                      <span className="font-mono text-[11px] text-muted">{d.code}</span>
                      <span className="flex-1 text-[13.5px] font-medium">{d.title}</span>
                      <DriverStatusBadge status={driverStatus(d)} />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          {tab === 'comments' && <CommentThread target={{ type: 'principle', id: p.id }} />}
          {tab === 'history' && (
            <VersionHistory
              versions={p.versions}
              current={p.version}
              approvedVersion={p.approval?.version}
              canRestore={can('framework.edit') && !locked && p.status !== 'superseded'}
              onRestore={(v) => gov.restore(p.id, v)}
              render={(s) => (
                <>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1">{s.statement}</p>
                  {s.intent && <p className="mt-1 text-muted">{s.intent}</p>}
                </>
              )}
            />
          )}
        </div>
      </div>
      <PrincipleDialog open={editing} onOpenChange={setEditing} principle={p} />
    </Card>
  )
}

function PrincipleDialog({ open, onOpenChange, principle }: { open: boolean; onOpenChange: (o: boolean) => void; principle?: GuidingPrinciple }) {
  const { run, pending } = useProject()
  const [form, setForm] = useState<PrincipleContent>({ title: '', statement: '', intent: '', category: 'facility_outcomes' })
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setForm(principle ? { title: principle.title, statement: principle.statement, intent: principle.intent, category: principle.category } : { title: '', statement: '', intent: '', category: 'facility_outcomes' })
      setNote('')
    }
  }, [open, principle])
  const set = <K extends keyof PrincipleContent>(k: K, v: PrincipleContent[K]) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={principle ? `Edit ${principle.code}` : 'New guiding principle'}
      description="Saving creates a new version. A principle states what success must look like — durable and testable through its drivers."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!form.title.trim() || !form.statement.trim()}
            onClick={async () => {
              const ok = principle ? await run({ type: 'principle.edit', id: principle.id, content: form, note }, 'New version saved') : await run({ type: 'principle.create', content: form }, 'Principle proposed')
              if (ok !== undefined) onOpenChange(false)
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required>
          {(id) => <Input id={id} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Category">
          {(id) => <Select id={id} value={form.category} onChange={(e) => set('category', e.target.value as PrincipleCategory)} options={optionsFrom(CATEGORY_LABELS)} />}
        </Field>
        <Field label="Short statement" required className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.statement} onChange={(e) => set('statement', e.target.value)} rows={2} maxLength={600} />}
        </Field>
        <Field label="Expanded intent" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.intent} onChange={(e) => set('intent', e.target.value)} rows={4} />}
        </Field>
        {principle && (
          <Field label="Change note" className="sm:col-span-2">
            {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}
