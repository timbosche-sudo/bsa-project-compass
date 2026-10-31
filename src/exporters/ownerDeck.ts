import PptxGenJS from 'pptxgenjs'
import { BSA } from '@/brand/brand'
import { BSA_LOGO_ASPECT } from '@/brand/logo'
import type { ProjectData } from '@/domain/types'
import { brandLogo } from './brandAssets'
import { downloadBlob, exportFilename } from './common'
import { deliverableModel } from './deliverables'

// BSA Brand Style Guide 2026: Lato (Black for headlines), black/white, teal for quotes, red for the logo box.
const INK = BSA.black.slice(1)
const PAPER = 'FFFFFF'
const MUTED = BSA.black80.slice(1)
const SOFT = 'CCCCCC'
const TEAL = BSA.teal.slice(1)
const RED = BSA.red.slice(1)
const FONT = 'Lato'
const HEAD = 'Lato Black'
const W = 13.333
const LOGO_H = 0.5
const LOGO_W = LOGO_H * BSA_LOGO_ASPECT
const X = 0.7
const CW = W - X * 2

const CHAPTERS = [
  ['What We Heard', 'What you told us matters most.'],
  ['What We Believe', 'Our interpretation, and the direction we recommend.'],
  ['What Will Guide Us', 'The principles that will shape every design decision.'],
  ['What Success Could Look Like', 'If we deliver on this vision, what should be different or better?'],
] as const

export interface Logos {
  red: string
  white: string
}

/**
 * Owner Alignment Presentation: the four-chapter story from the workshop as an
 * editable PowerPoint. Every text item is a native, editable text box; the only
 * images are the BSA logos. Supporting evidence is placed in the speaker notes.
 */
