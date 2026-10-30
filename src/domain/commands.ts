import { evaluateCba } from './cba'
import { lockedDriverFingerprint } from './drivers'
import { newId, nextCode } from './ids'
import { can, PermissionError, roleFor, type Capability } from './permissions'
import { parseCommand, type Command, type CommandOf, type CommandType } from './schemas'
import { nodeExists, sameRef } from './traceability'
import type {
  ApprovalStatus,
  Confidence,
  DesignDriver,
  DriverContent,
  GuidingPrinciple,
  ID,
  NodeRef,
  Origin,
  PrincipleContent,
  ProjectData,
  Relationship,
  RelationshipType,
  WinTheme,
  WinThemeContent,
} from './types'

/**
 * The command handler is the single place where business rules live.
 * In demo mode it runs in the browser against synthetic data; in production
 * it runs server-side (see supabase/functions/commands) after authentication,
 * with Postgres row-level security as a second line of defence.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export interface CommandContext {
  actorId: ID
  now: string
}

export interface CommandResult {
  data: ProjectData
  createdId: ID | null
}

interface HandlerOutcome {
  summary: string
  target?: NodeRef | null
  createdId?: ID
}

type Handler<K extends CommandType> = (d: ProjectData, c: CommandOf<K>, x: Ctx) => HandlerOutcome
type Handlers = { [K in CommandType]: Handler<K> }

interface Ctx extends CommandContext {
  require: (cap: Capability) => void
  has: (cap: Capability) => boolean
}

const REQUIRED: Record<CommandType, Capability> = {
  'project.update': 'project.configure',
  'project.setAiPolicy': 'project.configure',
  'person.add': 'project.manageMembers',
  'member.setRole': 'project.manageMembers',
  'source.create': 'source.create',
  'source.update': 'source.edit',
  'source.delete': 'source.delete',
  'statement.create': 'statement.create',
  'statement.updateMeta': 'source.edit',
  'statement.correctTranscription': 'statement.verify',
  'statement.setTranscriptionStatus': 'statement.verify',
  'relationship.create': 'relationship.propose',
  'relationship.review': 'relationship.review',
  'relationship.retarget': 'theme.edit',
  'relationship.delete': 'theme.edit',
  'theme.create': 'theme.edit',
  'theme.update': 'theme.edit',
  'theme.merge': 'theme.edit',
  'theme.split': 'theme.edit',
  'theme.promote': 'framework.edit',
  'question.create': 'comment.create',
  'question.resolve': 'theme.edit',
  'winTheme.create': 'framework.edit',
  'winTheme.edit': 'framework.edit',
  'principle.create': 'framework.edit',
  'principle.edit': 'framework.edit',
  'principle.setApprover': 'framework.edit',
  'principle.reorder': 'framework.edit',
  'framework.submit': 'framework.edit',
  'framework.approve': 'framework.approve',
  'framework.openRevision': 'framework.edit',
  'framework.restore': 'framework.edit',
  'framework.supersede': 'framework.approve',
  'driver.create': 'driver.edit',
  'driver.edit': 'driver.edit',
  'driver.setPrinciples': 'driver.edit',
  'driver.submit': 'driver.edit',
  'driver.approve': 'driver.approve',
  'driver.openRevision': 'driver.edit',
  'driver.restore': 'driver.edit',
  'driver.supersede': 'driver.approve',
  'driver.proposeTarget': 'driver.edit',
  'driver.approveTarget': 'driver.approve',
  'driver.recordMeasurement': 'driver.recordMeasurement',
  'driver.setPerformance': 'driver.edit',
  'driver.verify': 'driver.verify',
  'decision.create': 'decision.edit',
  'decision.update': 'decision.edit',
  'decision.setDrivers': 'decision.edit',
  'decision.recommend': 'decision.recommend',
  'decision.approve': 'decision.approve',
  'decision.reopen': 'decision.approve',
  'comment.add': 'comment.create',
  'comment.resolve': 'comment.create',
  'suggestion.add': 'suggestion.request',
  'suggestion.accept': 'suggestion.review',
  'suggestion.dismiss': 'suggestion.review',
  'milestone.upsert': 'driver.edit',
  'milestone.delete': 'driver.edit',
}

export function requiredCapability(type: CommandType): Capability {
  return REQUIRED[type]
}

/**
 * Validate and apply a command. Returns a new aggregate; the input is never mutated.
 * Throws PermissionError, DomainError, or a validation DomainError.
 */
