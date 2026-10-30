import { applyCommand } from '@/domain/commands'
import { normalizeProjectData } from '@/domain/normalize'
import { projectInputSchema } from '@/domain/schemas'
import type { Person, ProjectData } from '@/domain/types'
import { AccessDeniedError, ConflictError, toSummary, type DataAdapter, type NewProjectInput } from './adapter'
import { createDemoProject, createEmptyProject, createSecondDemoProject, PEOPLE } from './seed/demoProject'

const STORAGE_KEY = 'compass.demo.v1'
const SCHEMA_VERSION = 4
const MIGRATABLE = new Set([3, 4])

interface Stored {
  schema: number
  projects: Record<string, ProjectData>
}

/**
 * Demonstration adapter. Holds synthetic projects in memory and mirrors them
 * to this browser's localStorage so the demo survives a reload.
 *
 * This is NOT a secure or shared datastore: anyone with this browser can read
 * and alter it, and nothing reaches other users. Never enter real or
 * confidential project content in demo mode.
 */
export class DemoAdapter implements DataAdapter {
  readonly mode = 'demo' as const
  private projects: Record<string, ProjectData>

  constructor(private storage: Storage | null = safeStorage()) {
    this.projects = this.read() ?? seed()
  }

  async listIdentities(): Promise<Person[]> {
    const map = new Map<string, Person>()
    Object.values(this.projects).forEach((p) => p.people.forEach((x) => map.set(x.id, x)))
    return [...map.values()]
  }

  async listProjects(actorId: string) {
    return Object.values(this.projects)
      .filter((p) => p.project.members.some((m) => m.personId === actorId))
      .map(toSummary)
  }

  async loadProject(projectId: string, actorId: string): Promise<ProjectData> {
    const p = this.projects[projectId]
    if (!p) throw new AccessDeniedError('Project not found.')
    if (!p.project.members.some((m) => m.personId === actorId)) throw new AccessDeniedError()
    return structuredClone(p)
  }

  async execute(projectId: string, command: unknown, actorId: string, expectedRevision: number) {
    const current = this.projects[projectId]
    if (!current || !current.project.members.some((m) => m.personId === actorId)) throw new AccessDeniedError()
    if (current.revision !== expectedRevision) throw new ConflictError()
    const result = applyCommand(current, command, { actorId, now: new Date().toISOString() })
    this.projects[projectId] = result.data
    this.write()
    return { data: structuredClone(result.data), createdId: result.createdId }
  }

  async createProject(input: NewProjectInput, actorId: string) {
    const parsed = projectInputSchema.pick({ name: true, code: true, sector: true, phase: true }).safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '))
    if (!input.ownerName.trim()) throw new Error('Owner name is required.')
    const people = await this.listIdentities()
    const me = people.find((p) => p.id === actorId)
    if (!me) throw new AccessDeniedError('Unknown identity.')
    const id = `sandbox-${crypto.randomUUID().slice(0, 8)}`
    const data = createEmptyProject({
      id,
      code: input.code,
      name: input.name,
      tagline: '',
      sector: input.sector,
      phase: input.phase,
      location: '',
      description: 'Demo sandbox project. Stored only in this browser — do not enter confidential content.',
      owner: { name: input.ownerName, type: '', mission: '' },
      adminId: actorId,
      people: [me],
      // Everything created in demo mode is demonstrative: it is not secured or shared.
      isDemo: true,
    })
    this.projects[id] = data
    this.write()
    return toSummary(data)
  }

  /**
   * Live updates across windows of this browser (e.g. the audience window).
   * The 'storage' event fires in other same-origin documents when localStorage changes.
   */
  subscribe(projectId: string, onChange: () => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const fresh = this.read()
      if (fresh?.[projectId] && fresh[projectId].revision !== this.projects[projectId]?.revision) {
        this.projects = fresh
        onChange()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }

  async resetDemo() {
    this.projects = seed()
    this.write()
  }

  private read(): Record<string, ProjectData> | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Stored
      if (!MIGRATABLE.has(parsed.schema)) return null
      for (const id of Object.keys(parsed.projects)) parsed.projects[id] = normalizeProjectData(parsed.projects[id])
      return parsed.projects
    } catch {
      return null
    }
  }

  private write() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ schema: SCHEMA_VERSION, projects: this.projects } satisfies Stored))
    } catch {
      // Storage may be unavailable (private mode); the demo continues in memory.
    }
  }
}

function seed(): Record<string, ProjectData> {
  const a = createDemoProject()
  const b = createSecondDemoProject()
  return { [a.project.id]: a, [b.project.id]: b }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const DEFAULT_DEMO_PERSONA = PEOPLE.avery.id
