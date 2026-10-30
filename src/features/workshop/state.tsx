import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useProject } from '@/app/project'
import type { Command } from '@/domain/schemas'
import type { GuidingPrinciple, PrincipleContent, WinTheme, WinThemeContent } from '@/domain/types'
import type { FrameworkKind } from '@/domain/workshop'

// ---------------------------------------------------------------------------
// Save status (autosave indicator) and unsaved-draft recovery
// ---------------------------------------------------------------------------

export type SaveState = { kind: 'idle' } | { kind: 'dirty' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string; retry: () => void }

interface Recovered {
  key: string
  label: string
  apply: () => void
  discard: () => void
}

interface SaveContextValue {
  state: SaveState
  setDirty: (key: string, dirty: boolean) => void
  track: (p: Promise<boolean>, retry: () => void) => Promise<boolean>
  recovered: Recovered[]
  register: (r: Recovered) => () => void
}

const SaveContext = createContext<SaveContextValue | null>(null)

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [inflight, setInflight] = useState(0)
  const [last, setLast] = useState<SaveState>({ kind: 'idle' })
  const [recovered, setRecovered] = useState<Recovered[]>([])

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((s) => {
      if (dirty === s.has(key)) return s
      const n = new Set(s)
      if (dirty) n.add(key)
      else n.delete(key)
      return n
    })
  }, [])

  const track = useCallback(async (p: Promise<boolean>, retry: () => void) => {
    setInflight((n) => n + 1)
    try {
      const ok = await p
      setLast(ok ? { kind: 'saved', at: new Date() } : { kind: 'error', message: 'Not saved', retry })
      return ok
    } finally {
      setInflight((n) => n - 1)
    }
  }, [])

  const register = useCallback((r: Recovered) => {
    setRecovered((xs) => [...xs.filter((x) => x.key !== r.key), r])
    return () => setRecovered((xs) => xs.filter((x) => x.key !== r.key))
  }, [])

  const busy = inflight > 0 || dirtyKeys.size > 0
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const state: SaveState = inflight > 0 ? { kind: 'saving' } : dirtyKeys.size > 0 ? { kind: 'dirty' } : last
  const value = useMemo(() => ({ state, setDirty, track, recovered, register }), [state, setDirty, track, recovered, register])
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>
}

export function useSaveStatus() {
  const ctx = useContext(SaveContext)
  if (!ctx) throw new Error('useSaveStatus requires SaveStatusProvider')
  return ctx
}

