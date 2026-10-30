import { ArrowRight, CalendarClock, CircleAlert, FileSearch, HelpCircle, Link2, Scale, ShieldCheck, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { ApprovalBadge } from '@/components/StatusBadge'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'
import { principleDriverIds } from '@/domain/drivers'
import { CATEGORY_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { dashboardModel } from '@/domain/metrics'

export function OverviewPage() {
  const { data, personName } = useProject()
  const p = data.project
  const base = `/projects/${p.id}`
  const t = p.terminology
  const m = dashboardModel(data)
  const winTheme = data.winThemes.find((w) => w.status === 'approved') ?? data.winThemes.find((w) => w.status === 'in_review') ?? data.winThemes.find((w) => w.status === 'proposed')
  const principles = data.principles.filter((x) => x.status !== 'superseded').sort((a, b) => a.order - b.order)

  const attention: { icon: ReactNode; label: string; count: number; to: string }[] = [
    { icon: <Scale className="size-4" />, label: `${t.decision}s awaiting approval`, count: m.decisionsAwaitingApproval.length, to: `${base}/decisions` },
    { icon: <ShieldCheck className="size-4" />, label: `${t.guidingPrinciple}s in review`, count: m.principles.inReview, to: `${base}/vision` },
    { icon: <Target className="size-4" />, label: 'Targets awaiting approval', count: m.awaitingTargetApproval.length, to: `${base}/drivers?measurement=awaiting_target_approval` },
    { icon: <CircleAlert className="size-4" />, label: `${t.designDriver}s at risk`, count: m.atRisk.length, to: `${base}/drivers?status=at_risk` },
    { icon: <Link2 className="size-4" />, label: 'Evidence links awaiting review', count: m.gaps.pendingRelationships.length, to: `${base}/alignment?tab=matrix` },
    { icon: <HelpCircle className="size-4" />, label: 'Open questions', count: data.questions.filter((q) => q.status === 'open').length, to: `${base}/alignment` },
    { icon: <FileSearch className="size-4" />, label: 'Transcriptions to verify', count: data.statements.filter((s) => s.transcriptionStatus === 'unverified' || s.transcriptionStatus === 'uncertain').length, to: `${base}/intelligence?filter=transcription` },
  ].filter((a) => a.count > 0)

  const chain = [
    { label: 'Sources', count: data.sources.length, to: `${base}/intelligence` },
    { label: 'Statements', count: data.statements.length, to: `${base}/intelligence` },
    { label: 'Themes', count: data.themes.filter((x) => x.status !== 'archived').length, to: `${base}/alignment` },
    { label: `${t.guidingPrinciple}s`, count: principles.length, to: `${base}/vision` },
    { label: `${t.designDriver}s`, count: data.drivers.filter((d) => d.approvalStatus !== 'superseded').length, to: `${base}/drivers` },
    { label: `${t.decision}s`, count: data.decisions.length, to: `${base}/decisions` },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
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
        </div>
      </header>

      {/* Win Theme hero */}
      <section aria-labelledby="wt-heading" className="relative overflow-hidden rounded-xl bg-inverse px-6 py-8 text-on-inverse sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border border-on-inverse/10" aria-hidden />
        <div className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full border border-accent/40" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-3">
          <span id="wt-heading" className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
            {t.winTheme}
          </span>
          {winTheme && <ApprovalBadge status={winTheme.status} />}
        </div>
        {winTheme ? (
          <>
            <p className="relative mt-4 max-w-4xl text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px]">{winTheme.statement}</p>
            <p className="relative mt-4 max-w-3xl text-[14.5px] leading-relaxed opacity-75">{winTheme.narrative}</p>
            {winTheme.status !== 'approved' && <p className="relative mt-4 text-[12px] opacity-60">Candidate — not yet approved. {data.winThemes.filter((w) => w.status !== 'superseded').length} alternative(s) under consideration.</p>}
          </>
        ) : (
          <p className="relative mt-4 text-[15px] opacity-75">No {t.winTheme} drafted yet.</p>
        )}
        <Link to={`${base}/vision`} className="relative mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
          Open Vision & Principles <ArrowRight className="size-3.5" />
        </Link>
      </section>

      {/* Alignment chain */}
      <nav aria-label="Alignment chain" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {chain.map((c, i) => (
          <Link key={c.label} to={c.to} className="group relative bg-surface px-4 py-3.5 hover:bg-sunken">
            <div className="eyebrow">{c.label}</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums">{c.count}</div>
            {i < chain.length - 1 && <ArrowRight className="absolute top-1/2 right-3 hidden size-4 -translate-y-1/2 text-faint lg:block" aria-hidden />}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader eyebrow="Layer two" title={`${t.guidingPrinciple}s`} description={`${m.principles.approved} of ${m.principles.total} approved`} actions={<Link className="text-[13px] font-medium text-accent-strong hover:underline" to={`${base}/vision`}>Manage</Link>} />
          {principles.length === 0 ? (
            <div className="p-5">
              <EmptyState title={`No ${t.guidingPrinciple.toLowerCase()}s yet`}>Promote themes from the Alignment Studio or draft them in Vision & Principles.</EmptyState>
            </div>
          ) : (
            <ul className="grid divide-line sm:grid-cols-2 sm:divide-x [&>li]:border-b [&>li]:border-line">
              {principles.map((pr) => (
                <li key={pr.id}>
                  <Link to={`${base}/vision?principle=${pr.id}`} className="block h-full px-5 py-4 hover:bg-sunken">
                    <div className="flex items-center justify-between gap-2">
                      <span className="code-tag">{pr.code}</span>
                      <ApprovalBadge status={pr.status} />
                    </div>
                    <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">{pr.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] text-muted">{pr.statement}</p>
                    <div className="mt-2 text-[11.5px] text-faint">
                      {CATEGORY_LABELS[pr.category]} · {principleDriverIds(data, pr.id).length} {t.designDriver.toLowerCase()}s
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs attention" />
            {attention.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted">Nothing is waiting on the team.</p>
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link to={a.to} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-sunken">
                      <span className="text-muted">{a.icon}</span>
                      <span className="flex-1 text-ink-2">{a.label}</span>
                      <span className="font-semibold tabular-nums">{a.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Upcoming milestones" />
            {m.upcomingMilestones.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted">No milestones in the next 120 days.</p>
            ) : (
              <ul className="divide-y divide-line">
                {m.upcomingMilestones.slice(0, 5).map((ms) => (
                  <li key={ms.id} className="flex items-start gap-3 px-5 py-2.5 text-[13px]">
                    <CalendarClock className="mt-0.5 size-4 text-muted" />
                    <span className="flex-1">
                      <span className="block font-medium text-ink">{ms.name}</span>
                      <span className="text-[12px] text-muted">{PHASE_LABELS[ms.phase]}</span>
                    </span>
                    <span className="text-[12px] whitespace-nowrap text-muted tabular-nums">{formatDate(ms.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent activity" />
            {data.audit.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.audit.slice(0, 6).map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-[12.5px]">
                    <span className="text-ink-2">{a.summary}</span>
                    <span className="block text-[11.5px] text-muted">
                      {personName(a.actorId)} · {formatDate(a.at, true)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
