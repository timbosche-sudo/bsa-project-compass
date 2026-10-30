import { AlertTriangle, ArrowUpRight, GitMerge, HelpCircle, Layers, Pencil, Plus, Scissors, ShieldAlert, Swords, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { LinkedChips, StatementQuote } from '@/components/Evidence'
import { CriticalityBadge, KindBadge, ThemeBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, Card, CardHeader, cx, EmptyState, Field, IconButton, Input, optionsFrom, Select, Textarea } from '@/components/ui'
import { CATEGORY_LABELS, CRITICALITY_LABELS } from '@/domain/labels'
import { gapReport, isOwnerEvidence, themeStatementIds } from '@/domain/traceability'
import type { Criticality, PrincipleCategory, Statement, Theme } from '@/domain/types'

export function ThemesWorkspace() {
  const { data, can, run } = useProject()
  const [params] = useSearchParams()
  const focusTheme = params.get('theme')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const gaps = useMemo(() => gapReport(data), [data])

  const themed = new Set(data.relationships.filter((r) => r.status !== 'rejected' && r.from.type === 'statement' && r.to.type === 'theme').map((r) => r.from.id))
  const unthemed = data.statements.filter((s) => !themed.has(s.id))
  const themes = data.themes.filter((t) => showArchived || t.status !== 'archived')

  const addToTheme = async (themeId: string) => {
    for (const id of selected) {
      await run({ type: 'relationship.create', from: { type: 'statement', id }, to: { type: 'theme', id: themeId }, relType: 'supports', explanation: '', confidence: 'medium' })
    }
    setSelected([])
  }

  return (
    <div className="space-y-6">
      <Insights gaps={gaps} />
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Ungrouped evidence" title="Statements not in a theme" description="Select statements to group them." />
            <div className="max-h-[560px] overflow-y-auto scroll-thin">
              {unthemed.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted">Every statement belongs to a theme.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {unthemed.map((s) => (
                    <li key={s.id} className="flex gap-3 px-5 py-3">
                      {can('theme.edit') && (
                        <input
                          type="checkbox"
                          className="mt-1 accent-[var(--c-accent)]"
                          aria-label={`Select ${s.code}`}
                          checked={selected.includes(s.id)}
                          onChange={() => setSelected((x) => (x.includes(s.id) ? x.filter((i) => i !== s.id) : [...x, s.id]))}
                        />
                      )}
                      <div className="min-w-0 space-y-1.5">
                        <StatementQuote statement={s} compact />
                        <div className="flex gap-1.5 pl-3">
                          <KindBadge kind={s.kind} />
                          <CriticalityBadge level={s.criticality} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {can('theme.edit') && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
                <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
                  {selected.length ? `Group ${selected.length} into new theme` : 'New theme'}
                </Button>
                {selected.length > 0 && (
                  <Select
                    aria-label="Add selected statements to theme"
                    className="h-8 w-auto py-1 text-[13px]"
                    value=""
                    onChange={(e) => e.target.value && addToTheme(e.target.value)}
                    options={[{ value: '', label: 'Add to theme…' }, ...data.themes.filter((t) => t.status !== 'archived').map((t) => ({ value: t.id, label: `${t.code} ${t.title}` }))]}
                  />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              Emerging themes move to <strong className="text-ink">candidate</strong>, then are <strong className="text-ink">promoted</strong> to candidate guiding principles for formal review.
            </p>
            <label className="flex shrink-0 items-center gap-2 text-[12.5px] text-muted">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--c-accent)]" /> Show archived
            </label>
          </div>
          {themes.length === 0 ? (
            <EmptyState title="No themes yet" icon={<Layers className="size-6" />}>
              Group related statements to identify converging aspirations.
            </EmptyState>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-2">
              {themes.map((t) => (
                <ThemeCard key={t.id} theme={t} focused={focusTheme === t.id} unsupported={gaps.themesWithoutOwnerSupport.includes(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ThemeDialog open={creating} onOpenChange={setCreating} statementIds={selected} onDone={() => setSelected([])} />
    </div>
  )
}

function Insights({ gaps }: { gaps: ReturnType<typeof gapReport> }) {
  const { data } = useProject()
  const base = `/projects/${data.project.id}`
  const items = [
    { icon: <Swords className="size-4" />, tone: 'risk' as const, label: 'Unresolved conflicts', count: gaps.conflicts.length + data.themes.filter((t) => t.status !== 'archived' && t.conflictNote && !t.conflictNote.startsWith('Merged')).length, detail: gaps.conflicts.map((c) => c.explanation).filter(Boolean)[0] },
    { icon: <ShieldAlert className="size-4" />, tone: 'danger' as const, label: 'Requirements not in framework', count: gaps.requirementsNotInFramework.length, detail: gaps.requirementsNotInFramework.map((s) => s.code).join(', ') },
    { icon: <AlertTriangle className="size-4" />, tone: 'warn' as const, label: 'Themes without Owner support', count: gaps.themesWithoutOwnerSupport.length, detail: gaps.themesWithoutOwnerSupport.map((id) => data.themes.find((t) => t.id === id)?.code).join(', ') },
    { icon: <HelpCircle className="size-4" />, tone: 'info' as const, label: 'Owner requirements not raised in workshops', count: gaps.requirementsNotRaisedInWorkshops.length, detail: gaps.requirementsNotRaisedInWorkshops.map((s) => s.code).join(', ') },
  ]
  const toneCls = { risk: 'text-risk', danger: 'text-danger', warn: 'text-warn', info: 'text-info' }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <div className={cx('flex items-center gap-2', toneCls[i.tone])}>
            {i.icon}
            <span className="text-[22px] font-semibold tabular-nums">{i.count}</span>
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-ink">{i.label}</div>
          {i.count > 0 && i.detail && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted">{i.detail}</div>}
        </div>
      ))}
      {gaps.orphanStatements.length > 0 && (
        <p className="text-[12px] text-muted sm:col-span-2 xl:col-span-4">
          {gaps.orphanStatements.length} statement(s) are not linked to anything —{' '}
          <Link className="underline" to={`${base}/understand/evidence?filter=orphan`}>
            review orphaned statements
          </Link>
          . Frequency of mention is never treated as importance; criticality is set explicitly.
        </p>
      )}
    </div>
  )
}

function ThemeCard({ theme, focused, unsupported }: { theme: Theme; focused: boolean; unsupported: boolean }) {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [merging, setMerging] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const rels = data.relationships.filter((r) => r.from.type === 'statement' && r.to.type === 'theme' && r.to.id === theme.id && r.status !== 'rejected')
  const statements = rels.map((r) => ({ rel: r, s: data.statements.find((x) => x.id === r.from.id)! })).filter((x) => x.s)
  const ownerCount = statements.filter((x) => isOwnerEvidence(data, x.s)).length
  const editable = can('theme.edit') && theme.status !== 'archived'
  const principle = theme.promotedToPrincipleId ? data.principles.find((p) => p.id === theme.promotedToPrincipleId) : null
  const others = data.themes.filter((t) => t.id !== theme.id && t.status !== 'archived')

  return (
    <Card className={cx(focused && 'ring-2 ring-accent', theme.status === 'archived' && 'opacity-70')} id={`theme-${theme.id}`}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="code-tag">{theme.code}</span>
              <ThemeBadge status={theme.status} />
              <CriticalityBadge level={theme.criticality} />
              {unsupported && (
                <Badge tone="warn" title="No supporting statement comes from an Owner requirement, mission or approved decision.">
                  No Owner requirement support
                </Badge>
              )}
            </div>
            <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">{theme.title}</h3>
            {theme.summary && <p className="mt-0.5 text-[13px] text-muted">{theme.summary}</p>}
          </div>
          {editable && (
            <IconButton label="Edit theme" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </IconButton>
          )}
        </div>
        {theme.conflictNote && (
          <div className="mt-3">
            <Callout tone={theme.conflictNote.startsWith('Merged') ? 'neutral' : 'warn'} icon={<Swords className="size-4 text-warn" />}>
              {theme.conflictNote}
            </Callout>
          </div>
        )}
        <div className="mt-2 text-[11.5px] text-faint">
          {statements.length} statement(s) · {ownerCount} from Owner requirements or institutional sources
        </div>
      </div>
      <ul className="divide-y divide-line">
        {statements.map(({ rel, s }) => (
          <li key={rel.id} className={cx('flex items-start gap-2 px-5 py-3', rel.status === 'proposed' && 'bg-ai-soft/40')}>
            <div className="min-w-0 flex-1 space-y-1">
              <StatementQuote statement={s} compact />
              <div className="flex flex-wrap gap-1.5 pl-3">
                <KindBadge kind={s.kind} />
                {rel.status === 'proposed' && <Badge tone="ai">Proposed link</Badge>}
              </div>
            </div>
            {editable && (
              <div className="flex shrink-0 items-center gap-1">
                {rel.status === 'proposed' && can('relationship.review') && (
                  <Button size="sm" variant="ghost" onClick={() => run({ type: 'relationship.review', id: rel.id, decision: 'accepted' })}>
                    Accept
                  </Button>
                )}
                <Select
                  aria-label={`Move ${s.code} to another theme`}
                  className="h-7 w-[92px] px-1.5 py-0 text-[12px]"
                  value=""
                  onChange={(e) => e.target.value && run({ type: 'relationship.retarget', id: rel.id, to: { type: 'theme', id: e.target.value } }, `${s.code} moved`)}
                  options={[{ value: '', label: 'Move…' }, ...others.map((t) => ({ value: t.id, label: `${t.code} ${t.title}` }))]}
                />
                <IconButton label={`Remove ${s.code} from theme`} onClick={() => run({ type: 'relationship.delete', id: rel.id }, `${s.code} removed from ${theme.code}`)}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        {principle ? (
          <Link to={`/projects/${data.project.id}/interpret/principles?principle=${principle.id}`} className="flex items-center gap-1 text-[13px] font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:decoration-ink">
            Promoted to {principle.code} {principle.title} <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          editable && (
            <>
              {theme.status === 'emerging' && (
                <Button size="sm" onClick={() => run({ type: 'theme.update', id: theme.id, patch: { status: 'candidate' } }, `${theme.code} marked as candidate`)}>
                  Mark as candidate
                </Button>
              )}
              {can('framework.edit') && (
                <Button size="sm" variant="primary" icon={<ArrowUpRight className="size-3.5" />} disabled={statements.length === 0} onClick={() => setPromoting(true)}>
                  Promote to principle
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Scissors className="size-3.5" />} disabled={statements.length < 2} onClick={() => setSplitting(true)}>
                Split
              </Button>
              <Button size="sm" variant="ghost" icon={<GitMerge className="size-3.5" />} disabled={others.length === 0} onClick={() => setMerging(true)}>
                Merge
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const r = await confirm({ title: `Archive ${theme.code}?`, body: 'Archived themes are hidden from the workspace and graph. Their evidence links remain.', confirmLabel: 'Archive', tone: 'danger' })
                  if (r.confirmed) run({ type: 'theme.update', id: theme.id, patch: { status: 'archived' } }, `${theme.code} archived`)
                }}
              >
                Archive
              </Button>
            </>
          )
        )}
      </div>
      <ThemeDialog open={editing} onOpenChange={setEditing} theme={theme} />
      <SplitDialog open={splitting} onOpenChange={setSplitting} theme={theme} statements={statements.map((x) => x.s)} />
      <Dialog
        open={merging}
        onOpenChange={setMerging}
        title={`Merge ${theme.code} into another theme`}
        description="All evidence moves to the destination theme; this theme is archived with a note."
      >
        <ul className="divide-y divide-line rounded-md border border-line">
          {others.map((t) => (
            <li key={t.id}>
              <button
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-sunken"
                onClick={async () => {
                  setMerging(false)
                  await run({ type: 'theme.merge', fromId: theme.id, intoId: t.id }, `${theme.code} merged into ${t.code}`)
                }}
              >
                <span className="font-mono text-[11px] text-muted">{t.code}</span>
                <span className="font-medium">{t.title}</span>
                <span className="ml-auto text-[12px] text-muted">{themeStatementIds(data, t.id).length} statements</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
      <PromoteDialog open={promoting} onOpenChange={setPromoting} theme={theme} unsupported={unsupported} />
    </Card>
  )
}

function ThemeDialog({ open, onOpenChange, theme, statementIds = [], onDone }: { open: boolean; onOpenChange: (o: boolean) => void; theme?: Theme; statementIds?: string[]; onDone?: () => void }) {
  const { run, pending } = useProject()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [criticality, setCriticality] = useState<Criticality>('normal')
  const [conflictNote, setConflictNote] = useState('')
  useEffect(() => {
    if (!open) return
    setTitle(theme?.title ?? '')
    setSummary(theme?.summary ?? '')
    setCriticality(theme?.criticality ?? 'normal')
    setConflictNote(theme?.conflictNote ?? '')
  }, [open, theme])
  const reset = onOpenChange
  return (
    <Dialog
      open={open}
      onOpenChange={reset}
      title={theme ? `Edit ${theme.code}` : 'New theme'}
      description={theme ? undefined : statementIds.length ? `${statementIds.length} statement(s) will be grouped into this theme.` : 'Create an empty theme and add evidence later.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!title.trim()}
            onClick={async () => {
              const ok = theme
                ? await run({ type: 'theme.update', id: theme.id, patch: { title, summary, criticality, conflictNote } }, 'Theme updated')
                : await run({ type: 'theme.create', title, summary, criticality, statementIds }, 'Theme created')
              if (ok !== undefined) {
                reset(false)
                onDone?.()
              }
            }}
          >
            {theme ? 'Save' : 'Create theme'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Theme name" required>
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Summary">
          {(id) => <Textarea id={id} value={summary} onChange={(e) => setSummary(e.target.value)} />}
        </Field>
        <Field label="Criticality" hint="Set explicitly. How often an idea is repeated does not determine its importance.">
          {(id) => <Select id={id} value={criticality} onChange={(e) => setCriticality(e.target.value as Criticality)} options={optionsFrom(CRITICALITY_LABELS)} />}
        </Field>
        {theme && (
          <Field label="Conflict or tension note" hint="Record conflicting aspirations and how they are being resolved.">
            {(id) => <Textarea id={id} value={conflictNote} onChange={(e) => setConflictNote(e.target.value)} rows={2} />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}

function SplitDialog({ open, onOpenChange, theme, statements }: { open: boolean; onOpenChange: (o: boolean) => void; theme: Theme; statements: Statement[] }) {
  const { run, pending } = useProject()
  const [title, setTitle] = useState('')
  const [ids, setIds] = useState<string[]>([])
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTitle('')
          setIds([])
        }
        onOpenChange(o)
      }}
      title={`Split ${theme.code}`}
      description="Selected statements move into a new theme."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!title.trim() || ids.length === 0 || ids.length === statements.length}
            onClick={async () => {
              if ((await run({ type: 'theme.split', id: theme.id, title, statementIds: ids }, 'Theme split')) !== undefined) onOpenChange(false)
            }}
          >
            Split into new theme
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New theme name" required>
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <ul className="divide-y divide-line rounded-md border border-line">
          {statements.map((s) => (
            <li key={s.id} className="flex gap-3 px-3 py-2.5">
              <input type="checkbox" aria-label={`Move ${s.code}`} className="mt-1 accent-[var(--c-accent)]" checked={ids.includes(s.id)} onChange={() => setIds((x) => (x.includes(s.id) ? x.filter((i) => i !== s.id) : [...x, s.id]))} />
              <StatementQuote statement={s} compact />
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}

function PromoteDialog({ open, onOpenChange, theme, unsupported }: { open: boolean; onOpenChange: (o: boolean) => void; theme: Theme; unsupported: boolean }) {
  const { run, pending, data } = useProject()
  const [category, setCategory] = useState<PrincipleCategory>('facility_outcomes')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Promote ${theme.code} to a candidate ${data.project.terminology.guidingPrinciple.toLowerCase()}`}
      description="Creates a proposed principle linked to this theme's evidence. It still requires editing, review and formal approval."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={async () => {
              if ((await run({ type: 'theme.promote', id: theme.id, category }, 'Candidate principle created')) !== undefined) onOpenChange(false)
            }}
          >
            Create candidate principle
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {unsupported && <Callout tone="warn" title="No Owner requirement support">This theme rests only on workshop aspirations. Consider confirming it with the Owner before promotion.</Callout>}
        <Field label="Category">
          {(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as PrincipleCategory)} options={optionsFrom(CATEGORY_LABELS)} />}
        </Field>
      </div>
    </Dialog>
  )
}

export function QuestionsCard() {
  const { data, can, run, personName } = useProject()
  const [q, setQ] = useState('')
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const open = data.questions.filter((x) => x.status === 'open')
  const closed = data.questions.filter((x) => x.status !== 'open')
  return (
    <Card>
      <CardHeader eyebrow="Insufficient information" title="Open questions" description="Shown instead of a confident conclusion when evidence is missing." />
      <ul className="divide-y divide-line">
        {open.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">No open questions.</li>}
        {open.map((x) => (
          <li key={x.id} className="space-y-2 px-5 py-3">
            <div className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-info" />
              <div className="min-w-0">
                <p className="text-[13px] text-ink">{x.question}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {x.code} · {personName(x.raisedBy)} · {formatDate(x.raisedAt)}
                </p>
              </div>
            </div>
            {x.context.length > 0 && (
              <div className="pl-6">
                <LinkedChips refs={x.context} />
              </div>
            )}
            {can('theme.edit') &&
              (answering === x.id ? (
                <div className="space-y-2 pl-6">
                  <Textarea aria-label="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Record the answer and its source…" />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="primary" disabled={!answer.trim()} onClick={async () => (await run({ type: 'question.resolve', id: x.id, status: 'answered', answer }, `${x.code} answered`)) !== undefined && setAnswering(null)}>
                      Save answer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5 pl-6">
                  <Button size="sm" onClick={() => { setAnswering(x.id); setAnswer('') }}>
                    Answer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => run({ type: 'question.resolve', id: x.id, status: 'withdrawn', answer: '' }, `${x.code} withdrawn`)}>
                    Withdraw
                  </Button>
                </div>
              ))}
          </li>
        ))}
      </ul>
      {closed.length > 0 && (
        <details className="border-t border-line px-5 py-3 text-[12.5px]">
          <summary className="cursor-pointer text-muted">{closed.length} resolved</summary>
          <ul className="mt-2 space-y-2">
            {closed.map((x) => (
              <li key={x.id}>
                <span className="text-ink-2">{x.question}</span>
                <span className="block text-muted">
                  {x.status === 'answered' ? `Answer: ${x.answer}` : 'Withdrawn'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {can('comment.create') && (
        <form
          className="flex gap-2 border-t border-line px-5 py-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if ((await run({ type: 'question.create', question: q, context: [] }, 'Question raised')) !== undefined) setQ('')
          }}
        >
          <Input aria-label="New question" placeholder="Raise a question…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" disabled={!q.trim()}>
            Add
          </Button>
        </form>
      )}
    </Card>
  )
}
