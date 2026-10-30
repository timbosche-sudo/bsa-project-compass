import { z } from 'zod'
import {
  HEARD_SECTIONS,
  OPPORTUNITY_STATES,
  OUTCOME_CATEGORIES,
  OUTCOME_STATES,
  PROGRESS_KINDS,
  ALLOWED_MIME_TYPES,
  type AllowedMimeType,
  CONFIDENCE,
  CONFIDENTIALITY,
  CRITICALITY,
  DECISION_STATUSES,
  EXTRACTION_STATUSES,
  NODE_TYPES,
  PHASES,
  PRINCIPLE_CATEGORIES,
  RELATIONSHIP_TYPES,
  REQUIREMENT_CLASSES,
  ROLES,
  SECTORS,
  SOURCE_TYPES,
  STATEMENT_KINDS,
  SUGGESTION_KINDS,
  TRANSCRIPTION_STATUSES,
} from './types'

/**
 * Typed API contract. Every write — in demo mode or against the secure
 * backend — is a Command validated by these schemas before it is applied.
 * Length limits protect storage and rendering from oversized input.
 */

const id = z.string().min(1).max(64)
const shortText = z.string().trim().max(200)
const requiredShort = shortText.min(1, 'Required')
const longText = z.string().max(8000)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Use YYYY-MM-DD')

export const nodeRefSchema = z.object({ type: z.enum(NODE_TYPES), id })

export const locatorSchema = z.object({
  kind: z.enum(['page', 'slide', 'photo', 'section', 'none']),
  value: z.string().max(80),
  region: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) })
    .optional(),
})

/** Accepted upload types. Content is untrusted and never executed or rendered as HTML. */
export const MIME_LABELS: Record<AllowedMimeType, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/heic': 'HEIC image',
  'text/plain': 'Text',
}
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const fileReferenceSchema = z.object({
  name: z.string().trim().min(1).max(255).refine((n) => !/[\\/]|\.\./.test(n), 'Invalid file name'),
  mimeType: z.enum(ALLOWED_MIME_TYPES, { error: 'Unsupported file type' }),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'File exceeds 50 MB'),
  storagePath: z.string().max(512).nullable(),
  demoAsset: z.string().max(200).optional(),
})

export const sourceInputSchema = z.object({
  title: requiredShort,
  type: z.enum(SOURCE_TYPES),
  author: shortText,
  organization: shortText,
  date: isoDate,
  confidentiality: z.enum(CONFIDENTIALITY),
  description: longText,
  file: fileReferenceSchema.nullable(),
  possibleDuplicateOf: id.nullable(),
})

export const statementInputSchema = z.object({
  sourceId: id,
  originalText: z.string().trim().min(1, 'Original text is required').max(4000),
  locator: locatorSchema,
  speaker: shortText,
  kind: z.enum(STATEMENT_KINDS),
  criticality: z.enum(CRITICALITY),
  confidence: z.enum(CONFIDENCE),
  transcriptionStatus: z.enum(TRANSCRIPTION_STATUSES),
  uncertainWords: z.array(z.string().max(60)).max(50),
  interpretation: longText,
})

export const statementMetaSchema = statementInputSchema
  .pick({ locator: true, speaker: true, kind: true, criticality: true, confidence: true, interpretation: true })
  .partial()

export const principleContentSchema = z.object({
  title: requiredShort,
  statement: z.string().trim().min(1, 'Required').max(600),
  intent: longText,
  category: z.enum(PRINCIPLE_CATEGORIES),
})

export const winThemeContentSchema = z.object({
  statement: z.string().trim().min(1, 'Required').max(200),
  narrative: longText,
})

export const measureSchema = z.object({
  kind: z.enum(['quantitative', 'qualitative']),
  unit: shortText,
  methodology: longText,
  baseline: z.string().max(200).nullable(),
  target: z.string().max(200).nullable(),
  targetStatus: z.enum(['not_set', 'proposed', 'approved']),
  acceptanceCriteria: longText,
  current: z.string().max(200).nullable(),
  currentAsOf: isoDate.nullable(),
})

export const driverContentSchema = z.object({
  title: requiredShort,
  description: longText,
  intendedOutcome: longText,
  scope: z.enum(['facility', 'delivery']),
  requirementClass: z.enum(REQUIREMENT_CLASSES),
  ownerTerm: shortText,
  measure: measureSchema,
  ownerPersonId: id.nullable(),
  ownerOrganization: shortText,
  phase: z.enum(PHASES),
  targetDate: isoDate.nullable(),
  validationMethod: longText,
  risks: z.array(z.string().max(500)).max(30),
  dependencyIds: z.array(id).max(50),
})

