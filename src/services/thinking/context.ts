import { nodeLabel } from '@/domain/traceability'
import type { NodeRef, ProjectData, ThinkingMode } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'
import { classify, EVIDENCE_CLASS_LABELS } from './evidence'

/** The places the Thinking Partner can work. Each prioritizes different questions. */
export const WORKSPACES = {
  'understand/evidence': { label: 'Evidence', stage: 'Understand', priorities: 'source completeness, attribution, evidence gaps and unsupported assumptions' },
  'understand/themes': { label: 'Themes', stage: 'Understand', priorities: 'relationships, overlaps, competing perspectives and emerging patterns' },
  'understand/questions': { label: 'Critical Questions', stage: 'Understand', priorities: 'strategic tensions, missing information and questions worth exploring' },
  'understand/heard': { label: 'What We Heard', stage: 'Understand', priorities: 'clarity, completeness, balance and faithfulness to evidence' },
  'interpret/point-of-view': { label: 'Point of View', stage: 'Interpret', priorities: 'the central ambition, the strategic opportunity and the strength of the interpretation' },
  'interpret/vision': { label: 'Vision', stage: 'Interpret', priorities: 'distinctiveness, memorability, fit with the Owner’s aspirations and alternative narratives' },
  'interpret/principles': { label: 'Guiding Principles', stage: 'Interpret', priorities: 'clarity, overlap, strategic relevance and design applicability' },
  'interpret/opportunities': { label: 'Design Opportunities', stage: 'Interpret', priorities: 'non-prescriptive design possibilities and their relationship to principles' },
  'interpret/success': { label: 'What Success Could Look Like', stage: 'Interpret', priorities: 'qualitative and quantitative outcomes, without inventing targets' },
  project: { label: 'Whole project', stage: 'Project', priorities: 'the most significant observations across the project' },
} as const
export type Workspace = keyof typeof WORKSPACES

export function workspaceFromPath(pathname: string): Workspace {
  const m = pathname.match(/\/projects\/[^/]+\/((understand|interpret)\/[a-z-]+)/)
  const w = m?.[1] as Workspace | undefined
  return w && w in WORKSPACES ? w : 'project'
}

/** The item selected on the current page, from the URL. */
export function focusFromLocation(pathname: string, search: string): NodeRef | null {
  const q = new URLSearchParams(search)
  const pairs: [string, NodeRef['type']][] = [
    ['principle', 'principle'],
    ['theme', 'theme'],
    ['opportunity', 'opportunity'],
    ['outcome', 'outcome'],
    ['winTheme', 'winTheme'],
    ['statement', 'statement'],
  ]
  for (const [param, type] of pairs) {
    const id = q.get(param)
    if (id) return { type, id }
  }
  const src = pathname.match(/\/understand\/evidence\/(?!statement\/)([^/?]+)/)
  if (src) return { type: 'source', id: src[1] }
  return null
}

export const MODE_LABELS: Record<ThinkingMode, { label: string; question: string }> = {
  explore: { label: 'Explore', question: 'What might we be missing?' },
  challenge: { label: 'Challenge', question: 'What should we question?' },
  develop: { label: 'Develop', question: 'What could this become?' },
  refine: { label: 'Refine', question: 'How could we make it stronger?' },
}

/**
 * Project Context Builder: a structured, serializable view of what is being
 * analyzed. The rules engine reads project data directly; this is what the
 * interface shows ("what is being analyzed") and what a future server-side
 * model would receive after confidentiality filtering.
 */
export interface ProjectContext {
  project: { name: string; sector: string; phase: string; owner: string }
  workspace: { id: Workspace; label: string; priorities: string }
  mode: ThinkingMode
  focus: { ref: NodeRef; code: string; title: string } | null
  statements: { id: string; code: string; text: string; speaker: string; evidenceClass: string; criticality: string }[]
  themes: { id: string; code: string; title: string; summary: string }[]
  heard: { id: string; section: string; title: string; narrative: string; reviewed: boolean }[]
  pointOfView: { centralAmbition: string; opportunity: string; tensions: string } | null
  vision: { id: string; code: string; statement: string; narrative: string; status: string }[]
  principles: { id: string; code: string; title: string; statement: string; whyItMatters: string; status: string }[]
  opportunities: { id: string; code: string; title: string; description: string; principleIds: string[] }[]
  outcomes: { id: string; code: string; statement: string; principleId: string; category: string; state: string }[]
}

export function buildProjectContext(data: ProjectData, workspace: Workspace, mode: ThinkingMode, focus: NodeRef | null): ProjectContext {
  const w = WORKSPACES[workspace]
  const f = focus ? nodeLabel(data, focus) : null
  return {
    project: { name: data.project.name, sector: data.project.sector, phase: data.project.phase, owner: data.project.owner.name },
    workspace: { id: workspace, label: w.label, priorities: w.priorities },
    mode,
    focus: focus && f ? { ref: focus, code: f.code, title: f.title } : null,
    statements: data.statements.map((s) => ({ id: s.id, code: s.code, text: s.originalText, speaker: s.speaker, evidenceClass: EVIDENCE_CLASS_LABELS[classify(data, s)], criticality: s.criticality })),
    themes: data.themes.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, code: t.code, title: t.title, summary: t.summary })),
    heard: data.heard.map((h) => ({ id: h.id, section: h.section, title: h.title, narrative: h.narrative, reviewed: h.reviewed })),
    pointOfView: data.pointOfView ? { centralAmbition: data.pointOfView.centralAmbition, opportunity: data.pointOfView.opportunity, tensions: data.pointOfView.tensions } : null,
    vision: data.winThemes.filter((x) => isActiveFramework(x.status)).map((x) => ({ id: x.id, code: x.code, statement: x.statement, narrative: x.narrative, status: x.status })),
    principles: data.principles.filter((x) => isActiveFramework(x.status)).map((x) => ({ id: x.id, code: x.code, title: x.title, statement: x.statement, whyItMatters: x.whyItMatters ?? '', status: x.status })),
    opportunities: data.opportunities.map((o) => ({ id: o.id, code: o.code, title: o.title, description: o.description, principleIds: o.principleIds })),
    outcomes: data.outcomes.map((o) => ({ id: o.id, code: o.code, statement: o.statement, principleId: o.principleId, category: o.category, state: o.state })),
  }
}

/** Plain-language statement of what an analysis will read. */
export function describeScope(ctx: ProjectContext): string {
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`
  const counts: Record<Workspace, string> = {
    'understand/evidence': `${n(ctx.statements.length, 'statement')} and their sources`,
    'understand/themes': `${n(ctx.themes.length, 'theme')} and ${n(ctx.statements.length, 'statement')}`,
    'understand/questions': `${n(ctx.statements.length, 'statement')}, recorded tensions and open questions`,
    'understand/heard': `${n(ctx.heard.length, 'What We Heard item')} and their evidence`,
    'interpret/point-of-view': `the point of view, ${n(ctx.themes.length, 'theme')} and What We Heard`,
    'interpret/vision': `${n(ctx.vision.length, 'vision alternative')} and the point of view`,
    'interpret/principles': `${n(ctx.principles.length, 'principle')} and their evidence`,
    'interpret/opportunities': `${n(ctx.opportunities.length, 'opportunity', 'opportunities')} and ${n(ctx.principles.length, 'principle')}`,
    'interpret/success': `${n(ctx.outcomes.length, 'potential outcome')} and ${n(ctx.principles.length, 'principle')}`,
    project: 'the whole project',
  }
  return ctx.focus ? `${ctx.focus.code} ${ctx.focus.title}` : counts[ctx.workspace.id]
}
