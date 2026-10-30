import type { CommandResult } from '@/domain/commands'
import type { Person, Phase, ProjectData, ProjectSummary, Sector } from '@/domain/types'

export type DataMode = 'demo' | 'remote'

export interface NewProjectInput {
  name: string
  code: string
  sector: Sector
  phase: Phase
  ownerName: string
}

/**
 * Data access boundary. The UI depends only on this interface.
 *  - DemoAdapter: synthetic data in this browser only (not secure, not shared).
 *  - RemoteAdapter: authenticated calls to the secure backend API, where the
 *    same command handler runs server-side behind row-level security.
 */
export interface DataAdapter {
  readonly mode: DataMode
  /** People who can act in this environment (demo personas, or the signed-in user). */
  listIdentities(): Promise<Person[]>
  listProjects(actorId: string): Promise<ProjectSummary[]>
  loadProject(projectId: string, actorId: string): Promise<ProjectData>
  execute(projectId: string, command: unknown, actorId: string, expectedRevision: number): Promise<CommandResult>
  createProject(input: NewProjectInput, actorId: string): Promise<ProjectSummary>
  resetDemo?(): Promise<void>
  /** Server-side AI assistance (remote mode only). */
  assist?(projectId: string, task: string): Promise<unknown>
}

export class AccessDeniedError extends Error {
  constructor(message = 'You do not have access to this project.') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

export class ConflictError extends Error {
  constructor() {
    super('This project changed since you loaded it. Your view has been refreshed — please review and try again.')
    this.name = 'ConflictError'
  }
}

export function toSummary(d: ProjectData): ProjectSummary {
  const p = d.project
  return { id: p.id, code: p.code, name: p.name, sector: p.sector, phase: p.phase, isDemo: p.isDemo, ownerName: p.owner.name }
}
