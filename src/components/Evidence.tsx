import { Link2, Plus, Quote, Search, Trash2, Check, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { NODE_TYPE_LABELS, RELATIONSHIP_LABELS, SOURCE_TYPE_LABELS } from '@/domain/labels'
import { evidenceFor, nodeLabel, nodePath, sameRef } from '@/domain/traceability'
import type { NodeRef, NodeType, RelationshipType, Statement } from '@/domain/types'
import { Dialog, useConfirm } from './Dialog'
import { ConfidenceBadge, CriticalityBadge, KindBadge, OriginBadge, TranscriptionBadge } from './StatusBadge'
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Select } from './ui'
import { isActiveFramework } from '@/domain/wording'

/** Verbatim stakeholder wording, always visually distinct from interpretation. */
export function StatementQuote({ statement, compact, showSource = true }: { statement: Statement; compact?: boolean; showSource?: boolean }) {
  const { data } = useProject()
  const src = data.sources.find((s) => s.id === statement.sourceId)
  return (
    <figure className={cx('min-w-0', compact ? '' : 'space-y-2')}>
      <blockquote className={cx('quote border-l-2 border-accent pl-3', compact ? 'text-[13px]' : 'text-[14px]')}>
        <span className="sr-only">Original wording: </span>“{highlightUncertain(statement.originalText, statement.uncertainWords)}”
      </blockquote>
      <figcaption className="flex flex-wrap items-center gap-1.5 pl-3 text-[11.5px] text-muted">
        <Link to={nodePath(data.project.id, { type: 'statement', id: statement.id })} className="font-mono hover:text-ink">
          {statement.code}
        </Link>
        {showSource && src && (
          <>
            <span aria-hidden>·</span>
            <Link to={nodePath(data.project.id, { type: 'source', id: src.id })} className="hover:text-ink">
              {src.code} {SOURCE_TYPE_LABELS[src.type]}
            </Link>
          </>
        )}
        {statement.locator.kind !== 'none' && (
          <span>
            · {statement.locator.kind} {statement.locator.value}
          </span>
        )}
        {statement.speaker && <span>· {statement.speaker}</span>}
        {!compact && (
          <>
            <KindBadge kind={statement.kind} />
            <CriticalityBadge level={statement.criticality} />
            <TranscriptionBadge status={statement.transcriptionStatus} />
          </>
        )}
      </figcaption>
      {!compact && statement.interpretation && (
        <div className="ml-3 rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">
          <span className="mr-1.5 font-semibold text-muted">Interpretation{statement.interpretationOrigin === 'ai' ? ' (AI)' : ''}:</span>
          {statement.interpretation}
        </div>
      )}
    </figure>
  )
}

