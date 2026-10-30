import type { DesignDriver, DriverStatus, ID, ProjectData } from './types'

export function driverStatus(d: Pick<DesignDriver, 'approvalStatus' | 'performanceStatus'>): DriverStatus {
  if (d.approvalStatus === 'superseded') return 'superseded'
  if (d.approvalStatus === 'proposed') return 'proposed'
  if (d.approvalStatus === 'under_review') return 'under_review'
  switch (d.performanceStatus) {
    case 'not_started':
      return 'approved'
    default:
      return d.performanceStatus
  }
}

export function driverPrincipleIds(data: ProjectData, driverId: ID): ID[] {
  return data.relationships
    .filter((r) => r.status === 'accepted' && r.type === 'implements' && r.from.type === 'driver' && r.from.id === driverId && r.to.type === 'principle')
    .map((r) => r.to.id)
}

export function principleDriverIds(data: ProjectData, principleId: ID): ID[] {
  return data.relationships
    .filter((r) => r.status === 'accepted' && r.type === 'implements' && r.from.type === 'driver' && r.to.type === 'principle' && r.to.id === principleId)
    .map((r) => r.from.id)
}

export function decisionDriverIds(data: ProjectData, decisionId: ID): ID[] {
  return data.relationships
    .filter((r) => r.status === 'accepted' && r.type === 'addresses' && r.from.type === 'decision' && r.from.id === decisionId && r.to.type === 'driver')
    .map((r) => r.to.id)
}

export function driverDecisionIds(data: ProjectData, driverId: ID): ID[] {
  return data.relationships
    .filter((r) => r.status === 'accepted' && r.type === 'addresses' && r.from.type === 'decision' && r.to.type === 'driver' && r.to.id === driverId)
    .map((r) => r.from.id)
}

export interface Completeness {
  ratio: number
  present: string[]
  missing: string[]
}

/**
 * Data completeness describes how well-defined a driver is. It is reported
 * separately from performance and never implies the outcome was achieved.
 */
export function driverCompleteness(data: ProjectData, d: DesignDriver): Completeness {
  const checks: [string, boolean][] = [
    ['Linked guiding principle', driverPrincipleIds(data, d.id).length > 0],
    ['Accountable owner', !!d.ownerPersonId],
    ['Intended outcome', !!d.intendedOutcome.trim()],
    ['Validation method', !!d.validationMethod.trim()],
    ['Target date or phase', !!d.targetDate],
  ]
  if (d.measure.kind === 'quantitative') {
    checks.push(
      ['Measurement methodology', !!d.measure.methodology.trim()],
      ['Baseline', d.measure.baseline !== null && d.measure.baseline !== ''],
      ['Approved target', d.measure.target !== null && d.measure.targetStatus === 'approved'],
    )
  } else {
    checks.push(['Acceptance criteria', !!d.measure.acceptanceCriteria.trim()])
  }
  const present = checks.filter(([, ok]) => ok).map(([l]) => l)
  const missing = checks.filter(([, ok]) => !ok).map(([l]) => l)
  return { ratio: present.length / checks.length, present, missing }
}

export type MeasurementState = 'not_applicable' | 'target_not_set' | 'awaiting_target_approval' | 'not_yet_measured' | 'measured'

export function measurementState(d: DesignDriver): MeasurementState {
  if (d.measure.kind === 'qualitative') return d.measure.current ? 'measured' : 'not_applicable'
  if (d.measure.target === null || d.measure.targetStatus === 'not_set') return 'target_not_set'
  if (d.measure.targetStatus === 'proposed') return 'awaiting_target_approval'
  return d.measure.current === null ? 'not_yet_measured' : 'measured'
}

export const MEASUREMENT_STATE_LABELS: Record<MeasurementState, string> = {
  not_applicable: 'Qualitative — awaiting evidence',
  target_not_set: 'Target not set',
  awaiting_target_approval: 'Target awaiting approval',
  not_yet_measured: 'Not yet measured',
  measured: 'Measured',
}

/** Commitment fields that are locked once a driver is approved. */
export function lockedDriverFingerprint(d: Pick<DesignDriver, 'title' | 'description' | 'intendedOutcome' | 'scope' | 'requirementClass' | 'ownerTerm' | 'measure'>): string {
  const m = d.measure
  return JSON.stringify([d.title, d.description, d.intendedOutcome, d.scope, d.requirementClass, d.ownerTerm, m.kind, m.unit, m.methodology, m.baseline, m.target, m.acceptanceCriteria])
}
