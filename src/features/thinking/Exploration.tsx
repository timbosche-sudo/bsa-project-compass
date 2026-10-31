import { ArrowLeft, PenLine, Sparkle } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { LinkedChips } from '@/components/Evidence'
import { Badge, Button, Callout, cx } from '@/components/ui'
import type { CanvasKind, Suggestion } from '@/domain/types'

/**
 * Guided strategic exploration: a question, curated directions to compare, and
 * a way to start a working interpretation — never a generated answer.
 */
export function Exploration({ s, onBack, onDeveloped }: { s: Suggestion; onBack: () => void; onDeveloped: () => void }) {
  const { can, run } = useProject()
  const ex = s.card!.exploration!
  const [compare, setCompare] = useState<string[]>([])
  const chosen = ex.directions.filter((d) => compare.includes(d.id))
  const kind: CanvasKind = s.card!.fingerprint.startsWith('opportunities-from-principle') ? 'opportunity' : s.card!.fingerprint.startsWith('vision-alternatives') ? 'narrative' : 'interpretation'

  const develop = async (title: string, body: string, origin: 'human' | 'rules') => {
    const id = await run(
      {
        type: 'canvas.create',
        item: { kind, title, body, evidence: s.evidence.slice(0, 40), context: s.card!.scope },
        origin,
        sourceSuggestionId: s.id,
      },
      'Added to the Working Canvas',
    )
    if (id) onDeveloped()
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Back to suggestions
      </button>
      <div>
        <div className="eyebrow">Guided exploration</div>
        <h3 className="mt-1 text-[16px] leading-snug font-semibold text-ink">{ex.question}</h3>
        <p className="mt-1 text-[12.5px] text-ink-2">{s.card!.observation}</p>
      </div>
      {s.evidence.length > 0 && (
        <div className="text-[12px]">
          <span className="eyebrow mr-2">Based on</span>
          <LinkedChips refs={s.evidence} />
        </div>
      )}
      <Callout tone="ai">{ex.basis} No AI model was used.</Callout>

      {ex.directions.length === 0 ? (
        <p className="text-[13px] text-muted">The available evidence does not support specific directions. Write your own interpretation below.</p>
      ) : (
        <ul className="space-y-2" aria-label="Possible directions">
          {ex.directions.map((d, i) => {
            const on = compare.includes(d.id)
            return (
              <li key={d.id} className={cx('rounded-md border p-3', on ? 'border-ink' : 'border-line')}>
                <div className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{d.title}</div>
                    <p className="mt-0.5 text-[12.5px] text-ink-2">{d.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="flex min-h-8 items-center gap-1.5 text-[12px] text-muted">
                        <input type="checkbox" className="size-4 accent-[var(--c-accent)]" checked={on} onChange={() => setCompare(on ? compare.filter((x) => x !== d.id) : [...compare, d.id].slice(-3))} />
                        Compare
                      </label>
                      {can('suggestion.request') && (
                        <Button size="sm" icon={<Sparkle className="size-3.5" />} onClick={() => develop(d.title, d.summary, 'rules')}>
                          Develop this direction
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {chosen.length >= 2 && (
        <section aria-label="Comparison" className="rounded-md border border-line p-3">
          <div className="eyebrow mb-2">Comparing</div>
          <div className={cx('grid gap-3', chosen.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {chosen.map((d) => (
              <div key={d.id} className="min-w-0">
                <div className="text-[12.5px] font-semibold">{d.title}</div>
                <p className="mt-1 text-[12px] text-ink-2">{d.summary}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Questions to weigh: which is best supported by the evidence? Which would the Owner recognize? Which opens the most design possibilities?</p>
        </section>
      )}

      {can('suggestion.request') && (
        <Button variant="ghost" icon={<PenLine className="size-4" />} onClick={() => develop('Working interpretation', '', 'human')}>
          Write my own interpretation
        </Button>
      )}
      <p className="text-[11.5px] text-muted">
        <Badge tone="outline">Working Canvas</Badge> Ideas you develop stay separate from project content until you promote them.
      </p>
    </div>
  )
}
