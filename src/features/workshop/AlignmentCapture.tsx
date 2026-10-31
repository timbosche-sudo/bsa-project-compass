import { HelpCircle } from 'lucide-react'
import { useRef } from 'react'
import { useProject } from '@/app/project'
import { ALIGNMENT_TONE } from '@/components/AlignmentBadge'
import { formatDate } from '@/components/Collaboration'
import { Button, cx } from '@/components/ui'
import { latestAlignment } from '@/domain/alignment'
import { ALIGNMENT_STATUS_LABELS } from '@/domain/labels'
import { ALIGNMENT_STATUSES, type AlignmentResponseContent, type AlignmentTargetType, type WorkshopSession } from '@/domain/types'
import { AutoNotes } from './FacilitatorPanel'

const FIELDS: { key: Exclude<keyof AlignmentResponseContent, 'status'>; label: string; placeholder: string }[] = [
  { key: 'feedback', label: 'Feedback', placeholder: 'What the Owner said about this item…' },
  { key: 'refinements', label: 'Requested refinements', placeholder: 'Wording or emphasis the Owner asked to change…' },
  { key: 'questions', label: 'Open strategic questions', placeholder: 'Questions to resolve before this is aligned…' },
  { key: 'ownerComments', label: 'Owner comments', placeholder: 'Notable comments, in the Owner’s words…' },
]

export { ALIGNMENT_TONE }

/**
 * Records how the Owner responded to one item in a session. This is not a formal
 * approval: exact-wording adoption stays a separate, explicit action.
 */
export function AlignmentCapture({ type, id, code, session, compact }: { type: AlignmentTargetType; id: string; code: string; session: WorkshopSession | null; compact?: boolean }) {
  const { data, run, can, personName } = useProject()
  const sessionId = session?.id ?? null
  const current = data.alignment.find((r) => r.sessionId === sessionId && r.target.type === type && r.target.id === id)
  const previous = latestAlignment(data, type, id)
  const earlier = previous && previous.sessionId !== sessionId ? previous : null
  const content: AlignmentResponseContent = current
    ? { status: current.status, feedback: current.feedback, refinements: current.refinements, questions: current.questions, ownerComments: current.ownerComments }
    : { status: 'not_reviewed', feedback: '', refinements: '', questions: '', ownerComments: '' }
  const editable = can('workshop.facilitate') && session?.status !== 'closed'
  // Debounced field saves can land after another change; always merge into the latest recorded response.
  const latest = useRef(content)
  latest.current = content
  const save = async (patch: Partial<AlignmentResponseContent>, msg?: string) => {
    const response = { ...latest.current, ...patch }
    latest.current = response
    return (await run({ type: 'alignment.record', sessionId, target: { type, id }, response }, msg)) !== undefined
  }

  return (
    <div className={cx('space-y-3', compact && 'text-[13px]')}>
      {!session && <p className="rounded-md bg-sunken px-3 py-2 text-[12px] text-muted">No session selected — responses are recorded without a session. Start or select a session to keep them with the meeting.</p>}
      <div role="radiogroup" aria-label={`Owner response to ${code}`} className="grid grid-cols-2 gap-1.5">
        {ALIGNMENT_STATUSES.map((s) => {
          const on = content.status === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!editable}
              onClick={() => void save({ status: s }, `${code}: ${ALIGNMENT_STATUS_LABELS[s]}`)}
              className={cx(
                'flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors disabled:opacity-60',
                on ? 'border-ink bg-inverse text-on-inverse' : 'border-line-strong bg-surface text-ink-2 hover:border-ink',
              )}
            >
              <span className={cx('size-2 shrink-0 rounded-full', ALIGNMENT_TONE[s])} />
              {ALIGNMENT_STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      <p className="text-[11.5px] text-muted">Not yet reviewed until you record a response — silence is never treated as alignment. Formal approval of exact wording is separate.</p>
      {earlier && (
        <p className="text-[12px] text-ink-2">
          Earlier: <strong>{ALIGNMENT_STATUS_LABELS[earlier.status]}</strong>
          {earlier.sessionId && ` at ${data.workshops.find((w) => w.id === earlier.sessionId)?.code ?? 'an earlier session'}`} · {formatDate(earlier.at)}
          {earlier.refinements && <span className="block text-muted">Refinements: {earlier.refinements}</span>}
        </p>
      )}
      {FIELDS.map((f) => (
        <div key={f.key}>
          <div className="eyebrow mb-1">{f.label}</div>
          {editable ? (
            <AutoNotes key={`${sessionId}-${id}-${f.key}`} label={`${code} ${f.label}`} rows={compact ? 2 : 3} value={content[f.key]} placeholder={f.placeholder} onSave={(v) => save({ [f.key]: v })} />
          ) : (
            <p className="text-[13px] whitespace-pre-wrap text-ink-2">{content[f.key] || '—'}</p>
          )}
        </div>
      ))}
      {editable && content.questions.trim() && (
        <Button
          size="sm"
          variant="ghost"
          icon={<HelpCircle className="size-3.5" />}
          onClick={() => run({ type: 'question.create', question: `${code}: ${content.questions.trim()}`.slice(0, 1000), context: [{ type, id }] }, 'Added to Critical Questions')}
        >
          Add to Critical Questions
        </Button>
      )}
      {current && (
        <p className="text-[11px] text-muted">
          Recorded by {personName(current.recordedBy)} · {formatDate(current.at, true)}
        </p>
      )}
    </div>
  )
}
