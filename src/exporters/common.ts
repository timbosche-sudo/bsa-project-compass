import { isActiveFramework } from '@/domain/wording'
import type { ProjectData } from '@/domain/types'

export interface Table {
  columns: { key: string; label: string; width?: number }[]
  rows: Record<string, string | number | null>[]
}

export function exportFilename(data: ProjectData, kind: string, ext: string, now = new Date()) {
  const stamp = now.toISOString().slice(0, 10)
  const safe = `${data.project.code}-${kind}`.replace(/[^A-Za-z0-9-]+/g, '-')
  return `${safe}${data.project.isDemo ? '-DEMO' : ''}-${stamp}.${ext}`
}

export function provenanceLines(data: ProjectData, now = new Date()): string[] {
  return [
    `${data.project.name} (${data.project.code}) — ${data.project.owner.name}`,
    `Generated ${now.toISOString().replace('T', ' ').slice(0, 16)} UTC by BSA Project Compass · project revision ${data.revision}`,
    data.project.isDemo
      ? 'SYNTHETIC DEMONSTRATION DATA — fictional content, not a real project.'
      : 'Contains project information. Handle according to each source’s confidentiality classification.',
    'Items marked DRAFT, PROPOSED or IN REVIEW are not approved commitments.',
  ]
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A report may be called final only when the Win Theme and every active principle are approved. */
export function reportReadiness(data: ProjectData) {
  const issues: string[] = []
  const winThemeApproved = data.winThemes.some((w) => w.status === 'approved')
  if (!winThemeApproved) issues.push('No Win Theme is approved.')
  const unapproved = data.principles.filter((p) => p.status !== 'approved' && isActiveFramework(p.status))
  if (unapproved.length) issues.push(`${unapproved.length} guiding principle(s) are not approved (${unapproved.map((p) => p.code).join(', ')}).`)
  const drafts = data.drivers.filter((d) => d.approvalStatus === 'proposed' || d.approvalStatus === 'under_review')
  if (drafts.length) issues.push(`${drafts.length} Design Driver(s) are drafts and will be labelled as such.`)
  return { final: winThemeApproved && unapproved.length === 0, issues }
}
