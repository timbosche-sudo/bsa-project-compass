import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cx } from '@/components/ui'
import { drafts, useSaveStatus } from './state'

const AUTOSAVE_MS = 1200

/**
 * Presentation-styled inline editor. It renders with the same typography as
 * the slide text, autosaves after a pause or on blur, mirrors unsaved text to
 * local storage, and offers recovery of edits left unsaved by a crash or reload.
 */
export function InlineField({
  value,
  onSave,
  draftKey,
  label,
  className,
  placeholder,
  singleLine,
  maxLength = 4000,
  required,
}: {
  value: string
  onSave: (next: string, before: string) => Promise<boolean>
  draftKey: string
  label: string
  className?: string
  placeholder?: string
  singleLine?: boolean
  maxLength?: number
  required?: boolean
}) {
  const { setDirty, track, register } = useSaveStatus()
  const [text, setText] = useState(value)
  const [recovered, setRecovered] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<number | null>(null)
  const saved = useRef(value)
  const focused = useRef(false)

  // Adopt external updates (other windows, undo) when the user is not mid-edit.
  useEffect(() => {
    if (!focused.current && text === saved.current) setText(value)
    saved.current = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Recover unsaved text from a previous session.
  useEffect(() => {
    const d = drafts.read(draftKey)
    if (!d || d.text === value) {
      if (d) drafts.clear(draftKey)
      return
    }
    setText(d.text)
    setRecovered(true)
    setDirty(draftKey, true)
    return register({
      key: draftKey,
      label,
      apply: () => {
        setRecovered(false)
        void commit(d.text)
      },
      discard: () => {
        drafts.clear(draftKey)
        setRecovered(false)
        setText(saved.current)
        setDirty(draftKey, false)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const commit = useCallback(
    async (next: string) => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = null
      if (next === saved.current) {
        drafts.clear(draftKey)
        setDirty(draftKey, false)
        return
      }
      if (required && !next.trim()) return
      const before = saved.current
      const okSaved = await track(onSave(next, before), () => void commit(next))
      if (okSaved) {
        saved.current = next
        drafts.clear(draftKey)
        setDirty(draftKey, false)
      }
    },
    [draftKey, onSave, required, setDirty, track],
  )

  const change = (next: string) => {
    const v = singleLine ? next.replace(/\n/g, ' ') : next
    setText(v)
    setRecovered(false)
    drafts.write(draftKey, v, saved.current)
    setDirty(draftKey, v !== saved.current)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void commit(v), AUTOSAVE_MS)
  }

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={text}
      rows={1}
      maxLength={maxLength}
      placeholder={placeholder}
      spellCheck
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        if (!recovered) void commit(text)
      }}
      onChange={(e) => change(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (timer.current) window.clearTimeout(timer.current)
          setText(saved.current)
          drafts.clear(draftKey)
          setDirty(draftKey, false)
          e.currentTarget.blur()
          e.stopPropagation()
        } else if (e.key === 'Enter' && (singleLine || e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.currentTarget.blur()
        }
        e.stopPropagation()
      }}
      className={cx(
        'block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none',
        'rounded-[0.4cqw] ring-1 ring-transparent transition-[box-shadow] hover:ring-current/25 focus:ring-2 focus:ring-[var(--c-accent)]',
        recovered && 'ring-2 ring-[var(--c-warn)]',
        className,
      )}
      style={{ font: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', color: 'inherit' }}
    />
  )
}
