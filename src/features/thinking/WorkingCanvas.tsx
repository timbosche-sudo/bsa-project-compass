import { ArrowUpRight, Link2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { EditableText } from '@/components/EditableText'
import { LinkedChips, NodePicker } from '@/components/Evidence'
import { Badge, Button, cx, Field, Input, optionsFrom, Select } from '@/components/ui'
import { HEARD_SECTION_LABELS } from '@/domain/labels'
import type { CanvasItem, CanvasKind, CanvasState, HeardSection, NodeRef, PromoteTarget } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'
import { WORKSPACES, type Workspace } from '@/services/thinking/context'
import { methodLabel } from './SuggestionCard'

export const CANVAS_KIND_LABELS: Record<CanvasKind, string> = {
  interpretation: 'Emerging interpretation',
  question: 'Question worth exploring',
  connection: 'Possible connection',
  narrative: 'Alternative narrative',
  opportunity: 'Potential design opportunity',
  needs_evidence: 'Needs more evidence',
}
export const CANVAS_STATE_LABELS: Record<CanvasState, string> = { exploring: 'Exploring', worth_developing: 'Worth developing', incorporated: 'Incorporated', set_aside: 'Set aside' }

const PROMOTE_LABELS: Record<PromoteTarget, string> = {
  question: 'Critical Question',
  heard: 'What We Heard (draft, needs review)',
  pov_alternative: 'Point of View — alternative direction',
  vision_draft: 'Vision alternative (proposed)',
  opportunity: 'Design Opportunity (emerging)',
  outcome: 'Potential Outcome (emerging)',
}
const SUGGESTED_TARGET: Record<CanvasKind, PromoteTarget> = {
  interpretation: 'pov_alternative',
  question: 'question',
  connection: 'heard',
  narrative: 'vision_draft',
  opportunity: 'opportunity',
  needs_evidence: 'question',
}

/**
 * The Working Canvas: an informal space for ideas, kept apart from project
 * content. No assignments, schedules or approvals — just ideas and their state.
 */
export function WorkingCanvas({ workspace, focus }: { workspace: Workspace; focus: NodeRef | null }) {
  const { data, can, run } = useProject()
  const [filter, setFilter] = useState<'active' | 'incorporated' | 'set_aside'>('active')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ kind: 'interpretation' as CanvasKind, title: '' })
  const items = [...data.canvas]
    .filter((i) => (filter === 'active' ? i.state === 'exploring' || i.state === 'worth_developing' : i.state === filter))
    .sort((a, b) => (a.state === 'worth_developing' ? -1 : 0) - (b.state === 'worth_developing' ? -1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
  const count = (f: typeof filter) => data.canvas.filter((i) => (f === 'active' ? i.state === 'exploring' || i.state === 'worth_developing' : i.state === f)).length
  const add = async () => {
    const id = await run({ type: 'canvas.create', item: { kind: form.kind, title: form.title, body: '', evidence: focus ? [focus] : [], context: { workspace, focus } }, origin: 'human', sourceSuggestionId: null }, 'Idea added')
    if (id) {
      setAdding(false)
      setForm({ ...form, title: '' })
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Canvas filter">
        {(['active', 'incorporated', 'set_aside'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cx('min-h-8 rounded-full border px-3 text-[12px] font-medium', filter === f ? 'border-ink bg-inverse text-on-inverse' : 'border-line-strong text-muted hover:text-ink')}
          >
            {f === 'active' ? 'In progress' : CANVAS_STATE_LABELS[f]} ({count(f)})
          </button>
        ))}
        {can('suggestion.request') && (
          <Button size="sm" className="ml-auto" icon={<Plus className="size-3.5" />} onClick={() => setAdding(!adding)}>
            New idea
          </Button>
        )}
      </div>
      {adding && (
        <form
          className="space-y-2 rounded-md border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (form.title.trim()) void add()
          }}
        >
          <Select aria-label="Kind of idea" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CanvasKind })} options={optionsFrom(CANVAS_KIND_LABELS)} />
          <Input aria-label="Idea" placeholder="Capture the idea in a sentence…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" variant="primary" disabled={!form.title.trim()}>
              Add to canvas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-muted">
          {filter === 'active' ? 'Nothing on the canvas yet. Save a suggestion, develop an exploration, or add your own idea.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="space-y-2.5" aria-label="Working Canvas">
          {items.map((i) => (
            <CanvasCard key={i.id} item={i} />
          ))}
        </ul>
      )}
      <p className="text-[11.5px] text-muted">Canvas ideas are not project content. Promoting one creates a draft for review; it never changes existing or approved content.</p>
    </div>
  )
}

