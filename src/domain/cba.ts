import type { Decision, ID } from './types'

/**
 * Choosing by Advantages (CBA) evaluation.
 *
 * - Alternatives must pass every mandatory requirement to be eligible.
 * - For each factor the team records the attribute of every alternative,
 *   identifies the least-preferred attribute, and describes the advantage
 *   of each other alternative relative to it (a factual difference).
 * - The team judges the importance of each advantage (0–100), anchored by
 *   the paramount advantage at 100, and writes the rationale.
 * - Total importance is a plain sum of judged importances. Cost is kept
 *   separate and never folded into the importance total.
 *
 * Nothing here generates or infers importance; it only validates and sums
 * human judgments.
 */

export type CbaIssueSeverity = 'blocking' | 'warning'
export interface CbaIssue {
  severity: CbaIssueSeverity
  message: string
  factorId?: ID
  alternativeId?: ID
}

export interface CbaEvaluation {
  eligible: Record<ID, boolean>
  unknownMusts: Record<ID, number>
  totals: Record<ID, number>
  issues: CbaIssue[]
  complete: boolean
  /** Highest-total eligible alternative(s); empty until the evaluation is complete. */
  leaders: ID[]
  maxImportance: number
}

export function evaluateCba(decision: Decision): CbaEvaluation {
  const issues: CbaIssue[] = []
  const alts = decision.alternatives
  const eligible: Record<ID, boolean> = {}
  const unknownMusts: Record<ID, number> = {}
  const totals: Record<ID, number> = {}

  if (alts.length < 2) issues.push({ severity: 'blocking', message: 'Define at least two alternatives.' })
  if (decision.factors.length === 0) issues.push({ severity: 'blocking', message: 'Define at least one factor.' })

  for (const alt of alts) {
    eligible[alt.id] = true
    unknownMusts[alt.id] = 0
    totals[alt.id] = 0
    for (const req of decision.mandatoryRequirements) {
      const r = req.results[alt.id] ?? 'unknown'
      if (r === 'fail') eligible[alt.id] = false
      if (r === 'unknown') unknownMusts[alt.id]++
    }
    if (!eligible[alt.id]) {
      issues.push({ severity: 'warning', message: `${alt.name} fails a mandatory requirement and is excluded.`, alternativeId: alt.id })
    } else if (unknownMusts[alt.id] > 0) {
      issues.push({
        severity: 'warning',
        message: `${alt.name} has ${unknownMusts[alt.id]} mandatory requirement(s) not yet confirmed.`,
        alternativeId: alt.id,
      })
    }
  }

  let maxImportance = 0
  let maxFactorId: ID | null = null

  for (const f of decision.factors) {
    for (const alt of alts) {
      if (!(f.attributes[alt.id] ?? '').trim()) {
        issues.push({ severity: 'blocking', message: `"${f.name}": record the attribute of ${alt.name}.`, factorId: f.id, alternativeId: alt.id })
      }
    }
    if (!f.leastPreferredAltId || !alts.some((a) => a.id === f.leastPreferredAltId)) {
      issues.push({ severity: 'blocking', message: `"${f.name}": identify the least-preferred attribute.`, factorId: f.id })
      continue
    }
    let factorHasAdvantage = false
    for (const alt of alts) {
      if (alt.id === f.leastPreferredAltId || !eligible[alt.id]) continue
      const adv = f.advantages[alt.id]
      if (!adv || !adv.description.trim()) {
        issues.push({ severity: 'blocking', message: `"${f.name}": describe the advantage of ${alt.name}.`, factorId: f.id, alternativeId: alt.id })
      }
      if (adv?.importance == null) {
        issues.push({ severity: 'blocking', message: `"${f.name}": judge the importance of ${alt.name}'s advantage.`, factorId: f.id, alternativeId: alt.id })
      } else {
        totals[alt.id] += adv.importance
        if (adv.importance > 0) factorHasAdvantage = true
        if (adv.importance > maxImportance) {
          maxImportance = adv.importance
          maxFactorId = f.id
        }
      }
    }
    if (factorHasAdvantage && !f.importanceRationale.trim()) {
      issues.push({ severity: 'blocking', message: `"${f.name}": record the rationale for the importance judgments.`, factorId: f.id })
    }
  }

  if (decision.factors.length > 0) {
    if (!decision.paramountFactorId) {
      issues.push({ severity: 'warning', message: 'Identify the paramount advantage to anchor the importance scale at 100.' })
    } else if (maxImportance !== 100 || (maxFactorId && maxFactorId !== decision.paramountFactorId)) {
      issues.push({
        severity: 'warning',
        message: 'The paramount advantage should carry importance 100 and be the highest judged importance.',
        factorId: decision.paramountFactorId,
      })
    }
  }
  if (!alts.some((a) => eligible[a.id])) {
    if (alts.length > 0) issues.push({ severity: 'blocking', message: 'No alternative satisfies every mandatory requirement.' })
  }

  const complete = !issues.some((i) => i.severity === 'blocking')
  let leaders: ID[] = []
  if (complete) {
    const best = Math.max(...alts.filter((a) => eligible[a.id]).map((a) => totals[a.id]))
    leaders = alts.filter((a) => eligible[a.id] && totals[a.id] === best).map((a) => a.id)
  }
  return { eligible, unknownMusts, totals, issues, complete, leaders, maxImportance }
}

/** Informal discussion scoring (1–5 per factor). Explicitly NOT Choosing by Advantages. */
export function informalTotals(decision: Decision): Record<ID, number | null> {
  const out: Record<ID, number | null> = {}
  for (const alt of decision.alternatives) {
    const scores = decision.informalScores[alt.id]
    const values = decision.factors.map((f) => scores?.[f.id]).filter((v): v is number => typeof v === 'number')
    out[alt.id] = values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  return out
}
