import { Check, Circle, FileText, Presentation } from 'lucide-react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { Badge, Button, Callout, Card, CardHeader, PageHeader } from '@/components/ui'
import { isActiveFramework } from '@/domain/wording'

const STATUS_LABEL = { planned: 'Planned', live: 'In session', closed: 'Held' } as const

/** Align — prepare for and hold the Owner alignment conversation. */
export default function AlignPage() {
  const { data } = useProject()
  const t = data.project.terminology
  const base = `/projects/${data.project.id}`
  const workshops = [...data.workshops].sort((a, b) => b.date.localeCompare(a.date))
  const principles = data.principles.filter((p) => isActiveFramework(p.status))
  const ready = [
    { label: 'What We Heard items ready to present', ok: data.heard.some((h) => h.inPresentation && h.reviewed), to: 'understand/heard' },
    { label: `${t.winTheme} alternatives to discuss`, ok: data.winThemes.some((w) => isActiveFramework(w.status)), to: 'interpret/vision' },
    { label: `${t.guidingPrinciple}s with “why it matters”`, ok: principles.length > 0 && principles.every((p) => !!p.whyItMatters), to: 'interpret/principles' },
    { label: 'Design opportunities selected for the presentation', ok: data.opportunities.some((o) => o.inPresentation), to: 'interpret/opportunities' },
    { label: 'Potential outcomes selected for the presentation', ok: data.outcomes.some((o) => o.inPresentation), to: 'interpret/success' },
    { label: 'The direction to present is saved as a version', ok: data.directions.some((d) => d.state === 'bsa_proposed'), to: 'align/history' },
  ]
  return (
    <div>
      <PageHeader
        title="Prepare"
        description="Get ready for the Owner conversation: check what is ready to present, and plan or review workshop sessions."
        actions={
          <Link to={`${base}/workshop`}>
            <Button variant="primary" icon={<Presentation className="size-4" />}>
              Open Owner Workshop
            </Button>
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Owner conversations" description="Workshops run in a full-screen, presentation-ready mode with live editing and a meeting summary." />
            <ul className="divide-y divide-line">
              {workshops.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No workshops planned yet. Open the Owner Workshop to plan one.</li>}
              {workshops.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="font-mono text-[11px] text-muted">{w.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{w.title}</span>
                    <span className="block text-[12px] text-muted">
                      {formatDate(w.date)} · {w.attendees.length} attendee{w.attendees.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <Badge tone={w.status === 'closed' ? 'ok' : w.status === 'live' ? 'info' : 'outline'}>{STATUS_LABEL[w.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Callout tone="info">
            Alignment is the primary outcome of the conversation. Formal adoption of exact wording is optional and recorded only when the Owner chooses to adopt it.
          </Callout>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Preparing to present" description="A qualitative check of what is ready." />
            <ul className="space-y-0.5 px-3 pb-3">
              {ready.map((r) => (
                <li key={r.label}>
                  <Link to={`${base}/${r.to}`} className="flex items-start gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-sunken">
                    {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Ready" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-label="Not yet" />}
                    <span className="text-ink">{r.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="After the conversation" />
            <div className="px-5 pb-4 text-[13px] text-ink-2">
              <p>Download the meeting summary from the workshop, or produce reports and presentations in</p>
              <Link to={`${base}/reports`} className="mt-2 inline-flex items-center gap-1.5 font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
                <FileText className="size-4" /> Reports & Deliverables
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
