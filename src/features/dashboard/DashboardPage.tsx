import { AlertTriangle, CalendarClock, CircleHelp, FileWarning, Scale, Target, UserX } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { DecisionBadge, DriverStatusBadge } from '@/components/StatusBadge'
import { Card, CardHeader, cx, Meter, PageHeader, Select, Stat, Unknown } from '@/components/ui'
import { driverStatus, MEASUREMENT_STATE_LABELS, type MeasurementState } from '@/domain/drivers'
import { DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS } from '@/domain/labels'
import { dashboardModel, type DashboardFilters } from '@/domain/metrics'
import { DRIVER_STATUSES, type DecisionStatus, type DesignDriver, type DriverStatus, type Phase } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'

/** Status → token. Status hues are reserved for state and always paired with a text label. */
const STATUS_FILL: Record<DriverStatus, string> = {
  proposed: 'bg-line-strong',
  under_review: 'bg-info-fill',
  approved: 'bg-accent/50',
  in_progress: 'bg-accent',
  at_risk: 'bg-risk-fill',
  verified: 'bg-ok-fill',
  not_achieved: 'bg-danger-fill',
  superseded: 'bg-faint/40',
}

export default function DashboardPage() {
  const { data } = useProject()
  const [params, setParams] = useSearchParams()
  const filters: DashboardFilters = {
    principleId: params.get('principle') || undefined,
    organization: params.get('org') || undefined,
    phase: (params.get('phase') as Phase) || undefined,
    decisionStatus: (params.get('decision') as DecisionStatus) || undefined,
    measurementState: (params.get('measurement') as MeasurementState) || undefined,
  }
  const m = useMemo(() => dashboardModel(data, filters), [data, params]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = data.project.terminology
  const base = `/projects/${data.project.id}`
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const total = m.drivers.length
  const finals = m.verified.length + m.notAchieved.length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Measurable impact"
        title="Success Dashboard"
        description="Performance achievement and data completeness are reported separately. Administrative progress is never presented as project success, and unknown or unmeasured values are shown as such."
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Dashboard filters">
        <Select aria-label="Guiding principle" className="w-auto max-w-[240px]" value={filters.principleId ?? ''} onChange={(e) => set('principle', e.target.value)} options={[{ value: '', label: `All ${t.guidingPrinciple.toLowerCase()}s` }, ...data.principles.filter((p) => isActiveFramework(p.status)).map((p) => ({ value: p.id, label: `${p.code} ${p.title}` }))]} />
        <Select aria-label="Responsible organization" className="w-auto" value={filters.organization ?? ''} onChange={(e) => set('org', e.target.value)} options={[{ value: '', label: 'All organizations' }, ...m.organizations.map((o) => ({ value: o, label: o }))]} />
        <Select aria-label="Project phase" className="w-auto" value={filters.phase ?? ''} onChange={(e) => set('phase', e.target.value)} options={[{ value: '', label: 'All phases' }, ...Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="Decision status" className="w-auto" value={filters.decisionStatus ?? ''} onChange={(e) => set('decision', e.target.value)} options={[{ value: '', label: 'All decision statuses' }, ...Object.entries(DECISION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="Measurement status" className="w-auto" value={filters.measurementState ?? ''} onChange={(e) => set('measurement', e.target.value)} options={[{ value: '', label: 'All measurement states' }, ...Object.entries(MEASUREMENT_STATE_LABELS).map(([value, label]) => ({ value, label }))]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={`Approved ${t.guidingPrinciple}s`} value={`${m.principles.approved}/${m.principles.total}`} sub={`${m.principles.inReview} in review`} />
        <Stat label={`Active ${t.designDriver}s`} value={m.active.length} sub={`of ${total} in view`} tone="accent" />
        <Stat label="Verified" value={m.verified.length} sub="with evidence & reviewer" tone="ok" />
        <Stat label="At risk" value={m.atRisk.length} tone={m.atRisk.length ? 'risk' : undefined} />
        <Stat label="Without owner" value={m.withoutOwner.length} tone={m.withoutOwner.length ? 'warn' : undefined} />
        <Stat label={`${t.decision}s awaiting approval`} value={m.decisionsAwaitingApproval.length} tone={m.decisionsAwaitingApproval.length ? 'warn' : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Performance achievement" title="Outcomes verified with evidence" description="Counts only drivers with a final, reviewer-signed verification." />
          <div className="px-5 py-5">
            {finals === 0 ? (
              <p className="text-[13px] text-ink-2">
                <Unknown>No outcomes verified yet</Unknown> — achievement cannot be reported until drivers are verified.
              </p>
            ) : (
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{Math.round((m.achievementRate ?? 0) * 100)}%</div>
                  <div className="mt-1 text-[12px] text-muted">
                    {m.verified.length} achieved · {m.notAchieved.length} not achieved
                  </div>
                </div>
                <p className="flex-1 text-[12.5px] text-muted">of {finals} verified outcome(s). {m.active.length - finals} approved driver(s) are not yet verified and are excluded rather than assumed.</p>
              </div>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12.5px]">
              <MiniCount label="Measured" value={m.active.filter((d) => d.measure.current !== null).length} />
              <MiniCount label="Not yet measured" value={m.notYetMeasured.length} muted />
              <MiniCount label="Qualitative, awaiting evidence" value={m.active.filter((d) => d.measure.kind === 'qualitative' && !d.verification).length} muted />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Data completeness" title="How fully drivers are defined" description="Owner, linked principle, outcome, method, baseline, approved target or criteria, date. Not a measure of success." />
          <div className="px-5 py-5">
            <div className="flex items-center gap-4">
              <div className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{Math.round(m.completeness * 100)}%</div>
              <div className="flex-1">
                <Meter value={m.completeness} label="Average definition completeness" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12.5px]">
              <MiniCount label="Target not set" value={m.targetNotSet.length} muted />
              <MiniCount label="Target awaiting approval" value={m.awaitingTargetApproval.length} muted />
              <MiniCount label="Without owner" value={m.withoutOwner.length} muted />
            </div>
          </div>
        </Card>
      </div>

      <StatusDistribution counts={m.statusCounts} total={total} />

      <div className="grid gap-6 xl:grid-cols-3">
        <ListCard title="At-risk drivers" icon={<AlertTriangle className="size-4 text-risk" />} empty="No drivers are at risk." items={m.atRisk} />
        <ListCard title="Measures awaiting target approval" icon={<Target className="size-4 text-warn" />} empty="No targets are awaiting approval." items={m.awaitingTargetApproval} />
        <ListCard title="Drivers without an accountable owner" icon={<UserX className="size-4 text-warn" />} empty="Every driver has an owner." items={m.withoutOwner} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Upcoming validation milestones" />
          <ul className="divide-y divide-line">
            {m.upcomingMilestones.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">None in the next 120 days.</li>}
            {m.upcomingMilestones.map((ms) => (
              <li key={ms.id} className="flex gap-3 px-5 py-3 text-[13px]">
                <CalendarClock className="mt-0.5 size-4 text-muted" />
                <div className="flex-1">
                  <div className="font-medium">{ms.name}</div>
                  <div className="text-[12px] text-muted">{ms.driverIds.map((id) => data.drivers.find((d) => d.id === id)?.code).join(', ') || 'No drivers linked'}</div>
                </div>
                <span className="text-[12px] text-muted tabular-nums">{formatDate(ms.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={`${t.decision}s`} description={filters.decisionStatus ? DECISION_STATUS_LABELS[filters.decisionStatus] : 'Not yet approved'} />
          <ul className="divide-y divide-line">
            {(filters.decisionStatus ? m.decisions : m.decisions.filter((d) => d.status !== 'approved')).map((d) => (
              <li key={d.id}>
                <Link to={`${base}/decisions/${d.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-sunken">
                  <Scale className="mt-0.5 size-4 text-muted" />
                  <span className="flex-1 text-[13px]">
                    <span className="font-mono text-[11px] text-muted">{d.code}</span> {d.question}
                  </span>
                  <DecisionBadge status={d.status} />
                </Link>
              </li>
            ))}
            {m.decisions.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">No decisions match.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Evidence gaps" />
          <ul className="divide-y divide-line text-[13px]">
            <GapRow icon={<FileWarning className="size-4 text-danger" />} label="Requirements not in framework" count={m.gaps.requirementsNotInFramework.length} to={`${base}/understand/questions`} />
            <GapRow icon={<FileWarning className="size-4 text-warn" />} label="Principles without evidence" count={m.gaps.unsupportedPrinciples.length} to={`${base}/interpret/principles`} />
            <GapRow icon={<FileWarning className="size-4 text-warn" />} label="Drivers without evidence" count={m.gaps.driversWithoutEvidence.length} to={`${base}/drivers`} />
            <GapRow icon={<FileWarning className="size-4 text-warn" />} label="Drivers not linked to a principle" count={m.gaps.driversWithoutPrinciple.length} to={`${base}/drivers`} />
            <GapRow icon={<CircleHelp className="size-4 text-info" />} label="Orphaned statements" count={m.gaps.orphanStatements.length} to={`${base}/understand/evidence?filter=orphan`} />
            <GapRow icon={<CircleHelp className="size-4 text-info" />} label="Links awaiting review" count={m.gaps.pendingRelationships.length} to={`${base}/more/evidence-map?tab=matrix`} />
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent changes" description="From the project audit log." />
        <ul className="divide-y divide-line">
          {m.recent.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-2.5 text-[13px]">
              <span className="text-ink-2">{a.summary}</span>
              <span className="ml-auto text-[12px] text-muted">
                {data.people.find((p) => p.id === a.actorId)?.name ?? 'Unknown'} · {formatDate(a.at, true)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function MiniCount({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div>
      <div className={cx('text-[18px] font-semibold tabular-nums', muted && value > 0 ? 'text-warn' : 'text-ink')}>{value}</div>
      <div className="text-muted">{label}</div>
    </div>
  )
}

function GapRow({ icon, label, count, to }: { icon: ReactNode; label: string; count: number; to: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-5 py-2.5 hover:bg-sunken">
        {icon}
        <span className="flex-1 text-ink-2">{label}</span>
        <span className={cx('font-semibold tabular-nums', count === 0 && 'text-muted')}>{count}</span>
      </Link>
    </li>
  )
}

function ListCard({ title, icon, empty, items }: { title: string; icon: ReactNode; empty: string; items: DesignDriver[] }) {
  const { data, personName } = useProject()
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{icon}{title}</span>} />
      <ul className="divide-y divide-line">
        {items.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">{empty}</li>}
        {items.map((d) => (
          <li key={d.id}>
            <Link to={`/projects/${data.project.id}/drivers/${d.id}`} className="block px-5 py-2.5 hover:bg-sunken">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">
                  <span className="font-mono text-[11px] text-muted">{d.code}</span> {d.title}
                </span>
                <DriverStatusBadge status={driverStatus(d)} />
              </div>
              <div className="text-[12px] text-muted">{d.ownerPersonId ? personName(d.ownerPersonId) : 'Unassigned'} · {PHASE_LABELS[d.phase]}</div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function StatusDistribution({ counts, total }: { counts: Record<DriverStatus, number>; total: number }) {
  const present = DRIVER_STATUSES.filter((s) => counts[s] > 0)
  return (
    <Card>
      <CardHeader title="Design Driver status distribution" description={`${total} driver(s) in the current filter`} />
      <div className="px-5 py-5">
        {total === 0 ? (
          <p className="text-[13px] text-muted">No drivers match the filters.</p>
        ) : (
          <>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={present.map((s) => `${DRIVER_STATUS_LABELS[s]}: ${counts[s]}`).join(', ')}>
              {present.map((s) => (
                <div key={s} className={cx('h-full first:rounded-l last:rounded-r', STATUS_FILL[s])} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${DRIVER_STATUS_LABELS[s]}: ${counts[s]}`} />
              ))}
            </div>
            <table className="mt-4 w-full text-[12.5px]">
              <caption className="sr-only">Driver counts by status</caption>
              <tbody className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
                {DRIVER_STATUSES.map((s) => (
                  <tr key={s} className="flex items-center gap-2">
                    <td>
                      <span className={cx('block size-2.5 rounded-sm', STATUS_FILL[s])} aria-hidden />
                    </td>
                    <th scope="row" className="flex-1 text-left font-normal text-ink-2">
                      {DRIVER_STATUS_LABELS[s]}
                    </th>
                    <td className="font-semibold tabular-nums">{counts[s]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Card>
  )
}
