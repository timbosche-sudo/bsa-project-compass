import { nodePath } from './traceability'
import type { NodeType, ProjectData } from './types'

export interface SearchHit {
  type: NodeType
  id: string
  code: string
  title: string
  detail: string
  path: string
}

export function searchIndex(data: ProjectData): SearchHit[] {
  const pid = data.project.id
  const hit = (type: NodeType, id: string, code: string, title: string, detail = ''): SearchHit => ({ type, id, code, title, detail, path: nodePath(pid, { type, id }) })
  return [
    ...data.winThemes.map((w) => hit('winTheme', w.id, w.code, w.statement, w.narrative)),
    ...data.principles.map((p) => hit('principle', p.id, p.code, p.title, p.statement)),
    ...data.drivers.map((d) => hit('driver', d.id, d.code, d.title, d.description)),
    ...data.decisions.map((d) => hit('decision', d.id, d.code, d.question, d.context)),
    ...data.themes.map((t) => hit('theme', t.id, t.code, t.title, t.summary)),
    ...data.sources.map((s) => hit('source', s.id, s.code, s.title, `${s.author} ${s.organization}`)),
    ...data.statements.map((s) => hit('statement', s.id, s.code, s.originalText, s.interpretation)),
    ...data.opportunities.map((o) => hit('opportunity', o.id, o.code, o.title, o.description)),
    ...data.outcomes.map((o) => hit('outcome', o.id, o.code, o.statement, o.possibleMeasures)),
  ]
}

export function search(index: SearchHit[], query: string, limit = 30): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const scored = index
    .map((h) => {
      const hay = `${h.code} ${h.title} ${h.detail}`.toLowerCase()
      if (!tokens.every((t) => hay.includes(t))) return null
      const score = (h.code.toLowerCase() === query.toLowerCase() ? 100 : 0) + tokens.filter((t) => `${h.code} ${h.title}`.toLowerCase().includes(t)).length * 10
      return { h, score }
    })
    .filter((x): x is { h: SearchHit; score: number } => x !== null)
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.h)
}
