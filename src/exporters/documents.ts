import { alignmentItems, latestAlignment } from '@/domain/alignment'
import { ALIGNMENT_STATUS_LABELS, APPROVAL_LABELS, DIRECTION_STATE_LABELS, HEARD_SECTION_LABELS } from '@/domain/labels'
import { evidenceFor, isOwnerEvidence, themeStatementIds } from '@/domain/traceability'
import type { ProjectData } from '@/domain/types'
import { meetingSummary } from '@/domain/workshop'
import { RulesProvider } from '@/services/ai/rulesProvider'
import { deliverableModel } from './deliverables'
import type { Item, Outline } from './outline'

const date = (iso: string) => iso.slice(0, 10)

/**
 * Vision and Principles — the team's reference for design development:
 * vision, point of view, principles with their rationale, opportunities,
 * possible outcomes and the evidence behind each.
 */
export function visionOutline(data: ProjectData): Outline {
  const m = deliverableModel(data)
  const items: Item[] = []
  items.push({ k: 'para', text: `This document records the ${m.terms.vision.toLowerCase()} and ${m.terms.principle.toLowerCase()}s for ${m.project.name}, with the reasoning and evidence behind them. Use it as a reference throughout design. Statuses are stated as recorded: Owner alignment is not the same as formal approval of exact wording.`, muted: true })

  items.push({ k: 'h1', text: `Project ${m.terms.vision.toLowerCase()}` })
  if (m.vision) {
    items.push({ k: 'para', text: m.vision.statement, bold: true, size: 16 })
    if (m.vision.narrative) items.push({ k: 'para', text: m.vision.narrative })
    items.push({ k: 'para', text: `${m.vision.code} · ${m.vision.approvalLabel} · Owner alignment: ${m.vision.alignmentLabel}`, muted: true })
  } else items.push({ k: 'para', text: `No ${m.terms.vision.toLowerCase()} has been drafted yet.`, italic: true })

  const pov = m.pointOfView
  if (pov?.centralAmbition) {
    items.push({ k: 'h1', text: 'Our point of view' })
    items.push({ k: 'para', text: pov.centralAmbition, bold: true, size: 12 })
    for (const [label, text] of [
      ['The opportunity', pov.opportunity],
      ['What connects it', pov.connectingIdea],
      ['Tensions to navigate', pov.tensions],
      ['What could make it distinctive', pov.distinctiveness],
      ['What we must keep in mind', pov.keepInMind],
    ] as const)
      if (text) items.push({ k: 'labelled', label, text })
  }

  items.push({ k: 'h1', text: `${m.terms.principle}s` })
  if (!m.principles.length) items.push({ k: 'para', text: 'No principles drafted yet.', italic: true })
  for (const p of m.principles) {
    items.push({ k: 'h2', text: `${p.code}  ${p.title}` })
    items.push({ k: 'para', text: p.statement, bold: true })
    if (p.intent) items.push({ k: 'para', text: p.intent })
    items.push({ k: 'para', text: `${p.category} · ${p.approvalLabel} · Owner alignment: ${p.alignmentLabel}${p.refinements ? ` — requested refinements: ${p.refinements}` : ''}`, muted: true })
    if (p.whyItMatters) items.push({ k: 'labelled', label: 'Why it matters', text: p.whyItMatters })
    if (p.designImplications) items.push({ k: 'labelled', label: 'Emerging design implications', text: p.designImplications })
    if (p.opportunities.length) {
      items.push({ k: 'h3', text: 'Design opportunities' })
      p.opportunities.forEach((o) => items.push({ k: 'bullet', text: o.title, detail: `${o.description}${o.description ? ' ' : ''}(${o.state})` }))
    }
    if (p.outcomes.length) {
      items.push({ k: 'h3', text: 'What success could look like' })
      p.outcomes.forEach((o) =>
        items.push({
          k: 'bullet',
          text: o.statement,
          detail: [o.category, o.state, o.aspiration ? 'aspiration — no reliable measure yet' : '', o.possibleMeasures ? `possible ways to tell: ${o.possibleMeasures}` : 'no target set', o.progress ? `${o.progress} evidence of progress` : ''].filter(Boolean).join('; '),
        }),
      )
    }
    if (p.evidence.length) {
      items.push({ k: 'h3', text: `Key evidence (${p.evidenceCount} statement${p.evidenceCount === 1 ? '' : 's'})` })
      p.evidence.forEach((e) => items.push({ k: 'quote', text: e.text, cite: [e.code, e.speaker].filter(Boolean).join(', ') }))
    } else items.push({ k: 'para', text: 'No linked evidence yet.', italic: true, muted: true })
  }

  items.push({ k: 'h1', text: 'Evidence connections' })
  items.push({
    k: 'table',
    head: [m.terms.principle, 'Statements', 'From the Owner', 'Opportunities', 'Outcomes'],
    rows: m.principles.map((p) => {
      const all = evidenceFor(data, { type: 'principle', id: p.id }).all
      return [`${p.code} ${p.title}`, String(all.length), String(all.filter((s) => isOwnerEvidence(data, s)).length), String(p.opportunities.length), String(p.outcomes.length)]
    }),
    widths: [4, 1.3, 1.3, 1.3, 1.3],
  })
  if (m.openQuestions.length) {
    items.push({ k: 'h1', text: 'Open questions' })
    m.openQuestions.forEach((q) => items.push({ k: 'bullet', text: q }))
  }
  return { title: 'Vision and Guiding Principles', kind: 'vision-and-principles', coverLabel: 'Project Compass', status: m.status.label, items }
}

