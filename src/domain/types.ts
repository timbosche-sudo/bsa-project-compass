/**
 * BSA Project Compass — core domain model.
 *
 * These types are shared by the browser demo adapter and the server-side
 * command handler, so they must stay free of DOM or framework imports.
 * Project-specific vocabulary lives in `Project.terminology`, never here.
 */

export type ID = string
export type ISODate = string

// ---------------------------------------------------------------------------
// Organizations, people, roles
// ---------------------------------------------------------------------------

export const ROLES = [
  'system_admin',
  'org_admin',
  'project_admin',
  'editor',
  'contributor',
  'reviewer',
  'viewer',
] as const
export type Role = (typeof ROLES)[number]

export interface Person {
  id: ID
  name: string
  title: string
  organization: string
  email: string
}

export interface Membership {
  personId: ID
  role: Role
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const SECTORS = ['healing', 'learning', 'discovery', 'other'] as const
export type Sector = (typeof SECTORS)[number]

export const PHASES = [
  'strategy',
  'programming',
  'schematic_design',
  'design_development',
  'construction_documents',
  'construction',
  'commissioning',
  'occupancy',
] as const
export type Phase = (typeof PHASES)[number]

export interface Terminology {
  winTheme: string
  guidingPrinciple: string
  designDriver: string
  decision: string
}

export interface Project {
  id: ID
  code: string
  name: string
  tagline: string
  sector: Sector
  phase: Phase
  location: string
  description: string
  owner: { name: string; type: string; mission: string }
  terminology: Terminology
  /** Synthetic demonstration data. Exports and UI must label it. */
  isDemo: boolean
  createdAt: ISODate
  members: Membership[]
  aiPolicy: AiPolicy
}

export interface AiPolicy {
  enabled: boolean
  /** Confidentiality classifications permitted to be sent to the approved provider. */
  allowedClassifications: Confidentiality[]
}

// ---------------------------------------------------------------------------
// Source intelligence
// ---------------------------------------------------------------------------

export const SOURCE_TYPES = [
  'workshop_notes',
  'photograph',
  'pdf',
  'presentation',
  'document',
  'owner_rfp',
  'meeting_summary',
  'mission_statement',
  'industry_research',
  'regulation',
  'approved_decision',
  'observation',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const CONFIDENTIALITY = ['public', 'internal', 'confidential', 'restricted'] as const
export type Confidentiality = (typeof CONFIDENTIALITY)[number]

export const EXTRACTION_STATUSES = ['not_started', 'in_progress', 'extracted', 'verified'] as const
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number]

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/heic',
  'text/plain',
] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export interface FileReference {
  name: string
  mimeType: AllowedMimeType
  sizeBytes: number
  /** Path in private storage. Null in demo mode: file contents are never stored. */
  storagePath: string | null
  /** Synthetic illustration bundled with the demo (never real project files). */
  demoAsset?: string
}

export interface Source {
  id: ID
  code: string
  title: string
  type: SourceType
  author: string
  organization: string
  date: ISODate
  confidentiality: Confidentiality
  uploadedBy: ID
  uploadedAt: ISODate
  file: FileReference | null
  version: number
  extractionStatus: ExtractionStatus
  description: string
  /** Possible duplicate capture of the same original (e.g. two photos of one note). */
  possibleDuplicateOf: ID | null
}

export const STATEMENT_KINDS = ['aspiration', 'requirement', 'nonnegotiable', 'observation', 'question'] as const
export type StatementKind = (typeof STATEMENT_KINDS)[number]

