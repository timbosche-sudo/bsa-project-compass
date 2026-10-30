import { CheckCircle2, Copy, FileText, History, Lock, Pencil, PenLine, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { CommentThread, formatDate } from '@/components/Collaboration'
import { useConfirm } from '@/components/Dialog'
import { highlightUncertain, LinkedChips } from '@/components/Evidence'
import { ConfidenceBadge, ConfidentialityBadge, CriticalityBadge, KindBadge, TranscriptionBadge } from '@/components/StatusBadge'
import { Badge, Button, Callout, Card, CardHeader, cx, EmptyState, KeyValue, PageHeader } from '@/components/ui'
import { EXTRACTION_LABELS, SOURCE_TYPE_LABELS } from '@/domain/labels'
import { accepted } from '@/domain/traceability'
import type { Source, Statement } from '@/domain/types'
import { CorrectTranscriptionDialog, formatBytes, SourceFormDialog, StatementFormDialog } from './forms'

export default function SourceDetailPage() {
  const { sourceId } = useParams()
  const { data, can, run, personName } = useProject()
  const { adapter } = useSession()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const source = data.sources.find((s) => s.id === sourceId)
  const statements = data.statements.filter((s) => s.sourceId === sourceId)
  const focused = params.get('statement')

  useEffect(() => {
    if (focused) document.getElementById(`stmt-${focused}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focused])

  if (!source) return <Navigate to={`/projects/${data.project.id}/intelligence`} replace />
  const dup = source.possibleDuplicateOf ? data.sources.find((s) => s.id === source.possibleDuplicateOf) : null
  const duplicatedBy = data.sources.filter((s) => s.possibleDuplicateOf === source.id)
  const image = source.file?.demoAsset ? `${import.meta.env.BASE_URL}${source.file.demoAsset}` : null

  const remove = async () => {
    const r = await confirm({
      title: `Delete ${source.code}?`,
      body: (
        <>
          This permanently removes the source record, its {statements.length} extracted statement(s) and their evidence links. This action is recorded in the audit log and cannot be undone.
        </>
      ),
      confirmLabel: 'Delete source',
      tone: 'danger',
    })
    if (r.confirmed && (await run({ type: 'source.delete', id: source.id }, `${source.code} deleted`)) !== undefined) navigate(`/projects/${data.project.id}/intelligence`)
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${source.code} · ${SOURCE_TYPE_LABELS[source.type]}`}
        title={source.title}
        meta={
          <>
            <ConfidentialityBadge level={source.confidentiality} />
            <Badge tone={source.extractionStatus === 'verified' ? 'ok' : 'info'}>Extraction: {EXTRACTION_LABELS[source.extractionStatus]}</Badge>
            {dup && (
              <Link to={`../${dup.id}`} relative="path">
                <Badge tone="warn">
                  <Copy className="size-3" /> Possible duplicate of {dup.code}
                </Badge>
              </Link>
            )}
            {duplicatedBy.map((d) => (
              <Link key={d.id} to={`../${d.id}`} relative="path">
                <Badge tone="warn">
                  <Copy className="size-3" /> {d.code} may duplicate this
                </Badge>
              </Link>
            ))}
          </>
        }
        actions={
          <>
            {can('source.edit') && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('source.delete') && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>
                Delete
              </Button>
            )}
            {can('statement.create') && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Record statement
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {image ? (
            <PhotoVerification source={source} image={image} statements={statements} focused={focused} onFocus={(id) => setParams(id ? { statement: id } : {})} />
          ) : (
            <StatementCards statements={statements} focused={focused} />
          )}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Source record" />
            <div className="px-5 py-4">
              <KeyValue
                items={[
                  ['Author', source.author || '—'],
                  ['Organization', source.organization || '—'],
                  ['Date', formatDate(source.date)],
                  ['Uploaded by', `${personName(source.uploadedBy)}, ${formatDate(source.uploadedAt)}`],
                  ['Version', `v${source.version}`],
                  ['Statements', statements.length],
                ]}
              />
              {source.description && <p className="mt-4 text-[13px] text-ink-2">{source.description}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Original file" />
            <div className="px-5 py-4 text-[13px]">
              {source.file ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted" />
                    <span className="font-medium">{source.file.name}</span>
                    <span className="text-muted">{formatBytes(source.file.sizeBytes)}</span>
                  </div>
                  {adapter.mode === 'demo' ? (
                    <p className="flex items-start gap-2 text-[12.5px] text-muted">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      Demo mode stores file metadata only. {source.file.demoAsset ? 'The image shown is a synthetic illustration.' : 'No file contents are available.'}
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-[12.5px] text-muted">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      Held in private storage. Access is granted through short-lived signed URLs to project members.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted">No file attached (manual or reference record).</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Comments" />
            <div className="px-5 py-4">
              <CommentThread target={{ type: 'source', id: source.id }} />
            </div>
          </Card>
        </aside>
      </div>
      <SourceFormDialog open={editing} onOpenChange={setEditing} source={source} />
      <StatementFormDialog open={adding} onOpenChange={setAdding} source={source} />
    </div>
  )
}

function useLinks() {
  const { data } = useProject()
  const rels = useMemo(() => accepted(data), [data])
  return (id: string) => rels.filter((r) => r.from.type === 'statement' && r.from.id === id && r.type !== 'conflicts_with').map((r) => r.to)
}

function PhotoVerification({ source, image, statements, focused, onFocus }: { source: Source; image: string; statements: Statement[]; focused: string | null; onFocus: (id: string | null) => void }) {
  const toVerify = statements.filter((s) => s.transcriptionStatus !== 'verified').length
  return (
    <Card>
      <CardHeader
        eyebrow="Transcription verification"
        title="Original image beside transcription"
        description={toVerify ? `${toVerify} transcription(s) still need verification.` : 'All transcriptions verified.'}
      />
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <div className="relative overflow-hidden rounded-md border border-line bg-sunken">
            <img src={image} alt={`${source.title} — original photograph (synthetic illustration)`} className="block w-full" />
            {statements
              .filter((s) => s.locator.region)
              .map((s) => {
                const r = s.locator.region!
                return (
                  <button
                    key={s.id}
                    onClick={() => onFocus(focused === s.id ? null : s.id)}
                    aria-label={`Highlight ${s.code}`}
                    className={cx('absolute rounded border-2 transition-colors', focused === s.id ? 'border-accent bg-accent/15' : 'border-transparent hover:border-accent/60')}
                    style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  >
                    <span className="absolute -top-2.5 -left-1 rounded bg-inverse px-1 font-mono text-[9.5px] text-on-inverse">{s.code}</span>
                  </button>
                )
              })}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Select a region to highlight its transcription. Demo images are synthetic illustrations.</p>
        </div>
        <div className="p-4">
          {statements.length === 0 ? (
            <EmptyState title="Nothing transcribed yet">Record statements to transcribe this photograph.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {statements.map((s) => (
                <TranscriptionRow key={s.id} s={s} focused={focused === s.id} onFocus={() => onFocus(s.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

function TranscriptionRow({ s, focused, onFocus }: { s: Statement; focused: boolean; onFocus: () => void }) {
  const { data, can, run, personName } = useProject()
  const links = useLinks()
  const [correcting, setCorrecting] = useState(false)
  const [editing, setEditing] = useState(false)
  const source = data.sources.find((x) => x.id === s.sourceId)!
  const [history, setHistory] = useState(false)
  return (
    <li id={`stmt-${s.id}`} onMouseEnter={onFocus} className={cx('rounded-md border p-3 transition-colors', focused ? 'border-accent bg-accent-soft/40' : 'border-line')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">
          {s.code} · photo {s.locator.value}
        </span>
        <TranscriptionBadge status={s.transcriptionStatus} />
      </div>
      <p className="mt-1.5 text-[15px] font-medium text-ink">“{highlightUncertain(s.originalText, s.uncertainWords)}”</p>
      {s.reviewedBy && (
        <p className="mt-1 text-[11.5px] text-muted">
          Reviewed by {personName(s.reviewedBy)} · {formatDate(s.reviewedAt)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {can('statement.verify') && s.transcriptionStatus !== 'verified' && (
          <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-3.5" />} disabled={s.uncertainWords.length > 0} title={s.uncertainWords.length ? 'Resolve uncertain words first' : undefined} onClick={() => run({ type: 'statement.setTranscriptionStatus', id: s.id, status: 'verified' }, `${s.code} verified`)}>
            Verify
          </Button>
        )}
        {can('statement.verify') && (
          <Button size="sm" variant="ghost" icon={<PenLine className="size-3.5" />} onClick={() => setCorrecting(true)}>
            Correct
          </Button>
        )}
        {can('source.edit') && (
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
            Edit metadata
          </Button>
        )}
        {s.revisions.length > 0 && (
          <Button size="sm" variant="ghost" icon={<History className="size-3.5" />} onClick={() => setHistory((h) => !h)}>
            {s.revisions.length} revision(s)
          </Button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="eyebrow">Linked to</span>
        <LinkedChips refs={links(s.id)} empty="Orphaned — not yet linked" />
      </div>
      {s.interpretation && <p className="mt-2 rounded-md bg-sunken px-2.5 py-1.5 text-[12px] text-ink-2"><span className="font-semibold text-muted">Interpretation: </span>{s.interpretation}</p>}
      {history && <RevisionList s={s} />}
      <CorrectTranscriptionDialog open={correcting} onOpenChange={setCorrecting} statement={s} />
      <StatementFormDialog open={editing} onOpenChange={setEditing} source={source} statement={s} />
    </li>
  )
}

function RevisionList({ s }: { s: Statement }) {
  const { personName } = useProject()
  return (
    <ol className="mt-2 space-y-1.5 rounded-md bg-sunken p-2.5 text-[12px]">
      {s.revisions.map((r, i) => (
        <li key={i}>
          <span className="text-muted line-through">“{r.text}”</span>
          <span className="block text-[11.5px] text-muted">
            Replaced by {personName(r.by)} · {formatDate(r.at, true)} — {r.note}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StatementCards({ statements, focused }: { statements: Statement[]; focused: string | null }) {
  const { data, can } = useProject()
  const links = useLinks()
  const [editing, setEditing] = useState<Statement | null>(null)
  const [correcting, setCorrecting] = useState<Statement | null>(null)
  const source = data.sources.find((s) => s.id === statements[0]?.sourceId)
  if (statements.length === 0)
    return (
      <EmptyState title="No statements extracted yet">
        {can('statement.create') ? 'Record statements verbatim, with their page, slide or section reference.' : 'Statements recorded by the team will appear here.'}
      </EmptyState>
    )
  return (
    <Card>
      <CardHeader title="Extracted statements" description="Original wording is preserved verbatim. Interpretation is shown separately." />
      <ul className="divide-y divide-line">
        {statements.map((s) => (
          <li id={`stmt-${s.id}`} key={s.id} className={cx('px-5 py-4', focused === s.id && 'bg-accent-soft/40')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  <span className="font-mono">{s.code}</span>
                  {s.locator.kind !== 'none' && (
                    <span>
                      · {s.locator.kind} {s.locator.value}
                    </span>
                  )}
                  {s.speaker && <span>· {s.speaker}</span>}
                </div>
                <blockquote className="border-l-2 border-ink pl-3 text-[14.5px] text-ink">“{highlightUncertain(s.originalText, s.uncertainWords)}”</blockquote>
                <div className="flex flex-wrap gap-1.5">
                  <KindBadge kind={s.kind} />
                  <CriticalityBadge level={s.criticality} />
                  <ConfidenceBadge level={s.confidence} />
                  <TranscriptionBadge status={s.transcriptionStatus} />
                </div>
                {s.interpretation && (
                  <div className="rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">
                    <span className="mr-1.5 font-semibold text-muted">Interpretation:</span>
                    {s.interpretation}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="eyebrow">Linked to</span>
                  <LinkedChips refs={links(s.id)} empty="Orphaned — not yet linked" />
                </div>
                {s.revisions.length > 0 && <RevisionList s={s} />}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {can('source.edit') && (
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                )}
                {can('statement.verify') && (
                  <Button size="sm" variant="ghost" icon={<PenLine className="size-3.5" />} onClick={() => setCorrecting(s)}>
                    Correct
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {source && editing && <StatementFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} source={source} statement={editing} />}
      {correcting && <CorrectTranscriptionDialog open={!!correcting} onOpenChange={(o) => !o && setCorrecting(null)} statement={correcting} />}
      {statements.some((s) => s.kind === 'nonnegotiable') && (
        <div className="border-t border-line px-5 py-3">
          <Callout tone="neutral">Non-negotiable requirements are flagged across the Alignment Studio regardless of how often they are mentioned.</Callout>
        </div>
      )}
    </Card>
  )
}
