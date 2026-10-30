import { createContext, forwardRef, useContext, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-inverse text-on-inverse hover:opacity-90 border border-transparent',
  accent: 'bg-accent text-on-accent hover:brightness-95 border border-transparent',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-sunken',
  danger: 'bg-danger-fill text-white border border-transparent hover:opacity-90',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-[13.5px] gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Badges & tags
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'risk' | 'danger' | 'info' | 'ai' | 'outline' | 'inverse'

/**
 * Badges follow the brand rule that text is black or white: color is carried
 * by the tinted (20% screen) background and the status dot, never the text.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-ink',
  accent: 'bg-accent-soft text-ink',
  ok: 'bg-ok-soft text-ink',
  warn: 'bg-warn-soft text-ink',
  risk: 'bg-risk-soft text-ink',
  danger: 'bg-danger-soft text-ink',
  info: 'bg-info-soft text-ink',
  ai: 'bg-ai-soft text-ink',
  outline: 'border border-line-strong text-ink',
  inverse: 'bg-inverse text-on-inverse',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-faint',
  accent: 'bg-accent',
  ok: 'bg-ok-fill',
  warn: 'bg-warn-fill',
  risk: 'bg-risk-fill',
  danger: 'bg-danger-fill',
  info: 'bg-info-fill',
  ai: 'bg-ai-fill',
  outline: 'bg-faint',
  inverse: 'bg-on-inverse',
}

export function Badge({ tone = 'neutral', children, className, dot, title }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className={cx('size-1.5 rounded-full', DOTS[tone])} aria-hidden />}
      {children}
    </span>
  )
}

export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('code-tag', className)}>{children}</span>
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({ children, className, as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('rounded-lg border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </As>
  )
}

export function CardHeader({ title, eyebrow, actions, description }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** True inside a stage (Understand / Interpret / More): pages render a compact header beneath the stage title. */
export const InStageContext = createContext(false)

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  const inStage = useContext(InStageContext)
  if (inStage)
    return (
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-[22px] leading-tight font-black tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="display">{title}</h1>
        {description && <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'risk' | 'danger' | 'accent'; onClick?: () => void }) {
  const toneClass = tone ? { ok: 'text-ok', warn: 'text-warn', risk: 'text-risk', danger: 'text-danger', accent: 'text-ink' }[tone] : 'text-ink'
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={cx('flex flex-col items-start rounded-lg border border-line bg-surface px-4 py-3.5 text-left shadow-card', onClick && 'transition-colors hover:border-line-strong')}>
      <span className="eyebrow">{label}</span>
      <span className={cx('mt-1.5 text-[26px] leading-none font-semibold tracking-tight tabular-nums', toneClass)}>{value}</span>
      {sub && <span className="mt-1.5 text-[12px] text-muted">{sub}</span>}
    </Comp>
  )
}

export function Meter({ value, label, tone = 'accent' }: { value: number; label: string; tone?: 'accent' | 'ok' | 'warn' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const bar = { accent: 'bg-accent', ok: 'bg-ok-fill', warn: 'bg-warn-fill' }[tone]
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div className={cx('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <div className="mb-3 text-faint">{icon ?? <Inbox className="size-6" aria-hidden />}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-[13px]">{label}…</span>
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', error, action }: { title?: string; error: unknown; action?: ReactNode }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-6 text-danger" aria-hidden />
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-lg text-[13px] text-ink-2">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Callout({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warn' | 'danger' | 'ai' | 'ok' | 'neutral'; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const cls = {
    info: 'border-info/25 bg-info-soft',
    warn: 'border-warn/30 bg-warn-soft',
    danger: 'border-danger/30 bg-danger-soft',
    ai: 'border-ai/25 bg-ai-soft',
    ok: 'border-ok/25 bg-ok-soft',
    neutral: 'border-line bg-sunken',
  }[tone]
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-[13px] text-ink-2', cls)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <div className="font-semibold text-ink">{title}</div>}
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({ label, hint, error, children, required, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; required?: boolean; className?: string }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink-2">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children(id)}
      {hint && !error && <p className="text-[12px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('input', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('input resize-y leading-relaxed', className)} {...rest} />
})

export function Select<T extends string>({ options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: T | ''; label: string }[] }) {
  return (
    <select className={cx('input pr-8', className)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function optionsFrom<T extends string>(map: Record<T, string>, keys?: readonly T[]): { value: T; label: string }[] {
  return (keys ?? (Object.keys(map) as T[])).map((k) => ({ value: k, label: map[k] }))
}

// ---------------------------------------------------------------------------
// Tabs (WAI-ARIA tabs pattern with arrow-key navigation)
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line scroll-thin">
      {tabs.map((t, i) => {
        const selected = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
              onChange(next.value)
              ;(e.currentTarget.parentElement?.children[tabs.indexOf(next)] as HTMLElement | undefined)?.focus()
            }}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors',
              selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-sunken px-1.5 text-[11px] tabular-nums text-muted">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('flex h-7 items-center gap-1.5 rounded px-2.5 text-[12.5px] font-medium transition-colors', o.value === value ? 'bg-inverse text-on-inverse' : 'text-muted hover:text-ink')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,max-content)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Unknown({ children = 'Unknown' }: { children?: ReactNode }) {
  return <span className="text-faint italic">{children}</span>
}
