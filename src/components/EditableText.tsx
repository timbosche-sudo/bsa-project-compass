import { Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, cx, Input, Textarea } from './ui'

/**
 * Read-first text with an explicit Edit affordance. Saving is a deliberate act,
 * so wording is never changed by an accidental click or keystroke.
 */
export function EditableText({
  label,
  value,
  onSave,
  canEdit,
  placeholder = 'Not yet written.',
  multiline = true,
  rows = 4,
  className,
  display,
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<unknown> | unknown
  canEdit: boolean
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
  display?: (v: string) => ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      if ((await onSave(draft.trim())) !== undefined) setEditing(false)
    } finally {
      setBusy(false)
    }
  }
  if (editing)
    return (
      <div className={cx('space-y-2', className)}>
        {multiline ? (
          <Textarea aria-label={label} rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        ) : (
          <Input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="primary" loading={busy} onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  return (
    <div className={cx('group flex items-start gap-2', className)}>
      <div className="min-w-0 flex-1">{value ? (display ? display(value) : <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-ink-2">{value}</p>) : <p className="text-[13px] text-faint italic">{placeholder}</p>}</div>
      {canEdit && (
        <button
          type="button"
          aria-label={`Edit ${label}`}
          className="shrink-0 rounded p-1 text-faint hover:bg-sunken hover:text-ink"
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  )
}