export const alternativeSchema = z.object({
  id,
  name: requiredShort,
  description: longText,
  cost: z.number().finite().nonnegative().nullable(),
  costBasis: z.string().max(500),
  scheduleImpact: z.string().max(1000),
  risks: z.string().max(2000),
})

export const factorSchema = z.object({
  id,
  name: requiredShort,
  criterion: z.string().max(500),
  driverId: id.nullable(),
  attributes: z.record(z.string(), z.string().max(1000)),
  leastPreferredAltId: id.nullable(),
  advantages: z.record(
    z.string(),
    z.object({ description: z.string().max(1000), importance: z.number().min(0).max(100).nullable() }),
  ),
  importanceRationale: z.string().max(2000),
})

export const mandatoryRequirementSchema = z.object({
  id,
  text: requiredShort,
  results: z.record(z.string(), z.enum(['pass', 'fail', 'unknown'])),
})

export const personInputSchema = z.object({
  name: requiredShort,
  title: shortText,
  organization: shortText,
  email: z.email().max(200).or(z.literal('')),
})

export const projectInputSchema = z.object({
  name: requiredShort,
  code: z.string().trim().min(1).max(24).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and dashes only'),
  tagline: shortText,
  sector: z.enum(SECTORS),
  phase: z.enum(PHASES),
  location: shortText,
  description: longText,
  owner: z.object({ name: requiredShort, type: shortText, mission: longText }),
})

export const terminologySchema = z.object({
  winTheme: requiredShort,
  guidingPrinciple: requiredShort,
  designDriver: requiredShort,
  decision: requiredShort,
})

const heardInputSchema = z.object({
  section: z.enum(HEARD_SECTIONS),
  title: requiredShort,
  narrative: longText,
  evidence: z.array(nodeRefSchema).max(60),
  inPresentation: z.boolean(),
})

export const povContentSchema = z.object({
  centralAmbition: longText,
  opportunity: longText,
  connectingIdea: longText,
  tensions: longText,
  distinctiveness: longText,
  keepInMind: longText,
  alternatives: z.array(z.object({ id, title: requiredShort, summary: longText, recommended: z.boolean() })).max(8),
})

export const opportunityInputSchema = z.object({
  title: requiredShort,
  description: longText,
  principleIds: z.array(id).max(20),
  state: z.enum(OPPORTUNITY_STATES),
  inPresentation: z.boolean(),
  linkedDriverIds: z.array(id).max(30),
})

export const outcomeInputSchema = z.object({
  statement: z.string().trim().min(1, 'Required').max(600),
  principleId: id,
  opportunityId: id.nullable(),
  category: z.enum(OUTCOME_CATEGORIES),
  state: z.enum(OUTCOME_STATES),
  aspiration: z.boolean(),
  possibleMeasures: longText,
  inPresentation: z.boolean(),
})

const attendeeSchema = z.object({ name: requiredShort, organization: shortText, role: shortText })

const suggestionInputSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS),
  title: z.string().max(300),
  body: z.string().max(4000),
  evidence: z.array(nodeRefSchema).max(40),
  target: nodeRefSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  origin: z.enum(['ai', 'rules']),
  provider: z.string().max(100),
})

const cmd = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ type: z.literal(type), ...shape })

