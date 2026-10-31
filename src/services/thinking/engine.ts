import { nodeLabel, sameRef } from '@/domain/traceability'
import type { NodeRef, ProjectData, Suggestion, ThinkingMode } from '@/domain/types'
import { RulesProvider } from '@/services/ai/rulesProvider'
import type { SuggestionOutput } from '@/services/ai/types'
import type { Workspace } from './context'
import { RULES, type Observation } from './rules'

export interface AnalysisRequest {
  workspace: Workspace
  mode: ThinkingMode
  focus: NodeRef | null
  /** focused = up to three observations; deeper = up to eight. */
  depth: 'focused' | 'deeper'
  /** Explicit request to show observations the team previously set aside. */
  includeSetAside?: boolean
}

export interface AnalysisResult {
  suggestions: SuggestionOutput[]
  /** Observations not shown because the team already set them aside and nothing has changed. */
  suppressed: number
}

export const NO_OBSERVATIONS = 'No significant observations identified from the available evidence.'
export const RULES_PROVIDER_LABEL = 'Evidence Intelligence (rule-based, no AI model)'

/** Stable short hash for change detection; not a security measure. */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const ruleFamily = (rule: string) => rule.split(':')[0]

function touches(data: ProjectData, o: Observation, focus: NodeRef): boolean {
  const refs = [...o.subjects, ...o.evidence]
  if (refs.some((r) => sameRef(r, focus))) return true
  if (focus.type === 'source') return refs.some((r) => r.type === 'statement' && data.statements.find((s) => s.id === r.id)?.sourceId === focus.id)
  return false
}

/** The preserved 1.x analyses, as observations within the relevant workspaces. */
async function legacy(data: ProjectData, req: AnalysisRequest): Promise<Observation[]> {
  const rules = new RulesProvider()
  const out: Observation[] = []
  const convert = (s: SuggestionOutput, rule: string, mode: ThinkingMode, question: string, why: string, next: string): Observation => ({
    rule,
    mode,
    tier: 3,
    subjects: s.target ? [s.target] : s.evidence.slice(0, 1),
    observation: s.title,
    whyItMatters: why,
    supportingContext: s.body,
    question,
    nextAction: next,
    evidence: s.evidence,
    method: 'Rule-based analysis: shared-term matching (Compass 1.x rule — weak evidence, review carefully)',
    kind: s.kind,
    payload: s.payload,
  })
  if (req.mode === 'explore' && (req.workspace === 'understand/themes' || req.workspace === 'understand/evidence')) {
    for (const s of (await rules.run('suggest_relationships', data)).slice(0, 4))
      out.push(convert(s, `link:${s.evidence[0]?.id}>${s.target?.id}`, 'explore', 'Does this statement really support the theme?', 'Linking evidence keeps themes traceable to what was said.', 'Apply the proposed link if the meaning matches.'))
    for (const s of (await rules.run('suggest_themes', data)).slice(0, 2))
      out.push(convert(s, `group:${s.evidence.map((e) => e.id).join(',')}`, 'explore', 'Do these statements share a meaning, or only words?', 'Ungrouped statements are easy to lose in the synthesis.', 'Create the proposed theme if the grouping holds, then rename it.'))
  }
  if (req.mode === 'challenge' && (req.workspace === 'interpret/opportunities' || req.workspace === 'interpret/success')) {
    for (const s of (await rules.run('validation_questions', data)).slice(0, 3))
      out.push(convert(s, `driver:${s.target?.id}:${s.title}`, 'challenge', String(s.payload.question ?? 'What should be validated?'), 'Formal Design Drivers need owners, targets and sources before they can guide decisions.', 'Raise the question with the accountable owner.'))
  }
  return out
}

/**
 * The Evidence Intelligence engine: runs the rules relevant to the current
 * workspace and mode, keeps observations about the selected item, orders them
 * (internally) by significance, removes what the team has already set aside,
 * and returns a few high-value suggestions — or none.
 */
