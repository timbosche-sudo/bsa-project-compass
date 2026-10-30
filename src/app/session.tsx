import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DataAdapter } from '@/data/adapter'
import type { Person } from '@/domain/types'

interface SessionValue {
  adapter: DataAdapter
  identities: Person[]
  /** Demo mode: the selected demonstration persona. Remote mode: the signed-in user. */
  actor: Person | null
  setActorId: (id: string) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  signOut?: () => void
}

const SessionContext = createContext<SessionValue | null>(null)
const PERSONA_KEY = 'compass.demo.persona'

function storedTheme(): 'light' | 'dark' {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function SessionProvider({ adapter, identities, defaultActorId, signOut, children }: { adapter: DataAdapter; identities: Person[]; defaultActorId: string; signOut?: () => void; children: ReactNode }) {
  const [actorId, setActor] = useState<string>(() => {
    if (adapter.mode !== 'demo') return defaultActorId
    try {
      const saved = localStorage.getItem(PERSONA_KEY)
      return saved && identities.some((p) => p.id === saved) ? saved : defaultActorId
    } catch {
      return defaultActorId
    }
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(storedTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('compass.theme', theme)
    } catch {
      /* optional */
    }
  }, [theme])

  const setActorId = useCallback(
    (id: string) => {
      if (adapter.mode !== 'demo') return
      setActor(id)
      try {
        localStorage.setItem(PERSONA_KEY, id)
      } catch {
        /* optional */
      }
    },
    [adapter.mode],
  )

  const value = useMemo<SessionValue>(
    () => ({
      adapter,
      identities,
      actor: identities.find((p) => p.id === actorId) ?? null,
      setActorId,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      signOut,
    }),
    [adapter, identities, actorId, setActorId, theme, signOut],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
