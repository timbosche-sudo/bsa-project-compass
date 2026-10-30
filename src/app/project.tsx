import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { ConflictError } from '@/data/adapter'
import { useToast } from '@/components/Toast'
import { can as canRole, roleFor, type Capability } from '@/domain/permissions'
import type { Command } from '@/domain/schemas'
import type { ProjectData, Role } from '@/domain/types'
import { useSession } from './session'

export const projectKey = (projectId: string, actorId: string | undefined) => ['project', projectId, actorId] as const
export const projectsKey = (actorId: string | undefined) => ['projects', actorId] as const

export function useProjects() {
  const { adapter, actor } = useSession()
  return useQuery({ queryKey: projectsKey(actor?.id), queryFn: () => adapter.listProjects(actor!.id), enabled: !!actor })
}

export function useProjectQuery(projectId: string) {
  const { adapter, actor } = useSession()
  return useQuery({ queryKey: projectKey(projectId, actor?.id), queryFn: () => adapter.loadProject(projectId, actor!.id), enabled: !!actor, retry: false })
}

interface ProjectContextValue {
  data: ProjectData
  role: Role | null
  can: (cap: Capability) => boolean
  /** Execute a command. Resolves to the created id (or null) on success, undefined on failure. */
  run: (command: Command, successMessage?: string) => Promise<string | null | undefined>
  pending: boolean
  personName: (id: string | null | undefined) => string
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ data, children }: { data: ProjectData; children: ReactNode }) {
  const { adapter, actor } = useSession()
  const qc = useQueryClient()
  const notify = useToast()
  const key = projectKey(data.project.id, actor?.id)

  const mutation = useMutation({
    mutationFn: async (command: Command) => {
      const current = qc.getQueryData<ProjectData>(key) ?? data
      return adapter.execute(data.project.id, command, actor!.id, current.revision)
    },
    onSuccess: (result) => {
      qc.setQueryData(key, result.data)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => {
      if (err instanceof ConflictError) qc.invalidateQueries({ queryKey: key })
    },
  })

  const run = useCallback(
    async (command: Command, successMessage?: string) => {
      try {
        const result = await mutation.mutateAsync(command)
        if (successMessage) notify('ok', successMessage)
        return result.createdId
      } catch (err) {
        notify('error', err instanceof Error ? err.message : String(err))
        return undefined
      }
    },
    [mutation, notify],
  )

  const role = roleFor(data.project, actor?.id)
  const value = useMemo<ProjectContextValue>(
    () => ({
      data,
      role,
      can: (cap) => canRole(role, cap),
      run,
      pending: mutation.isPending,
      personName: (id) => (id ? (id === 'assistant' ? 'Assistant' : (data.people.find((p) => p.id === id)?.name ?? 'Unknown person')) : '—'),
    }),
    [data, role, run, mutation.isPending],
  )
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}

export function useTerms() {
  return useProject().data.project.terminology
}
