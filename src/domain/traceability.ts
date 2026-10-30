import type { ID, NodeRef, NodeType, ProjectData, Relationship, Statement } from './types'
import { isActiveFramework } from './wording'

export const refKey = (r: NodeRef) => `${r.type}:${r.id}`
export const sameRef = (a: NodeRef, b: NodeRef) => a.type === b.type && a.id === b.id

export function accepted(data: ProjectData): Relationship[] {
  return data.relationships.filter((r) => r.status === 'accepted')
}

/** Human-readable code + title for any node. */
export function nodeLabel(data: ProjectData, ref: NodeRef): { code: string; title: string } {
  switch (ref.type) {
    case 'source': {
      const s = data.sources.find((x) => x.id === ref.id)
      return { code: s?.code ?? '?', title: s?.title ?? 'Missing source' }
    }
    case 'statement': {
      const s = data.statements.find((x) => x.id === ref.id)
      return { code: s?.code ?? '?', title: s?.originalText ?? 'Missing statement' }
    }
    case 'theme': {
      const t = data.themes.find((x) => x.id === ref.id)
      return { code: t?.code ?? '?', title: t?.title ?? 'Missing theme' }
    }
    case 'winTheme': {
      const w = data.winThemes.find((x) => x.id === ref.id)
      return { code: w?.code ?? '?', title: w?.statement ?? 'Missing Win Theme' }
    }
    case 'principle': {
      const p = data.principles.find((x) => x.id === ref.id)
      return { code: p?.code ?? '?', title: p?.title ?? 'Missing principle' }
    }
    case 'driver': {
      const d = data.drivers.find((x) => x.id === ref.id)
      return { code: d?.code ?? '?', title: d?.title ?? 'Missing driver' }
    }
    case 'decision': {
      const d = data.decisions.find((x) => x.id === ref.id)
      return { code: d?.code ?? '?', title: d?.question ?? 'Missing decision' }
    }
  }
}

export function nodeExists(data: ProjectData, ref: NodeRef): boolean {
  const pools: Record<NodeType, { id: ID }[]> = {
    source: data.sources,
    statement: data.statements,
    theme: data.themes,
    winTheme: data.winThemes,
    principle: data.principles,
    driver: data.drivers,
    decision: data.decisions,
  }
  return pools[ref.type].some((x) => x.id === ref.id)
}

export function nodePath(projectId: ID, ref: NodeRef): string {
  const base = `/projects/${projectId}`
  switch (ref.type) {
    case 'source':
      return `${base}/intelligence/${ref.id}`
    case 'statement':
      return `${base}/intelligence/statement/${ref.id}`
    case 'theme':
      return `${base}/alignment?theme=${ref.id}`
    case 'winTheme':
      return `${base}/vision?winTheme=${ref.id}`
    case 'principle':
      return `${base}/vision?principle=${ref.id}`
    case 'driver':
      return `${base}/drivers/${ref.id}`
    case 'decision':
      return `${base}/decisions/${ref.id}`
  }
}

// ---------------------------------------------------------------------------
// Evidence resolution
// ---------------------------------------------------------------------------

function idsLinked(rels: Relationship[], fromType: NodeType, toType: NodeType, toId: ID, types?: Relationship['type'][]) {
  return rels
    .filter((r) => r.from.type === fromType && r.to.type === toType && r.to.id === toId && (!types || types.includes(r.type)))
    .map((r) => r.from.id)
}

export function themeStatementIds(data: ProjectData, themeId: ID, includeProposed = false): ID[] {
  const rels = includeProposed ? data.relationships.filter((r) => r.status !== 'rejected') : accepted(data)
  return idsLinked(rels, 'statement', 'theme', themeId, ['supports'])
}

export function principleThemeIds(data: ProjectData, principleId: ID): ID[] {
  return idsLinked(accepted(data), 'theme', 'principle', principleId, ['informs', 'supports'])
}

export interface EvidenceSet {
  direct: Statement[]
  viaThemes: Statement[]
  inherited: Statement[]
  all: Statement[]
}

function uniqStatements(data: ProjectData, ids: ID[]): Statement[] {
  const set = new Set(ids)
  return data.statements.filter((s) => set.has(s.id))
}

