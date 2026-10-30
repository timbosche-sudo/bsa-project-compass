import { describe, expect, it } from 'vitest'
import { AccessDeniedError, ConflictError } from './adapter'
import { DemoAdapter } from './demoAdapter'
import { readConfig } from './config'
import { PEOPLE } from './seed/demoProject'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size } }
}

describe('DemoAdapter', () => {
  it('lists only projects the actor belongs to and denies others', async () => {
    const a = new DemoAdapter(memoryStorage())
    expect((await a.listProjects(PEOPLE.sam.id)).map((p) => p.id)).toEqual(['demo-pharmacy'])
    await expect(a.loadProject('demo-learning', PEOPLE.sam.id)).rejects.toBeInstanceOf(AccessDeniedError)
    await expect(a.execute('demo-learning', { type: 'question.create', question: 'x', context: [] }, PEOPLE.sam.id, 1)).rejects.toBeInstanceOf(AccessDeniedError)
  })

  it('rejects stale writes (optimistic concurrency) and persists accepted ones', async () => {
    const storage = memoryStorage()
    const a = new DemoAdapter(storage)
    const cmd = { type: 'question.create', question: 'Q?', context: [] }
    await a.execute('demo-pharmacy', cmd, PEOPLE.avery.id, 1)
    await expect(a.execute('demo-pharmacy', cmd, PEOPLE.avery.id, 1)).rejects.toBeInstanceOf(ConflictError)
    const reloaded = new DemoAdapter(storage)
    expect((await reloaded.loadProject('demo-pharmacy', PEOPLE.avery.id)).questions).toHaveLength(4)
  })

  it('marks sandbox projects as demonstrative', async () => {
    const a = new DemoAdapter(memoryStorage())
    const p = await a.createProject({ name: 'Sandbox', code: 'SB-1', sector: 'learning', phase: 'strategy', ownerName: 'Fictional Owner' }, PEOPLE.jordan.id)
    expect(p.isDemo).toBe(true)
    expect((await a.loadProject(p.id, PEOPLE.jordan.id)).project.members).toEqual([{ personId: PEOPLE.jordan.id, role: 'project_admin' }])
  })
})

describe('configuration', () => {
  it('defaults to demo mode and refuses incomplete secure configuration', () => {
    expect(readConfig({}).mode).toBe('demo')
    expect(readConfig({ VITE_DATA_MODE: 'supabase' }).configError).toMatch(/VITE_SUPABASE_URL/)
    expect(readConfig({ VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: 'http://x.example', VITE_SUPABASE_ANON_KEY: 'k' }).configError).toMatch(/HTTPS/)
    expect(readConfig({ VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: 'https://x.example', VITE_SUPABASE_ANON_KEY: 'k' }).configError).toBeNull()
  })
})