export const commandSchema = z.discriminatedUnion('type', [
  // Project
  cmd('project.update', {
    patch: projectInputSchema.omit({ code: true }).partial().extend({ terminology: terminologySchema.optional() }),
  }),
  cmd('project.setAiPolicy', {
    enabled: z.boolean(),
    allowedClassifications: z.array(z.enum(CONFIDENTIALITY)),
  }),
  cmd('person.add', { person: personInputSchema, role: z.enum(ROLES) }),
  cmd('member.setRole', { personId: id, role: z.enum(ROLES).nullable() }),
  // Sources & statements
  cmd('source.create', { source: sourceInputSchema }),
  cmd('source.update', { id, patch: sourceInputSchema.partial().extend({ extractionStatus: z.enum(EXTRACTION_STATUSES).optional() }) }),
  cmd('source.delete', { id }),
  cmd('statement.create', { statement: statementInputSchema }),
  cmd('statement.updateMeta', { id, patch: statementMetaSchema }),
  cmd('statement.correctTranscription', {
    id,
    text: z.string().trim().min(1).max(4000),
    note: z.string().trim().min(1, 'Explain the correction').max(500),
    uncertainWords: z.array(z.string().max(60)).max(50),
  }),
  cmd('statement.setTranscriptionStatus', { id, status: z.enum(['verified', 'uncertain', 'unverified']) }),
  // Relationships
  cmd('relationship.create', {
    from: nodeRefSchema,
    to: nodeRefSchema,
    relType: z.enum(RELATIONSHIP_TYPES),
    explanation: z.string().max(1000),
    confidence: z.enum(CONFIDENCE),
  }),
  cmd('relationship.review', { id, decision: z.enum(['accepted', 'rejected']) }),
  cmd('relationship.retarget', { id, to: nodeRefSchema }),
  cmd('relationship.delete', { id }),
  // Themes & questions
  cmd('theme.create', { title: requiredShort, summary: longText, criticality: z.enum(CRITICALITY), statementIds: z.array(id).max(200) }),
  cmd('theme.update', {
    id,
    patch: z
      .object({ title: requiredShort, summary: longText, criticality: z.enum(CRITICALITY), conflictNote: longText, status: z.enum(['emerging', 'candidate', 'archived']) })
      .partial(),
  }),
  cmd('theme.merge', { fromId: id, intoId: id }),
  cmd('theme.split', { id, title: requiredShort, statementIds: z.array(id).min(1) }),
  cmd('theme.promote', { id, category: z.enum(PRINCIPLE_CATEGORIES) }),
  cmd('question.create', { question: z.string().trim().min(1).max(1000), context: z.array(nodeRefSchema).max(20) }),
  cmd('question.resolve', { id, status: z.enum(['answered', 'withdrawn', 'open']), answer: z.string().max(2000) }),
  // Win Themes & principles
  cmd('winTheme.create', { content: winThemeContentSchema }),
  cmd('winTheme.edit', { id, content: winThemeContentSchema, note: z.string().max(500), coalesce: z.boolean().optional() }),
  cmd('principle.create', { content: principleContentSchema }),
  cmd('principle.edit', { id, content: principleContentSchema, note: z.string().max(500), coalesce: z.boolean().optional() }),
  cmd('principle.merge', { intoId: id, fromIds: z.array(id).min(1).max(20), content: principleContentSchema }),
  cmd('principle.setApprover', { id, personId: id.nullable() }),
  cmd('principle.reorder', { orderedIds: z.array(id) }),
  cmd('framework.submit', { kind: z.enum(['winTheme', 'principle']), id }),
  cmd('framework.approve', {
    kind: z.enum(['winTheme', 'principle']),
    id,
    note: z.string().max(500),
    /** The wording the approver saw. Approval is refused if the item changed since. */
    expectedWording: z.string().max(12000).optional(),
    /** Record approval on behalf of this person (e.g. the Owner representative in a live workshop). */
    onBehalfOf: id.optional(),
    sessionId: id.optional(),
  }),
  cmd('framework.setReviewStatus', { kind: z.enum(['winTheme', 'principle']), id, status: z.enum(['proposed', 'in_review', 'needs_refinement', 'not_adopted']), note: z.string().max(500).optional() }),
  cmd('framework.duplicate', { kind: z.enum(['winTheme', 'principle']), id }),
  cmd('framework.delete', { kind: z.enum(['winTheme', 'principle']), id }),
  cmd('framework.undelete', { trashId: id }),
  cmd('framework.openRevision', { kind: z.enum(['winTheme', 'principle']), id }),
  cmd('framework.restore', { kind: z.enum(['winTheme', 'principle']), id, version: z.number().int().positive() }),
  cmd('framework.supersede', { kind: z.enum(['winTheme', 'principle']), id, note: z.string().max(500) }),
  // Design Drivers
  cmd('driver.create', { content: driverContentSchema, principleIds: z.array(id) }),
  cmd('driver.edit', { id, content: driverContentSchema, note: z.string().max(500) }),
  cmd('driver.setPrinciples', { id, principleIds: z.array(id) }),
  cmd('driver.submit', { id }),
  cmd('driver.approve', { id, note: z.string().max(500) }),
  cmd('driver.openRevision', { id }),
  cmd('driver.restore', { id, version: z.number().int().positive() }),
  cmd('driver.supersede', { id, note: z.string().max(500) }),
  cmd('driver.proposeTarget', {
    id,
    baseline: z.string().max(200).nullable(),
    target: z.string().trim().min(1, 'Enter a target or leave unset').max(200),
    unit: shortText,
    methodology: longText,
  }),
  cmd('driver.approveTarget', { id }),
  cmd('driver.recordMeasurement', { id, value: z.string().trim().min(1).max(200), asOf: isoDate }),
  cmd('driver.setPerformance', { id, status: z.enum(['not_started', 'in_progress', 'at_risk']) }),
  cmd('driver.verify', {
    id,
    outcome: z.enum(['achieved', 'not_achieved']),
    evidence: z.string().trim().min(20, 'Describe the verification evidence (20+ characters)').max(4000),
    verifiedAt: isoDate,
  }),
  // Decisions
  cmd('decision.create', { question: requiredShort, context: longText, phase: z.enum(PHASES), dueDate: isoDate.nullable() }),
  cmd('decision.update', {
    id,
    patch: z
      .object({
        question: requiredShort,
        context: longText,
        phase: z.enum(PHASES),
        dueDate: isoDate.nullable(),
        status: z.enum(DECISION_STATUSES).exclude(['recommended', 'approved']),
        alternatives: z.array(alternativeSchema).max(12),
        mandatoryRequirements: z.array(mandatoryRequirementSchema).max(30),
        factors: z.array(factorSchema).max(40),
        paramountFactorId: id.nullable(),
        informalScores: z.record(z.string(), z.record(z.string(), z.number().int().min(1).max(5))),
      })
      .partial(),
    note: z.string().max(500),
  }),
  cmd('decision.setDrivers', { id, driverIds: z.array(id) }),
  cmd('decision.recommend', { id, alternativeId: id, rationale: z.string().trim().min(10, 'Explain the recommendation').max(4000) }),
  cmd('decision.approve', { id, alternativeId: id, note: z.string().max(2000) }),
  cmd('decision.reopen', { id, note: z.string().trim().min(5, 'Explain why the decision is reopened').max(1000) }),
  // Collaboration
  cmd('comment.add', { target: nodeRefSchema, body: z.string().trim().min(1).max(4000) }),
  cmd('comment.resolve', { id, resolved: z.boolean() }),
  cmd('suggestion.add', { suggestions: z.array(suggestionInputSchema).max(50) }),
  cmd('suggestion.accept', { id }),
  cmd('suggestion.dismiss', { id }),
  cmd('milestone.upsert', {
    milestone: z.object({ id: id.optional(), name: requiredShort, date: isoDate, phase: z.enum(PHASES), driverIds: z.array(id), complete: z.boolean() }),
  }),
  cmd('milestone.delete', { id }),
  // Understand: What We Heard
  cmd('heard.create', { item: heardInputSchema }),
  cmd('heard.update', { id, patch: heardInputSchema.partial().extend({ reviewed: z.boolean().optional() }) }),
  cmd('heard.delete', { id }),
  cmd('heard.reorder', { orderedIds: z.array(id).max(300) }),
  // Interpret
  cmd('pov.update', { content: povContentSchema, coalesce: z.boolean().optional() }),
  cmd('principle.updateSupport', { id, whyItMatters: longText.optional(), designImplications: longText.optional() }),
  cmd('opportunity.create', { content: opportunityInputSchema }),
  cmd('opportunity.update', { id, patch: opportunityInputSchema.partial() }),
  cmd('opportunity.delete', { id }),
  cmd('outcome.create', { content: outcomeInputSchema }),
  cmd('outcome.update', { id, patch: outcomeInputSchema.partial() }),
  cmd('outcome.delete', { id }),
  cmd('outcome.addProgress', { id, date: isoDate, kind: z.enum(PROGRESS_KINDS), note: z.string().trim().min(1, 'Describe the evidence').max(2000) }),
  cmd('outcome.removeProgress', { id, progressId: id }),
  // Owner alignment workshops
  cmd('workshop.create', { title: requiredShort, date: isoDate, attendees: z.array(attendeeSchema).max(60) }),
  cmd('workshop.update', {
    id,
    patch: z
      .object({
        title: requiredShort,
        date: isoDate,
        attendees: z.array(attendeeSchema).max(60),
        generalNotes: z.string().max(20000),
        actions: z.array(z.object({ id, text: z.string().trim().min(1).max(1000), owner: shortText, due: isoDate.nullable(), done: z.boolean() })).max(200),
      })
      .partial(),
  }),
  cmd('workshop.setNote', { id, itemKey: z.string().regex(/^(winTheme|principle):[\w-]{1,64}$/), text: z.string().max(10000) }),
  cmd('workshop.start', { id }),
  cmd('workshop.end', { id }),
])

export type Command = z.infer<typeof commandSchema>
export type CommandType = Command['type']
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

export type ParseResult = { ok: true; command: Command } | { ok: false; errors: string[] }

export function parseCommand(input: unknown): ParseResult {
  const parsed = commandSchema.safeParse(input)
  if (parsed.success) return { ok: true, command: parsed.data }
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'command'}: ${i.message}`),
  }
}
