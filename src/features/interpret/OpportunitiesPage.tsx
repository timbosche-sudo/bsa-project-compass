import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { useConfirm } from '@/components/Dialog'
import { EditableText } from '@/components/EditableText'
import { LinkedChips, NodePicker } from '@/components/Evidence'
import { OriginBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, cx, EmptyState, optionsFrom, PageHeader, Select } from '@/components/ui'
import { OPPORTUNITY_STATE_LABELS } from '@/domain/labels'
import type { DesignOpportunity, GuidingPrinciple, OpportunityState } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'

/** Emerging Design Opportunities — where principles open up possibilities. Directions to explore, not solutions. */
export default function OpportunitiesPage() {
  const { data, can, run } = useProject()
  const [params] = useSearchParams()
  const focus = params.get('opportunity')
  const principles = data.principles.filter((p) => isActiveFramework(p.status)).sort((a, b) => a.order - b.order)
  const opportunities = [...data.opportunities].sort((a, b) => a.order - b.order)
  const primary = (o: DesignOpportunity) => principles.find((p) => o.principleIds.includes(p.id))?.id ?? null
  const unlinked = opportunities.filter((o) => primary(o) === null)

  useEffect(() => {
    if (focus) document.getElementById(`opp-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus])

  const add = (principleId: string | null) =>
    run(
      { type: 'opportunity.create', content: { title: 'New design opportunity', description: '', principleIds: principleId ? [principleId] : [], state: 'emerging', inPresentation: false, linkedDriverIds: [] } },
      'Opportunity added',
    )

  return (
    <div>
      <PageHeader
        title="Emerging Design Opportunities"
        description="Where each principle opens up possibilities for the design. These are directions to explore with the Owner — not solutions, requirements or commitments."
      />
      <Callout tone="neutral">
        Design Opportunities can later be linked to formal {data.project.terminology.designDriver}s with measures and targets. Existing drivers are unchanged.
      </Callout>
      <div className="mt-6 space-y-8">
        {principles.length === 0 && <EmptyState title="No principles yet">Opportunities are organized by guiding principle. Draft principles first.</EmptyState>}
        {principles.map((p) => (
          <PrincipleGroup key={p.id} p={p} items={opportunities.filter((o) => primary(o) === p.id)} focus={focus} onAdd={can('framework.edit') ? () => add(p.id) : undefined} />
        ))}
        {unlinked.length > 0 && (
          <section aria-label="Not linked to a principle">
            <h2 className="mb-2 text-[16px] font-bold">Not yet linked to a principle</h2>
            <ul className="grid gap-3 @4xl:grid-cols-2">
              {unlinked.map((o) => (
                <OpportunityCard key={o.id} o={o} focused={focus === o.id} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function PrincipleGroup({ p, items, focus, onAdd }: { p: GuidingPrinciple; items: DesignOpportunity[]; focus: string | null; onAdd?: () => void }) {
  const { data } = useProject()
  return (
    <section aria-labelledby={`grp-${p.id}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
        <div>
          <Link to={`/projects/${data.project.id}/interpret/principles?principle=${p.id}`} className="font-mono text-[11px] text-muted hover:text-ink">
            {p.code}
          </Link>
          <h2 id={`grp-${p.id}`} className="text-[17px] font-bold text-ink">
            {p.title}
          </h2>
          {p.designImplications && <p className="mt-0.5 max-w-3xl text-[12.5px] text-muted">{p.designImplications}</p>}
        </div>
        {onAdd && (
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={onAdd} aria-label={`Add opportunity for ${p.code}`}>
            Add opportunity
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">No opportunities captured for this principle yet.</p>
      ) : (
        <ul className="grid gap-3 @4xl:grid-cols-2 @7xl:grid-cols-3">
          {items.map((o) => (
            <OpportunityCard key={o.id} o={o} focused={focus === o.id} />
          ))}
        </ul>
      )}
    </section>
  )
}

function OpportunityCard({ o, focused }: { o: DesignOpportunity; focused: boolean }) {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const [picking, setPicking] = useState<'principle' | 'driver' | null>(null)
  const edit = can('framework.edit')
  const update = (patch: Partial<DesignOpportunity>, msg?: string) => run({ type: 'opportunity.update', id: o.id, patch }, msg)
  const outcomes = data.outcomes.filter((x) => x.opportunityId === o.id).length
  return (
    <li id={`opp-${o.id}`} className={cx('flex flex-col rounded-lg border bg-surface p-4 shadow-card scroll-mt-24', focused ? 'border-ink ring-2 ring-accent/50' : 'border-line')}>
      <div className="flex items-center gap-2">
        <span className="code-tag">{o.code}</span>
        <Badge tone={o.state === 'validated' ? 'ok' : o.state === 'proposed' ? 'info' : 'outline'}>{OPPORTUNITY_STATE_LABELS[o.state]}</Badge>
        {o.origin !== 'human' && <OriginBadge origin={o.origin} />}
        {edit && (
          <button
            aria-label={`Delete ${o.code}`}
            className="ml-auto rounded p-1.5 text-muted hover:bg-sunken hover:text-danger"
            onClick={async () => {
              const r = await confirm({ title: `Delete ${o.code}?`, body: 'Potential outcomes linked to it are kept but lose the link.', confirmLabel: 'Delete', tone: 'danger' })
              if (r.confirmed) run({ type: 'opportunity.delete', id: o.id }, `${o.code} deleted`)
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <EditableText className="mt-2" label="Opportunity title" multiline={false} value={o.title} canEdit={edit} onSave={(v) => v && update({ title: v }, 'Saved')} display={(v) => <h3 className="text-[15px] font-semibold text-ink">{v}</h3>} />
      <EditableText className="mt-1" label="Opportunity description" value={o.description} canEdit={edit} rows={3} placeholder="What possibility does this open up?" onSave={(v) => update({ description: v }, 'Saved')} />
      <dl className="mt-3 space-y-2 border-t border-line pt-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="eyebrow w-20">Principles</dt>
          <dd className="flex flex-1 flex-wrap items-center gap-1.5">
            <LinkedChips refs={o.principleIds.map((id) => ({ type: 'principle' as const, id }))} />
            {edit && (
              <button className="text-muted underline hover:text-ink" onClick={() => setPicking('principle')}>
                Edit
              </button>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="eyebrow w-20">Drivers</dt>
          <dd className="flex flex-1 flex-wrap items-center gap-1.5">
            <LinkedChips refs={o.linkedDriverIds.map((id) => ({ type: 'driver' as const, id }))} empty="Not linked" />
            {edit && (
              <button className="text-muted underline hover:text-ink" onClick={() => setPicking('driver')}>
                Link
              </button>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="eyebrow w-20">Outcomes</dt>
          <dd>
            <Link className="text-ink-2 underline decoration-accent decoration-2 underline-offset-2" to={`/projects/${data.project.id}/interpret/success`}>
              {outcomes} potential outcome{outcomes === 1 ? '' : 's'}
            </Link>
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-[12px] text-muted">
        {edit ? (
          <Select aria-label={`${o.code} state`} className="h-7 w-auto py-0 text-[12px]" value={o.state} onChange={(e) => update({ state: e.target.value as OpportunityState }, 'State updated')} options={optionsFrom(OPPORTUNITY_STATE_LABELS)} />
        ) : null}
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={o.inPresentation} disabled={!edit} onChange={(e) => update({ inPresentation: e.target.checked })} />
          Include in Owner presentation
        </label>
      </div>
      {picking && (
        <NodePicker
          open
          onOpenChange={(v) => !v && setPicking(null)}
          type={picking}
          title={picking === 'principle' ? 'Link principles' : `Link ${data.project.terminology.designDriver}s`}
          initial={picking === 'principle' ? o.principleIds : o.linkedDriverIds}
          confirmLabel="Save links"
          onPick={async (ids) => {
            if ((await update(picking === 'principle' ? { principleIds: ids } : { linkedDriverIds: ids }, 'Links updated')) !== undefined) setPicking(null)
          }}
        />
      )}
    </li>
  )
}
