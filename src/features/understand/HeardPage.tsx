import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Quote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { EditableText } from '@/components/EditableText'
import { LinkedChips, NodePicker } from '@/components/Evidence'
import { OriginBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, Card, cx, EmptyState, Field, Input, optionsFrom, PageHeader, Segmented, Select, Textarea } from '@/components/ui'
import { HEARD_SECTION_LABELS } from '@/domain/labels'
import { HEARD_SECTIONS, type HeardItem, type HeardSection, type NodeRef } from '@/domain/types'

const SECTION_HINTS: Record<HeardSection, string> = {
  aspiration: 'What people hope this project will make possible.',
  theme: 'Ideas that recur across sources and voices.',
  tension: 'Where needs or priorities pull against each other.',
  perspective: 'How different groups see the project.',
  priority: 'What appears to matter most — including what is critical but rarely said.',
}

export default function HeardPage() {
  const { data, can } = useProject()
  const [mode, setMode] = useState<'compose' | 'preview'>('compose')
  const [adding, setAdding] = useState<HeardSection | null>(null)
  const items = [...data.heard].sort((a, b) => a.order - b.order)
  return (
    <div>
      <PageHeader
        title="What We Heard"
        description="A concise, evidence-backed synthesis of what the Owner and stakeholders told us — the bridge from listening to interpretation."
        actions={
          <>
            <Segmented
              label="View"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'compose',
                  label: 'Compose',
                  icon: <Pencil className="size-3.5" />,
                },
                {
                  value: 'preview',
                  label: 'Owner-ready preview',
                  icon: <Eye className="size-3.5" />,
                },
              ]}
            />
            {mode === 'compose' && can('theme.edit') && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding('aspiration')}>
                Add item
              </Button>
            )}
          </>
        }
      />
      {mode === 'compose' ? (
        <div className="space-y-6">
          {HEARD_SECTIONS.map((section) => (
            <HeardSectionCard key={section} section={section} items={items.filter((i) => i.section === section)} onAdd={() => setAdding(section)} />
          ))}
        </div>
      ) : (
        <HeardPreview items={items} />
      )}
      <HeardDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} section={adding ?? 'aspiration'} />
    </div>
  )
}

