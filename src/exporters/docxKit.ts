import { AlignmentType, BorderStyle, Document, Footer, LevelFormat, LineRuleType, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, type ISectionOptions } from 'docx'
import { BSA } from '@/brand/brand'

/**
 * Editable Word documents in the BSA document style (Brand Style Guide 2026,
 * pp. 24–28): Lato, black text, 1pt black division lines, teal only for quotes.
 * Uses Word styles (Heading 1–3, Quote) so teams can restyle and navigate.
 */
const INK = BSA.black.slice(1)
const MUTED = BSA.black80.slice(1)
const TEAL = BSA.teal.slice(1)
const LINE = BSA.black10.slice(1)
const FONT = 'Lato'

export type Block = Paragraph | Table

export const h1 = (text: string) => new Paragraph({ text, style: 'Heading1' })
export const h2 = (text: string) => new Paragraph({ text, style: 'Heading2' })
export const h3 = (text: string) => new Paragraph({ text, style: 'Heading3' })
export const eyebrow = (text: string) => new Paragraph({ style: 'Eyebrow', children: [new TextRun(text.toUpperCase())] })
export const para = (text: string, o: { bold?: boolean; italic?: boolean; muted?: boolean; size?: number } = {}) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold: o.bold, italics: o.italic, color: o.muted ? MUTED : INK, size: o.size ? o.size * 2 : undefined })] })
export const labelled = (label: string, text: string) =>
  new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `${label}  `, bold: true }), new TextRun({ text, color: INK })] })
export const bullet = (text: string, detail?: string) =>
  new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, bold: !!detail }), ...(detail ? [new TextRun({ text: ` — ${detail}`, color: MUTED })] : [])] })
export const quote = (text: string, cite: string) =>
  new Paragraph({ style: 'Quote', children: [new TextRun({ text: `“${text}”` }), ...(cite ? [new TextRun({ text: `  — ${cite}`, italics: false, color: MUTED, size: 18 })] : [])] })
export const rule = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 1 } }, spacing: { after: 200 } })

export function table(head: string[], rows: string[][], widths?: number[]): Table {
  const total = 9360 // 6.5in content width in twips
  const w = widths ?? head.map(() => Math.floor(total / head.length))
  const cell = (text: string, i: number, header = false) =>
    new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: BSA.grey20.slice(1) } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 18 })] })],
    })
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: w,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: INK },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [...(head.some(Boolean) ? [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) })] : []), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i)) }))],
  })
}

/** Cover block: small caps label, title, subtitle, status lines, then a division line. */
export function cover(o: { label: string; title: string; subtitle: string; lines: string[] }): Block[] {
  return [
    new Paragraph({ style: 'Eyebrow', spacing: { before: 1200, after: 200 }, children: [new TextRun(o.label.toUpperCase())] }),
    new Paragraph({ style: 'Title', children: [new TextRun(o.title)] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: o.subtitle, size: 32 })] }),
    ...o.lines.map((l) => para(l, { muted: true, size: 9.5 })),
    rule(),
  ]
}

export function document(o: { title: string; footer: string; children: Block[] }): Document {
  const section: ISectionOptions = {
    properties: { page: { margin: { top: 900, bottom: 900, left: 1440, right: 1440 } } },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: INK, space: 4 } },
            children: [new TextRun({ text: `${o.footer}    BSA  |  `, size: 15, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: INK })],
          }),
        ],
      }),
    },
    children: o.children,
  }
  return new Document({
    creator: 'BSA Project Compass',
    title: o.title,
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: INK }, paragraph: { spacing: { line: 288, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Lato Black', size: 64, bold: true }, paragraph: { spacing: { before: 120, after: 160, line: 240, lineRule: LineRuleType.AUTO } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Lato Black', size: 36, bold: true }, paragraph: { spacing: { before: 360, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 4 } } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Lato Black', size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Lato Black', size: 22, bold: true }, paragraph: { spacing: { before: 200, after: 80 } } },
        { id: 'Eyebrow', name: 'Eyebrow', basedOn: 'Normal', next: 'Normal', run: { font: 'Lato Black', size: 16, bold: true, characterSpacing: 20 }, paragraph: { spacing: { before: 160, after: 60 } } },
        { id: 'Quote', name: 'Quote', basedOn: 'Normal', next: 'Normal', run: { italics: true, color: TEAL }, paragraph: { indent: { left: 360 }, spacing: { after: 100 } } },
      ],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
    sections: [section],
  })
}

export const toBlob = (doc: Document) => Packer.toBlob(doc)
