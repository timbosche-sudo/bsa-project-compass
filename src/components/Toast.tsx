import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cx } from './ui'

interface ToastItem {
  id: number
  tone: 'ok' | 'error'
  message: string
}
type Notify = (tone: ToastItem['tone'], message: string) => void
const ToastContext = createContext<Notify>(() => {})

/** Toasts report real outcomes of completed operations only. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const notify = useCallback<Notify>((tone, message) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-3), { id, tone, message }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 9000 : 3500)
  }, [])
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={cx('pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-raised px-3.5 py-3 text-[13px] shadow-pop', t.tone === 'error' ? 'border-danger/40' : 'border-line')}>
            {t.tone === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />}
            <span className="min-w-0 flex-1 text-ink">{t.message}</span>
            <button className="text-muted hover:text-ink" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
