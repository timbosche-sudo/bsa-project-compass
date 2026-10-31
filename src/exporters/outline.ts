import { BSA, rgb } from '@/brand/brand'
import type { ProjectData } from '@/domain/types'
import { downloadBlob, exportFilename, provenanceLines } from './common'
import * as W from './docxKit'

/**
 * A document described once and rendered to both an editable Word file and a
 * branded PDF, so the two formats can never drift apart in content.
 */
export type Item =
  | { k: 'h1' | 'h2' | 'h3' | 'eyebrow'; text: string }
  | { k: 'para'; text: string; muted?: boolean; bold?: boolean; italic?: boolean; size?: number }
  | { k: 'labelled'; label: string; text: string }
  | { k: 'bullet'; text: string; detail?: string }
  | { k: 'quote'; text: string; cite: string }
  | { k: 'table'; head: string[]; rows: string[][]; widths?: number[] }

export interface Outline {
  /** Document title, e.g. "Vision and Guiding Principles". */
  title: string
  /** Short machine name for the file, e.g. "vision-and-principles". */
  kind: string
  coverLabel: string
  status: string
  items: Item[]
}

export async function outlineToDocx(data: ProjectData, o: Outline): Promise<Blob> {
  const p = data.project
  const blocks: W.Block[] = [
    ...W.cover({ label: o.coverLabel, title: o.title, subtitle: p.name, lines: [`${p.owner.name}`, o.status, ...provenanceLines(data)] }),
  ]
  for (const i of o.items) {
    switch (i.k) {
      case 'h1':
        blocks.push(W.h1(i.text))
        break
      case 'h2':
        blocks.push(W.h2(i.text))
        break
      case 'h3':
        blocks.push(W.h3(i.text))
        break
      case 'eyebrow':
        blocks.push(W.eyebrow(i.text))
        break
      case 'para':
        blocks.push(W.para(i.text, i))
        break
      case 'labelled':
        blocks.push(W.labelled(i.label, i.text))
        break
      case 'bullet':
        blocks.push(W.bullet(i.text, i.detail))
        break
      case 'quote':
        blocks.push(W.quote(i.text, i.cite))
        break
      case 'table':
        blocks.push(W.table(i.head, i.rows, i.widths?.map((w) => Math.round((w / i.widths!.reduce((a, b) => a + b, 0)) * 9360))))
        break
    }
  }
  const footer = `Project Compass  |  ${p.name}  |  ${o.title}${p.isDemo ? '  |  SYNTHETIC DEMONSTRATION DATA' : ''}`
  return W.toBlob(W.document({ title: `${p.name} — ${o.title}`, footer, children: blocks }))
}

export async function outlineToPdf(data: ProjectData, o: Outline): Promise<Blob> {
  const { createReport } = await import('./pdf')
  const doc = await createReport(data, o.title)
  const muted = rgb(BSA.black80)
  const teal = rgb(BSA.teal)
  doc.para(o.status, { bold: true })
  for (const i of o.items) {
    switch (i.k) {
      case 'h1':
        doc.heading(i.text)
        break
      case 'h2':
        doc.ensure(60)
        doc.y += 6
        doc.para(i.text, { size: 14, bold: true })
        break
      case 'h3':
        doc.ensure(40)
        doc.para(i.text, { size: 11, bold: true })
        break
      case 'eyebrow':
        doc.eyebrow(i.text)
        break
      case 'para':
        doc.para(i.text, { color: i.muted ? muted : undefined, bold: i.bold, italic: i.italic, size: i.size })
        break
      case 'labelled':
        doc.eyebrow(i.label)
        doc.para(i.text)
        break
      case 'bullet':
        doc.para(`•  ${i.text}${i.detail ? ` — ${i.detail}` : ''}`)
        break
      case 'quote':
        doc.para(`“${i.text}”${i.cite ? `  — ${i.cite}` : ''}`, { italic: true, color: teal })
        break
      case 'table':
        doc.table({ head: i.head.some(Boolean) ? [i.head] : undefined, body: i.rows, columnStyles: i.widths ? Object.fromEntries(i.widths.map((w, n) => [n, { cellWidth: (w / i.widths!.reduce((a, b) => a + b, 0)) * (doc.w - 90) }])) : undefined })
        break
    }
  }
  return doc.finish()
}

export async function downloadOutline(data: ProjectData, o: Outline, format: 'docx' | 'pdf') {
  const blob = format === 'docx' ? await outlineToDocx(data, o) : await outlineToPdf(data, o)
  downloadBlob(blob, exportFilename(data, o.kind, format))
}
