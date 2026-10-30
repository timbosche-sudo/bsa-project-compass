import { History, Plus, Star, Trash2 } from 'lucide-react'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { EditableText } from '@/components/EditableText'
import { Badge, Button, Card, CardHeader, cx, EmptyState, PageHeader } from '@/components/ui'
import type { PointOfViewContent } from '@/domain/types'

const FIELDS: { key: Exclude<keyof PointOfViewContent, 'alternatives'>; label: string; prompt: string }[] = [
  { key: 'centralAmbition', label: 'Central ambition', prompt: 'In one or two sentences, what is this project ultimately trying to achieve?' },
  { key: 'opportunity', label: 'The opportunity', prompt: 'What is the bigger opportunity the Owner may not have named?' },
  { key: 'connectingIdea', label: 'The connecting idea', prompt: 'What idea ties together what we heard?' },
  { key: 'tensions', label: 'Tensions to navigate', prompt: 'Which trade-offs will shape the direction?' },
  { key: 'distinctiveness', label: 'What could make it distinctive', prompt: 'How could this project be different from a typical one of its kind?' },
  { key: 'keepInMind', label: 'What we must keep in mind', prompt: 'People, constraints or voices that must not be lost.' },
]

const EMPTY: PointOfViewContent = { centralAmbition: '', opportunity: '', connectingIdea: '', tensions: '', distinctiveness: '', keepInMind: '', alternatives: [] }

/** BSA’s emerging interpretation — a point of view the team can debate before it becomes a Vision. */
export default function PointOfViewPage() {
  const { data, can, run, personName } = useProject()
  const pov = data.pointOfView
  const edit = can('framework.edit')
  const content: PointOfViewContent = pov
    ? { centralAmbition: pov.centralAmbition, opportunity: pov.opportunity, connectingIdea: pov.connectingIdea, tensions: pov.tensions, distinctiveness: pov.distinctiveness, keepInMind: pov.keepInMind, alternatives: pov.alternatives }
    : EMPTY
  const save = (patch: Partial<PointOfViewContent>, msg = 'Saved') => run({ type: 'pov.update', content: { ...content, ...patch }, coalesce: true }, msg)

  if (!pov)
    return (
      <div>
        <PageHeader title="Point of View" description="BSA’s emerging interpretation of what we heard — the central ambition, the opportunity and the tensions that will shape the direction." />
        <EmptyState
          title="No point of view yet"
          action={
            edit && (
              <Button variant="primary" onClick={() => save({}, 'Point of view started')}>
                Start a point of view
              </Button>
            )
          }
        >
          Begin once the team has a draft of What We Heard. It is an internal working position, not an Owner commitment.
        </EmptyState>
      </div>
    )

  const setAlt = (id: string, patch: Partial<PointOfViewContent['alternatives'][number]>) => save({ alternatives: content.alternatives.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const recommend = (id: string) => save({ alternatives: content.alternatives.map((a) => ({ ...a, recommended: a.id === id ? !a.recommended : false })) }, 'Recommendation updated')

  return (
    <div>
      <PageHeader
        title="Point of View"
        description="BSA’s emerging interpretation of what we heard. An internal working position the team can test, sharpen and debate — not yet the Owner’s Vision."
        meta={
          <span className="text-[12px] text-muted">
            Last edited by {personName(pov.updatedBy)} · {formatDate(pov.updatedAt)} · {pov.history.length} saved version{pov.history.length === 1 ? '' : 's'}
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="divide-y divide-line">
          {FIELDS.map((f, i) => (
            <div key={f.key} className={cx('px-6 py-5', i === 0 && 'bg-sunken/50')}>
              <div className="eyebrow mb-1">{f.label}</div>
              <EditableText
                label={f.label}
                value={content[f.key]}
                canEdit={edit}
                placeholder={f.prompt}
                onSave={(v) => save({ [f.key]: v })}
                display={i === 0 ? (v) => <p className="text-[20px] leading-snug font-bold tracking-tight text-ink">{v}</p> : undefined}
              />
            </div>
          ))}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Explore before converging"
              title="Alternative directions"
              description="Hold more than one direction open. Recommend one when the team is ready."
              actions={
                edit && (
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => save({ alternatives: [...content.alternatives, { id: crypto.randomUUID(), title: 'New direction', summary: '', recommended: false }] }, 'Direction added')}>
                    Add
                  </Button>
                )
              }
            />
            <ul className="divide-y divide-line">
              {content.alternatives.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No alternatives yet.</li>}
              {content.alternatives.map((a) => (
                <li key={a.id} className={cx('space-y-1.5 px-5 py-4', a.recommended && 'bg-accent-soft/40')}>
                  <div className="flex items-start gap-2">
                    <EditableText className="flex-1" label="Direction title" multiline={false} value={a.title} canEdit={edit} onSave={(v) => v && setAlt(a.id, { title: v })} display={(v) => <p className="text-[14px] font-semibold text-ink">{v}</p>} />
                    {a.recommended && <Badge tone="ok">Recommended</Badge>}
                  </div>
                  <EditableText label="Direction summary" value={a.summary} canEdit={edit} rows={3} placeholder="Describe this direction." onSave={(v) => setAlt(a.id, { summary: v })} />
                  {edit && (
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant={a.recommended ? 'primary' : 'secondary'} icon={<Star className="size-3.5" />} onClick={() => recommend(a.id)} aria-pressed={a.recommended}>
                        {a.recommended ? 'Recommended' : 'Recommend'}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => save({ alternatives: content.alternatives.filter((x) => x.id !== a.id) }, 'Direction removed')} aria-label={`Remove ${a.title}`}>
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <details className="rounded-lg border border-line bg-surface px-5 py-4 text-[12.5px]">
            <summary className="flex cursor-pointer items-center gap-2 font-medium text-ink">
              <History className="size-4 text-muted" /> Earlier versions ({pov.history.length})
            </summary>
            <ol className="mt-3 space-y-3">
              {[...pov.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`} className="border-l-2 border-line pl-3">
                  <div className="text-muted">
                    {formatDate(h.at)} · {personName(h.by)}
                  </div>
                  <p className="mt-0.5 text-ink-2">{h.snapshot.centralAmbition || <em>No central ambition</em>}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  )
}
