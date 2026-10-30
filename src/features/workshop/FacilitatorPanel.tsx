import { EyeOff, FileText, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProject } from '@/app/project'
import { formatDate, VersionHistory } from '@/components/Collaboration'
import { useConfirm } from '@/components/Dialog'
import { EvidencePanel } from '@/components/Evidence'
import { Badge, Button, Callout, IconButton, Input, Select, Tabs, Textarea } from '@/components/ui'
import { newId } from '@/domain/ids'
import type { GuidingPrinciple, PrincipleContent, VersionEntry, WinTheme, WinThemeContent, WorkshopAction, WorkshopSession } from '@/domain/types'
import { itemKey, type FrameworkKind } from '@/domain/workshop'
import { SessionDialog, SummaryDialog } from './dialogs'
import { useSaveStatus } from './state'

/** Debounced autosaving textarea for notes. */
function AutoNotes({ value, onSave, label, placeholder, rows = 6 }: { value: string; onSave: (v: string) => Promise<boolean>; label: string; placeholder?: string; rows?: number }) {
  const { setDirty, track } = useSaveStatus()
  const [text, setText] = useState(value)
  const timer = useRef<number | null>(null)
  const saved = useRef(value)
  const key = useRef(`notes-${Math.random()}`)
  useEffect(() => {
    if (text === saved.current) setText(value)
    saved.current = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const commit = async (v: string) => {
    if (timer.current) window.clearTimeout(timer.current)
    if (v === saved.current) return setDirty(key.current, false)
    if (await track(onSave(v), () => void commit(v))) {
      saved.current = v
      setDirty(key.current, false)
    }
  }
  return (
    <Textarea
      aria-label={label}
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        setDirty(key.current, true)
        if (timer.current) window.clearTimeout(timer.current)
        const v = e.target.value
        timer.current = window.setTimeout(() => void commit(v), 1000)
      }}
      onBlur={() => void commit(text)}
      onKeyDown={(e) => e.stopPropagation()}
    />
  )
}

type Tab = 'notes' | 'evidence' | 'history' | 'session'

export function FacilitatorPanel({ item, kind, session, onSelectSession }: { item: WinTheme | GuidingPrinciple | null; kind: FrameworkKind | null; session: WorkshopSession | null; onSelectSession: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('notes')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-warn-soft/60 px-4 py-2 text-[12px] text-warn">
        <EyeOff className="size-3.5" /> Facilitator only — not shown in Present mode or the audience window. Close this panel before sharing your whole screen.
      </div>
      <div className="px-4">
        <Tabs
          label="Facilitator panel"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'notes', label: 'Notes' },
            { value: 'evidence', label: 'Evidence' },
            { value: 'history', label: 'History' },
            { value: 'session', label: 'Session' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-thin">
        {tab === 'notes' && <NotesTab item={item} kind={kind} session={session} onSession={() => setTab('session')} />}
        {tab === 'evidence' && (item && kind ? <EvidencePanel target={{ type: kind, id: item.id }} allowLink={item.status !== 'approved'} /> : <p className="text-[13px] text-muted">Select a Win Theme or principle slide to see its supporting evidence.</p>)}
        {tab === 'history' && <HistoryTab item={item} kind={kind} />}
        {tab === 'session' && <SessionTab session={session} onSelectSession={onSelectSession} />}
      </div>
    </div>
  )
}

function NotesTab({ item, kind, session, onSession }: { item: WinTheme | GuidingPrinciple | null; kind: FrameworkKind | null; session: WorkshopSession | null; onSession: () => void }) {
  const { run, can } = useProject()
  if (!session)
    return (
      <Callout tone="info" title="No workshop session selected">
        Notes, actions and the meeting summary belong to a session.{' '}
        <button className="underline" onClick={onSession}>
          Plan or select a session
        </button>
        .
      </Callout>
    )
  const editable = can('workshop.facilitate') && session.status !== 'closed'
  return (
    <div className="space-y-5">
      {item && kind && (
        <div>
          <div className="eyebrow mb-1.5">Private notes · {item.code}</div>
          {editable ? (
            <AutoNotes key={item.id} label={`Notes for ${item.code}`} value={session.notes[itemKey(kind, item.id)] ?? ''} placeholder="Owner comments, concerns, wording ideas…" onSave={async (text) => (await run({ type: 'workshop.setNote', id: session.id, itemKey: itemKey(kind, item.id), text })) !== undefined} />
          ) : (
            <p className="text-[13px] whitespace-pre-wrap">{session.notes[itemKey(kind, item.id)] || '—'}</p>
          )}
        </div>
      )}
      <div>
        <div className="eyebrow mb-1.5">General session notes</div>
        {editable ? (
          <AutoNotes key={session.id} label="General session notes" rows={4} value={session.generalNotes} onSave={async (generalNotes) => (await run({ type: 'workshop.update', id: session.id, patch: { generalNotes } })) !== undefined} />
        ) : (
          <p className="text-[13px] whitespace-pre-wrap">{session.generalNotes || '—'}</p>
        )}
      </div>
      <ActionsEditor session={session} editable={editable} />
    </div>
  )
}

