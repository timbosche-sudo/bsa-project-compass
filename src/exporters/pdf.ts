import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { BSA, BSA_PRINT_MARGIN_PT, BSA_TYPE, rgb } from '@/brand/brand'
import { BSA_LOGO_ASPECT } from '@/brand/logo'
import { evaluateCba } from '@/domain/cba'
import { decisionDriverIds, driverPrincipleIds, driverStatus, principleDriverIds } from '@/domain/drivers'
import { CATEGORY_LABELS, DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { dashboardModel } from '@/domain/metrics'
import { evidenceFor, gapReport } from '@/domain/traceability'
import type { Decision, ProjectData } from '@/domain/types'
import { brandLogo, registerLato } from './brandAssets'
import { downloadBlob, exportFilename, provenanceLines, reportReadiness } from './common'
import { isActiveFramework } from '@/domain/wording'

/**
 * Keep only characters present in the embedded Lato subset (Latin-1 plus
 * typographic quotes, dashes, bullet, ellipsis, arrows and comparison signs).
 */
export function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u2013\u2014\u2018-\u201D\u2022\u2026\u2192\u2264\u2265]/g, '')
}

type RGB = [number, number, number]
const INK = rgb(BSA.black)
const MUTED = rgb(BSA.black80)
const LINE = rgb(BSA.black10)
const RED = rgb(BSA.red)
/** Brand red for warnings in documents. */
export const PDF_WARN: RGB = RED
const M = BSA_PRINT_MARGIN_PT // 0.625in
const FOOTER = 34

/** BSA document (Brand Style Guide 2026, pp. 24–28): Lato, 0.625in margins, 1pt black division lines. */
class Doc {
  pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  y = M
  readonly w = this.pdf.internal.pageSize.getWidth()
  readonly h = this.pdf.internal.pageSize.getHeight()

  constructor(
    private data: ProjectData,
    private title: string,
  ) {}