/** Unsaved text is mirrored to this browser so it survives a crash, reload or lost connection. */
export const drafts = {
  key: (projectId: string, field: string) => `compass.draft.${projectId}.${field}`,
  read(k: string): { text: string; base: string } | null {
    try {
      const raw = localStorage.getItem(k)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  write(k: string, text: string, base: string) {
    try {
      localStorage.setItem(k, JSON.stringify({ text, base, at: Date.now() }))
    } catch {
      /* storage unavailable: autosave still runs */
    }
  },
  clear(k: string) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

export interface UndoEntry {
  label: string
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
}

interface UndoContextValue {
  push: (e: UndoEntry) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

const UndoContext = createContext<UndoContextValue | null>(null)

export function UndoProvider({ children }: { children: ReactNode }) {
  const [past, setPast] = useState<UndoEntry[]>([])
  const [future, setFuture] = useState<UndoEntry[]>([])
  const busy = useRef(false)
  const push = useCallback((e: UndoEntry) => {
    setPast((p) => [...p.slice(-99), e])
    setFuture([])
  }, [])
  const undo = useCallback(async () => {
    const e = past.at(-1)
    if (!e || busy.current) return
    busy.current = true
    try {
      if (await e.undo()) {
        setPast((p) => p.slice(0, -1))
        setFuture((f) => [...f, e])
      }
    } finally {
      busy.current = false
    }
  }, [past])
  const redo = useCallback(async () => {
    const e = future.at(-1)
    if (!e || busy.current) return
    busy.current = true
    try {
      if (await e.redo()) {
        setFuture((f) => f.slice(0, -1))
        setPast((p) => [...p, e])
      }
    } finally {
      busy.current = false
    }
  }, [future])
  const value = useMemo(
    () => ({ push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, undoLabel: past.at(-1)?.label ?? null, redoLabel: future.at(-1)?.label ?? null }),
    [push, undo, redo, past, future],
  )
  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>
}

export function useUndo() {
  const ctx = useContext(UndoContext)
  if (!ctx) throw new Error('useUndo requires UndoProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Workshop actions: every change goes through the shared command handler,
// and reversible changes record their inverse for undo/redo.
// ---------------------------------------------------------------------------

export type EditableField = 'title' | 'statement' | 'intent' | 'narrative'

export function useWorkshopActions() {
  const { data, run } = useProject()
  const { push } = useUndo()
  const latest = useRef(data)
  latest.current = data
  const ok = (r: string | null | undefined) => r !== undefined

  const findItem = useCallback((kind: FrameworkKind, id: string) => (kind === 'winTheme' ? latest.current.winThemes.find((w) => w.id === id) : latest.current.principles.find((p) => p.id === id)), [])

  const editCommand = useCallback(
    (kind: FrameworkKind, id: string, field: EditableField, value: string, coalesce: boolean): Command | null => {
      const e = findItem(kind, id)
      if (!e) return null
      if (kind === 'winTheme') {
        const w = e as WinTheme
        const content: WinThemeContent = { statement: w.statement, narrative: w.narrative, [field]: value }
        return { type: 'winTheme.edit', id, content, note: '', coalesce }
      }
      const p = e as GuidingPrinciple
      const content: PrincipleContent = { title: p.title, statement: p.statement, intent: p.intent, category: p.category, [field]: value }
      return { type: 'principle.edit', id, content, note: '', coalesce }
    },
    [findItem],
  )

  /** Autosave a single field. Records an undo step for the change. */
  const saveField = useCallback(
    async (kind: FrameworkKind, id: string, field: EditableField, value: string, before: string, label: string) => {
      const cmd = editCommand(kind, id, field, value, true)
      if (!cmd) return false
      const saved = ok(await run(cmd))
      if (saved) {
        push({
          label: `Edit ${label}`,
          undo: async () => {
            const c = editCommand(kind, id, field, before, false)
            return !!c && ok(await run(c))
          },
          redo: async () => {
            const c = editCommand(kind, id, field, value, false)
            return !!c && ok(await run(c))
          },
        })
      }
      return saved
    },
    [editCommand, run, push],
  )

  const setStatus = useCallback(
    async (kind: FrameworkKind, id: string, status: 'proposed' | 'in_review' | 'needs_refinement' | 'not_adopted', code: string) => {
      const e = findItem(kind, id)
      if (!e || e.status === status) return
      const prev = e.status
      const done = ok(await run({ type: 'framework.setReviewStatus', kind, id, status }))
      if (done && prev !== 'approved' && prev !== 'superseded') {
        push({
          label: `Status of ${code}`,
          undo: async () => ok(await run({ type: 'framework.setReviewStatus', kind, id, status: prev as typeof status })),
          redo: async () => ok(await run({ type: 'framework.setReviewStatus', kind, id, status })),
        })
      }
    },
    [findItem, run, push],
  )

  /** Creates or duplicates; undo moves the item to recoverable trash, redo restores the same item. */
  const trackCreation = useCallback(
    (label: string, kind: FrameworkKind, id: string) => {
      let trashId: string | null = null
      push({
        label,
        undo: async () => {
          const r = await run({ type: 'framework.delete', kind, id })
          trashId = r ?? null
          return ok(r)
        },
        redo: async () => !!trashId && ok(await run({ type: 'framework.undelete', trashId })),
      })
    },
    [run, push],
  )

  const addPrinciple = useCallback(async () => {
    const id = await run({ type: 'principle.create', content: { title: 'New principle', statement: 'Describe what success must look like.', intent: '', category: 'cross_cutting' } }, 'Principle added')
    if (id) trackCreation('Add principle', 'principle', id)
    return id ?? null
  }, [run, trackCreation])

  const addWinTheme = useCallback(async () => {
    const id = await run({ type: 'winTheme.create', content: { statement: 'New Win Theme alternative', narrative: '' } }, 'Win Theme alternative added')
    if (id) trackCreation('Add Win Theme', 'winTheme', id)
    return id ?? null
  }, [run, trackCreation])

  const duplicate = useCallback(
    async (kind: FrameworkKind, id: string, code: string) => {
      const created = await run({ type: 'framework.duplicate', kind, id }, `${code} duplicated`)
      if (created) trackCreation(`Duplicate ${code}`, kind, created)
      return created ?? null
    },
    [run, trackCreation],
  )

  const remove = useCallback(
    async (kind: FrameworkKind, id: string, code: string) => {
      let trashId = await run({ type: 'framework.delete', kind, id }, `${code} deleted — Undo is available`)
      if (!trashId) return false
      push({
        label: `Delete ${code}`,
        undo: async () => !!trashId && ok(await run({ type: 'framework.undelete', trashId })),
        redo: async () => {
          const r = await run({ type: 'framework.delete', kind, id })
          if (r) trashId = r
          return ok(r)
        },
      })
      return true
    },
    [run, push],
  )

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      const before = [...latest.current.principles].sort((a, b) => a.order - b.order).map((p) => p.id)
      if (JSON.stringify(before) === JSON.stringify(orderedIds)) return
      if (ok(await run({ type: 'principle.reorder', orderedIds }))) {
        push({
          label: 'Reorder principles',
          undo: async () => ok(await run({ type: 'principle.reorder', orderedIds: before })),
          redo: async () => ok(await run({ type: 'principle.reorder', orderedIds })),
        })
      }
    },
    [run, push],
  )

  return { saveField, setStatus, addPrinciple, addWinTheme, duplicate, remove, reorder }
}
