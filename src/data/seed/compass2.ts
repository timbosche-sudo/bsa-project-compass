/**
 * SYNTHETIC DEMONSTRATION CONTENT — Compass 2.0 (Understand / Interpret).
 * Represents a fictional BSA team preparing for the second Owner meeting.
 * Every reference points to synthetic statements in demoProject.ts.
 */
import type { DesignOpportunity, HeardItem, NodeRef, PointOfView, PotentialOutcome } from '@/domain/types'

const AT = '2026-10-20T15:00:00.000Z'
const S = (n: number): NodeRef => ({ type: 'statement', id: `st-${n}` })
const TH = (n: number): NodeRef => ({ type: 'theme', id: `th-${n}` })

export function demoHeard(by: string): HeardItem[] {
  let order = 0
  const h = (section: HeardItem['section'], title: string, narrative: string, evidence: NodeRef[], o: Partial<HeardItem> = {}): HeardItem => ({
    id: `hd-${++order}`,
    section,
    title,
    narrative,
    evidence,
    order,
    inPresentation: true,
    origin: 'human',
    reviewed: true,
    updatedBy: by,
    updatedAt: AT,
    ...o,
  })
  return [
    h('aspiration', 'Never let a patient’s dose be the casualty', 'Leadership and operations describe reliability as a promise to a specific person waiting on a specific dose — not as an engineering target.', [S(9), S(6), S(28)]),
    h('aspiration', 'Room to grow without stopping', 'Volume is expected to grow substantially over the next decade, and operations cannot pause to make room for it.', [S(10), S(8), S(3)]),
    h('aspiration', 'A place technicians want to work', 'Recruiting and keeping technicians is described as the hardest part of the business; the environment is part of the answer.', [S(11), S(16), S(17)]),
    h('theme', 'One-way, visible flow', 'Staff want product to move in one direction and to see where every order is without walking the floor.', [TH(2), S(7), S(18), S(23)]),
    h('theme', 'Certainty for a fixed go-live', 'The go-live date is tied to an external program, and past projects stalled on decisions.', [TH(6), S(25), S(12)]),
    h('tension', 'Compact footprint vs. daylight and respite', 'Facilities leadership wants every square foot to earn its place; staff describe a windowless fill room as a cause of burnout.', [S(17), S(21)]),
    h('tension', 'Hazardous compounding: requested separation, unclear scope', 'Staff asked for separation from the fill line; the RFP requires compliance, but scope for this phase is not yet confirmed.', [S(20), S(5)], { inPresentation: false }),
    h('perspective', 'Operations wants visibility, not more walking', 'Leads and technicians focus on visibility, standing comfort and fewer steps — practical signals of a better workday.', [S(18), S(16)]),
    h('perspective', 'Leadership frames reliability as a patient promise', 'Executive language connects the facility to the institutional mission of reliable, compassionate care.', [S(9), S(13)]),
    h('priority', 'Cold-chain integrity is non-negotiable', 'The RFP requires continuous monitoring with automated alarming; the site walk found refrigerators on a shared circuit with no remote alarm.', [S(2), S(24)]),
    h(
      'perspective',
      'Patient and community voices are largely absent',
      'Observation from the evidence review: no statements come directly from patients, caregivers or community partners. Consider whether this perspective should be represented before the Owner meeting.',
      [],
      { origin: 'rules', reviewed: false, inPresentation: false },
    ),
  ]
}