export async function analyze(data: ProjectData, req: AnalysisRequest): Promise<AnalysisResult> {
  const rules = RULES.filter((r) => r.modes.includes(req.mode) && (req.workspace === 'project' || r.workspaces.includes(req.workspace)))
  let obs: Observation[] = []
  for (const r of rules) {
    try {
      obs.push(...r.run(data, req.mode).map((o) => ({ ...o, primary: r.workspaces[0] === req.workspace })))
    } catch {
      // A rule that fails on unusual data is skipped rather than blocking the analysis.
    }
  }
  obs.push(...(await legacy(data, req)))
  if (req.focus) obs = obs.filter((o) => touches(data, o, req.focus!))

  const primary = (o: Observation) => ((o as Observation & { primary?: boolean }).primary ? 0 : 1)
  obs.sort((a, b) => a.tier - b.tier || primary(a) - primary(b))

  const fingerprint = (o: Observation) => `${o.rule}|${[...o.subjects].map((s) => `${s.type}:${s.id}`).sort().join(',')}`
  const evidenceKey = (o: Observation) => hash(JSON.stringify([...o.subjects, ...o.evidence].map((r) => `${r.type}:${r.id}:${nodeLabel(data, r).title}`).sort()))
  const reviewed = (s: Suggestion) => s.status !== 'pending'
  const setAside = (s: Suggestion) => s.status === 'dismissed' || s.status === 'not_relevant'

  let suppressed = 0
  const seen = new Set<string>()
  const kept: Observation[] = []
  for (const o of obs) {
    const fp = fingerprint(o)
    if (seen.has(fp)) continue
    seen.add(fp)
    const prior = data.suggestions.filter((s) => s.card?.fingerprint === fp)
    // Already awaiting review: do not duplicate.
    if (prior.some((s) => s.status === 'pending')) continue
    const sameEvidence = prior.filter((s) => s.card?.evidenceKey === evidenceKey(o))
    if (sameEvidence.some((s) => reviewed(s) && !(req.includeSetAside && setAside(s)))) {
      suppressed++
      continue
    }
    kept.push(o)
  }

  // Focused analyses show at most one observation per rule, so three cards cover three different ideas.
  const limit = req.depth === 'focused' ? 3 : 8
  const chosen: Observation[] = []
  const families = new Set<string>()
  for (const o of kept) {
    if (chosen.length >= limit) break
    if (req.depth === 'focused' && families.has(ruleFamily(o.rule))) continue
    families.add(ruleFamily(o.rule))
    chosen.push(o)
  }
  for (const o of kept) if (chosen.length < limit && !chosen.includes(o) && req.depth === 'deeper') chosen.push(o)

  return {
    suppressed,
    suggestions: chosen.map((o) => {
      const evidenceStatus = o.evidence.some((e) => e.type === 'statement') ? 'direct' : o.evidence.length ? 'indirect' : 'inference'
      return {
        kind: o.kind ?? 'observation',
        title: o.observation.slice(0, 300),
        body: o.whyItMatters,
        evidence: o.evidence.slice(0, 40),
        target: o.subjects[0] ?? null,
        payload: { ...(o.payload ?? {}), question: (o.payload?.question as string | undefined) ?? o.question },
        card: {
          mode: o.mode,
          observation: o.observation.slice(0, 600),
          whyItMatters: o.whyItMatters.slice(0, 2000),
          supportingContext: o.supportingContext.slice(0, 2000),
          question: o.question.slice(0, 600),
          nextAction: o.nextAction.slice(0, 600),
          evidenceStatus,
          method: o.method.slice(0, 200),
          fingerprint: fingerprint(o).slice(0, 300),
          evidenceKey: evidenceKey(o),
          scope: { workspace: req.workspace, focus: req.focus },
          exploration: o.exploration,
        },
      }
    }),
  }
}