function CanvasCard({ item }: { item: CanvasItem }) {
  const { data, can, run, personName } = useProject()
  const confirm = useConfirm()
  const [picking, setPicking] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const edit = can('suggestion.request') && item.state !== 'incorporated'
  const update = (patch: Partial<CanvasItem>, msg?: string) => run({ type: 'canvas.update', id: item.id, patch }, msg)
  const ws = WORKSPACES[item.context.workspace as Workspace]
  return (
    <li className={cx('rounded-lg border border-line bg-surface p-3', item.state === 'worth_developing' && 'border-l-4 border-l-ok-fill', item.state === 'set_aside' && 'opacity-80')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="outline">{CANVAS_KIND_LABELS[item.kind]}</Badge>
        <Badge tone={item.origin === 'human' ? 'neutral' : 'ai'}>{item.origin === 'human' ? 'Human-authored' : `Started from ${methodLabel(item.origin).toLowerCase()}`}</Badge>
        {edit && (
          <button aria-label={`Delete idea: ${item.title}`} className="ml-auto rounded p-1.5 text-muted hover:text-danger" onClick={async () => (await confirm({ title: 'Remove this idea?', confirmLabel: 'Remove', tone: 'danger' })).confirmed && run({ type: 'canvas.delete', id: item.id }, 'Removed')}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <EditableText className="mt-2" label="Idea" multiline={false} value={item.title} canEdit={edit} onSave={(v) => v && update({ title: v }, 'Saved')} display={(v) => <p className="text-[13.5px] font-semibold text-ink">{v}</p>} />
      <EditableText className="mt-1" label="Notes" value={item.body} canEdit={edit} rows={3} placeholder="Develop the idea: what it means, why it might matter, what would test it." onSave={(v) => update({ body: v }, 'Saved')} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <LinkedChips refs={item.evidence} empty="No evidence linked" />
        {edit && (
          <button className="flex min-h-7 items-center gap-1 text-muted underline hover:text-ink" onClick={() => setPicking(true)}>
            <Link2 className="size-3" /> Link statements
          </button>
        )}
      </div>
      {item.promotedTo && (
        <p className="mt-2 rounded-md bg-ok-soft/50 px-2.5 py-1.5 text-[12px] text-ink-2">
          Promoted to {item.promotedTo.label} · {formatDate(item.promotedTo.at)}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        {item.state !== 'incorporated' && (
          <div role="radiogroup" aria-label="State" className="flex flex-wrap gap-1">
            {(['exploring', 'worth_developing', 'set_aside'] as CanvasState[]).map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={item.state === st}
                disabled={!edit}
                onClick={() => update({ state: st })}
                className={cx('min-h-8 rounded-md px-2 text-[12px] font-medium', item.state === st ? 'bg-inverse text-on-inverse' : 'text-muted hover:bg-sunken hover:text-ink')}
              >
                {CANVAS_STATE_LABELS[st]}
              </button>
            ))}
          </div>
        )}
        {edit && (
          <Button size="sm" className="ml-auto" icon={<ArrowUpRight className="size-3.5" />} onClick={() => setPromoting(true)}>
            Promote…
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        {ws ? `${ws.stage} · ${ws.label}` : 'Project'} · {personName(item.updatedBy)} · {formatDate(item.updatedAt)}
      </p>
      {picking && (
        <NodePicker
          open
          onOpenChange={(o) => !o && setPicking(false)}
          type="statement"
          title="Link supporting statements"
          initial={item.evidence.filter((e) => e.type === 'statement').map((e) => e.id)}
          confirmLabel="Save links"
          onPick={async (ids) => {
            const keep = item.evidence.filter((e) => e.type !== 'statement')
            if ((await update({ evidence: [...keep, ...ids.map((id) => ({ type: 'statement' as const, id }))] }, 'Evidence linked')) !== undefined) setPicking(false)
          }}
        />
      )}
      {promoting && <PromoteDialog item={item} onClose={() => setPromoting(false)} principles={data.principles.filter((p) => isActiveFramework(p.status))} />}
    </li>
  )
}

function PromoteDialog({ item, onClose, principles }: { item: CanvasItem; onClose: () => void; principles: { id: string; code: string; title: string }[] }) {
  const { run } = useProject()
  const [target, setTarget] = useState<PromoteTarget>(SUGGESTED_TARGET[item.kind])
  const focusPrinciple = item.context.focus?.type === 'principle' ? item.context.focus.id : ''
  const [principleId, setPrincipleId] = useState(focusPrinciple || principles[0]?.id || '')
  const [section, setSection] = useState<HeardSection>('theme')
  const needsPrinciple = target === 'opportunity' || target === 'outcome'
  const promote = async () => {
    const r = await run({ type: 'canvas.promote', id: item.id, target, principleId: needsPrinciple ? principleId : undefined, section: target === 'heard' ? section : undefined }, `Promoted to ${PROMOTE_LABELS[target]}`)
    if (r !== undefined) onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Promote this idea"
      description="Creates a new draft in the chosen area, linked to the same evidence. Existing and approved content is never changed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={needsPrinciple && !principleId} onClick={promote}>
            Create draft
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <blockquote className="border-l-2 border-line-strong pl-3 text-[13px]">
          <strong>{item.title}</strong>
          {item.body && <span className="mt-1 block text-ink-2">{item.body}</span>}
        </blockquote>
        <Field label="Promote to">{(id) => <Select id={id} value={target} onChange={(e) => setTarget(e.target.value as PromoteTarget)} options={optionsFrom(PROMOTE_LABELS)} />}</Field>
        {needsPrinciple && (
          <Field label="Principle">{(id) => <Select id={id} value={principleId} onChange={(e) => setPrincipleId(e.target.value)} options={principles.map((p) => ({ value: p.id, label: `${p.code} ${p.title}` }))} />}</Field>
        )}
        {target === 'heard' && <Field label="What We Heard section">{(id) => <Select id={id} value={section} onChange={(e) => setSection(e.target.value as HeardSection)} options={optionsFrom(HEARD_SECTION_LABELS)} />}</Field>}
      </div>
    </Dialog>
  )
}
