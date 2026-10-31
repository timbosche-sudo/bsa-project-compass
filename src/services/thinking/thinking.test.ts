import { describe, expect, it } from 'vitest'
import { createDemoProject, createEmptyProject, PEOPLE } from '@/data/seed/demoProject'
import { applyCommand } from '@/domain/commands'
import { normalizeProjectData } from '@/domain/normalize'
import { nodeExists } from '@/domain/traceability'
import type { ProjectData } from '@/domain/types'
import type { DataAdapter } from '@/data/adapter'
import { buildProjectContext, describeScope, focusFromLocation, workspaceFromPath } from './context'
import { analyze, NO_OBSERVATIONS } from './engine'
import { prescriptiveRequest } from './rules'
import { ApprovedAiThinkingProvider, RulesThinkingProvider, validateSuggestions } from './providers'

let clock = Date.parse('2026-11-01T15:00:00.000Z')
const run = (d: ProjectData, cmd: unknown, actor: string = PEOPLE.avery.id) => applyCommand(d, cmd, { actorId: actor, now: new Date((clock += 60_000)).toISOString() })
const rules = new RulesThinkingProvider()

async function suggest(d: ProjectData, req: Parameters<typeof analyze>[1]) {
  const r = await rules.analyze(d, req)
  const next = r.suggestions.length ? run(d, { type: 'suggestion.add', suggestions: r.suggestions.map((s) => ({ ...s, origin: 'rules', provider: rules.label })) }).data : d
  return { data: next, result: r }
}

describe('context', () => {
  it('derives the workspace and selected item from the URL', () => {
    expect(workspaceFromPath('/projects/p/interpret/principles')).toBe('interpret/principles')
    expect(workspaceFromPath('/projects/p/drivers')).toBe('project')
    expect(focusFromLocation('/projects/p/interpret/principles', '?principle=gp-3')).toEqual({ type: 'principle', id: 'gp-3' })
    expect(focusFromLocation('/projects/p/understand/evidence/src-2', '')).toEqual({ type: 'source', id: 'src-2' })
  })
  it('states clearly what is being analyzed', () => {
    const d = createDemoProject()
    expect(describeScope(buildProjectContext(d, 'interpret/principles', 'challenge', null))).toBe('6 principles and their evidence')
    expect(describeScope(buildProjectContext(d, 'interpret/principles', 'challenge', { type: 'principle', id: 'gp-1' }))).toBe('GP-01 Reliability by Design')
  })
})

