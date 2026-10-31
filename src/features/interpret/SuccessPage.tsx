import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { useConfirm } from '@/components/Dialog'
import { EditableText } from '@/components/EditableText'
import { Badge, Button, Callout, cx, EmptyState, optionsFrom, PageHeader, Select } from '@/components/ui'
import { OUTCOME_CATEGORY_LABELS, OUTCOME_STATE_LABELS } from '@/domain/labels'
import type { OutcomeCategory, OutcomeState, PotentialOutcome } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'
import { ProgressList } from './progress'

const STATE_TONE: Record<OutcomeState, 'outline' | 'info' | 'ok' | 'neutral'> = { emerging: 'outline', proposed_by_bsa: 'info', validated_with_owner: 'ok', define_later: 'neutral' }

/** What Success Could Look Like — lightweight potential outcomes. No invented targets or baselines. */
export default function SuccessPage() {
  const { data, can, run } = useProject()
  const [params] = useSearchParams()
  const focus = params.get('outcome')
  const principles = data.principles.filter((p) => isActiveFramework(p.status)).sort((a, b) => a.order - b.order)
  const t = data.project.terminology

  useEffect(() => {
    if (focus) document.getElementById(`po-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus])

  const add = (principleId: string) =>
    run(
      {
        type: 'outcome.create',
        content: { statement: 'Describe what would be different if this succeeds.', principleId, opportunityId: null, category: 'qualitative', state: 'emerging', aspiration: false, possibleMeasures: '', inPresentation: false },
      },
      'Potential outcome added',
    )

  return (
    <div>
      <PageHeader
        title="What Success Could Look Like"
        description="Potential outcomes for each principle, in plain language. Some may become measurable later; many are better described than scored."
      />
      <Callout tone="neutral">
        Nothing here is a target. Targets and baselines are only set with the Owner, with a source, in the{' '}
        <Link className="underline" to={`/projects/${data.project.id}/drivers`}>
          {t.designDriver}s
        </Link>{' '}
        register.
      </Callout>
      <div className="mt-6 space-y-8">
        {principles.length === 0 && <EmptyState title="No principles yet">Potential outcomes are organized by guiding principle.</EmptyState>}
        {principles.map((p) => {
          const items = data.outcomes.filter((o) => o.principleId === p.id).sort((a, b) => a.order - b.order)
          return (
            <section key={p.id} aria-labelledby={`out-${p.id}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
                <div>
                  <span className="font-mono text-[11px] text-muted">{p.code}</span>
                  <h2 id={`out-${p.id}`} className="text-[17px] font-bold">
                    {p.title}
                  </h2>
                </div>
                {can('framework.edit') && (
                  <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => add(p.id)} aria-label={`Add potential outcome for ${p.code}`}>
                    Add outcome
                  </Button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-[13px] text-muted">No potential outcomes yet.</p>
              ) : (
                <ul className="grid gap-3 @4xl:grid-cols-2">
                  {items.map((o) => (
                    <OutcomeCard key={o.id} o={o} focused={focus === o.id} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function OutcomeCard({ o, focused }: { o: PotentialOutcome; focused: boolean }) {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const edit = can('framework.edit')
  const update = (patch: Partial<PotentialOutcome>, msg?: string) => run({ type: 'outcome.update', id: o.id, patch }, msg)
  const opportunities = data.opportunities.filter((x) => x.principleIds.includes(o.principleId))
  return (
    <li id={`po-${o.id}`} className={cx('rounded-lg border bg-surface p-4 shadow-card scroll-mt-24', focused ? 'border-ink ring-2 ring-accent/50' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="code-tag">{o.code}</span>
        <Badge tone={STATE_TONE[o.state]}>{OUTCOME_STATE_LABELS[o.state]}</Badge>
        <Badge tone="outline">{OUTCOME_CATEGORY_LABELS[o.category]}</Badge>
        {o.aspiration && <Badge tone="neutral">Aspiration</Badge>}
        {edit && (
          <button
            aria-label={`Delete ${o.code}`}
            className="ml-auto rounded p-1.5 text-muted hover:bg-sunken hover:text-danger"
            onClick={async () => {
              const r = await confirm({ title: `Delete ${o.code}?`, body: 'Its evidence of progress will also be removed.', confirmLabel: 'Delete', tone: 'danger' })
              if (r.confirmed) run({ type: 'outcome.delete', id: o.id }, `${o.code} deleted`)
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <EditableText className="mt-2" label="Outcome statement" value={o.statement} canEdit={edit} rows={2} onSave={(v) => v && update({ statement: v }, 'Saved')} display={(v) => <p className="text-[15px] font-semibold text-ink">{v}</p>} />
      <div className="mt-3">
        <div className="eyebrow mb-1">Possible ways to tell</div>
        <EditableText label="Possible measures" value={o.possibleMeasures} canEdit={edit} rows={2} placeholder="Optional — how might we know? No targets." onSave={(v) => update({ possibleMeasures: v }, 'Saved')} />
      </div>
      {edit && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 text-[12px] sm:grid-cols-2">
          <Select aria-label={`${o.code} category`} className="h-8 py-0 text-[12px]" value={o.category} onChange={(e) => update({ category: e.target.value as OutcomeCategory })} options={optionsFrom(OUTCOME_CATEGORY_LABELS)} />
          <Select aria-label={`${o.code} state`} className="h-8 py-0 text-[12px]" value={o.state} onChange={(e) => update({ state: e.target.value as OutcomeState }, 'State updated')} options={optionsFrom(OUTCOME_STATE_LABELS)} />
          <Select
            aria-label={`${o.code} design opportunity`}
            className="h-8 py-0 text-[12px] sm:col-span-2"
            value={o.opportunityId ?? ''}
            onChange={(e) => update({ opportunityId: e.target.value || null })}
            options={[{ value: '', label: 'No linked opportunity' }, ...opportunities.map((x) => ({ value: x.id, label: `${x.code} ${x.title}` }))]}
          />
        </div>
      )}
      {!edit && o.opportunityId && <p className="mt-2 text-[12px] text-muted">Opportunity: {data.opportunities.find((x) => x.id === o.opportunityId)?.title}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={o.aspiration} disabled={!edit} onChange={(e) => update({ aspiration: e.target.checked })} />
          Aspiration — no reliable measure yet
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={o.inPresentation} disabled={!edit} onChange={(e) => update({ inPresentation: e.target.checked })} />
          Include in Owner presentation
        </label>
      </div>
      <details className="mt-3 border-t border-line pt-2">
        <summary className="cursor-pointer text-[12px] text-muted">Evidence of progress ({o.evidenceOfProgress.length})</summary>
        <div className="mt-2">
          <ProgressList outcome={o} />
        </div>
      </details>
    </li>
  )
}
