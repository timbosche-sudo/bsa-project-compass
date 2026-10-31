import { Crosshair, Lightbulb, Lock, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { NodePicker } from '@/components/Evidence'
import { useToast } from '@/components/Toast'
import { Button, cx } from '@/components/ui'
import { nodeLabel, sameRef } from '@/domain/traceability'
import { THINKING_MODES, type NodeRef, type NodeType, type Suggestion, type ThinkingMode } from '@/domain/types'
import { describeScope, focusFromLocation, MODE_LABELS, WORKSPACES, workspaceFromPath, type Workspace } from '@/services/thinking/context'
import { NO_OBSERVATIONS } from '@/services/thinking/engine'
import { MODEL_ONLY, thinkingProviders } from '@/services/thinking/providers'
import { Exploration } from './Exploration'
import { SuggestionCard } from './SuggestionCard'
import { WorkingCanvas } from './WorkingCanvas'

const PICK_TYPE: Record<Workspace, NodeType> = {
  'understand/evidence': 'statement',
  'understand/themes': 'theme',
  'understand/questions': 'statement',
  'understand/heard': 'statement',
  'interpret/point-of-view': 'theme',
  'interpret/vision': 'winTheme',
  'interpret/principles': 'principle',
  'interpret/opportunities': 'opportunity',
  'interpret/success': 'outcome',
  project: 'principle',
}

const MODE_KEY = 'compass.tp.mode'
const loadMode = (): ThinkingMode => {
  try {
    const m = localStorage.getItem(MODE_KEY) as ThinkingMode | null
    return m && (THINKING_MODES as readonly string[]).includes(m) ? m : 'explore'
  } catch {
    return 'explore'
  }
}

/**
 * Thinking Partner: a contextual colleague for design thinking. It reads the
 * current workspace and selected item, offers a few high-value observations
 * in four modes, supports guided exploration, and keeps promising ideas on a
 * Working Canvas. It proposes; people decide.
 */
export function ThinkingPartnerPanel({ onClose, focusOnOpen }: { onClose: () => void; focusOnOpen?: boolean }) {
  const { data, can, run } = useProject()
  const { adapter } = useSession()
  const notify = useToast()
  const location = useLocation()
  const workspace = workspaceFromPath(location.pathname)
  const pageFocus = focusFromLocation(location.pathname, location.search)
  const [mode, setModeState] = useState<ThinkingMode>(loadMode)
  const [scope, setScope] = useState<'page' | 'selected' | 'chosen'>('page')
  const [chosen, setChosen] = useState<NodeRef | null>(null)
  const [picking, setPicking] = useState(false)
  const [tab, setTab] = useState<'suggestions' | 'canvas'>('suggestions')
  const [exploring, setExploring] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; suppressed: number; at: string } | null>(null)
  const [includeSetAside, setIncludeSetAside] = useState(false)
  const providers = useMemo(() => thinkingProviders(adapter), [adapter])
  const heading = useRef<HTMLHeadingElement>(null)
  // Move focus into the panel when it opens, so keyboard and screen-reader users land in it.
  useEffect(() => {
    if (focusOnOpen) heading.current?.focus()
  }, [focusOnOpen])
  const ai = providers.ai.status()

  const focus = scope === 'selected' ? pageFocus : scope === 'chosen' ? chosen : null
  const request = (depth: 'focused' | 'deeper') => ({ workspace, mode, focus, depth, includeSetAside })
  const ctx = providers.rules.context(data, request('focused'))
  const ws = WORKSPACES[workspace]

  const setMode = (m: ThinkingMode) => {
    setModeState(m)
    setResult(null)
    setExploring(null)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* optional */
    }
  }

  const analyze = async (depth: 'focused' | 'deeper') => {
    setBusy(true)
    try {
      const r = await providers.rules.analyze(data, request(depth))
      if (r.suggestions.length) await run({ type: 'suggestion.add', suggestions: r.suggestions.map((s) => ({ ...s, origin: 'rules' as const, provider: providers.rules.label })) })
      setResult({ added: r.suggestions.length, suppressed: r.suppressed, at: new Date().toISOString() })
      setTab('suggestions')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const relevant = (s: Suggestion) => s.status === 'pending' && s.card?.scope.workspace === workspace && s.card.mode === mode && (!focus || (s.card.scope.focus && sameRef(s.card.scope.focus, focus)) || [...s.evidence, ...(s.target ? [s.target] : [])].some((r) => sameRef(r, focus)))
  const suggestions = data.suggestions.filter(relevant)
  const otherPending = data.suggestions.filter((s) => s.status === 'pending' && !relevant(s)).length
  const active = exploring ? data.suggestions.find((s) => s.id === exploring) : null
  const canvasCount = data.canvas.filter((i) => i.state === 'exploring' || i.state === 'worth_developing').length

  return (
    <aside aria-label="Thinking Partner" className="flex h-full min-h-0 flex-col border-l border-line bg-canvas">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="flex items-center gap-2 text-[15px] font-semibold text-ink outline-none">
            <Lightbulb className="size-4" /> Thinking Partner
          </h2>
          <p className="text-[11.5px] text-muted">People exercise the judgment. Observations are rule-based; no AI model is used.</p>
        </div>
        <button className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label="Close Thinking Partner" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {/* Current context */}
        <section aria-label="Current context" className="space-y-2 border-b border-line px-4 py-3">
          <div className="eyebrow">Analyzing</div>
          <p className="text-[13px] text-ink">
            <span className="font-semibold">
              {ws.stage} · {ws.label}:
            </span>{' '}
            {describeScope(ctx)}
          </p>
          <div role="radiogroup" aria-label="What to analyze" className="flex flex-wrap gap-1.5">
            <ScopeButton on={scope === 'page'} onClick={() => setScope('page')}>
              This page
            </ScopeButton>
            {pageFocus && (
              <ScopeButton on={scope === 'selected'} onClick={() => setScope('selected')}>
                <Crosshair className="size-3" /> Selected: {nodeLabel(data, pageFocus).code}
              </ScopeButton>
            )}
            <ScopeButton on={scope === 'chosen'} onClick={() => setPicking(true)}>
              <Search className="size-3" /> {scope === 'chosen' && chosen ? `Item: ${nodeLabel(data, chosen).code}` : 'Choose an item…'}
            </ScopeButton>
          </div>
          <p className="text-[11.5px] text-muted">
            Prioritizes {ws.priorities}. Project type: {data.project.sector}; phase: {data.project.phase.replace(/_/g, ' ')}.
          </p>
        </section>

        {/* Modes */}
        <section aria-label="Thinking mode" className="border-b border-line px-4 py-3">
          <div role="tablist" aria-label="Thinking mode" className="grid grid-cols-4 gap-1 rounded-md border border-line-strong bg-surface p-0.5">
            {THINKING_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cx('min-h-9 rounded px-1 text-[12.5px] font-semibold transition-colors', mode === m ? 'bg-inverse text-on-inverse' : 'text-muted hover:text-ink')}
              >
                {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] font-medium text-ink">{MODE_LABELS[mode].question}</p>
          {can('suggestion.request') ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" loading={busy} onClick={() => void analyze('focused')}>
                Analyze
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void analyze('deeper')}>
                Look deeper
              </Button>
              <label className="flex min-h-8 items-center gap-1.5 text-[12px] text-muted">
                <input type="checkbox" className="size-4 accent-[var(--c-accent)]" checked={includeSetAside} onChange={(e) => setIncludeSetAside(e.target.checked)} />
                Include set-aside observations
              </label>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">Your role can review suggestions but not request analysis.</p>
          )}
        </section>

        {/* Suggestions | Working Canvas */}
        <div className="px-4 pt-3">
          <div role="tablist" aria-label="Thinking Partner views" className="flex gap-1 border-b border-line">
            <TabButton on={tab === 'suggestions'} onClick={() => setTab('suggestions')}>
              Suggestions ({suggestions.length})
            </TabButton>
            <TabButton on={tab === 'canvas'} onClick={() => setTab('canvas')}>
              Working Canvas ({canvasCount})
            </TabButton>
          </div>
        </div>
        <div className="space-y-3 px-4 py-3">
          {tab === 'canvas' ? (
            <WorkingCanvas workspace={workspace} focus={focus} />
          ) : active?.card?.exploration ? (
            <Exploration
              s={active}
              onBack={() => setExploring(null)}
              onDeveloped={() => {
                setExploring(null)
                setTab('canvas')
              }}
            />
          ) : (
            <>
              {result && (
                <p role="status" className="rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">
                  {result.added === 0 ? NO_OBSERVATIONS : `${result.added} observation${result.added === 1 ? '' : 's'} for consideration.`}
                  {result.suppressed > 0 && ` ${result.suppressed} observation${result.suppressed === 1 ? ' you set aside was' : 's you set aside were'} not repeated because nothing has changed.`}
                </p>
              )}
              {suggestions.length === 0 && !result && <p className="text-[12.5px] text-muted">Choose a mode and press Analyze. Suggestions appear here for the team to explore, keep or set aside.</p>}
              {suggestions.map((s) => (
                <SuggestionCard key={s.id} s={s} onExplore={(x) => setExploring(x.id)} />
              ))}
              {otherPending > 0 && <p className="text-[11.5px] text-muted">{otherPending} other suggestion{otherPending === 1 ? '' : 's'} await review in other places or modes.</p>}
            </>
          )}

          <details className="rounded-md border border-dashed border-line-strong px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-muted">
              <Lock className="size-3.5" /> Requires an approved AI provider
            </summary>
            <p className="mt-2 text-[11.5px] text-muted">{ai.reason}</p>
            <ul className="mt-2 space-y-1">
              {MODEL_ONLY[mode].map((m) => (
                <li key={m}>
                  <button type="button" disabled aria-disabled className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-muted opacity-70">
                    <Lock className="size-3 shrink-0" /> {m}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
      {picking && (
        <NodePicker
          open
          single
          onOpenChange={(o) => !o && setPicking(false)}
          type={PICK_TYPE[workspace]}
          title="Choose an item to analyze"
          initial={chosen ? [chosen.id] : []}
          confirmLabel="Analyze this item"
          onPick={(ids) => {
            if (ids[0]) {
              setChosen({ type: PICK_TYPE[workspace], id: ids[0] })
              setScope('chosen')
              setResult(null)
            }
            setPicking(false)
          }}
        />
      )}
    </aside>
  )
}

function ScopeButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cx('flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium', on ? 'border-ink bg-inverse text-on-inverse' : 'border-line-strong text-ink-2 hover:border-ink')}>
      {children}
    </button>
  )
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick} className={cx('-mb-px min-h-9 border-b-2 px-2.5 text-[13px] font-medium', on ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')}>
      {children}
    </button>
  )
}