export function applyCommand(data: ProjectData, input: unknown, context: CommandContext): CommandResult {
  const parsed = parseCommand(input)
  if (!parsed.ok) throw new DomainError(`Invalid input — ${parsed.errors.join('; ')}`)
  const command: Command = parsed.command
  const role = roleFor(data.project, context.actorId)
  const actor = data.people.find((p) => p.id === context.actorId)
  const ctx: Ctx = {
    ...context,
    has: (cap) => can(role, cap),
    require: (cap) => {
      if (!can(role, cap)) throw new PermissionError(cap, actor ?? context.actorId)
    },
  }
  ctx.require(REQUIRED[command.type])

  const draft: ProjectData = structuredClone(data)
  const handler = handlers[command.type] as Handler<typeof command.type>
  const outcome = handler(draft, command as never, ctx)
  draft.revision = data.revision + 1
  draft.audit.unshift({
    id: newId(),
    at: context.now,
    actorId: context.actorId,
    action: command.type,
    target: outcome.target ?? null,
    summary: outcome.summary,
  })
  return { data: draft, createdId: outcome.createdId ?? null }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function find<T extends { id: ID }>(list: T[], id: ID, what: string): T {
  const item = list.find((x) => x.id === id)
  if (!item) throw new DomainError(`${what} not found.`)
  return item
}

function addRelationship(
  d: ProjectData,
  x: Ctx,
  from: NodeRef,
  to: NodeRef,
  type: RelationshipType,
  opts: { explanation?: string; confidence?: Confidence; origin?: Origin; accepted: boolean; proposedBy?: ID },
): Relationship {
  if (!nodeExists(d, from) || !nodeExists(d, to)) throw new DomainError('Both ends of a relationship must exist in this project.')
  if (sameRef(from, to)) throw new DomainError('A node cannot relate to itself.')
  const existing = d.relationships.find((r) => sameRef(r.from, from) && sameRef(r.to, to) && r.type === type && r.status !== 'rejected')
  if (existing) {
    if (opts.accepted && existing.status === 'proposed') {
      existing.status = 'accepted'
      existing.reviewedBy = x.actorId
      existing.updatedAt = x.now
    }
    return existing
  }
  const rel: Relationship = {
    id: newId(),
    from,
    to,
    type,
    explanation: opts.explanation ?? '',
    confidence: opts.confidence ?? 'medium',
    origin: opts.origin ?? 'human',
    proposedBy: opts.proposedBy ?? x.actorId,
    reviewedBy: opts.accepted ? x.actorId : null,
    status: opts.accepted ? 'accepted' : 'proposed',
    createdAt: x.now,
    updatedAt: x.now,
  }
  d.relationships.push(rel)
  return rel
}

function removeRelationshipsTouching(d: ProjectData, ref: NodeRef) {
  d.relationships = d.relationships.filter((r) => !sameRef(r.from, ref) && !sameRef(r.to, ref))
}

type Versioned<C, S extends string> = {
  version: number
  versions: { version: number; snapshot: C; status: S; changedBy: ID; changedAt: string; note: string }[]
}

function pushVersion<C, S extends string>(entity: Versioned<C, S>, snapshot: C, status: S, x: Ctx, note: string) {
  entity.version += 1
  entity.versions.push({ version: entity.version, snapshot: structuredClone(snapshot), status, changedBy: x.actorId, changedAt: x.now, note })
}

function frameworkEntity(d: ProjectData, kind: 'winTheme' | 'principle', id: ID): WinTheme | GuidingPrinciple {
  return kind === 'winTheme' ? find(d.winThemes, id, 'Win Theme') : find(d.principles, id, 'Guiding Principle')
}

function winThemeContent(w: WinTheme): WinThemeContent {
  return { statement: w.statement, narrative: w.narrative }
}
function principleContent(p: GuidingPrinciple): PrincipleContent {
  return { title: p.title, statement: p.statement, intent: p.intent, category: p.category }
}
function contentOf(e: WinTheme | GuidingPrinciple): WinThemeContent | PrincipleContent {
  return 'title' in e ? principleContent(e) : winThemeContent(e)
}

function assertEditable(status: ApprovalStatus, label: string) {
  if (status === 'approved') throw new DomainError(`${label} is approved and locked. Open a revision to propose changes.`)
  if (status === 'superseded') throw new DomainError(`${label} is superseded and cannot be edited.`)
}

function driverContent(dr: DesignDriver): DriverContent {
  const { title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds } = dr
  return structuredClone({ title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds })
}

function setLinks(d: ProjectData, x: Ctx, from: NodeRef, toType: 'principle' | 'driver', ids: ID[], type: RelationshipType) {
  const wanted = new Set(ids)
  d.relationships = d.relationships.filter((r) => !(sameRef(r.from, from) && r.to.type === toType && r.type === type && !wanted.has(r.to.id)))
  for (const id of wanted) addRelationship(d, x, from, { type: toType, id }, type, { accepted: true })
}

const ref = (type: NodeRef['type'], id: ID): NodeRef => ({ type, id })

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const handlers: Handlers = {
  // ---------------- Project ----------------
  'project.update': (d, c) => {
    const { terminology, owner, ...rest } = c.patch
    Object.assign(d.project, rest)
    if (owner) d.project.owner = owner
    if (terminology) d.project.terminology = terminology
    return { summary: `Updated project profile (${Object.keys(c.patch).join(', ')})` }
  },
  'project.setAiPolicy': (d, c) => {
    d.project.aiPolicy = { enabled: c.enabled, allowedClassifications: c.allowedClassifications }
    return { summary: `AI assistance ${c.enabled ? 'enabled' : 'disabled'} (allowed: ${c.allowedClassifications.join(', ') || 'none'})` }
  },
  'person.add': (d, c) => {
    if (d.people.some((p) => c.person.email && p.email.toLowerCase() === c.person.email.toLowerCase())) {
      throw new DomainError('A person with this email is already on the project.')
    }
    const id = newId()
    d.people.push({ id, ...c.person })
    d.project.members.push({ personId: id, role: c.role })
    return { summary: `Added ${c.person.name} as ${c.role}`, createdId: id }
  },
  'member.setRole': (d, c) => {
    find(d.people, c.personId, 'Person')
    const admins = d.project.members.filter((m) => ['project_admin', 'org_admin', 'system_admin'].includes(m.role))
    const isLastAdmin = admins.length === 1 && admins[0].personId === c.personId
    if (isLastAdmin && (c.role === null || !['project_admin', 'org_admin', 'system_admin'].includes(c.role))) {
      throw new DomainError('A project must keep at least one administrator.')
    }
    d.project.members = d.project.members.filter((m) => m.personId !== c.personId)
    if (c.role) d.project.members.push({ personId: c.personId, role: c.role })
    return { summary: c.role ? `Set role to ${c.role}` : 'Removed from project' }
  },

  // ---------------- Sources ----------------
  'source.create': (d, c, x) => {
    if (c.source.possibleDuplicateOf) find(d.sources, c.source.possibleDuplicateOf, 'Duplicate source')
    const id = newId()
    const code = nextCode('SRC', d.sources.map((s) => s.code), 3)
    d.sources.push({ id, code, ...c.source, uploadedBy: x.actorId, uploadedAt: x.now, version: 1, extractionStatus: 'not_started' })
    return { summary: `Registered source ${code} "${c.source.title}"`, target: ref('source', id), createdId: id }
  },
  'source.update': (d, c) => {
    const s = find(d.sources, c.id, 'Source')
    if (c.patch.possibleDuplicateOf === s.id) throw new DomainError('A source cannot duplicate itself.')
    const fileChanged = c.patch.file !== undefined && JSON.stringify(c.patch.file) !== JSON.stringify(s.file)
    Object.assign(s, c.patch)
    if (fileChanged) s.version += 1
    return { summary: `Updated source ${s.code}${fileChanged ? ` (file version ${s.version})` : ''}`, target: ref('source', s.id) }
  },
  'source.delete': (d, c) => {
    const s = find(d.sources, c.id, 'Source')
    const statementIds = d.statements.filter((st) => st.sourceId === s.id).map((st) => st.id)
    for (const sid of statementIds) removeRelationshipsTouching(d, ref('statement', sid))
    removeRelationshipsTouching(d, ref('source', s.id))
    d.statements = d.statements.filter((st) => st.sourceId !== s.id)
    d.comments = d.comments.filter((cm) => !(cm.target.type === 'source' && cm.target.id === s.id) && !(cm.target.type === 'statement' && statementIds.includes(cm.target.id)))
    d.sources = d.sources.filter((x) => x.id !== s.id)
    d.sources.forEach((x) => {
      if (x.possibleDuplicateOf === s.id) x.possibleDuplicateOf = null
    })
    return { summary: `Deleted source ${s.code} "${s.title}" and ${statementIds.length} extracted statement(s)` }
  },

  // ---------------- Statements ----------------
  'statement.create': (d, c, x) => {
    const src = find(d.sources, c.statement.sourceId, 'Source')
    const id = newId()
    const code = nextCode('ST', d.statements.map((s) => s.code), 3)
    d.statements.push({
      id,
      code,
      ...c.statement,
      interpretationOrigin: c.statement.interpretation.trim() ? 'human' : null,
      reviewedBy: null,
      reviewedAt: null,
      revisions: [],
      createdBy: x.actorId,
      createdAt: x.now,
    })
    if (src.extractionStatus === 'not_started') src.extractionStatus = 'in_progress'
    return { summary: `Recorded statement ${code} from ${src.code}`, target: ref('statement', id), createdId: id }
  },
  'statement.updateMeta': (d, c) => {
    const s = find(d.statements, c.id, 'Statement')
    Object.assign(s, c.patch)
    if (c.patch.interpretation !== undefined) s.interpretationOrigin = c.patch.interpretation.trim() ? 'human' : null
    return { summary: `Updated statement ${s.code} metadata`, target: ref('statement', s.id) }
  },
  'statement.correctTranscription': (d, c, x) => {
    const s = find(d.statements, c.id, 'Statement')
    if (c.text === s.originalText && JSON.stringify(c.uncertainWords) === JSON.stringify(s.uncertainWords)) {
      throw new DomainError('No change to the transcription.')
    }
    s.revisions.push({ text: s.originalText, by: x.actorId, at: x.now, note: c.note })
    s.originalText = c.text
    s.uncertainWords = c.uncertainWords
    s.transcriptionStatus = c.uncertainWords.length > 0 ? 'uncertain' : 'unverified'
    s.reviewedBy = null
    s.reviewedAt = null
    return { summary: `Corrected transcription of ${s.code}: ${c.note}`, target: ref('statement', s.id) }
  },
  'statement.setTranscriptionStatus': (d, c, x) => {
    const s = find(d.statements, c.id, 'Statement')
    if (c.status === 'verified' && s.uncertainWords.length > 0) {
      throw new DomainError('Resolve or correct the uncertain words before verifying this transcription.')
    }
    s.transcriptionStatus = c.status
    s.reviewedBy = c.status === 'unverified' ? null : x.actorId
    s.reviewedAt = c.status === 'unverified' ? null : x.now
    const src = d.sources.find((x2) => x2.id === s.sourceId)
    if (src && c.status === 'verified') {
      const all = d.statements.filter((st) => st.sourceId === src.id)
      if (all.every((st) => st.transcriptionStatus === 'verified' || st.transcriptionStatus === 'not_applicable')) src.extractionStatus = 'verified'
    }
    return { summary: `Marked transcription of ${s.code} as ${c.status}`, target: ref('statement', s.id) }
  },

  // ---------------- Relationships ----------------
  'relationship.create': (d, c, x) => {
    const rel = addRelationship(d, x, c.from, c.to, c.relType, {
      explanation: c.explanation,
      confidence: c.confidence,
      accepted: x.has('relationship.review'),
    })
    return { summary: `${rel.status === 'accepted' ? 'Linked' : 'Proposed link'} ${c.from.type} → ${c.to.type} (${c.relType})`, target: c.to, createdId: rel.id }
  },
  'relationship.review': (d, c, x) => {
    const r = find(d.relationships, c.id, 'Relationship')
    r.status = c.decision
    r.reviewedBy = x.actorId
    r.updatedAt = x.now
    return { summary: `${c.decision === 'accepted' ? 'Accepted' : 'Rejected'} ${r.origin === 'human' ? '' : r.origin + '-suggested '}relationship`, target: r.to }
  },
  'relationship.retarget': (d, c, x) => {
    const r = find(d.relationships, c.id, 'Relationship')
    if (c.to.type !== r.to.type) throw new DomainError('Evidence can only move between nodes of the same type.')
    if (!nodeExists(d, c.to)) throw new DomainError('Destination not found.')
    const dup = d.relationships.find((o) => o.id !== r.id && sameRef(o.from, r.from) && sameRef(o.to, c.to) && o.type === r.type)
    if (dup) {
      d.relationships = d.relationships.filter((o) => o.id !== r.id)
    } else {
      r.to = c.to
      r.updatedAt = x.now
    }
    return { summary: `Moved evidence to ${c.to.type}`, target: c.to }
  },
  'relationship.delete': (d, c) => {
    const r = find(d.relationships, c.id, 'Relationship')
    d.relationships = d.relationships.filter((o) => o.id !== r.id)
    return { summary: `Removed ${r.from.type} → ${r.to.type} relationship`, target: r.to }
  },

  // ---------------- Themes & questions ----------------
  'theme.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('TH', d.themes.map((t) => t.code))
    d.themes.push({
      id,
      code,
      title: c.title,
      summary: c.summary,
      status: 'emerging',
      criticality: c.criticality,
      conflictNote: '',
      promotedToPrincipleId: null,
      createdBy: x.actorId,
      createdAt: x.now,
    })
    for (const sid of c.statementIds) {
      find(d.statements, sid, 'Statement')
      addRelationship(d, x, ref('statement', sid), ref('theme', id), 'supports', { accepted: true })
    }
    return { summary: `Created theme ${code} "${c.title}"`, target: ref('theme', id), createdId: id }
  },
  'theme.update': (d, c) => {
    const t = find(d.themes, c.id, 'Theme')
    if (t.status === 'promoted' && c.patch.status) throw new DomainError('A promoted theme keeps its status; edit the resulting principle instead.')
    Object.assign(t, c.patch)
    return { summary: `Updated theme ${t.code}`, target: ref('theme', t.id) }
  },
  'theme.merge': (d, c, x) => {
    if (c.fromId === c.intoId) throw new DomainError('Choose two different themes to merge.')
    const from = find(d.themes, c.fromId, 'Theme')
    const into = find(d.themes, c.intoId, 'Theme')
    if (from.status === 'promoted') throw new DomainError('A promoted theme cannot be merged away.')
    for (const r of d.relationships.filter((r) => sameRef(r.to, ref('theme', from.id)))) {
      addRelationship(d, x, r.from, ref('theme', into.id), r.type, { explanation: r.explanation, confidence: r.confidence, origin: r.origin, accepted: r.status === 'accepted', proposedBy: r.proposedBy })
    }
    for (const r of d.relationships.filter((r) => sameRef(r.from, ref('theme', from.id)))) {
      addRelationship(d, x, ref('theme', into.id), r.to, r.type, { explanation: r.explanation, confidence: r.confidence, origin: r.origin, accepted: r.status === 'accepted', proposedBy: r.proposedBy })
    }
    removeRelationshipsTouching(d, ref('theme', from.id))
    from.status = 'archived'
    from.conflictNote = `Merged into ${into.code} on ${x.now.slice(0, 10)}.`
    if (from.criticality === 'critical' || (from.criticality === 'high' && into.criticality === 'normal')) into.criticality = from.criticality
    return { summary: `Merged theme ${from.code} into ${into.code}`, target: ref('theme', into.id) }
  },
  'theme.split': (d, c, x) => {
    const t = find(d.themes, c.id, 'Theme')
    const id = newId()
    const code = nextCode('TH', d.themes.map((th) => th.code))
    d.themes.push({ id, code, title: c.title, summary: `Split from ${t.code}.`, status: 'emerging', criticality: t.criticality, conflictNote: '', promotedToPrincipleId: null, createdBy: x.actorId, createdAt: x.now })
    let moved = 0
    for (const r of d.relationships) {
      if (r.to.type === 'theme' && r.to.id === t.id && r.from.type === 'statement' && c.statementIds.includes(r.from.id)) {
        r.to = ref('theme', id)
        r.updatedAt = x.now
        moved++
      }
    }
    if (moved === 0) throw new DomainError('Select statements that currently belong to the theme.')
    return { summary: `Split ${moved} statement(s) from ${t.code} into new theme ${code}`, target: ref('theme', id), createdId: id }
  },
  'theme.promote': (d, c, x) => {
    const t = find(d.themes, c.id, 'Theme')
    if (t.status === 'archived') throw new DomainError('Archived themes cannot be promoted.')
    if (t.promotedToPrincipleId) throw new DomainError('This theme has already been promoted.')
    const outcome = handlers['principle.create'](d, { type: 'principle.create', content: { title: t.title, statement: t.summary || t.title, intent: '', category: c.category } }, x)
    const pid = outcome.createdId!
    addRelationship(d, x, ref('theme', t.id), ref('principle', pid), 'informs', { accepted: true, explanation: 'Promoted from theme' })
    t.status = 'promoted'
    t.promotedToPrincipleId = pid
    return { summary: `Promoted theme ${t.code} to a candidate guiding principle`, target: ref('principle', pid), createdId: pid }
  },
  'question.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('Q', d.questions.map((q) => q.code), 3)
    d.questions.push({ id, code, question: c.question, context: c.context, status: 'open', answer: '', raisedBy: x.actorId, raisedAt: x.now })
    return { summary: `Raised open question ${code}`, target: c.context[0] ?? null, createdId: id }
  },
  'question.resolve': (d, c) => {
    const q = find(d.questions, c.id, 'Question')
    if (c.status === 'answered' && !c.answer.trim()) throw new DomainError('Record the answer before closing the question.')
    q.status = c.status
    q.answer = c.answer
    return { summary: `Question ${q.code} ${c.status}` }
  },

  // ---------------- Win Themes & principles ----------------
  'winTheme.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('WT', d.winThemes.map((w) => w.code))
    d.winThemes.push({ id, code, ...c.content, status: 'proposed', version: 1, versions: [{ version: 1, snapshot: { ...c.content }, status: 'proposed', changedBy: x.actorId, changedAt: x.now, note: 'Created' }], approval: null, createdBy: x.actorId })
    return { summary: `Proposed Win Theme ${code}`, target: ref('winTheme', id), createdId: id }
  },
  'winTheme.edit': (d, c, x) => {
    const w = find(d.winThemes, c.id, 'Win Theme')
    assertEditable(w.status, 'This Win Theme')
    if (JSON.stringify(winThemeContent(w)) === JSON.stringify(c.content)) throw new DomainError('No changes to save.')
    Object.assign(w, c.content)
    pushVersion(w, c.content, w.status, x, c.note || 'Edited')
    return { summary: `Edited Win Theme ${w.code} (v${w.version})`, target: ref('winTheme', w.id) }
  },
  'principle.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('GP', d.principles.map((p) => p.code))
    const order = d.principles.reduce((m, p) => Math.max(m, p.order), 0) + 1
    d.principles.push({ id, code, order, ...c.content, status: 'proposed', version: 1, versions: [{ version: 1, snapshot: { ...c.content }, status: 'proposed', changedBy: x.actorId, changedAt: x.now, note: 'Created' }], approval: null, accountableApproverId: null, createdBy: x.actorId })
    return { summary: `Proposed guiding principle ${code} "${c.content.title}"`, target: ref('principle', id), createdId: id }
  },
  'principle.edit': (d, c, x) => {
    const p = find(d.principles, c.id, 'Guiding Principle')
    assertEditable(p.status, 'This principle')
    if (JSON.stringify(principleContent(p)) === JSON.stringify(c.content)) throw new DomainError('No changes to save.')
    Object.assign(p, c.content)
    pushVersion(p, c.content, p.status, x, c.note || 'Edited')
    return { summary: `Edited principle ${p.code} (v${p.version})`, target: ref('principle', p.id) }
  },
  'principle.setApprover': (d, c) => {
    const p = find(d.principles, c.id, 'Guiding Principle')
    if (c.personId) {
      const role = roleFor(d.project, c.personId)
      if (!can(role, 'framework.approve')) throw new DomainError('The accountable approver must hold an approval role on this project.')
    }
    p.accountableApproverId = c.personId
    return { summary: `Set accountable approver for ${p.code}`, target: ref('principle', p.id) }
  },
  'principle.reorder': (d, c) => {
    c.orderedIds.forEach((id, i) => {
      const p = find(d.principles, id, 'Guiding Principle')
      p.order = i + 1
    })
    return { summary: 'Reordered guiding principles' }
  },
  'framework.submit': (d, c, x) => {
    const e = frameworkEntity(d, c.kind, c.id)
    if (e.status !== 'proposed') throw new DomainError('Only proposed items can be submitted for review.')
    e.status = 'in_review'
    pushVersion<WinThemeContent | PrincipleContent, ApprovalStatus>(e as never, contentOf(e), 'in_review', x, 'Submitted for review')
    return { summary: `Submitted ${e.code} for review`, target: ref(c.kind, e.id) }
  },
  'framework.approve': (d, c, x) => {
    const e = frameworkEntity(d, c.kind, c.id)
    if (e.status !== 'in_review') throw new DomainError('Only items in review can be approved.')
    if ('accountableApproverId' in e && e.accountableApproverId && e.accountableApproverId !== x.actorId) {
      const approver = d.people.find((p) => p.id === e.accountableApproverId)
      throw new DomainError(`Only the accountable approver (${approver?.name ?? 'assigned'}) can approve this principle.`)
    }
    if (c.kind === 'winTheme') {
      for (const w of d.winThemes) {
        if (w.id !== e.id && w.status === 'approved') {
          w.status = 'superseded'
          pushVersion(w, winThemeContent(w), 'superseded', x, `Superseded by ${e.code}`)
        }
      }
    }
    e.status = 'approved'
    pushVersion<WinThemeContent | PrincipleContent, ApprovalStatus>(e as never, contentOf(e), 'approved', x, c.note || 'Approved')
    e.approval = { approvedBy: x.actorId, approvedAt: x.now, version: e.version, note: c.note }
    return { summary: `Approved ${e.code} (v${e.version})`, target: ref(c.kind, e.id) }
  },
  'framework.openRevision': (d, c, x) => {
    const e = frameworkEntity(d, c.kind, c.id)
    if (e.status !== 'approved') throw new DomainError('Only approved items need a revision to be opened.')
    e.status = 'proposed'
    pushVersion<WinThemeContent | PrincipleContent, ApprovalStatus>(e as never, contentOf(e), 'proposed', x, `Revision opened (last approved v${e.approval?.version})`)
    return { summary: `Opened revision of ${e.code}`, target: ref(c.kind, e.id) }
  },
  'framework.restore': (d, c, x) => {
    const e = frameworkEntity(d, c.kind, c.id)
    assertEditable(e.status, e.code)
    const v = e.versions.find((ver) => ver.version === c.version)
    if (!v) throw new DomainError('Version not found.')
    Object.assign(e, v.snapshot)
    pushVersion<WinThemeContent | PrincipleContent, ApprovalStatus>(e as never, v.snapshot, e.status, x, `Restored content from v${c.version}`)
    return { summary: `Restored ${e.code} to v${c.version} content`, target: ref(c.kind, e.id) }
  },
  'framework.supersede': (d, c, x) => {
    const e = frameworkEntity(d, c.kind, c.id)
    if (e.status === 'superseded') throw new DomainError('Already superseded.')
    e.status = 'superseded'
    pushVersion<WinThemeContent | PrincipleContent, ApprovalStatus>(e as never, contentOf(e), 'superseded', x, c.note || 'Superseded')
    return { summary: `Superseded ${e.code}`, target: ref(c.kind, e.id) }
  },

  // ---------------- Design Drivers ----------------
  'driver.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('DD', d.drivers.map((dr) => dr.code))
    const content = structuredClone(c.content)
    content.measure.targetStatus = content.measure.target ? 'proposed' : 'not_set'
    content.measure.current = null
    content.measure.currentAsOf = null
    d.drivers.push({ id, code, ...content, approvalStatus: 'proposed', performanceStatus: 'not_started', verification: null, version: 1, versions: [{ version: 1, snapshot: structuredClone(content), status: 'proposed', changedBy: x.actorId, changedAt: x.now, note: 'Created' }], approval: null, createdBy: x.actorId })
    for (const pid of c.principleIds) {
      find(d.principles, pid, 'Guiding Principle')
      addRelationship(d, x, ref('driver', id), ref('principle', pid), 'implements', { accepted: true })
    }
    return { summary: `Proposed Design Driver ${code} "${content.title}"`, target: ref('driver', id), createdId: id }
  },
  'driver.edit': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus === 'superseded') throw new DomainError('Superseded drivers cannot be edited.')
    const next = structuredClone(c.content)
    // Measurement state is controlled by dedicated, attributable commands.
    next.measure.current = dr.measure.current
    next.measure.currentAsOf = dr.measure.currentAsOf
    next.measure.targetStatus = next.measure.target === dr.measure.target ? dr.measure.targetStatus : next.measure.target ? 'proposed' : 'not_set'
    if (dr.approvalStatus === 'approved' && lockedDriverFingerprint(next) !== lockedDriverFingerprint(dr)) {
      throw new DomainError('This driver is approved: its commitment, measure and target are locked. Open a revision to change them.')
    }
    for (const dep of next.dependencyIds) {
      if (dep === dr.id) throw new DomainError('A driver cannot depend on itself.')
      find(d.drivers, dep, 'Dependency')
    }
    if (next.ownerPersonId) find(d.people, next.ownerPersonId, 'Owner')
    if (JSON.stringify(driverContent(dr)) === JSON.stringify(next)) throw new DomainError('No changes to save.')
    Object.assign(dr, next)
    pushVersion(dr, next, dr.approvalStatus, x, c.note || 'Edited')
    return { summary: `Edited Design Driver ${dr.code} (v${dr.version})`, target: ref('driver', dr.id) }
  },
  'driver.setPrinciples': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    c.principleIds.forEach((pid) => find(d.principles, pid, 'Guiding Principle'))
    setLinks(d, x, ref('driver', dr.id), 'principle', c.principleIds, 'implements')
    return { summary: `Linked ${dr.code} to ${c.principleIds.length} principle(s)`, target: ref('driver', dr.id) }
  },
  'driver.submit': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'proposed') throw new DomainError('Only proposed drivers can be submitted.')
    const linked = d.relationships.some((r) => r.status === 'accepted' && r.type === 'implements' && sameRef(r.from, ref('driver', dr.id)))
    if (!linked) throw new DomainError('Link the driver to at least one guiding principle before review.')
    if (!dr.measure.target && !dr.measure.acceptanceCriteria.trim()) {
      throw new DomainError('Define a target or qualitative acceptance criteria before review.')
    }
    dr.approvalStatus = 'under_review'
    pushVersion(dr, driverContent(dr), 'under_review', x, 'Submitted for review')
    return { summary: `Submitted ${dr.code} for review`, target: ref('driver', dr.id) }
  },
  'driver.approve': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'under_review') throw new DomainError('Only drivers under review can be approved.')
    dr.approvalStatus = 'approved'
    pushVersion(dr, driverContent(dr), 'approved', x, c.note || 'Approved')
    dr.approval = { approvedBy: x.actorId, approvedAt: x.now, version: dr.version, note: c.note }
    return { summary: `Approved Design Driver ${dr.code}`, target: ref('driver', dr.id) }
  },
  'driver.openRevision': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'approved') throw new DomainError('Only approved drivers need a revision to be opened.')
    if (dr.performanceStatus === 'verified' || dr.performanceStatus === 'not_achieved') {
      throw new DomainError('Verified outcomes are final. Supersede this driver and create a successor instead.')
    }
    dr.approvalStatus = 'proposed'
    pushVersion(dr, driverContent(dr), 'proposed', x, `Revision opened (last approved v${dr.approval?.version})`)
    return { summary: `Opened revision of ${dr.code}`, target: ref('driver', dr.id) }
  },
  'driver.restore': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus === 'approved' || dr.approvalStatus === 'superseded') throw new DomainError('Open a revision before restoring an earlier version.')
    const v = dr.versions.find((ver) => ver.version === c.version)
    if (!v) throw new DomainError('Version not found.')
    const snapshot = structuredClone(v.snapshot)
    snapshot.measure.current = dr.measure.current
    snapshot.measure.currentAsOf = dr.measure.currentAsOf
    Object.assign(dr, snapshot)
    pushVersion(dr, snapshot, dr.approvalStatus, x, `Restored content from v${c.version}`)
    return { summary: `Restored ${dr.code} to v${c.version} content`, target: ref('driver', dr.id) }
  },
  'driver.supersede': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus === 'superseded') throw new DomainError('Already superseded.')
    dr.approvalStatus = 'superseded'
    pushVersion(dr, driverContent(dr), 'superseded', x, c.note || 'Superseded')
    return { summary: `Superseded ${dr.code}`, target: ref('driver', dr.id) }
  },
  'driver.proposeTarget': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus === 'approved' && dr.measure.targetStatus === 'approved') {
      throw new DomainError('The approved target is locked. Open a revision to propose a new target.')
    }
    if (dr.approvalStatus === 'superseded') throw new DomainError('Superseded drivers cannot be edited.')
    dr.measure = { ...dr.measure, kind: 'quantitative', baseline: c.baseline, target: c.target, unit: c.unit, methodology: c.methodology, targetStatus: 'proposed' }
    pushVersion(dr, driverContent(dr), dr.approvalStatus, x, `Proposed target ${c.target} ${c.unit}`.trim())
    return { summary: `Proposed target for ${dr.code}: ${c.target} ${c.unit}`.trim(), target: ref('driver', dr.id) }
  },
  'driver.approveTarget': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.measure.targetStatus !== 'proposed' || !dr.measure.target) throw new DomainError('There is no proposed target to approve.')
    dr.measure.targetStatus = 'approved'
    pushVersion(dr, driverContent(dr), dr.approvalStatus, x, `Target approved: ${dr.measure.target} ${dr.measure.unit}`.trim())
    return { summary: `Approved target for ${dr.code}`, target: ref('driver', dr.id) }
  },
  'driver.recordMeasurement': (d, c) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'approved') throw new DomainError('Record measurements against approved drivers only.')
    if (dr.performanceStatus === 'verified' || dr.performanceStatus === 'not_achieved') throw new DomainError('This driver has a final verification.')
    dr.measure.current = c.value
    dr.measure.currentAsOf = c.asOf
    if (dr.performanceStatus === 'not_started') dr.performanceStatus = 'in_progress'
    return { summary: `Recorded ${dr.code} observation: ${c.value} ${dr.measure.unit} (as of ${c.asOf})`.replace('  ', ' '), target: ref('driver', dr.id) }
  },
  'driver.setPerformance': (d, c) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'approved') throw new DomainError('Performance status applies to approved drivers only.')
    if (dr.performanceStatus === 'verified' || dr.performanceStatus === 'not_achieved') {
      throw new DomainError('Verification is final and cannot be changed by a status update.')
    }
    dr.performanceStatus = c.status
    return { summary: `Set ${dr.code} performance to ${c.status.replace('_', ' ')}`, target: ref('driver', dr.id) }
  },
  'driver.verify': (d, c, x) => {
    const dr = find(d.drivers, c.id, 'Design Driver')
    if (dr.approvalStatus !== 'approved') throw new DomainError('Only approved drivers can be verified.')
    if (dr.performanceStatus === 'verified' || dr.performanceStatus === 'not_achieved') throw new DomainError('This driver already has a final verification.')
    if (dr.measure.kind === 'quantitative') {
      if (dr.measure.targetStatus !== 'approved') throw new DomainError('The target must be approved before verification.')
      if (dr.measure.current === null) throw new DomainError('Record the observed value before verification.')
    } else if (!dr.measure.acceptanceCriteria.trim()) {
      throw new DomainError('Define acceptance criteria before verification.')
    }
    dr.verification = { evidence: c.evidence, reviewerId: x.actorId, verifiedAt: c.verifiedAt, outcome: c.outcome }
    dr.performanceStatus = c.outcome === 'achieved' ? 'verified' : 'not_achieved'
    return { summary: `Verified ${dr.code}: ${c.outcome === 'achieved' ? 'achieved' : 'not achieved'}`, target: ref('driver', dr.id) }
  },

  // ---------------- Decisions ----------------
  'decision.create': (d, c, x) => {
    const id = newId()
    const code = nextCode('DEC', d.decisions.map((dc) => dc.code), 3)
    d.decisions.push({
      id,
      code,
      question: c.question,
      context: c.context,
      status: 'framing',
      phase: c.phase,
      dueDate: c.dueDate,
      alternatives: [],
      mandatoryRequirements: [],
      factors: [],
      paramountFactorId: null,
      recommendation: null,
      approval: null,
      informalScores: {},
      history: [{ at: x.now, by: x.actorId, action: 'Created', note: '' }],
      createdBy: x.actorId,
    })
    return { summary: `Opened decision ${code}`, target: ref('decision', id), createdId: id }
  },
  'decision.update': (d, c, x) => {
    const dc = find(d.decisions, c.id, 'Decision')
    if (dc.status === 'approved') throw new DomainError('Approved decisions are locked. Reopen the decision with a rationale to change it.')
    const p = c.patch
    if (p.paramountFactorId && !(p.factors ?? dc.factors).some((f) => f.id === p.paramountFactorId)) throw new DomainError('Paramount factor not found.')
    const altIds = new Set((p.alternatives ?? dc.alternatives).map((a) => a.id))
    for (const f of p.factors ?? []) {
      if (f.driverId) find(d.drivers, f.driverId, 'Design Driver')
      if (f.leastPreferredAltId && !altIds.has(f.leastPreferredAltId)) f.leastPreferredAltId = null
      for (const k of Object.keys(f.attributes)) if (!altIds.has(k)) delete f.attributes[k]
      for (const k of Object.keys(f.advantages)) if (!altIds.has(k)) delete f.advantages[k]
    }
    const evaluationChanged = ['alternatives', 'mandatoryRequirements', 'factors', 'paramountFactorId'].some((k) => k in p)
    Object.assign(dc, p)
    if (p.factors && dc.paramountFactorId && !p.factors.some((f) => f.id === dc.paramountFactorId)) dc.paramountFactorId = null
    if (evaluationChanged && dc.status === 'recommended') {
      dc.recommendation = null
      dc.status = 'evaluating'
      dc.history.push({ at: x.now, by: x.actorId, action: 'Recommendation withdrawn', note: 'The evaluation changed after the recommendation.' })
    }
    if (evaluationChanged && dc.status === 'framing' && dc.alternatives.length >= 2) dc.status = 'evaluating'
    dc.history.push({ at: x.now, by: x.actorId, action: 'Updated', note: c.note || Object.keys(p).join(', ') })
    return { summary: `Updated decision ${dc.code}`, target: ref('decision', dc.id) }
  },
  'decision.setDrivers': (d, c, x) => {
    const dc = find(d.decisions, c.id, 'Decision')
    c.driverIds.forEach((id) => find(d.drivers, id, 'Design Driver'))
    setLinks(d, x, ref('decision', dc.id), 'driver', c.driverIds, 'addresses')
    return { summary: `Linked ${dc.code} to ${c.driverIds.length} Design Driver(s)`, target: ref('decision', dc.id) }
  },
  'decision.recommend': (d, c, x) => {
    const dc = find(d.decisions, c.id, 'Decision')
    if (dc.status === 'approved') throw new DomainError('This decision is already approved.')
    const evaluation = evaluateCba(dc)
    if (!evaluation.complete) throw new DomainError(`The Choosing by Advantages evaluation is incomplete: ${evaluation.issues.filter((i) => i.severity === 'blocking')[0]?.message}`)
    if (!evaluation.eligible[c.alternativeId]) throw new DomainError('The recommended alternative must satisfy every mandatory requirement.')
    dc.recommendation = { alternativeId: c.alternativeId, rationale: c.rationale, by: x.actorId, at: x.now }
    dc.status = 'recommended'
    const alt = dc.alternatives.find((a) => a.id === c.alternativeId)
    dc.history.push({ at: x.now, by: x.actorId, action: `Recommended ${alt?.name}`, note: c.rationale })
    return { summary: `Recommended "${alt?.name}" for ${dc.code}`, target: ref('decision', dc.id) }
  },
  'decision.approve': (d, c, x) => {
    const dc = find(d.decisions, c.id, 'Decision')
    if (dc.status !== 'recommended' || !dc.recommendation) throw new DomainError('A decision needs a recommendation before approval.')
    if (dc.recommendation.by === x.actorId) throw new DomainError('The person who recommended an alternative cannot also approve it.')
    const evaluation = evaluateCba(dc)
    if (!evaluation.eligible[c.alternativeId]) throw new DomainError('The approved alternative must satisfy every mandatory requirement.')
    if (c.alternativeId !== dc.recommendation.alternativeId && c.note.trim().length < 10) {
      throw new DomainError('Explain why the final decision differs from the recommendation.')
    }
    const alt = dc.alternatives.find((a) => a.id === c.alternativeId)
    dc.approval = { alternativeId: c.alternativeId, by: x.actorId, at: x.now, note: c.note }
    dc.status = 'approved'
    dc.history.push({ at: x.now, by: x.actorId, action: `Approved ${alt?.name}`, note: c.note })
    return { summary: `Approved decision ${dc.code}: ${alt?.name}`, target: ref('decision', dc.id) }
  },
  'decision.reopen': (d, c, x) => {
    const dc = find(d.decisions, c.id, 'Decision')
    if (dc.status !== 'approved' && dc.status !== 'recommended') throw new DomainError('Only recommended or approved decisions can be reopened.')
    dc.status = 'evaluating'
    dc.recommendation = null
    dc.approval = null
    dc.history.push({ at: x.now, by: x.actorId, action: 'Reopened', note: c.note })
    return { summary: `Reopened decision ${dc.code}`, target: ref('decision', dc.id) }
  },

  // ---------------- Collaboration ----------------
  'comment.add': (d, c, x) => {
    if (!nodeExists(d, c.target)) throw new DomainError('Comment target not found.')
    const id = newId()
    d.comments.push({ id, target: c.target, authorId: x.actorId, body: c.body, createdAt: x.now, resolved: false })
    return { summary: 'Added comment', target: c.target, createdId: id }
  },
  'comment.resolve': (d, c, x) => {
    const cm = find(d.comments, c.id, 'Comment')
    if (cm.authorId !== x.actorId && !x.has('framework.edit') && !x.has('framework.approve')) {
      throw new DomainError('Only the author or an editor can resolve this comment.')
    }
    cm.resolved = c.resolved
    return { summary: c.resolved ? 'Resolved comment' : 'Reopened comment', target: cm.target }
  },
  'suggestion.add': (d, c, x) => {
    for (const s of c.suggestions) {
      d.suggestions.push({ id: newId(), ...s, status: 'pending', createdAt: x.now, reviewedBy: null })
    }
    return { summary: `Received ${c.suggestions.length} suggestion(s) for review (${c.suggestions[0]?.provider ?? 'assistant'})` }
  },
  'suggestion.accept': (d, c, x) => {
    const s = find(d.suggestions, c.id, 'Suggestion')
    if (s.status !== 'pending') throw new DomainError('This suggestion has already been reviewed.')
    const p = s.payload as Record<string, unknown>
    let createdId: ID | undefined
    switch (s.kind) {
      case 'relationship': {
        const rel = addRelationship(d, x, p.from as NodeRef, p.to as NodeRef, p.relType as RelationshipType, {
          explanation: String(p.explanation ?? s.body),
          confidence: (p.confidence as Confidence) ?? 'low',
          origin: s.origin,
          proposedBy: 'assistant',
          accepted: true,
        })
        createdId = rel.id
        break
      }
      case 'theme': {
        x.require('theme.edit')
        createdId = handlers['theme.create'](d, { type: 'theme.create', title: String(p.title ?? s.title).slice(0, 200), summary: String(p.summary ?? s.body), criticality: 'normal', statementIds: (p.statementIds as ID[]) ?? [] }, x).createdId
        break
      }
      case 'question':
      case 'missing_requirement': {
        createdId = handlers['question.create'](d, { type: 'question.create', question: String(p.question ?? s.body).slice(0, 1000), context: s.evidence.slice(0, 20) }, x).createdId
        break
      }
      case 'principle_wording': {
        x.require('framework.edit')
        const pr = find(d.principles, String(p.principleId), 'Guiding Principle')
        assertEditable(pr.status, 'This principle')
        handlers['principle.edit'](d, { type: 'principle.edit', id: pr.id, content: { ...principleContent(pr), statement: String(p.statement) }, note: `Accepted ${s.origin} wording suggestion` }, x)
        break
      }
      case 'driver_measure': {
        if (!s.target) throw new DomainError('Suggestion has no target driver.')
        handlers['comment.add'](d, { type: 'comment.add', target: s.target, body: `Accepted suggestion for follow-up — ${s.title}: ${s.body}` }, x)
        break
      }
    }
    s.status = 'accepted'
    s.reviewedBy = x.actorId
    return { summary: `Accepted ${s.origin} suggestion: ${s.title}`, target: s.target, createdId }
  },
  'suggestion.dismiss': (d, c, x) => {
    const s = find(d.suggestions, c.id, 'Suggestion')
    s.status = 'dismissed'
    s.reviewedBy = x.actorId
    return { summary: `Dismissed suggestion: ${s.title}`, target: s.target }
  },
  'milestone.upsert': (d, c) => {
    c.milestone.driverIds.forEach((id) => find(d.drivers, id, 'Design Driver'))
    if (c.milestone.id) {
      const m = find(d.milestones, c.milestone.id, 'Milestone')
      Object.assign(m, c.milestone)
      return { summary: `Updated milestone "${m.name}"` }
    }
    const id = newId()
    d.milestones.push({ ...c.milestone, id })
    return { summary: `Added milestone "${c.milestone.name}"`, createdId: id }
  },
  'milestone.delete': (d, c) => {
    const m = find(d.milestones, c.id, 'Milestone')
    d.milestones = d.milestones.filter((x) => x.id !== m.id)
    return { summary: `Deleted milestone "${m.name}"` }
  },
}

