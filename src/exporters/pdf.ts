import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { evaluateCba } from '@/domain/cba'
import { decisionDriverIds, driverPrincipleIds, driverStatus, principleDriverIds } from '@/domain/drivers'
import { CATEGORY_LABELS, DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { dashboardModel } from '@/domain/metrics'
import { evidenceFor, gapReport } from '@/domain/traceability'
import type { Decision, ProjectData } from '@/domain/types'
import { downloadBlob, exportFilename, provenanceLines, reportReadiness } from './common'
import { isActiveFramework } from '@/domain/wording'

/** jsPDF's standard fonts are WinAnsi; normalize typographic characters. */
export function clean(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/…/g, '...')
    .replace(/·/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}

const INK: [number, number, number] = [11, 13, 15]
const ACCENT: [number, number, number] = [11, 143, 161]
const MUTED: [number, number, number] = [98, 104, 111]
const M = 48

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
    if (this.y + space > this.h - 60) {
      this.pdf.addPage()
      this.y = M
    }
  }
  heading(text: string, size = 15) {
    this.ensure(40)
    this.y += 10
    this.pdf.setFont('helvetica', 'bold').setFontSize(size).setTextColor(...INK)
    this.pdf.text(clean(text), M, this.y)
    this.y += 6
    this.pdf.setDrawColor(...ACCENT).setLineWidth(1.2).line(M, this.y, M + 36, this.y)
    this.y += 16
  }
  eyebrow(text: string) {
    this.ensure(18)
    this.pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...MUTED)
    this.pdf.text(clean(text).toUpperCase(), M, this.y)
    this.y += 12
  }
  para(text: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean; italic?: boolean } = {}) {
    const size = opts.size ?? 10
    this.pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal').setFontSize(size).setTextColor(...(opts.color ?? INK))
    const lines = this.pdf.splitTextToSize(clean(text), this.w - M * 2) as string[]
    // Large text needs extra leading above its first baseline.
    if (size > 10) this.y += size - 10
    for (const line of lines) {
      this.ensure(size * 1.4)
      this.pdf.text(line, M, this.y)
      this.y += size * 1.4
    }
    this.y += 4
  }
  table(opts: UserOptions) {
    autoTable(this.pdf, {
      startY: this.y,
      margin: { left: M, right: M, bottom: 60 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [226, 226, 222], lineWidth: 0.5, overflow: 'linebreak' },
      headStyles: { fillColor: [238, 238, 235], textColor: INK, fontStyle: 'bold' },
      ...opts,
      body: (opts.body ?? []).map((row) => (row as unknown[]).map((c) => (typeof c === 'string' ? clean(c) : c))) as UserOptions['body'],
    })
    this.y = ((this.pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? this.y) + 18
  }
  finish(): Blob {
    const n = this.pdf.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      this.pdf.setPage(i)
      this.pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
      this.pdf.text(clean(`BSA Project Compass - ${this.data.project.name} - ${this.title}`), M, this.h - 30)
      this.pdf.text(`Page ${i} of ${n}`, this.w - M, this.h - 30, { align: 'right' })
      if (this.data.project.isDemo) {
        this.pdf.setFont('helvetica', 'bold').setTextColor(184, 58, 20)
        this.pdf.text('SYNTHETIC DEMONSTRATION DATA - NOT A REAL PROJECT', this.w / 2, this.h - 18, { align: 'center' })
      }
    }
    return this.pdf.output('blob')
  }
}

const draftTag = (status: string) => (status === 'approved' ? 'APPROVED' : `DRAFT - ${status.replace('_', ' ').toUpperCase()}`)

function cover(doc: Doc, data: ProjectData, title: string) {
  const p = data.project
  doc.pdf.setFillColor(...INK).rect(0, 0, doc.w, 210, 'F')
  doc.pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(34, 195, 214)
  doc.pdf.text('BSA PROJECT COMPASS', M, 60)
  doc.pdf.setTextColor(255, 255, 255).setFontSize(24)
  doc.pdf.text(doc.pdf.splitTextToSize(clean(title), doc.w - 2 * M) as string[], M, 100)
  doc.pdf.setFont('helvetica', 'normal').setFontSize(11)
  doc.pdf.text(clean(`${p.name} (${p.code})`), M, 150)
  doc.pdf.setFontSize(9).setTextColor(200, 200, 200)
  doc.pdf.text(clean(`${p.owner.name} - ${SECTOR_LABELS[p.sector]} - ${PHASE_LABELS[p.phase]}`), M, 168)
  doc.y = 240
  provenanceLines(data).forEach((l) => doc.para(l, { size: 8.5, color: MUTED }))
}

export async function alignmentReportPdf(data: ProjectData) {
  const title = reportReadiness(data).final ? 'Project Alignment Report' : 'Project Alignment Report - DRAFT'
  const doc = new Doc(data, title)
  cover(doc, data, title)
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
    if (!ev.all.length) doc.para('No supporting evidence recorded - unsupported.', { italic: true, color: [184, 58, 20] })
    ev.all.slice(0, 4).forEach((s) => {
      const src = data.sources.find((x) => x.id === s.sourceId)
      doc.para(`"${s.originalText}" - ${s.code}, ${src?.code ?? ''} ${src?.title ?? ''}`, { size: 9, color: [47, 52, 58] })
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
  const doc = new Doc(data, `Decision Record ${dec.code}`)
  cover(doc, data, `Decision Record ${dec.code}`)
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
  if (!ev.complete) doc.para(`Evaluation incomplete: ${ev.issues.filter((i) => i.severity === 'blocking').length} open item(s).`, { color: [184, 58, 20] })

  doc.heading('Recommendation and approval')
  doc.para(dec.recommendation ? `Recommended: ${alt(dec.recommendation.alternativeId)} - by ${name(dec.recommendation.by)}, ${dec.recommendation.at.slice(0, 10)}. ${dec.recommendation.rationale}` : 'No recommendation recorded.')
  doc.para(dec.approval ? `Final decision: ${alt(dec.approval.alternativeId)} - approved by ${name(dec.approval.by)}, ${dec.approval.at.slice(0, 10)}. ${dec.approval.note}` : 'Not approved.', { bold: !!dec.approval })

  doc.heading('Decision history')
  doc.table({ head: [['Date', 'By', 'Action', 'Note']], body: dec.history.map((h) => [h.at.slice(0, 10), name(h.by), h.action, h.note]) })

  downloadBlob(doc.finish(), exportFilename(data, `decision-${dec.code}`, 'pdf'))
}


/** A branded report document with cover and footer, for other exporters to fill. */
export function createReport(data: ProjectData, title: string) {
  const doc = new Doc(data, title)
  cover(doc, data, title)
  return doc
}
