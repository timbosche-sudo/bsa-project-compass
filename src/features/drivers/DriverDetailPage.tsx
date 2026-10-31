import { BadgeCheck, CheckCircle2, CircleDashed, GitBranch, Link2, Lock, Pencil, Ruler, Send, ShieldCheck, Target, XCircle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useProject } from '@/app/project'
import { CommentThread, formatDate, VersionHistory } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { EvidencePanel, LinkedChips, NodePicker } from '@/components/Evidence'
import { DecisionBadge, DriverStatusBadge, TargetBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, Card, CardHeader, cx, Field, Input, KeyValue, Meter, PageHeader, Segmented, Tabs, Textarea, Unknown } from '@/components/ui'
import { driverCompleteness, driverDecisionIds, driverPrincipleIds, driverStatus, measurementState, MEASUREMENT_STATE_LABELS } from '@/domain/drivers'
import { APPROVAL_LABELS, PHASE_LABELS, REQUIREMENT_CLASS_LABELS } from '@/domain/labels'
import type { DesignDriver } from '@/domain/types'
import { DriverFormDialog } from './DriverForm'

export default function DriverDetailPage() {
  const { driverId } = useParams()
  const { data, can, run, personName } = useProject()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState<'target' | 'measure' | 'verify' | 'principles' | null>(null)
  const [tab, setTab] = useState<'evidence' | 'comments' | 'history'>('evidence')
  const d = data.drivers.find((x) => x.id === driverId)
  if (!d) return <Navigate to={`/projects/${data.project.id}/drivers`} replace />

  const status = driverStatus(d)
  const comp = driverCompleteness(data, d)
  const mstate = measurementState(d)
  const principleIds = driverPrincipleIds(data, d.id)
  const decisionIds = driverDecisionIds(data, d.id)
  const approved = d.approvalStatus === 'approved'
  const final = d.performanceStatus === 'verified' || d.performanceStatus === 'not_achieved'
  const m = d.measure

  const approve = async () => {
    const r = await confirm({ title: `Approve ${d.code}?`, body: 'Approval locks the commitment, measure and target. Performance tracking begins.', confirmLabel: 'Approve', requireNote: { label: 'Approval note', minLength: 0 } })
    if (r.confirmed) run({ type: 'driver.approve', id: d.id, note: r.note }, `${d.code} approved`)
  }
  const openRevision = async () => {
    const r = await confirm({ title: `Open a revision of ${d.code}?`, body: 'The driver returns to Proposed and must be re-approved. History is preserved.', confirmLabel: 'Open revision' })
    if (r.confirmed) run({ type: 'driver.openRevision', id: d.id }, `Revision opened for ${d.code}`)
  }
  const supersede = async () => {
    const r = await confirm({ title: `Supersede ${d.code}?`, body: 'The driver is retired but kept for traceability.', confirmLabel: 'Supersede', tone: 'danger', requireNote: { label: 'Reason', minLength: 5 } })
    if (r.confirmed) run({ type: 'driver.supersede', id: d.id, note: r.note }, `${d.code} superseded`)
  }
  const approveTarget = async () => {
    const r = await confirm({ title: `Approve target for ${d.code}?`, body: <>Target: <strong>{m.target} {m.unit}</strong>. Confirm the target is supported by evidence and agreed by the accountable parties.</>, confirmLabel: 'Approve target' })
    if (r.confirmed) run({ type: 'driver.approveTarget', id: d.id }, 'Target approved')
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${d.code} · ${d.scope === 'facility' ? 'Facility' : 'Project delivery'} driver`}
        title={d.title}
        description={d.description}
        meta={
          <>
            <DriverStatusBadge status={status} />
            <Badge tone="outline">Approval: {d.approvalStatus === 'under_review' ? 'Under review' : APPROVAL_LABELS[d.approvalStatus === 'approved' ? 'approved' : d.approvalStatus === 'superseded' ? 'superseded' : 'proposed']}</Badge>
            {m.kind === 'quantitative' && <TargetBadge status={m.targetStatus} />}
            <Badge tone={d.requirementClass === 'owner_mandatory' ? 'inverse' : 'outline'}>{REQUIREMENT_CLASS_LABELS[d.requirementClass]}</Badge>
            {approved && (
              <Badge tone="ok">
                <Lock className="size-3" /> Commitment locked
              </Badge>
            )}
          </>
        }
        actions={
          <>
            {can('driver.edit') && d.approvalStatus !== 'superseded' && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('driver.edit') && d.approvalStatus === 'proposed' && (
              <Button icon={<Send className="size-4" />} onClick={() => run({ type: 'driver.submit', id: d.id }, `${d.code} submitted for review`)}>
                Submit for review
              </Button>
            )}
            {can('driver.approve') && d.approvalStatus === 'under_review' && (
              <Button variant="primary" icon={<ShieldCheck className="size-4" />} onClick={approve}>
                Approve
              </Button>
            )}
            {can('driver.edit') && approved && !final && (
              <Button variant="ghost" icon={<GitBranch className="size-4" />} onClick={openRevision}>
                Open revision
              </Button>
            )}
            {can('driver.approve') && d.approvalStatus !== 'superseded' && (
              <Button variant="ghost" onClick={supersede}>
                Supersede
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Measure */}
          <Card>
            <CardHeader
              eyebrow={m.kind === 'quantitative' ? 'Quantitative measure' : 'Qualitative acceptance criteria'}
              title="Performance"
              description={MEASUREMENT_STATE_LABELS[mstate]}
              actions={
                <div className="flex flex-wrap gap-1.5">
                  {can('driver.edit') && !(approved && m.targetStatus === 'approved') && d.approvalStatus !== 'superseded' && (
                    <Button size="sm" icon={<Target className="size-3.5" />} onClick={() => setDialog('target')}>
                      {m.target ? 'Revise target' : 'Propose target'}
                    </Button>
                  )}
                  {can('driver.approve') && m.targetStatus === 'proposed' && (
                    <Button size="sm" variant="primary" icon={<ShieldCheck className="size-3.5" />} onClick={approveTarget}>
                      Approve target
                    </Button>
                  )}
                  {can('driver.recordMeasurement') && approved && !final && (
                    <Button size="sm" icon={<Ruler className="size-3.5" />} onClick={() => setDialog('measure')}>
                      Record observation
                    </Button>
                  )}
                </div>
              }
            />
            <div className="grid gap-px bg-line sm:grid-cols-3">
              <Metric label="Baseline" value={m.kind === 'qualitative' ? 'n/a' : m.baseline} unit={m.unit} />
              <Metric label={`Target${m.targetStatus === 'proposed' ? ' (awaiting approval)' : ''}`} value={m.kind === 'qualitative' ? 'Criteria below' : m.target} unit={m.unit} emptyText="Not set" />
              <Metric label="Current observed" value={m.current} unit={m.kind === 'quantitative' ? m.unit : ''} emptyText="Not yet measured" sub={m.currentAsOf ? `as of ${formatDate(m.currentAsOf)}` : undefined} />
            </div>
            <div className="space-y-4 px-5 py-4 text-[13px]">
              {m.kind === 'qualitative' ? (
                <div>
                  <div className="eyebrow mb-1">Acceptance criteria</div>
                  <p className="text-ink">{m.acceptanceCriteria || <Unknown>Not defined</Unknown>}</p>
                </div>
              ) : (
                <div>
                  <div className="eyebrow mb-1">Measurement methodology</div>
                  <p className="text-ink-2">{m.methodology || <Unknown>Not defined</Unknown>}</p>
                </div>
              )}
              {approved && !final && can('driver.edit') && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <span className="eyebrow">Performance status</span>
                  <Segmented
                    label="Performance status"
                    value={d.performanceStatus as 'not_started' | 'in_progress' | 'at_risk'}
                    onChange={(v) => run({ type: 'driver.setPerformance', id: d.id, status: v }, 'Performance status updated')}
                    options={[
                      { value: 'not_started', label: 'Not started' },
                      { value: 'in_progress', label: 'In progress' },
                      { value: 'at_risk', label: 'At risk' },
                    ]}
                  />
                </div>
              )}
              {!approved && d.approvalStatus !== 'superseded' && <Callout tone="neutral">Performance tracking begins once the driver is approved.</Callout>}
            </div>
          </Card>

          {/* Verification */}
          <Card>
            <CardHeader eyebrow="Validation" title="Verification" description="A driver is verified only with evidence, a named reviewer and a date — never by marking a task complete." />
            <div className="px-5 py-4">
              {d.verification ? (
                <div className={cx('rounded-md border p-4', d.verification.outcome === 'achieved' ? 'border-ok/40 bg-ok-soft' : 'border-danger/40 bg-danger-soft')}>
                  <div className="flex items-center gap-2 font-semibold">
                    {d.verification.outcome === 'achieved' ? <BadgeCheck className="size-5 text-ok" /> : <XCircle className="size-5 text-danger" />}
                    {d.verification.outcome === 'achieved' ? 'Verified — achieved' : 'Verified — not achieved'}
                  </div>
                  <p className="mt-2 text-[13px] text-ink">{d.verification.evidence}</p>
                  <p className="mt-2 text-[12px] text-muted">
                    Reviewer: {personName(d.verification.reviewerId)} · Verified {formatDate(d.verification.verifiedAt)}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <KeyValue items={[['Validation method', d.validationMethod || <Unknown>Not defined</Unknown>]]} />
                  {can('driver.verify') && approved ? (
                    <Button icon={<BadgeCheck className="size-4" />} onClick={() => setDialog('verify')}>
                      Record verification
                    </Button>
                  ) : (
                    <p className="text-[12.5px] text-muted">{approved ? 'Verification is recorded by a reviewer.' : 'Verification is available once the driver is approved.'}</p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="px-5">
              <Tabs
                label="Driver details"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: 'evidence', label: 'Source evidence' },
                  { value: 'comments', label: 'Comments', count: data.comments.filter((c) => c.target.id === d.id && !c.resolved).length },
                  { value: 'history', label: 'Revision & approval history', count: d.versions.length },
                ]}
              />
            </div>
            <div className="px-5 py-4">
              {tab === 'evidence' && <EvidencePanel target={{ type: 'driver', id: d.id }} />}
              {tab === 'comments' && <CommentThread target={{ type: 'driver', id: d.id }} />}
              {tab === 'history' && (
                <VersionHistory
                  versions={d.versions}
                  current={d.version}
                  approvedVersion={d.approval?.version}
                  canRestore={can('driver.edit') && d.approvalStatus !== 'approved' && d.approvalStatus !== 'superseded'}
                  onRestore={(v) => run({ type: 'driver.restore', id: d.id, version: v }, `Restored v${v} content`)}
                  render={(s) => (
                    <KeyValue
                      items={[
                        ['Title', s.title],
                        ['Outcome', s.intendedOutcome],
                        ['Target', s.measure.kind === 'quantitative' ? `${s.measure.target ?? 'not set'} ${s.measure.unit} (${s.measure.targetStatus})` : s.measure.acceptanceCriteria],
                        ['Owner', personName(s.ownerPersonId)],
                      ]}
                    />
                  )}
                />
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Data completeness" description="How fully this driver is defined. Separate from performance." />
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <Meter value={comp.ratio} label="Definition completeness" />
                <span className="text-[13px] font-semibold tabular-nums">{Math.round(comp.ratio * 100)}%</span>
              </div>
              <ul className="mt-3 space-y-1 text-[12.5px]">
                {comp.present.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-ink-2">
                    <CheckCircle2 className="size-3.5 text-ok" /> {p}
                  </li>
                ))}
                {comp.missing.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-warn">
                    <CircleDashed className="size-3.5" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Accountability" />
            <div className="px-5 py-4">
              <KeyValue
                items={[
                  ['Owner', d.ownerPersonId ? personName(d.ownerPersonId) : <span className="text-warn">Unassigned</span>],
                  ['Organization', d.ownerOrganization || <Unknown>—</Unknown>],
                  ['Phase', PHASE_LABELS[d.phase]],
                  ['Target date', d.targetDate ? formatDate(d.targetDate) : <Unknown>Not set</Unknown>],
                  ['Intended outcome', d.intendedOutcome || <Unknown>—</Unknown>],
                  ["Owner's term", d.ownerTerm ? <q>{d.ownerTerm}</q> : <Unknown>—</Unknown>],
                  ['Approved', d.approval ? `v${d.approval.version} by ${personName(d.approval.approvedBy)}, ${formatDate(d.approval.approvedAt)}` : <Unknown>No</Unknown>],
                ]}
              />
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Guiding principles"
              actions={
                can('driver.edit') && (
                  <Button size="sm" variant="ghost" icon={<Link2 className="size-3.5" />} onClick={() => setDialog('principles')}>
                    Edit links
                  </Button>
                )
              }
            />
            <div className="px-5 py-4">
              <LinkedChips refs={principleIds.map((id) => ({ type: 'principle' as const, id }))} empty="Not linked — required before review" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Linked decisions" />
            <ul className="divide-y divide-line">
              {decisionIds.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">No decisions reference this driver.</li>}
              {decisionIds.map((id) => {
                const dec = data.decisions.find((x) => x.id === id)!
                return (
                  <li key={id}>
                    <Link to={`/projects/${data.project.id}/decisions/${id}`} className="block px-5 py-2.5 hover:bg-sunken">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted">{dec.code}</span>
                        <DecisionBadge status={dec.status} />
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[13px]">{dec.question}</div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Risks & dependencies" />
            <div className="space-y-3 px-5 py-4 text-[13px]">
              {d.risks.length ? (
                <ul className="list-disc space-y-1 pl-4 text-ink-2">
                  {d.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No risks recorded.</p>
              )}
              <div>
                <div className="eyebrow mb-1">Depends on</div>
                <LinkedChips refs={d.dependencyIds.map((id) => ({ type: 'driver' as const, id }))} />
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <DriverFormDialog open={editing} onOpenChange={setEditing} driver={d} />
      <TargetDialog open={dialog === 'target'} onOpenChange={(o) => setDialog(o ? 'target' : null)} d={d} />
      <MeasureDialog open={dialog === 'measure'} onOpenChange={(o) => setDialog(o ? 'measure' : null)} d={d} />
      <VerifyDialog open={dialog === 'verify'} onOpenChange={(o) => setDialog(o ? 'verify' : null)} d={d} />
      <NodePicker
        open={dialog === 'principles'}
        onOpenChange={(o) => setDialog(o ? 'principles' : null)}
        title={`Principles implemented by ${d.code}`}
        type="principle"
        initial={principleIds}
        confirmLabel="Save links"
        onPick={async (ids) => {
          if ((await run({ type: 'driver.setPrinciples', id: d.id, principleIds: ids }, 'Principle links saved')) !== undefined) setDialog(null)
        }}
      />
    </div>
  )
}

function Metric({ label, value, unit, emptyText = 'Unknown', sub }: { label: string; value: string | null; unit: string; emptyText?: string; sub?: ReactNode }) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 text-[24px] leading-tight font-semibold tracking-tight tabular-nums">
        {value === null || value === '' ? <span className="text-[15px] font-medium text-muted italic">{emptyText}</span> : value}
      </div>
      {value && unit && <div className="mt-0.5 text-[12px] leading-snug text-muted">{unit}</div>}
      {sub && <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>}
    </div>
  )
}

function TargetDialog({ open, onOpenChange, d }: { open: boolean; onOpenChange: (o: boolean) => void; d: DesignDriver }) {
  const { run, pending } = useProject()
  const [f, setF] = useState({ baseline: '', target: '', unit: '', methodology: '' })
  useEffect(() => {
    if (open) setF({ baseline: d.measure.baseline ?? '', target: d.measure.target ?? '', unit: d.measure.unit, methodology: d.measure.methodology })
  }, [open, d])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Propose a target for ${d.code}`}
      description="The target is recorded as awaiting approval. Only enter a value supported by a source, model or Owner decision."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!f.target.trim()}
            onClick={async () => {
              if ((await run({ type: 'driver.proposeTarget', id: d.id, baseline: f.baseline.trim() || null, target: f.target, unit: f.unit, methodology: f.methodology }, 'Target proposed — awaiting approval')) !== undefined) onOpenChange(false)
            }}
          >
            Propose target
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target" required>
          {(id) => <Input id={id} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />}
        </Field>
        <Field label="Unit">
          {(id) => <Input id={id} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />}
        </Field>
        <Field label="Baseline" hint="Blank = unknown">
          {(id) => <Input id={id} value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} />}
        </Field>
        <Field label="Methodology" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={f.methodology} onChange={(e) => setF({ ...f, methodology: e.target.value })} rows={2} />}
        </Field>
      </div>
    </Dialog>
  )
}

