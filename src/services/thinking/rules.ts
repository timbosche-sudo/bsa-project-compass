import { evidenceFor, gapReport, themeStatementIds } from '@/domain/traceability'
import type { ExplorationDirection, GuidingPrinciple, NodeRef, ProjectData, Statement, SuggestionKind, ThinkingMode } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'
import type { Workspace } from './context'
import { cite, classify, isWeighty, statementRefs } from './evidence'
import { GENERIC_TERMS, jaccard, keywordSet, lensById, lensHits, rankedLenses } from './lenses'
import { LATE_PHASES, SECTOR_PERSPECTIVES } from './sectors'

/**
 * Evidence Intelligence: transparent, deterministic rules. Each rule states how
 * it reached its observation (method), what it rests on (evidence) and frames
 * the result as a question for professional judgment.
 */
export interface Observation {
  rule: string
  mode: ThinkingMode
  /** Internal ordering only (1 = most significant). Never shown as a score. */
  tier: 1 | 2 | 3
  subjects: NodeRef[]
  observation: string
  whyItMatters: string
  supportingContext: string
  question: string
  nextAction: string
  evidence: NodeRef[]
  method: string
  kind?: SuggestionKind
  payload?: Record<string, unknown>
  exploration?: { question: string; directions: ExplorationDirection[]; basis: string }
}