function ActionsEditor({ session, editable }: { session: WorkshopSession; editable: boolean }) {
  const { run } = useProject()
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const save = (actions: WorkshopAction[]) => run({ type: 'workshop.update', id: session.id, patch: { actions } })
  return (
    <div>
      <div className="eyebrow mb-1.5">Action items</div>
      <ul className="space-y-1.5">
        {session.actions.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-1 accent-[var(--c-accent)]" disabled={!editable} checked={a.done} aria-label={`Done: ${a.text}`} onChange={(e) => save(session.actions.map((x) => (x.id === a.id ? { ...x, done: e.target.checked } : x)))} />
            <span className={a.done ? 'flex-1 text-muted line-through' : 'flex-1'}>
              {a.text}
              {a.owner && <span className="text-muted"> — {a.owner}</span>}
            </span>
            {editable && (
              <IconButton label={`Remove action ${a.text}`} className="size-6" onClick={() => save(session.actions.filter((x) => x.id !== a.id))}>
                <Trash2 className="size-3" />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form
          className="mt-2 grid grid-cols-[1fr_120px_auto] gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            if ((await save([...session.actions, { id: newId(), text: text.trim(), owner: owner.trim(), due: null, done: false }])) !== undefined) {
              setText('')
              setOwner('')
            }
          }}
        >
          <Input aria-label="New action" placeholder="New action item" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <Input aria-label="Action owner" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <Button type="submit" size="md" icon={<Plus className="size-4" />} disabled={!text.trim()}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}

function HistoryTab({ item, kind }: { item: WinTheme | GuidingPrinciple | null; kind: FrameworkKind | null }) {
  const { run, can, personName } = useProject()
  if (!item || !kind) return <p className="text-[13px] text-muted">Select a Win Theme or principle slide to see its revision history.</p>
  const locked = item.status === 'approved' || item.status === 'superseded'
  return (
    <div className="space-y-4">
      {item.approval?.wording && (
        <div className="rounded-md border border-ok/40 bg-ok-soft/40 p-3 text-[12.5px]">
          <div className="font-semibold text-ok">
            Approved wording · v{item.approval.version} · {personName(item.approval.approvedBy)} · {formatDate(item.approval.approvedAt)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-ink">{item.approval.wording}</p>
          {item.status !== 'approved' && <p className="mt-1 text-warn">A proposed revision is in progress; this approved wording remains on record.</p>}
        </div>
      )}
      <VersionHistory<PrincipleContent | WinThemeContent>
        versions={item.versions as VersionEntry<PrincipleContent | WinThemeContent, string>[]}
        current={item.version}
        approvedVersion={item.approval?.version}
        canRestore={can('framework.edit') && !locked}
        onRestore={(v) => run({ type: 'framework.restore', kind, id: item.id, version: v }, `Restored v${v} content`)}
        render={(s) => <p className="whitespace-pre-wrap">{'title' in s ? `${s.title}\n${s.statement}\n${s.intent}` : `${s.statement}\n${s.narrative}`}</p>}
      />
    </div>
  )
}

function SessionTab({ session, onSelectSession }: { session: WorkshopSession | null; onSelectSession: (id: string) => void }) {
  const { data, run, can } = useProject()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<WorkshopSession | 'new' | null>(null)
  const [summary, setSummary] = useState(false)
  const facilitate = can('workshop.facilitate')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select aria-label="Workshop session" className="min-w-0 flex-1" value={session?.id ?? ''} onChange={(e) => e.target.value && onSelectSession(e.target.value)} options={[{ value: '', label: 'Select a session…' }, ...[...data.workshops].reverse().map((w) => ({ value: w.id, label: `${w.code} · ${w.title} (${w.status})` }))]} />
        {facilitate && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New
          </Button>
        )}
      </div>
      {session && (
        <>
          <div className="rounded-md border border-line p-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {session.code} · {session.title}
              </span>
              <Badge tone={session.status === 'live' ? 'danger' : session.status === 'closed' ? 'neutral' : 'outline'} dot>
                {session.status === 'live' ? 'Live' : session.status === 'closed' ? 'Ended' : 'Planned'}
              </Badge>
            </div>
            <div className="mt-1 text-muted">
              {formatDate(session.date)}
              {session.startedAt && ` · started ${formatDate(session.startedAt, true)}`}
              {session.endedAt && ` · ended ${formatDate(session.endedAt, true)}`}
            </div>
            <div className="mt-2 text-[12.5px] text-ink-2">{session.attendees.map((a) => a.name).join(', ') || 'No attendees recorded'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {facilitate && session.status === 'planned' && (
                <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} onClick={() => run({ type: 'workshop.start', id: session.id }, `${session.code} is live — changes are now recorded in the session`)}>
                  Start session
                </Button>
              )}
              {facilitate && session.status === 'live' && (
                <Button
                  size="sm"
                  icon={<Square className="size-3.5" />}
                  onClick={async () => {
                    const r = await confirm({ title: `End ${session.code}?`, body: 'The meeting summary is finalized from what was recorded. You can still view and export it.', confirmLabel: 'End session' })
                    if (r.confirmed) run({ type: 'workshop.end', id: session.id }, `${session.code} ended`)
                  }}
                >
                  End session
                </Button>
              )}
              {facilitate && session.status !== 'closed' && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(session)}>
                  Edit details
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<FileText className="size-3.5" />} onClick={() => setSummary(true)}>
                Meeting summary
              </Button>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1.5">Recorded changes ({session.log.length})</div>
            <ol className="max-h-[260px] space-y-1 overflow-y-auto text-[12px] scroll-thin">
              {[...session.log].reverse().map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-muted tabular-nums">{new Date(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  <span>{l.summary}</span>
                </li>
              ))}
              {session.log.length === 0 && <li className="text-muted">Changes made while the session is live appear here.</li>}
            </ol>
          </div>
          <SummaryDialog open={summary} onOpenChange={setSummary} session={session} />
        </>
      )}
      <SessionDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} session={editing === 'new' ? undefined : (editing ?? undefined)} onCreated={onSelectSession} />
    </div>
  )
}
