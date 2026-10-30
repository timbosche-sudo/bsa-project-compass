import { driverCompleteness, driverPrincipleIds, driverStatus, measurementState, type MeasurementState } from './drivers'
import { gapReport, type GapReport } from './traceability'
import type { AuditEvent, Decision, DecisionStatus, DesignDriver, DriverStatus, ID, Milestone, Phase, ProjectData } from './types'

export interface DashboardFilters {
  principleId?: ID
  organization?: string
  phase?: Phase
  decisionStatus?: DecisionStatus
  measurementState?: MeasurementState
}

export interface DashboardModel {
  principles: { total: number; approved: number; inReview: number; proposed: number }
  drivers: DesignDriver[]
  statusCounts: Record<DriverStatus, number>
  active: DesignDriver[]
  verified: DesignDriver[]
  notAchieved: DesignDriver[]
  atRisk: DesignDriver[]
  withoutOwner: DesignDriver[]
  awaitingTargetApproval: DesignDriver[]
  notYetMeasured: DesignDriver[]
  targetNotSet: DesignDriver[]
  /** Mean definition completeness of active drivers (0–1) — NOT performance. */
  completeness: number
  /** Verified achieved ÷ drivers with a final verification; null when none are verified yet. */
  achievementRate: number | null
  upcomingMilestones: Milestone[]
  decisions: Decision[]
  decisionsAwaitingApproval: Decision[]
  gaps: GapReport
  recent: AuditEvent[]
  organizations: string[]
}

export function dashboardModel(data: ProjectData, filters: DashboardFilters = {}, today = new Date().toISOString().slice(0, 10)): DashboardModel {
  const drivers = data.drivers.filter((d) => {
    if (filters.principleId && !driverPrincipleIds(data, d.id).includes(filters.principleId)) return false
    if (filters.organization && d.ownerOrganization !== filters.organization) return false
    if (filters.phase && d.phase !== filters.phase) return false
    if (filters.measurementState && measurementState(d) !== filters.measurementState) return false
    return true
  })
  const statusCounts = Object.fromEntries(
    (['proposed', 'under_review', 'approved', 'in_progress', 'at_risk', 'verified', 'not_achieved', 'superseded'] as DriverStatus[]).map((s) => [s, 0]),
  ) as Record<DriverStatus, number>
  drivers.forEach((d) => statusCounts[driverStatus(d)]++)

  const live = drivers.filter((d) => d.approvalStatus !== 'superseded')
  const active = live.filter((d) => d.approvalStatus === 'approved')
  const verified = live.filter((d) => d.performanceStatus === 'verified')
  const notAchieved = live.filter((d) => d.performanceStatus === 'not_achieved')
  const finals = verified.length + notAchieved.length

  const decisions = data.decisions.filter((d) => !filters.decisionStatus || d.status === filters.decisionStatus)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 120)
  const horizonIso = horizon.toISOString().slice(0, 10)

  const principles = data.principles.filter((p) => p.status !== 'superseded')
  return {
    principles: {
      total: principles.length,
      approved: principles.filter((p) => p.status === 'approved').length,
      inReview: principles.filter((p) => p.status === 'in_review').length,
      proposed: principles.filter((p) => p.status === 'proposed').length,
    },
    drivers,
    statusCounts,
    active,
    verified,
    notAchieved,
    atRisk: live.filter((d) => d.performanceStatus === 'at_risk'),
    withoutOwner: live.filter((d) => !d.ownerPersonId),
    awaitingTargetApproval: live.filter((d) => measurementState(d) === 'awaiting_target_approval'),
    notYetMeasured: live.filter((d) => measurementState(d) === 'not_yet_measured'),
    targetNotSet: live.filter((d) => measurementState(d) === 'target_not_set'),
    completeness: live.length ? live.reduce((a, d) => a + driverCompleteness(data, d).ratio, 0) / live.length : 0,
    achievementRate: finals ? verified.length / finals : null,
    upcomingMilestones: data.milestones
      .filter((m) => !m.complete && m.date >= today && m.date <= horizonIso)
      .filter((m) => !filters.phase || m.phase === filters.phase)
      .sort((a, b) => a.date.localeCompare(b.date)),
    decisions,
    decisionsAwaitingApproval: decisions.filter((d) => d.status === 'recommended'),
    gaps: gapReport(data),
    recent: data.audit.slice(0, 12),
    organizations: [...new Set(data.drivers.map((d) => d.ownerOrganization).filter(Boolean))].sort(),
  }
}
