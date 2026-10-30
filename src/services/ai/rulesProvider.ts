import { driverPrincipleIds } from '@/domain/drivers'
import { CATEGORY_LABELS } from '@/domain/labels'
import { accepted, evidenceFor, gapReport, themeStatementIds } from '@/domain/traceability'
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

/** Expected perspectives for a facility project. A missing perspective is a prompt to ask, not a finding. */
const PERSPECTIVES: { label: string; pattern: RegExp }[] = [
  { label: 'Patients, families or caregivers', pattern: /\b(patient|caregiver|family|families|visitor)s?\b/i },
  { label: 'Community partners or neighbors', pattern: /\b(community|neighbou?r|partner|civic)s?\b/i },
  { label: 'Frontline staff', pattern: /\b(technician|staff|nurse|pharmacist|operator|worker|frontline|shift)s?\b/i },
  { label: 'Executive leadership', pattern: /\b(chief|vp|executive|leadership|president|board)\b/i },
  { label: 'Facilities, operations and maintenance', pattern: /\b(facilit|maintenance|engineer|operations)/i },
]

/** Phrases that tend to name a solution (an object or intervention) rather than the need behind it. */
const SOLUTION_LANGUAGE = /\b(we need|we want|give us|there should be|should have|add|install|put in|build)\s+(a|an|more|another|the|some|bigger|separate)\s+([a-z-]+(?:\s+[a-z-]+)?)/i