describe('Evidence Intelligence (rules)', () => {
  it('1. finds evidence gaps in the Evidence workspace', async () => {
    const r = await analyze(createDemoProject(), { workspace: 'understand/evidence', mode: 'explore', focus: null, depth: 'deeper' })
    expect(r.suggestions.map((s) => s.title).join('\n')).toMatch(/sources have no recorded statements|transcription/)
  })

  it('2. identifies a possible relationship between themes, with evidence', async () => {
    const r = await analyze(createDemoProject(), { workspace: 'understand/themes', mode: 'explore', focus: null, depth: 'deeper' })
    const rel = r.suggestions.find((s) => s.card?.fingerprint.startsWith('related-themes'))!
    expect(rel.title).toMatch(/TH-01 .* and TH-03 .* both draw on continuity and reliability/)
    expect(rel.card!.evidenceStatus).toBe('direct')
    expect(rel.card!.exploration!.directions.length).toBeGreaterThan(0)
  })

  it('3. challenges overlapping principles as a question, offering options without merging', async () => {
    const d = createDemoProject()
    const r = await analyze(d, { workspace: 'interpret/principles', mode: 'challenge', focus: null, depth: 'focused' })
    const o = r.suggestions.find((s) => s.card?.fingerprint.startsWith('principle-overlap'))!
    expect(o.title).toBe('Potential relationship: “Reliability by Design” and “Adapt Without Disruption” both address continuity and reliability, but from different perspectives.')
    expect(o.card!.question).toBe('Are these distinct commitments, or should their relationship be made more explicit?')
    expect(o.card!.exploration!.directions.map((x) => x.id)).toEqual(['combine', 'clarify', 'link'])
    expect(o.card!.method).toMatch(/shared keywords alone are not used/)
  })

  it('4. identifies a prescriptive request and asks about the need behind it', async () => {
    expect(prescriptiveRequest('We need another corridor.')).toEqual({ thing: 'corridor', need: 'movement, access or separation need' })
    expect(prescriptiveRequest('Keep the hazardous compounding suite separate from the main fill line.')?.need).toMatch(/separation/)
    expect(prescriptiveRequest('The facility shall maintain continuous operations.')).toBeNull()
    const r = await analyze(createDemoProject(), { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper' })
    const s = r.suggestions.find((x) => x.card?.fingerprint.startsWith('solution-vs-need'))!
    expect(s.title).toBe('ST-019 requests a specific solution: “break room”.')
    expect(s.card!.question).toBe('What activity, recovery or support need is motivating this request?')
  })

  it('5. offers a guided exploration of connected priorities, labelled as a curated pattern', async () => {
    const r = await analyze(createDemoProject(), { workspace: 'understand/themes', mode: 'explore', focus: null, depth: 'focused' })
    const x = r.suggestions[0].card!
    expect(x.exploration!.question).toMatch(/separate objectives, or might they be connected by a larger ambition/)
    expect(x.exploration!.basis).toMatch(/Curated exploration pattern/)
    expect(x.exploration!.directions).toHaveLength(3)
  })

  it('treats a missing sector perspective as a question, and a mentioned-but-unheard group as a likely gap', async () => {
    const r = await analyze(createDemoProject(), { workspace: 'understand/evidence', mode: 'explore', focus: null, depth: 'deeper' })
    const patients = r.suggestions.find((s) => s.card?.fingerprint.startsWith('perspective:patients'))!
    expect(patients.title).toMatch(/mentioned in 2 statements, but no statement comes from them directly/)
    expect(patients.card!.evidenceStatus).toBe('direct')
    const learning = createEmptyProject({ id: 'l', code: 'L', name: 'L', tagline: '', sector: 'learning', phase: 'programming', location: '', description: '', owner: { name: 'O', type: '', mission: '' }, adminId: PEOPLE.avery.id, people: [PEOPLE.avery], isDemo: true })
    learning.sources.push({ ...createDemoProject().sources[0], id: 's1' })
    for (let i = 0; i < 3; i++) learning.statements.push({ ...createDemoProject().statements[0], id: `x${i}`, code: `ST-00${i}`, sourceId: 's1', speaker: 'Dean of Students', originalText: 'We need more natural light in the library.' })
    const lr = await analyze(learning, { workspace: 'understand/evidence', mode: 'explore', focus: null, depth: 'deeper' })
    const faculty = lr.suggestions.find((s) => s.card?.fingerprint.startsWith('perspective:faculty'))
    expect(faculty?.card!.evidenceStatus).toBe('inference')
    expect(faculty?.card!.question).toMatch(/^Is the perspective of faculty and teaching staff relevant/)
    expect(lr.suggestions.some((s) => s.card?.fingerprint.startsWith('perspective:patients'))).toBe(false)
  })

  it('shows at most three observations per focused analysis, each from a different rule', async () => {
    for (const mode of ['explore', 'challenge', 'develop', 'refine'] as const) {
      const r = await analyze(createDemoProject(), { workspace: 'project', mode, focus: null, depth: 'focused' })
      expect(r.suggestions.length).toBeLessThanOrEqual(3)
      const families = r.suggestions.map((s) => s.card!.fingerprint.split('|')[0].split(':')[0])
      expect(new Set(families).size).toBe(families.length)
    }
  })

  it('9. only cites references that exist, and labels evidence status truthfully', async () => {
    const d = createDemoProject()
    for (const workspace of ['understand/evidence', 'understand/themes', 'interpret/principles', 'interpret/success'] as const)
      for (const mode of ['explore', 'challenge', 'develop', 'refine'] as const) {
        const r = await analyze(d, { workspace, mode, focus: null, depth: 'deeper' })
        for (const s of r.suggestions) {
          expect(s.evidence.every((e) => nodeExists(d, e))).toBe(true)
          const hasStatement = s.evidence.some((e) => e.type === 'statement')
          expect(s.card!.evidenceStatus).toBe(hasStatement ? 'direct' : s.evidence.length ? 'indirect' : 'inference')
          expect(s.card!.method).toMatch(/^Rule-based analysis/)
        }
      }
  })

  it('validation drops suggestions that cite missing items or mislabel their evidence', () => {
    const d = createDemoProject()
    const base = { kind: 'observation' as const, title: 't', body: '', target: null, payload: {} }
    const card = { mode: 'explore' as const, observation: 'o', whyItMatters: '', supportingContext: '', question: '', nextAction: '', method: 'Rule-based analysis', fingerprint: 'f', evidenceKey: 'k', scope: { workspace: 'project', focus: null } }
    expect(validateSuggestions([{ ...base, evidence: [{ type: 'statement', id: 'st-999' }], card: { ...card, evidenceStatus: 'direct' } }], d)).toHaveLength(0)
    expect(validateSuggestions([{ ...base, evidence: [], card: { ...card, evidenceStatus: 'direct' } }], d)).toHaveLength(0)
    expect(validateSuggestions([{ ...base, evidence: [{ type: 'statement', id: 'st-1' }], card: { ...card, evidenceStatus: 'direct' } }], d)).toHaveLength(1)
  })

  it('returns no observations when the evidence does not justify any', async () => {
    const empty = createEmptyProject({ id: 'e', code: 'E', name: 'Empty', tagline: '', sector: 'other', phase: 'strategy', location: '', description: '', owner: { name: 'O', type: '', mission: '' }, adminId: PEOPLE.avery.id, people: [PEOPLE.avery], isDemo: true })
    for (const mode of ['challenge', 'develop', 'refine'] as const) {
      const r = await analyze(empty, { workspace: 'interpret/principles', mode, focus: null, depth: 'deeper' })
      expect(r.suggestions).toHaveLength(0)
    }
    expect(NO_OBSERVATIONS).toBe('No significant observations identified from the available evidence.')
  })

  it('analyzes a specific item when one is selected', async () => {
    const r = await analyze(createDemoProject(), { workspace: 'interpret/principles', mode: 'challenge', focus: { type: 'principle', id: 'gp-6' }, depth: 'deeper' })
    expect(r.suggestions.every((s) => [...s.evidence, s.target].some((x) => x?.type === 'principle' && x.id === 'gp-6'))).toBe(true)
  })
})

describe('review actions and the Working Canvas', () => {
  it('6. saves a suggestion to the canvas with its origin and evidence', async () => {
    const { data: d } = await suggest(createDemoProject(), { workspace: 'interpret/principles', mode: 'challenge', focus: null, depth: 'focused' })
    const s = d.suggestions.find((x) => x.card?.fingerprint.startsWith('principle-overlap'))!
    const r = run(d, { type: 'suggestion.toCanvas', id: s.id })
    const item = r.data.canvas.find((i) => i.id === r.createdId)!
    expect(item).toMatchObject({ origin: 'rules', sourceSuggestionId: s.id, state: 'exploring', kind: 'question' })
    expect(item.evidence).toEqual(s.evidence)
    expect(r.data.suggestions.find((x) => x.id === s.id)!.status).toBe('saved')
  })

  it('7. a dismissed or not-relevant suggestion does not reappear unless the evidence changes or the team asks', async () => {
    let { data: d } = await suggest(createDemoProject(), { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper' })
    const s = d.suggestions.find((x) => x.card?.fingerprint.startsWith('solution-vs-need'))!
    d = run(d, { type: 'suggestion.markNotRelevant', id: s.id }).data
    const again = await analyze(d, { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper' })
    expect(again.suggestions.some((x) => x.card?.fingerprint === s.card!.fingerprint)).toBe(false)
    expect(again.suppressed).toBeGreaterThan(0)
    const asked = await analyze(d, { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper', includeSetAside: true })
    expect(asked.suggestions.some((x) => x.card?.fingerprint === s.card!.fingerprint)).toBe(true)
    // Changed evidence: the statement is corrected, so the observation may be raised again.
    d.statements.find((x) => x.id === 'st-19')!.originalText = 'Night shift needs a break room that is not a hallway, near the fill line.'
    const changed = await analyze(d, { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper' })
    expect(changed.suggestions.some((x) => x.card?.fingerprint === s.card!.fingerprint)).toBe(true)
  })

  it('saves a suggestion as a Critical Question', async () => {
    const { data: d } = await suggest(createDemoProject(), { workspace: 'understand/evidence', mode: 'challenge', focus: null, depth: 'deeper' })
    const s = d.suggestions.find((x) => x.card?.fingerprint.startsWith('solution-vs-need'))!
    const r = run(d, { type: 'suggestion.saveQuestion', id: s.id })
    expect(r.data.questions.at(-1)!.question).toBe('What activity, recovery or support need is motivating this request?')
    expect(r.data.questions.at(-1)!.context).toEqual([{ type: 'statement', id: 'st-19' }])
  })

  it('8 & 10. promotes a reviewed idea into a draft, leaving approved content unchanged', () => {
    let d = createDemoProject()
    const before = JSON.stringify({ principles: d.principles, winThemes: d.winThemes, opportunities: d.opportunities })
    const c = run(d, { type: 'canvas.create', item: { kind: 'opportunity', title: 'Visible resilience', body: 'Let staff see the state of critical systems.', evidence: [{ type: 'statement', id: 'st-24' }], context: { workspace: 'interpret/principles', focus: { type: 'principle', id: 'gp-1' } } }, origin: 'human', sourceSuggestionId: null })
    d = run(c.data, { type: 'canvas.update', id: c.createdId, patch: { state: 'worth_developing' } }).data
    const p = run(d, { type: 'canvas.promote', id: c.createdId, target: 'opportunity', principleId: 'gp-1' })
    const opp = p.data.opportunities.at(-1)!
    expect(opp).toMatchObject({ title: 'Visible resilience', state: 'emerging', inPresentation: false, principleIds: ['gp-1'], origin: 'human' })
    expect(p.data.canvas.find((i) => i.id === c.createdId)).toMatchObject({ state: 'incorporated', promotedTo: { target: 'opportunity', ref: { type: 'opportunity', id: opp.id } } })
    // Every existing principle, vision and opportunity is exactly as it was.
    const after = JSON.parse(JSON.stringify({ principles: p.data.principles, winThemes: p.data.winThemes, opportunities: p.data.opportunities.slice(0, -1) }))
    expect(after).toEqual(JSON.parse(before))
    expect(() => run(p.data, { type: 'canvas.promote', id: c.createdId, target: 'question' })).toThrow(/already been incorporated/)
  })

  it('promotes to What We Heard as an unreviewed draft and to the point of view as a non-recommended alternative', () => {
    let d = createDemoProject()
    const a = run(d, { type: 'canvas.create', item: { kind: 'connection', title: 'Reliability is a staff experience', body: 'x', evidence: [{ type: 'statement', id: 'st-6' }], context: { workspace: 'understand/themes', focus: null } }, origin: 'rules', sourceSuggestionId: null })
    d = run(a.data, { type: 'canvas.promote', id: a.createdId, target: 'heard', section: 'theme' }).data
    expect(d.heard.at(-1)).toMatchObject({ title: 'Reliability is a staff experience', reviewed: false, inPresentation: false, origin: 'rules' })
    const b = run(d, { type: 'canvas.create', item: { kind: 'interpretation', title: 'Adaptability connects efficiency and resilience', body: 'y', evidence: [], context: { workspace: 'interpret/point-of-view', focus: null } }, origin: 'human', sourceSuggestionId: null })
    d = run(b.data, { type: 'canvas.promote', id: b.createdId, target: 'pov_alternative' }).data
    expect(d.pointOfView!.alternatives.at(-1)).toMatchObject({ title: 'Adaptability connects efficiency and resilience', recommended: false })
    expect(d.pointOfView!.alternatives.filter((x) => x.recommended)).toHaveLength(1)
  })

  it('enforces roles: viewers cannot use the canvas; contributors cannot promote into the framework', () => {
    const d = createDemoProject()
    const item = { kind: 'interpretation', title: 'x', body: '', evidence: [], context: { workspace: 'project', focus: null } }
    expect(() => run(d, { type: 'canvas.create', item, origin: 'human', sourceSuggestionId: null }, PEOPLE.casey.id)).toThrow(/Not permitted/)
    const c = run(d, { type: 'canvas.create', item, origin: 'human', sourceSuggestionId: null }, PEOPLE.sam.id)
    expect(() => run(c.data, { type: 'canvas.promote', id: c.createdId, target: 'vision_draft' }, PEOPLE.sam.id)).toThrow(/Not permitted/)
    expect(run(c.data, { type: 'canvas.promote', id: c.createdId, target: 'question' }, PEOPLE.sam.id).data.questions.at(-1)!.question).toBe('x')
  })

  it('14. older data gains an empty canvas, and suggestions from 1.x still load', () => {
    const d = createDemoProject() as Partial<ProjectData>
    delete d.canvas
    const n = normalizeProjectData(d as ProjectData)
    expect(n.canvas).toEqual([])
  })
})

describe('providers', () => {
  it('11. works without any AI provider; the approved-AI provider is present but unavailable', async () => {
    const adapter = { mode: 'demo' } as DataAdapter
    const ai = new ApprovedAiThinkingProvider(adapter)
    expect(ai.status()).toEqual({ available: false, reason: 'Requires an approved AI provider. This demonstration has no AI connection.' })
    await expect(ai.analyze()).rejects.toThrow(/approved AI provider/)
    expect(rules.status().available).toBe(true)
  })
})
