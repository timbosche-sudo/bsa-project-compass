import type { ProjectData } from './types'

/**
 * Upgrade an aggregate stored by an earlier version of the application.
 * Additive only: missing collections get empty defaults; nothing is removed.
 */
export function normalizeProjectData(d: ProjectData): ProjectData {
  const x = d as Partial<ProjectData> & ProjectData
  x.workshops ??= []
  x.trash ??= []
  x.suggestions ??= []
  x.comments ??= []
  x.heard ??= []
  x.pointOfView ??= null
  x.opportunities ??= []
  x.outcomes ??= []
  return x
}
