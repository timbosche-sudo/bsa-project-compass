import type { NodeRef, ProjectData, Statement } from '@/domain/types'

/**
 * Evidence qualification. Distinguishes what kind of evidence a statement is,
 * so the Thinking Partner never treats how often something is said as how much
 * it matters. No numeric importance scores are produced.
 */
export type EvidenceClass = 'owner_requirement' | 'owner_direction' | 'stakeholder_aspiration' | 'observation' | 'external_research'

export const EVIDENCE_CLASS_LABELS: Record<EvidenceClass, string> = {
  owner_requirement: 'Owner requirement',
  owner_direction: 'Owner direction (mission or strategy)',
  stakeholder_aspiration: 'Stakeholder aspiration',
  observation: 'Observation',
  external_research: 'External research',
}

export function classify(data: ProjectData, s: Statement): EvidenceClass {
  const src = data.sources.find((x) => x.id === s.sourceId)
  if (s.kind === 'requirement' || s.kind === 'nonnegotiable' || src?.type === 'owner_rfp' || src?.type === 'regulation' || src?.type === 'approved_decision') return 'owner_requirement'
  if (src?.type === 'mission_statement') return 'owner_direction'
  if (src?.type === 'industry_research') return 'external_research'
  if (s.kind === 'observation' || src?.type === 'observation') return 'observation'
  return 'stakeholder_aspiration'
}

/** Important regardless of frequency: Owner requirements, non-negotiables, and anything marked critical. */
export function isWeighty(data: ProjectData, s: Statement): boolean {
  return s.kind === 'nonnegotiable' || s.criticality === 'critical' || classify(data, s) === 'owner_requirement'
}

export const statementRefs = (ids: string[]): NodeRef[] => ids.map((id) => ({ type: 'statement' as const, id }))

/** A short, verbatim citation for supporting context: ST-009 “…” (speaker). Never paraphrased. */
export function cite(s: Statement, max = 110): string {
  const text = s.originalText.length > max ? `${s.originalText.slice(0, max - 1)}…` : s.originalText
  return `${s.code} “${text}”${s.speaker ? ` (${s.speaker})` : ''}`
}