export function demoPointOfView(by: string): PointOfView {
  const content = {
    centralAmbition: 'Make the promise behind every dose unbreakable — a fulfillment hub where reliability, adaptability and people are designed in, not managed around.',
    opportunity: 'Treat the building as operational infrastructure for patient trust: a calm, legible, resilient environment that lets a growing team keep a fixed promise as volume and technology change.',
    connectingIdea: 'Reliability is the thread that connects what we heard — reliability of product (cold chain, power), of flow (one-way, visible), of people (rested, focused) and of the future (growth without shutdown).',
    tensions: 'A compact footprint versus daylight and respite for staff. A fixed go-live versus open questions on critical-system autonomy and hazardous compounding scope. Investment in automation versus the flexibility to refresh it.',
    distinctiveness: 'Many fulfillment centers are designed as warehouses with a pharmacy fit-out. This one can be designed first as a workplace and a resilience system.',
    keepInMind: 'Every patient is waiting on a specific dose. Night-shift, patient and community voices are thin in the evidence — silence is not agreement.',
    alternatives: [
      { id: 'alt-1', title: 'Reliability-led direction', summary: 'Organize the direction around unbreakable reliability, with people and adaptability as the means of achieving it.', recommended: true },
      { id: 'alt-2', title: 'People-led direction', summary: 'Lead with recruitment and retention as the central ambition; reliability follows from a stable, well-supported team.', recommended: false },
      { id: 'alt-3', title: 'Growth-led direction', summary: 'Lead with capacity and future automation. Risks reading as a technical program rather than a shared purpose.', recommended: false },
    ],
  }
  return { ...content, updatedBy: by, updatedAt: AT, history: [{ at: AT, by, snapshot: structuredClone(content) }] }
}

export const PRINCIPLE_SUPPORT: Record<string, { whyItMatters: string; designImplications: string }> = {
  'gp-1': {
    whyItMatters: 'Leadership calls reliability “the promise we make” to every patient; the RFP requires continuous dispensing and monitored cold storage; the site walk found single points of failure.',
    designImplications: 'Make critical systems legible and protected. Consider how failures are prevented, contained and noticed — and how staff experience the building during a disruption.',
  },
  'gp-2': {
    whyItMatters: 'Staff asked to stop the criss-crossing and to see every order without walking the floor; seven crossings were observed at the morning peak.',
    designImplications: 'Sequence spaces so product and information flow one way; give leads a vantage point; reduce hand-off ambiguity.',
  },
  'gp-3': {
    whyItMatters: 'Leadership expects substantial growth and cannot stop operating to accommodate it; automation is typically refreshed within the building’s life.',
    designImplications: 'Plan for growth in place and for replacing equipment without shutting down the whole operation.',
  },
  'gp-4': {
    whyItMatters: 'Recruiting and keeping technicians is the hardest part of the business; staff connect windows, standing comfort and respite with burnout.',
    designImplications: 'Treat daylight, ergonomics, respite and orientation as performance infrastructure, balanced against the compact-footprint direction.',
  },
  'gp-5': {
    whyItMatters: 'The institutional strategy calls for workforce opportunity and community partnerships; leadership asked the project to be a good neighbor.',
    designImplications: 'Look for ways the facility can host training and partnerships and use resources responsibly, without adding program the Owner has not endorsed.',
  },
  'gp-6': {
    whyItMatters: 'Go-live is tied to a fixed external program start, and past projects stalled waiting for decisions.',
    designImplications: 'Favor decisions and early validation that protect the schedule; make open questions visible early.',
  },
}

export function demoOpportunities(by: string): DesignOpportunity[] {
  let n = 0
  const o = (principleIds: string[], title: string, description: string, linkedDriverIds: string[], x: Partial<DesignOpportunity> = {}): DesignOpportunity => {
    n++
    return {
      id: `do-${n}`,
      code: `DO-${String(n).padStart(2, '0')}`,
      title,
      description,
      principleIds,
      state: 'proposed',
      inPresentation: true,
      linkedDriverIds,
      origin: 'human',
      order: n,
      createdBy: by,
      createdAt: AT,
      ...x,
    }
  }
  return [
    o(['gp-1'], 'Resilience you can see and trust', 'Critical systems that prevent, contain and announce failures — so the operation, not heroics, keeps the promise.', ['dd-1']),
    o(['gp-1', 'gp-6'], 'Protect product end to end', 'Keep product within its required conditions from the dock to dispatch, with monitoring staff can rely on.', ['dd-2'], { inPresentation: false }),
    o(['gp-2'], 'A single, legible flow', 'Let product and people move in one direction, with fewer crossings and clearer hand-offs.', ['dd-3']),
    o(['gp-2', 'gp-4'], 'Visibility without walking the floor', 'Give leads a natural vantage point over the whole operation.', ['dd-4'], { inPresentation: false }),
    o(['gp-3'], 'Grow in place', 'Accommodate growth while the operation keeps running.', ['dd-5']),
    o(['gp-3'], 'Make automation replaceable', 'Allow equipment to be refreshed in parts rather than all at once.', ['dd-6'], { state: 'emerging', inPresentation: false }),
    o(['gp-4'], 'Support focus and restoration', 'Daylight, views and places to recover from long shifts on your feet.', ['dd-7']),
    o(['gp-4'], 'Reduce everyday friction', 'Workstations and movement shaped with the people who use them.', ['dd-8']),
    o(['gp-4'], 'Encourage meaningful collaboration', 'Moments and places where teams across shifts can connect.', [], { state: 'emerging', inPresentation: false }),
    o(['gp-5'], 'A visible community role', 'Space and partnerships that make the facility part of local workforce development.', ['dd-9'], { state: 'emerging' }),
    o(['gp-5'], 'Responsible resource use', 'Energy and material choices consistent with the system’s sustainability commitments.', ['dd-10'], { state: 'emerging', inPresentation: false }),
    o(['gp-6'], 'Decisions that keep pace', 'Frame design decisions early, with the evidence the Owner needs to decide quickly.', ['dd-12']),
    o(['gp-6'], 'Design that protects the date', 'Favor approaches that can be validated early and sequenced to protect go-live.', ['dd-11'], { inPresentation: false }),
  ]
}

