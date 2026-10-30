import { meetingSummary } from '@/domain/workshop'
import type { ProjectData } from '@/domain/types'
import { downloadBlob, exportFilename } from './common'
import { createReport } from './pdf'

/** Meeting summary PDF, generated from the recorded workshop session. */
export async function meetingSummaryPdf(data: ProjectData, sessionId: string) {
  const s = meetingSummary(data, sessionId)
  const w = s.session
  const person = (id: string) => data.people.find((p) => p.id === id)?.name ?? 'Unknown'
  const title = `Workshop Summary ${w.code}${s.draft ? ' - DRAFT' : ''}`
  const doc = await createReport(data, title)

  doc.heading('Session')
  doc.table({
    body: [
      ['Workshop', `${w.code} - ${w.title}`],
      ['Date', w.date],
      ['Status', w.status === 'closed' ? `Ended ${w.endedAt?.slice(0, 16).replace('T', ' ')} UTC` : w.status === 'live' ? 'In progress (summary is a draft)' : 'Planned'],
      ['Facilitator', person(w.facilitatorId)],
      ['Attendees', w.attendees.map((a) => `${a.name}${a.organization ? ` (${a.organization}${a.role ? `, ${a.role}` : ''})` : ''}`).join('; ') || 'None recorded'],
      ['Recorded changes', String(s.changeCount)],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
    theme: 'plain',
  })

  doc.heading('Adopted - exact approved wording')
  if (!s.adopted.length) doc.para('Nothing was approved in this session.', { italic: true })
  for (const a of s.adopted) {
    doc.eyebrow(`${a.code} - approved by ${a.approvedBy}${a.recordedBy ? ` (recorded by ${a.recordedBy})` : ''} - ${a.approvedAt.slice(0, 16).replace('T', ' ')} UTC - v${a.version}`)
    doc.para(a.wording, { size: 10.5 })
  }

  const list = (heading: string, items: { code: string; title: string; note?: string }[]) => {
    doc.heading(heading)
    if (!items.length) return doc.para('None.', { italic: true })
    doc.table({ head: [['ID', 'Item', 'Facilitator note']], body: items.map((i) => [i.code, i.title, i.note ?? '']), columnStyles: { 0: { cellWidth: 44 } } })
  }
  list('Needs refinement', s.needsRefinement)
  list('Still in discussion', [...s.discussing, ...s.proposed])
  list('Not adopted', s.notAdopted)
  if (s.created.length) list('Added during the session', s.created)

  if (s.wordingChanges.length) {
    doc.heading('Wording changes')
    doc.table({ head: [['ID', 'Before', 'After']], body: s.wordingChanges.map((c) => [c.code, c.before, c.after]), columnStyles: { 0: { cellWidth: 40 } } })
  }
  if (s.merges.length || s.deleted.length) {
    doc.heading('Structural changes')
    s.merges.forEach((m) => doc.para(`- ${m}`))
    s.deleted.forEach((d) => doc.para(`- Deleted ${d.code} ${d.title}`))
  }

  doc.heading('Action items')
  if (!w.actions.length) doc.para('None recorded.', { italic: true })
  else doc.table({ head: [['Action', 'Owner', 'Due', 'Status']], body: w.actions.map((a) => [a.text, a.owner, a.due ?? '', a.done ? 'Done' : 'Open']) })

  if (w.generalNotes) {
    doc.heading('Notes')
    doc.para(w.generalNotes)
  }
  doc.para('Generated from the recorded session. Review before distribution.', { size: 8.5, italic: true })
  downloadBlob(doc.finish(), exportFilename(data, `workshop-summary-${w.code}`, 'pdf'))
}