function dedupe(data: ProjectData, out: SuggestionOutput[]): SuggestionOutput[] {
  const seen = new Set([
    ...data.questions.map((q) => q.question),
    ...data.suggestions.filter((s) => s.status === 'pending').map((s) => s.title),
  ])
  return out.filter((s) => !seen.has(String(s.payload.question ?? '')) && !seen.has(s.title))
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
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
      case 'critical_questions':
        return dedupe(data, [...this.tensions(data), ...this.missingPerspectives(data), ...this.solutionsVsNeeds(data)])
      case 'principle_quality':
        return dedupe(data, this.principleQuality(data))
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

  /** Conflicts already recorded, and critical statements that may be under-weighted because they are rarely mentioned. */
  private tensions(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    const asked = new Set(data.questions.filter((q) => q.status === 'open').flatMap((q) => q.context.map((c) => c.id)))
    const code = (id: string) => data.statements.find((s) => s.id === id)?.code ?? id
    for (const c of data.relationships.filter((r) => r.type === 'conflicts_with' && r.status !== 'rejected')) {
      if (asked.has(c.from.id) && asked.has(c.to.id)) continue
      out.push({
        kind: 'tension',
        title: `Tension between ${code(c.from.id)} and ${code(c.to.id)}`,
        body: `${c.explanation || 'These statements pull in different directions.'} Make the trade-off explicit with the Owner rather than resolving it silently.`,
        evidence: [c.from, c.to],
        target: null,
        payload: { question: `How should the tension between ${code(c.from.id)} and ${code(c.to.id)} be resolved?` },
      })
    }
    const mentions = new Map<string, number>()
    for (const r of data.relationships.filter((x) => x.status !== 'rejected' && x.from.type === 'statement' && x.to.type === 'theme')) {
      const n = themeStatementIds(data, r.to.id).length
      mentions.set(r.from.id, Math.max(mentions.get(r.from.id) ?? 0, n))
    }
    for (const s of data.statements.filter((x) => x.criticality === 'critical' || x.kind === 'nonnegotiable')) {
      const n = mentions.get(s.id) ?? 0
      if (n > 1 || asked.has(s.id)) continue
      out.push({
        kind: 'tension',
        title: `${s.code} is critical but rarely mentioned`,
        body: `“${s.originalText.slice(0, 200)}” is marked ${s.kind === 'nonnegotiable' ? 'non-negotiable' : 'critical'} but ${n === 0 ? 'sits in no theme' : 'is the only statement in its theme'}. Frequency is not importance — confirm it carries the right weight.`,
        evidence: [{ type: 'statement', id: s.id }],
        target: null,
        payload: { question: `Is ${s.code} given enough weight in the vision and principles, given how rarely it is mentioned?` },
      })
    }
    return out
  }

  private missingPerspectives(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    const voices = data.statements.map((s) => s.speaker)
    for (const p of PERSPECTIVES) {
      if (voices.some((v) => p.pattern.test(v))) continue
      out.push({
        kind: 'missing_perspective',
        title: `No statements attributed to: ${p.label}`,
        body: 'This may be appropriate for the project, or it may be a gap. Silence is not agreement — consider whether to seek this perspective before presenting.',
        evidence: [],
        target: null,
        payload: { question: `Should we seek input from ${p.label.toLowerCase()} before the next Owner conversation?` },
      })
    }
    const bySpeaker = new Map<string, string[]>()
    data.statements.forEach((s) => bySpeaker.set(s.speaker || 'Unattributed', [...(bySpeaker.get(s.speaker || 'Unattributed') ?? []), s.id]))
    const total = data.statements.length
    for (const [speaker, ids] of bySpeaker) {
      if (total >= 8 && ids.length / total > 0.4) {
        out.push({
          kind: 'missing_perspective',
          title: `One voice dominates the evidence: ${speaker}`,
          body: `${ids.length} of ${total} statements come from a single attribution. Check that the direction is not shaped by one perspective.`,
          evidence: ids.slice(0, 20).map((id) => ({ type: 'statement' as const, id })),
          target: null,
          payload: { question: `Are we over-relying on ${speaker}? Whose view would balance it?` },
        })
      }
    }
    return out
  }

  private solutionsVsNeeds(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    for (const s of data.statements) {
      const m = SOLUTION_LANGUAGE.exec(s.originalText)
      if (!m) continue
      const thing = `${m[2]} ${m[3]}`.toLowerCase()
      out.push({
        kind: 'solution_vs_need',
        title: `${s.code} may describe a solution (“${thing}”)`,
        body: `“${s.originalText.slice(0, 200)}” names a specific answer. Ask what need it serves — other design responses may meet the need better.`,
        evidence: [{ type: 'statement', id: s.id }],
        target: null,
        payload: { question: `What underlying need is behind ${s.code} (“${thing}”)?` },
      })
    }
    return out
  }

  private principleQuality(data: ProjectData): SuggestionOutput[] {
    const out: SuggestionOutput[] = []
    const live = data.principles.filter((p) => p.status !== 'superseded' && p.status !== 'not_adopted')
    const kw = new Map(live.map((p) => [p.id, keywords(`${p.title} ${p.statement}`)]))
    const q = (title: string, body: string, ids: string[], question: string): SuggestionOutput => ({
      kind: 'principle_quality',
      title,
      body,
      evidence: ids.map((id) => ({ type: 'principle' as const, id })),
      target: ids.length === 1 ? { type: 'principle', id: ids[0] } : null,
      payload: { question },
    })
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = kw.get(live[i].id)!
        const b = kw.get(live[j].id)!
        const shared = overlap(a, b)
        const jaccard = shared.length / (new Set([...a, ...b]).size || 1)
        if (shared.length >= 3 && jaccard >= 0.25) {
          out.push(q(`${live[i].code} and ${live[j].code} may overlap`, `They share: ${shared.slice(0, 6).join(', ')}. Distinct principles are easier to apply — consider whether these should merge or sharpen.`, [live[i].id, live[j].id], `Are ${live[i].code} and ${live[j].code} distinct enough?`))
        }
      }
    }
    for (const p of live) {
      const n = evidenceFor(data, { type: 'principle', id: p.id }).all.length
      if (n === 0) out.push(q(`${p.code} is not grounded in evidence`, 'No accepted source statement supports this principle, directly or through a theme. Link evidence or confirm it is a BSA proposition.', [p.id], `What evidence supports ${p.code}?`))
      else if (n === 1) out.push(q(`${p.code} rests on a single statement`, 'One source can be enough, but confirm it reflects a shared view.', [p.id], `Is ${p.code} a shared view, or one voice?`))
      const w = words(p.statement)
      if (w > 40) out.push(q(`${p.code} statement is long (${w} words)`, 'Owners remember short principles. Consider moving detail into “Why it matters”.', [p.id], `Can ${p.code} be said more simply?`))
      if (w > 0 && w < 6) out.push(q(`${p.code} statement may be too brief to guide design`, 'A very short statement can be hard to apply consistently.', [p.id], `What does ${p.code} ask the design to do?`))
    }
    const present = new Set(live.map((p) => p.category))
    const missing = (['facility_outcomes', 'delivery_excellence', 'institutional_impact'] as const).filter((c) => !present.has(c))
    if (live.length >= 3 && missing.length) {
      out.push(q(`No principles address ${missing.map((c) => CATEGORY_LABELS[c]).join(', ')}`, 'This may be intentional. If not, the framework may be unbalanced.', [], `Should the framework address ${missing.map((c) => CATEGORY_LABELS[c].toLowerCase()).join(' and ')}?`))
    }
    return out
  }
}
