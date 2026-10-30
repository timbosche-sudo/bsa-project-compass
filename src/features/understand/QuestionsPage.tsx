import { Swords } from 'lucide-react'
import { useProject } from '@/app/project'
import { LinkedChips } from '@/components/Evidence'
import { SuggestionsPanel } from '@/components/SuggestionsPanel'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { QuestionsCard } from '@/features/alignment/ThemesWorkspace'

/** Critical Questions — tensions, gaps and open questions, kept visible instead of resolved silently. */
export default function QuestionsPage() {
  const { data } = useProject()
  const conflicts = data.relationships.filter((r) => r.type === 'conflicts_with' && r.status !== 'rejected')
  return (
    <div>
      <PageHeader
        title="Critical Questions"
        description="What we still need to understand. Tensions, missing perspectives and requests that describe a solution rather than a need are recorded as questions — not quietly resolved."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          <QuestionsCard />
          <Card>
            <CardHeader eyebrow="From the evidence" title="Tensions" description="Statements recorded as pulling against each other." />
            <ul className="divide-y divide-line">
              {conflicts.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">No tensions recorded.</li>}
              {conflicts.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-5 py-3">
                  <Swords className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                  <div className="min-w-0 space-y-1.5">
                    {c.explanation && <p className="text-[13px] text-ink">{c.explanation}</p>}
                    <LinkedChips refs={[c.from, c.to]} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <SuggestionsPanel tasks={['critical_questions', 'find_missing_requirements']} />
      </div>
    </div>
  )
}
