/**
 * SYNTHETIC DEMONSTRATION DATA — entirely fictional.
 *
 * The organizations, people, statements, figures, costs and dates below are
 * invented for demonstration. They do not describe any real project, owner,
 * budget or building, and must never be replaced with real project material
 * in this repository. Real projects are created in the secure application.
 */
import type {
  ApprovalStatus,
  Confidence,
  Criticality,
  Decision,
  DesignDriver,
  DriverApproval,
  DriverContent,
  DriverPerformance,
  GuidingPrinciple,
  Locator,
  NodeRef,
  PrincipleContent,
  ProjectData,
  Relationship,
  RelationshipType,
  Source,
  Statement,
  StatementKind,
  Theme,
  TranscriptionStatus,
  VersionEntry,
} from '@/domain/types'
import { wordingOf } from '@/domain/wording'
import { demoHeard, demoOpportunities, demoOutcomes, demoPointOfView, PRINCIPLE_SUPPORT } from './compass2'

export const DEMO_PROJECT_ID = 'demo-pharmacy'
export const DEMO_PROJECT_2_ID = 'demo-learning'

const T0 = '2026-06-02T14:00:00.000Z'

export const PEOPLE = {
  avery: { id: 'p-avery', name: 'Avery Lindqvist', title: 'Principal-in-Charge', organization: 'BSA', email: 'avery.lindqvist@example.com' },
  jordan: { id: 'p-jordan', name: 'Jordan Okafor', title: 'Project Architect', organization: 'BSA', email: 'jordan.okafor@example.com' },
  sam: { id: 'p-sam', name: 'Sam Delacroix', title: 'Medical Planner', organization: 'BSA', email: 'sam.delacroix@example.com' },
  morgan: { id: 'p-morgan', name: 'Dr. Morgan Ellery', title: 'VP, Pharmacy Services', organization: 'Meridian Valley Health', email: 'morgan.ellery@example.org' },
  priya: { id: 'p-priya', name: 'Priya Ramanathan', title: 'Director, Facilities Planning', organization: 'Meridian Valley Health', email: 'priya.ramanathan@example.org' },
  renata: { id: 'p-renata', name: 'Renata Silva', title: 'Pharmacy Operations Manager', organization: 'Meridian Valley Health', email: 'renata.silva@example.org' },
  theo: { id: 'p-theo', name: 'Theo Nakamura', title: 'MEP Engineering Lead', organization: 'Fieldstone Engineering', email: 'theo.nakamura@example.com' },
  casey: { id: 'p-casey', name: 'Casey Brandt', title: 'Project Executive', organization: 'Halden Builders', email: 'casey.brandt@example.com' },
} as const

const ORG = 'Meridian Valley Health'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function source(n: number, s: Omit<Source, 'id' | 'code' | 'uploadedAt' | 'version' | 'possibleDuplicateOf'> & { possibleDuplicateOf?: string | null }): Source {
  return { id: `src-${n}`, code: `SRC-${String(n).padStart(3, '0')}`, uploadedAt: T0, version: 1, possibleDuplicateOf: null, ...s }
}

function st(
  n: number,
  sourceN: number,
  text: string,
  o: { loc?: Locator; speaker?: string; kind?: StatementKind; crit?: Criticality; conf?: Confidence; tx?: TranscriptionStatus; uncertain?: string[]; interp?: string; by?: string } = {},
): Statement {
  const tx = o.tx ?? 'not_applicable'
  return {
    id: `st-${n}`,
    code: `ST-${String(n).padStart(3, '0')}`,
    sourceId: `src-${sourceN}`,
    originalText: text,
    locator: o.loc ?? { kind: 'none', value: '' },
    speaker: o.speaker ?? '',
    kind: o.kind ?? 'aspiration',
    criticality: o.crit ?? 'normal',
    confidence: o.conf ?? 'high',
    transcriptionStatus: tx,
    uncertainWords: o.uncertain ?? [],
    reviewedBy: tx === 'verified' ? PEOPLE.renata.id : null,
    reviewedAt: tx === 'verified' ? '2026-06-20T16:00:00.000Z' : null,
    interpretation: o.interp ?? '',
    interpretationOrigin: o.interp ? 'human' : null,
    revisions: [],
    createdBy: o.by ?? PEOPLE.sam.id,
    createdAt: T0,
  }
}

let relN = 0
function rel(from: NodeRef, to: NodeRef, type: RelationshipType, explanation = '', o: Partial<Relationship> = {}): Relationship {
  relN++
  return {
    id: `rel-${relN}`,
    from,
    to,
    type,
    explanation,
    confidence: 'high',
    origin: 'human',
    proposedBy: PEOPLE.jordan.id,
    reviewedBy: PEOPLE.avery.id,
    status: 'accepted',
    createdAt: T0,
    updatedAt: T0,
    ...o,
  }
}
const S = (n: number): NodeRef => ({ type: 'statement', id: `st-${n}` })
const TH = (n: number): NodeRef => ({ type: 'theme', id: `th-${n}` })
const GP = (n: number): NodeRef => ({ type: 'principle', id: `gp-${n}` })
const DD = (n: number): NodeRef => ({ type: 'driver', id: `dd-${n}` })
const DEC = (n: number): NodeRef => ({ type: 'decision', id: `dec-${n}` })

function theme(n: number, title: string, summary: string, o: Partial<Theme> = {}): Theme {
  return {
    id: `th-${n}`,
    code: `TH-${String(n).padStart(2, '0')}`,
    title,
    summary,
    status: 'promoted',
    criticality: 'high',
    conflictNote: '',
    promotedToPrincipleId: o.status === 'emerging' || o.status === 'candidate' ? null : `gp-${n}`,
    createdBy: PEOPLE.sam.id,
    createdAt: T0,
    ...o,
  }
}

function history<C, S extends string>(steps: [S, C, string, string][]): VersionEntry<C, S>[] {
  return steps.map(([status, snapshot, note, at], i) => ({ version: i + 1, snapshot, status, changedBy: status === 'approved' ? PEOPLE.morgan.id : PEOPLE.jordan.id, changedAt: at, note }))
}

function principle(n: number, content: PrincipleContent, status: ApprovalStatus, extra: { earlier?: PrincipleContent; approver?: string } = {}): GuidingPrinciple {
  const steps: [ApprovalStatus, PrincipleContent, string, string][] = []
  if (extra.earlier) steps.push(['proposed', extra.earlier, 'Created from theme', '2026-06-24T15:00:00.000Z'])
  steps.push(['proposed', content, extra.earlier ? 'Refined wording after Owner workshop' : 'Created from theme', '2026-07-08T15:00:00.000Z'])
  if (status !== 'proposed') steps.push(['in_review', content, 'Submitted for review', '2026-07-15T15:00:00.000Z'])
  if (status === 'approved') steps.push(['approved', content, 'Approved at Visioning Session 3', '2026-07-29T18:00:00.000Z'])
  const versions = history(steps)
  return {
    id: `gp-${n}`,
    code: `GP-${String(n).padStart(2, '0')}`,
    order: n,
    ...content,
    status,
    version: versions.length,
    versions,
    approval: status === 'approved' ? { approvedBy: PEOPLE.morgan.id, approvedAt: '2026-07-29T18:00:00.000Z', version: versions.length, note: 'Approved at Visioning Session 3', recordedBy: PEOPLE.jordan.id, wording: wordingOf(content), sessionId: 'ws-1' } : null,
    accountableApproverId: extra.approver ?? PEOPLE.morgan.id,
    createdBy: PEOPLE.jordan.id,
  }
}