export async function buildOwnerDeck(data: ProjectData, logos: Logos): Promise<Blob> {
  const m = deliverableModel(data, { presentationOnly: true })
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'BSA Project Compass'
  pptx.company = 'BSA'
  pptx.title = `${m.project.name} — Owner Alignment Presentation`
  const footer = `${m.project.name}${m.status.aligned ? '' : '  |  Working draft for discussion'}${m.project.isDemo ? '  |  SYNTHETIC DEMONSTRATION DATA' : ''}`

  pptx.defineSlideMaster({
    title: 'LIGHT',
    background: { color: PAPER },
    objects: [
      { image: { data: logos.red, x: X, y: 6.65, w: LOGO_W, h: LOGO_H } },
      { text: { text: footer, options: { x: 3.4, y: 6.85, w: 8.6, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, align: 'right' } } },
    ],
    slideNumber: { x: 12.15, y: 6.85, w: 0.5, fontFace: FONT, fontSize: 9, color: INK, align: 'right' },
  })
  pptx.defineSlideMaster({
    title: 'DARK',
    background: { color: INK },
    objects: [
      { image: { data: logos.white, x: X, y: 6.65, w: LOGO_W, h: LOGO_H } },
      { text: { text: footer, options: { x: 3.4, y: 6.85, w: 8.6, h: 0.3, fontFace: FONT, fontSize: 9, color: SOFT, align: 'right' } } },
    ],
    slideNumber: { x: 12.15, y: 6.85, w: 0.5, fontFace: FONT, fontSize: 9, color: PAPER, align: 'right' },
  })

  const header = (s: PptxGenJS.Slide, title: string, detail = '', dark = false) => {
    s.addText(
      [
        { text: title.toUpperCase(), options: { fontFace: HEAD, color: dark ? PAPER : INK } },
        ...(detail ? [{ text: `   ${detail.toUpperCase()}`, options: { fontFace: FONT, color: dark ? SOFT : MUTED } }] : []),
      ],
      { x: X, y: 0.5, w: CW, h: 0.35, fontSize: 11, charSpacing: 1.1, margin: 0 },
    )
    s.addShape(pptx.ShapeType.line, { x: X, y: 0.95, w: CW, h: 0, line: { color: dark ? PAPER : INK, width: 1 } })
  }
  const rule = (s: PptxGenJS.Slide, x: number, y: number, w: number, dark = false) => s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color: dark ? PAPER : INK, width: 1 } })

  // Title
  const title = pptx.addSlide({ masterName: 'DARK' })
  const boxW = LOGO_W * 1.9
  const boxH = LOGO_H * 2.6
  title.addShape(pptx.ShapeType.rect, { x: (W - boxW) / 2, y: 0, w: boxW, h: boxH, fill: { color: RED }, line: { color: RED } })
  title.addImage({ data: logos.white, x: (W - LOGO_W * 1.2) / 2, y: (boxH - LOGO_H * 1.2) / 2, w: LOGO_W * 1.2, h: LOGO_H * 1.2 })
  title.addText(m.project.owner.toUpperCase(), { x: 0.8, y: 2.8, w: W - 1.6, h: 0.4, fontFace: FONT, fontSize: 13, color: PAPER, align: 'center', charSpacing: 1.3 })
  title.addText(m.project.name, { x: 0.8, y: 3.25, w: W - 1.6, h: 1.3, fontFace: HEAD, fontSize: 40, color: PAPER, align: 'center' })
  title.addShape(pptx.ShapeType.line, { x: W / 2 - 0.5, y: 4.75, w: 1.0, h: 0, line: { color: PAPER, width: 1 } })
  title.addText('OWNER ALIGNMENT', { x: 0.8, y: 4.9, w: W - 1.6, h: 0.5, fontFace: HEAD, fontSize: 18, color: PAPER, align: 'center', charSpacing: 1.8 })
  title.addText(m.status.label, { x: 0.8, y: 5.45, w: W - 1.6, h: 0.4, fontFace: FONT, fontSize: 12, color: SOFT, align: 'center' })

  const chapter = (n: number) => {
    const s = pptx.addSlide({ masterName: 'DARK' })
    const [name, purpose] = CHAPTERS[n - 1]
    s.addText(String(n).padStart(2, '0'), { x: 1.0, y: 1.4, w: 4, h: 1.3, fontFace: HEAD, fontSize: 88, color: TEAL, margin: 0 })
    s.addText(name, { x: 1.0, y: 2.85, w: 11, h: 1.1, fontFace: HEAD, fontSize: 48, color: PAPER, margin: 0 })
    s.addShape(pptx.ShapeType.line, { x: 1.0, y: 4.15, w: 1.3, h: 0, line: { color: PAPER, width: 1 } })
    s.addText(purpose, { x: 1.0, y: 4.35, w: 10, h: 0.6, fontFace: FONT, fontSize: 20, color: SOFT, margin: 0 })
  }

  // Chapter 1 — What We Heard
  if (m.heard.length) {
    chapter(1)
    for (const sec of m.heard) {
      const s = pptx.addSlide({ masterName: 'LIGHT' })
      header(s, 'What we heard', sec.label)
      s.addText(sec.label, { x: X, y: 1.2, w: CW, h: 0.75, fontFace: HEAD, fontSize: 30, color: INK, margin: 0 })
      const items = sec.items.slice(0, 6)
      const cols = Math.min(3, items.length)
      const colW = (CW - (cols - 1) * 0.4) / cols
      const rowH = items.length > 3 ? 2.15 : 4.2
      items.forEach((h, i) => {
        const cx = X + (i % cols) * (colW + 0.4)
        const cy = 2.25 + Math.floor(i / cols) * (rowH + 0.15)
        rule(s, cx, cy, colW)
        s.addText(
          [
            { text: h.title, options: { fontFace: HEAD, fontSize: items.length > 3 ? 17 : 20, color: INK, breakLine: true } },
            ...(h.narrative ? [{ text: h.narrative, options: { fontFace: FONT, fontSize: items.length > 3 ? 12 : 14, color: MUTED, breakLine: true, paraSpaceBefore: 6 } }] : []),
            ...(h.quote ? [{ text: `“${h.quote.text}”${h.quote.speaker ? ` — ${h.quote.speaker}` : ''}`, options: { fontFace: FONT, fontSize: items.length > 3 ? 11.5 : 13, italic: true, color: TEAL, paraSpaceBefore: 8 } }] : []),
          ],
          { x: cx, y: cy + 0.1, w: colW, h: rowH - 0.1, valign: 'top', margin: 0 },
        )
      })
      const refs = items.map((h) => h.quote?.code).filter(Boolean)
      if (refs.length) s.addNotes(`Quotes: ${refs.join(', ')}. Items are reviewed What We Heard entries marked for the presentation.`)
    }
  }

  // Chapter 2 — What We Believe
  chapter(2)
  if (m.pointOfView?.centralAmbition) {
    const pov = m.pointOfView
    const s = pptx.addSlide({ masterName: 'DARK' })
    header(s, 'What we believe', 'Our point of view', true)
    s.addText(pov.centralAmbition, { x: X, y: 1.3, w: 11.2, h: 2.3, fontFace: HEAD, fontSize: 32, color: PAPER, valign: 'top', margin: 0 })
    const blocks = [
      ['The opportunity', pov.opportunity],
      ['What connects it', pov.connectingIdea],
    ].filter(([, v]) => v)
    blocks.forEach(([label, text], i) => {
      const cx = X + i * 6.1
      rule(s, cx, 3.95, 5.7, true)
      s.addText(
        [
          { text: label.toUpperCase(), options: { fontFace: HEAD, fontSize: 10.5, color: PAPER, charSpacing: 1, breakLine: true } },
          { text, options: { fontFace: FONT, fontSize: 13, color: SOFT, paraSpaceBefore: 6 } },
        ],
        { x: cx, y: 4.05, w: 5.7, h: 2.4, valign: 'top', margin: 0 },
      )
    })
  }
  const visions = [...(m.vision ? [m.vision] : []), ...m.visionAlternatives]
  visions.forEach((v, i) => {
    const s = pptx.addSlide({ masterName: 'DARK' })
    header(s, m.terms.vision, visions.length > 1 ? `${i === 0 ? 'Recommended — ' : ''}Alternative ${String.fromCharCode(65 + i)} of ${visions.length}` : 'Recommended', true)
    s.addText(v.statement, { x: X, y: 1.5, w: 11.5, h: 2.6, fontFace: HEAD, fontSize: 48, color: PAPER, valign: 'top', margin: 0 })
    if (v.narrative) s.addText(v.narrative, { x: X, y: 4.3, w: 10, h: 1.9, fontFace: FONT, fontSize: 16, color: SOFT, valign: 'top', margin: 0 })
    s.addNotes(`${v.code} — ${v.approvalLabel}.`)
  })

  // Chapter 3 — What Will Guide Us
  chapter(3)
  const ov = pptx.addSlide({ masterName: 'LIGHT' })
  header(ov, 'What will guide us', `${m.principles.length} ${m.terms.principle.toLowerCase()}s`)
  ov.addText(`${m.terms.principle}s`, { x: X, y: 1.2, w: CW, h: 0.75, fontFace: HEAD, fontSize: 30, color: INK, margin: 0 })
  const cols = m.principles.length <= 4 ? 2 : 3
  const colW = (CW - (cols - 1) * 0.35) / cols
  m.principles.slice(0, 9).forEach((x, i) => {
    const cx = X + (i % cols) * (colW + 0.35)
    const cy = 2.2 + Math.floor(i / cols) * 1.45
    rule(ov, cx, cy, colW)
    ov.addText(
      [
        { text: String(i + 1).padStart(2, '0'), options: { fontFace: HEAD, fontSize: 11, color: INK, breakLine: true } },
        { text: x.title, options: { fontFace: HEAD, fontSize: 16, color: INK, breakLine: true } },
        { text: x.statement, options: { fontFace: FONT, fontSize: 10.5, color: MUTED } },
      ],
      { x: cx, y: cy + 0.08, w: colW, h: 1.3, valign: 'top', margin: 0 },
    )
  })
  m.principles.forEach((x, i) => {
    const s = pptx.addSlide({ masterName: 'LIGHT' })
    header(s, `${m.terms.principle} ${String(i + 1).padStart(2, '0')}`, x.category)
    const opps = x.opportunities.slice(0, 2)
    const aside = !!x.whyItMatters || opps.length > 0
    const leftW = aside ? 6.9 : CW
    s.addText(x.title, { x: X, y: 1.3, w: leftW, h: 1.5, fontFace: HEAD, fontSize: aside ? 36 : 44, color: INK, valign: 'top', margin: 0 })
    s.addText(x.statement, { x: X, y: 2.9, w: leftW, h: 1.3, fontFace: FONT, fontSize: 19, color: INK, valign: 'top', margin: 0 })
    if (x.intent) s.addText(x.intent, { x: X, y: 4.3, w: leftW, h: 1.6, fontFace: FONT, fontSize: 12.5, color: MUTED, valign: 'top', margin: 0 })
    if (aside) {
      const ax = 8.1
      const aw = W - X - ax
      let ay = 1.3
      if (x.whyItMatters) {
        rule(s, ax, ay, aw)
        s.addText(
          [
            { text: 'WHY IT MATTERS', options: { fontFace: HEAD, fontSize: 10.5, color: INK, charSpacing: 1, breakLine: true } },
            { text: x.whyItMatters, options: { fontFace: FONT, fontSize: 11.5, color: MUTED, paraSpaceBefore: 6 } },
          ],
          { x: ax, y: ay + 0.1, w: aw, h: 1.9, valign: 'top', margin: 0 },
        )
        ay += 2.15
      }
      if (opps.length) {
        rule(s, ax, ay, aw)
        s.addText(
          [
            { text: 'DESIGN OPPORTUNITIES', options: { fontFace: HEAD, fontSize: 10.5, color: INK, charSpacing: 1, breakLine: true } },
            ...opps.flatMap((o) => [
              { text: o.title, options: { fontFace: HEAD, fontSize: 13, color: INK, breakLine: true, paraSpaceBefore: 8 } },
              { text: o.description, options: { fontFace: FONT, fontSize: 10.5, color: MUTED, breakLine: true } },
            ]),
          ],
          { x: ax, y: ay + 0.1, w: aw, h: 2.6, valign: 'top', margin: 0 },
        )
      }
    }
    s.addNotes(
      [
        `${x.code} — ${x.approvalLabel}. Owner alignment: ${x.alignmentLabel}.`,
        x.refinements && `Requested refinements: ${x.refinements}`,
        x.evidence.length ? `Grounded in ${x.evidenceCount} statement(s), e.g. ${x.evidence.map((e) => `${e.code} “${e.text}”${e.speaker ? ` (${e.speaker})` : ''}`).join('; ')}` : 'No linked evidence.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  })

  // Chapter 4 — What Success Could Look Like
  const outcomes = m.principles.flatMap((x) => x.outcomes.map((o) => ({ ...o, principle: x.title }))).slice(0, 8)
  if (outcomes.length) {
    chapter(4)
    const s = pptx.addSlide({ masterName: 'LIGHT' })
    header(s, 'What success could look like', 'Illustrative — to be shaped together')
    s.addText('If we deliver on this vision, what should be different or better?', { x: X, y: 1.2, w: CW, h: 1.0, fontFace: HEAD, fontSize: 26, color: INK, valign: 'top', margin: 0 })
    const c = outcomes.length <= 4 ? 2 : 4
    const w = (CW - (c - 1) * 0.35) / c
    outcomes.forEach((o, i) => {
      const cx = X + (i % c) * (w + 0.35)
      const cy = 2.5 + Math.floor(i / c) * 1.95
      rule(s, cx, cy, w)
      s.addText(
        [
          { text: o.principle.toUpperCase(), options: { fontFace: FONT, fontSize: 9, color: MUTED, charSpacing: 1, breakLine: true } },
          { text: o.statement, options: { fontFace: HEAD, fontSize: 16, color: INK, breakLine: true, paraSpaceBefore: 4 } },
          ...(o.aspiration ? [{ text: 'An aspiration — how to measure it is still to be defined', options: { fontFace: FONT, fontSize: 9, color: MUTED, paraSpaceBefore: 4 } }] : []),
        ],
        { x: cx, y: cy + 0.08, w, h: 1.8, valign: 'top', margin: 0 },
      )
    })
    s.addNotes('Potential outcomes are illustrative. No targets or baselines are implied.')
  }

  // Discussion
  const d = pptx.addSlide({ masterName: 'LIGHT' })
  header(d, 'For discussion')
  const tensions = m.pointOfView?.tensions
  d.addText(
    m.discussion.map((q, i) => ({ text: `${String(i + 1).padStart(2, '0')}   ${q}`, options: { breakLine: true, paraSpaceAfter: 18 } })),
    { x: X, y: 1.4, w: tensions ? 7.0 : CW, h: 4.6, fontFace: HEAD, fontSize: 24, color: INK, valign: 'top', margin: 0 },
  )
  if (tensions) {
    rule(d, 8.3, 1.4, W - X - 8.3)
    d.addText(
      [
        { text: 'TENSIONS TO NAVIGATE TOGETHER', options: { fontFace: HEAD, fontSize: 10.5, color: INK, charSpacing: 1, breakLine: true } },
        { text: tensions, options: { fontFace: FONT, fontSize: 12, color: MUTED, paraSpaceBefore: 6 } },
      ],
      { x: 8.3, y: 1.5, w: W - X - 8.3, h: 4.5, valign: 'top', margin: 0 },
    )
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob
}

export async function ownerDeck(data: ProjectData) {
  const blob = await buildOwnerDeck(data, { red: await brandLogo('red'), white: await brandLogo('white') })
  downloadBlob(blob, exportFilename(data, 'owner-alignment-presentation', 'pptx'))
}

