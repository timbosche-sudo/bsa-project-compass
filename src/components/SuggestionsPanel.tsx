import { Check, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { ASSIST_TASK_LABELS, assistProviderFor, type AssistTask } from '@/services/ai'
import { LinkedChips } from './Evidence'
import { OriginBadge } from './StatusBadge'
import { useToast } from './Toast'
import { Badge, Button, Callout, Card, CardHeader, Select } from './ui'

/**
 * Assistant suggestions are proposals. They are stored as pending items and
 * change nothing until a person with review rights accepts them.
 */
export function SuggestionsPanel({ tasks }: { tasks: AssistTask[] }) {
  const { data, can, run } = useProject()
  const { adapter } = useSession()
  const notify = useToast()
  const [task, setTask] = useState<AssistTask>(tasks[0])
  const [busy, setBusy] = useState(false)
  const provider = assistProviderFor(adapter, data)
  const pending = data.suggestions.filter((s) => s.status === 'pending')

  const analyze = async () => {
    setBusy(true)
    try {
      const out = await provider.run(task, data)
      if (out.length === 0) {
        notify('ok', 'No new suggestions — nothing further was found.')
        return
      }
      await run({ type: 'suggestion.add', suggestions: out.map((s) => ({ ...s, origin: provider.origin, provider: provider.label })) }, `${out.length} suggestion(s) added for review`)
    } catch (e) {
      notify('error', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Assistant"
        title="Suggestions for review"
        description={provider.label}
        actions={pending.length > 0 && <Badge tone="ai">{pending.length} pending</Badge>}
      />
      <div className="space-y-3 px-5 py-4">
        {can('suggestion.request') ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Assistant task" className="w-auto min-w-0 flex-1" value={task} onChange={(e) => setTask(e.target.value as AssistTask)} options={tasks.map((t) => ({ value: t, label: ASSIST_TASK_LABELS[t] }))} />
            <Button icon={<Sparkles className="size-4" />} loading={busy} onClick={analyze}>
              Analyze
            </Button>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">Your role can view suggestions but not request analysis.</p>
        )}
        {provider.origin === 'rules' && (
          <Callout tone="ai">
            Suggestions come from transparent keyword and gap rules — no AI model is used. Shared words are weak evidence; review every suggestion.
          </Callout>
        )}
        {pending.length === 0 ? (
          <p className="text-[13px] text-muted">No suggestions awaiting review.</p>
        ) : (
          <ul className="space-y-2.5">
            {pending.map((s) => (
              <li key={s.id} className="rounded-md border border-dashed border-ai/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <OriginBadge origin={s.origin} />
                  <span className="text-[13px] font-medium text-ink">{s.title}</span>
                </div>
                {s.body && <p className="mt-1 text-[12.5px] text-ink-2">{s.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="eyebrow">Based on</span>
                  {s.evidence.length ? <LinkedChips refs={s.evidence} /> : <Badge tone="warn">Inference — no source reference</Badge>}
                </div>
                {can('suggestion.review') && (
                  <div className="mt-2.5 flex gap-1.5">
                    <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => run({ type: 'suggestion.accept', id: s.id }, 'Suggestion accepted')}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run({ type: 'suggestion.dismiss', id: s.id }, 'Suggestion dismissed')}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
