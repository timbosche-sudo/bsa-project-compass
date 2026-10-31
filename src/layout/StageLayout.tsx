import { Lightbulb } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useProject } from '@/app/project'
import { Button, cx, InStageContext, Loading } from '@/components/ui'

// The Thinking Partner and its rules engine load the first time the panel is opened.
const ThinkingPartnerPanel = lazy(() => import('@/features/thinking/ThinkingPartnerPanel').then((m) => ({ default: m.ThinkingPartnerPanel })))

export interface StageStep {
  to: string
  label: string
  hint?: string
  end?: boolean
}

export interface StageDef {
  number?: string
  name: string
  purpose: string
  steps: StageStep[]
  /** Offer the Thinking Partner panel in this stage. */
  thinking?: boolean
}

const OPEN_KEY = 'compass.tp.open'
const loadOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A stage (Understand, Interpret, More) — a slim header with the stage purpose,
 * step navigation and an optional Thinking Partner drawer. Pages inside render
 * compact headers so the stage, not the page, frames the work.
 */
export function StageLayout({ stage }: { stage: StageDef }) {
  const { data } = useProject()
  const [partner, setPartnerState] = useState(loadOpen)
  const setPartner = (o: boolean) => {
    setPartnerState(o)
    try {
      localStorage.setItem(OPEN_KEY, o ? '1' : '0')
    } catch {
      /* optional */
    }
  }
  const base = `/projects/${data.project.id}`
  const open = !!stage.thinking && partner
  const toggle = useRef<HTMLButtonElement>(null)
  // Focus moves into the panel only when someone opens it — not when it is restored on page load.
  const [focusPanel, setFocusPanel] = useState(false)
  const close = () => {
    setPartner(false)
    toggle.current?.focus()
  }
  return (
    <div className={cx(open && 'xl:grid xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start xl:gap-6')}>
      {/* Pages lay out against this container, so they adapt when the Thinking Partner is open. */}
      <div className="@container min-w-0">
      <div className="mb-6 border-b border-line">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <div className="eyebrow flex items-center gap-2">
              {stage.number && <span className="font-mono text-ink">{stage.number}</span>}
              <span>{stage.name}</span>
            </div>
            <p className="mt-1 max-w-3xl text-[13px] text-muted">{stage.purpose}</p>
          </div>
          {stage.thinking && (
            <Button ref={toggle} size="sm" variant={open ? 'primary' : 'secondary'} icon={<Lightbulb className="size-4" />} onClick={() => {
                if (open) close()
                else {
                  setFocusPanel(true)
                  setPartner(true)
                }
              }} aria-expanded={open} aria-controls="thinking-partner" aria-keyshortcuts="Escape">
              Thinking Partner
            </Button>
          )}
        </div>
        <nav aria-label={`${stage.name} steps`} className="-mb-px flex gap-1 overflow-x-auto scroll-thin">
          {stage.steps.map((s, i) => (
            <NavLink
              key={s.to}
              to={`${base}/${s.to}`}
              end={s.end}
              title={s.hint}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors',
                  isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
                )
              }
            >
              {stage.number && <span className="font-mono text-[10.5px] opacity-80 tabular-nums">{i + 1}</span>}
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <InStageContext.Provider value>
        <Outlet />
      </InStageContext.Provider>
      </div>
      {open && (
        // Beside the work on desktop and iPad landscape; over it on narrower screens.
        <div
          id="thinking-partner"
          onKeyDown={(e) => {
            // Esc closes the panel, unless a dialog or an inline editor inside it is handling Esc.
            if (e.key === 'Escape' && !document.querySelector('[role="dialog"]') && !(e.target as HTMLElement).closest('input, textarea, select')) {
              e.stopPropagation()
              close()
            }
          }}
          className="fixed inset-y-0 right-0 z-40 w-[min(440px,100vw)] shadow-pop xl:sticky xl:top-[4.5rem] xl:z-auto xl:h-[calc(100dvh-6rem)] xl:w-auto xl:overflow-hidden xl:rounded-lg xl:border xl:border-line xl:shadow-card">
          <Suspense fallback={<Loading label="Opening Thinking Partner" />}>
            <ThinkingPartnerPanel onClose={close} focusOnOpen={focusPanel} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