  ensure(space: number) {
    if (this.y + space > this.h - M - FOOTER) {
      this.pdf.addPage()
      this.y = M
    }
  }
  rule(weight = 1) {
    this.pdf.setDrawColor(...INK).setLineWidth(weight).line(M, this.y, this.w - M, this.y)
  }
  /** Section heading: Lato Black 18/21.6, then a 1pt black division line. */
  heading(text: string) {
    const t = BSA_TYPE.headline
    this.ensure(70)
    this.y += 16
    this.pdf.setFont('Lato', 'bold').setFontSize(t.size).setTextColor(...INK)
    this.pdf.text(clean(text), M, this.y)
    this.y += 9
    this.rule()
    this.y += 20
  }
  /** ALL CAPS label: Lato Black with 100 tracking. */
  eyebrow(text: string) {
    this.ensure(18)
    this.pdf.setFont('Lato', 'bold').setFontSize(8).setTextColor(...INK)
    this.pdf.text(clean(text).toUpperCase(), M, this.y, { charSpace: 0.8 })
    this.y += 13
  }
  /** Body: Lato Regular 10/15. */
  para(text: string, opts: { size?: number; color?: RGB; bold?: boolean; italic?: boolean } = {}) {
    const size = opts.size ?? BSA_TYPE.body.size
    const leading = size * 1.5
    this.pdf.setFont('Lato', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal').setFontSize(size).setTextColor(...(opts.color ?? INK))
    const lines = this.pdf.splitTextToSize(clean(text), this.w - M * 2) as string[]
    if (size > 10) this.y += size - 10
    for (const line of lines) {
      this.ensure(leading)
      this.pdf.text(line, M, this.y)
      this.y += leading
    }
    this.y += 4
  }
  table(opts: UserOptions) {
    autoTable(this.pdf, {
      startY: this.y,
      margin: { left: M, right: M, top: M, bottom: M + FOOTER },
      styles: { font: 'Lato', fontSize: 8.5, cellPadding: 4.5, textColor: INK, lineColor: LINE, lineWidth: 0.5, overflow: 'linebreak' },
      headStyles: { fillColor: rgb(BSA.grey20), textColor: INK, fontStyle: 'bold', lineColor: INK },
      ...opts,
      body: (opts.body ?? []).map((row) => (row as unknown[]).map((c) => (typeof c === 'string' ? clean(c) : c))) as UserOptions['body'],
    })
    this.y = ((this.pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? this.y) + 20
  }
  /** Footer per page: document title left; "BSA | n" right, as in BSA documents. */
  finish(): Blob {
    const n = this.pdf.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      this.pdf.setPage(i)
      const fy = this.h - M + 6
      this.pdf.setDrawColor(...INK).setLineWidth(0.5).line(M, fy - 14, this.w - M, fy - 14)
      this.pdf.setFont('Lato', 'normal').setFontSize(7.5).setTextColor(...MUTED)
      this.pdf.text(clean(`Project Compass  |  ${this.data.project.name}  |  ${this.title}`), M, fy)
      this.pdf.setTextColor(...INK).text(`BSA  |  ${i}`, this.w - M, fy, { align: 'right' })
      if (this.data.project.isDemo) {
        this.pdf.setFont('Lato', 'bold').setFontSize(7).setTextColor(...INK)
        this.pdf.text('SYNTHETIC DEMONSTRATION DATA  —  NOT A REAL PROJECT', this.w / 2, fy + 12, { align: 'center', charSpace: 0.5 })
      }
    }
    return this.pdf.output('blob')
  }
}

const draftTag = (status: string) => (status === 'approved' ? 'APPROVED' : `DRAFT - ${status.replace('_', ' ').toUpperCase()}`)

/**
 * Cover: centered red-box logo touching the top edge (the preferred public
 * red-box variation, p. 13), Cover Title (Lato Black 36/40) and Cover Subhead
 * (Lato Regular 20). The logo is 0.5in tall (minimum print size, p. 15).
 */
async function cover(doc: Doc, data: ProjectData, title: string) {
  const p = data.project
  const logoH = 36 // 0.5in
  const logoW = logoH * BSA_LOGO_ASPECT
  const boxW = logoW + logoH * 1.6
  const boxH = logoH * 2.2
  doc.pdf.setFillColor(...RED).rect((doc.w - boxW) / 2, 0, boxW, boxH, 'F')
  doc.pdf.addImage(await brandLogo('white'), 'PNG', (doc.w - logoW) / 2, (boxH - logoH) / 2, logoW, logoH)

  let y = 250
  doc.pdf.setFont('Lato', 'bold').setFontSize(9).setTextColor(...INK)
  doc.pdf.text('PROJECT COMPASS', M, y, { charSpace: 0.9 })
  y += 34
  doc.pdf.setFont('Lato', 'bold').setFontSize(BSA_TYPE.coverTitle.size)
  const lines = doc.pdf.splitTextToSize(clean(title), doc.w - 2 * M) as string[]
  doc.pdf.text(lines, M, y, { lineHeightFactor: BSA_TYPE.coverTitle.leading / BSA_TYPE.coverTitle.size })
  y += lines.length * BSA_TYPE.coverTitle.leading + 6
  doc.pdf.setFont('Lato', 'normal').setFontSize(BSA_TYPE.coverSubhead.size)
  doc.pdf.text(clean(p.name), M, y)
  y += 22
  doc.pdf.setFontSize(11).setTextColor(...MUTED)
  doc.pdf.text(clean(`${p.owner.name}  |  ${SECTOR_LABELS[p.sector]}  |  ${PHASE_LABELS[p.phase]}`), M, y)
  doc.y = y + 26
  doc.rule()
  doc.y += 18
  provenanceLines(data).forEach((l) => doc.para(l, { size: 8.5, color: MUTED }))
  doc.pdf.addPage()
  doc.y = M
}

/** A branded report document with cover and footer, for other exporters to fill. */
export async function createReport(data: ProjectData, title: string) {
  const doc = new Doc(data, title)
  await registerLato(doc.pdf)
  await cover(doc, data, title)
  return doc
}

export async function alignmentReportPdf(data: ProjectData) {
  const title = reportReadiness(data).final ? 'Project Alignment Report' : 'Project Alignment Report - DRAFT'
  const doc = await createReport(data, title)
  const m = dashboardModel(data)
  const gaps = gapReport(data)
  const p = data.project
  const t = p.terminology

  doc.heading('Project identity')
  doc.table({
    body: [
      ['Project', `${p.name} (${p.code})`],
      ['Owner', `${p.owner.name}${p.owner.type ? ` - ${p.owner.type}` : ''}`],
      ['Sector / phase', `${SECTOR_LABELS[p.sector]} / ${PHASE_LABELS[p.phase]}`],
      ['Location', p.location || 'Not recorded'],
      ['Owner mission', p.owner.mission || 'Not recorded'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
    theme: 'plain',
  })

  doc.heading('Executive narrative')
  doc.eyebrow('Compiled from recorded project data - not an AI-generated assessment')
  const wt = data.winThemes.find((w) => w.status === 'approved') ?? data.winThemes.find((w) => w.status === 'in_review')
  doc.para(
    `${p.description} The team has recorded ${data.sources.length} sources and ${data.statements.length} stakeholder and Owner statements, synthesized into ${data.themes.filter((x) => x.status !== 'archived').length} themes. ` +
      `${m.principles.approved} of ${m.principles.total} ${t.guidingPrinciple.toLowerCase()}s are approved. ${m.active.length} ${t.designDriver.toLowerCase()}s are approved for tracking; ${m.verified.length} verified, ${m.atRisk.length} at risk, ${m.targetNotSet.length} without a target and ${m.awaitingTargetApproval.length} with targets awaiting approval. ` +
      `${data.questions.filter((q) => q.status === 'open').length} questions remain open.`,
  )

  doc.heading(t.winTheme)
  if (!data.winThemes.length) doc.para('No Win Theme recorded.', { italic: true, color: MUTED })
  for (const w of data.winThemes.filter((x) => isActiveFramework(x.status))) {
    doc.eyebrow(`${w.code} - ${draftTag(w.status)}`)
    doc.para(w.statement, { size: 15, bold: true })
    if (w.narrative) doc.para(w.narrative)
  }
  if (wt && wt.status !== 'approved') doc.para('No Win Theme has been formally approved.', { italic: true, color: MUTED })

  doc.heading(`${t.guidingPrinciple}s`)
  doc.table({
    head: [['ID', 'Principle', 'Statement', 'Category', 'Status', 'Drivers']],
    body: [...data.principles].filter((x) => isActiveFramework(x.status)).sort((a, b) => a.order - b.order).map((x) => [x.code, x.title, x.statement, CATEGORY_LABELS[x.category], draftTag(x.status), String(principleDriverIds(data, x.id).length)]),
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 90, fontStyle: 'bold' }, 4: { cellWidth: 70 }, 5: { cellWidth: 36 } },
  })

  doc.heading(`${t.designDriver}s`)
  doc.table({
    head: [['ID', 'Driver', 'Principles', 'Target or criteria', 'Observed', 'Owner', 'Status']],
    body: data.drivers.filter((d) => d.approvalStatus !== 'superseded').map((d) => [
      d.code,
      d.title,
      driverPrincipleIds(data, d.id).map((id) => data.principles.find((x) => x.id === id)?.code).join(', '),
      d.measure.kind === 'quantitative' ? (d.measure.target ? `${d.measure.target} ${d.measure.unit} (${d.measure.targetStatus === 'approved' ? 'approved' : 'NOT APPROVED'})` : 'Target not set') : d.measure.acceptanceCriteria,
      d.measure.current ?? 'Not yet measured',
      data.people.find((x) => x.id === d.ownerPersonId)?.name ?? 'Unassigned',
      `${DRIVER_STATUS_LABELS[driverStatus(d)]}${d.approvalStatus !== 'approved' ? ' (draft)' : ''}`,
    ]),
    columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 92, fontStyle: 'bold' }, 2: { cellWidth: 50 } },
  })

  doc.heading('Evidence traceability')
  for (const pr of [...data.principles].filter((x) => isActiveFramework(x.status)).sort((a, b) => a.order - b.order)) {
    const ev = evidenceFor(data, { type: 'principle', id: pr.id })
    doc.eyebrow(`${pr.code} ${pr.title} - ${ev.all.length} supporting statement(s)`)
    if (!ev.all.length) doc.para('No supporting evidence recorded - unsupported.', { italic: true, color: PDF_WARN })
    ev.all.slice(0, 4).forEach((s) => {
      const src = data.sources.find((x) => x.id === s.sourceId)
      doc.para(`"${s.originalText}" - ${s.code}, ${src?.code ?? ''} ${src?.title ?? ''}`, { size: 9, color: MUTED })
    })
  }

  doc.heading('Open questions')
  const open = data.questions.filter((q) => q.status === 'open')
  if (!open.length) doc.para('No open questions.', { italic: true, color: MUTED })
  else doc.table({ head: [['ID', 'Question']], body: open.map((q) => [q.code, q.question]), columnStyles: { 0: { cellWidth: 44 } } })

  doc.heading('Approval status')
  doc.table({
    head: [['Item', 'Approved', 'In review', 'Proposed / draft']],
    body: [
      [t.winTheme, ...['approved', 'in_review', 'proposed'].map((s) => String(data.winThemes.filter((w) => w.status === s).length))],
      [`${t.guidingPrinciple}s`, String(m.principles.approved), String(m.principles.inReview), String(m.principles.proposed)],
      [`${t.designDriver}s`, String(data.drivers.filter((d) => d.approvalStatus === 'approved').length), String(data.drivers.filter((d) => d.approvalStatus === 'under_review').length), String(data.drivers.filter((d) => d.approvalStatus === 'proposed').length)],
      [`${t.decision}s`, String(data.decisions.filter((d) => d.status === 'approved').length), String(data.decisions.filter((d) => d.status === 'recommended').length), String(data.decisions.filter((d) => ['framing', 'evaluating'].includes(d.status)).length)],
    ],
  })

  doc.heading('Risks and opportunities')
  doc.eyebrow('Recorded risks')
  const risks = data.drivers.flatMap((d) => d.risks.map((r) => [d.code, r]))
  m.atRisk.forEach((d) => risks.push([d.code, `${d.title} is marked At Risk.`]))
  if (risks.length) doc.table({ head: [['Driver', 'Risk']], body: risks, columnStyles: { 0: { cellWidth: 44 } } })
  else doc.para('No risks recorded.', { italic: true, color: MUTED })
  doc.eyebrow('Opportunities to strengthen alignment (identified gaps)')
  const opp = [
    ...gaps.requirementsNotInFramework.map((s) => `${s.code} requirement is not yet reflected in the framework.`),
    ...gaps.themesWithoutOwnerSupport.map((id) => `${data.themes.find((x) => x.id === id)?.code} has no Owner requirement support - confirm with the Owner.`),
    ...gaps.unsupportedPrinciples.map((id) => `${data.principles.find((x) => x.id === id)?.code} has no supporting evidence.`),
    ...m.withoutOwner.map((d) => `${d.code} needs an accountable owner.`),
  ]
  if (opp.length) opp.forEach((o) => doc.para(`- ${o}`, { size: 9.5 }))
  else doc.para('No gaps identified.', { italic: true, color: MUTED })

  downloadBlob(doc.finish(), exportFilename(data, 'alignment-report', 'pdf'))
}

