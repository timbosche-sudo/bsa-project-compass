import { AlertTriangle, CheckCircle2, FileDown, Link2, Lock, Plus, RotateCcw, Save, ShieldCheck, Star, ThumbsUp, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { useProject } from '@/app/project'
import { CommentThread, formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { LinkedChips, NodePicker } from '@/components/Evidence'
import { DecisionBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { Badge, Button, Callout, Card, CardHeader, cx, Field, IconButton, Input, optionsFrom, PageHeader, Select, Textarea } from '@/components/ui'
import { evaluateCba, informalTotals } from '@/domain/cba'
import { decisionDriverIds } from '@/domain/drivers'
import { newId } from '@/domain/ids'
import { PHASE_LABELS } from '@/domain/labels'
import type { Alternative, Decision, Factor, MandatoryRequirement, MustResult, Phase } from '@/domain/types'

type Draft = Pick<Decision, 'alternatives' | 'mandatoryRequirements' | 'factors' | 'paramountFactorId' | 'informalScores'>

const money = (n: number | null) => (n === null ? null : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }))

export default function DecisionDetailPage() {
  const { decisionId } = useParams()
  const { data, can, run, personName, pending } = useProject()
  const confirm = useConfirm()
  const notify = useToast()
  const dec = data.decisions.find((d) => d.id === decisionId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dialog, setDialog] = useState<'recommend' | 'approve' | 'drivers' | 'frame' | null>(null)

  useEffect(() => {
    if (dec) setDraft({ alternatives: dec.alternatives, mandatoryRequirements: dec.mandatoryRequirements, factors: dec.factors, paramountFactorId: dec.paramountFactorId, informalScores: dec.informalScores })
  }, [dec])

  const working: Decision | null = useMemo(() => (dec && draft ? { ...dec, ...draft } : null), [dec, draft])
  const ev = useMemo(() => (working ? evaluateCba(working) : null), [working])
  if (!dec) return <Navigate to={`/projects/${data.project.id}/decisions`} replace />
  if (!draft || !working || !ev) return null

  const locked = dec.status === 'approved' || !can('decision.edit')
  const dirty = JSON.stringify(draft) !== JSON.stringify({ alternatives: dec.alternatives, mandatoryRequirements: dec.mandatoryRequirements, factors: dec.factors, paramountFactorId: dec.paramountFactorId, informalScores: dec.informalScores })
  const alts = draft.alternatives
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d!, ...patch }))
  const setFactor = (id: string, patch: Partial<Factor>) => set({ factors: draft.factors.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const setAlt = (id: string, patch: Partial<Alternative>) => set({ alternatives: alts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const setMust = (id: string, patch: Partial<MandatoryRequirement>) => set({ mandatoryRequirements: draft.mandatoryRequirements.map((m) => (m.id === id ? { ...m, ...patch } : m)) })

  const save = async () => {
    const ok = await run({ type: 'decision.update', id: dec.id, patch: draft, note: 'Evaluation updated' }, 'Evaluation saved')
    if (ok !== undefined && dec.status === 'recommended') notify('ok', 'The recommendation was withdrawn because the evaluation changed.')
  }

  const reopen = async () => {
    const r = await confirm({ title: `Reopen ${dec.code}?`, body: 'The recommendation and approval are withdrawn (kept in history). The decision returns to evaluation.', confirmLabel: 'Reopen', tone: 'danger', requireNote: { label: 'Reason for reopening', minLength: 5 } })
    if (r.confirmed) run({ type: 'decision.reopen', id: dec.id, note: r.note }, `${dec.code} reopened`)
  }

  const exportPdf = async () => {
    try {
      const { decisionRecordPdf } = await import('@/exporters/pdf')
      await decisionRecordPdf(data, dec)
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const recAlt = alts.find((a) => a.id === dec.recommendation?.alternativeId)
  const finAlt = alts.find((a) => a.id === dec.approval?.alternativeId)
  const eligibleAlts = alts.filter((a) => ev.eligible[a.id])
  const maxTotal = Math.max(1, ...eligibleAlts.map((a) => ev.totals[a.id]))

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={`${dec.code} · ${PHASE_LABELS[dec.phase]}${dec.dueDate ? ` · needed by ${formatDate(dec.dueDate)}` : ''}`}
        title={dec.question}
        description={dec.context}
        meta={
          <>
            <DecisionBadge status={dec.status} />
            {dec.status === 'approved' && (
              <Badge tone="ok">
                <Lock className="size-3" /> Locked
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Button icon={<FileDown className="size-4" />} onClick={exportPdf}>
              Decision record PDF
            </Button>
            {can('decision.edit') && dec.status !== 'approved' && (
              <Button variant="ghost" onClick={() => setDialog('frame')}>
                Edit framing
              </Button>
            )}
            {can('decision.recommend') && dec.status !== 'approved' && (
              <Button icon={<ThumbsUp className="size-4" />} disabled={!ev.complete || dirty} title={dirty ? 'Save changes first' : !ev.complete ? 'Complete the evaluation first' : undefined} onClick={() => setDialog('recommend')}>
                Recommend
              </Button>
            )}
            {can('decision.approve') && dec.status === 'recommended' && (
              <Button variant="primary" icon={<ShieldCheck className="size-4" />} onClick={() => setDialog('approve')}>
                Approve decision
              </Button>
            )}
            {can('decision.approve') && (dec.status === 'approved' || dec.status === 'recommended') && (
              <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={reopen}>
                Reopen
              </Button>
            )}
          </>
        }
      />

      {(recAlt || finAlt) && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {recAlt && dec.recommendation && (
            <Callout tone="info" icon={<ThumbsUp className="size-4 text-info" />} title={`Recommended: ${recAlt.name}`}>
              <p>{dec.recommendation.rationale}</p>
              <p className="mt-1 text-[12px] text-muted">
                {personName(dec.recommendation.by)} · {formatDate(dec.recommendation.at, true)}
              </p>
            </Callout>
          )}
          {finAlt && dec.approval && (
            <Callout tone="ok" icon={<CheckCircle2 className="size-4 text-ok" />} title={`Final decision: ${finAlt.name}`}>
              {dec.approval.note && <p>{dec.approval.note}</p>}
              <p className="mt-1 text-[12px] text-muted">
                Approved by {personName(dec.approval.by)} · {formatDate(dec.approval.at, true)}
              </p>
            </Callout>
          )}
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Alternatives */}
          <Card>
            <CardHeader
              eyebrow="Step 1"
              title="Alternatives"
              description="Monetary cost is recorded here and kept apart from advantage importance."
              actions={
                !locked && (
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ alternatives: [...alts, { id: newId().slice(0, 8), name: `Alternative ${alts.length + 1}`, description: '', cost: null, costBasis: '', scheduleImpact: '', risks: '' }] })}>
                    Add alternative
                  </Button>
                )
              }
            />
            <div className="overflow-x-auto scroll-thin">
              <table className="table-base min-w-[860px]">
                <thead>
                  <tr>
                    <th>Alternative</th>
                    <th>Cost (USD)</th>
                    <th>Schedule implications</th>
                    <th>Risks</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {alts.map((a) => (
                    <tr key={a.id}>
                      <td className="min-w-[220px]">
                        <Input aria-label="Alternative name" value={a.name} disabled={locked} onChange={(e) => setAlt(a.id, { name: e.target.value })} className="font-medium" />
                        <Textarea aria-label="Description" value={a.description} disabled={locked} onChange={(e) => setAlt(a.id, { description: e.target.value })} rows={2} className="mt-1.5 text-[12.5px]" placeholder="Description" />
                        {!ev.eligible[a.id] && <Badge tone="danger" className="mt-1.5">Fails a mandatory requirement</Badge>}
                      </td>
                      <td className="min-w-[150px]">
                        <Input aria-label="Cost" inputMode="numeric" value={a.cost ?? ''} placeholder="Unknown" disabled={locked} onChange={(e) => setAlt(a.id, { cost: e.target.value.trim() === '' ? null : Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) })} />
                        <Input aria-label="Cost basis" value={a.costBasis} disabled={locked} onChange={(e) => setAlt(a.id, { costBasis: e.target.value })} className="mt-1.5 text-[12px]" placeholder="Basis of estimate" />
                      </td>
                      <td>
                        <Textarea aria-label="Schedule implications" value={a.scheduleImpact} disabled={locked} onChange={(e) => setAlt(a.id, { scheduleImpact: e.target.value })} rows={2} className="text-[12.5px]" />
                      </td>
                      <td>
                        <Textarea aria-label="Risks" value={a.risks} disabled={locked} onChange={(e) => setAlt(a.id, { risks: e.target.value })} rows={2} className="text-[12.5px]" />
                      </td>
                      <td>
                        {!locked && (
                          <IconButton
                            label={`Remove ${a.name}`}
                            onClick={async () => {
                              const r = await confirm({ title: `Remove ${a.name}?`, body: 'Its attributes, advantages and requirement results are also removed from the draft.', confirmLabel: 'Remove', tone: 'danger' })
                              if (r.confirmed) set({ alternatives: alts.filter((x) => x.id !== a.id) })
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alts.length === 0 && <p className="px-5 py-6 text-center text-[13px] text-muted">Add at least two alternatives.</p>}
            </div>
          </Card>

          {/* Mandatory requirements */}
          <Card>
            <CardHeader
              eyebrow="Step 2"
              title="Mandatory requirements"
              description="Alternatives that fail any mandatory requirement are excluded from the evaluation."
              actions={
                !locked && (
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ mandatoryRequirements: [...draft.mandatoryRequirements, { id: newId().slice(0, 8), text: 'New requirement', results: {} }] })}>
                    Add requirement
                  </Button>
                )
              }
            />
            <div className="overflow-x-auto scroll-thin">
              <table className="table-base min-w-[640px]">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    {alts.map((a) => (
                      <th key={a.id}>{a.name}</th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {draft.mandatoryRequirements.map((m) => (
                    <tr key={m.id}>
                      <td className="min-w-[220px]">
                        <Input aria-label="Requirement" value={m.text} disabled={locked} onChange={(e) => setMust(m.id, { text: e.target.value })} />
                      </td>
                      {alts.map((a) => {
                        const r = m.results[a.id] ?? 'unknown'
                        return (
                          <td key={a.id}>
                            <Select
                              aria-label={`${m.text} — ${a.name}`}
                              value={r}
                              disabled={locked}
                              className={cx('w-auto', r === 'fail' && 'border-danger text-danger', r === 'pass' && 'text-ok')}
                              onChange={(e) => setMust(m.id, { results: { ...m.results, [a.id]: e.target.value as MustResult } })}
                              options={[
                                { value: 'pass', label: 'Pass' },
                                { value: 'fail', label: 'Fail' },
                                { value: 'unknown', label: 'Unknown' },
                              ]}
                            />
                          </td>
                        )
                      })}
                      <td>
                        {!locked && (
                          <IconButton label="Remove requirement" onClick={() => set({ mandatoryRequirements: draft.mandatoryRequirements.filter((x) => x.id !== m.id) })}>
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {draft.mandatoryRequirements.length === 0 && <p className="px-5 py-4 text-[13px] text-muted">No mandatory requirements recorded.</p>}
            </div>
          </Card>

          {/* CBA */}
          <Card>
            <CardHeader
              eyebrow="Step 3 · Choosing by Advantages"
              title="Factors, attributes and advantages"
              description="For each factor: record every alternative's attribute, mark the least-preferred attribute, describe each advantage as a factual difference, then judge its importance (0–100) with a written rationale. Anchor the paramount advantage at 100."
              actions={
                !locked && (
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ factors: [...draft.factors, { id: newId().slice(0, 8), name: 'New factor', criterion: '', driverId: null, attributes: {}, leastPreferredAltId: null, advantages: {}, importanceRationale: '' }] })}>
                    Add factor
                  </Button>
                )
              }
            />
            <div className="divide-y divide-line">
              {draft.factors.length === 0 && <p className="px-5 py-6 text-center text-[13px] text-muted">Add factors drawn from the relevant Design Drivers.</p>}
              {draft.factors.map((f) => (
                <FactorEditor key={f.id} f={f} decision={working} locked={locked} eligible={ev.eligible} paramount={draft.paramountFactorId === f.id} onChange={(p) => setFactor(f.id, p)} onParamount={() => set({ paramountFactorId: f.id })} onRemove={() => set({ factors: draft.factors.filter((x) => x.id !== f.id), paramountFactorId: draft.paramountFactorId === f.id ? null : draft.paramountFactorId })} />
              ))}
            </div>
            {alts.length > 0 && (
              <div className="border-t border-line bg-sunken/50 px-5 py-4">
                <div className="eyebrow mb-2">Total importance of advantages</div>
                <ul className="space-y-2">
                  {alts.map((a) => (
                    <li key={a.id} className="grid grid-cols-[160px_1fr_60px] items-center gap-3 text-[13px]">
                      <span className={cx('truncate font-medium', !ev.eligible[a.id] && 'text-faint line-through')}>{a.name}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-surface">
                        {ev.eligible[a.id] && <span className={cx('block h-full rounded-full', ev.leaders.includes(a.id) ? 'bg-accent' : 'bg-ink-2/40')} style={{ width: `${(ev.totals[a.id] / maxTotal) * 100}%` }} />}
                      </span>
                      <span className="text-right font-semibold tabular-nums">{ev.eligible[a.id] ? ev.totals[a.id] : '—'}</span>
                    </li>
                  ))}
                </ul>
                {!ev.complete && <p className="mt-2 text-[12px] text-warn">Totals are provisional until every blocking item is resolved.</p>}
              </div>
            )}
          </Card>

          <ImportanceVsCost decision={working} totals={ev.totals} eligible={ev.eligible} />
          <InformalScores decision={working} locked={locked} onChange={(scores) => set({ informalScores: scores })} />
        </div>

        <aside className="grid content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <Card>
            <CardHeader title="Evaluation status" />
            <div className="px-5 py-4">
              {ev.complete ? (
                <p className="flex items-center gap-2 text-[13px] text-ok">
                  <CheckCircle2 className="size-4" /> Evaluation complete — ready for recommendation.
                </p>
              ) : (
                <p className="text-[13px] text-ink-2">{ev.issues.filter((i) => i.severity === 'blocking').length} item(s) block a recommendation.</p>
              )}
              <ul className="mt-3 max-h-[320px] space-y-1.5 overflow-y-auto scroll-thin">
                {ev.issues.map((i, n) => (
                  <li key={n} className={cx('flex items-start gap-2 text-[12.5px]', i.severity === 'blocking' ? 'text-danger' : 'text-warn')}>
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {i.message}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Relevant Design Drivers"
              actions={
                can('decision.edit') && dec.status !== 'approved' && (
                  <Button size="sm" variant="ghost" icon={<Link2 className="size-3.5" />} onClick={() => setDialog('drivers')}>
                    Edit
                  </Button>
                )
              }
            />
            <div className="px-5 py-4">
              <LinkedChips refs={decisionDriverIds(data, dec.id).map((id) => ({ type: 'driver' as const, id }))} empty="No drivers linked" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Decision history" />
            <ol className="space-y-3 px-5 py-4">
              {[...dec.history].reverse().map((h, i) => (
                <li key={i} className="text-[12.5px]">
                  <div className="font-medium text-ink">{h.action}</div>
                  {h.note && <div className="text-ink-2">{h.note}</div>}
                  <div className="text-[11.5px] text-muted">
                    {personName(h.by)} · {formatDate(h.at, true)}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Discussion" />
            <div className="px-5 py-4">
              <CommentThread target={{ type: 'decision', id: dec.id }} />
            </div>
          </Card>
        </aside>
      </div>

      {dirty && !locked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-raised/95 px-4 py-3 shadow-pop backdrop-blur lg:left-[248px]">
          <div className="mx-auto flex max-w-[1480px] items-center justify-end gap-2">
            <span className="mr-auto text-[13px] text-ink-2">Unsaved changes to the evaluation{dec.status === 'recommended' ? ' — saving withdraws the current recommendation' : ''}.</span>
            <Button variant="ghost" icon={<Undo2 className="size-4" />} onClick={() => setDraft({ alternatives: dec.alternatives, mandatoryRequirements: dec.mandatoryRequirements, factors: dec.factors, paramountFactorId: dec.paramountFactorId, informalScores: dec.informalScores })}>
              Discard
            </Button>
            <Button variant="primary" icon={<Save className="size-4" />} loading={pending} onClick={save}>
              Save evaluation
            </Button>
          </div>
        </div>
      )}

      <RecommendDialog open={dialog === 'recommend'} onOpenChange={(o) => setDialog(o ? 'recommend' : null)} decision={dec} leaders={ev.leaders} eligibleIds={eligibleAlts.map((a) => a.id)} totals={ev.totals} />
      <ApproveDialog open={dialog === 'approve'} onOpenChange={(o) => setDialog(o ? 'approve' : null)} decision={dec} eligibleIds={eligibleAlts.map((a) => a.id)} />
      <FrameDialog open={dialog === 'frame'} onOpenChange={(o) => setDialog(o ? 'frame' : null)} decision={dec} />
      <NodePicker
        open={dialog === 'drivers'}
        onOpenChange={(o) => setDialog(o ? 'drivers' : null)}
        title={`Design Drivers relevant to ${dec.code}`}
        type="driver"
        initial={decisionDriverIds(data, dec.id)}
        confirmLabel="Save"
        onPick={async (ids) => {
          if ((await run({ type: 'decision.setDrivers', id: dec.id, driverIds: ids }, 'Drivers linked')) !== undefined) setDialog(null)
        }}
      />
    </div>
  )
}

function FactorEditor({ f, decision, locked, eligible, paramount, onChange, onParamount, onRemove }: { f: Factor; decision: Decision; locked: boolean; eligible: Record<string, boolean>; paramount: boolean; onChange: (p: Partial<Factor>) => void; onParamount: () => void; onRemove: () => void }) {
  const { data } = useProject()
  const alts = decision.alternatives
  return (
    <div className="px-5 py-5">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto]">
        <Field label="Factor">{(id) => <Input id={id} value={f.name} disabled={locked} onChange={(e) => onChange({ name: e.target.value })} className="font-medium" />}</Field>
        <Field label="Criterion (what is preferred)">{(id) => <Input id={id} value={f.criterion} disabled={locked} onChange={(e) => onChange({ criterion: e.target.value })} placeholder="e.g. Shorter is better" />}</Field>
        <Field label="Design Driver">
          {(id) => (
            <Select id={id} value={f.driverId ?? ''} disabled={locked} onChange={(e) => onChange({ driverId: e.target.value || null })} options={[{ value: '', label: 'None' }, ...data.drivers.filter((d) => d.approvalStatus !== 'superseded').map((d) => ({ value: d.id, label: `${d.code} ${d.title}` }))]} />
          )}
        </Field>
        <div className="flex items-end gap-1 pb-0.5">
          <Button size="sm" variant={paramount ? 'accent' : 'ghost'} icon={<Star className="size-3.5" />} disabled={locked} onClick={onParamount} title="The paramount advantage anchors the importance scale at 100">
            {paramount ? 'Paramount' : 'Set paramount'}
          </Button>
          {!locked && (
            <IconButton label={`Remove factor ${f.name}`} onClick={onRemove}>
              <Trash2 className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto scroll-thin">
        <table className="table-base min-w-[700px]">
          <thead>
            <tr>
              <th>Alternative</th>
              <th>Attribute</th>
              <th className="text-center">Least preferred</th>
              <th>Advantage (factual difference)</th>
              <th className="w-28">Importance</th>
            </tr>
          </thead>
          <tbody>
            {alts.map((a) => {
              const least = f.leastPreferredAltId === a.id
              const adv = f.advantages[a.id] ?? { description: '', importance: null }
              return (
                <tr key={a.id} className={cx(!eligible[a.id] && 'opacity-50')}>
                  <td className="font-medium whitespace-nowrap">{a.name}</td>
                  <td>
                    <Input aria-label={`${f.name} attribute of ${a.name}`} value={f.attributes[a.id] ?? ''} disabled={locked} onChange={(e) => onChange({ attributes: { ...f.attributes, [a.id]: e.target.value } })} />
                  </td>
                  <td className="text-center">
                    <input type="radio" name={`least-${f.id}`} aria-label={`${a.name} is least preferred for ${f.name}`} className="accent-[var(--c-accent)]" disabled={locked} checked={least} onChange={() => onChange({ leastPreferredAltId: a.id })} />
                  </td>
                  <td>
                    {least ? (
                      <span className="text-[12px] text-muted">Baseline (no advantage)</span>
                    ) : !eligible[a.id] ? (
                      <span className="text-[12px] text-muted">Excluded</span>
                    ) : (
                      <Input aria-label={`${f.name} advantage of ${a.name}`} value={adv.description} disabled={locked || !f.leastPreferredAltId} placeholder={f.leastPreferredAltId ? 'e.g. 115 ft shorter travel' : 'Mark the least preferred first'} onChange={(e) => onChange({ advantages: { ...f.advantages, [a.id]: { ...adv, description: e.target.value } } })} />
                    )}
                  </td>
                  <td>
                    {!least && eligible[a.id] && (
                      <Input
                        aria-label={`${f.name} importance of ${a.name}'s advantage`}
                        type="number"
                        min={0}
                        max={100}
                        value={adv.importance ?? ''}
                        disabled={locked || !f.leastPreferredAltId}
                        onChange={(e) => onChange({ advantages: { ...f.advantages, [a.id]: { ...adv, importance: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))) } } })}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Field label="Rationale for importance judgments" className="mt-3">
        {(id) => <Textarea id={id} value={f.importanceRationale} disabled={locked} onChange={(e) => onChange({ importanceRationale: e.target.value })} rows={2} placeholder="Why is this advantage more or less important than the others? Who agreed?" />}
      </Field>
    </div>
  )
}

function ImportanceVsCost({ decision, totals, eligible }: { decision: Decision; totals: Record<string, number>; eligible: Record<string, boolean> }) {
  const alts = decision.alternatives.filter((a) => eligible[a.id])
  const known = alts.filter((a) => a.cost !== null)
  const unknown = alts.filter((a) => a.cost === null)
  const W = 520
  const H = 220
  const pad = { l: 56, r: 24, t: 16, b: 40 }
  const maxCost = Math.max(1, ...known.map((a) => a.cost!))
  const minCost = Math.min(maxCost, ...known.map((a) => a.cost!))
  const span = Math.max(1, maxCost - minCost)
  const maxImp = Math.max(1, ...alts.map((a) => totals[a.id]))
  const x = (c: number) => pad.l + (known.length > 1 ? ((c - minCost) / span) * (W - pad.l - pad.r) : (W - pad.l - pad.r) / 2)
  const y = (v: number) => H - pad.b - (v / maxImp) * (H - pad.t - pad.b)
  return (
    <Card>
      <CardHeader eyebrow="Step 4" title="Importance of advantages vs. cost" description="Cost is never folded into importance. Use this view to judge whether additional advantages are worth additional cost." />
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        {known.length === 0 ? (
          <p className="text-[13px] text-muted">No alternative has a cost estimate yet. Cost data is shown only when entered — it is never estimated by the application.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter of total importance of advantages against cost for each eligible alternative">
            <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--c-line-strong)" />
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--c-line-strong)" />
            <text x={(W + pad.l) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--c-muted)">
              Cost →
            </text>
            <text x={14} y={(H - pad.b) / 2} fontSize="11" fill="var(--c-muted)" transform={`rotate(-90 14 ${(H - pad.b) / 2})`} textAnchor="middle">
              Importance →
            </text>
            {known.map((a) => (
              <g key={a.id}>
                <circle cx={x(a.cost!)} cy={y(totals[a.id])} r={6} fill="var(--c-accent)" />
                <text x={x(a.cost!)} y={y(totals[a.id]) - 10} textAnchor="middle" fontSize="11" fill="var(--c-ink)">
                  {a.name.split('—')[0].trim()} ({totals[a.id]})
                </text>
                <text x={x(a.cost!)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="var(--c-muted)">
                  {money(a.cost)}
                </text>
              </g>
            ))}
          </svg>
        )}
        <ul className="space-y-2 text-[12.5px]">
          {alts.map((a) => (
            <li key={a.id} className="rounded-md border border-line px-3 py-2">
              <div className="font-medium">{a.name}</div>
              <div className="text-muted">
                Importance {totals[a.id]} · Cost {money(a.cost) ?? <em>unknown</em>}
              </div>
              {a.costBasis && <div className="text-[11.5px] text-faint">{a.costBasis}</div>}
            </li>
          ))}
          {unknown.length > 0 && known.length > 0 && <li className="text-[11.5px] text-warn">{unknown.length} alternative(s) without cost are not plotted.</li>}
        </ul>
      </div>
    </Card>
  )
}

function InformalScores({ decision, locked, onChange }: { decision: Decision; locked: boolean; onChange: (s: Decision['informalScores']) => void }) {
  const [open, setOpen] = useState(Object.keys(decision.informalScores).length > 0)
  const totals = informalTotals(decision)
  return (
    <Card className="border-dashed">
      <CardHeader
        eyebrow="Separate from CBA"
        title="Informal discussion scores"
        description="A quick 1–5 straw poll for workshops. This is NOT Choosing by Advantages and is never used for recommendations or exports of the formal evaluation."
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'}
          </Button>
        }
      />
      {open && (
        <div className="overflow-x-auto px-5 py-4 scroll-thin">
          <table className="table-base min-w-[520px]">
            <thead>
              <tr>
                <th>Factor</th>
                {decision.alternatives.map((a) => (
                  <th key={a.id}>{a.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decision.factors.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  {decision.alternatives.map((a) => (
                    <td key={a.id}>
                      <Select
                        aria-label={`Informal score ${f.name} ${a.name}`}
                        className="w-auto"
                        disabled={locked}
                        value={String(decision.informalScores[a.id]?.[f.id] ?? '')}
                        onChange={(e) => {
                          const next = structuredClone(decision.informalScores)
                          next[a.id] = { ...(next[a.id] ?? {}) }
                          if (e.target.value) next[a.id][f.id] = Number(e.target.value)
                          else delete next[a.id][f.id]
                          onChange(next)
                        }}
                        options={[{ value: '', label: '—' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="font-semibold">Informal total</td>
                {decision.alternatives.map((a) => (
                  <td key={a.id} className="font-semibold tabular-nums">
                    {totals[a.id] ?? '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RecommendDialog({ open, onOpenChange, decision, leaders, eligibleIds, totals }: { open: boolean; onOpenChange: (o: boolean) => void; decision: Decision; leaders: string[]; eligibleIds: string[]; totals: Record<string, number> }) {
  const { run, pending } = useProject()
  const [alt, setAlt] = useState('')
  const [rationale, setRationale] = useState('')
  useEffect(() => {
    if (open) {
      setAlt(leaders[0] ?? eligibleIds[0] ?? '')
      setRationale('')
    }
  }, [open, leaders, eligibleIds])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Recommend an alternative for ${decision.code}`}
      description="The recommendation is reviewed and approved by a different person."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!alt || rationale.trim().length < 10} onClick={async () => (await run({ type: 'decision.recommend', id: decision.id, alternativeId: alt, rationale }, 'Recommendation recorded')) !== undefined && onOpenChange(false)}>
            Record recommendation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          {decision.alternatives
            .filter((a) => eligibleIds.includes(a.id))
            .map((a) => (
              <label key={a.id} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 text-[13px]">
                <input type="radio" name="rec" className="accent-[var(--c-accent)]" checked={alt === a.id} onChange={() => setAlt(a.id)} />
                <span className="flex-1 font-medium">{a.name}</span>
                <span className="text-muted tabular-nums">Importance {totals[a.id]}</span>
                <span className="text-muted">{money(a.cost) ?? 'cost unknown'}</span>
                {leaders.includes(a.id) && <Badge tone="accent">Highest importance</Badge>}
              </label>
            ))}
        </div>
        <Field label="Rationale" required hint="Explain the choice, including how cost and importance were weighed.">
          {(id) => <Textarea id={id} value={rationale} onChange={(e) => setRationale(e.target.value)} rows={4} />}
        </Field>
      </div>
    </Dialog>
  )
}

function ApproveDialog({ open, onOpenChange, decision, eligibleIds }: { open: boolean; onOpenChange: (o: boolean) => void; decision: Decision; eligibleIds: string[] }) {
  const { run, pending, personName } = useProject()
  const [alt, setAlt] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setAlt(decision.recommendation?.alternativeId ?? '')
      setNote('')
    }
  }, [open, decision])
  const differs = alt !== decision.recommendation?.alternativeId
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Approve ${decision.code}`}
      description={`Recommended by ${personName(decision.recommendation?.by)}. Approval is recorded in your name and locks the decision.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!alt || (differs && note.trim().length < 10)} onClick={async () => (await run({ type: 'decision.approve', id: decision.id, alternativeId: alt, note }, 'Decision approved')) !== undefined && onOpenChange(false)}>
            Approve final decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Final decision">
          {(id) => <Select id={id} value={alt} onChange={(e) => setAlt(e.target.value)} options={decision.alternatives.filter((a) => eligibleIds.includes(a.id)).map((a) => ({ value: a.id, label: `${a.name}${a.id === decision.recommendation?.alternativeId ? ' (recommended)' : ''}` }))} />}
        </Field>
        {differs && <Callout tone="warn">The final decision differs from the recommendation. Record why.</Callout>}
        <Field label={differs ? 'Reason (required)' : 'Approval note'}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />}
        </Field>
      </div>
    </Dialog>
  )
}

function FrameDialog({ open, onOpenChange, decision }: { open: boolean; onOpenChange: (o: boolean) => void; decision: Decision }) {
  const { run, pending } = useProject()
  const [f, setF] = useState({ question: '', context: '', phase: decision.phase, dueDate: '', status: decision.status })
  useEffect(() => {
    if (open) setF({ question: decision.question, context: decision.context, phase: decision.phase, dueDate: decision.dueDate ?? '', status: decision.status })
  }, [open, decision])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit framing — ${decision.code}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!f.question.trim()}
            onClick={async () => {
              const status = f.status === 'framing' || f.status === 'evaluating' || f.status === 'deferred' ? f.status : undefined
              const ok = await run({ type: 'decision.update', id: decision.id, patch: { question: f.question, context: f.context, phase: f.phase, dueDate: f.dueDate || null, ...(status ? { status } : {}) }, note: 'Framing updated' }, 'Framing saved')
              if (ok !== undefined) onOpenChange(false)
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Decision question" required className="sm:col-span-2">
          {(id) => <Input id={id} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />}
        </Field>
        <Field label="Context" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} />}
        </Field>
        <Field label="Phase">{(id) => <Select id={id} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as Phase })} options={optionsFrom(PHASE_LABELS)} />}</Field>
        <Field label="Needed by">{(id) => <Input id={id} type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />}</Field>
        {decision.status !== 'recommended' && (
          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value as Decision['status'] })}
                options={[
                  { value: 'framing', label: 'Framing' },
                  { value: 'evaluating', label: 'Evaluating' },
                  { value: 'deferred', label: 'Deferred' },
                ]}
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  )
}