export interface Rule {
  id: string
  modes: ThinkingMode[]
  workspaces: Workspace[]
  run: (data: ProjectData, mode: ThinkingMode) => Observation[]
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ref = (type: NodeRef['type'], id: string): NodeRef => ({ type, id })
const stmt = (data: ProjectData, id: string) => data.statements.find((s) => s.id === id)
const activePrinciples = (data: ProjectData) => [...data.principles].sort((a, b) => a.order - b.order).filter((p) => isActiveFramework(p.status) && p.status !== 'not_adopted')
const principleText = (p: GuidingPrinciple) => [p.title, p.statement, p.intent, p.whyItMatters, p.designImplications].filter(Boolean).join(' ')
const themeText = (data: ProjectData, id: string) => {
  const t = data.themes.find((x) => x.id === id)!
  return [t.title, t.summary, ...themeStatementIds(data, id).map((s) => stmt(data, s)?.originalText ?? '')].join(' ')
}
const list = (xs: string[]) => {
  if (xs.length <= 1) return xs.join('')
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`
  // Phrases that contain "and" read better separated by semicolons.
  const sep = xs.some((x) => x.includes(' and ')) ? '; ' : ', '
  return `${xs.slice(0, -1).join(sep)}${sep === '; ' ? ';' : ''} and ${xs.at(-1)}`
}
const quoted = (s: string) => `“${s}”`
const RULES_METHOD = 'Rule-based analysis'

const voices = (ss: Statement[]) => new Set(ss.map((s) => s.speaker || s.sourceId)).size

/** Statements per lens, using statement text only (the evidence, not our interpretation of it). */
function lensSupport(data: ProjectData): Map<string, Statement[]> {
  const out = new Map<string, Statement[]>()
  for (const s of data.statements) for (const [l] of lensHits(s.originalText)) out.set(l, [...(out.get(l) ?? []), s])
  return out
}

/** Curated pattern templates for "do these connect?" explorations. Starting points to rewrite, never conclusions. */
export function connectionDirections(lenses: string[]): ExplorationDirection[] {
  const [a, b, c] = lenses.map((l) => lensById(l).phrase)
  if (!c) {
    return [
      { id: 'foundation', title: `${cap(a)} as the foundation for ${b}`, summary: `Treat ${a} not as an end in itself but as what makes ${b} possible.` },
      { id: 'tension', title: `${cap(a)} and ${b} held in deliberate balance`, summary: `Name the trade-off between ${a} and ${b} and decide, with the Owner, where the balance should sit.` },
      { id: 'separate', title: 'Two distinct commitments', summary: `Keep ${a} and ${b} separate, and say clearly what each asks of the design.` },
    ]
  }
  return [
    { id: 'foundation', title: `${cap(a)} as the foundation for ${c}`, summary: `${cap(a)} is what lets the people and processes depending on it perform — ${c} follows from it rather than competing with it.` },
    { id: 'bridge', title: `${cap(b)} as the connection between ${a} and ${c}`, summary: `${cap(b)} is how ${a} and ${c} reinforce each other day to day; the design makes that connection visible.` },
    { id: 'experience', title: 'One coordinated experience', summary: `${cap(a)}, ${b} and ${c} as aspects of a single experience for the people who use the building, rather than separate objectives.` },
  ]
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------------------
// EXPLORE — What might we be missing?
// ---------------------------------------------------------------------------

/** Several well-supported priorities that may share one larger ambition. Offers a guided exploration. */
const connectedAmbition: Rule = {
  id: 'connected-ambition',
  modes: ['explore', 'develop'],
  workspaces: ['understand/themes', 'understand/heard', 'interpret/point-of-view', 'interpret/vision', 'project'],
  run: (data, mode) => {
    const support = lensSupport(data)
    const strong = [...support.entries()]
      .filter(([, ss]) => ss.length >= 2)
      // Breadth of voices first, then Owner requirements and critical statements, then volume.
      .sort((x, y) => voices(y[1]) - voices(x[1]) || y[1].filter((s) => isWeighty(data, s)).length - x[1].filter((s) => isWeighty(data, s)).length || y[1].length - x[1].length)
      .slice(0, 3)
      .map(([l]) => l)
    if (strong.length < 3) return []
    const phrases = strong.map((l) => lensById(l).phrase)
    const examples = strong.map((l) => support.get(l)!.find((s) => isWeighty(data, s)) ?? support.get(l)![0])
    const pov = data.pointOfView?.centralAmbition ?? ''
    const covered = strong.filter((l) => lensHits(pov).has(l))
    const develop = mode === 'develop'
    return [
      {
        rule: 'connected-ambition',
        mode,
        tier: 1,
        subjects: examples.map((s) => ref('statement', s.id)),
        observation: develop
          ? pov
            ? covered.length === strong.length
              ? `The point of view reflects all three of the most widely supported priorities — ${list(phrases)}. Does it say how they connect?`
              : `Of the three most widely supported priorities — ${list(phrases)} — the point of view reflects ${covered.length ? covered.map((l) => lensById(l).phrase).join(', as well as ') : 'none of them'}.`
            : `There is no central ambition yet, and the evidence widely supports ${list(phrases)}.`
          : `Three priorities recur across many voices: ${list(phrases)}.`,
        whyItMatters: 'A point of view is stronger when it explains how priorities relate, rather than listing them side by side.',
        supportingContext: examples.map((s) => cite(s)).join(' · '),
        question: 'Are these separate objectives, or might they be connected by a larger ambition?',
        nextAction: 'Compare the directions below, choose one to develop, or write your own.',
        evidence: statementRefs(examples.map((s) => s.id)),
        method: `${RULES_METHOD}: concept-lens grouping of statement text (curated vocabulary), ordered by Owner requirements and critical statements first`,
        exploration: {
          question: 'Could these priorities represent separate objectives, or might they be connected by a larger ambition?',
          basis: 'Curated exploration pattern. These directions are templates built from the matched concepts — starting points to test and rewrite, not conclusions.',
          directions: connectionDirections(strong),
        },
      },
    ]
  },
}

/** Themes that may be related because they draw on the same concept and both have evidence. */
const relatedThemes: Rule = {
  id: 'related-themes',
  modes: ['explore'],
  workspaces: ['understand/themes', 'understand/heard', 'project'],
  run: (data) => {
    const themes = data.themes.filter((t) => t.status !== 'archived' && themeStatementIds(data, t.id).length > 0)
    const primary = new Map(themes.map((t) => [t.id, rankedLenses(themeText(data, t.id), 2).slice(0, 2)]))
    const out: Observation[] = []
    for (let i = 0; i < themes.length; i++)
      for (let j = i + 1; j < themes.length; j++) {
        const a = themes[i]
        const b = themes[j]
        const shared = primary.get(a.id)!.filter((l) => primary.get(b.id)!.includes(l))
        if (!shared.length) continue
        const sa = themeStatementIds(data, a.id).slice(0, 2)
        const sb = themeStatementIds(data, b.id).slice(0, 2)
        out.push({
          rule: 'related-themes',
          mode: 'explore',
          tier: 2,
          subjects: [ref('theme', a.id), ref('theme', b.id)],
          observation: `${a.code} ${quoted(a.title)} and ${b.code} ${quoted(b.title)} both draw on ${lensById(shared[0]).phrase}.`,
          whyItMatters: 'Related themes can be expressions of one larger idea — or genuinely different concerns that should stay distinct.',
          supportingContext: [...sa, ...sb].map((id) => cite(stmt(data, id)!)).join(' · '),
          question: `Is there a single, larger idea behind both themes, or do they ask different things of the design?`,
          nextAction: 'Compare their evidence side by side before deciding to connect, merge or keep them distinct.',
          evidence: statementRefs([...sa, ...sb]),
          method: `${RULES_METHOD}: shared primary concept lens (at least two matching words in each theme and its statements)`,
          exploration: {
            question: `How do ${quoted(a.title)} and ${quoted(b.title)} relate?`,
            basis: 'Curated exploration pattern — templates to test against the evidence.',
            directions: connectionDirections([shared[0], ...(primary.get(a.id)!.filter((l) => l !== shared[0]).slice(0, 1)), ...(primary.get(b.id)!.filter((l) => l !== shared[0]).slice(0, 1))].slice(0, 3)),
          },
        })
      }
    return out.slice(0, 2)
  },
}

/** Perspectives that the evidence mentions but never hears from; sector-typical perspectives that are absent, as questions. */
const perspectives: Rule = {
  id: 'perspectives',
  modes: ['explore'],
  workspaces: ['understand/evidence', 'understand/themes', 'understand/heard', 'understand/questions', 'project'],
  run: (data, mode) => {
    const out: Observation[] = []
    const late = LATE_PHASES.includes(data.project.phase)
    for (const p of SECTOR_PERSPECTIVES[data.project.sector]) {
      const attributed = data.statements.filter((s) => p.attributed.test(s.speaker))
      if (attributed.length) continue
      const mentioned = data.statements.filter((s) => p.mentioned.test(s.originalText))
      if (mentioned.length) {
        out.push({
          rule: `perspective:${p.id}`,
          mode,
          tier: mentioned.some((s) => isWeighty(data, s)) ? 1 : 2,
          subjects: statementRefs(mentioned.slice(0, 3).map((s) => s.id)),
          observation: `${cap(p.label)} are mentioned in ${mentioned.length} statement${mentioned.length === 1 ? '' : 's'}, but no statement comes from them directly.`,
          whyItMatters: 'Others are speaking on their behalf. That may be appropriate — or it may be a perspective the direction is assuming rather than hearing.',
          supportingContext: mentioned.slice(0, 2).map((s) => cite(s)).join(' · '),
          question: `Should we hear directly from ${p.label}${late ? ' at this phase' : ''}, or is their perspective adequately represented by those quoted?`,
          nextAction: 'Decide whether to seek this voice, or record why it is represented indirectly.',
          evidence: statementRefs(mentioned.slice(0, 5).map((s) => s.id)),
          method: `${RULES_METHOD}: statements mention this group, and no statement is attributed to it`,
        })
      } else if (p.typical) {
        out.push({
          rule: `perspective:${p.id}`,
          mode,
          tier: 3,
          subjects: [],
          observation: `No statements are attributed to ${p.label}.`,
          whyItMatters: `This perspective is often relevant to ${data.project.sector} projects, but relevance depends on this project’s purpose and phase.`,
          supportingContext: `Project sector: ${data.project.sector}; phase: ${data.project.phase.replace(/_/g, ' ')}.`,
          question: `Is the perspective of ${p.label} relevant to this project${late ? ' at this stage' : ''}?`,
          nextAction: 'Mark not relevant if it does not apply; otherwise consider how to include it.',
          evidence: [],
          method: `${RULES_METHOD}: sector-typical perspective with no attributed statements (a question, not a finding)`,
        })
      }
    }
    // One voice dominating the evidence.
    const by = new Map<string, Statement[]>()
    data.statements.forEach((s) => by.set(s.speaker || 'Unattributed', [...(by.get(s.speaker || 'Unattributed') ?? []), s]))
    for (const [speaker, ss] of by)
      if (data.statements.length >= 8 && ss.length / data.statements.length > 0.4)
        out.push({
          rule: 'dominant-voice',
          mode,
          tier: 2,
          subjects: [],
          observation: `${ss.length} of ${data.statements.length} statements come from a single attribution: ${speaker}.`,
          whyItMatters: 'A direction shaped mostly by one voice can feel well-supported while reflecting one perspective.',
          supportingContext: ss.slice(0, 2).map((s) => cite(s)).join(' · '),
          question: `Whose view would balance ${speaker}’s?`,
          nextAction: 'Check whether other sources confirm or temper this voice.',
          evidence: statementRefs(ss.slice(0, 5).map((s) => s.id)),
          method: `${RULES_METHOD}: attribution count`,
        })
    return out
  },
}

/** Important statements (Owner requirements, non-negotiables, critical) that the synthesis has not picked up. */
const underAttended: Rule = {
  id: 'under-attended',
  modes: ['explore', 'challenge'],
  workspaces: ['understand/evidence', 'understand/themes', 'understand/heard', 'interpret/principles', 'project'],
  run: (data, mode) => {
    const inHeard = new Set(data.heard.flatMap((h) => h.evidence.filter((e) => e.type === 'statement').map((e) => e.id)))
    const inThemes = new Set(data.themes.flatMap((t) => themeStatementIds(data, t.id)))
    const inPrinciples = new Set(activePrinciples(data).flatMap((p) => evidenceFor(data, { type: 'principle', id: p.id }).all.map((s) => s.id)))
    return data.statements
      .filter((s) => isWeighty(data, s) && !inHeard.has(s.id) && !inPrinciples.has(s.id))
      .slice(0, 3)
      .map((s) => ({
        rule: 'under-attended',
        mode,
        tier: 1 as const,
        subjects: [ref('statement', s.id)],
        observation: `${s.code} is ${classify(data, s) === 'owner_requirement' ? 'an Owner requirement' : s.criticality === 'critical' ? 'marked critical' : 'non-negotiable'}, but it is not reflected in What We Heard or any principle${inThemes.has(s.id) ? ' (it sits only in a theme)' : ''}.`,
        whyItMatters: 'An important point can be said once. Frequency of mention is not a measure of importance.',
        supportingContext: cite(s, 200),
        question: 'Has this received the attention it deserves in the direction?',
        nextAction: 'Decide where it belongs — What We Heard, a principle’s evidence, or a critical question.',
        evidence: [ref('statement', s.id)],
        method: `${RULES_METHOD}: Owner requirement, non-negotiable or critical statement with no link to What We Heard or a principle`,
      }))
  },
}

const CONCERN = /\b(burn|lose|lost|stall|stalled|never again|problem|fail|crossing|cannot|no remote|no windows|not a hallway)/i

/** Recurring concerns in one concept area that may point to a larger opportunity. */
const concernsToOpportunity: Rule = {
  id: 'concerns-to-opportunity',
  modes: ['explore', 'develop'],
  workspaces: ['understand/themes', 'understand/heard', 'understand/questions', 'interpret/opportunities', 'project'],
  run: (data, mode) => {
    const concerns = data.statements.filter((s) => CONCERN.test(s.originalText))
    const groups = new Map<string, Statement[]>()
    for (const s of concerns) for (const l of rankedLenses(s.originalText).slice(0, 1)) groups.set(l, [...(groups.get(l) ?? []), s])
    return [...groups.entries()]
      .filter(([, ss]) => ss.length >= 2)
      .map(([l, ss]) => ({
        rule: `concerns:${l}`,
        mode,
        tier: 2 as const,
        subjects: statementRefs(ss.map((s) => s.id)),
        observation: `Several concerns relate to ${lensById(l).phrase}.`,
        whyItMatters: 'Recurring frustrations often point to an opportunity larger than fixing each one.',
        supportingContext: ss.slice(0, 3).map((s) => cite(s)).join(' · '),
        question: `What would it look like if ${lensById(l).phrase} became a strength of this project rather than a problem to solve?`,
        nextAction: 'Explore whether these concerns point to a design opportunity or a principle’s “why it matters”.',
        evidence: statementRefs(ss.slice(0, 5).map((s) => s.id)),
        method: `${RULES_METHOD}: concern phrasing (e.g. “burn out”, “never again”, “stalled”) grouped by concept lens`,
      }))
  },
}

// ---------------------------------------------------------------------------
// CHALLENGE — What should we question?
// ---------------------------------------------------------------------------

/** Principles that may overlap. Shared words alone are not enough: a shared primary concept or shared evidence is required. */
const principleOverlap: Rule = {
  id: 'principle-overlap',
  modes: ['challenge', 'refine'],
  workspaces: ['interpret/principles', 'interpret/opportunities', 'project'],
  run: (data, mode) => {
    const ps = activePrinciples(data)
    const out: Observation[] = []
    const info = new Map(
      ps.map((p) => [p.id, { lenses: rankedLenses(principleText(p), 2), first: rankedLenses(principleText(p), 2)[0], words: keywordSet(`${p.title} ${p.statement}`), ev: new Set(evidenceFor(data, { type: 'principle', id: p.id }).all.map((s) => s.id)) }]),
    )
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]
        const b = ps[j]
        const ia = info.get(a.id)!
        const ib = info.get(b.id)!
        const sharedEv = [...ia.ev].filter((x) => ib.ev.has(x))
        const lens = [ia.first, ib.first].find((l) => l && ia.lenses.slice(0, 2).includes(l) && ib.lenses.slice(0, 2).includes(l))
        const words = jaccard(ia.words, ib.words)
        if (!lens && sharedEv.length < 2 && !(sharedEv.length >= 1 && words >= 0.2)) continue
        const focusA = ia.lenses.find((l) => l !== lens)
        const focusB = ib.lenses.find((l) => l !== lens)
        const topic = lens ? lensById(lens).phrase : 'the same evidence'
        const distinct = focusA && focusB && focusA !== focusB
        out.push({
          rule: 'principle-overlap',
          mode,
          tier: 1,
          subjects: [ref('principle', a.id), ref('principle', b.id)],
          observation: `Potential relationship: ${quoted(a.title)} and ${quoted(b.title)} both address ${topic}${distinct ? ', but from different perspectives' : ''}.`,
          whyItMatters: distinct
            ? `${a.code} also emphasizes ${lensById(focusA!).phrase}; ${b.code} also emphasizes ${lensById(focusB!).phrase}. Distinct principles are easier to apply when their relationship is explicit.`
            : 'Principles that overlap are harder to use in design decisions, and can read as repetition to the Owner.',
          supportingContext: [
            `${a.code}: ${a.statement}`,
            `${b.code}: ${b.statement}`,
            sharedEv.length ? `Shared evidence: ${sharedEv.map((id) => stmt(data, id)?.code).join(', ')}` : `No shared evidence — ${a.code} draws on ${[...ia.ev].slice(0, 3).map((id) => stmt(data, id)?.code).join(', ') || 'nothing linked'}; ${b.code} on ${[...ib.ev].slice(0, 3).map((id) => stmt(data, id)?.code).join(', ') || 'nothing linked'}`,
          ].join(' · '),
          question: 'Are these distinct commitments, or should their relationship be made more explicit?',
          nextAction: 'Compare supporting evidence, explore a combined interpretation, or keep them separate and clarify the distinction. Nothing is merged automatically.',
          evidence: [ref('principle', a.id), ref('principle', b.id), ...statementRefs([...new Set([...sharedEv.slice(0, 2), ...[...ia.ev].slice(0, 2), ...[...ib.ev].slice(0, 2)])])],
          method: `${RULES_METHOD}: ${lens ? 'shared primary concept lens' : 'shared evidence'}${words >= 0.2 ? ' plus overlapping wording' : ''} (shared keywords alone are not used)`,
          exploration: {
            question: `How should ${quoted(a.title)} and ${quoted(b.title)} relate?`,
            basis: 'Curated options for overlapping principles. None changes principle wording; each is a working idea for the team.',
            directions: [
              { id: 'combine', title: 'Explore a combined interpretation', summary: `One principle about ${topic} that holds both ${a.code}’s and ${b.code}’s intent.` },
              { id: 'clarify', title: 'Keep separate and clarify the distinction', summary: `${a.code} is about ${focusA ? lensById(focusA).phrase : 'its own emphasis'}; ${b.code} is about ${focusB ? lensById(focusB).phrase : 'its own emphasis'}. Say so in each “why it matters”.` },
              { id: 'link', title: 'Make the relationship explicit', summary: `Keep both, and describe how they reinforce each other in the point of view.` },
            ],
          },
        })
      }
    return out
  },
}

/** Curated pairs of aspirations that commonly compete, raised only when the evidence supports both sides. */
const TENSION_PAIRS: [string, string, string][] = [
  ['space', 'people', 'A compact footprint can compete with daylight, respite and room for people.'],
  ['flow', 'safety', 'Seamless flow can compete with separation needed for safety or compliance.'],
  ['certainty', 'growth', 'Fast, fixed decisions can compete with keeping options open for change.'],
  ['community', 'safety', 'Openness to the community can compete with security of operations.'],
  ['space', 'growth', 'A compact footprint can compete with room to grow in place.'],
]

const tensions: Rule = {
  id: 'tensions',
  modes: ['challenge'],
  workspaces: ['understand/themes', 'understand/questions', 'understand/heard', 'interpret/point-of-view', 'interpret/principles', 'project'],
  run: (data) => {
    const out: Observation[] = []
    const asked = new Set(data.questions.filter((q) => q.status === 'open').flatMap((q) => q.context.map((c) => c.id)))
    const recorded = data.relationships.filter((r) => r.type === 'conflicts_with' && r.status !== 'rejected')
    for (const c of recorded) {
      const a = stmt(data, c.from.id)
      const b = stmt(data, c.to.id)
      if (!a || !b) continue
      out.push({
        rule: 'recorded-tension',
        mode: 'challenge',
        tier: asked.has(a.id) && asked.has(b.id) ? 3 : 1,
        subjects: [ref('statement', a.id), ref('statement', b.id)],
        observation: `A recorded tension: ${a.code} and ${b.code} pull in different directions.`,
        whyItMatters: c.explanation || 'Unresolved tensions tend to resurface as late design changes.',
        supportingContext: `${cite(a)} · ${cite(b)}`,
        question: 'How should the direction balance these — and is that a decision for BSA, or for the Owner?',
        nextAction: 'Name the trade-off in the point of view, or raise it as a question for the Owner.',
        evidence: [ref('statement', a.id), ref('statement', b.id)],
        method: `${RULES_METHOD}: relationship recorded by the team as “conflicts with”`,
      })
    }
    const support = lensSupport(data)
    for (const [x, y, why] of TENSION_PAIRS) {
      // Each side must be what its statement is mainly about, not a passing word.
      const sx = (support.get(x) ?? []).filter((s) => s.kind !== 'question' && rankedLenses(s.originalText)[0] === x)
      const sy = (support.get(y) ?? []).filter((s) => s.kind !== 'question' && rankedLenses(s.originalText)[0] === y)
      if (!sx.length || !sy.length) continue
      // Already recorded by the team between these two concerns.
      if (recorded.some((r) => (sx.some((q) => q.id === r.from.id) && sy.some((q) => q.id === r.to.id)) || (sy.some((q) => q.id === r.from.id) && sx.some((q) => q.id === r.to.id)))) continue
      const a = sx.find((s) => isWeighty(data, s) || s.criticality === 'high') ?? sx[0]
      const b = sy.find((s) => isWeighty(data, s) || s.criticality === 'high') ?? sy[0]
      if (a.id === b.id || recorded.some((r) => [r.from.id, r.to.id].includes(a.id) && [r.from.id, r.to.id].includes(b.id))) continue
      out.push({
        rule: `tension:${x}-${y}`,
        mode: 'challenge',
        tier: 2,
        subjects: [ref('statement', a.id), ref('statement', b.id)],
        observation: `Possible competing aspirations: ${lensById(x).phrase} and ${lensById(y).phrase}.`,
        whyItMatters: why,
        supportingContext: `${cite(a)} · ${cite(b)}`,
        question: 'Do these actually compete on this project, and if so, which should lead?',
        nextAction: 'Confirm with the evidence whether the tension is real before recording it.',
        evidence: [ref('statement', a.id), ref('statement', b.id)],
        method: `${RULES_METHOD}: curated pair of commonly competing aspirations, each supported by a statement (a possibility, not a finding)`,
      })
    }
    return out
  },
}

/** Building elements whose request often stands in for an underlying need. */
const ELEMENTS: [RegExp, string][] = [
  [/corridor|hallway|passage/, 'movement, access or separation need'],
  [/break ?room|lounge|respite|room|space|area/, 'activity, recovery or support need'],
  [/window|skylight/, 'need for light, view or connection'],
  [/door|entrance|entry/, 'access, arrival or security need'],
  [/wall|partition/, 'separation, privacy or acoustic need'],
  [/elevator|lift|stair/, 'vertical movement need'],
  [/dock|loading/, 'receiving or flow need'],
  [/office|desk|workstation/, 'focus, supervision or ergonomic need'],
  [/parking|garage/, 'arrival or access need'],
  [/suite|zone|lab/, 'separation, safety or workflow need'],
]
const REQUEST = /\b(?:need|needs|want|wants|give us|should have|there should be|add|install|build|put in|provide)\s+(?:a|an|another|more|the|some|bigger|larger|separate|new|dedicated)\s+([a-z-]+(?:\s[a-z-]+)?)/i
const KEEP_SEPARATE = /\bkeep\s+(?:the\s+)?([a-z -]+?)\s+(?:separate|apart|isolated)\b/i

export function prescriptiveRequest(text: string): { thing: string; need: string } | null {
  const m = REQUEST.exec(text) ?? KEEP_SEPARATE.exec(text)
  if (!m) return null
  const thing = m[1].toLowerCase()
  const need = ELEMENTS.find(([re]) => re.test(thing))?.[1] ?? (KEEP_SEPARATE.test(text) ? 'separation, safety or workflow need' : null)
  return need ? { thing, need } : null
}

const solutionVsNeed: Rule = {
  id: 'solution-vs-need',
  modes: ['challenge'],
  workspaces: ['understand/evidence', 'understand/heard', 'understand/themes', 'understand/questions', 'project'],
  run: (data) =>
    data.statements
      // Owner requirements are commitments, not requests to second-guess.
      .filter((s) => s.kind !== 'requirement' && s.kind !== 'nonnegotiable')
      .map((s) => ({ s, hit: prescriptiveRequest(s.originalText) }))
      .filter((x): x is { s: Statement; hit: { thing: string; need: string } } => !!x.hit)
      .map(({ s, hit }) => ({
        rule: 'solution-vs-need',
        mode: 'challenge' as const,
        tier: (s.criticality === 'normal' ? 2 : 1) as 1 | 2,
        subjects: [ref('statement', s.id)],
        observation: `${s.code} requests a specific solution: ${quoted(hit.thing)}.`,
        whyItMatters: 'Requests often name a familiar answer. Understanding the need behind it keeps other — possibly better — design responses open. The proposed solution may still be right.',
        supportingContext: cite(s, 200),
        question: `What ${hit.need} is motivating this request?`,
        nextAction: 'Confirm the underlying need with the person or group, then consider the request alongside alternatives.',
        evidence: [ref('statement', s.id)],
        method: `${RULES_METHOD}: request phrasing (e.g. “we need a…”, “keep … separate”) naming a building element`,
      })),
}

/** Conclusions that rest on little or indirect evidence. */
const weakSupport: Rule = {
  id: 'weak-support',
  modes: ['challenge'],
  workspaces: ['understand/heard', 'interpret/principles', 'interpret/point-of-view', 'interpret/vision', 'project'],
  run: (data) => {
    const out: Observation[] = []
    for (const p of activePrinciples(data)) {
      const ev = evidenceFor(data, { type: 'principle', id: p.id }).all
      const fromOwnerOrStakeholders = ev.filter((s) => classify(data, s) !== 'observation' && classify(data, s) !== 'external_research')
      if (ev.length === 0)
        out.push({
          rule: 'weak-support:none',
          mode: 'challenge',
          tier: 1,
          subjects: [ref('principle', p.id)],
          observation: `${p.code} ${quoted(p.title)} has no linked evidence.`,
          whyItMatters: 'It may be a sound BSA proposition — but the Owner will want to know where it comes from.',
          supportingContext: p.statement,
          question: 'What did we hear that supports this, or is it a professional recommendation we should present as such?',
          nextAction: 'Link supporting statements, or describe it as BSA’s recommendation in “why it matters”.',
          evidence: [ref('principle', p.id)],
          method: `${RULES_METHOD}: no accepted evidence links, directly or through themes`,
        })
      else if (fromOwnerOrStakeholders.length === 0)
        out.push({
          rule: 'weak-support:observation-only',
          mode: 'challenge',
          tier: 2,
          subjects: [ref('principle', p.id)],
          observation: `${p.code} rests only on observations and research, not on what the Owner or stakeholders said.`,
          whyItMatters: 'That can be a valuable professional insight, but it should be presented as one.',
          supportingContext: ev.slice(0, 2).map((s) => cite(s)).join(' · '),
          question: 'Do the Owner or stakeholders share this view, or is it ours to propose?',
          nextAction: 'Test it with the Owner, or frame it as BSA’s interpretation.',
          evidence: statementRefs(ev.slice(0, 4).map((s) => s.id)),
          method: `${RULES_METHOD}: evidence classified as observation or external research only`,
        })
    }
    for (const h of data.heard.filter((x) => x.reviewed && x.inPresentation && x.evidence.length === 0))
      out.push({
        rule: 'weak-support:heard',
        mode: 'challenge',
        tier: 2,
        subjects: [],
        observation: `What We Heard: ${quoted(h.title)} is going to the Owner with no linked evidence.`,
        whyItMatters: 'What We Heard should be faithful to what was said; an unsupported item can read as BSA’s assumption.',
        supportingContext: h.narrative,
        question: 'Which statements support this, or should it be presented as an interpretation?',
        nextAction: 'Link evidence or reword it as an observation.',
        evidence: [],
        method: `${RULES_METHOD}: reviewed What We Heard item marked for the presentation with no evidence`,
      })
    return out
  },
}

/** The most-mentioned theme without weighty evidence, beside a weighty point mentioned rarely. */
const frequencyVsImportance: Rule = {
  id: 'frequency-vs-importance',
  modes: ['challenge'],
  workspaces: ['understand/themes', 'understand/heard', 'project'],
  run: (data) => {
    const themes = data.themes.filter((t) => t.status !== 'archived').map((t) => ({ t, ss: themeStatementIds(data, t.id).map((id) => stmt(data, id)!).filter(Boolean) }))
    const loud = [...themes].sort((a, b) => b.ss.length - a.ss.length).find((x) => x.ss.length >= 3 && !x.ss.some((s) => isWeighty(data, s)))
    const quiet = themes.filter((x) => x.ss.length <= 2 && x.ss.some((s) => isWeighty(data, s)))
    if (!loud || !quiet.length) return []
    const q = quiet[0]
    return [
      {
        rule: 'frequency-vs-importance',
        mode: 'challenge',
        tier: 2,
        subjects: [ref('theme', loud.t.id), ref('theme', q.t.id)],
        observation: `${loud.t.code} ${quoted(loud.t.title)} has the most statements (${loud.ss.length}) but none is an Owner requirement or marked critical; ${q.t.code} ${quoted(q.t.title)} has only ${q.ss.length}, including a weighty one.`,
        whyItMatters: 'Frequency of mention is easy to mistake for importance.',
        supportingContext: cite(q.ss.find((s) => isWeighty(data, s))!, 160),
        question: 'Does the emphasis in our synthesis reflect importance, or how often things were said?',
        nextAction: 'Check that weighty but rarely mentioned points are visible in What We Heard and the principles.',
        evidence: [ref('theme', loud.t.id), ref('theme', q.t.id)],
        method: `${RULES_METHOD}: statement counts compared with Owner requirements and critical statements (counts are context, not scores)`,
      },
    ]
  },
}

/** Owner requirements not reflected anywhere in the framework (from the existing gap analysis). */
const requirementsNotInFramework: Rule = {
  id: 'requirements-not-in-framework',
  modes: ['challenge'],
  workspaces: ['understand/evidence', 'interpret/principles', 'project'],
  run: (data) =>
    gapReport(data)
      .requirementsNotInFramework.slice(0, 3)
      .map((s) => ({
        rule: 'requirements-not-in-framework',
        mode: 'challenge' as const,
        tier: 1 as const,
        subjects: [ref('statement', s.id)],
        observation: `${s.code} is a ${s.kind === 'nonnegotiable' ? 'non-negotiable ' : ''}requirement not reflected in any theme, principle or driver.`,
        whyItMatters: 'Requirements that sit outside the framework are easy to miss until late in design.',
        supportingContext: cite(s, 200),
        question: `How should ${s.code} be addressed in the principles or Design Drivers?`,
        nextAction: 'Link it to a theme or principle, or record why it sits outside the framework.',
        evidence: [ref('statement', s.id)],
        method: `${RULES_METHOD}: existing gap analysis (requirement with no framework links)`,
        kind: 'missing_requirement' as const,
        payload: { question: `How should ${s.code} (“${s.originalText.slice(0, 160)}”) be addressed in the guiding principles and Design Drivers?` },
      })),
}

/** Source completeness and attribution — Evidence workspace. */
const evidenceGaps: Rule = {
  id: 'evidence-gaps',
  modes: ['explore', 'challenge'],
  workspaces: ['understand/evidence', 'project'],
  run: (data, mode) => {
    const out: Observation[] = []
    const empty = data.sources.filter((src) => !data.statements.some((s) => s.sourceId === src.id))
    if (empty.length)
      out.push({
        rule: 'evidence-gaps:empty-sources',
        mode,
        tier: 2,
        subjects: empty.map((s) => ref('source', s.id)),
        observation: `${empty.length} source${empty.length === 1 ? ' has' : 's have'} no recorded statements: ${empty.map((s) => s.code).join(', ')}.`,
        whyItMatters: 'Unread sources may hold requirements or perspectives the synthesis is missing.',
        supportingContext: empty.map((s) => `${s.code} ${s.title}`).join(' · '),
        question: 'Have these been reviewed, and is there anything in them we should capture?',
        nextAction: 'Record key statements, or note that the source has nothing new.',
        evidence: empty.slice(0, 10).map((s) => ref('source', s.id)),
        method: `${RULES_METHOD}: sources without statements`,
      })
    const unverified = data.statements.filter((s) => s.transcriptionStatus === 'unverified' || s.transcriptionStatus === 'uncertain')
    if (unverified.length)
      out.push({
        rule: 'evidence-gaps:transcription',
        mode,
        tier: unverified.some((s) => isWeighty(data, s) || s.criticality === 'high') ? 1 : 3,
        subjects: statementRefs(unverified.map((s) => s.id)),
        observation: `${unverified.length} handwritten transcription${unverified.length === 1 ? ' is' : 's are'} not yet verified.`,
        whyItMatters: 'Quotes shown to the Owner should be exactly what was written.',
        supportingContext: unverified.slice(0, 3).map((s) => cite(s)).join(' · '),
        question: 'Can someone who was in the room confirm these words?',
        nextAction: 'Verify the transcriptions beside their photographs.',
        evidence: statementRefs(unverified.slice(0, 6).map((s) => s.id)),
        method: `${RULES_METHOD}: transcription status`,
      })
    const anonymous = data.statements.filter((s) => !s.speaker.trim())
    if (anonymous.length)
      out.push({
        rule: 'evidence-gaps:attribution',
        mode,
        tier: 2,
        subjects: statementRefs(anonymous.map((s) => s.id)),
        observation: `${anonymous.length} statement${anonymous.length === 1 ? ' has' : 's have'} no attribution.`,
        whyItMatters: 'Without attribution, it is hard to tell whose perspective a statement represents.',
        supportingContext: anonymous.slice(0, 3).map((s) => cite(s)).join(' · '),
        question: 'Who said or wrote these?',
        nextAction: 'Add a speaker or group where known.',
        evidence: statementRefs(anonymous.slice(0, 6).map((s) => s.id)),
        method: `${RULES_METHOD}: missing speaker`,
      })
    return out
  },
}

// ---------------------------------------------------------------------------
// DEVELOP — What could this become?
// ---------------------------------------------------------------------------

const visionAlternatives: Rule = {
  id: 'vision-alternatives',
  modes: ['develop'],
  workspaces: ['interpret/vision', 'interpret/point-of-view', 'project'],
  run: (data) => {
    const active = data.winThemes.filter((w) => isActiveFramework(w.status) && w.status !== 'not_adopted')
    const t = data.project.terminology.winTheme
    if (active.length >= 2) return []
    const promise = data.statements.find((s) => isWeighty(data, s) && s.kind === 'aspiration') ?? data.statements.find((s) => s.kind === 'aspiration')
    return [
      {
        rule: 'vision-alternatives',
        mode: 'develop',
        tier: 1,
        subjects: active.map((w) => ref('winTheme', w.id)),
        observation: active.length ? `Only one ${t.toLowerCase()} is on the table.` : `No ${t.toLowerCase()} has been drafted yet.`,
        whyItMatters: 'Comparing genuinely different narratives helps the team — and the Owner — see what the central opportunity really is.',
        supportingContext: promise ? cite(promise) : 'No aspiration statements recorded.',
        question: `What alternative ${t.toLowerCase()}s could express the central opportunity from a different angle?`,
        nextAction: 'Use a framing below as a starting point and write an alternative in your own words.',
        evidence: promise ? [ref('statement', promise.id)] : [],
        method: `${RULES_METHOD}: count of active alternatives`,
        exploration: {
          question: `Which framing could carry a second ${t.toLowerCase()}?`,
          basis: 'Curated narrative framings — prompts for the team to write from, not generated wording.',
          directions: [
            { id: 'promise', title: 'A promise framing', summary: `Start from who depends on the building${promise ? ` — e.g. ${quoted(promise.originalText)}` : ''} — and what it promises them.` },
            { id: 'capability', title: 'A capability framing', summary: 'Start from what the building makes possible that is not possible today.' },
            { id: 'experience', title: 'An experience framing', summary: 'Start from how it should feel to work in, arrive at, or depend on the place.' },
          ],
        },
      },
    ]
  },
}

const LENS_OPPORTUNITY_PROMPTS: Record<string, string[]> = {
  continuity: ['How might failures be prevented, contained or noticed early?', 'How should it feel to work here during a disruption?'],
  flow: ['Where do people and product cross today, and what if they didn’t?', 'How might the building make the state of the operation visible?'],
  people: ['Where could people recover during a long shift?', 'How might daylight, views and ergonomics support focus?'],
  growth: ['What would it take to grow without stopping the operation?', 'Which parts should be easy to change, and which can be permanent?'],
  community: ['How might the facility be part of local workforce development?', 'Where could the building meet its neighbors?'],
  certainty: ['Which design decisions could be made earlier, with less risk?', 'What could be validated with a mock-up before committing?'],
  safety: ['Where does separation protect people, and where does it get in the way?'],
  care: ['How might the people the building serves be present in the daily experience of those who work there?'],
  space: ['Where could one space do two jobs without compromising either?'],
  learning: ['Where might learning happen outside the classroom?'],
  discovery: ['Where might chance encounters between researchers happen?'],
  collaboration: ['Where would teams naturally meet across shifts or disciplines?'],
}

const opportunitiesFromPrinciple: Rule = {
  id: 'opportunities-from-principle',
  modes: ['develop'],
  workspaces: ['interpret/principles', 'interpret/opportunities', 'project'],
  run: (data) =>
    activePrinciples(data)
      .map((p) => ({ p, n: data.opportunities.filter((o) => o.principleIds.includes(p.id)).length, lenses: rankedLenses(principleText(p)) }))
      .filter((x) => x.n < 2 && x.lenses.length)
      .slice(0, 3)
      .map(({ p, n, lenses }) => ({
        rule: 'opportunities-from-principle',
        mode: 'develop' as const,
        tier: (n === 0 ? 1 : 2) as 1 | 2,
        subjects: [ref('principle', p.id)],
        observation: `${p.code} ${quoted(p.title)} has ${n === 0 ? 'no' : 'only one'} design opportunit${n === 1 ? 'y' : 'ies'}.`,
        whyItMatters: 'Opportunities show the Owner how a principle could shape the design — without prescribing a solution.',
        supportingContext: p.designImplications || p.statement,
        question: 'What possibilities does this principle open up for the design?',
        nextAction: 'Develop one of the prompts below into an emerging opportunity, in your own words.',
        evidence: [ref('principle', p.id)],
        method: `${RULES_METHOD}: opportunity count per principle; prompts from a curated list for the principle’s concepts`,
        exploration: {
          question: `What opportunities might follow from ${quoted(p.title)}?`,
          basis: 'Curated prompts matched to the principle’s concepts. They are questions to design from, not solutions.',
          directions: lenses
            .flatMap((l) => (LENS_OPPORTUNITY_PROMPTS[l] ?? []).map((q, i) => ({ id: `${l}-${i}`, title: q, summary: `From the principle’s focus on ${lensById(l).phrase}.` })))
            .slice(0, 3),
        },
      })),
}

const operationalToHuman: Rule = {
  id: 'operational-to-human',
  modes: ['develop'],
  workspaces: ['interpret/principles', 'interpret/opportunities', 'interpret/point-of-view', 'project'],
  run: (data) =>
    activePrinciples(data)
      .filter((p) => {
        const ls = rankedLenses(principleText(p))
        return ls.length && lensById(ls[0]).nature === 'operational' && !ls.some((l) => lensById(l).nature === 'human')
      })
      .slice(0, 2)
      .map((p) => ({
        rule: 'operational-to-human',
        mode: 'develop' as const,
        tier: 2 as const,
        subjects: [ref('principle', p.id)],
        observation: `${p.code} ${quoted(p.title)} is framed operationally, with no reference to how people will experience it.`,
        whyItMatters: 'Owners connect more readily with operational aspirations when they can picture what changes for people.',
        supportingContext: p.statement,
        question: 'How might this operational aspiration translate into a meaningful human experience?',
        nextAction: 'Capture a sentence on what people would notice, as a working idea or in “why it matters”.',
        evidence: [ref('principle', p.id)],
        method: `${RULES_METHOD}: principle’s concepts are operational only (curated vocabulary)`,
      })),
}

const outcomesFromPrinciples: Rule = {
  id: 'outcomes-from-principles',
  modes: ['develop'],
  workspaces: ['interpret/success', 'interpret/opportunities', 'project'],
  run: (data) => {
    const out: Observation[] = []
    for (const p of activePrinciples(data)) {
      const os = data.outcomes.filter((o) => o.principleId === p.id)
      if (!os.length)
        out.push({
          rule: 'outcomes-missing',
          mode: 'develop',
          tier: 1,
          subjects: [ref('principle', p.id)],
          observation: `${p.code} ${quoted(p.title)} has no potential outcomes.`,
          whyItMatters: 'Describing what would be different helps connect the vision to the future design — without committing to targets.',
          supportingContext: p.statement,
          question: `If we deliver on ${quoted(p.title)}, what would people notice?`,
          nextAction: 'Capture one or two outcomes in plain language. Leave measures for later.',
          evidence: [ref('principle', p.id)],
          method: `${RULES_METHOD}: outcome count per principle`,
        })
      else if (os.every((o) => o.category === 'operational' || o.category === 'quantitative'))
        out.push({
          rule: 'outcomes-human',
          mode: 'develop',
          tier: 2,
          subjects: [ref('principle', p.id)],
          observation: `${p.code}’s outcomes are all operational or quantitative.`,
          whyItMatters: 'Some of the most meaningful outcomes are experienced rather than counted.',
          supportingContext: os.map((o) => o.statement).join(' · '),
          question: 'Is there an experiential or qualitative outcome that would matter to the Owner?',
          nextAction: 'Add a qualitative outcome. Do not invent a target or baseline.',
          evidence: [ref('principle', p.id), ...os.map((o) => ref('outcome', o.id))],
          method: `${RULES_METHOD}: outcome categories per principle`,
        })
    }
    return out
  },
}

const povFromHeard: Rule = {
  id: 'pov-from-heard',
  modes: ['develop'],
  workspaces: ['interpret/point-of-view', 'understand/heard', 'project'],
  run: (data) => {
    const t = data.heard.filter((h) => h.section === 'tension' && h.reviewed)
    if (!t.length || data.pointOfView?.tensions) return []
    return [
      {
        rule: 'pov-from-heard',
        mode: 'develop',
        tier: 1,
        subjects: [],
        observation: `What We Heard records ${t.length} tension${t.length === 1 ? '' : 's'}, but the point of view does not name any.`,
        whyItMatters: 'A point of view that names its tensions shows the Owner that the direction has been tested.',
        supportingContext: t.map((h) => h.title).join(' · '),
        question: 'Which of these tensions should the direction openly navigate?',
        nextAction: 'Draft the tensions section of the point of view.',
        evidence: t.flatMap((h) => h.evidence).slice(0, 6),
        method: `${RULES_METHOD}: tensions in What We Heard compared with the point of view`,
      },
    ]
  },
}

// ---------------------------------------------------------------------------
// REFINE — How could we make it stronger?
// ---------------------------------------------------------------------------

const genericLanguage: Rule = {
  id: 'generic-language',
  modes: ['refine'],
  workspaces: ['interpret/principles', 'interpret/vision', 'interpret/opportunities', 'interpret/point-of-view', 'project'],
  run: (data) => {
    const items: { ref: NodeRef; code: string; text: string }[] = [
      ...activePrinciples(data).map((p) => ({ ref: ref('principle', p.id), code: p.code, text: `${p.title} ${p.statement}` })),
      ...data.winThemes.filter((w) => isActiveFramework(w.status)).map((w) => ({ ref: ref('winTheme', w.id), code: w.code, text: `${w.statement} ${w.narrative}` })),
      ...data.opportunities.map((o) => ({ ref: ref('opportunity', o.id), code: o.code, text: `${o.title} ${o.description}` })),
    ]
    return items
      .map((i) => ({ i, terms: GENERIC_TERMS.filter((g) => i.text.toLowerCase().includes(g)) }))
      .filter((x) => x.terms.length)
      .map(({ i, terms }) => ({
        rule: 'generic-language',
        mode: 'refine' as const,
        tier: 1 as const,
        subjects: [i.ref],
        observation: `${i.code} uses generic language: ${terms.map(quoted).join(', ')}.`,
        whyItMatters: 'Generic words could describe any project. Specific language shows the Owner that the direction is theirs.',
        supportingContext: i.text,
        question: 'What would this mean specifically on this project?',
        nextAction: 'Replace the generic term with what it means here.',
        evidence: [i.ref],
        method: `${RULES_METHOD}: curated list of generic design terms`,
      }))
  },
}

const SOLUTION_WORDS = /\b(atrium|corridor|hallway|courtyard|skylight|glass wall|break ?room|lounge|robot|conveyor|mezzanine|lobby|elevator|canopy|green roof)s?\b/i

const prescriptiveDirection: Rule = {
  id: 'prescriptive-direction',
  modes: ['refine', 'challenge'],
  workspaces: ['interpret/principles', 'interpret/opportunities', 'interpret/vision', 'project'],
  run: (data, mode) => {
    const items: { ref: NodeRef; code: string; text: string }[] = [
      ...activePrinciples(data).map((p) => ({ ref: ref('principle', p.id), code: p.code, text: `${p.title}. ${p.statement}` })),
      ...data.opportunities.map((o) => ({ ref: ref('opportunity', o.id), code: o.code, text: `${o.title}. ${o.description}` })),
    ]
    return items
      .map((i) => ({ i, m: SOLUTION_WORDS.exec(i.text) }))
      .filter((x): x is { i: (typeof items)[number]; m: RegExpExecArray } => !!x.m)
      .map(({ i, m }) => ({
        rule: 'prescriptive-direction',
        mode,
        tier: 1 as const,
        subjects: [i.ref],
        observation: `${i.code} names a specific design element: ${quoted(m[0])}.`,
        whyItMatters: 'Principles and opportunities are most useful when they establish direction and leave the design response open.',
        supportingContext: i.text,
        question: 'Are we prescribing a solution rather than establishing direction?',
        nextAction: 'Describe what the element is meant to achieve, and keep the element itself as one possible response.',
        evidence: [i.ref],
        method: `${RULES_METHOD}: building-element vocabulary in a principle or opportunity`,
      }))
  },
}

const narrativeStrength: Rule = {
  id: 'narrative-strength',
  modes: ['refine'],
  workspaces: ['interpret/principles', 'interpret/vision', 'understand/heard', 'project'],
  run: (data) => {
    const out: Observation[] = []
    for (const p of activePrinciples(data)) {
      const words = p.statement.trim().split(/\s+/).filter(Boolean).length
      if (!p.whyItMatters)
        out.push({
          rule: 'narrative:why',
          mode: 'refine',
          tier: 1,
          subjects: [ref('principle', p.id)],
          observation: `${p.code} does not yet say why it matters.`,
          whyItMatters: 'The Owner is more likely to own a principle when the reasoning is visible.',
          supportingContext: p.statement,
          question: 'What did we hear that makes this principle important?',
          nextAction: 'Write “why it matters” from the linked evidence.',
          evidence: [ref('principle', p.id)],
          method: `${RULES_METHOD}: missing “why it matters”`,
        })
      if (words > 40 || (words > 0 && words < 6))
        out.push({
          rule: 'narrative:length',
          mode: 'refine',
          tier: 2,
          subjects: [ref('principle', p.id)],
          observation: `${p.code}’s statement is ${words > 40 ? `long (${words} words)` : `very short (${words} words)`}.`,
          whyItMatters: words > 40 ? 'Owners remember short principles; detail can move into “why it matters”.' : 'A very short statement can be hard to apply consistently.',
          supportingContext: p.statement,
          question: words > 40 ? 'Can this be said more simply?' : 'What does this principle ask the design to do?',
          nextAction: 'Try a version with one clear idea.',
          evidence: [ref('principle', p.id)],
          method: `${RULES_METHOD}: word count`,
        })
      if (p.title.trim().split(/\s+/).length > 6)
        out.push({
          rule: 'narrative:title',
          mode: 'refine',
          tier: 2,
          subjects: [ref('principle', p.id)],
          observation: `${p.code}’s title is long (${p.title.trim().split(/\s+/).length} words).`,
          whyItMatters: 'Short titles are easier to recall in design reviews.',
          supportingContext: p.title,
          question: 'Could the title be more compelling in three or four words?',
          nextAction: 'Try two alternative titles on the Working Canvas.',
          evidence: [ref('principle', p.id)],
          method: `${RULES_METHOD}: title length`,
        })
    }
    for (const w of data.winThemes.filter((x) => isActiveFramework(x.status) && !x.narrative.trim()))
      out.push({
        rule: 'narrative:vision',
        mode: 'refine',
        tier: 1,
        subjects: [ref('winTheme', w.id)],
        observation: `${w.code} has no supporting narrative.`,
        whyItMatters: 'The narrative explains why the direction matters; without it the statement must carry everything.',
        supportingContext: w.statement,
        question: 'In two sentences, why does this matter to the Owner?',
        nextAction: 'Draft a narrative from the point of view.',
        evidence: [ref('winTheme', w.id)],
        method: `${RULES_METHOD}: missing narrative`,
      })
    return out
  },
}

const alternativesSimilar: Rule = {
  id: 'alternatives-similar',
  modes: ['refine'],
  workspaces: ['interpret/vision', 'interpret/point-of-view', 'project'],
  run: (data) => {
    const ws = data.winThemes.filter((w) => isActiveFramework(w.status) && w.status !== 'not_adopted')
    if (ws.length < 2) return []
    const leads = ws.map((w) => rankedLenses(`${w.statement} ${w.narrative}`)[0]).filter(Boolean)
    if (new Set(leads).size !== 1 || leads.length !== ws.length) return []
    return [
      {
        rule: 'alternatives-similar',
        mode: 'refine',
        tier: 2,
        subjects: ws.map((w) => ref('winTheme', w.id)),
        observation: `The ${ws.length} ${data.project.terminology.winTheme.toLowerCase()} alternatives lead with the same idea: ${lensById(leads[0]).phrase}.`,
        whyItMatters: 'Alternatives that differ only in wording do not help the Owner choose a direction.',
        supportingContext: ws.map((w) => `${w.code}: ${w.statement}`).join(' · '),
        question: 'Could they combine into one stronger expression — or should one take a genuinely different angle?',
        nextAction: 'Try a combined version, or a deliberately different framing, on the Working Canvas.',
        evidence: ws.map((w) => ref('winTheme', w.id)),
        method: `${RULES_METHOD}: leading concept lens of each alternative`,
      },
    ]
  },
}

const heardBalance: Rule = {
  id: 'heard-balance',
  modes: ['refine', 'challenge'],
  workspaces: ['understand/heard', 'project'],
  run: (data, mode) => {
    const out: Observation[] = []
    const shown = data.heard.filter((h) => h.reviewed && h.inPresentation)
    const missing = (['aspiration', 'tension', 'perspective'] as const).filter((s) => !shown.some((h) => h.section === s))
    if (data.heard.length && missing.length)
      out.push({
        rule: 'heard-balance:sections',
        mode,
        tier: 2,
        subjects: [],
        observation: `What We Heard has nothing ready to present under: ${missing.join(', ')}.`,
        whyItMatters: 'A balanced synthesis shows the Owner aspirations, tensions and perspectives — not only agreement.',
        supportingContext: `${shown.length} item(s) ready to present.`,
        question: 'Is something missing, or is the omission deliberate?',
        nextAction: 'Review the evidence for the missing sections.',
        evidence: [],
        method: `${RULES_METHOD}: section coverage of reviewed, presented items`,
      })
    const unreviewed = data.heard.filter((h) => !h.reviewed)
    if (unreviewed.length)
      out.push({
        rule: 'heard-balance:unreviewed',
        mode,
        tier: 2,
        subjects: [],
        observation: `${unreviewed.length} What We Heard item${unreviewed.length === 1 ? ' is' : 's are'} awaiting team review: ${unreviewed.map((h) => quoted(h.title)).join(', ')}.`,
        whyItMatters: 'Unreviewed items are excluded from the Owner presentation.',
        supportingContext: unreviewed.map((h) => h.narrative).join(' · ').slice(0, 400),
        question: 'Should these be confirmed, reworded or set aside?',
        nextAction: 'Review them in What We Heard.',
        evidence: [],
        method: `${RULES_METHOD}: review flag`,
      })
    return out
  },
}

export const RULES: Rule[] = [
  connectedAmbition,
  relatedThemes,
  perspectives,
  underAttended,
  concernsToOpportunity,
  principleOverlap,
  tensions,
  solutionVsNeed,
  weakSupport,
  frequencyVsImportance,
  requirementsNotInFramework,
  evidenceGaps,
  visionAlternatives,
  opportunitiesFromPrinciple,
  operationalToHuman,
  outcomesFromPrinciples,
  povFromHeard,
  genericLanguage,
  prescriptiveDirection,
  narrativeStrength,
  alternativesSimilar,
  heardBalance,
]