const EMPTY_MEASURE = { unit: '', methodology: '', baseline: null, target: null, targetStatus: 'not_set' as const, acceptanceCriteria: '', current: null, currentAsOf: null }

function driver(
  n: number,
  content: Omit<DriverContent, 'risks' | 'dependencyIds' | 'ownerTerm'> & Partial<Pick<DriverContent, 'risks' | 'dependencyIds' | 'ownerTerm'>>,
  approvalStatus: DriverApproval,
  performanceStatus: DriverPerformance = 'not_started',
  verification: DesignDriver['verification'] = null,
): DesignDriver {
  const full: DriverContent = { risks: [], dependencyIds: [], ownerTerm: '', ...content }
  const steps: [DriverApproval, DriverContent, string, string][] = [['proposed', full, 'Created', '2026-08-04T15:00:00.000Z']]
  if (approvalStatus !== 'proposed') steps.push(['under_review', full, 'Submitted for review', '2026-08-18T15:00:00.000Z'])
  if (approvalStatus === 'approved') steps.push(['approved', full, 'Approved at Design Driver workshop', '2026-09-02T18:00:00.000Z'])
  const versions = history(steps)
  return {
    id: `dd-${n}`,
    code: `DD-${String(n).padStart(2, '0')}`,
    ...full,
    approvalStatus,
    performanceStatus,
    verification,
    version: versions.length,
    versions,
    approval: approvalStatus === 'approved' ? { approvedBy: PEOPLE.morgan.id, approvedAt: '2026-09-02T18:00:00.000Z', version: versions.length, note: 'Approved at Design Driver workshop' } : null,
    createdBy: PEOPLE.jordan.id,
  }
}

// ---------------------------------------------------------------------------
// Project 1: Specialty pharmacy fulfillment center (fictional)
// ---------------------------------------------------------------------------

