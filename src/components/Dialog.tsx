import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button, cx, Field, Textarea } from './ui'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <RD.Content
          className={cx('fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-raised shadow-pop', width)}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RD.Title className="text-[16px] font-semibold text-ink">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-[13px] text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RD.Description>}
            </div>
            <RD.Close className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </RD.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}

// ---------------------------------------------------------------------------
// Confirmation dialogs (required for destructive and governance actions)
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  /** Require a written note (e.g. approval rationale). */
  requireNote?: { label: string; minLength?: number; placeholder?: string }
}

type ConfirmFn = (o: ConfirmOptions) => Promise<{ confirmed: boolean; note: string }>
const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [note, setNote] = useState('')
  const resolver = useRef<((v: { confirmed: boolean; note: string }) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    setNote('')
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (confirmed: boolean) => {
    resolver.current?.({ confirmed, note: note.trim() })
    resolver.current = null
    setOpts(null)
  }
  const min = opts?.requireNote?.minLength ?? 0
  const noteOk = !opts?.requireNote || note.trim().length >= min

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!opts}
        onOpenChange={(o) => !o && close(false)}
        title={opts?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={opts?.tone === 'danger' ? 'danger' : 'primary'} disabled={!noteOk} onClick={() => close(true)}>
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[13.5px] text-ink-2">
          {opts?.body}
          {opts?.requireNote && (
            <Field label={opts.requireNote.label} hint={min ? `At least ${min} characters.` : undefined}>
              {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={opts.requireNote?.placeholder} autoFocus />}
            </Field>
          )}
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
