import { FlaskConical, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Dialog } from '@/components/Dialog'
import { DecisionBadge } from '@/components/StatusBadge'
import { Badge, Button, Card, EmptyState, Field, Input, optionsFrom, PageHeader, Select, Textarea } from '@/components/ui'
import { evaluateCba } from '@/domain/cba'
import { decisionDriverIds } from '@/domain/drivers'
import { DECISION_STATUS_LABELS, PHASE_LABELS } from '@/domain/labels'
import type { DecisionStatus, Phase } from '@/domain/types'

export default function DecisionsPage() {
  const { data, can, personName } = useProject()
  const [status, setStatus] = useState<DecisionStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const t = data.project.terminology
  const rows = data.decisions.filter((d) => !status || d.status === status)
  return (
    <div>
      <PageHeader
        eyebrow="Structured evaluation"
        title={`${t.decision} Lab`}
        description="Evaluate design alternatives with Choosing by Advantages: decide on the importance of factual differences, keep cost separate, and record who recommended and who approved."
        actions={
          can('decision.edit') && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New {t.decision.toLowerCase()}
            </Button>
          )
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Select aria-label="Filter by status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as DecisionStatus | '')} options={[{ value: '', label: 'All statuses' }, ...optionsFrom(DECISION_STATUS_LABELS)]} />
        <span className="text-[12.5px] text-muted">{rows.length} decision(s)</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No decisions" icon={<FlaskConical className="size-6" />}>
          Frame a decision question, define alternatives and evaluate their advantages.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((d) => {
            const ev = evaluateCba(d)
            const blocking = ev.issues.filter((i) => i.severity === 'blocking').length
            const rec = d.alternatives.find((a) => a.id === d.recommendation?.alternativeId)
            const fin = d.alternatives.find((a) => a.id === d.approval?.alternativeId)
            return (
              <Link key={d.id} to={d.id} className="block">
                <Card className="h-full p-5 transition-colors hover:border-line-strong">
                  <div className="flex items-center justify-between gap-2">
                    <span className="code-tag">{d.code}</span>
                    <DecisionBadge status={d.status} />
                  </div>
                  <h2 className="mt-2 text-[16px] leading-snug font-semibold tracking-tight">{d.question}</h2>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="outline">{d.alternatives.length} alternatives</Badge>
                    <Badge tone="outline">{d.factors.length} factors</Badge>
                    <Badge tone="outline">{decisionDriverIds(data, d.id).length} drivers</Badge>
                    {d.status !== 'approved' && (ev.complete ? <Badge tone="ok">CBA complete</Badge> : <Badge tone="warn">{blocking} open item(s)</Badge>)}
                  </div>
                  <div className="mt-3 text-[12.5px] text-muted">
                    {fin ? (
                      <>
                        Final: <span className="font-medium text-ink">{fin.name}</span> · approved by {personName(d.approval!.by)}
                      </>
                    ) : rec ? (
                      <>
                        Recommended: <span className="font-medium text-ink">{rec.name}</span> · awaiting approval
                      </>
                    ) : (
                      <>
                        {PHASE_LABELS[d.phase]}
                        {d.dueDate && ` · due ${formatDate(d.dueDate)}`}
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
      <NewDecisionDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function NewDecisionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, run, pending } = useProject()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [phase, setPhase] = useState<Phase>(data.project.phase)
  const [due, setDue] = useState('')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Frame a decision"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!question.trim()}
            onClick={async () => {
              const id = await run({ type: 'decision.create', question, context, phase, dueDate: due || null }, 'Decision opened')
              if (id) {
                onOpenChange(false)
                setQuestion('')
                setContext('')
                navigate(`/projects/${data.project.id}/decisions/${id}`)
              }
            }}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Decision question" required className="sm:col-span-2" hint="Phrase as a question with a clear set of possible answers.">
          {(id) => <Input id={id} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Context" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={context} onChange={(e) => setContext(e.target.value)} />}
        </Field>
        <Field label="Phase">
          {(id) => <Select id={id} value={phase} onChange={(e) => setPhase(e.target.value as Phase)} options={optionsFrom(PHASE_LABELS)} />}
        </Field>
        <Field label="Decision needed by">
          {(id) => <Input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}
