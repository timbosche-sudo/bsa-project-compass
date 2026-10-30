import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Button, Input, optionsFrom, Select, Textarea } from '@/components/ui'
import { PROGRESS_KIND_LABELS } from '@/domain/labels'
import type { PotentialOutcome, ProgressKind } from '@/domain/types'

/** Evidence of progress toward a potential outcome — dated, attributed observations, never scores. */
export function ProgressList({ outcome }: { outcome: PotentialOutcome }) {
  const { can, run, personName } = useProject()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), kind: 'design_study' as ProgressKind, note: '' })
  const save = async () => {
    if ((await run({ type: 'outcome.addProgress', id: outcome.id, ...form }, 'Evidence of progress recorded')) !== undefined) {
      setAdding(false)
      setForm({ ...form, note: '' })
    }
  }
  const items = [...outcome.evidenceOfProgress].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-2">
      {items.length === 0 && !adding && <p className="text-[12.5px] text-faint italic">No evidence of progress recorded yet.</p>}
      <ul className="space-y-1.5">
        {items.map((p) => (
          <li key={p.id} className="flex items-start gap-2 rounded-md bg-sunken px-3 py-2 text-[12.5px]">
            <div className="min-w-0 flex-1">
              <div className="text-muted">
                {formatDate(p.date)} · {PROGRESS_KIND_LABELS[p.kind]} · {personName(p.addedBy)}
              </div>
              <p className="text-ink-2">{p.note}</p>
            </div>
            {can('framework.edit') && (
              <button aria-label="Remove evidence of progress" className="rounded p-1 text-faint hover:text-danger" onClick={() => run({ type: 'outcome.removeProgress', id: outcome.id, progressId: p.id }, 'Removed')}>
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {can('driver.recordMeasurement') &&
        (adding ? (
          <div className="space-y-2 rounded-md border border-line p-3">
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Date" type="date" className="w-auto" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Select aria-label="Kind of evidence" className="w-auto" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProgressKind })} options={optionsFrom(PROGRESS_KIND_LABELS)} />
            </div>
            <Textarea aria-label="What was observed" rows={2} placeholder="What was studied, reviewed or heard — and what it showed." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="flex gap-1.5">
              <Button size="sm" variant="primary" disabled={!form.note.trim()} onClick={save}>
                Record
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
            Add evidence of progress
          </Button>
        ))}
    </div>
  )
}
