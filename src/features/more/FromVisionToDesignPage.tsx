import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { LinkedChips } from '@/components/Evidence'
import { Badge, Card, cx, EmptyState, PageHeader } from '@/components/ui'
import { OPPORTUNITY_STATE_LABELS, OUTCOME_STATE_LABELS } from '@/domain/labels'
import { evidenceFor } from '@/domain/traceability'
import { isActiveFramework } from '@/domain/wording'
import { ProgressList } from '@/features/interpret/progress'

/**
 * From Vision to Design — follows each principle through the opportunities it
 * opens and the outcomes that would show it is working, with the evidence of
 * progress gathered as design develops. Read top to bottom; no scores.
 */
export default function FromVisionToDesignPage() {
  const { data } = useProject()
  const [presentationOnly, setPresentationOnly] = useState(false)
  const t = data.project.terminology
  const base = `/projects/${data.project.id}`
  const vision = data.winThemes.find((w) => w.status === 'approved') ?? data.winThemes.find((w) => w.status === 'in_review') ?? data.winThemes.find((w) => w.status === 'proposed')
  const principles = data.principles.filter((p) => isActiveFramework(p.status)).sort((a, b) => a.order - b.order)

  return (
    <div>
      <PageHeader
        title="From Vision to Design"
        description="How the vision travels into the design: each principle, the opportunities it opens, what success could look like, and the evidence of progress gathered along the way."
        actions={
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            <input type="checkbox" className="accent-[var(--c-accent)]" checked={presentationOnly} onChange={(e) => setPresentationOnly(e.target.checked)} />
            Only items marked for the Owner presentation
          </label>
        }
      />
      {vision && (
        <div className="mb-6 rounded-lg border-l-4 border-accent bg-surface px-5 py-4 shadow-card">
          <div className="eyebrow">{t.winTheme}</div>
          <p className="mt-1 text-[22px] leading-snug font-bold tracking-tight">{vision.statement}</p>
        </div>
      )}
      {principles.length === 0 && <EmptyState title="Nothing to trace yet">Draft principles in Interpret to see how they carry into the design.</EmptyState>}
      <div className="space-y-5">
        {principles.map((p) => {
          const opportunities = data.opportunities.filter((o) => o.principleIds.includes(p.id) && (!presentationOnly || o.inPresentation)).sort((a, b) => a.order - b.order)
          const outcomes = data.outcomes.filter((o) => o.principleId === p.id && (!presentationOnly || o.inPresentation)).sort((a, b) => a.order - b.order)
          const evidence = evidenceFor(data, { type: 'principle', id: p.id }).all.length
          return (
            <Card key={p.id} aria-labelledby={`fvd-${p.id}`}>
              <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="border-b border-line p-5 lg:border-r lg:border-b-0">
                  <div className="eyebrow">{t.guidingPrinciple}</div>
                  <Link to={`${base}/interpret/principles?principle=${p.id}`} className="hover:underline">
                    <h2 id={`fvd-${p.id}`} className="mt-1 text-[17px] font-bold text-ink">
                      <span className="mr-1.5 font-mono text-[11px] font-normal text-muted">{p.code}</span>
                      {p.title}
                    </h2>
                  </Link>
                  <p className="mt-1 text-[13px] text-ink-2">{p.statement}</p>
                  {p.whyItMatters && (
                    <p className="mt-3 text-[12.5px] text-muted">
                      <span className="font-semibold text-ink-2">Why it matters. </span>
                      {p.whyItMatters}
                    </p>
                  )}
                  <p className="mt-3 text-[11.5px] text-muted">Grounded in {evidence === 0 ? 'no linked evidence yet' : `${evidence} source statement${evidence === 1 ? '' : 's'}`}.</p>
                </div>
                <div className="border-b border-line p-5 lg:border-r lg:border-b-0">
                  <div className="eyebrow mb-2 flex items-center gap-1.5">
                    <ArrowRight className="size-3" aria-hidden /> Design opportunities
                  </div>
                  {opportunities.length === 0 ? (
                    <p className="text-[12.5px] text-faint italic">None captured.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {opportunities.map((o) => (
                        <li key={o.id}>
                          <Link to={`${base}/interpret/opportunities?opportunity=${o.id}`} className="group block">
                            <span className="text-[13.5px] font-semibold text-ink group-hover:underline">{o.title}</span>
                            <span className="ml-1.5 text-[11px] text-muted">{OPPORTUNITY_STATE_LABELS[o.state]}</span>
                          </Link>
                          {o.linkedDriverIds.length > 0 && (
                            <div className="mt-1">
                              <LinkedChips refs={o.linkedDriverIds.map((id) => ({ type: 'driver' as const, id }))} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-5">
                  <div className="eyebrow mb-2 flex items-center gap-1.5">
                    <ArrowRight className="size-3" aria-hidden /> What success could look like
                  </div>
                  {outcomes.length === 0 ? (
                    <p className="text-[12.5px] text-faint italic">None described.</p>
                  ) : (
                    <ul className="space-y-4">
                      {outcomes.map((o) => (
                        <li key={o.id} className={cx('space-y-1.5')}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link to={`${base}/interpret/success?outcome=${o.id}`} className="text-[13.5px] font-semibold text-ink hover:underline">
                              {o.statement}
                            </Link>
                            <Badge tone={o.state === 'validated_with_owner' ? 'ok' : 'outline'}>{OUTCOME_STATE_LABELS[o.state]}</Badge>
                          </div>
                          <details>
                            <summary className="cursor-pointer text-[12px] text-muted">Evidence of progress ({o.evidenceOfProgress.length})</summary>
                            <div className="mt-2">
                              <ProgressList outcome={o} />
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