export async function decisionRecordPdf(data: ProjectData, dec: Decision) {
  const doc = await createReport(data, `Decision Record ${dec.code}`)
  const ev = evaluateCba(dec)
  const name = (id: string | null | undefined) => data.people.find((x) => x.id === id)?.name ?? 'Unknown'
  const alt = (id: string | undefined) => dec.alternatives.find((a) => a.id === id)?.name ?? ''

  doc.heading('Decision')
  doc.eyebrow(`${dec.code} - ${dec.status === 'approved' ? 'APPROVED' : `NOT APPROVED - ${DECISION_STATUS_LABELS[dec.status].toUpperCase()}`}`)
  doc.para(dec.question, { size: 13, bold: true })
  if (dec.context) doc.para(dec.context)
  doc.para(`Relevant Design Drivers: ${decisionDriverIds(data, dec.id).map((id) => { const d = data.drivers.find((x) => x.id === id); return `${d?.code} ${d?.title}` }).join('; ') || 'none linked'}`, { size: 9, color: MUTED })

  doc.heading('Alternatives')
  doc.table({
    head: [['Alternative', 'Description', 'Cost', 'Schedule', 'Risks', 'Eligible']],
    body: dec.alternatives.map((a) => [a.name, a.description, a.cost === null ? 'Unknown' : `$${a.cost.toLocaleString()}${a.costBasis ? ` (${a.costBasis})` : ''}`, a.scheduleImpact, a.risks, ev.eligible[a.id] ? 'Yes' : 'No - fails a mandatory requirement']),
  })

  if (dec.mandatoryRequirements.length) {
    doc.heading('Mandatory requirements')
    doc.table({ head: [['Requirement', ...dec.alternatives.map((a) => a.name)]], body: dec.mandatoryRequirements.map((m) => [m.text, ...dec.alternatives.map((a) => (m.results[a.id] ?? 'unknown').toUpperCase())]) })
  }

  doc.heading('Choosing by Advantages evaluation')
  doc.para('Importance is judged by the team for each advantage (a factual difference from the least-preferred attribute). Cost is evaluated separately.', { size: 9, color: MUTED })
  for (const f of dec.factors) {
    doc.eyebrow(`Factor: ${f.name}${f.criterion ? ` - ${f.criterion}` : ''}${dec.paramountFactorId === f.id ? ' (paramount)' : ''}`)
    doc.table({
      head: [['Alternative', 'Attribute', 'Advantage', 'Importance']],
      body: dec.alternatives.map((a) => [a.name, f.attributes[a.id] ?? '', a.id === f.leastPreferredAltId ? 'Least preferred' : (f.advantages[a.id]?.description ?? ''), a.id === f.leastPreferredAltId ? '0' : String(f.advantages[a.id]?.importance ?? 'Not judged')]),
    })
    if (f.importanceRationale) doc.para(`Rationale: ${f.importanceRationale}`, { size: 9 })
  }
  doc.table({ head: [['Alternative', 'Total importance of advantages', 'Cost']], body: dec.alternatives.map((a) => [a.name, ev.eligible[a.id] ? String(ev.totals[a.id]) : 'Excluded', a.cost === null ? 'Unknown' : `$${a.cost.toLocaleString()}`]) })
  if (!ev.complete) doc.para(`Evaluation incomplete: ${ev.issues.filter((i) => i.severity === 'blocking').length} open item(s).`, { color: PDF_WARN })

  doc.heading('Recommendation and approval')
  doc.para(dec.recommendation ? `Recommended: ${alt(dec.recommendation.alternativeId)} - by ${name(dec.recommendation.by)}, ${dec.recommendation.at.slice(0, 10)}. ${dec.recommendation.rationale}` : 'No recommendation recorded.')
  doc.para(dec.approval ? `Final decision: ${alt(dec.approval.alternativeId)} - approved by ${name(dec.approval.by)}, ${dec.approval.at.slice(0, 10)}. ${dec.approval.note}` : 'Not approved.', { bold: !!dec.approval })

  doc.heading('Decision history')
  doc.table({ head: [['Date', 'By', 'Action', 'Note']], body: dec.history.map((h) => [h.at.slice(0, 10), name(h.by), h.action, h.note]) })

  downloadBlob(doc.finish(), exportFilename(data, `decision-${dec.code}`, 'pdf'))
}