export function createDemoProject(): ProjectData {
  relN = 0
  const P = PEOPLE

  const sources: Source[] = [
    source(1, { title: 'Owner RFP — Specialty Pharmacy Fulfillment Center', type: 'owner_rfp', author: 'Facilities Planning Office', organization: ORG, date: '2026-04-10', confidentiality: 'confidential', uploadedBy: P.sam.id, file: { name: 'synthetic-rfp.pdf', mimeType: 'application/pdf', sizeBytes: 2_340_112, storagePath: null }, extractionStatus: 'verified', description: 'Synthetic RFP used for demonstration. Requirements below are invented.' }),
    source(2, { title: 'Visioning Workshop — Pharmacy Operations, sheet 1', type: 'photograph', author: 'Workshop participants', organization: ORG, date: '2026-06-02', confidentiality: 'confidential', uploadedBy: P.sam.id, file: { name: 'ops-sheet-1.jpg', mimeType: 'image/jpeg', sizeBytes: 1_812_400, storagePath: null, demoAsset: 'demo/note-ops-1.svg' }, extractionStatus: 'in_progress', description: 'Photograph of handwritten sticky notes from the operations breakout (synthetic illustration).' }),
    source(3, { title: 'Visioning Workshop — Pharmacy Operations, sheet 1 (second photo)', type: 'photograph', author: 'Workshop participants', organization: ORG, date: '2026-06-02', confidentiality: 'confidential', uploadedBy: P.jordan.id, file: { name: 'ops-sheet-1-angle-b.jpg', mimeType: 'image/jpeg', sizeBytes: 1_655_090, storagePath: null, demoAsset: 'demo/note-ops-1b.svg' }, extractionStatus: 'not_started', description: 'Second photograph of the same sheet taken from another angle.', possibleDuplicateOf: 'src-2' }),
    source(4, { title: 'Executive Leadership Interview Summary', type: 'meeting_summary', author: 'Sam Delacroix', organization: 'BSA', date: '2026-05-21', confidentiality: 'confidential', uploadedBy: P.sam.id, file: { name: 'leadership-interviews.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 88_201, storagePath: null }, extractionStatus: 'verified', description: 'Summary of four leadership interviews (synthetic).' }),
    source(5, { title: 'Strategic Plan 2030 — Mission and Strategy Excerpt', type: 'mission_statement', author: 'Office of Strategy', organization: ORG, date: '2025-11-01', confidentiality: 'public', uploadedBy: P.sam.id, file: null, extractionStatus: 'verified', description: 'Fictional institutional mission statement.' }),
    source(6, { title: 'Specialty Pharmacy Automation Trends — Research Summary', type: 'industry_research', author: 'BSA Research', organization: 'BSA', date: '2026-03-15', confidentiality: 'internal', uploadedBy: P.sam.id, file: null, extractionStatus: 'extracted', description: 'Synthetic research summary prepared for demonstration.' }),
    source(7, { title: 'Hazardous drug handling standard — reference record', type: 'regulation', author: 'Standards body', organization: 'External', date: '2026-01-01', confidentiality: 'public', uploadedBy: P.jordan.id, file: null, extractionStatus: 'not_started', description: 'Reference record only. Consult the current official text of the applicable standard; no wording is reproduced here.' }),
    source(8, { title: 'Staff Experience Workshop — Technicians and Pharmacists', type: 'workshop_notes', author: 'Sam Delacroix', organization: 'BSA', date: '2026-06-03', confidentiality: 'confidential', uploadedBy: P.sam.id, file: null, extractionStatus: 'extracted', description: 'Typed notes from a two-hour staff workshop (synthetic).' }),
    source(9, { title: 'Facilities Planning Meeting — Budget Workshop', type: 'meeting_summary', author: 'Priya Ramanathan', organization: ORG, date: '2026-06-17', confidentiality: 'confidential', uploadedBy: P.jordan.id, file: null, extractionStatus: 'extracted', description: 'Meeting summary (synthetic).' }),
    source(10, { title: 'Site Observation — Existing Fulfillment Operations', type: 'observation', author: 'Jordan Okafor', organization: 'BSA', date: '2026-05-28', confidentiality: 'internal', uploadedBy: P.jordan.id, file: null, extractionStatus: 'extracted', description: 'Morning-peak walk-through of the existing (fictional) operation.' }),
    source(11, { title: 'Project Kickoff Presentation', type: 'presentation', author: 'Avery Lindqvist', organization: 'BSA', date: '2026-05-12', confidentiality: 'internal', uploadedBy: P.avery.id, file: { name: 'kickoff.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sizeBytes: 6_402_331, storagePath: null }, extractionStatus: 'extracted', description: 'Kickoff deck (synthetic).' }),
    source(12, { title: 'Visioning Workshop — Leadership, sheet 2', type: 'photograph', author: 'Workshop participants', organization: ORG, date: '2026-06-02', confidentiality: 'confidential', uploadedBy: P.sam.id, file: { name: 'leadership-sheet-2.jpg', mimeType: 'image/jpeg', sizeBytes: 1_702_993, storagePath: null, demoAsset: 'demo/note-leadership-2.svg' }, extractionStatus: 'in_progress', description: 'Photograph of handwritten notes from the leadership breakout (synthetic illustration).' }),
  ]

  const photo = (value: string, x: number, y: number, w: number, h: number): Locator => ({ kind: 'photo', value, region: { x, y, w, h } })
  const statements: Statement[] = [
    st(1, 1, 'The facility shall maintain continuous dispensing operations during loss of normal utility power.', { loc: { kind: 'page', value: '4' }, kind: 'requirement', crit: 'critical', speaker: 'Owner RFP §2.3' }),
    st(2, 1, 'All refrigerated and frozen product storage must be continuously monitored with automated alarming.', { loc: { kind: 'page', value: '6' }, kind: 'nonnegotiable', crit: 'critical', speaker: 'Owner RFP §2.7' }),
    st(3, 1, 'Design shall accommodate a minimum of ten years of projected volume growth.', { loc: { kind: 'page', value: '7' }, kind: 'requirement', crit: 'high', speaker: 'Owner RFP §3.1' }),
    st(4, 1, 'Proposers shall describe their approach to maintaining schedule certainty for the planned go-live.', { loc: { kind: 'page', value: '9' }, kind: 'requirement', speaker: 'Owner RFP §4.2' }),
    st(5, 1, 'All hazardous drug compounding areas shall comply with the applicable hazardous drug handling standard.', { loc: { kind: 'page', value: '11' }, kind: 'nonnegotiable', crit: 'critical', speaker: 'Owner RFP §5.4' }),
    st(6, 2, 'Never again lose a fridge overnight', { loc: photo('1', 0.08, 0.14, 0.4, 0.22), tx: 'verified', crit: 'high', speaker: 'Operations breakout', interp: 'Refers to a past overnight refrigeration failure; implies remote alarming and resilient power for cold storage.' }),
    st(7, 2, 'Flow in one direction — stop the criss-crossing', { loc: photo('1', 0.53, 0.14, 0.4, 0.22), tx: 'verified', speaker: 'Operations breakout' }),
    st(8, 2, 'Room to grow w/o shutting down', { loc: photo('1', 0.08, 0.55, 0.4, 0.22), tx: 'uncertain', uncertain: ['shutting'], speaker: 'Operations breakout' }),
    st(9, 4, 'Every patient is waiting on a specific dose; reliability is the promise we make to them.', { loc: { kind: 'page', value: '2' }, crit: 'critical', speaker: 'Chief Pharmacy Officer (fictional)' }),
    st(10, 4, 'We expect volume to grow roughly 40 percent over the next decade, but we cannot stop operating to get there.', { loc: { kind: 'page', value: '3' }, crit: 'high', speaker: 'VP, Pharmacy Services (fictional)' }),
    st(11, 4, 'The building should help us recruit and keep technicians — it is the hardest part of our business.', { loc: { kind: 'page', value: '3' }, crit: 'high', speaker: 'Chief Operating Officer (fictional)' }),
    st(12, 4, 'Decisions have stalled on past projects; we need a faster path to answers.', { loc: { kind: 'page', value: '4' }, kind: 'observation', speaker: 'Director, Facilities Planning (fictional)' }),
    st(13, 5, 'Advance health in every community we serve through reliable, compassionate care.', { loc: { kind: 'section', value: 'Mission' }, speaker: 'Institutional mission' }),
    st(14, 5, 'Grow regional workforce opportunity and community partnerships.', { loc: { kind: 'section', value: 'Strategy pillar 4' }, speaker: 'Institutional strategy' }),
    st(15, 6, 'Automation platforms in high-volume fulfillment are commonly refreshed on seven-to-ten-year cycles.', { loc: { kind: 'page', value: '5' }, kind: 'observation', conf: 'medium', speaker: 'Research summary' }),
    st(16, 8, 'We stand for ten hours — the floor and the counters matter.', { speaker: 'Pharmacy technician', crit: 'high' }),
    st(17, 8, 'No windows in the current fill room. People burn out.', { kind: 'observation', speaker: 'Pharmacist', crit: 'high' }),
    st(18, 8, 'I want to see where every order is without walking the floor.', { speaker: 'Lead technician' }),
    st(19, 8, 'Night shift needs a break room that is not a hallway.', { speaker: 'Night-shift technician' }),
    st(20, 8, 'Keep the hazardous compounding suite separate from the main fill line.', { speaker: 'Pharmacist' }),
    st(21, 9, 'Keep the building footprint as compact as possible; every square foot must earn its place.', { speaker: 'Director, Facilities Planning (fictional)', crit: 'high' }),
    st(22, 9, 'Energy performance targets will follow the system sustainability policy, which is still in draft.', { kind: 'observation', speaker: 'Facilities Planning' }),
    st(23, 10, 'Observed carts crossing the main aisle at seven points along the fill path during the morning peak.', { kind: 'observation', speaker: 'Site observation', by: P.jordan.id }),
    st(24, 10, 'Two refrigerators on a shared circuit; no remote alarm observed.', { kind: 'observation', crit: 'critical', speaker: 'Site observation', by: P.jordan.id }),
    st(25, 11, 'Go-live is tied to the start of a new payer program — the date is fixed.', { loc: { kind: 'slide', value: '5' }, kind: 'requirement', crit: 'critical', speaker: 'Owner leadership' }),
    st(26, 11, 'Mock up the technician workstation before we commit.', { loc: { kind: 'slide', value: '8' }, speaker: 'Pharmacy operations' }),
    st(27, 12, 'Be a good neighbor — jobs + training for the community', { loc: photo('2', 0.08, 0.16, 0.84, 0.2), tx: 'unverified', speaker: 'Leadership breakout' }),
    st(28, 12, 'Every dose, every patient', { loc: photo('2', 0.08, 0.5, 0.6, 0.2), tx: 'verified', crit: 'high', speaker: 'Leadership breakout' }),
  ]
  statements[7].revisions = [{ text: 'Room to grow w/o shutting dawn', by: P.renata.id, at: '2026-06-19T15:00:00.000Z', note: 'Corrected "dawn" to "down"; "shutting" remains partly legible.' }]

  const themes: Theme[] = [
    theme(1, 'Uninterrupted, protected supply', 'Product integrity and dispensing must continue through any disruption.'),
    theme(2, 'Clear, one-way flow', 'Orders and people move through a legible, single-direction sequence.'),
    theme(3, 'Growth without disruption', 'Capacity grows and technology changes while operations continue.'),
    theme(4, 'Staff wellbeing as performance', 'The work environment is a recruitment, retention and quality strategy.', { conflictNote: 'Daylight aspirations (ST-017) conflict with the compact-footprint direction (ST-021). Unresolved — see DEC-003.' }),
    theme(5, 'Value to community', 'The facility contributes workforce and community value beyond fulfillment.', { criticality: 'normal' }),
    theme(6, 'Certainty of schedule and decisions', 'A fixed go-live demands predictable delivery and timely decisions.', { criticality: 'critical' }),
    theme(7, 'Separation of hazardous compounding', 'Staff want hazardous compounding isolated from the main fill line.', { status: 'emerging', criticality: 'high' }),
  ]

  const principles: GuidingPrinciple[] = [
    principle(1, { title: 'Reliability by Design', statement: 'Every system that protects product and dispensing continuity is designed to keep working through foreseeable disruption.', intent: 'Reliability is the promise behind every dose. The building — not heroics — should protect cold-chain integrity, power continuity and dispensing during utility loss, equipment failure and maintenance.', category: 'facility_outcomes' }, 'approved', { earlier: { title: 'Reliability First', statement: 'The facility prioritizes reliability over other goals.', intent: '', category: 'facility_outcomes' } }),
    principle(2, { title: 'One Seamless Operation', statement: 'Product, information and people move through a single, legible flow from receipt to delivery.', intent: 'Eliminate cross-traffic and hand-off ambiguity so that the facility behaves as one coordinated operation rather than a set of departments.', category: 'facility_outcomes' }, 'approved'),
    principle(3, { title: 'Adapt Without Disruption', statement: 'The facility absorbs growth and technology change without interrupting service.', intent: 'Volume growth and automation refresh are certain; their timing is not. Provide capacity, infrastructure and phasing strategies that allow change while operations continue.', category: 'facility_outcomes' }, 'in_review'),
    principle(4, { title: 'People Power Performance', statement: 'The work environment supports the health, focus and growth of the people who do the work.', intent: 'Recruitment and retention of technicians is a primary operational risk. Daylight, ergonomics, respite and visibility are performance requirements, not amenities.', category: 'institutional_impact' }, 'approved', { approver: P.priya.id }),
    principle(5, { title: 'Value Beyond Fulfillment', statement: 'The project creates lasting value for the community and the institution beyond its operational function.', intent: 'Align with the institutional strategy for workforce opportunity, partnerships and responsible resource use.', category: 'institutional_impact' }, 'proposed'),
    principle(6, { title: 'Speed with Certainty', statement: 'Design and delivery decisions are made quickly, on evidence, to protect a fixed go-live.', intent: 'The go-live date is fixed by an external program. Decision velocity, schedule transparency and early validation protect it.', category: 'delivery_excellence' }, 'in_review', { approver: P.priya.id }),
  ]

  const drivers: DesignDriver[] = [
    driver(1, { title: 'Resilient critical systems', description: 'Critical dispensing, cold-chain and IT systems continue operating on loss of normal utility power.', intendedOutcome: 'No interruption of dispensing or product integrity during utility outages.', scope: 'facility', requirementClass: 'owner_mandatory', ownerTerm: 'continuous dispensing operations', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'hours of autonomous operation', methodology: 'Engineering calculation of fuel and storage autonomy, confirmed by integrated systems test at commissioning.' }, ownerPersonId: P.theo.id, ownerOrganization: 'Fieldstone Engineering', phase: 'design_development', targetDate: '2026-12-08', validationMethod: 'Integrated systems test (pull-the-plug) during commissioning.', risks: ['Autonomy duration not stated by Owner — see Q-001.'] }, 'proposed'),
    driver(2, { title: 'Cold-chain integrity', description: 'Refrigerated and frozen storage is continuously monitored, remotely alarmed and served by resilient power.', intendedOutcome: 'Zero product loss due to unalarmed temperature excursions.', scope: 'facility', requirementClass: 'owner_mandatory', ownerTerm: 'continuously monitored with automated alarming', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'unalarmed excursions per quarter', methodology: 'Monitoring system log review for the first two quarters of operation.', baseline: null, target: '0', targetStatus: 'approved' }, ownerPersonId: P.theo.id, ownerOrganization: 'Fieldstone Engineering', phase: 'commissioning', targetDate: '2028-03-15', validationMethod: 'Commissioning functional test plus post-occupancy log review.', dependencyIds: ['dd-1'] }, 'approved', 'in_progress'),
    driver(3, { title: 'Single-direction product flow', description: 'The primary fulfillment path from receiving to shipping has no cross-flow intersections.', intendedOutcome: 'Fewer collisions, delays and mis-picks caused by crossing traffic.', scope: 'facility', requirementClass: 'team_proposed', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'cross-flow intersections', methodology: 'Count intersections of primary cart routes in the flow model at each design milestone.', baseline: '7', target: '0', targetStatus: 'approved', current: '1', currentAsOf: '2026-09-15' }, ownerPersonId: P.jordan.id, ownerOrganization: 'BSA', phase: 'design_development', targetDate: '2026-12-08', validationMethod: 'Flow model review with pharmacy operations at each milestone.' }, 'approved', 'in_progress'),
    driver(4, { title: 'Order visibility from one place', description: 'Operations leads can see order status for every zone from a central coordination point.', intendedOutcome: 'Leads manage flow without walking the floor.', scope: 'facility', requirementClass: 'owner_preference', measure: { ...EMPTY_MEASURE, kind: 'qualitative', acceptanceCriteria: 'From the coordination station, a lead can confirm the status of each zone (line of sight or display), validated in a walk-through with pharmacy operations at the DD mock-up.' }, ownerPersonId: P.renata.id, ownerOrganization: ORG, phase: 'design_development', targetDate: '2026-11-12', validationMethod: 'Mock-up walk-through.', risks: ['Depends on Owner IT vendor selection, not yet made.'] }, 'approved', 'at_risk'),
    driver(5, { title: 'Expansion without shutdown', description: 'Planned capacity growth can be added while the facility continues to operate.', intendedOutcome: 'Growth capacity available without interrupting service.', scope: 'facility', requirementClass: 'owner_mandatory', ownerTerm: 'ten years of projected volume growth', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: '% dispensing capacity growth accommodated', methodology: 'Capacity model of dispensing lines and storage against phased expansion plan.', baseline: 'Current program capacity', target: '40', targetStatus: 'proposed' }, ownerPersonId: P.avery.id, ownerOrganization: 'BSA', phase: 'schematic_design', targetDate: '2026-11-20', validationMethod: 'Phasing plan review with Owner operations.', dependencyIds: ['dd-6'] }, 'under_review'),
    driver(6, { title: 'Plug-and-play automation zones', description: 'Automation zones carry structural, power and data provisions for equipment replacement.', intendedOutcome: 'Automation can be refreshed within a planned short shutdown.', scope: 'facility', requirementClass: 'team_proposed', measure: { ...EMPTY_MEASURE, kind: 'qualitative', acceptanceCriteria: 'A robotic dispensing line can be replaced within a planned weekend shutdown, demonstrated by a replacement sequence reviewed with the equipment planner.' }, ownerPersonId: null, ownerOrganization: '', phase: 'design_development', targetDate: null, validationMethod: 'Replacement sequence review.' }, 'proposed'),
    driver(7, { title: 'Daylight and views for staff', description: 'Regularly occupied workstations have access to daylight and views.', intendedOutcome: 'Improved wellbeing and retention.', scope: 'facility', requirementClass: 'team_proposed', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: '% of regularly occupied workstations with views to daylight', methodology: 'Plan-based view analysis at each milestone.', baseline: null, target: '75', targetStatus: 'approved', current: '68', currentAsOf: '2026-09-15' }, ownerPersonId: P.jordan.id, ownerOrganization: 'BSA', phase: 'design_development', targetDate: '2026-12-08', validationMethod: 'View analysis; post-occupancy survey.', risks: ['Conflicts with compact-footprint direction (DEC-003).'] }, 'approved', 'at_risk'),
    driver(8, { title: 'Ergonomic technician workstations', description: 'Workstations are designed with technicians and validated before documents are committed.', intendedOutcome: 'Reduced strain and fatigue on long shifts.', scope: 'facility', requirementClass: 'owner_preference', measure: { ...EMPTY_MEASURE, kind: 'qualitative', acceptanceCriteria: 'A full-scale workstation mock-up is evaluated by technicians across shifts, and all critical issues are resolved in the design before Construction Documents.' }, ownerPersonId: P.sam.id, ownerOrganization: 'BSA', phase: 'design_development', targetDate: '2026-09-30', validationMethod: 'Full-scale mock-up evaluation.' }, 'approved', 'verified', { evidence: 'Mock-up session held 2026-08-14 with 11 technicians across all three shifts (synthetic record). Nine issues logged; all critical issues resolved in DD drawing set revision 3, confirmed by the operations manager.', reviewerId: P.morgan.id, verifiedAt: '2026-09-22', outcome: 'achieved' }),
    driver(9, { title: 'Workforce training pathway', description: 'Space and partnerships support a pharmacy technician training cohort.', intendedOutcome: 'Local workforce development aligned with the institutional strategy.', scope: 'facility', requirementClass: 'owner_preference', measure: { ...EMPTY_MEASURE, kind: 'qualitative', acceptanceCriteria: 'Program includes a training room and supervised practice station, and the Owner confirms a partner program.' }, ownerPersonId: P.morgan.id, ownerOrganization: ORG, phase: 'programming', targetDate: null, validationMethod: 'Owner confirmation of partner program.' }, 'proposed'),
    driver(10, { title: 'Responsible energy use', description: 'The facility meets the system sustainability policy for energy performance.', intendedOutcome: 'Lower operating energy and emissions.', scope: 'facility', requirementClass: 'owner_mandatory', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'kBtu/sf/yr (predicted EUI)', methodology: 'Energy model at each milestone.' }, ownerPersonId: P.theo.id, ownerOrganization: 'Fieldstone Engineering', phase: 'design_development', targetDate: null, validationMethod: 'Energy model; measured EUI after 12 months of operation.', risks: ['Target pending the Owner sustainability policy (ST-022).'] }, 'proposed'),
    driver(11, { title: 'Go-live schedule certainty', description: 'Delivery protects the fixed go-live date.', intendedOutcome: 'Go-live achieved on the committed date.', scope: 'delivery', requirementClass: 'owner_mandatory', ownerTerm: 'schedule certainty for the planned go-live', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'days variance from committed go-live', methodology: 'Monthly schedule update reviewed by Owner and CM.', baseline: '0', target: '0', targetStatus: 'approved', current: '0', currentAsOf: '2026-10-01' }, ownerPersonId: P.casey.id, ownerOrganization: 'Halden Builders', phase: 'construction', targetDate: '2028-06-01', validationMethod: 'Monthly schedule reporting; go-live acceptance.' }, 'approved', 'in_progress'),
    driver(12, { title: 'Decision velocity', description: 'Design decisions requiring Owner input are made promptly.', intendedOutcome: 'Design progress is not delayed by pending decisions.', scope: 'delivery', requirementClass: 'team_proposed', measure: { ...EMPTY_MEASURE, kind: 'quantitative', unit: 'median days from request to Owner decision', methodology: 'Decision Lab log: request date to approval date.', baseline: '21', target: '10', targetStatus: 'approved', current: '12', currentAsOf: '2026-10-15' }, ownerPersonId: P.priya.id, ownerOrganization: ORG, phase: 'design_development', targetDate: '2027-02-01', validationMethod: 'Monthly review of the decision log.' }, 'approved', 'in_progress'),
  ]

  const relationships: Relationship[] = [
    // statements → themes
    ...[1, 2, 6, 24, 9].map((n) => rel(S(n), TH(1), 'supports')),
    ...[7, 18, 23].map((n) => rel(S(n), TH(2), 'supports')),
    ...[3, 8, 10, 15].map((n) => rel(S(n), TH(3), 'supports')),
    ...[11, 16, 17, 26].map((n) => rel(S(n), TH(4), 'supports')),
    ...[13, 14, 27].map((n) => rel(S(n), TH(5), 'supports')),
    ...[4, 12, 25].map((n) => rel(S(n), TH(6), 'supports')),
    rel(S(20), TH(7), 'supports'),
    // themes → principles
    ...[1, 2, 3, 4, 5, 6].map((n) => rel(TH(n), GP(n), 'informs', 'Promoted from theme')),
    // statements → Win Theme
    ...[9, 28, 13].map((n) => rel(S(n), { type: 'winTheme', id: 'wt-1' }, 'supports')),
    // drivers → principles
    rel(DD(1), GP(1), 'implements'),
    rel(DD(2), GP(1), 'implements'),
    rel(DD(2), GP(6), 'implements'),
    rel(DD(3), GP(2), 'implements'),
    rel(DD(4), GP(2), 'implements'),
    rel(DD(4), GP(4), 'implements'),
    rel(DD(5), GP(3), 'implements'),
    rel(DD(6), GP(3), 'implements'),
    rel(DD(6), GP(2), 'implements'),
    rel(DD(7), GP(4), 'implements'),
    rel(DD(8), GP(4), 'implements'),
    rel(DD(9), GP(5), 'implements'),
    rel(DD(10), GP(5), 'implements'),
    rel(DD(11), GP(6), 'implements'),
    rel(DD(12), GP(6), 'implements'),
    rel(DD(12), GP(2), 'implements'),
    // statements → drivers (direct evidence)
    rel(S(1), DD(1), 'supports', 'RFP requirement for continuous dispensing'),
    rel(S(2), DD(2), 'supports', 'RFP non-negotiable monitoring requirement'),
    rel(S(24), DD(2), 'supports', 'Observed lack of remote alarm'),
    rel(S(23), DD(3), 'supports', 'Baseline of seven crossings observed'),
    rel(S(7), DD(3), 'supports'),
    rel(S(18), DD(4), 'supports'),
    rel(S(10), DD(5), 'supports', 'Source of the proposed 40% growth figure'),
    rel(S(3), DD(5), 'supports'),
    rel(S(15), DD(6), 'supports', 'Automation refresh cycle', { confidence: 'medium' }),
    rel(S(17), DD(7), 'supports'),
    rel(S(16), DD(8), 'supports'),
    rel(S(26), DD(8), 'supports'),
    rel(S(14), DD(9), 'supports'),
    rel(S(27), DD(9), 'supports', '', { confidence: 'medium' }),
    rel(S(22), DD(10), 'supports', 'Explains why no target is set'),
    rel(S(25), DD(11), 'supports'),
    rel(S(4), DD(11), 'supports'),
    rel(S(12), DD(12), 'supports'),
    // conflicts
    rel(S(17), S(21), 'conflicts_with', 'Daylight to the fill room competes with a compact footprint.'),
    // decisions → drivers
    rel(DEC(1), DD(2), 'addresses'),
    rel(DEC(1), DD(3), 'addresses'),
    rel(DEC(1), DD(5), 'addresses'),
    rel(DEC(2), DD(6), 'addresses'),
    rel(DEC(2), DD(5), 'addresses'),
    rel(DEC(3), DD(7), 'addresses'),
    rel(DEC(4), DD(11), 'addresses'),
    // pending rule-based suggestion awaiting human review
    rel(S(11), DD(7), 'supports', 'Retention concern may be addressed by daylight and views.', { status: 'proposed', origin: 'rules', proposedBy: 'assistant', reviewedBy: null, confidence: 'low' }),
  ]

  const decisions: Decision[] = [
    {
      id: 'dec-1',
      code: 'DEC-001',
      question: 'Where should cold storage and cold-chain staging be located relative to receiving and the fill line?',
      context: 'Cold storage must serve both the receiving dock and the fill line. Location affects travel, cross-traffic and future expansion.',
      status: 'recommended',
      phase: 'schematic_design',
      dueDate: '2026-11-06',
      alternatives: [
        { id: 'a1', name: 'A — Adjacent to receiving', description: 'Cold room directly off the receiving dock.', cost: 1_420_000, costBasis: 'Synthetic order-of-magnitude estimate', scheduleImpact: 'None', risks: 'Longer cart trips to fill line.' },
        { id: 'a2', name: 'B — Central core', description: 'Cold room in the central core between receiving and fill.', cost: 1_310_000, costBasis: 'Synthetic order-of-magnitude estimate', scheduleImpact: 'None', risks: 'Constrained expansion.' },
        { id: 'a3', name: 'C — Mezzanine cold room', description: 'Cold room on a mezzanine above receiving.', cost: 1_650_000, costBasis: 'Synthetic order-of-magnitude estimate', scheduleImpact: '+3 weeks structural coordination', risks: 'Vertical transport dependency.' },
      ],
      mandatoryRequirements: [
        { id: 'm1', text: 'Continuous temperature monitoring with remote alarm', results: { a1: 'pass', a2: 'pass', a3: 'pass' } },
        { id: 'm2', text: 'Pallet access without vertical transport', results: { a1: 'pass', a2: 'pass', a3: 'fail' } },
      ],
      factors: [
        { id: 'f1', name: 'Travel from dock to cold storage', criterion: 'Shorter is better', driverId: 'dd-2', attributes: { a1: '25 ft', a2: '140 ft', a3: '180 ft incl. lift' }, leastPreferredAltId: 'a2', advantages: { a1: { description: '115 ft shorter dock-to-cold travel; product out of temperature for less time', importance: 100 } }, importanceRationale: 'Time out of temperature during receipt is the most direct risk to product integrity (GP-01). Judged paramount by operations and pharmacy leadership.' },
        { id: 'f2', name: 'Travel from cold storage to fill line', criterion: 'Shorter is better', driverId: 'dd-3', attributes: { a1: '210 ft', a2: '60 ft', a3: '90 ft' }, leastPreferredAltId: 'a1', advantages: { a2: { description: '150 ft shorter; fewer cart trips across the main aisle', importance: 70 } }, importanceRationale: 'Fill-line trips are frequent but carry lower integrity risk because product is staged in validated totes.' },
        { id: 'f3', name: 'Future cold-storage expansion', criterion: 'More expansion area without relocation is better', driverId: 'dd-5', attributes: { a1: '~1,200 sf adjacent yard', a2: '~300 sf within core', a3: '~600 sf on mezzanine' }, leastPreferredAltId: 'a2', advantages: { a1: { description: '~900 sf more expansion area without relocating', importance: 60 } }, importanceRationale: 'Growth is certain (ST-010) but cold-storage share of growth is uncertain, so this is judged below the integrity advantage.' },
      ],
      paramountFactorId: 'f1',
      recommendation: { alternativeId: 'a1', rationale: 'Alternative A has the greatest total importance of advantages (160 vs 70), driven by the paramount product-integrity advantage, for a modest cost difference.', by: PEOPLE.jordan.id, at: '2026-10-22T16:00:00.000Z' },
      approval: null,
      informalScores: {},
      history: [
        { at: '2026-09-29T15:00:00.000Z', by: PEOPLE.jordan.id, action: 'Created', note: '' },
        { at: '2026-10-08T15:00:00.000Z', by: PEOPLE.jordan.id, action: 'Updated', note: 'Recorded attributes after operations workshop' },
        { at: '2026-10-15T15:00:00.000Z', by: PEOPLE.renata.id, action: 'Updated', note: 'Importance judgments agreed in workshop' },
        { at: '2026-10-22T16:00:00.000Z', by: PEOPLE.jordan.id, action: 'Recommended A — Adjacent to receiving', note: 'See rationale' },
      ],
      createdBy: PEOPLE.jordan.id,
    },
    {
      id: 'dec-2',
      code: 'DEC-002',
      question: 'Should robotic dispensing be a fixed integrated line or modular cells?',
      context: 'Automation will be refreshed during the facility life. The choice affects flexibility, throughput and shutdown duration during replacement.',
      status: 'evaluating',
      phase: 'design_development',
      dueDate: '2026-12-01',
      alternatives: [
        { id: 'b1', name: 'Fixed integrated line', description: 'Single continuous automated line.', cost: null, costBasis: 'Vendor pricing pending', scheduleImpact: 'Long-lead procurement', risks: 'Single point of failure.' },
        { id: 'b2', name: 'Modular cells', description: 'Three independent cells with shared conveyance.', cost: null, costBasis: 'Vendor pricing pending', scheduleImpact: 'Phased installation possible', risks: 'More floor area.' },
      ],
      mandatoryRequirements: [{ id: 'm1', text: 'Meets day-one throughput requirement', results: { b1: 'pass', b2: 'unknown' } }],
      factors: [
        { id: 'g1', name: 'Shutdown required for equipment replacement', criterion: 'Shorter shutdown is better', driverId: 'dd-6', attributes: { b1: 'Full line shutdown (est. 2–3 weeks)', b2: 'One cell at a time; others continue' }, leastPreferredAltId: 'b1', advantages: { b2: { description: 'Operations continue during replacement of any one cell', importance: null } }, importanceRationale: '' },
        { id: 'g2', name: 'Floor area', criterion: 'Less area is better', driverId: null, attributes: { b1: '', b2: '' }, leastPreferredAltId: null, advantages: {}, importanceRationale: '' },
      ],
      paramountFactorId: null,
      recommendation: null,
      approval: null,
      informalScores: { b1: { g1: 2, g2: 4 }, b2: { g1: 5, g2: 3 } },
      history: [{ at: '2026-10-12T15:00:00.000Z', by: PEOPLE.avery.id, action: 'Created', note: '' }],
      createdBy: PEOPLE.avery.id,
    },
    {
      id: 'dec-3',
      code: 'DEC-003',
      question: 'How should daylight reach the fill room within a compact footprint?',
      context: 'Staff identified the lack of windows as a burnout factor (ST-017); facilities leadership asked for the most compact footprint (ST-021).',
      status: 'framing',
      phase: 'design_development',
      dueDate: '2026-12-15',
      alternatives: [
        { id: 'c1', name: 'Clerestory band', description: 'High clerestory over the fill room.', cost: null, costBasis: '', scheduleImpact: '', risks: '' },
        { id: 'c2', name: 'Light court', description: 'Small internal light court.', cost: null, costBasis: '', scheduleImpact: '', risks: '' },
      ],
      mandatoryRequirements: [],
      factors: [],
      paramountFactorId: null,
      recommendation: null,
      approval: null,
      informalScores: {},
      history: [{ at: '2026-10-20T15:00:00.000Z', by: PEOPLE.jordan.id, action: 'Created', note: '' }],
      createdBy: PEOPLE.jordan.id,
    },
    {
      id: 'dec-4',
      code: 'DEC-004',
      question: 'Which delivery method best protects the fixed go-live date?',
      context: 'Selected during strategy phase (synthetic example of an approved decision).',
      status: 'approved',
      phase: 'strategy',
      dueDate: '2026-05-30',
      alternatives: [
        { id: 'e1', name: 'Construction Manager at Risk', description: 'CM engaged during design.', cost: null, costBasis: 'Fee proposals pending at the time', scheduleImpact: 'Enables early packages', risks: 'Requires active Owner management.' },
        { id: 'e2', name: 'Design-Bid-Build', description: 'Traditional sequential delivery.', cost: null, costBasis: '', scheduleImpact: 'Sequential; no early packages', risks: 'Bid risk close to go-live.' },
      ],
      mandatoryRequirements: [{ id: 'm1', text: 'Permitted by Owner procurement policy', results: { e1: 'pass', e2: 'pass' } }],
      factors: [
        { id: 'h1', name: 'Ability to release early packages', criterion: 'Earlier is better', driverId: 'dd-11', attributes: { e1: 'Early site and structure packages possible', e2: 'Not possible' }, leastPreferredAltId: 'e2', advantages: { e1: { description: 'Early packages can start ~4 months sooner', importance: 100 } }, importanceRationale: 'Fixed go-live makes schedule float the dominant concern.' },
        { id: 'h2', name: 'Price certainty at award', criterion: 'Earlier certainty is better', driverId: null, attributes: { e1: 'GMP at ~60% CDs', e2: 'Lump sum at bid' }, leastPreferredAltId: 'e1', advantages: { e2: { description: 'Firm price at bid award', importance: 45 } }, importanceRationale: 'Valuable but secondary given the fixed go-live.' },
      ],
      paramountFactorId: 'h1',
      recommendation: { alternativeId: 'e1', rationale: 'Greatest total importance (100 vs 45); directly protects go-live.', by: PEOPLE.avery.id, at: '2026-05-22T15:00:00.000Z' },
      approval: { alternativeId: 'e1', by: PEOPLE.priya.id, at: '2026-05-29T15:00:00.000Z', note: 'Approved by Owner steering committee (synthetic).' },
      informalScores: {},
      history: [
        { at: '2026-05-12T15:00:00.000Z', by: PEOPLE.avery.id, action: 'Created', note: '' },
        { at: '2026-05-22T15:00:00.000Z', by: PEOPLE.avery.id, action: 'Recommended Construction Manager at Risk', note: '' },
        { at: '2026-05-29T15:00:00.000Z', by: PEOPLE.priya.id, action: 'Approved Construction Manager at Risk', note: 'Steering committee' },
      ],
      createdBy: PEOPLE.avery.id,
    },
  ]

  const wtHistory = history<{ statement: string; narrative: string }, ApprovalStatus>([
    ['proposed', { statement: 'Every Dose. Every Patient.', narrative: 'Early draft from the leadership breakout.' }, 'Created from workshop language (ST-028)', '2026-06-10T15:00:00.000Z'],
    ['proposed', { statement: 'Every Dose. Every Patient. Every Tomorrow.', narrative: 'Behind every order is a person waiting on a specific dose. This facility exists to make that promise unbreakable — today, through any disruption, and as needs grow tomorrow.' }, 'Extended to express resilience and growth', '2026-07-01T15:00:00.000Z'],
    ['in_review', { statement: 'Every Dose. Every Patient. Every Tomorrow.', narrative: 'Behind every order is a person waiting on a specific dose. This facility exists to make that promise unbreakable — today, through any disruption, and as needs grow tomorrow.' }, 'Submitted for review', '2026-07-15T15:00:00.000Z'],
  ])

  return {
    project: {
      id: DEMO_PROJECT_ID,
      code: 'MVH-SPF',
      name: 'Specialty Pharmacy Fulfillment Center',
      tagline: 'A resilient regional hub for specialty medication fulfillment',
      sector: 'healing',
      phase: 'design_development',
      location: 'Fictional regional campus',
      description: 'A fictional high-volume specialty pharmacy fulfillment facility used to demonstrate Project Compass. All content is synthetic.',
      owner: { name: ORG, type: 'Regional health system (fictional)', mission: 'Advance health in every community we serve through reliable, compassionate care.' },
      terminology: { winTheme: 'Vision', guidingPrinciple: 'Guiding Principle', designDriver: 'Design Driver', decision: 'Decision' },
      isDemo: true,
      createdAt: '2026-05-01T12:00:00.000Z',
      members: [
        { personId: P.avery.id, role: 'project_admin' },
        { personId: P.jordan.id, role: 'editor' },
        { personId: P.sam.id, role: 'contributor' },
        { personId: P.morgan.id, role: 'reviewer' },
        { personId: P.priya.id, role: 'reviewer' },
        { personId: P.renata.id, role: 'contributor' },
        { personId: P.theo.id, role: 'contributor' },
        { personId: P.casey.id, role: 'viewer' },
      ],
      aiPolicy: { enabled: false, allowedClassifications: ['public'] },
    },
    people: Object.values(P).map((p) => ({ ...p })),
    sources,
    statements,
    relationships,
    themes,
    questions: [
      { id: 'q-1', code: 'Q-001', question: 'How long must critical systems operate autonomously? The RFP requires continuous operations but does not state a duration.', context: [DD(1), S(1)], status: 'open', answer: '', raisedBy: P.theo.id, raisedAt: '2026-08-04T15:00:00.000Z' },
      { id: 'q-2', code: 'Q-002', question: 'Is hazardous compounding within this project scope, and does the staff request for separation (ST-020) reflect the RFP requirement (ST-005)?', context: [TH(7), S(5), S(20)], status: 'open', answer: '', raisedBy: P.sam.id, raisedAt: '2026-06-20T15:00:00.000Z' },
      { id: 'q-3', code: 'Q-003', question: 'Does the compact-footprint direction take priority over daylight to the fill room?', context: [S(17), S(21), DD(7)], status: 'open', answer: '', raisedBy: P.jordan.id, raisedAt: '2026-07-02T15:00:00.000Z' },
    ],
    winThemes: [
      { id: 'wt-1', code: 'WT-01', statement: 'Every Dose. Every Patient. Every Tomorrow.', narrative: wtHistory[2].snapshot.narrative, status: 'in_review', version: 3, versions: wtHistory, approval: null, createdBy: P.jordan.id },
      { id: 'wt-2', code: 'WT-02', statement: 'Precision at Scale. Care at Heart.', narrative: 'An alternative emphasizing operational precision and the human purpose behind it.', status: 'proposed', version: 1, versions: history([['proposed', { statement: 'Precision at Scale. Care at Heart.', narrative: 'An alternative emphasizing operational precision and the human purpose behind it.' }, 'Created', '2026-07-01T15:00:00.000Z']]), approval: null, createdBy: P.sam.id },
    ],
    principles: principles.map((p) => ({ ...p, ...PRINCIPLE_SUPPORT[p.id] })),
    drivers,
    decisions,
    milestones: [
      { id: 'm-1', name: 'Schematic Design review', date: '2026-09-15', phase: 'schematic_design', driverIds: ['dd-3', 'dd-7'], complete: true },
      { id: 'm-2', name: 'Workstation and coordination mock-up', date: '2026-11-12', phase: 'design_development', driverIds: ['dd-4'], complete: false },
      { id: 'm-3', name: 'Owner target approval workshop', date: '2026-11-20', phase: 'design_development', driverIds: ['dd-1', 'dd-5', 'dd-10'], complete: false },
      { id: 'm-4', name: 'Design Development 50% review', date: '2026-12-08', phase: 'design_development', driverIds: ['dd-1', 'dd-3', 'dd-7'], complete: false },
      { id: 'm-5', name: 'Construction Documents start', date: '2027-02-01', phase: 'construction_documents', driverIds: ['dd-12'], complete: false },
      { id: 'm-6', name: 'Integrated systems test', date: '2028-03-15', phase: 'commissioning', driverIds: ['dd-1', 'dd-2'], complete: false },
      { id: 'm-7', name: 'Go-live', date: '2028-06-01', phase: 'occupancy', driverIds: ['dd-11'], complete: false },
    ],
    comments: [
      { id: 'c-1', target: { type: 'winTheme', id: 'wt-1' }, authorId: P.morgan.id, body: '"Every Tomorrow" resonates with leadership — it carries both resilience and growth.', createdAt: '2026-07-18T15:00:00.000Z', resolved: false },
      { id: 'c-2', target: { type: 'principle', id: 'gp-3' }, authorId: P.priya.id, body: 'Can we be explicit that this includes automation refresh, not only volume growth?', createdAt: '2026-07-20T15:00:00.000Z', resolved: false },
      { id: 'c-3', target: { type: 'driver', id: 'dd-7' }, authorId: P.priya.id, body: 'We need to understand the area cost of reaching 75% before DD.', createdAt: '2026-09-18T15:00:00.000Z', resolved: false },
    ],
    suggestions: [],
    heard: demoHeard(P.jordan.id),
    pointOfView: demoPointOfView(P.avery.id),
    opportunities: demoOpportunities(P.jordan.id),
    outcomes: demoOutcomes(P.jordan.id),
    workshops: [
      {
        id: 'ws-1',
        code: 'WS-01',
        title: 'Visioning Session 3 — Principles',
        date: '2026-07-29',
        status: 'closed',
        facilitatorId: P.avery.id,
        attendees: [
          { name: 'Dr. Morgan Ellery', organization: ORG, role: 'VP, Pharmacy Services (approver)' },
          { name: 'Priya Ramanathan', organization: ORG, role: 'Director, Facilities Planning' },
          { name: 'Avery Lindqvist', organization: 'BSA', role: 'Facilitator' },
          { name: 'Jordan Okafor', organization: 'BSA', role: 'Project Architect' },
        ],
        notes: { 'principle:gp-1': 'Owner asked that "foreseeable disruption" explicitly include equipment failure.' },
        generalNotes: 'Synthetic record of an earlier session in which GP-01, GP-02 and GP-04 were approved.',
        actions: [{ id: 'act-1', text: 'Confirm autonomous run-time duration for critical systems (Q-001).', owner: 'Facilities Planning', due: '2026-11-20', done: false }],
        log: [],
        startedAt: '2026-07-29T16:00:00.000Z',
        endedAt: '2026-07-29T18:30:00.000Z',
        createdBy: P.avery.id,
      },
      {
        id: 'ws-2',
        code: 'WS-02',
        title: 'Owner Alignment Workshop — Vision & Principles',
        date: '2026-11-05',
        status: 'planned',
        facilitatorId: P.avery.id,
        attendees: [
          { name: 'Dr. Morgan Ellery', organization: ORG, role: 'VP, Pharmacy Services (approver)' },
          { name: 'Priya Ramanathan', organization: ORG, role: 'Director, Facilities Planning (approver)' },
          { name: 'Renata Silva', organization: ORG, role: 'Pharmacy Operations Manager' },
          { name: 'Avery Lindqvist', organization: 'BSA', role: 'Facilitator' },
          { name: 'Jordan Okafor', organization: 'BSA', role: 'Project Architect' },
        ],
        notes: {
          'winTheme:wt-1': 'Ask whether “Every Tomorrow” reads as growth, resilience, or both.',
          'principle:gp-3': 'Priya’s comment: make automation refresh explicit.',
          'principle:gp-6': 'Accountable approver is Priya.',
        },
        generalNotes: '',
        actions: [],
        log: [],
        startedAt: null,
        endedAt: null,
        createdBy: P.avery.id,
      },
    ],
    trash: [],
    audit: [
      { id: 'au-3', at: '2026-10-22T16:00:00.000Z', actorId: P.jordan.id, action: 'decision.recommend', target: DEC(1), summary: 'Recommended "A — Adjacent to receiving" for DEC-001' },
      { id: 'au-2', at: '2026-10-15T15:00:00.000Z', actorId: P.priya.id, action: 'driver.recordMeasurement', target: DD(12), summary: 'Recorded DD-12 observation: 12 median days (as of 2026-10-15)' },
      { id: 'au-1', at: '2026-09-22T15:00:00.000Z', actorId: P.morgan.id, action: 'driver.verify', target: DD(8), summary: 'Verified DD-08: achieved' },
    ],
    revision: 1,
  }
}