export const CONFIDENCE = ['high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCE)[number]

export const TRANSCRIPTION_STATUSES = ['not_applicable', 'unverified', 'uncertain', 'verified'] as const
export type TranscriptionStatus = (typeof TRANSCRIPTION_STATUSES)[number]

export const CRITICALITY = ['normal', 'high', 'critical'] as const
export type Criticality = (typeof CRITICALITY)[number]

export interface Locator {
  kind: 'page' | 'slide' | 'photo' | 'section' | 'none'
  value: string
  /** Optional normalized position within the page/photo (0–1). */
  region?: { x: number; y: number; w: number; h: number }
}

export interface TranscriptionRevision {
  text: string
  by: ID
  at: ISODate
  note: string
}

export interface Statement {
  id: ID
  code: string
  sourceId: ID
  /** Verbatim wording. Changed only through an attributed transcription correction. */
  originalText: string
  locator: Locator
  speaker: string
  kind: StatementKind
  criticality: Criticality
  confidence: Confidence
  transcriptionStatus: TranscriptionStatus
  uncertainWords: string[]
  reviewedBy: ID | null
  reviewedAt: ISODate | null
  /** Interpretation is kept separate from the original wording. */
  interpretation: string
  interpretationOrigin: 'human' | 'ai' | null
  revisions: TranscriptionRevision[]
  createdBy: ID
  createdAt: ISODate
}

// ---------------------------------------------------------------------------
// Evidence relationships (many-to-many traceability graph)
// ---------------------------------------------------------------------------

export const NODE_TYPES = ['source', 'statement', 'theme', 'winTheme', 'principle', 'driver', 'decision', 'opportunity', 'outcome'] as const
export type NodeType = (typeof NODE_TYPES)[number]

export interface NodeRef {
  type: NodeType
  id: ID
}

export const RELATIONSHIP_TYPES = ['supports', 'informs', 'implements', 'addresses', 'conflicts_with', 'measures'] as const
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export const REVIEW_STATUSES = ['proposed', 'accepted', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export type Origin = 'human' | 'ai' | 'rules'

export interface Relationship {
  id: ID
  from: NodeRef
  to: NodeRef
  type: RelationshipType
  explanation: string
  confidence: Confidence
  origin: Origin
  proposedBy: ID
  reviewedBy: ID | null
  status: ReviewStatus
  createdAt: ISODate
  updatedAt: ISODate
}

// ---------------------------------------------------------------------------
// Alignment: themes and open questions
// ---------------------------------------------------------------------------

export const THEME_STATUSES = ['emerging', 'candidate', 'promoted', 'archived'] as const
export type ThemeStatus = (typeof THEME_STATUSES)[number]

export interface Theme {
  id: ID
  code: string
  title: string
  summary: string
  status: ThemeStatus
  /** Explicit, human-set importance. Frequency of mention never sets this. */
  criticality: Criticality
  conflictNote: string
  promotedToPrincipleId: ID | null
  createdBy: ID
  createdAt: ISODate
}

export interface OpenQuestion {
  id: ID
  code: string
  question: string
  context: NodeRef[]
  status: 'open' | 'answered' | 'withdrawn'
  answer: string
  raisedBy: ID
  raisedAt: ISODate
}

// ---------------------------------------------------------------------------
// Vision: Win Themes and Guiding Principles (versioned, approvable)
// ---------------------------------------------------------------------------

/**
 * Review statuses for Win Themes and Guiding Principles.
 * 'in_review' is presented as "Discussing" (active review, e.g. in an Owner workshop).
 */
export const APPROVAL_STATUSES = ['proposed', 'in_review', 'needs_refinement', 'approved', 'not_adopted', 'superseded'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export interface VersionEntry<T, S extends string = ApprovalStatus> {
  version: number
  snapshot: T
  status: S
  changedBy: ID
  changedAt: ISODate
  note: string
}

export interface Comment {
  id: ID
  target: NodeRef
  authorId: ID
  body: string
  createdAt: ISODate
  resolved: boolean
}

export interface ApprovalRecord {
  /** The person who approved (e.g. the Owner representative). */
  approvedBy: ID
  approvedAt: ISODate
  version: number
  note: string
  /** Who entered the approval, when recorded on the approver's behalf in a workshop. */
  recordedBy?: ID
  /** Exact approved wording, frozen at approval time. */
  wording?: string
  /** Workshop session in which the approval was given. */
  sessionId?: ID | null
}

export interface WinThemeContent {
  statement: string
  narrative: string
}

export interface WinTheme extends WinThemeContent {
  id: ID
  code: string
  status: ApprovalStatus
  version: number
  versions: VersionEntry<WinThemeContent>[]
  approval: ApprovalRecord | null
  createdBy: ID
}

export const PRINCIPLE_CATEGORIES = ['facility_outcomes', 'delivery_excellence', 'institutional_impact', 'cross_cutting'] as const
export type PrincipleCategory = (typeof PRINCIPLE_CATEGORIES)[number]

export interface PrincipleContent {
  title: string
  statement: string
  intent: string
  category: PrincipleCategory
}

export interface GuidingPrinciple extends PrincipleContent {
  id: ID
  code: string
  order: number
  status: ApprovalStatus
  version: number
  versions: VersionEntry<PrincipleContent>[]
  approval: ApprovalRecord | null
  accountableApproverId: ID | null
  /** Why it matters: the Owner aspirations and project ambitions behind the principle. Supporting rationale, not adopted wording. */
  whyItMatters?: string
  /** Emerging design implications: considerations for the team, never prescriptive instructions. */
  designImplications?: string
  createdBy: ID
}

// ---------------------------------------------------------------------------
// Design Drivers
// ---------------------------------------------------------------------------

export const DRIVER_APPROVAL = ['proposed', 'under_review', 'approved', 'superseded'] as const
export type DriverApproval = (typeof DRIVER_APPROVAL)[number]

export const DRIVER_PERFORMANCE = ['not_started', 'in_progress', 'at_risk', 'verified', 'not_achieved'] as const
export type DriverPerformance = (typeof DRIVER_PERFORMANCE)[number]

/** Combined workflow status presented to users. */
export const DRIVER_STATUSES = [
  'proposed',
  'under_review',
  'approved',
  'in_progress',
  'at_risk',
  'verified',
  'not_achieved',
  'superseded',
] as const
export type DriverStatus = (typeof DRIVER_STATUSES)[number]

export const REQUIREMENT_CLASSES = ['owner_mandatory', 'owner_preference', 'regulatory', 'team_proposed'] as const
export type RequirementClass = (typeof REQUIREMENT_CLASSES)[number]

export const TARGET_STATUSES = ['not_set', 'proposed', 'approved'] as const
export type TargetStatus = (typeof TARGET_STATUSES)[number]

export interface DriverMeasure {
  kind: 'quantitative' | 'qualitative'
  unit: string
  methodology: string
  /** Null means unknown — never substitute a guessed number. */
  baseline: string | null
  target: string | null
  targetStatus: TargetStatus
  /** Qualitative acceptance criteria (Conditions of Satisfaction). */
  acceptanceCriteria: string
  current: string | null
  currentAsOf: ISODate | null
}

export interface Verification {
  evidence: string
  reviewerId: ID
  verifiedAt: ISODate
  outcome: 'achieved' | 'not_achieved'
}

export interface DriverContent {
  title: string
  description: string
  intendedOutcome: string
  scope: 'facility' | 'delivery'
  requirementClass: RequirementClass
  /** Owner's original terminology, preserved verbatim where applicable. */
  ownerTerm: string
  measure: DriverMeasure
  ownerPersonId: ID | null
  ownerOrganization: string
  phase: Phase
  targetDate: ISODate | null
  validationMethod: string
  risks: string[]
  dependencyIds: ID[]
}

export interface DesignDriver extends DriverContent {
  id: ID
  code: string
  approvalStatus: DriverApproval
  performanceStatus: DriverPerformance
  verification: Verification | null
  version: number
  versions: VersionEntry<DriverContent, DriverApproval>[]
  approval: ApprovalRecord | null
  createdBy: ID
}

// ---------------------------------------------------------------------------
// Decision Lab (Choosing by Advantages)
// ---------------------------------------------------------------------------

export const DECISION_STATUSES = ['framing', 'evaluating', 'recommended', 'approved', 'deferred'] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export interface Alternative {
  id: ID
  name: string
  description: string
  /** Monetary cost is held apart from advantage importance. Null = unknown. */
  cost: number | null
  costBasis: string
  scheduleImpact: string
  risks: string
}

export type MustResult = 'pass' | 'fail' | 'unknown'

export interface MandatoryRequirement {
  id: ID
  text: string
  results: Record<ID, MustResult>
}

export interface Advantage {
  /** Factual description of the advantage relative to the least-preferred attribute. */
  description: string
  /** Importance on the decision's scale (0–100); null until the team judges it. */
  importance: number | null
}

export interface Factor {
  id: ID
  name: string
  /** "Criterion": what is preferred, e.g. "Shorter walking distance is better". */
  criterion: string
  driverId: ID | null
  attributes: Record<ID, string>
  leastPreferredAltId: ID | null
  advantages: Record<ID, Advantage>
  importanceRationale: string
}

export interface DecisionEvent {
  at: ISODate
  by: ID
  action: string
  note: string
}

export interface Decision {
  id: ID
  code: string
  question: string
  context: string
  status: DecisionStatus
  phase: Phase
  dueDate: ISODate | null
  alternatives: Alternative[]
  mandatoryRequirements: MandatoryRequirement[]
  factors: Factor[]
  /** Factor whose advantage was judged paramount (anchors the importance scale at 100). */
  paramountFactorId: ID | null
  recommendation: { alternativeId: ID; rationale: string; by: ID; at: ISODate } | null
  approval: { alternativeId: ID; by: ID; at: ISODate; note: string } | null
  /** Informal discussion scores — never presented as Choosing by Advantages. */
  informalScores: Record<ID, Record<ID, number>>
  history: DecisionEvent[]
  createdBy: ID
}

// ---------------------------------------------------------------------------
// Milestones, suggestions, audit
// ---------------------------------------------------------------------------

export interface Milestone {
  id: ID
  name: string
  date: ISODate
  phase: Phase
  driverIds: ID[]
  complete: boolean
}

export const SUGGESTION_KINDS = [
  'relationship',
  'theme',
  'question',
  'principle_wording',
  'driver_measure',
  'missing_requirement',
  // Thinking-partner observations: questions for the team, never conclusions.
  'tension',
  'missing_perspective',
  'solution_vs_need',
  'principle_quality',
] as const
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number]

export interface Suggestion {
  id: ID
  kind: SuggestionKind
  title: string
  body: string
  /** Statement or source references backing the suggestion. Empty = labeled as inference. */
  evidence: NodeRef[]
  target: NodeRef | null
  /** Structured payload the user may accept (e.g. a proposed relationship). */
  payload: Record<string, unknown>
  origin: Exclude<Origin, 'human'>
  provider: string
  status: 'pending' | 'accepted' | 'dismissed'
  createdAt: ISODate
  reviewedBy: ID | null
}

export interface AuditEvent {
  id: ID
  at: ISODate
  actorId: ID
  action: string
  target: NodeRef | null
  summary: string
}

// ---------------------------------------------------------------------------
// Owner alignment workshops
// ---------------------------------------------------------------------------

export interface WorkshopAttendee {
  name: string
  organization: string
  role: string
}

export interface WorkshopAction {
  id: ID
  text: string
  owner: string
  due: ISODate | null
  done: boolean
}

export interface WorkshopLogEntry {
  at: ISODate
  actorId: ID
  action: string
  target: NodeRef | null
  summary: string
}

export interface WorkshopSession {
  id: ID
  code: string
  title: string
  date: ISODate
  status: 'planned' | 'live' | 'closed'
  facilitatorId: ID
  attendees: WorkshopAttendee[]
  /** Facilitator notes keyed by item ("principle:<id>", "winTheme:<id>"); never shown to the audience. */
  notes: Record<string, string>
  generalNotes: string
  actions: WorkshopAction[]
  /** Framework changes made while the session was live (recorded automatically). */
  log: WorkshopLogEntry[]
  startedAt: ISODate | null
  endedAt: ISODate | null
  createdBy: ID
}

export interface TrashItem {
  id: ID
  kind: 'winTheme' | 'principle'
  entity: WinTheme | GuidingPrinciple
  relationships: Relationship[]
  comments: Comment[]
  deletedBy: ID
  deletedAt: ISODate
}

// ---------------------------------------------------------------------------
// Compass 2.0 — Understand / Interpret
// ---------------------------------------------------------------------------

export const HEARD_SECTIONS = ['aspiration', 'theme', 'tension', 'perspective', 'priority'] as const
export type HeardSection = (typeof HEARD_SECTIONS)[number]

/** A curated, Owner-ready finding in "What We Heard". Interpretation, always linked to evidence where possible. */
export interface HeardItem {
  id: ID
  section: HeardSection
  title: string
  narrative: string
  evidence: NodeRef[]
  order: number
  inPresentation: boolean
  origin: Origin
  /** Draft until a person on the team has reviewed it. */
  reviewed: boolean
  updatedBy: ID
  updatedAt: ISODate
}

export interface PovAlternative {
  id: ID
  title: string
  summary: string
  recommended: boolean
}

export interface PointOfViewContent {
  centralAmbition: string
  opportunity: string
  connectingIdea: string
  tensions: string
  distinctiveness: string
  keepInMind: string
  alternatives: PovAlternative[]
}

/** BSA's strategic interpretation: what we believe. */
export interface PointOfView extends PointOfViewContent {
  updatedBy: ID
  updatedAt: ISODate
  history: { at: ISODate; by: ID; snapshot: PointOfViewContent }[]
}

export const OPPORTUNITY_STATES = ['emerging', 'proposed', 'validated'] as const
export type OpportunityState = (typeof OPPORTUNITY_STATES)[number]

/** A way a principle might influence design thinking. Never a plan, configuration or technical solution. */
export interface DesignOpportunity {
  id: ID
  code: string
  title: string
  description: string
  principleIds: ID[]
  state: OpportunityState
  inPresentation: boolean
  /** Optional link to formal Design Drivers in the advanced register. */
  linkedDriverIds: ID[]
  origin: Origin
  order: number
  createdBy: ID
  createdAt: ISODate
}

export const OUTCOME_CATEGORIES = ['qualitative', 'quantitative', 'experiential', 'operational', 'environmental', 'post_occupancy'] as const
export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number]

export const OUTCOME_STATES = ['emerging', 'proposed_by_bsa', 'validated_with_owner', 'define_later'] as const
export type OutcomeState = (typeof OUTCOME_STATES)[number]

export const PROGRESS_KINDS = ['design_narrative', 'design_study', 'performance_analysis', 'owner_feedback', 'other'] as const
export type ProgressKind = (typeof PROGRESS_KINDS)[number]

export interface ProgressEvidence {
  id: ID
  date: ISODate
  kind: ProgressKind
  note: string
  addedBy: ID
}

/** What success could look like. Targets and baselines are deliberately not required. */
export interface PotentialOutcome {
  id: ID
  code: string
  statement: string
  principleId: ID
  opportunityId: ID | null
  category: OutcomeCategory
  state: OutcomeState
  /** True when no reliable measurement method exists yet. */
  aspiration: boolean
  /** Possible measures, in words. Optional. */
  possibleMeasures: string
  evidenceOfProgress: ProgressEvidence[]
  inPresentation: boolean
  order: number
  createdBy: ID
  createdAt: ISODate
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compass 2.0 — Align
// ---------------------------------------------------------------------------

/** Not reviewed is the default: silence is never treated as alignment. */
export const ALIGNMENT_STATUSES = ['not_reviewed', 'aligned', 'aligned_with_refinements', 'needs_discussion'] as const
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number]
export const ALIGNMENT_TARGET_TYPES = ['winTheme', 'principle'] as const
export type AlignmentTargetType = (typeof ALIGNMENT_TARGET_TYPES)[number]

export interface AlignmentResponseContent {
  status: AlignmentStatus
  feedback: string
  refinements: string
  questions: string
  ownerComments: string
}

/** A facilitator's record of how the Owner responded to one item in one session. Alignment is not formal approval. */
export interface AlignmentResponse extends AlignmentResponseContent {
  id: ID
  sessionId: ID | null
  target: { type: AlignmentTargetType; id: ID }
  recordedBy: ID
  at: ISODate
}

export const DIRECTION_STATES = ['bsa_proposed', 'owner_reviewed', 'aligned', 'revision'] as const
export type DirectionState = (typeof DIRECTION_STATES)[number]

export interface DirectionContent {
  pointOfView: PointOfViewContent | null
  vision: { id: ID; code: string; statement: string; narrative: string; status: ApprovalStatus }[]
  principles: { id: ID; code: string; title: string; statement: string; intent: string; category: PrincipleCategory; whyItMatters: string; designImplications: string; status: ApprovalStatus; version: number }[]
  opportunities: { id: ID; code: string; title: string; description: string; principleIds: ID[]; state: OpportunityState }[]
  outcomes: { id: ID; code: string; statement: string; principleId: ID; category: OutcomeCategory; state: OutcomeState }[]
  /** Latest recorded Owner response per item at the time of the snapshot. */
  alignment: { type: AlignmentTargetType; id: ID; code: string; status: AlignmentStatus; refinements: string }[]
}

/** An immutable record of the direction at a point in time. Never edited or deleted, so an aligned version stays recoverable. */
export interface DirectionSnapshot {
  id: ID
  code: string
  label: string
  state: DirectionState
  note: string
  sessionId: ID | null
  at: ISODate
  by: ID
  content: DirectionContent
}

export interface ProjectData {
  project: Project
  people: Person[]
  sources: Source[]
  statements: Statement[]
  relationships: Relationship[]
  themes: Theme[]
  questions: OpenQuestion[]
  winThemes: WinTheme[]
  principles: GuidingPrinciple[]
  drivers: DesignDriver[]
  decisions: Decision[]
  milestones: Milestone[]
  comments: Comment[]
  suggestions: Suggestion[]
  audit: AuditEvent[]
  workshops: WorkshopSession[]
  /** Understand: the curated "What We Heard" synthesis. */
  heard: HeardItem[]
  /** Interpret: BSA's strategic point of view (one per project). */
  pointOfView: PointOfView | null
  /** Interpret: emerging design opportunities (non-prescriptive). */
  opportunities: DesignOpportunity[]
  /** Interpret: what success could look like (no targets required). */
  outcomes: PotentialOutcome[]
  /** Align: Owner responses to the vision and principles, captured per session. */
  alignment: AlignmentResponse[]
  /** Align: immutable snapshots of the direction (proposed, Owner-reviewed, aligned, revisions). */
  directions: DirectionSnapshot[]
  /** Recoverable deletions (supports undo and accidental-deletion recovery). */
  trash: TrashItem[]
  /** Monotonic revision for optimistic concurrency. */
  revision: number
}

export interface ProjectSummary {
  id: ID
  code: string
  name: string
  sector: Sector
  phase: Phase
  isDemo: boolean
  ownerName: string
}
