import { CheckCircle2, History, MessageSquare, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { APPROVAL_LABELS, DRIVER_STATUS_LABELS } from '@/domain/labels'
import type { NodeRef, VersionEntry } from '@/domain/types'
import { useConfirm } from './Dialog'
import { Badge, Button, cx, Textarea } from './ui'

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) })
}

export function CommentThread({ target }: { target: NodeRef }) {
  const { data, can, run, personName } = useProject()
  const [body, setBody] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const all = data.comments.filter((c) => c.target.type === target.type && c.target.id === target.id)
  const comments = all.filter((c) => showResolved || !c.resolved)
  const resolvedCount = all.filter((c) => c.resolved).length
  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-[13px] text-muted">No open comments.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className={cx('rounded-md border border-line px-3 py-2.5', c.resolved && 'opacity-60')}>
            <div className="mb-1 flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-ink">{personName(c.authorId)}</span>
              <span className="text-muted">{formatDate(c.createdAt, true)}</span>
              {c.resolved && <Badge tone="ok">Resolved</Badge>}
              {can('comment.create') && (
                <button className="ml-auto text-[12px] text-muted hover:text-ink" onClick={() => run({ type: 'comment.resolve', id: c.id, resolved: !c.resolved })}>
                  {c.resolved ? 'Reopen' : 'Resolve'}
                </button>
              )}
            </div>
            <p className="text-[13px] whitespace-pre-wrap text-ink-2">{c.body}</p>
          </li>
        ))}
      </ul>
      {resolvedCount > 0 && (
        <button className="text-[12px] text-muted underline-offset-2 hover:underline" onClick={() => setShowResolved((s) => !s)}>
          {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
        </button>
      )}
      {can('comment.create') ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!body.trim()) return
            const ok = await run({ type: 'comment.add', target, body })
            if (ok !== undefined) setBody('')
          }}
        >
          <Textarea aria-label="Add a comment" placeholder="Add a comment for the team…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} />
          <Button type="submit" size="sm" icon={<MessageSquare className="size-3.5" />} disabled={!body.trim()}>
            Comment
          </Button>
        </form>
      ) : (
        <p className="text-[12px] text-muted">Your role cannot comment on this project.</p>
      )}
    </div>
  )
}

/** Version history with explicit restore (creates a new version; never rewrites history). */
export function VersionHistory<C>({
  versions,
  current,
  render,
  onRestore,
  canRestore,
  approvedVersion,
}: {
  versions: VersionEntry<C, string>[]
  current: number
  render: (snapshot: C) => React.ReactNode
  onRestore?: (version: number) => void
  canRestore: boolean
  approvedVersion?: number | null
}) {
  const { personName } = useProject()
  const confirm = useConfirm()
  const [open, setOpen] = useState<number | null>(null)
  const label = (s: string) => (APPROVAL_LABELS as Record<string, string>)[s] ?? (DRIVER_STATUS_LABELS as Record<string, string>)[s] ?? s
  return (
    <ol className="relative space-y-0 border-l border-line pl-5">
      {[...versions].reverse().map((v) => (
        <li key={v.version} className="relative pb-4">
          <span className={cx('absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface', v.status === 'approved' ? 'bg-ok' : v.version === current ? 'bg-accent' : 'bg-line-strong')} />
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-mono font-semibold text-ink">v{v.version}</span>
            <Badge tone={v.status === 'approved' ? 'ok' : 'outline'}>{label(v.status)}</Badge>
            {v.version === current && <Badge tone="accent">Current</Badge>}
            {approvedVersion === v.version && (
              <span className="flex items-center gap-1 text-[11.5px] text-ok">
                <CheckCircle2 className="size-3" /> Approval record
              </span>
            )}
            <span className="text-muted">
              {personName(v.changedBy)} · {formatDate(v.changedAt, true)}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-2">{v.note}</p>
          <div className="mt-1 flex gap-3">
            <button className="flex items-center gap-1 text-[12px] text-muted hover:text-ink" onClick={() => setOpen(open === v.version ? null : v.version)}>
              <History className="size-3" /> {open === v.version ? 'Hide' : 'View'} content
            </button>
            {onRestore && canRestore && v.version !== current && (
              <button
                className="flex items-center gap-1 text-[12px] text-muted hover:text-ink"
                onClick={async () => {
                  const r = await confirm({ title: `Restore content from v${v.version}?`, body: 'A new version is created with this content. History is preserved.', confirmLabel: 'Restore' })
                  if (r.confirmed) onRestore(v.version)
                }}
              >
                <RotateCcw className="size-3" /> Restore
              </button>
            )}
          </div>
          {open === v.version && <div className="mt-2 rounded-md border border-line bg-sunken p-3 text-[12.5px]">{render(v.snapshot)}</div>}
        </li>
      ))}
    </ol>
  )
}