export function demoOutcomes(by: string): PotentialOutcome[] {
  let n = 0
  const o = (principleId: string, opportunityId: string | null, statement: string, x: Partial<PotentialOutcome>): PotentialOutcome => {
    n++
    return {
      id: `po-${n}`,
      code: `PO-${String(n).padStart(2, '0')}`,
      statement,
      principleId,
      opportunityId,
      category: 'qualitative',
      state: 'proposed_by_bsa',
      aspiration: false,
      possibleMeasures: '',
      evidenceOfProgress: [],
      inPresentation: true,
      order: n,
      createdBy: by,
      createdAt: AT,
      ...x,
    }
  }
  return [
    o('gp-1', 'do-1', 'Dispensing continues through a utility disruption without product loss.', { category: 'operational', possibleMeasures: 'Integrated systems test at commissioning; incident records after occupancy.' }),
    o('gp-1', 'do-1', 'Staff trust the building during an outage.', { category: 'experiential', state: 'emerging', aspiration: true, inPresentation: false }),
    o('gp-2', 'do-3', 'Fewer cross-traffic conflicts and less time spent searching for orders.', { category: 'operational', possibleMeasures: 'Crossings in the flow model; time to locate an order, observed after occupancy.' }),
    o('gp-2', 'do-4', 'Leads can manage the floor from one place.', { category: 'experiential', state: 'emerging', inPresentation: false }),
    o('gp-3', 'do-5', 'Growth is accommodated without a service shutdown.', { category: 'operational', possibleMeasures: 'Phasing plan review. Leadership indicated roughly 40% growth over a decade (ST-010); a target has not been set.' }),
    o('gp-3', 'do-6', 'Automation can be refreshed within a planned short shutdown.', { category: 'operational', state: 'define_later', inPresentation: false }),
    o('gp-4', 'do-7', 'Improved staff experience and retention.', {
      category: 'post_occupancy',
      possibleMeasures: 'Staff satisfaction survey; turnover trend; access to restorative space.',
      evidenceOfProgress: [{ id: 'pr-1', date: '2026-08-14', kind: 'design_study', note: 'Workstation mock-up evaluated with technicians across shifts (synthetic record).', addedBy: by }],
    }),
    o('gp-4', 'do-7', 'Daylight reaches the places people work most.', { category: 'environmental', possibleMeasures: 'View analysis at each design milestone.' }),
    o('gp-5', 'do-10', 'A local workforce pathway is active within the facility.', { category: 'post_occupancy', state: 'emerging', aspiration: true }),
    o('gp-6', 'do-13', 'Go-live is achieved on the committed date.', {
      category: 'operational',
      state: 'validated_with_owner',
      possibleMeasures: 'Schedule variance against the committed go-live.',
      evidenceOfProgress: [{ id: 'pr-2', date: '2026-10-01', kind: 'performance_analysis', note: 'Monthly schedule update reports no variance (synthetic record).', addedBy: by }],
    }),
  ]
}