function HeardSectionCard({ section, items, onAdd }: { section: HeardSection; items: HeardItem[]; onAdd: () => void }) {
  const { can, run } = useProject()
  const move = (id: string, dir: -1 | 1) => {
    const ids = items.map((i) => i.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    run({ type: 'heard.reorder', orderedIds: ids })
  }
  return (
    <section aria-labelledby={`heard-${section}`}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 id={`heard-${section}`} className="text-[16px] font-bold text-ink">
            {HEARD_SECTION_LABELS[section]}
          </h2>
          <p className="text-[12.5px] text-muted">{SECTION_HINTS[section]}</p>
        </div>
        {can('theme.edit') && (
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={onAdd} aria-label={`Add to ${HEARD_SECTION_LABELS[section]}`}>
            Add
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-3 text-[13px] text-muted">Nothing captured yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((h, i) => (
            <HeardRow key={h.id} h={h} first={i === 0} last={i === items.length - 1} onMove={(dir) => move(h.id, dir)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function HeardRow({ h, first, last, onMove }: { h: HeardItem; first: boolean; last: boolean; onMove: (dir: -1 | 1) => void }) {
  const { can, run, personName } = useProject()
  const confirm = useConfirm()
  const [picking, setPicking] = useState<'statement' | 'theme' | null>(null)
  const edit = can('theme.edit')
  const update = (patch: Record<string, unknown>, msg?: string) => run({ type: 'heard.update', id: h.id, patch }, msg)
  const setEvidence = (type: 'statement' | 'theme', ids: string[]) => {
    const keep = h.evidence.filter((e) => e.type !== type)
    return update({ evidence: [...keep, ...ids.map((id): NodeRef => ({ type, id }))] }, 'Evidence updated')
  }
  return (
    <li className={cx('rounded-lg border bg-surface p-4 shadow-card', h.reviewed ? 'border-line' : 'border-dashed border-ai/50')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <EditableText label="Title" multiline={false} value={h.title} canEdit={edit} onSave={(v) => v && update({ title: v }, 'Saved')} display={(v) => <h3 className="text-[15px] font-semibold text-ink">{v}</h3>} />
          <EditableText label="Narrative" value={h.narrative} canEdit={edit} rows={3} placeholder="Summarize what was heard, in plain language." onSave={(v) => update({ narrative: v }, 'Saved')} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {edit && (
            <>
              <button aria-label={`Move “${h.title}” up`} disabled={first} className="rounded p-1 text-faint hover:bg-sunken hover:text-ink disabled:opacity-30" onClick={() => onMove(-1)}>
                <ArrowUp className="size-3.5" />
              </button>
              <button aria-label={`Move “${h.title}” down`} disabled={last} className="rounded p-1 text-faint hover:bg-sunken hover:text-ink disabled:opacity-30" onClick={() => onMove(1)}>
                <ArrowDown className="size-3.5" />
              </button>
              <button
                aria-label={`Delete “${h.title}”`}
                className="rounded p-1 text-faint hover:bg-sunken hover:text-danger"
                onClick={async () => {
                  const r = await confirm({
                    title: 'Remove this item?',
                    body: `“${h.title}” will be removed from What We Heard. Source evidence is not affected.`,
                    confirmLabel: 'Remove',
                    tone: 'danger',
                  })
                  if (r.confirmed) run({ type: 'heard.delete', id: h.id }, 'Removed')
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="eyebrow">Evidence</span>
        <LinkedChips refs={h.evidence} empty="No evidence linked — an observation, not a finding" />
        {edit && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setPicking('statement')}>
              Statements…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking('theme')}>
              Themes…
            </Button>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[12px] text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={h.inPresentation} disabled={!edit} onChange={(e) => update({ inPresentation: e.target.checked })} />
          Include in Owner presentation
        </label>
        {edit && (
          <label className="flex items-center gap-1.5">
            Section
            <Select aria-label="Section" className="h-7 w-auto py-0 text-[12px]" value={h.section} onChange={(e) => update({ section: e.target.value }, 'Moved')} options={optionsFrom(HEARD_SECTION_LABELS)} />
          </label>
        )}
        {h.origin !== 'human' && <OriginBadge origin={h.origin} />}
        {!h.reviewed && (
          <span className="flex items-center gap-2">
            <Badge tone="ai">Needs team review</Badge>
            {edit && (
              <Button size="sm" onClick={() => update({ reviewed: true }, 'Marked reviewed')}>
                Mark reviewed
              </Button>
            )}
          </span>
        )}
        <span className="ml-auto">
          {personName(h.updatedBy)} · {formatDate(h.updatedAt)}
        </span>
      </div>
      {picking === 'statement' && (
        <NodePicker
          open
          onOpenChange={(o) => !o && setPicking(null)}
          type="statement"
          title="Link source statements"
          initial={h.evidence.filter((e) => e.type === 'statement').map((e) => e.id)}
          confirmLabel="Save evidence"
          onPick={async (ids) => {
            if ((await setEvidence('statement', ids)) !== undefined) setPicking(null)
          }}
        />
      )}
      {picking === 'theme' && (
        <NodePicker
          open
          onOpenChange={(o) => !o && setPicking(null)}
          type="theme"
          title="Link themes"
          initial={h.evidence.filter((e) => e.type === 'theme').map((e) => e.id)}
          confirmLabel="Save evidence"
          onPick={async (ids) => {
            if ((await setEvidence('theme', ids)) !== undefined) setPicking(null)
          }}
        />
      )}
    </li>
  )
}

function HeardDialog({ open, onOpenChange, section }: { open: boolean; onOpenChange: (o: boolean) => void; section: HeardSection }) {
  const { run } = useProject()
  const [form, setForm] = useState({ section, title: '', narrative: '' })
  const [last, setLast] = useState(open)
  if (open !== last) {
    setLast(open)
    if (open) setForm({ section, title: '', narrative: '' })
  }
  const save = async () => {
    const id = await run(
      {
        type: 'heard.create',
        item: { ...form, evidence: [], inPresentation: true },
      },
      'Added to What We Heard',
    )
    if (id !== undefined) onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add to What We Heard"
      description="Write it in the Owner’s language. Link evidence after saving."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!form.title.trim()} onClick={save}>
            Add item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Section">{(id) => <Select id={id} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as HeardSection })} options={optionsFrom(HEARD_SECTION_LABELS)} />}</Field>
        <Field label="Title" required>
          {(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Narrative">{(id) => <Textarea id={id} rows={4} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />}</Field>
      </div>
    </Dialog>
  )
}

/** Owner-ready view: only reviewed items marked for the presentation, with verbatim supporting quotes. */
function HeardPreview({ items }: { items: HeardItem[] }) {
  const { data } = useProject()
  const shown = items.filter((i) => i.inPresentation && i.reviewed)
  const hidden = items.filter((i) => i.inPresentation && !i.reviewed).length
  const excluded = items.filter((i) => !i.inPresentation).length
  if (!shown.length) return <EmptyState title="Nothing is ready to present">Mark reviewed items “Include in Owner presentation” to build the preview.</EmptyState>
  return (
    <div className="space-y-4">
      {(hidden > 0 || excluded > 0) && (
        <Callout tone="neutral" icon={<EyeOff className="size-4" />}>
          {excluded > 0 && `${excluded} item(s) are excluded from the presentation. `}
          {hidden > 0 && `${hidden} item(s) are hidden until the team reviews them.`}
        </Callout>
      )}
      <Card className="px-6 py-8 sm:px-10">
        <div className="eyebrow">{data.project.owner.name}</div>
        <h2 className="mt-1 text-[30px] leading-tight font-black tracking-tight">What We Heard</h2>
        <p className="mt-1 text-[13.5px] text-muted">{data.project.name}</p>
        <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
          {HEARD_SECTIONS.map((section) => {
            const list = shown.filter((i) => i.section === section)
            if (!list.length) return null
            return (
              <section key={section} aria-label={HEARD_SECTION_LABELS[section]}>
                <h3 className="border-b-2 border-accent pb-1 text-[12px] font-black tracking-[0.08em] uppercase">{HEARD_SECTION_LABELS[section]}</h3>
                <ul className="mt-3 space-y-4">
                  {list.map((h) => {
                    const quote = h.evidence
                      .filter((e) => e.type === 'statement')
                      .map((e) => data.statements.find((s) => s.id === e.id))
                      .find(Boolean)
                    return (
                      <li key={h.id}>
                        <p className="text-[15px] font-bold text-ink">{h.title}</p>
                        {h.narrative && <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{h.narrative}</p>}
                        {quote && (
                          <p className="mt-1.5 flex gap-1.5 text-[13px]">
                            <Quote className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                            <span>
                              <span className="quote">“{quote.originalText}”</span>
                              {quote.speaker && <span className="text-muted"> — {quote.speaker}</span>}
                            </span>
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