/** Internal Synthesis Report — BSA only. Themes, evidence, interpretations, tensions, the recommendation and alternatives. */
export async function synthesisOutline(data: ProjectData): Promise<Outline> {
  const m = deliverableModel(data)
  const items: Item[] = []
  items.push({ k: 'para', text: 'INTERNAL — FOR BSA USE ONLY. Contains working interpretations, unreviewed items, alternatives and open questions that are not intended for the Owner presentation.', bold: true })

  items.push({ k: 'h1', text: 'Recommended direction' })
  if (m.pointOfView?.centralAmbition) items.push({ k: 'para', text: m.pointOfView.centralAmbition, bold: true, size: 12 })
  if (m.vision) items.push({ k: 'labelled', label: `Recommended ${m.terms.vision.toLowerCase()}`, text: `${m.vision.statement} (${m.vision.code}, ${m.vision.approvalLabel}; Owner: ${m.vision.alignmentLabel})` })
  items.push({ k: 'labelled', label: 'Status', text: m.status.label })

  items.push({ k: 'h1', text: 'Alternatives considered' })
  const alts = m.pointOfView?.alternatives ?? []
  if (alts.length) alts.forEach((a) => items.push({ k: 'bullet', text: `${a.title}${a.recommended ? ' (recommended)' : ''}`, detail: a.summary }))
  m.visionAlternatives.forEach((v) => items.push({ k: 'bullet', text: `${v.code} ${v.statement}`, detail: `${m.terms.vision} alternative — ${v.approvalLabel}` }))
  data.winThemes.filter((w) => w.status === 'not_adopted' || w.status === 'superseded').forEach((w) => items.push({ k: 'bullet', text: `${w.code} ${w.statement}`, detail: APPROVAL_LABELS[w.status] }))
  if (!alts.length && !m.visionAlternatives.length) items.push({ k: 'para', text: 'No alternatives recorded.', italic: true })

  items.push({ k: 'h1', text: 'Key themes' })
  const themes = data.themes.filter((t) => t.status !== 'archived')
  items.push({
    k: 'table',
    head: ['Theme', 'Summary', 'Statements', 'Owner', 'Status'],
    rows: themes.map((t) => {
      const ids = themeStatementIds(data, t.id)
      const owner = ids.filter((id) => {
        const s = data.statements.find((x) => x.id === id)
        return s && isOwnerEvidence(data, s)
      }).length
      return [`${t.code} ${t.title}`, t.summary, String(ids.length), String(owner), t.status]
    }),
    widths: [2.4, 4, 1, 1, 1.2],
  })

  items.push({ k: 'h1', text: 'What we heard (complete)' })
  for (const [section, label] of Object.entries(HEARD_SECTION_LABELS)) {
    const xs = data.heard.filter((h) => h.section === section).sort((a, b) => a.order - b.order)
    if (!xs.length) continue
    items.push({ k: 'h3', text: label })
    xs.forEach((h) =>
      items.push({
        k: 'bullet',
        text: h.title,
        detail: [h.narrative, h.reviewed ? '' : 'NOT YET REVIEWED', h.inPresentation ? '' : 'not in Owner presentation', h.evidence.length ? `evidence: ${h.evidence.map((e) => data.statements.find((s) => s.id === e.id)?.code ?? data.themes.find((t) => t.id === e.id)?.code).filter(Boolean).join(', ')}` : 'no linked evidence'].filter(Boolean).join(' · '),
      }),
    )
  }

  items.push({ k: 'h1', text: 'Strategic tensions' })
  if (m.pointOfView?.tensions) items.push({ k: 'para', text: m.pointOfView.tensions })
  const conflicts = data.relationships.filter((r) => r.type === 'conflicts_with' && r.status !== 'rejected')
  conflicts.forEach((c) => {
    const a = data.statements.find((s) => s.id === c.from.id)
    const b = data.statements.find((s) => s.id === c.to.id)
    items.push({ k: 'bullet', text: `${a?.code ?? c.from.id} vs ${b?.code ?? c.to.id}`, detail: c.explanation || `“${a?.originalText ?? ''}” / “${b?.originalText ?? ''}”` })
  })
  if (!m.pointOfView?.tensions && !conflicts.length) items.push({ k: 'para', text: 'No tensions recorded.', italic: true })

  items.push({ k: 'h1', text: 'Interpretations' })
  for (const p of m.principles) {
    items.push({ k: 'h3', text: `${p.code} ${p.title} — ${p.approvalLabel}; Owner: ${p.alignmentLabel}` })
    items.push({ k: 'para', text: p.statement })
    if (p.whyItMatters) items.push({ k: 'labelled', label: 'Why it matters', text: p.whyItMatters })
    if (p.designImplications) items.push({ k: 'labelled', label: 'Emerging design implications', text: p.designImplications })
    items.push({ k: 'para', text: `Grounded in ${p.evidenceCount} statement(s)${p.evidence.length ? `: ${p.evidence.map((e) => e.code).join(', ')}${p.evidenceCount > p.evidence.length ? ` and ${p.evidenceCount - p.evidence.length} more` : ''}` : ''}.`, muted: true })
  }
  const quality = await new RulesProvider().run('principle_quality', data)
  items.push({ k: 'h3', text: 'Principle quality observations (rules-based, no AI model)' })
  if (!quality.length) items.push({ k: 'para', text: 'No overlap, grounding, balance or length issues were found by the rules.', italic: true })
  quality.forEach((q) => items.push({ k: 'bullet', text: q.title, detail: q.body }))

  items.push({ k: 'h1', text: 'Unresolved questions' })
  const open = data.questions.filter((q) => q.status === 'open')
  open.forEach((q) => items.push({ k: 'bullet', text: q.code, detail: q.question }))
  alignmentItems(data).forEach((i) => {
    const r = latestAlignment(data, i.type, i.id)
    if (r?.status === 'needs_discussion') items.push({ k: 'bullet', text: `${i.code} needs further discussion`, detail: r.questions || r.feedback || 'No detail recorded.' })
  })
  if (!open.length) items.push({ k: 'para', text: 'No open questions recorded.', italic: true })

  items.push({ k: 'h1', text: 'Owner alignment and direction history' })
  items.push({
    k: 'table',
    head: ['Item', 'Latest Owner response', 'Session', 'Refinements'],
    rows: alignmentItems(data).map((i) => {
      const r = latestAlignment(data, i.type, i.id)
      return [`${i.code} ${i.title}`, ALIGNMENT_STATUS_LABELS[r?.status ?? 'not_reviewed'], data.workshops.find((w) => w.id === r?.sessionId)?.code ?? '—', r?.refinements ?? '']
    }),
    widths: [3.5, 2, 1, 3],
  })
  const dirs = [...data.directions].sort((a, b) => a.at.localeCompare(b.at))
  if (dirs.length) items.push({ k: 'table', head: ['Version', 'State', 'Label', 'Saved'], rows: dirs.map((d) => [d.code, DIRECTION_STATE_LABELS[d.state], d.label, date(d.at)]), widths: [1, 2.2, 3.5, 1.5] })

  return { title: 'Internal Synthesis Report', kind: 'internal-synthesis-report', coverLabel: 'Project Compass  |  Internal — BSA only', status: m.status.label, items }
}

