import { ArrowRight, Check, Circle, FileText, HelpCircle, Presentation } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { ApprovalBadge } from '@/components/StatusBadge'
import { Badge, Card, CardHeader, cx } from '@/components/ui'
import { PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import type { ProjectData } from '@/domain/types'
import { alignmentStatusOf, latestAlignedDirection } from '@/domain/alignment'
import { isActiveFramework } from '@/domain/wording'

type Stage = 'understand' | 'interpret' | 'align'

/** Meaningful activity only — routine link reviews and reorders are left to the audit log. */
const MEANINGFUL = /^(direction\.(snapshot|restore)|alignment\.record|source\.create|heard\.(create|update)|pov\.update|framework\.(create|edit|submit|approve|openRevision)|principle\.(edit|merge|updateSupport)|winTheme\.edit|opportunity\.create|outcome\.(create|addProgress)|theme\.(create|promote)|workshop\.(start|end|approve.*)|question\.(create|resolve))/

export function readiness(data: ProjectData) {
  const principles = data.principles.filter((p) => isActiveFramework(p.status))
  const items: { label: string; done: boolean; to: string; stage: Stage }[] = [
    { label: 'Evidence gathered from the Owner and stakeholders', done: data.sources.length > 0 && data.statements.length > 0, to: 'understand/evidence', stage: 'understand' },
    { label: 'Themes identified across sources', done: data.themes.some((t) => t.status !== 'archived'), to: 'understand/themes', stage: 'understand' },
    { label: 'What We Heard drafted and reviewed', done: data.heard.some((h) => h.reviewed && h.inPresentation), to: 'understand/heard', stage: 'understand' },
    { label: 'Point of view articulated', done: !!data.pointOfView?.centralAmbition, to: 'interpret/point-of-view', stage: 'interpret' },
    { label: `${data.project.terminology.winTheme} drafted`, done: data.winThemes.some((w) => isActiveFramework(w.status)), to: 'interpret/vision', stage: 'interpret' },
    { label: 'Principles explain why they matter', done: principles.length > 0 && principles.every((p) => !!p.whyItMatters), to: 'interpret/principles', stage: 'interpret' },
    { label: 'Design opportunities explored', done: data.opportunities.length > 0, to: 'interpret/opportunities', stage: 'interpret' },
    { label: 'Potential outcomes considered', done: data.outcomes.length > 0, to: 'interpret/success', stage: 'interpret' },
    { label: 'Owner alignment conversation held', done: data.workshops.some((w) => w.status === 'closed'), to: 'align', stage: 'align' },
    { label: 'Owner responses recorded for every principle', done: principles.length > 0 && principles.every((p) => alignmentStatusOf(data, 'principle', p.id) !== 'not_reviewed'), to: 'align/alignment', stage: 'align' },
    { label: 'Aligned direction recorded', done: !!latestAlignedDirection(data), to: 'align/history', stage: 'align' },
  ]
  const current: Stage = items.find((i) => !i.done)?.stage ?? 'align'
  return { items, current }
}

export default function ProjectHome() {
  const { data, personName } = useProject()
  const p = data.project
  const t = p.terminology
  const base = `/projects/${p.id}`
  const vision = data.winThemes.find((w) => w.status === 'approved') ?? data.winThemes.find((w) => w.status === 'in_review') ?? data.winThemes.find((w) => w.status === 'proposed')
  const principles = data.principles.filter((x) => isActiveFramework(x.status)).sort((a, b) => a.order - b.order)
  const open = data.questions.filter((q) => q.status === 'open')
  const { items, current } = readiness(data)
  const recent = data.audit.filter((a) => MEANINGFUL.test(a.action)).slice(0, 6)
  const nextWorkshop = data.workshops.filter((w) => w.status !== 'closed').sort((a, b) => a.date.localeCompare(b.date))[0]

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="eyebrow mb-2">
          {p.code} · {p.owner.name}
        </div>
        <h1 className="display">{p.name}</h1>
        {p.tagline && <p className="mt-2 text-[15px] text-muted">{p.tagline}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="outline">{SECTOR_LABELS[p.sector]}</Badge>
          <Badge tone="outline">{PHASE_LABELS[p.phase]}</Badge>
          {p.isDemo && <Badge tone="warn">Synthetic demonstration data</Badge>}
        </div>
      </header>

      <StageTrack current={current} base={base} />

      <section aria-labelledby="vision-heading" className="relative overflow-hidden rounded-lg bg-black px-6 py-8 text-white ring-1 ring-line sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border border-white/10" aria-hidden />
        <div className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full border border-accent/40" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-3">
          <span id="vision-heading" className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
            Latest working {t.winTheme.toLowerCase()}
          </span>
          {vision && <ApprovalBadge status={vision.status} />}
        </div>
        {vision ? (
          <>
            <p className="relative mt-4 max-w-4xl text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[42px]">{vision.statement}</p>
            <p className="relative mt-4 max-w-3xl text-[14.5px] leading-relaxed opacity-75">{vision.narrative}</p>
          </>
        ) : (
          <p className="relative mt-4 text-[15px] opacity-75">No {t.winTheme.toLowerCase()} drafted yet.</p>
        )}
        <Link to={`${base}/interpret/vision`} className="relative mt-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-white underline decoration-accent decoration-2 underline-offset-4">
          Open {t.winTheme} <ArrowRight className="size-3.5" />
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={`${t.guidingPrinciple}s`} actions={<MoreLink to={`${base}/interpret/principles`}>Open</MoreLink>} />
            {principles.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted">No principles drafted yet.</p>
            ) : (
              <ol className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                {principles.map((pr) => (
                  <li key={pr.id} className="border-line sm:border-b sm:odd:border-r">
                    <Link to={`${base}/interpret/principles?principle=${pr.id}`} className="block h-full px-5 py-3.5 hover:bg-sunken">
                      <span className="font-mono text-[11px] text-muted">{pr.code}</span>
                      <span className="block text-[14.5px] font-semibold text-ink">{pr.title}</span>
                      <span className="line-clamp-2 text-[12.5px] text-muted">{pr.statement}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title="Unresolved questions" description="What we still need to understand before converging." actions={<MoreLink to={`${base}/understand/questions`}>All questions</MoreLink>} />
            <ul className="divide-y divide-line">
              {open.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No open questions.</li>}
              {open.slice(0, 4).map((q) => (
                <li key={q.id} className="flex items-start gap-2 px-5 py-3 text-[13px]">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  <span className="text-ink">{q.question}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent meaningful changes" />
            <ul className="divide-y divide-line">
              {recent.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No changes yet.</li>}
              {recent.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-[13px]">
                  <span className="text-ink-2">{a.summary}</span>
                  <span className="block text-[11.5px] text-muted">
                    {personName(a.actorId)} · {formatDate(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Readiness" description="A qualitative check — not a score." />
            <ul className="space-y-0.5 px-3 pb-3">
              {items.map((i) => (
                <li key={i.label}>
                  <Link to={`${base}/${i.to}`} className="flex items-start gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-sunken">
                    {i.done ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Done" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-label="Not yet" />}
                    <span className={cx(i.done ? 'text-ink-2' : 'text-ink')}>{i.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Deliverables" />
            <ul className="space-y-0.5 px-3 pb-3 text-[13px]">
              <DeliverableLink to={`${base}/understand/heard`} icon={<FileText className="size-4" />} label="What We Heard" sub="Owner-ready synthesis with supporting quotes" />
              <DeliverableLink to={`${base}/align`} icon={<Presentation className="size-4" />} label="Owner alignment workshop" sub={nextWorkshop ? `${nextWorkshop.code} · ${formatDate(nextWorkshop.date)}` : 'Plan the next conversation'} />
              <DeliverableLink to={`${base}/reports`} icon={<FileText className="size-4" />} label="Reports & Deliverables" sub="PDF, PowerPoint, spreadsheet and CSV exports" />
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StageTrack({ current, base }: { current: Stage; base: string }) {
  const stages: { key: Stage; n: string; label: string; purpose: string }[] = [
    { key: 'understand', n: '01', label: 'Understand', purpose: 'Listen, gather evidence, synthesize what we heard.' },
    { key: 'interpret', n: '02', label: 'Interpret', purpose: 'Form a point of view, vision, principles and opportunities.' },
    { key: 'align', n: '03', label: 'Align', purpose: 'Build shared ownership with the Owner.' },
  ]
  return (
    <nav aria-label="Project stages" className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
      {stages.map((s) => {
        const isCurrent = s.key === current
        return (
          <Link key={s.key} to={`${base}/${s.key}`} aria-current={isCurrent ? 'step' : undefined} className={cx('relative bg-surface px-5 py-4 hover:bg-sunken', isCurrent && 'bg-accent-soft/50')}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted">{s.n}</span>
              <span className="text-[15px] font-bold text-ink">{s.label}</span>
              {isCurrent && <Badge tone="info">Current focus</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] text-muted">{s.purpose}</p>
          </Link>
        )
      })}
    </nav>
  )
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-[13px] font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:decoration-ink" to={to}>
      {children}
    </Link>
  )
}

function DeliverableLink({ to, icon, label, sub }: { to: string; icon: ReactNode; label: string; sub: string }) {
  return (
    <li>
      <Link to={to} className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-sunken">
        <span className="mt-0.5 text-muted">{icon}</span>
        <span>
          <span className="block font-medium text-ink">{label}</span>
          <span className="block text-[12px] text-muted">{sub}</span>
        </span>
      </Link>
    </li>
  )
}
