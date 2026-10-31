import type { AlignmentResponse, AlignmentStatus, AlignmentTargetType, DirectionContent, ID, ProjectData } from './types'
import { isActiveFramework } from './wording'

export const ALIGNED: AlignmentStatus[] = ['aligned', 'aligned_with_refinements']

/** The most recent recorded response for an item (across sessions), or null when it has never been reviewed. */
export function latestAlignment(data: ProjectData, type: AlignmentTargetType, id: ID): AlignmentResponse | null {
  let best: AlignmentResponse | null = null
  for (const r of data.alignment) if (r.target.type === type && r.target.id === id && (!best || r.at > best.at)) best = r
  return best
}

export function alignmentStatusOf(data: ProjectData, type: AlignmentTargetType, id: ID): AlignmentStatus {
  return latestAlignment(data, type, id)?.status ?? 'not_reviewed'
}

/** Items the Owner is asked to align on: the leading vision and the active principles. */
export function alignmentItems(data: ProjectData): { type: AlignmentTargetType; id: ID; code: string; title: string }[] {
  const vision = data.winThemes.filter((w) => isActiveFramework(w.status) && w.status !== 'not_adopted')
  const principles = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => isActiveFramework(p.status) && p.status !== 'not_adopted')
  return [
    ...vision.map((w) => ({ type: 'winTheme' as const, id: w.id, code: w.code, title: w.statement })),
    ...principles.map((p) => ({ type: 'principle' as const, id: p.id, code: p.code, title: p.title })),
  ]
}

/**
 * Whether the current direction can be recorded as "aligned". Every principle
 * and at least one vision must have an explicit aligned response; anything not
 * reviewed or still under discussion blocks it.
 */
export function alignmentGaps(data: ProjectData): { ready: boolean; blocking: { code: string; title: string; status: AlignmentStatus }[] } {
  const items = alignmentItems(data)
  const withStatus = items.map((i) => ({ ...i, status: alignmentStatusOf(data, i.type, i.id) }))
  const principles = withStatus.filter((i) => i.type === 'principle')
  const visions = withStatus.filter((i) => i.type === 'winTheme')
  const blocking = principles.filter((i) => !ALIGNED.includes(i.status))
  if (visions.length && !visions.some((v) => ALIGNED.includes(v.status))) blocking.unshift(...visions.filter((v) => !ALIGNED.includes(v.status)))
  const ready = blocking.length === 0 && principles.length > 0 && visions.some((v) => ALIGNED.includes(v.status))
  return { ready, blocking: blocking.map(({ code, title, status }) => ({ code, title, status })) }
}

/** A frozen copy of the direction as it stands. */
export function directionContent(data: ProjectData): DirectionContent {
  const pov = data.pointOfView
  const items = alignmentItems(data)
  return {
    pointOfView: pov
      ? { centralAmbition: pov.centralAmbition, opportunity: pov.opportunity, connectingIdea: pov.connectingIdea, tensions: pov.tensions, distinctiveness: pov.distinctiveness, keepInMind: pov.keepInMind, alternatives: structuredClone(pov.alternatives) }
      : null,
    vision: data.winThemes.filter((w) => isActiveFramework(w.status)).map((w) => ({ id: w.id, code: w.code, statement: w.statement, narrative: w.narrative, status: w.status })),
    principles: [...data.principles]
      .sort((a, b) => a.order - b.order)
      .filter((p) => isActiveFramework(p.status))
      .map((p) => ({ id: p.id, code: p.code, title: p.title, statement: p.statement, intent: p.intent, category: p.category, whyItMatters: p.whyItMatters ?? '', designImplications: p.designImplications ?? '', status: p.status, version: p.version })),
    opportunities: [...data.opportunities].sort((a, b) => a.order - b.order).map((o) => ({ id: o.id, code: o.code, title: o.title, description: o.description, principleIds: [...o.principleIds], state: o.state })),
    outcomes: [...data.outcomes].sort((a, b) => a.order - b.order).map((o) => ({ id: o.id, code: o.code, statement: o.statement, principleId: o.principleId, category: o.category, state: o.state })),
    alignment: items.map((i) => {
      const r = latestAlignment(data, i.type, i.id)
      return { type: i.type, id: i.id, code: i.code, status: r?.status ?? 'not_reviewed', refinements: r?.refinements ?? '' }
    }),
  }
}

/** The most recent snapshot recorded as aligned, if any. */
export function latestAlignedDirection(data: ProjectData) {
  return [...data.directions].filter((d) => d.state === 'aligned').sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
}
