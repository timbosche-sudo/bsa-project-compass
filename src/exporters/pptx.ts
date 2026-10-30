import PptxGenJS from 'pptxgenjs'
import { decisionDriverIds, driverPrincipleIds, driverStatus } from '@/domain/drivers'
import { DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { dashboardModel } from '@/domain/metrics'
import type { ProjectData } from '@/domain/types'
import { BSA } from '@/brand/brand'
import { BSA_LOGO_ASPECT } from '@/brand/logo'
import { brandLogo } from './brandAssets'
import { downloadBlob, exportFilename, reportReadiness } from './common'
import { isActiveFramework } from '@/domain/wording'

// BSA Brand Style Guide 2026: Lato (Black for headlines), black/white text, red/teal accents.
const INK = BSA.black.slice(1)
const MUTED = BSA.black80.slice(1)
const LINE = BSA.black10.slice(1)
const GREY20 = BSA.grey20.slice(1)
const RED = BSA.red.slice(1)
const FONT = 'Lato'
const HEAD = 'Lato Black'
const LOGO_H = 0.5 // in — minimum logo size (p. 15)
const LOGO_W = LOGO_H * BSA_LOGO_ASPECT

/**
 * Project Alignment Presentation. Contains only recorded project content —
 * no generated charts, photography or metrics. Draft items are labelled.
 */
export async function alignmentDeck(data: ProjectData) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  pptx.author = 'BSA Project Compass'
  pptx.company = 'BSA'
  pptx.title = `${data.project.name} — Project Alignment`
  const p = data.project
  const t = p.terminology
  const m = dashboardModel(data)
  const footer = `${p.name}  |  Project Compass${p.isDemo ? '  |  SYNTHETIC DEMONSTRATION DATA' : ''}`
  const redLogo = await brandLogo('red')
  const whiteLogo = await brandLogo('white')

  // Content slides: white background, red logo bottom-left with clear space, 1pt black division line.
  pptx.defineSlideMaster({
    title: 'COMPASS',
    background: { color: 'FFFFFF' },
    objects: [
      { line: { x: 0.6, y: 1.05, w: 12.13, h: 0, line: { color: INK, width: 1 } } },
      { image: { data: redLogo, x: 0.6, y: 6.6, w: LOGO_W, h: LOGO_H } },
      { text: { text: footer, options: { x: 3.6, y: 6.85, w: 8.3, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, align: 'right' } } },
    ],
    slideNumber: { x: 12.1, y: 6.85, w: 0.6, fontFace: FONT, fontSize: 9, color: INK, align: 'right' },
  })
  const slide = (eyebrow: string, title: string) => {
    const s = pptx.addSlide({ masterName: 'COMPASS' })
    s.addText(eyebrow.toUpperCase(), { x: 0.6, y: 0.62, w: 12, h: 0.35, fontFace: HEAD, fontSize: 11, color: INK, charSpacing: 1.1 })
    s.addText(title, { x: 0.6, y: 1.2, w: 12, h: 0.75, fontFace: HEAD, fontSize: 28, color: INK })
    return s
  }
  const draft = (status: string) => (status === 'approved' ? '' : `  [DRAFT — ${status.replace('_', ' ')}]`)

  // 1. Title
  // Title: black background; centered red-box logo touching the top edge (p. 13).
  const title = pptx.addSlide()
  title.background = { color: INK }
  const boxW = LOGO_W * 1.9
  const boxH = LOGO_H * 2.6
  title.addShape(pptx.ShapeType.rect, { x: (13.333 - boxW) / 2, y: 0, w: boxW, h: boxH, fill: { color: RED }, line: { color: RED } })
  title.addImage({ data: whiteLogo, x: (13.333 - LOGO_W * 1.2) / 2, y: (boxH - LOGO_H * 1.2) / 2, w: LOGO_W * 1.2, h: LOGO_H * 1.2 })
  title.addText(p.owner.name.toUpperCase(), { x: 0.8, y: 2.9, w: 11.73, h: 0.4, fontFace: FONT, fontSize: 13, color: 'FFFFFF', align: 'center', charSpacing: 1.3 })
  title.addText(p.name, { x: 0.8, y: 3.35, w: 11.73, h: 1.3, fontFace: HEAD, fontSize: 40, color: 'FFFFFF', align: 'center' })
  title.addShape(pptx.ShapeType.line, { x: 6.17, y: 4.85, w: 1.0, h: 0, line: { color: 'FFFFFF', width: 1 } })
  title.addText(reportReadiness(data).final ? 'PROJECT ALIGNMENT' : 'PROJECT ALIGNMENT — DRAFT', { x: 0.8, y: 5.0, w: 11.73, h: 0.5, fontFace: HEAD, fontSize: 18, color: 'FFFFFF', align: 'center', charSpacing: 1.8 })
  title.addText(`${SECTOR_LABELS[p.sector]}  |  ${PHASE_LABELS[p.phase]}  |  ${new Date().toISOString().slice(0, 10)}`, { x: 0.8, y: 5.55, w: 11.73, h: 0.4, fontFace: FONT, fontSize: 12, color: 'CCCCCC', align: 'center' })
  if (p.isDemo) title.addText('SYNTHETIC DEMONSTRATION DATA — FICTIONAL PROJECT', { x: 0.8, y: 6.8, w: 11.73, h: 0.35, fontFace: HEAD, fontSize: 10, color: 'FFFFFF', align: 'center', charSpacing: 1 })

  // 2. Institutional context
  const ctx = slide('Institutional context', p.owner.name)
  ctx.addText(p.owner.mission ? `“${p.owner.mission}”` : 'Mission not recorded.', { x: 0.6, y: 2.0, w: 12, h: 1.4, fontFace: FONT, fontSize: 22, italic: !!p.owner.mission, color: INK })
  ctx.addText(p.owner.type || '', { x: 0.6, y: 3.6, w: 12, h: 0.4, fontFace: FONT, fontSize: 13, color: MUTED })

  // 3. Project ambition
  const amb = slide('Project ambition', p.tagline || p.name)
  amb.addText(p.description || 'No project description recorded.', { x: 0.6, y: 2.0, w: 11.5, h: 2.5, fontFace: FONT, fontSize: 16, color: INK, valign: 'top' })

  // 4. Win Theme
  const wts = data.winThemes.filter((w) => isActiveFramework(w.status))
  const wt = wts.find((w) => w.status === 'approved') ?? wts[0]
  const w = pptx.addSlide()
  w.background = { color: INK }
  w.addText(t.winTheme.toUpperCase() + (wt ? draft(wt.status) : ''), { x: 0.6, y: 0.62, w: 12, h: 0.35, fontFace: HEAD, fontSize: 11, color: 'FFFFFF', charSpacing: 1.1 })
  w.addShape(pptx.ShapeType.line, { x: 0.6, y: 1.05, w: 12.13, h: 0, line: { color: 'FFFFFF', width: 1 } })
  w.addText(wt?.statement ?? 'Not yet defined', { x: 0.6, y: 1.7, w: 12, h: 2.4, fontFace: HEAD, fontSize: 46, color: 'FFFFFF', valign: 'top' })
  if (wt?.narrative) w.addText(wt.narrative, { x: 0.6, y: 4.3, w: 10.5, h: 1.6, fontFace: FONT, fontSize: 16, color: 'CCCCCC', valign: 'top' })
  w.addImage({ data: whiteLogo, x: 0.6, y: 6.6, w: LOGO_W, h: LOGO_H })
  w.addText(footer, { x: 3.6, y: 6.85, w: 9.13, h: 0.3, fontFace: FONT, fontSize: 9, color: 'CCCCCC', align: 'right' })

  // 5. Guiding Principles
  const gp = slide('Guiding principles', `${t.guidingPrinciple}s`)
  const principles = data.principles.filter((x) => isActiveFramework(x.status)).sort((a, b) => a.order - b.order)
  const cols = 3
  principles.slice(0, 9).forEach((x, i) => {
    const cx = 0.6 + (i % cols) * 4.1
    const cy = 1.9 + Math.floor(i / cols) * 1.65
    gp.addShape(pptx.ShapeType.rect, { x: cx, y: cy, w: 3.9, h: 1.5, fill: { color: GREY20 }, line: { color: LINE } })
    gp.addText(
      [
        { text: `${x.code}${draft(x.status)}\n`, options: { fontSize: 9, color: INK, bold: true } },
        { text: `${x.title}\n`, options: { fontFace: HEAD, fontSize: 15, color: INK } },
        { text: x.statement, options: { fontSize: 9.5, color: MUTED } },
      ],
      { x: cx + 0.15, y: cy + 0.08, w: 3.6, h: 1.35, fontFace: FONT, valign: 'top' },
    )
  })
  if (!principles.length) gp.addText('No principles recorded.', { x: 0.6, y: 2, w: 10, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED })

  // 6. Priority Design Drivers (Owner-mandatory first, then at risk)
  const drivers = data.drivers.filter((d) => d.approvalStatus !== 'superseded')
  const priority = [...drivers.filter((d) => d.requirementClass === 'owner_mandatory'), ...drivers.filter((d) => d.requirementClass !== 'owner_mandatory' && d.performanceStatus === 'at_risk')].slice(0, 8)
  const pd = slide('Priority design drivers', `Owner-mandatory and at-risk ${t.designDriver.toLowerCase()}s`)
  const head = (cells: string[]) => cells.map((c) => ({ text: c, options: { fontFace: HEAD, fill: { color: GREY20 }, color: INK } }))
  pd.addTable(
    [
      head(['ID', t.designDriver, 'Principles', 'Status', 'Accountable']),
      ...priority.map((d) => [d.code, d.title, driverPrincipleIds(data, d.id).map((id) => data.principles.find((x) => x.id === id)?.code).join(', '), DRIVER_STATUS_LABELS[driverStatus(d)], data.people.find((x) => x.id === d.ownerPersonId)?.name ?? 'Unassigned'].map((text) => ({ text }))),
    ],
    { x: 0.6, y: 1.9, w: 12.1, colW: [0.8, 4.6, 1.6, 1.8, 3.3], fontFace: FONT, fontSize: 11, border: { type: 'solid', color: LINE, pt: 0.5 } },
  )

  // 7. Measures of Success — recorded values only; unknowns stated explicitly
  const ms = slide('Measures of success', 'Targets and current observations')
  const quant = drivers.filter((d) => d.measure.kind === 'quantitative').slice(0, 10)
  ms.addTable(
    [
      head(['ID', 'Measure', 'Baseline', 'Target', 'Current']),
      ...quant.map((d) =>
        [
          d.code,
          `${d.title} (${d.measure.unit || 'unit not set'})`,
          d.measure.baseline ?? 'Unknown',
          d.measure.target ? `${d.measure.target}${d.measure.targetStatus === 'approved' ? '' : ' (not approved)'}` : 'Not set',
          d.measure.current ? `${d.measure.current}${d.measure.currentAsOf ? ` (${d.measure.currentAsOf})` : ''}` : 'Not yet measured',
        ].map((text) => ({ text })),
      ),
    ],
    { x: 0.6, y: 1.9, w: 12.1, colW: [0.8, 5.2, 1.7, 2.1, 2.3], fontFace: FONT, fontSize: 10.5, border: { type: 'solid', color: LINE, pt: 0.5 } },
  )
  ms.addText(`${m.verified.length} driver(s) verified with evidence. Definition completeness ${Math.round(m.completeness * 100)}% (a measure of how fully drivers are specified, not of success).`, { x: 0.6, y: 6.4, w: 12, h: 0.4, fontFace: FONT, fontSize: 10, color: MUTED })

  // 8. Outstanding decisions
  const od = slide('Outstanding decisions', `${t.decision}s not yet approved`)
  const outstanding = data.decisions.filter((d) => d.status !== 'approved')
  od.addTable(
    [
      head(['ID', 'Question', 'Status', 'Needed by', 'Drivers']),
      ...outstanding.map((d) => [d.code, d.question, DECISION_STATUS_LABELS[d.status], d.dueDate ?? '—', decisionDriverIds(data, d.id).map((id) => data.drivers.find((x) => x.id === id)?.code).join(', ')].map((text) => ({ text }))),
    ],
    { x: 0.6, y: 1.9, w: 12.1, colW: [1.0, 6.4, 1.6, 1.4, 1.7], fontFace: FONT, fontSize: 11, border: { type: 'solid', color: LINE, pt: 0.5 } },
  )

  // 9. Next steps — from recorded milestones and open questions
  const ns = slide('Next steps', 'Upcoming milestones and open questions')
  const steps = [
    ...m.upcomingMilestones.slice(0, 5).map((x) => `${x.date} — ${x.name}`),
    ...data.questions.filter((q) => q.status === 'open').slice(0, 4).map((q) => `Resolve ${q.code}: ${q.question}`),
  ]
  ns.addText(
    steps.length ? steps.map((text) => ({ text, options: { bullet: true, breakLine: true } })) : [{ text: 'No upcoming milestones or open questions recorded.' }],
    { x: 0.6, y: 1.9, w: 12, h: 4.6, fontFace: FONT, fontSize: 15, color: INK, valign: 'top', paraSpaceAfter: 8 },
  )

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob
  downloadBlob(blob, exportFilename(data, 'alignment-presentation', 'pptx'))
}
