import type {
  ApprovalStatus,
  Confidence,
  Confidentiality,
  Criticality,
  DecisionStatus,
  DriverStatus,
  ExtractionStatus,
  NodeType,
  Phase,
  PrincipleCategory,
  RelationshipType,
  RequirementClass,
  Sector,
  SourceType,
  StatementKind,
  TargetStatus,
  ThemeStatus,
  TranscriptionStatus,
} from './types'

export const SECTOR_LABELS: Record<Sector, string> = {
  healing: 'Healing',
  learning: 'Learning',
  discovery: 'Discovery',
  other: 'Other',
}

export const PHASE_LABELS: Record<Phase, string> = {
  strategy: 'Strategy',
  programming: 'Programming',
  schematic_design: 'Schematic Design',
  design_development: 'Design Development',
  construction_documents: 'Construction Documents',
  construction: 'Construction',
  commissioning: 'Commissioning',
  occupancy: 'Occupancy',
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  workshop_notes: 'Stakeholder workshop notes',
  photograph: 'Photograph',
  pdf: 'PDF',
  presentation: 'Presentation',
  document: 'Document (DOCX)',
  owner_rfp: 'Owner RFP',
  meeting_summary: 'Meeting summary',
  mission_statement: 'Institutional mission / strategy',
  industry_research: 'Industry research',
  regulation: 'Regulation or standard',
  approved_decision: 'Approved project decision',
  observation: 'Manual observation',
}

export const CONFIDENTIALITY_LABELS: Record<Confidentiality, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
}

export const EXTRACTION_LABELS: Record<ExtractionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  extracted: 'Extracted',
  verified: 'Verified',
}

export const STATEMENT_KIND_LABELS: Record<StatementKind, string> = {
  aspiration: 'Aspiration',
  requirement: 'Requirement',
  nonnegotiable: 'Non-negotiable',
  observation: 'Observation',
  question: 'Question',
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export const CRITICALITY_LABELS: Record<Criticality, string> = { normal: 'Normal', high: 'High', critical: 'Critical' }

export const TRANSCRIPTION_LABELS: Record<TranscriptionStatus, string> = {
  not_applicable: 'Typed source',
  unverified: 'Unverified',
  uncertain: 'Uncertain words',
  verified: 'Verified',
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  proposed: 'Proposed',
  in_review: 'In Review',
  approved: 'Approved',
  superseded: 'Superseded',
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  proposed: 'Proposed',
  under_review: 'Under Review',
  approved: 'Approved',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  verified: 'Verified',
  not_achieved: 'Not Achieved',
  superseded: 'Superseded',
}

export const REQUIREMENT_CLASS_LABELS: Record<RequirementClass, string> = {
  owner_mandatory: 'Owner mandatory',
  owner_preference: 'Owner preference',
  regulatory: 'Regulatory',
  team_proposed: 'Team proposed',
}

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  not_set: 'Not set',
  proposed: 'Awaiting approval',
  approved: 'Approved',
}

export const CATEGORY_LABELS: Record<PrincipleCategory, string> = {
  facility_outcomes: 'Facility Outcomes',
  delivery_excellence: 'Delivery Excellence',
  institutional_impact: 'Institutional Impact',
  cross_cutting: 'Cross-Cutting',
}

export const THEME_STATUS_LABELS: Record<ThemeStatus, string> = {
  emerging: 'Emerging',
  candidate: 'Candidate',
  promoted: 'Promoted to principle',
  archived: 'Archived',
}

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  framing: 'Framing',
  evaluating: 'Evaluating',
  recommended: 'Recommended',
  approved: 'Approved',
  deferred: 'Deferred',
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  supports: 'supports',
  informs: 'informs',
  implements: 'implements',
  addresses: 'addresses',
  conflicts_with: 'conflicts with',
  measures: 'measures',
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  source: 'Source',
  statement: 'Statement',
  theme: 'Theme',
  winTheme: 'Win Theme',
  principle: 'Guiding Principle',
  driver: 'Design Driver',
  decision: 'Decision',
}

export function labelOf<T extends string>(map: Record<T, string>, key: T | null | undefined, fallback = '—'): string {
  return key ? (map[key] ?? key) : fallback
}
