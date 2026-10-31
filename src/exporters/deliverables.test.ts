import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/data/seed/demoProject'
import { deliverableModel } from './deliverables'
import { buildOwnerDeck } from './ownerDeck'

// 1×1 transparent PNG stands in for the rasterized logos (the browser renders the real ones).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function slideTexts(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const texts = await Promise.all(names.map(async (n) => [...(await zip.file(n)!.async('string')).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ')))
  const notes = await Promise.all(Object.keys(zip.files).filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map(async (n) => zip.file(n)!.async('string')))
  const layouts = await Promise.all(Object.keys(zip.files).filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n)).map(async (n) => zip.file(n)!.async('string')))
  return { texts, notes: notes.join(' '), layouts: layouts.join(' '), zip }
}

describe('deliverable model', () => {
  it('presents only reviewed, selected content and states the alignment status', () => {
    const d = createDemoProject()
    const m = deliverableModel(d, { presentationOnly: true })
    expect(m.status).toEqual({ aligned: false, label: 'Working draft — not yet aligned with the Owner' })
    const heardTitles = m.heard.flatMap((s) => s.items.map((i) => i.title))
    expect(heardTitles).not.toContain('Patient and community voices are largely absent') // rules-generated, unreviewed
    expect(heardTitles).not.toContain('Hazardous compounding: requested separation, unclear scope') // not selected
    expect(m.principles.flatMap((p) => p.opportunities).every((o) => o.inPresentation)).toBe(true)
    const gp3 = m.principles.find((p) => p.code === 'GP-03')!
    expect(gp3.alignmentLabel).toBe('Needs further discussion')
  })

  it('includes everything for the team document, with quotes taken verbatim', () => {
    const d = createDemoProject()
    const m = deliverableModel(d)
    expect(new Set(m.principles.flatMap((p) => p.opportunities.map((o) => o.code))).size).toBe(d.opportunities.length)
    const q = m.principles[0].evidence[0]
    expect(d.statements.find((s) => s.code === q.code)!.originalText).toBe(q.text)
  })
})

describe('Owner Alignment Presentation (PPTX)', () => {
  it('is a valid deck with four chapters, editable text and evidence in the speaker notes', async () => {
    const d = createDemoProject()
    const blob = await buildOwnerDeck(d, { red: PNG, white: PNG })
    const { texts, notes, layouts, zip } = await slideTexts(blob)
    const all = texts.join('\n')
    for (const chapter of ['What We Heard', 'What We Believe', 'What Will Guide Us', 'What Success Could Look Like']) expect(all).toContain(chapter)
    expect(all).toContain('Every Dose. Every Patient. Every Tomorrow.')
    expect(all).toContain('Reliability by Design')
    expect(all).toContain('Working draft — not yet aligned with the Owner')
    expect(layouts).toContain('Working draft for discussion')
    expect(layouts).toContain('SYNTHETIC DEMONSTRATION DATA')
    expect(all).not.toContain('Patient and community voices are largely absent')
    expect(notes).toMatch(/Owner alignment: Needs further discussion/)
    // The only pictures are the logos; everything else is native text.
    const media = Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/') && !zip.files[n].dir)
    const logo = PNG.split(',')[1]
    for (const f of media) expect(await zip.file(f)!.async('base64')).toBe(logo)
    expect(texts.length).toBeGreaterThan(15)
  })
})

describe('documents', () => {
  const docxText = async (blob: Blob) => {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' ')
  }

  it('Vision and Principles document is a valid, editable Word file with rationale and evidence', async () => {
    const d = createDemoProject()
    const { visionOutline } = await import('./documents')
    const { outlineToDocx } = await import('./outline')
    const text = await docxText(await outlineToDocx(d, visionOutline(d)))
    expect(text).toContain('Vision and Guiding Principles')
    expect(text).toContain('Working draft — not yet aligned with the Owner')
    expect(text).toContain('Why it matters')
    expect(text).toContain('Emerging design implications')
    expect(text).toContain('Resilience you can see and trust')
    expect(text).toContain('Every patient is waiting on a specific dose')
    expect(text).toContain('Owner alignment: Needs further discussion')
    expect(text).toContain('SYNTHETIC DEMONSTRATION DATA')
    expect(text).not.toMatch(/target of|baseline of/i)
  })

  it('Internal Synthesis Report is marked internal and includes unreviewed items, alternatives and tensions', async () => {
    const d = createDemoProject()
    const { synthesisOutline } = await import('./documents')
    const o = await synthesisOutline(d)
    const text = JSON.stringify(o.items)
    expect(text).toContain('INTERNAL — FOR BSA USE ONLY')
    expect(text).toContain('Patient and community voices are largely absent')
    expect(text).toContain('NOT YET REVIEWED')
    expect(text).toContain('People-led direction')
    expect(text).toContain('compact footprint versus daylight')
    expect(text).toContain('rules-based, no AI model')
  })

  it('workshop summary leads with direction, refinements, open questions and outcomes to validate', async () => {
    const { applyCommand } = await import('@/domain/commands')
    const { summaryOutline } = await import('./documents')
    let d = createDemoProject()
    const ctx = { actorId: 'p-avery', now: '2026-11-05T15:00:00.000Z' }
    d = applyCommand(d, { type: 'workshop.start', id: 'ws-2' }, ctx).data
    d = applyCommand(d, { type: 'alignment.record', sessionId: 'ws-2', target: { type: 'principle', id: 'gp-3' }, response: { status: 'aligned_with_refinements', feedback: '', refinements: 'Name automation refresh.', questions: '', ownerComments: 'We replace robots every 7 years.' } }, { ...ctx, now: '2026-11-05T15:10:00.000Z' }).data
    const o = summaryOutline(d, 'ws-2')
    const headings = o.items.filter((i) => i.k === 'h1').map((i) => (i as { text: string }).text)
    expect(headings.slice(0, 6)).toEqual(['Vision', 'Guiding Principles', 'Significant refinements', 'Not yet reviewed', 'Remaining strategic questions', 'Emerging design opportunities'])
    expect(JSON.stringify(o.items)).toContain('Name automation refresh.')
    expect(o.title).toContain('(draft)')
  })
})