/** Statements that evidence a node, distinguishing direct and derived links. */
export function evidenceFor(data: ProjectData, ref: NodeRef): EvidenceSet {
  const rels = accepted(data)
  const direct = idsLinked(rels, 'statement', ref.type, ref.id, ['supports'])
  let viaThemes: ID[] = []
  let inherited: ID[] = []
  if (ref.type === 'principle' || ref.type === 'winTheme') {
    const themeIds = idsLinked(rels, 'theme', ref.type, ref.id)
    viaThemes = themeIds.flatMap((t) => idsLinked(rels, 'statement', 'theme', t, ['supports']))
  }
  if (ref.type === 'driver') {
    const principleIds = rels
      .filter((r) => r.type === 'implements' && r.from.type === 'driver' && r.from.id === ref.id && r.to.type === 'principle')
      .map((r) => r.to.id)
    inherited = principleIds.flatMap((p) => {
      const e = evidenceFor(data, { type: 'principle', id: p })
      return [...e.direct, ...e.viaThemes].map((s) => s.id)
    })
  }
  const all = [...new Set([...direct, ...viaThemes, ...inherited])]
  return {
    direct: uniqStatements(data, direct),
    viaThemes: uniqStatements(data, viaThemes.filter((x) => !direct.includes(x))),
    inherited: uniqStatements(data, inherited.filter((x) => !direct.includes(x) && !viaThemes.includes(x))),
    all: uniqStatements(data, all),
  }
}

const OWNER_SOURCE_TYPES = new Set(['owner_rfp', 'mission_statement', 'approved_decision', 'regulation'])
const WORKSHOP_SOURCE_TYPES = new Set(['workshop_notes', 'photograph', 'meeting_summary'])

export function isOwnerEvidence(data: ProjectData, s: Statement): boolean {
  const src = data.sources.find((x) => x.id === s.sourceId)
  return (!!src && OWNER_SOURCE_TYPES.has(src.type)) || s.kind === 'requirement' || s.kind === 'nonnegotiable'
}