// ---------------------------------------------------------------------------
// Project 2: a small learning-sector project (fictional), to demonstrate
// multi-project switching and project isolation.
// ---------------------------------------------------------------------------

export function createSecondDemoProject(): ProjectData {
  const P = PEOPLE
  const base = createEmptyProject({
    id: DEMO_PROJECT_2_ID,
    code: 'RLC-01',
    name: 'Riverside Learning Commons',
    tagline: 'A shared learning hub for a fictional community college',
    sector: 'learning',
    phase: 'programming',
    location: 'Fictional riverfront campus',
    description: 'A small synthetic project used to demonstrate multiple projects and access isolation.',
    owner: { name: 'Riverside Community College (fictional)', type: 'Community college', mission: 'Open doors to learning for every member of our region.' },
    adminId: P.avery.id,
    people: [P.avery, P.jordan, P.casey],
    isDemo: true,
  })
  base.project.members.push({ personId: P.jordan.id, role: 'editor' }, { personId: P.casey.id, role: 'reviewer' })
  base.winThemes.push({ id: 'rwt-1', code: 'WT-01', statement: 'Every Door Open.', narrative: 'Draft Win Theme for discussion.', status: 'proposed', version: 1, versions: history([['proposed', { statement: 'Every Door Open.', narrative: 'Draft Win Theme for discussion.' }, 'Created', T0]]), approval: null, createdBy: P.jordan.id })
  base.principles.push(principle(1, { title: 'Learning Everywhere', statement: 'Every space supports learning, formal and informal.', intent: '', category: 'facility_outcomes' }, 'proposed'))
  base.principles[0].id = 'rgp-1'
  return base
}

