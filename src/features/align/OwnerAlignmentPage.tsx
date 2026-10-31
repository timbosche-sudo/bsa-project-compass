import { CheckCircle2, CircleAlert, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { Badge, Button, Callout, Card, CardHeader, EmptyState, PageHeader, Select } from '@/components/ui'
import { alignmentGaps, alignmentItems, latestAlignedDirection } from '@/domain/alignment'
import type { AlignmentResponse, AlignmentTargetType } from '@/domain/types'
import { AlignmentBadge } from '@/components/AlignmentBadge'
import { AlignmentCapture } from '@/features/workshop/AlignmentCapture'

/** Where the Owner stands on the vision and each principle, across sessions. Alignment is recorded, never inferred. */
export default function OwnerAlignmentPage() {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const sessions = [...data.workshops].sort((a, b) => b.date.localeCompare(a.date))
  const defaultSession = sessions.find((w) => w.status === 'live') ?? [...sessions].reverse().find((w) => w.status === 'planned') ?? sessions[0]
  const [sessionId, setSessionId] = useState<string>(defaultSession?.id ?? '')
  const [editing, setEditing] = useState<{ type: AlignmentTargetType; id: string; code: string } | null>(null)
  const session = data.workshops.find((w) => w.id === sessionId) ?? null
  const items = alignmentItems(data)
  const gaps = alignmentGaps(data)
  const aligned = latestAlignedDirection(data)

  const responsesFor = (type: AlignmentTargetType, id: string) => data.alignment.filter((r) => r.target.type === type && r.target.id === id).sort((a, b) => b.at.localeCompare(a.at))
  const inSession = (type: AlignmentTargetType, id: string) => data.alignment.find((r) => r.sessionId === (sessionId || null) && r.target.type === type && r.target.id === id)

  const recordAligned = async () => {
    const r = await confirm({
      title: 'Record the aligned direction?',
      body: 'This saves an immutable version of the vision, principles, opportunities and outcomes as they stand, with the Owner’s recorded responses. It does not approve exact wording; formal adoption remains a separate step.',
      confirmLabel: 'Record aligned direction',
      requireNote: { label: 'Note (e.g. meeting and who was present)', minLength: 0 },
    })
    if (r.confirmed) await run({ type: 'direction.snapshot', label: session ? `Aligned at ${session.code}` : 'Aligned direction', state: 'aligned', sessionId: session?.id ?? null, note: r.note ?? '' }, 'Aligned direction recorded')
  }

  return (
    <div>
      <PageHeader
        title="Owner Alignment"
        description="How the Owner responded to the vision and each principle. Responses are recorded by the facilitator; nothing counts as aligned until it is recorded, and alignment is not formal approval of exact wording."
        actions={
          sessions.length > 0 && (
            <Select
              aria-label="Session"
              className="w-auto"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              options={sessions.map((w) => ({ value: w.id, label: `${w.code} · ${formatDate(w.date)}${w.status === 'live' ? ' (live)' : ''}` }))}
            />
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          {items.length === 0 ? (
            <EmptyState title="Nothing to align on yet">Draft a vision and principles in Interpret first.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[680px]">
                <thead>
                  <tr>
                    <th className="w-[34%]">Item</th>
                    <th>{session ? `In ${session.code}` : 'This session'}</th>
                    <th>Latest across sessions</th>
                    <th className="w-[30%]">Refinements and questions</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const here = inSession(i.type, i.id)
                    const all = responsesFor(i.type, i.id)
                    const latest = all[0] as AlignmentResponse | undefined
                    const src = here ?? latest
                    return (
                      <tr key={`${i.type}-${i.id}`}>
                        <td>
                          <span className="font-mono text-[11px] text-muted">{i.code}</span> <span className="font-medium">{i.title}</span>
                        </td>
                        <td>
                          <AlignmentBadge status={here?.status ?? 'not_reviewed'} />
                        </td>
                        <td>
                          <AlignmentBadge status={latest?.status ?? 'not_reviewed'} />
                          {latest && <div className="mt-0.5 text-[11.5px] text-muted">{data.workshops.find((w) => w.id === latest.sessionId)?.code ?? 'No session'}</div>}
                        </td>
                        <td className="text-[12.5px] text-ink-2">
                          {src?.refinements && <div>Refine: {src.refinements}</div>}
                          {src?.questions && <div className="text-muted">Question: {src.questions}</div>}
                          {!src?.refinements && !src?.questions && <span className="text-faint">—</span>}
                        </td>
                        <td className="text-right">
                          {can('workshop.facilitate') && session?.status !== 'closed' && (
                            <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing({ type: i.type, id: i.id, code: i.code })} aria-label={`Record response to ${i.code}`}>
                              <span className="hidden 2xl:inline">Record</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Aligned direction" />
            <div className="space-y-3 px-5 pb-5 text-[13px]">
              {aligned ? (
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
                  <span>
                    Latest: <strong>{aligned.code}</strong> {aligned.label} · {formatDate(aligned.at)}
                  </span>
                </p>
              ) : (
                <p className="text-muted">No aligned direction has been recorded yet.</p>
              )}
              {gaps.ready ? (
                <Callout tone="ok">Every principle and a vision have an aligned response on record.</Callout>
              ) : (
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <CircleAlert className="size-4 text-warn" /> Not yet aligned
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[12.5px]">
                    {gaps.blocking.map((b) => (
                      <li key={b.code} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted">{b.code}</span>
                        <AlignmentBadge status={b.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {can('workshop.facilitate') && (
                <Button variant="primary" disabled={!gaps.ready} onClick={() => void recordAligned()} className="w-full">
                  Record aligned direction
                </Button>
              )}
              <p className="text-[11.5px] text-muted">Recording alignment saves a version you can always return to. Later edits create new versions; they never overwrite it.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Formal adoption" />
            <p className="px-5 pb-5 text-[12.5px] text-ink-2">
              Alignment is the primary outcome. If the Owner also wants to adopt exact wording, record that explicitly in the Owner Workshop (<Badge tone="outline">Record approval</Badge>); it then locks against silent change.
            </p>
          </Card>
        </div>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing ? `Owner response · ${editing.code}` : ''} description={session ? `${session.code} · ${session.title}` : 'No session'}>
        {editing && <AlignmentCapture type={editing.type} id={editing.id} code={editing.code} session={session} />}
      </Dialog>
    </div>
  )
}
