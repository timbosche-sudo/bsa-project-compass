import { driverPrincipleIds } from '@/domain/drivers'
import { accepted, gapReport, themeStatementIds } from '@/domain/traceability'
import type { ProjectData, Statement } from '@/domain/types'
import type { AssistProvider, AssistTask, SuggestionOutput } from './types'

/**
 * Deterministic, offline heuristics. No language model and no network.
 * Every suggestion carries the statement references it is based on, or is
 * explicitly framed as a question. Nothing is applied without human review.
 */
const STOP = new Set(
  'a an and are as at be by for from has have in is it its of on or our that the their this to we with without will shall must should can not no all any every each into than then so very more most less just about must need needs want also what where when how who why which there here these those been being per'.split(' '),
)

export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/(ing|ed|es|s)$/, ''))
      .filter((w) => w.length > 3 && !STOP.has(w)),
  )
}

function overlap(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => b.has(x))
}

export class RulesProvider implements AssistProvider {
  readonly id = 'rules-v1'
  readonly label = 'Rule-based assistant (no AI model)'
  readonly origin = 'rules' as const

  async run(task: AssistTask, data: ProjectData): Promise<SuggestionOutput[]> {
    switch (task) {
      case 'suggest_relationships':
        return this.relationships(data)
      case 'suggest_themes':
        return this.themes(data)
      case 'find_missing_requirements':
        return this.missingRequirements(data)
      case 'validation_questions':
        return this.validationQuestions(data)
    }
  }

  private unthemed(data: ProjectData): Statement[] {
    const themed = new Set(data.relationships.filter((r) => r.status !== 'rejected' && r.from.type === 'statement' && r.to.type === 'theme').map((r) => r.from.id))
    return data.statements.filter((s) => !themed.has(s.id))
  }

  private relationships(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    const themes = data.themes.filter((t) => t.status !== 'archived')
    const pending = new Set(data.relationships.filter((r) => r.status === 'proposed').map((r) => `${r.from.id}>${r.to.id}`))
    for (const s of this.unthemed(data)) {
      const kw = keywords(s.originalText + ' ' + s.interpretation)
      let best: { id: string; code: string; title: string; shared: string[] } | null = null
      for (const t of themes) {
        const tkw = keywords([t.title, t.summary, ...themeStatementIds(data, t.id).map((id) => data.statements.find((x) => x.id === id)?.originalText ?? '')].join(' '))
        const shared = overlap(kw, tkw)
        if (shared.length >= 1 && (!best || shared.length > best.shared.length)) best = { id: t.id, code: t.code, title: t.title, shared }
      }
      if (best && !pending.has(`${s.id}>${best.id}`)) {
        out.push({
          kind: 'relationship',
          title: `${s.code} may support ${best.code} “${best.title}”`,
          body: `Shared terms: ${best.shared.slice(0, 5).join(', ')}. Term overlap is weak evidence — confirm the meaning before accepting.`,
          evidence: [{ type: 'statement', id: s.id }],
          target: { type: 'theme', id: best.id },
          payload: { from: { type: 'statement', id: s.id }, to: { type: 'theme', id: best.id }, relType: 'supports', explanation: `Suggested from shared terms: ${best.shared.slice(0, 5).join(', ')}`, confidence: best.shared.length >= 3 ? 'medium' : 'low' },
        })
      }
    }
    return out
  }

  private themes(data: ProjectData): SuggestionOutput[] {
    const pool = this.unthemed(data)
    const used = new Set<string>()
    const out: SuggestionOutput[] = []
    for (const s of pool) {
      if (used.has(s.id)) continue
      const kw = keywords(s.originalText)
      const group = pool.filter((o) => o.id !== s.id && !used.has(o.id) && overlap(kw, keywords(o.originalText)).length >= 1)
      if (group.length === 0) continue
      const members = [s, ...group]
      members.forEach((m) => used.add(m.id))
      const counts = new Map<string, number>()
      members.forEach((m) => keywords(m.originalText).forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1)))
      const top = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
      out.push({
        kind: 'theme',
        title: `Candidate theme: ${top.join(' / ') || 'related statements'}`,
        body: `Proposal only — ${members.length} unthemed statements share terms (${top.join(', ')}). Rename and confirm before use.`,
        evidence: members.map((m) => ({ type: 'statement' as const, id: m.id })),
        target: null,
        payload: { title: `Proposed: ${top.join(' / ') || 'related statements'}`, summary: 'Proposed grouping awaiting team review.', statementIds: members.map((m) => m.id) },
      })
    }
    return out
  }

  private missingRequirements(data: ProjectData): SuggestionOutput[] {
    const gaps = gapReport(data)
    const open = new Set(data.questions.filter((q) => q.status === 'open').flatMap((q) => q.context.map((c) => c.id)))
    return gaps.requirementsNotInFramework
      .filter((s) => !open.has(s.id))
      .map((s) => ({
        kind: 'missing_requirement' as const,
        title: `${s.code} is a ${s.kind === 'nonnegotiable' ? 'non-negotiable ' : ''}requirement not reflected in the framework`,
        body: `“${s.originalText.slice(0, 240)}” is not linked to any theme, principle or driver.`,
        evidence: [{ type: 'statement' as const, id: s.id }],
        target: null,
        payload: { question: `How should ${s.code} (“${s.originalText.slice(0, 160)}”) be addressed in the guiding principles and Design Drivers?` },
      }))
  }

  private validationQuestions(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    const rels = accepted(data)
    for (const d of data.drivers.filter((x) => x.approvalStatus !== 'superseded')) {
      const ref = { type: 'driver' as const, id: d.id }
      if (d.measure.kind === 'quantitative' && d.measure.target === null) {
        out.push({ kind: 'question', title: `${d.code}: no target set`, body: 'Ask the accountable owner for an evidence-based target. Do not adopt a number without a source.', evidence: [ref], target: ref, payload: { question: `What target should ${d.code} “${d.title}” meet, and what source supports it?` } })
      }
      if (d.measure.kind === 'quantitative' && d.measure.baseline === null) {
        out.push({ kind: 'driver_measure', title: `${d.code}: baseline unknown`, body: 'Identify how a baseline could be measured (existing operations data, comparable facility, or design model).', evidence: [ref], target: ref, payload: {} })
      }
      if (!d.ownerPersonId) {
        out.push({ kind: 'question', title: `${d.code}: no accountable owner`, body: 'Every driver needs a named owner.', evidence: [ref], target: ref, payload: { question: `Who is accountable for ${d.code} “${d.title}”?` } })
      }
      if (driverPrincipleIds(data, d.id).length === 0) {
        out.push({ kind: 'question', title: `${d.code}: not linked to a principle`, body: 'Drivers should implement at least one guiding principle.', evidence: [ref], target: ref, payload: { question: `Which guiding principle does ${d.code} serve?` } })
      }
    }
    for (const c of rels.filter((r) => r.type === 'conflicts_with')) {
      out.push({ kind: 'question', title: 'Unresolved conflict', body: c.explanation || 'Conflicting statements need an explicit resolution.', evidence: [c.from, c.to], target: null, payload: { question: `How should the conflict be resolved? ${c.explanation}`.trim() } })
    }
    const asked = new Set(data.questions.map((q) => q.question))
    return out.filter((s) => !asked.has(String(s.payload.question ?? '')))
  }
}
