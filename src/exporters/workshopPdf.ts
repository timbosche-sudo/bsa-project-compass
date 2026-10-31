import type { ProjectData } from '@/domain/types'
import { summaryOutline } from './documents'
import { downloadOutline } from './outline'

/** Meeting summary as a branded PDF, generated from the recorded workshop session. */
export async function meetingSummaryPdf(data: ProjectData, sessionId: string) {
  await downloadOutline(data, summaryOutline(data, sessionId), 'pdf')
}

/** The same summary as an editable Word document, for the team to refine before distribution. */
export async function meetingSummaryDocx(data: ProjectData, sessionId: string) {
  await downloadOutline(data, summaryOutline(data, sessionId), 'docx')
}