/**
 * Workshop summary — concise and editable: the direction, refinements, open
 * questions, opportunities and outcomes still to validate, then the record.
 */
export function summaryOutline(data: ProjectData, sessionId: string): Outline {
  const s = meetingSummary(data, sessionId)
  const w = s.session
  const t = data.project.terminology
  const person = (id: string) => data.people.find((p) => p.id === id)?.name ?? 'Unknown'
  const items: Item[] = []
  items.push({ k: 'table', head: ['', ''], rows: [
    ['Workshop', `${w.code} — ${w.title}`],
    ['Date', w.date],
    ['Status', w.status === 'closed' ? `Ended ${w.endedAt?.slice(0, 16).replace('T', ' ')} UTC` : w.status === 'live' ? 'In progress — this summary is a draft' : 'Planned'],
    ['Facilitator', person(w.facilitatorId)],
    ['Attendees', w.attendees.map((a) => `${a.name}${a.organization ? ` (${a.organization})` : ''}`).join('; ') || 'None recorded'],
  ], widths: [1.4, 5] })

  items.push({ k: 'h1', text: `${t.winTheme}` })
  if (s.direction.vision) {
    items.push({ k: 'para', text: s.direction.vision.statement, bold: true, size: 13 })
    if (s.direction.vision.narrative) items.push({ k: 'para', text: s.direction.vision.narrative })
  } else items.push({ k: 'para', text: 'No vision recorded.', italic: true })

  items.push({ k: 'h1', text: `${t.guidingPrinciple}s` })
  items.push({ k: 'table', head: ['', t.guidingPrinciple, 'Owner response in this session'], rows: s.direction.principles.map((p) => [p.code, `${p.title} — ${p.statement}`, ALIGNMENT_STATUS_LABELS[p.status]]), widths: [0.8, 5, 2] })

  items.push({ k: 'h1', text: 'Significant refinements' })
  const refined = s.alignment.filter((a) => a.refinements || a.feedback || a.ownerComments)
  if (!refined.length && !s.wordingChanges.length) items.push({ k: 'para', text: 'None recorded.', italic: true })
  refined.forEach((a) => {
    items.push({ k: 'h3', text: `${a.code} ${a.title} — ${ALIGNMENT_STATUS_LABELS[a.status]}` })
    if (a.refinements) items.push({ k: 'labelled', label: 'Requested refinements', text: a.refinements })
    if (a.feedback) items.push({ k: 'labelled', label: 'Feedback', text: a.feedback })
    if (a.ownerComments) items.push({ k: 'quote', text: a.ownerComments, cite: 'Owner' })
  })
  if (s.wordingChanges.length) items.push({ k: 'table', head: ['', 'Before', 'After'], rows: s.wordingChanges.map((c) => [c.code, c.before, c.after]), widths: [0.8, 3.5, 3.5] })

  if (s.notReviewed.length) {
    items.push({ k: 'h1', text: 'Not yet reviewed' })
    items.push({ k: 'para', text: 'No Owner response was recorded for these items. They are not treated as aligned.', muted: true })
    s.notReviewed.forEach((n) => items.push({ k: 'bullet', text: `${n.code} ${n.title}` }))
  }

  items.push({ k: 'h1', text: 'Remaining strategic questions' })
  if (!s.strategicQuestions.length) items.push({ k: 'para', text: 'None recorded.', italic: true })
  s.strategicQuestions.forEach((q) => items.push({ k: 'bullet', text: q }))

  items.push({ k: 'h1', text: 'Emerging design opportunities' })
  if (!s.direction.opportunities.length) items.push({ k: 'para', text: 'None selected for the presentation.', italic: true })
  s.direction.opportunities.forEach((o) => items.push({ k: 'bullet', text: o.title, detail: o.principles.join(', ') }))

  items.push({ k: 'h1', text: 'Potential outcomes requiring future validation' })
  if (!s.direction.outcomesToValidate.length) items.push({ k: 'para', text: 'None.', italic: true })
  s.direction.outcomesToValidate.forEach((o) => items.push({ k: 'bullet', text: o.statement, detail: o.principle }))

  if (s.adopted.length) {
    items.push({ k: 'h1', text: 'Formally adopted wording' })
    s.adopted.forEach((a) => {
      items.push({ k: 'eyebrow', text: `${a.code} — approved by ${a.approvedBy}${a.recordedBy ? ` (recorded by ${a.recordedBy})` : ''} — v${a.version}` })
      items.push({ k: 'para', text: a.wording })
    })
  }
  if (w.actions.length) {
    items.push({ k: 'h1', text: 'Next steps' })
    items.push({ k: 'table', head: ['Action', 'Owner', 'Due', 'Status'], rows: w.actions.map((a) => [a.text, a.owner, a.due ?? '', a.done ? 'Done' : 'Open']), widths: [4.5, 1.6, 1, 0.8] })
  }
  items.push({ k: 'para', text: 'Generated from the recorded session. Edit and review before distribution.', italic: true, muted: true })
  return { title: `Workshop Summary ${w.code}${s.draft ? ' (draft)' : ''}`, kind: `workshop-summary-${w.code}`, coverLabel: 'Owner Alignment Workshop', status: `${w.title} · ${w.date}`, items }
}
