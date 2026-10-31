import { History, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { Badge, Button, Card, cx, EmptyState, Field, Input, PageHeader, Select, Textarea } from '@/components/ui'
import { directionContent } from '@/domain/alignment'
import { DIRECTION_STATE_LABELS } from '@/domain/labels'
import type { DirectionContent, DirectionSnapshot, DirectionState } from '@/domain/types'
import { AlignmentBadge } from '@/components/AlignmentBadge'

const STATE_TONE: Record<DirectionState, 'outline' | 'info' | 'ok' | 'neutral'> = { bsa_proposed: 'outline', owner_reviewed: 'info', aligned: 'ok', revision: 'neutral' }

/** Every saved version of the direction: what BSA proposed, what the Owner reviewed, what was aligned, and later revisions. */
export default function DirectionHistoryPage() {
  const { data, can, run, personName } = useProject()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const list = [...data.directions].sort((a, b) => b.at.localeCompare(a.at))
  const selected = list.find((d) => d.id === params.get('version')) ?? list[0]
  const current = directionContent(data)

  const restore = async (s: DirectionSnapshot) => {
    const r = await confirm({
      title: `Restore wording from ${s.code}?`,
      body: 'Each changed vision and principle gets a new version with the saved wording, and the point of view is restored. Nothing is overwritten: current wording stays in version history. Approved wording is never changed — open a revision first.',
      confirmLabel: 'Restore as new versions',
    })
    if (r.confirmed) await run({ type: 'direction.restore', id: s.id }, `Restored from ${s.code}`)
  }

  return (
    <div>
      <PageHeader
        title="Direction History"
        description="Saved versions of the direction. BSA-proposed, Owner-reviewed and aligned versions are kept separate and can never be edited or deleted, so an aligned direction stays recoverable while work continues."
        actions={
          can('framework.edit') && (
            <Button variant="primary" icon={<Save className="size-4" />} onClick={() => setSaving(true)}>
              Save current direction
            </Button>
          )
        }
      />
      {list.length === 0 ? (
        <EmptyState title="No saved versions yet" icon={<History className="size-5" />}>
          Starting a workshop session saves the proposed direction automatically. You can also save it now.
        </EmptyState>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card as="div">
            <ol className="divide-y divide-line" aria-label="Saved versions">
              {list.map((d) => (
                <li key={d.id}>
                  <button className={cx('w-full px-4 py-3 text-left hover:bg-sunken', d.id === selected?.id && 'bg-sunken')} aria-current={d.id === selected?.id} onClick={() => setParams({ version: d.id })}>
                    <div className="flex items-center gap-2">
                      <span className="code-tag">{d.code}</span>
                      <Badge tone={STATE_TONE[d.state]}>{DIRECTION_STATE_LABELS[d.state]}</Badge>
                    </div>
                    <div className="mt-1 text-[14px] font-semibold">{d.label}</div>
                    <div className="text-[11.5px] text-muted">
                      {formatDate(d.at, true)} · {personName(d.by)}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
          {selected && <SnapshotDetail snap={selected} current={current} onRestore={can('framework.edit') ? () => void restore(selected) : undefined} />}
        </div>
      )}
      <SaveDialog open={saving} onOpenChange={setSaving} />
    </div>
  )
}

function SnapshotDetail({ snap, current, onRestore }: { snap: DirectionSnapshot; current: DirectionContent; onRestore?: () => void }) {
  const { data, personName } = useProject()
  const t = data.project.terminology
  const c = snap.content
  const session = data.workshops.find((w) => w.id === snap.sessionId)
  const changed = (id: string) => {
    const now = current.principles.find((p) => p.id === id)
    const then = c.principles.find((p) => p.id === id)
    if (!now) return 'Removed since'
    return then && (now.title !== then.title || now.statement !== then.statement) ? 'Changed since' : null
  }
  const added = current.principles.filter((p) => !c.principles.some((x) => x.id === p.id))
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="code-tag">{snap.code}</span>
            <Badge tone={STATE_TONE[snap.state]}>{DIRECTION_STATE_LABELS[snap.state]}</Badge>
          </div>
          <h2 className="mt-2 text-[22px] font-black">{snap.label}</h2>
          <p className="text-[12.5px] text-muted">
            Saved {formatDate(snap.at, true)} by {personName(snap.by)}
            {session && ` · ${session.code} ${session.title}`}
          </p>
          {snap.note && <p className="mt-2 max-w-2xl text-[13px] text-ink-2">{snap.note}</p>}
        </div>
        {onRestore && (
          <Button icon={<RotateCcw className="size-4" />} onClick={onRestore}>
            Restore this wording
          </Button>
        )}
      </div>
      <div className="space-y-6 px-6 py-5">
        {c.pointOfView?.centralAmbition && (
          <section>
            <div className="eyebrow mb-1">Point of view</div>
            <p className="text-[15px] font-semibold">{c.pointOfView.centralAmbition}</p>
          </section>
        )}
        <section>
          <div className="eyebrow mb-2">{t.winTheme}</div>
          <ul className="space-y-2">
            {c.vision.map((v) => {
              const a = c.alignment.find((x) => x.type === 'winTheme' && x.id === v.id)
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted">{v.code}</span>
                  <span className="text-[15px] font-bold">{v.statement}</span>
                  {a && <AlignmentBadge status={a.status} />}
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <div className="eyebrow mb-2">{t.guidingPrinciple}s</div>
          <ol className="divide-y divide-line rounded-md border border-line">
            {c.principles.map((p) => {
              const a = c.alignment.find((x) => x.type === 'principle' && x.id === p.id)
              const diff = changed(p.id)
              return (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">{p.code}</span>
                    <span className="font-semibold">{p.title}</span>
                    {a && <AlignmentBadge status={a.status} />}
                    {diff && <Badge tone="warn">{diff}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-2">{p.statement}</p>
                  {a?.refinements && <p className="mt-1 text-[12px] text-muted">Refinements requested: {a.refinements}</p>}
                </li>
              )
            })}
          </ol>
          {added.length > 0 && <p className="mt-2 text-[12px] text-muted">Added since: {added.map((p) => `${p.code} ${p.title}`).join(', ')}</p>}
        </section>
        <section className="grid gap-4 text-[13px] md:grid-cols-2">
          <div>
            <div className="eyebrow mb-1">Design opportunities</div>
            <p className="text-ink-2">{c.opportunities.length} saved</p>
          </div>
          <div>
            <div className="eyebrow mb-1">Potential outcomes</div>
            <p className="text-ink-2">{c.outcomes.length} saved</p>
          </div>
        </section>
      </div>
    </Card>
  )
}

function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, can, run } = useProject()
  const [form, setForm] = useState({ label: '', state: 'revision' as DirectionState, sessionId: '', note: '' })
  const states: DirectionState[] = can('workshop.facilitate') ? ['bsa_proposed', 'revision', 'owner_reviewed'] : ['bsa_proposed', 'revision']
  const save = async () => {
    const id = await run({ type: 'direction.snapshot', label: form.label, state: form.state, sessionId: form.sessionId || null, note: form.note }, 'Direction saved')
    if (id !== undefined) {
      onOpenChange(false)
      setForm({ label: '', state: 'revision', sessionId: '', note: '' })
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save the current direction"
      description="Saves an immutable copy of the point of view, vision, principles, opportunities, outcomes and recorded Owner responses. To record an aligned direction, use Owner Alignment."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!form.label.trim()} onClick={save}>
            Save version
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Label" required>
          {(id) => <Input id={id} value={form.label} placeholder="e.g. Revised after DD review" onChange={(e) => setForm({ ...form, label: e.target.value })} />}
        </Field>
        <Field label="What this version is">{(id) => <Select id={id} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as DirectionState })} options={states.map((s) => ({ value: s, label: DIRECTION_STATE_LABELS[s] }))} />}</Field>
        <Field label="Workshop session (optional)">
          {(id) => <Select id={id} value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })} options={[{ value: '', label: 'None' }, ...data.workshops.map((w) => ({ value: w.id, label: `${w.code} · ${w.title}` }))]} />}
        </Field>
        <Field label="Note">{(id) => <Textarea id={id} rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>
      </div>
    </Dialog>
  )
}
