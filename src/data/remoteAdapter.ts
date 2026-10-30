import type { CommandResult } from '@/domain/commands'
import type { Person, ProjectData, ProjectSummary } from '@/domain/types'
import { AccessDeniedError, ConflictError, type DataAdapter, type NewProjectInput } from './adapter'
import type { SupabaseAuth } from './auth'

/**
 * Client for the secure Project Compass API (supabase/functions/api).
 * Every request carries the user's access token; the server authenticates,
 * authorizes against project membership, validates the command with the
 * shared domain schemas, applies it, and records the audit event.
 *
 * STATUS: typed contract implemented; requires a provisioned backend to verify.
 */
export class RemoteAdapter implements DataAdapter {
  readonly mode = 'remote' as const

  constructor(
    private baseUrl: string,
    private anonKey: string,
    private auth: SupabaseAuth,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.auth.accessToken()
    const res = await fetch(`${this.baseUrl}/functions/v1/api${path}`, {
      ...init,
      headers: { apikey: this.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    if (res.status === 401 || res.status === 403) throw new AccessDeniedError((await safeMessage(res)) ?? undefined)
    if (res.status === 409) throw new ConflictError()
    if (!res.ok) throw new Error((await safeMessage(res)) ?? `Request failed (${res.status})`)
    return (await res.json()) as T
  }

  async listIdentities(): Promise<Person[]> {
    return [await this.call<Person>('/me')]
  }
  listProjects(): Promise<ProjectSummary[]> {
    return this.call('/projects')
  }
  loadProject(projectId: string): Promise<ProjectData> {
    return this.call(`/projects/${encodeURIComponent(projectId)}`)
  }
  execute(projectId: string, command: unknown, _actorId: string, expectedRevision: number): Promise<CommandResult> {
    // The server derives the actor from the verified token; the client never asserts identity.
    return this.call(`/projects/${encodeURIComponent(projectId)}/commands`, { method: 'POST', body: JSON.stringify({ command, expectedRevision }) })
  }
  assist(projectId: string, task: string): Promise<unknown> {
    return this.call(`/projects/${encodeURIComponent(projectId)}/assist`, { method: 'POST', body: JSON.stringify({ task }) })
  }
  createProject(input: NewProjectInput): Promise<ProjectSummary> {
    return this.call('/projects', { method: 'POST', body: JSON.stringify(input) })
  }
}

async function safeMessage(res: Response): Promise<string | null> {
  try {
    const j = (await res.json()) as { error?: string }
    return typeof j.error === 'string' ? j.error.slice(0, 500) : null
  } catch {
    return null
  }
}