export function isWorkshopEvidence(data: ProjectData, s: Statement): boolean {
  const src = data.sources.find((x) => x.id === s.sourceId)
  return !!src && WORKSHOP_SOURCE_TYPES.has(src.type)
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

export interface GapReport {
  orphanStatements: Statement[]
  unsupportedPrinciples: ID[]
  driversWithoutPrinciple: ID[]
  driversWithoutEvidence: ID[]
  themesWithoutOwnerSupport: ID[]
  requirementsNotInFramework: Statement[]
  requirementsNotRaisedInWorkshops: Statement[]
  conflicts: Relationship[]
  pendingRelationships: Relationship[]
}

export function gapReport(data: ProjectData): GapReport {
  const rels = accepted(data)
  const linkedStatementIds = new Set(rels.filter((r) => r.from.type === 'statement').map((r) => r.from.id))
  rels.filter((r) => r.to.type === 'statement').forEach((r) => linkedStatementIds.add(r.to.id))

  const activePrinciples = data.principles.filter((p) => isActiveFramework(p.status))
  const activeDrivers = data.drivers.filter((d) => d.approvalStatus !== 'superseded')
  const activeThemes = data.themes.filter((t) => t.status !== 'archived')

  const unsupportedPrinciples = activePrinciples.filter((p) => evidenceFor(data, { type: 'principle', id: p.id }).all.length === 0).map((p) => p.id)

  const driversWithoutPrinciple = activeDrivers
    .filter((d) => !rels.some((r) => r.type === 'implements' && r.from.type === 'driver' && r.from.id === d.id))
    .map((d) => d.id)
  const driversWithoutEvidence = activeDrivers.filter((d) => evidenceFor(data, { type: 'driver', id: d.id }).all.length === 0).map((d) => d.id)

  const themesWithoutOwnerSupport = activeThemes
    .filter((t) => {
      const st = uniqStatements(data, themeStatementIds(data, t.id))
      return st.length > 0 && !st.some((s) => isOwnerEvidence(data, s))
    })
    .map((t) => t.id)

  const requirements = data.statements.filter((s) => s.kind === 'requirement' || s.kind === 'nonnegotiable')
  const requirementsNotInFramework = requirements.filter((s) => !linkedStatementIds.has(s.id))

  const requirementsNotRaisedInWorkshops = requirements.filter((s) => {
    if (isWorkshopEvidence(data, s)) return false
    const themes = rels.filter((r) => r.from.type === 'statement' && r.from.id === s.id && r.to.type === 'theme').map((r) => r.to.id)
    if (themes.length === 0) return true
    return !themes.some((t) => uniqStatements(data, themeStatementIds(data, t)).some((x) => isWorkshopEvidence(data, x)))
  })

  return {
    orphanStatements: data.statements.filter((s) => !linkedStatementIds.has(s.id)),
    unsupportedPrinciples,
    driversWithoutPrinciple,
    driversWithoutEvidence,
    themesWithoutOwnerSupport,
    requirementsNotInFramework,
    requirementsNotRaisedInWorkshops,
    conflicts: rels.filter((r) => r.type === 'conflicts_with'),
    pendingRelationships: data.relationships.filter((r) => r.status === 'proposed'),
  }
}

// ---------------------------------------------------------------------------
// Traceability matrix (one row per statement)
// ---------------------------------------------------------------------------

export interface TraceRow {
  statementId: ID
  statementCode: string
  statementText: string
  kind: Statement['kind']
  criticality: Statement['criticality']
  transcription: Statement['transcriptionStatus']
  sourceId: ID
  sourceCode: string
  sourceTitle: string
  sourceType: string
  locator: string
  themes: { id: ID; code: string; title: string }[]
  principles: { id: ID; code: string; title: string; via: 'direct' | 'theme' }[]
  drivers: { id: ID; code: string; title: string; via: 'direct' | 'principle' }[]
  decisions: { id: ID; code: string; title: string }[]
  relationships: Relationship[]
}

export function traceRows(data: ProjectData): TraceRow[] {
  const rels = accepted(data)
  const label = (type: NodeType, id: ID) => ({ id, ...nodeLabel(data, { type, id }) })
  return data.statements.map((s) => {
    const src = data.sources.find((x) => x.id === s.sourceId)
    const out = rels.filter((r) => r.from.type === 'statement' && r.from.id === s.id)
    const themeIds = out.filter((r) => r.to.type === 'theme').map((r) => r.to.id)
    const directPrinciples = out.filter((r) => r.to.type === 'principle').map((r) => r.to.id)
    const themePrinciples = rels
      .filter((r) => r.from.type === 'theme' && themeIds.includes(r.from.id) && r.to.type === 'principle')
      .map((r) => r.to.id)
      .filter((p) => !directPrinciples.includes(p))
    const principleIds = [...new Set([...directPrinciples, ...themePrinciples])]
    const directDrivers = out.filter((r) => r.to.type === 'driver').map((r) => r.to.id)
    const principleDrivers = rels
      .filter((r) => r.type === 'implements' && r.from.type === 'driver' && r.to.type === 'principle' && principleIds.includes(r.to.id))
      .map((r) => r.from.id)
      .filter((d) => !directDrivers.includes(d))
    const driverIds = [...new Set([...directDrivers, ...principleDrivers])]
    const decisionIds = [
      ...new Set(rels.filter((r) => r.type === 'addresses' && r.from.type === 'decision' && driverIds.includes(r.to.id)).map((r) => r.from.id)),
    ]
    return {
      statementId: s.id,
      statementCode: s.code,
      statementText: s.originalText,
      kind: s.kind,
      criticality: s.criticality,
      transcription: s.transcriptionStatus,
      sourceId: s.sourceId,
      sourceCode: src?.code ?? '?',
      sourceTitle: src?.title ?? 'Missing source',
      sourceType: src?.type ?? '',
      locator: s.locator.kind === 'none' ? '' : `${s.locator.kind} ${s.locator.value}`,
      themes: [...new Set(themeIds)].map((id) => label('theme', id)),
      principles: [
        ...[...new Set(directPrinciples)].map((id) => ({ ...label('principle', id), via: 'direct' as const })),
        ...[...new Set(themePrinciples)].map((id) => ({ ...label('principle', id), via: 'theme' as const })),
      ],
      drivers: [
        ...[...new Set(directDrivers)].map((id) => ({ ...label('driver', id), via: 'direct' as const })),
        ...[...new Set(principleDrivers)].map((id) => ({ ...label('driver', id), via: 'principle' as const })),
      ],
      decisions: decisionIds.map((id) => label('decision', id)),
      relationships: data.relationships.filter((r) => (r.from.type === 'statement' && r.from.id === s.id) || (r.to.type === 'statement' && r.to.id === s.id)),
    }
  })
}

// ---------------------------------------------------------------------------
// Relationship graph (Source → Statement → Theme → Principle → Driver → Decision)
// ---------------------------------------------------------------------------

export const GRAPH_COLUMNS: NodeType[] = ['source', 'statement', 'theme', 'principle', 'driver', 'decision']

export interface GraphNode {
  key: string
  ref: NodeRef
  column: number
  code: string
  title: string
  flags: { orphan?: boolean; unsupported?: boolean; critical?: boolean; status?: string }
}
export interface GraphEdge {
  key: string
  from: string
  to: string
  type: Relationship['type'] | 'contains'
  status: Relationship['status']
  relationshipId: ID | null
}
export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function buildGraph(data: ProjectData, opts: { includeProposed?: boolean } = {}): Graph {
  const gaps = gapReport(data)
  const orphanIds = new Set(gaps.orphanStatements.map((s) => s.id))
  const unsupported = new Set([...gaps.unsupportedPrinciples, ...gaps.driversWithoutEvidence, ...gaps.driversWithoutPrinciple])
  const nodes: GraphNode[] = []
  const add = (ref: NodeRef, flags: GraphNode['flags'] = {}) => {
    const { code, title } = nodeLabel(data, ref)
    nodes.push({ key: refKey(ref), ref, column: GRAPH_COLUMNS.indexOf(ref.type), code, title, flags })
  }
  data.sources.forEach((s) => add({ type: 'source', id: s.id }))
  data.statements.forEach((s) => add({ type: 'statement', id: s.id }, { orphan: orphanIds.has(s.id), critical: s.criticality === 'critical' || s.kind === 'nonnegotiable' }))
  data.themes.filter((t) => t.status !== 'archived').forEach((t) => add({ type: 'theme', id: t.id }, { status: t.status }))
  data.principles.filter((p) => isActiveFramework(p.status)).forEach((p) => add({ type: 'principle', id: p.id }, { unsupported: unsupported.has(p.id), status: p.status }))
  data.drivers.filter((d) => d.approvalStatus !== 'superseded').forEach((d) => add({ type: 'driver', id: d.id }, { unsupported: unsupported.has(d.id), status: d.approvalStatus }))
  data.decisions.forEach((d) => add({ type: 'decision', id: d.id }, { status: d.status }))

  const present = new Set(nodes.map((n) => n.key))
  const edges: GraphEdge[] = []
  data.statements.forEach((s) => {
    const from = refKey({ type: 'source', id: s.sourceId })
    const to = refKey({ type: 'statement', id: s.id })
    if (present.has(from)) edges.push({ key: `c:${s.id}`, from, to, type: 'contains', status: 'accepted', relationshipId: null })
  })
  for (const r of data.relationships) {
    if (r.status === 'rejected' || (r.status === 'proposed' && !opts.includeProposed)) continue
    let a = refKey(r.from)
    let b = refKey(r.to)
    if (!present.has(a) || !present.has(b)) continue
    // Normalize direction so edges flow left-to-right through the columns.
    if (GRAPH_COLUMNS.indexOf(r.from.type) > GRAPH_COLUMNS.indexOf(r.to.type)) [a, b] = [b, a]
    edges.push({ key: r.id, from: a, to: b, type: r.type, status: r.status, relationshipId: r.id })
  }
  return { nodes, edges }
}

/** Upstream and downstream chain of a node (direction-aware BFS). */
export function focusSet(graph: Graph, key: string): Set<string> {
  const result = new Set([key])
  const walk = (dir: 'up' | 'down') => {
    const queue = [key]
    while (queue.length) {
      const k = queue.shift()!
      for (const e of graph.edges) {
        if (e.type === 'conflicts_with') continue
        const next = dir === 'down' ? (e.from === k ? e.to : null) : e.to === k ? e.from : null
        if (next && !result.has(next)) {
          result.add(next)
          queue.push(next)
        }
      }
    }
  }
  walk('up')
  walk('down')
  return result
}
