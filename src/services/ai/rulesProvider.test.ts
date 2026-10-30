import { describe, expect, it } from 'vitest'
import { applyCommand } from '@/domain/commands'
import { createDemoProject, PEOPLE } from '@/data/seed/demoProject'
import { RulesProvider } from './rulesProvider'
import { assistOutputSchema } from './types'

describe('RulesProvider', () => {
  const p = new RulesProvider()

  it('produces schema-valid suggestions that cite evidence', async () => {
    const d = createDemoProject()
    for (const task of ['suggest_relationships', 'suggest_themes', 'find_missing_requirements', 'validation_questions'] as const) {
      const out = await p.run(task, d)
      expect(assistOutputSchema.safeParse({ suggestions: out }).success).toBe(true)
      for (const s of out) expect(s.evidence.length).toBeGreaterThan(0)
    }
  })

  it('flags the unlinked non-negotiable requirement unless an open question already covers it', async () => {
    const d = createDemoProject()
    // Q-002 already asks about ST-005, so it is not raised twice.
    expect((await p.run('find_missing_requirements', d)).map((s) => s.evidence[0].id)).not.toContain('st-5')
    d.questions = d.questions.filter((q) => q.code !== 'Q-002')
    expect((await p.run('find_missing_requirements', d)).map((s) => s.evidence[0].id)).toContain('st-5')
  })

  it('never proposes numeric targets', async () => {
    const out = await p.run('validation_questions', createDemoProject())
    expect(out.some((s) => s.title.startsWith('DD-01') && /no target/.test(s.title))).toBe(true)
    expect(out.every((s) => !('target' in s.payload))).toBe(true)
  })

  it('suggestions change nothing until accepted by a reviewer', async () => {
    let d = createDemoProject()
    const out = await p.run('suggest_relationships', d)
    const before = d.relationships.length
    d = applyCommand(d, { type: 'suggestion.add', suggestions: out.map((s) => ({ ...s, origin: 'rules', provider: p.label })) }, { actorId: PEOPLE.sam.id, now: '2026-10-30T00:00:00Z' }).data
    expect(d.relationships.length).toBe(before)
    expect(() => applyCommand(d, { type: 'suggestion.accept', id: d.suggestions[0].id }, { actorId: PEOPLE.sam.id, now: '2026-10-30T00:00:00Z' })).toThrow(/Not permitted/)
    const accepted = applyCommand(d, { type: 'suggestion.accept', id: d.suggestions[0].id }, { actorId: PEOPLE.jordan.id, now: '2026-10-30T00:00:00Z' }).data
    expect(accepted.relationships.length).toBe(before + 1)
    expect(accepted.relationships.at(-1)).toMatchObject({ origin: 'rules', reviewedBy: PEOPLE.jordan.id, status: 'accepted' })
  })
})
