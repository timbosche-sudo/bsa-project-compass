import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/data/seed/demoProject'
import { evaluateCba, informalTotals } from './cba'

describe('Choosing by Advantages', () => {
  it('sums judged importance for eligible alternatives only', () => {
    const dec = createDemoProject().decisions.find((d) => d.id === 'dec-1')!
    const ev = evaluateCba(dec)
    expect(ev.complete).toBe(true)
    expect(ev.eligible).toEqual({ a1: true, a2: true, a3: false })
    expect(ev.totals.a1).toBe(160)
    expect(ev.totals.a2).toBe(70)
    expect(ev.leaders).toEqual(['a1'])
  })

  it('reports blocking issues for missing attributes, advantages and judgments', () => {
    const dec = createDemoProject().decisions.find((d) => d.id === 'dec-2')!
    const ev = evaluateCba(dec)
    expect(ev.complete).toBe(false)
    const messages = ev.issues.map((i) => i.message).join('\n')
    expect(messages).toMatch(/judge the importance/)
    expect(messages).toMatch(/least-preferred/)
    expect(messages).toMatch(/record the attribute/)
    expect(ev.leaders).toEqual([])
  })

  it('never folds cost into importance totals', () => {
    const dec = createDemoProject().decisions.find((d) => d.id === 'dec-1')!
    const cheaper = { ...dec, alternatives: dec.alternatives.map((a) => ({ ...a, cost: a.id === 'a2' ? 1 : a.cost })) }
    expect(evaluateCba(cheaper).totals).toEqual(evaluateCba(dec).totals)
  })

  it('keeps informal scores separate', () => {
    const dec = createDemoProject().decisions.find((d) => d.id === 'dec-2')!
    expect(informalTotals(dec)).toEqual({ b1: 6, b2: 8 })
    expect(evaluateCba(dec).totals).toEqual({ b1: 0, b2: 0 })
  })
})
