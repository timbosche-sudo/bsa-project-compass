import { BookmarkPlus, ChevronDown, ChevronRight, Compass, HelpCircle, Link2, X } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { LinkedChips, StatementQuote } from '@/components/Evidence'
import { Badge, Button, cx } from '@/components/ui'
import type { EvidenceStatus, Suggestion, ThinkingMode } from '@/domain/types'
import { MODE_LABELS } from '@/services/thinking/context'

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  direct: 'Direct source evidence',
  indirect: 'Indirect contextual support',
  inference: 'Inference — no source reference',
}
const EVIDENCE_TONE: Record<EvidenceStatus, 'ok' | 'info' | 'warn'> = { direct: 'ok', indirect: 'info', inference: 'warn' }

export const MODE_ACCENT: Record<ThinkingMode, string> = {
  explore: 'border-l-info-fill',
  challenge: 'border-l-warn-fill',
  develop: 'border-l-ok-fill',
  refine: 'border-l-accent',
}

export const methodLabel = (origin: 'ai' | 'rules' | 'human') => (origin === 'ai' ? 'AI-assisted analysis' : origin === 'rules' ? 'Rule-based analysis' : 'Human-authored')

/** Legacy suggestion kinds carry a concrete proposal that can be applied after review. */
const APPLY_LABEL: Partial<Record<Suggestion['kind'], string>> = {
  relationship: 'Apply proposed link',
  theme: 'Create proposed theme',
}

/**
 * One observation, in the order a colleague would offer it: what was noticed,
 * why it matters, the context, a question, and a next step — with its method
 * and evidence status always visible.
 */
export function SuggestionCard({ s, onExplore }: { s: Suggestion; onExplore: (s: Suggestion) => void }) {
  const { data, can, run } = useProject()
  const [open, setOpen] = useState(false)
  const card = s.card
  const evidenceStatus: EvidenceStatus = card?.evidenceStatus ?? (s.evidence.some((e) => e.type === 'statement') ? 'direct' : s.evidence.length ? 'indirect' : 'inference')
  const statements = s.evidence.filter((e) => e.type === 'statement').map((e) => data.statements.find((x) => x.id === e.id)).filter((x) => !!x)
  const others = s.evidence.filter((e) => e.type !== 'statement')
  const pending = s.status === 'pending'
  return (
    <article className={cx('rounded-lg border border-l-4 border-line bg-surface p-3.5 shadow-card', MODE_ACCENT[card?.mode ?? 'explore'])} aria-label={card?.observation ?? s.title}>
      <div className="flex flex-wrap items-center gap-1.5">
        {card && <span className="eyebrow">{MODE_LABELS[card.mode].label}</span>}
        <Badge tone="ai">{methodLabel(s.origin)}</Badge>
        <Badge tone={EVIDENCE_TONE[evidenceStatus]}>{EVIDENCE_STATUS_LABELS[evidenceStatus]}</Badge>
      </div>
      <h3 className="mt-2 text-[14px] leading-snug font-semibold text-ink">{card?.observation ?? s.title}</h3>
      {(card?.whyItMatters || s.body) && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{card?.whyItMatters ?? s.body}</p>}
      {card?.question && (
        <p className="mt-2 flex gap-1.5 rounded-md bg-sunken px-2.5 py-2 text-[13px] font-medium text-ink">
          <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
          <span>
            <span className="sr-only">Question to consider: </span>
            {card.question}
          </span>
        </p>
      )}
      {card?.nextAction && (
        <p className="mt-2 text-[12px] text-muted">
          <span className="font-semibold text-ink-2">Suggested next action: </span>
          {card.nextAction}
        </p>
      )}

      <button type="button" className="mt-2 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Supporting context and evidence
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          {card?.supportingContext && <p className="text-[12px] whitespace-pre-line text-ink-2">{card.supportingContext}</p>}
          {statements.slice(0, 4).map((st) => (
            <StatementQuote key={st.id} statement={st} compact />
          ))}
          {others.length > 0 && <LinkedChips refs={others} />}
          {!s.evidence.length && <p className="text-[12px] text-muted italic">No source reference. Treat this as an inference to test.</p>}
          {card?.method && <p className="text-[11px] text-muted">Method: {card.method}</p>}
        </div>
      )}

      {pending && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          <Button size="sm" variant="primary" icon={<Compass className="size-3.5" />} onClick={() => (card?.exploration ? onExplore(s) : setOpen(true))}>
            {card?.exploration ? 'Explore further' : 'View evidence'}
          </Button>
          {can('suggestion.request') && (
            <Button size="sm" icon={<BookmarkPlus className="size-3.5" />} onClick={() => run({ type: 'suggestion.toCanvas', id: s.id }, 'Saved to the Working Canvas')}>
              Accept as working consideration
            </Button>
          )}
          {can('comment.create') && (
            <Button size="sm" variant="ghost" icon={<HelpCircle className="size-3.5" />} onClick={() => run({ type: 'suggestion.saveQuestion', id: s.id }, 'Saved as a Critical Question')}>
              Save as question
            </Button>
          )}
          {APPLY_LABEL[s.kind] && can('suggestion.review') && (
            <Button size="sm" variant="ghost" icon={<Link2 className="size-3.5" />} onClick={() => run({ type: 'suggestion.accept', id: s.id }, 'Applied for review')}>
              {APPLY_LABEL[s.kind]}
            </Button>
          )}
          {can('suggestion.review') && (
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => run({ type: 'suggestion.markNotRelevant', id: s.id }, 'Marked not relevant')}>
                Not relevant
              </Button>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run({ type: 'suggestion.dismiss', id: s.id }, 'Dismissed')} aria-label={`Dismiss: ${card?.observation ?? s.title}`}>
                Dismiss
              </Button>
            </span>
          )}
        </div>
      )}
    </article>
  )
}
