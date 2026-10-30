import PptxGenJS from 'pptxgenjs'
import { decisionDriverIds, driverPrincipleIds, driverStatus } from '@/domain/drivers'
import { DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { dashboardModel } from '@/domain/metrics'
import type { ProjectData } from '@/domain/types'
import { downloadBlob, exportFilename, reportReadiness } from './common'
import { isActiveFramework } from '@/domain/wording'

const INK = '0B0D0F'
const ACCENT = '0B8FA1'
const MUTED = '62686F'
const LINE = 'E2E2DE'
const FONT = 'Arial'

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
  const footer = `${p.name} · BSA Project Compass${p.isDemo ? ' · SYNTHETIC DEMONSTRATION DATA' : ''}`

  pptx.defineSlideMaster({
    title: 'COMPASS',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0.6, y: 0.55, w: 0.5, h: 0.05, fill: { color: ACCENT } } },
      { text: { text: footer, options: { x: 0.6, y: 7.0, w: 10, h: 0.3, fontFace: FONT, fontSize: 9, color: p.isDemo ? 'B83A14' : MUTED } } },
    ],
    slideNumber: { x: 12.3, y: 7.0, fontFace: FONT, fontSize: 9, color: MUTED },
  })
  const slide = (eyebrow: string, title: string) => {
    const s = pptx.addSlide({ masterName: 'COMPASS' })
    s.addText(eyebrow.toUpperCase(), { x: 0.6, y: 0.7, w: 12, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: MUTED, charSpacing: 2 })
    s.addText(title, { x: 0.6, y: 1.0, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: INK })
    return s
  }
  const draft = (status: string) => (status === 'approved' ? '' : `  [DRAFT — ${status.replace('_', ' ')}]`)

  // 1. Title
  const title = pptx.addSlide()
  title.background = { color: INK }
  title.addText('BSA PROJECT COMPASS', { x: 0.8, y: 0.8, w: 8, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: '22C3D6', charSpacing: 3 })
  title.addText(p.name, { x: 0.8, y: 2.4, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF' })
  title.addText(reportReadiness(data).final ? 'Project Alignment' : 'Project Alignment — DRAFT', { x: 0.8, y: 3.6, w: 11, h: 0.6, fontFace: FONT, fontSize: 22, color: 'CCCCCC' })
  title.addText(`${p.owner.name} · ${SECTOR_LABELS[p.sector]} · ${PHASE_LABELS[p.phase]} · ${new Date().toISOString().slice(0, 10)}`, { x: 0.8, y: 5.6, w: 11, h: 0.4, fontFace: FONT, fontSize: 12, color: 'AAAAAA' })
  if (p.isDemo) title.addText('SYNTHETIC DEMONSTRATION DATA — FICTIONAL PROJECT', { x: 0.8, y: 6.4, w: 11, h: 0.4, fontFace: FONT, fontSize: 11, bold: true, color: 'F0875F' })

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
  w.addText(t.winTheme.toUpperCase() + (wt ? draft(wt.status) : ''), { x: 0.8, y: 0.8, w: 11, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: '22C3D6', charSpacing: 2 })
  w.addText(wt?.statement ?? 'Not yet defined', { x: 0.8, y: 2.0, w: 11.7, h: 2.2, fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF' })
  if (wt?.narrative) w.addText(wt.narrative, { x: 0.8, y: 4.4, w: 11, h: 1.6, fontFace: FONT, fontSize: 15, color: 'CCCCCC', valign: 'top' })
  w.addText(footer, { x: 0.8, y: 7.0, w: 11, h: 0.3, fontFace: FONT, fontSize: 9, color: '888888' })

  // 5. Guiding Principles
  const gp = slide('Guiding principles', `${t.guidingPrinciple}s`)
  const principles = data.principles.filter((x) => isActiveFramework(x.status)).sort((a, b) => a.order - b.order)
  const cols = 3
  principles.slice(0, 9).forEach((x, i) => {
    const cx = 0.6 + (i % cols) * 4.1
    const cy = 1.9 + Math.floor(i / cols) * 1.65
    gp.addShape(pptx.ShapeType.rect, { x: cx, y: cy, w: 3.9, h: 1.5, fill: { color: 'F5F5F3' }, line: { color: LINE } })
    gp.addText(
      [
        { text: `${x.code}${draft(x.status)}\n`, options: { fontSize: 9, color: x.status === 'approved' ? ACCENT : 'B83A14', bold: true } },
        { text: `${x.title}\n`, options: { fontSize: 15, bold: true, color: INK } },
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
  const head = (cells: string[]) => cells.map((c) => ({ text: c, options: { bold: true, fill: { color: 'EEEEEB' }, color: INK } }))
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
