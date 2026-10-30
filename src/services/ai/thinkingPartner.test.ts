import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/data/seed/demoProject'
import { RulesProvider } from './rulesProvider'

const rules = new RulesProvider()

describe('thinking partner rules', () => {
  it('raises critical questions with evidence from real statements only', async () => {
    const data = createDemoProject()
    const out = await rules.run('critical_questions', data)
    expect(out.length).toBeGreaterThan(0)
    const ids = new Set(data.statements.map((s) => s.id))
    for (const s of out) for (const e of s.evidence) if (e.type === 'statement') expect(ids.has(e.id)).toBe(true)
    expect(out.some((s) => s.kind === 'missing_perspective' && /Patients/.test(s.title))).toBe(true)
  })

  it('flags solution language as a question about the need', async () => {
    const data = createDemoProject()
    data.statements[0].originalText = 'We need a bigger break room near the fill line.'
    const out = await rules.run('critical_questions', data)
    const hit = out.find((s) => s.kind === 'solution_vs_need' && s.evidence[0].id === data.statements[0].id)
    expect(hit?.payload.question).toMatch(/underlying need/)
  })

  it('reviews principles without proposing new wording', async () => {
    const data = createDemoProject()
    data.principles[1].statement = data.principles[0].statement
    data.principles[1].title = data.principles[0].title
    const out = await rules.run('principle_quality', data)
    expect(out.some((s) => /may overlap/.test(s.title))).toBe(true)
    expect(out.every((s) => s.kind === 'principle_quality' && !('statement' in s.payload))).toBe(true)
  })

  it('does not repeat questions the team has already recorded', async () => {
    const data = createDemoProject()
    const first = await rules.run('critical_questions', data)
    data.questions.push(...first.map((s, i) => ({ id: `qx-${i}`, code: `QX-${i}`, question: String(s.payload.question), context: [], status: 'open' as const, answer: '', raisedBy: 'x', raisedAt: '' })))
    const again = await rules.run('critical_questions', data)
    expect(again.length).toBe(0)
  })
})
