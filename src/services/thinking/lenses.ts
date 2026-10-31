/**
 * Concept lenses: a small, transparent vocabulary for recognizing what a piece
 * of text is about. Matching is by word stem. Lenses are deliberately coarse —
 * they suggest where to look, and every result built on them is presented as a
 * possibility for a person to judge, never as a conclusion.
 */
export interface Lens {
  id: string
  /** Noun phrase used in sentences, e.g. "operational reliability". */
  phrase: string
  terms: string[]
  /** Operational lenses describe how the facility performs; human lenses describe how it is experienced. */
  nature: 'operational' | 'human' | 'civic'
}

export const LENSES: Lens[] = [
  { id: 'continuity', phrase: 'continuity and reliability', nature: 'operational', terms: ['reliab', 'continu', 'disrupt', 'interrupt', 'outage', 'failure', 'backup', 'redundan', 'resilien', 'alarm', 'shut', 'uninterrupt', 'utility'] },
  { id: 'flow', phrase: 'operational flow', nature: 'operational', terms: ['flow', 'criss', 'crossing', 'walk', 'efficien', 'throughput', 'visib', 'handoff', 'hand-off', 'sequence', 'legib', 'aisle', 'one-way', 'seamless'] },
  { id: 'people', phrase: 'staff wellbeing and performance', nature: 'human', terms: ['staff', 'technician', 'wellbeing', 'well-being', 'burn', 'recruit', 'retain', 'retention', 'respite', 'ergonom', 'fatigue', 'daylight', 'window', 'workday', 'stand', 'break'] },
  { id: 'growth', phrase: 'growth and adaptability', nature: 'operational', terms: ['grow', 'growth', 'expan', 'adapt', 'flexib', 'automation', 'refresh', 'capacity', 'volume', 'scal', 'future'] },
  { id: 'community', phrase: 'community value', nature: 'civic', terms: ['community', 'neighbor', 'neighbour', 'partnership', 'workforce', 'training', 'jobs', 'regional'] },
  { id: 'certainty', phrase: 'schedule and decision certainty', nature: 'operational', terms: ['schedule', 'go-live', 'deadline', 'decision', 'delay', 'stall', 'certain', 'timeline', 'velocity'] },
  { id: 'safety', phrase: 'safety and compliance', nature: 'operational', terms: ['safety', 'safe', 'hazard', 'complian', 'contamina', 'regulat', 'secur', 'infection', 'monitor'] },
  { id: 'care', phrase: 'the patient promise', nature: 'human', terms: ['patient', 'dose', 'caregiver', 'compassion', 'medication', 'care'] },
  { id: 'space', phrase: 'space efficiency', nature: 'operational', terms: ['footprint', 'compact', 'square', 'area', 'budget', 'cost'] },
  { id: 'learning', phrase: 'learning and engagement', nature: 'human', terms: ['learn', 'student', 'teach', 'pedagog', 'engage', 'classroom', 'study'] },
  { id: 'discovery', phrase: 'research and discovery', nature: 'human', terms: ['research', 'laborator', 'discover', 'experiment', 'scientist', 'innovat'] },
  { id: 'collaboration', phrase: 'collaboration', nature: 'human', terms: ['collaborat', 'together', 'team', 'shared', 'connect'] },
]

export const lensById = (id: string) => LENSES.find((l) => l.id === id)!

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[“”"’'()[\].,;:!?]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Lens hits in a text: lens id → number of matching words. */
export function lensHits(text: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const w of words(text)) {
    for (const l of LENSES) if (l.terms.some((t) => w.startsWith(t))) out.set(l.id, (out.get(l.id) ?? 0) + 1)
  }
  return out
}

/** Lenses ordered by hit count; ties keep vocabulary order. */
export function rankedLenses(text: string, minHits = 1): string[] {
  return [...lensHits(text).entries()].filter(([, n]) => n >= minHits).sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

const STOP = new Set('a an and are as at be by for from has have in is it its of on or our that the their this to we with without will shall must should can not no all any every each into than then so very more most less just about need needs want also what where when how who why which there here these those been being per through while'.split(' '))

export function keywordSet(text: string): Set<string> {
  return new Set(
    words(text)
      .map((w) => w.replace(/(ing|ed|es|s)$/, ''))
      .filter((w) => w.length > 3 && !STOP.has(w)),
  )
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length
  const union = new Set([...a, ...b]).size
  return union ? inter / union : 0
}

/** Words that tend to make design language generic rather than distinctive. */
export const GENERIC_TERMS = ['world-class', 'world class', 'state-of-the-art', 'state of the art', 'best-in-class', 'best in class', 'cutting-edge', 'cutting edge', 'innovative', 'holistic', 'synergy', 'synergies', 'seamless experience', 'next-generation', 'future-proof', 'first-class', 'iconic', 'excellence']