export function highlightUncertain(text: string, words: string[]) {
  if (!words.length) return text
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} className="rounded-sm bg-warn-soft px-0.5 text-warn underline decoration-dotted" title="Uncertain transcription">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/** Evidence supporting a node: direct links, theme-derived, and inherited — labelled separately. */
export function EvidencePanel({ target, allowLink = true }: { target: NodeRef; allowLink?: boolean }) {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const [picking, setPicking] = useState(false)
  const ev = evidenceFor(data, target)
  const directRels = data.relationships.filter((r) => r.from.type === 'statement' && sameRef(r.to, target) && r.status !== 'rejected')
  const proposed = directRels.filter((r) => r.status === 'proposed')

  const groups: { title: string; hint: string; items: Statement[] }[] = [
    { title: 'Direct evidence', hint: 'Statements explicitly linked to this item.', items: ev.direct },
    { title: 'Via themes', hint: 'Statements grouped in themes that inform this item.', items: ev.viaThemes },
    { title: 'Inherited from principles', hint: 'Evidence for the principles this driver implements.', items: ev.inherited },
  ].filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      {proposed.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow">Awaiting review</div>
          {proposed.map((r) => {
            const s = data.statements.find((x) => x.id === r.from.id)
            if (!s) return null
            return (
              <div key={r.id} className="rounded-md border border-dashed border-ai/40 bg-ai-soft/40 p-3">
                <StatementQuote statement={s} compact />
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-3">
                  <OriginBadge origin={r.origin} />
                  <ConfidenceBadge level={r.confidence} />
                  {r.explanation && <span className="text-[12px] text-ink-2">{r.explanation}</span>}
                  {can('relationship.review') && (
                    <span className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} onClick={() => run({ type: 'relationship.review', id: r.id, decision: 'accepted' }, 'Evidence link accepted')}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run({ type: 'relationship.review', id: r.id, decision: 'rejected' }, 'Suggestion rejected')}>
                        Reject
                      </Button>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {groups.length === 0 && proposed.length === 0 && (
        <EmptyState title="No supporting evidence" icon={<Quote className="size-5" />}>
          This item is not yet traceable to any source statement. Unsupported items are flagged in the Alignment Studio.
        </EmptyState>
      )}
      {groups.map((g) => (
        <div key={g.title} className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="eyebrow">{g.title}</span>
            <span className="text-[11.5px] text-muted">{g.hint}</span>
          </div>
          {g.items.map((s) => {
            const rel = directRels.find((r) => r.from.id === s.id && r.status === 'accepted')
            return (
              <div key={s.id} className="group flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <StatementQuote statement={s} compact />
                  {rel?.explanation && <p className="mt-1 pl-3 text-[12px] text-muted">Link rationale: {rel.explanation}</p>}
                </div>
                {rel && can('theme.edit') && (
                  <IconButton
                    label={`Remove link to ${s.code}`}
                    className="opacity-60 group-hover:opacity-100"
                    onClick={async () => {
                      const ok = await confirm({ title: `Remove evidence link to ${s.code}?`, body: 'The statement remains in its source; only this link is removed.', confirmLabel: 'Remove link', tone: 'danger' })
                      if (ok.confirmed) run({ type: 'relationship.delete', id: rel.id }, 'Evidence link removed')
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {allowLink && can('relationship.propose') && (
        <Button size="sm" variant="secondary" icon={<Link2 className="size-3.5" />} onClick={() => setPicking(true)}>
          Link evidence
        </Button>
      )}
      <NodePicker
        open={picking}
        onOpenChange={setPicking}
        title={`Link evidence to ${nodeLabel(data, target).code}`}
        type="statement"
        exclude={ev.direct.map((s) => s.id)}
        withRationale
        onPick={async (ids, rationale) => {
          for (const id of ids) {
            await run({ type: 'relationship.create', from: { type: 'statement', id }, to: target, relType: 'supports', explanation: rationale, confidence: 'medium' })
          }
          setPicking(false)
        }}
        confirmLabel={can('relationship.review') ? 'Link evidence' : 'Propose link'}
        note={can('relationship.review') ? undefined : 'Your role can propose links; a reviewer or editor must accept them.'}
      />
    </div>
  )
}

/** Searchable multi-select of project nodes of one type. */
export function NodePicker({
  open,
  onOpenChange,
  title,
  type,
  exclude = [],
  initial = [],
  onPick,
  confirmLabel = 'Select',
  withRationale,
  note,
  single,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  type: NodeType
  exclude?: string[]
  initial?: string[]
  onPick: (ids: string[], rationale: string) => void | Promise<void>
  confirmLabel?: string
  withRationale?: boolean
  note?: string
  single?: boolean
}) {
  const { data } = useProject()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>(initial)
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const items = useMemo(() => {
    const pool: { id: string; code: string; title: string; sub: string }[] =
      type === 'statement'
        ? data.statements.map((s) => ({ id: s.id, code: s.code, title: s.originalText, sub: data.sources.find((x) => x.id === s.sourceId)?.title ?? '' }))
        : type === 'principle'
          ? data.principles.filter((p) => isActiveFramework(p.status)).map((p) => ({ id: p.id, code: p.code, title: p.title, sub: p.statement }))
          : type === 'driver'
            ? data.drivers.filter((d) => d.approvalStatus !== 'superseded').map((d) => ({ id: d.id, code: d.code, title: d.title, sub: d.description }))
            : type === 'theme'
              ? data.themes.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, code: t.code, title: t.title, sub: t.summary }))
              : type === 'decision'
                ? data.decisions.map((d) => ({ id: d.id, code: d.code, title: d.question, sub: '' }))
                : type === 'winTheme'
                  ? data.winThemes.filter((w) => isActiveFramework(w.status)).map((w) => ({ id: w.id, code: w.code, title: w.statement, sub: w.narrative }))
                  : type === 'opportunity'
                    ? data.opportunities.map((o) => ({ id: o.id, code: o.code, title: o.title, sub: o.description }))
                    : type === 'outcome'
                      ? data.outcomes.map((o) => ({ id: o.id, code: o.code, title: o.statement, sub: '' }))
                      : []
    const ql = q.toLowerCase()
    return pool.filter((x) => !exclude.includes(x.id) && (!ql || `${x.code} ${x.title} ${x.sub}`.toLowerCase().includes(ql)))
  }, [data, type, q, exclude])

  const reset = (o: boolean) => {
    if (o) {
      setSelected(initial)
      setQ('')
      setRationale('')
    }
    onOpenChange(o)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={reset}
      title={title}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[12px] text-muted">{selected.length} selected</span>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!single && selected.length === 0 && initial.length === 0}
            onClick={async () => {
              setBusy(true)
              try {
                await onPick(selected, rationale.trim())
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {note && <p className="rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">{note}</p>}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder={`Search ${NODE_TYPE_LABELS[type].toLowerCase()}s…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" autoFocus />
        </div>
        <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-md border border-line scroll-thin">
          {items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">Nothing to select.</li>}
          {items.map((x) => {
            const checked = selected.includes(x.id)
            return (
              <li key={x.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-sunken">
                  <input
                    type={single ? 'radio' : 'checkbox'}
                    name="node-picker"
                    className="mt-1 accent-[var(--c-accent)]"
                    checked={checked}
                    onChange={() => setSelected((s) => (single ? [x.id] : checked ? s.filter((i) => i !== x.id) : [...s, x.id]))}
                  />
                  <span className="w-14 shrink-0 pt-0.5 font-mono text-[11px] text-muted">{x.code}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] text-ink">{x.title}</span>
                    {x.sub && <span className="line-clamp-1 text-[11.5px] text-muted">{x.sub}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {withRationale && (
          <Field label="Link rationale (optional)" hint="Why does this evidence support the item?">
            {(id) => <Input id={id} value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={1000} />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}

export function RelationshipTypeSelect({ value, onChange }: { value: RelationshipType; onChange: (v: RelationshipType) => void }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as RelationshipType)}
      options={(Object.keys(RELATIONSHIP_LABELS) as RelationshipType[]).map((k) => ({ value: k, label: RELATIONSHIP_LABELS[k] }))}
    />
  )
}

export function LinkedChips({ refs, empty = 'None' }: { refs: NodeRef[]; empty?: string }) {
  const { data } = useProject()
  if (!refs.length) return <span className="text-[12.5px] text-muted italic">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {refs.map((r) => {
        const l = nodeLabel(data, r)
        return (
          <Link key={`${r.type}${r.id}`} to={nodePath(data.project.id, r)} title={l.title}>
            <Badge tone="outline" className="hover:border-ink hover:text-ink">
              <span className="font-mono">{l.code}</span>
              <span className="max-w-[180px] truncate">{l.title}</span>
            </Badge>
          </Link>
        )
      })}
    </span>
  )
}

export function AddButton({ children, ...rest }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="primary" icon={<Plus className="size-4" />} {...rest}>
      {children}
    </Button>
  )
}