export function createEmptyProject(o: {
  id: string
  code: string
  name: string
  tagline: string
  sector: ProjectData['project']['sector']
  phase: ProjectData['project']['phase']
  location: string
  description: string
  owner: ProjectData['project']['owner']
  adminId: string
  people: ProjectData['people']
  isDemo: boolean
}): ProjectData {
  return {
    project: {
      id: o.id,
      code: o.code,
      name: o.name,
      tagline: o.tagline,
      sector: o.sector,
      phase: o.phase,
      location: o.location,
      description: o.description,
      owner: o.owner,
      terminology: { winTheme: 'Vision', guidingPrinciple: 'Guiding Principle', designDriver: 'Design Driver', decision: 'Decision' },
      isDemo: o.isDemo,
      createdAt: new Date().toISOString(),
      members: [{ personId: o.adminId, role: 'project_admin' }],
      aiPolicy: { enabled: false, allowedClassifications: ['public'] },
    },
    people: o.people.map((p) => ({ ...p })),
    sources: [],
    statements: [],
    relationships: [],
    themes: [],
    questions: [],
    winThemes: [],
    principles: [],
    drivers: [],
    decisions: [],
    milestones: [],
    comments: [],
    suggestions: [],
    heard: [],
    pointOfView: null,
    opportunities: [],
    outcomes: [],
    audit: [],
    workshops: [],
    trash: [],
    revision: 1,
  }
}