function MeasureDialog({ open, onOpenChange, d }: { open: boolean; onOpenChange: (o: boolean) => void; d: DesignDriver }) {
  const { run, pending } = useProject()
  const [value, setValue] = useState('')
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  useEffect(() => {
    if (open) setValue('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Record observation for ${d.code}`}
      description="Record what was actually observed or modelled, with its date. This does not verify the driver."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!value.trim()} onClick={async () => (await run({ type: 'driver.recordMeasurement', id: d.id, value, asOf }, 'Observation recorded')) !== undefined && onOpenChange(false)}>
            Record
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Observed value${d.measure.unit ? ` (${d.measure.unit})` : ''}`} required>
          {(id) => <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <Field label="As of" required>
          {(id) => <Input id={id} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}

function VerifyDialog({ open, onOpenChange, d }: { open: boolean; onOpenChange: (o: boolean) => void; d: DesignDriver }) {
  const { run, pending } = useProject()
  const [outcome, setOutcome] = useState<'achieved' | 'not_achieved'>('achieved')
  const [evidence, setEvidence] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  useEffect(() => {
    if (open) setEvidence('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Verify ${d.code}`}
      description="You are recorded as the reviewer. Verification is final for this driver."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={evidence.trim().length < 20} onClick={async () => (await run({ type: 'driver.verify', id: d.id, outcome, evidence, verifiedAt: date }, 'Verification recorded')) !== undefined && onOpenChange(false)}>
            Record verification
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-sunken px-3 py-2 text-[12.5px]">
          {d.measure.kind === 'quantitative' ? (
            <>
              Target <strong>{d.measure.target ?? 'not set'} {d.measure.unit}</strong> ({d.measure.targetStatus}) · observed <strong>{d.measure.current ?? 'not yet measured'}</strong>
            </>
          ) : (
            <>Criteria: {d.measure.acceptanceCriteria}</>
          )}
        </div>
        <Segmented
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: 'achieved', label: 'Achieved' },
            { value: 'not_achieved', label: 'Not achieved' },
          ]}
        />
        <Field label="Verification evidence" required hint="Describe the test, document, model or observation and where it is recorded (20+ characters).">
          {(id) => <Textarea id={id} value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={4} />}
        </Field>
        <Field label="Verification date" required>
          {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}
