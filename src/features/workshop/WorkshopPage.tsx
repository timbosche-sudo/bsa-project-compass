import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  GripVertical,
  Loader2,
  Maximize,
  MessageSquareText,
  MonitorPlay,
  SlidersHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Redo2,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { useConfirm } from '@/components/Dialog'
import { ApprovalBadge } from '@/components/StatusBadge'
import { Badge, Button, cx, IconButton } from '@/components/ui'
import { alignmentStatusOf } from '@/domain/alignment'
import { ALIGNMENT_STATUS_LABELS, APPROVAL_LABELS } from '@/domain/labels'
import type { ApprovalStatus, GuidingPrinciple, WinTheme } from '@/domain/types'
import { liveSession, type FrameworkKind } from '@/domain/workshop'
import { BsaLogo } from '@/brand/BsaLogo'
import { ApproveDialog, MergeDialog } from './dialogs'
import { AlignmentCapture, ALIGNMENT_TONE } from './AlignmentCapture'
import { FacilitatorPanel } from './FacilitatorPanel'
import { buildSlides, CHAPTERS, DEFAULT_DECK, Slide, SlideStage, type Chapter, type DeckOptions, type SlideDef } from './Slides'
import { SaveStatusProvider, UndoProvider, useSaveStatus, useUndo, useWorkshopActions } from './state'

export const workshopChannel = (projectId: string) => `compass-workshop:${projectId}`
export type ChannelMessage = { type: 'slide'; key: string; opts: DeckOptions } | { type: 'hello' } | { type: 'audience-here' } | { type: 'audience-bye' }

const OPTS_KEY = 'compass.workshop.opts'
function loadOpts(): DeckOptions {
  try {
    return { ...DEFAULT_DECK, ...JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_DECK
  }
}

const SLIDE_HINTS: Record<SlideDef['kind'], string> = {
  title: 'Title slide — shows the project, Owner and session.',
  chapter: 'Chapter divider. Press 1–4 to jump between chapters while presenting.',
  heard: 'Shows reviewed What We Heard items marked for the presentation. Edit them in Understand → What We Heard.',
  pov: 'BSA’s point of view. Edit it in Interpret → Point of View.',
  winTheme: '',
  overview: 'Overview of all guiding principles. Select a principle to wordsmith it.',
  principle: '',
  outcomes: 'Potential outcomes marked for the presentation. Edit them in Interpret → What Success Could Look Like.',
  discussion: 'Prompts for the conversation, with the tensions from the point of view.',
  summary: 'Updates live as you record Owner responses. Nothing counts as aligned until it is recorded.',
}

const REVIEW_STATUSES: { value: Exclude<ApprovalStatus, 'approved' | 'superseded'>; label: string }[] = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'in_review', label: 'Discussing' },
  { value: 'needs_refinement', label: 'Needs Refinement' },
  { value: 'not_adopted', label: 'Not Adopted' },
]

export default function WorkshopPage() {
  return (
    <SaveStatusProvider>
      <UndoProvider>
        <Workshop />
      </UndoProvider>
    </SaveStatusProvider>
  )
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function Workshop() {
  const { data, can } = useProject()
  const { projectId } = useParams()
  const [params, setParams] = useSearchParams()
  const undo = useUndo()
  const actions = useWorkshopActions()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'edit' | 'present'>('edit')
  const [wordsmith, setWordsmith] = useState(false)
  const [panel, setPanel] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1280)
  const [opts, setOpts] = useState<DeckOptions>(loadOpts)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'merge' | null>(null)
  const [audience, setAudience] = useState(false)
  const channel = useRef<BroadcastChannel | null>(null)

  const slides = useMemo(() => buildSlides(data, opts), [data, opts])
  const requested = params.get('slide')
  const index = Math.max(0, slides.findIndex((s) => s.key === requested))
  const slide = slides[index] ?? slides[0]
  const go = useCallback((key: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('slide', key); return n }, { replace: true }), [setParams])
  // Reads the slide from the URL at the moment of the key press, so rapid presses (e.g. a clicker) never use a stale position.
  const step = useCallback(
    (d: number) =>
      setParams(
        (p) => {
          const at = Math.max(0, slides.findIndex((s) => s.key === p.get('slide')))
          const n = new URLSearchParams(p)
          n.set('slide', slides[Math.min(slides.length - 1, Math.max(0, at + d))].key)
          return n
        },
        { replace: true },
      ),
    [setParams, slides],
  )
  const jumpChapter = useCallback((n: Chapter) => {
    const target = slides.find((s) => s.key === `chapter:${n}`) ?? slides.find((s) => s.chapter === n)
    if (target) go(target.key)
  }, [go, slides])
  const [capture, setCapture] = useState(false)

  const live = liveSession(data)
  // Follow the live session; keep showing it after it ends so its summary stays at hand.
  useEffect(() => {
    if (live && !sessionId) setSessionId(live.id)
  }, [live, sessionId])
  const session =
    data.workshops.find((w) => w.id === sessionId) ?? live ?? [...data.workshops].reverse().find((w) => w.status === 'planned') ?? [...data.workshops].filter((w) => w.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))[0] ?? null
  const kind: FrameworkKind | null = slide.kind === 'winTheme' || slide.kind === 'principle' ? slide.kind : null
  const item: WinTheme | GuidingPrinciple | null = kind === 'winTheme' ? (data.winThemes.find((w) => w.id === slide.id) ?? null) : kind === 'principle' ? (data.principles.find((p) => p.id === slide.id) ?? null) : null

  useEffect(() => {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(opts))
    } catch {
      /* optional */
    }
  }, [opts])

  // Keep the audience window on the facilitator's slide.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || !projectId) return
    const ch = new BroadcastChannel(workshopChannel(projectId))
    channel.current = ch
    ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
      if (e.data.type === 'hello' || e.data.type === 'audience-here') setAudience(true)
      if (e.data.type === 'audience-bye') setAudience(false)
      if (e.data.type === 'hello') ch.postMessage({ type: 'slide', key: slideRef.current, opts: optsRef.current } satisfies ChannelMessage)
    }
    return () => ch.close()
  }, [projectId])
  const slideRef = useRef(slide.key)
  const optsRef = useRef(opts)
  useEffect(() => {
    slideRef.current = slide.key
    optsRef.current = opts
    channel.current?.postMessage({ type: 'slide', key: slide.key, opts } satisfies ChannelMessage)
  }, [slide.key, opts])

  const present = useCallback(async () => {
    setMode('present')
    setWordsmith(false)
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    } catch {
      /* full screen is optional (e.g. blocked in an embedded frame) */
    }
  }, [])
  const exitPresent = useCallback(async () => {
    setMode('edit')
    setWordsmith(false)
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {})
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  const openAudience = () => {
    window.open(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projects/${data.project.id}/workshop/audience`, 'compass-audience', 'popup,width=1280,height=720')
  }

  const orderedPrinciples = useMemo(() => [...data.principles].sort((a, b) => a.order - b.order), [data.principles])
  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      const visible = slides.filter((s) => s.kind === 'principle').map((s) => s.id!)
      const i = visible.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= visible.length) return
      const swapWith = visible[j]
      const all = orderedPrinciples.map((p) => p.id)
      const a = all.indexOf(id)
      const b = all.indexOf(swapWith)
      ;[all[a], all[b]] = [all[b], all[a]]
      void actions.reorder(all)
    },
    [slides, orderedPrinciples, actions],
  )

  const removeItem = useCallback(async () => {
    if (!item || !kind) return
    const r = await confirm({ title: `Delete ${item.code}?`, body: 'It is moved to recoverable trash. Use Undo (Ctrl+Z) to bring it back.', confirmLabel: 'Delete', tone: 'danger' })
    if (!r.confirmed) return
    const nextKey = slides[index + 1]?.key ?? slides[index - 1]?.key
    if (await actions.remove(kind, item.id, item.code)) go(nextKey)
  }, [item, kind, confirm, actions, slides, index, go])

  // Keyboard: arrows/PageUp/PageDown navigate; P present; E edit/wordsmith; F full screen; N panel; Ctrl+Z / Ctrl+Shift+Z undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e)) {
        e.preventDefault()
        void (e.shiftKey ? undo.redo() : undo.undo())
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping(e)) {
        e.preventDefault()
        void undo.redo()
        return
      }
      if (isTyping(e) || mod) return
      if (e.altKey && slide.kind === 'principle' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        move(slide.id!, e.key === 'ArrowUp' ? -1 : 1)
        return
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          step(1)
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          step(-1)
          break
        case 'Home':
          go(slides[0].key)
          break
        case 'End':
          go(slides[slides.length - 1].key)
          break
        case 'p':
        case 'P':
          if (mode === 'edit') void present()
          break
        case 'e':
        case 'E':
          if (mode === 'present') setWordsmith((w) => !w)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case '1':
        case '2':
        case '3':
        case '4':
          jumpChapter(Number(e.key) as Chapter)
          break
        case 'a':
        case 'A':
          if (mode === 'present' && item && can('workshop.facilitate')) setCapture((c) => !c)
          break
        case 'n':
        case 'N':
          if (mode === 'edit') setPanel((x) => !x)
          break
        case 'Escape':
          if (mode === 'present') {
            if (capture) setCapture(false)
            else if (wordsmith) setWordsmith(false)
            else void exitPresent()
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capture, undo, step, go, slides, mode, wordsmith, present, exitPresent, toggleFullscreen, move, slide, jumpChapter, item, can])

  // Leaving browser full screen (Esc handled by the browser) returns to Edit mode.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && mode === 'present') setMode('edit')
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [mode])

  const editMode = mode === 'edit' || wordsmith
  const stage = (
    <SlideStage className="h-full w-full">
      <Slide slide={slide} mode={editMode ? 'edit' : 'present'} index={index} total={slides.length} opts={opts} session={session} />
    </SlideStage>
  )

  const dialogs = item && kind && (
    <>
      <ApproveDialog open={dialog === 'approve'} onOpenChange={(o) => setDialog(o ? 'approve' : null)} kind={kind} item={item} session={live} />
      {kind === 'principle' && <MergeDialog open={dialog === 'merge'} onOpenChange={(o) => setDialog(o ? 'merge' : null)} into={item as GuidingPrinciple} />}
    </>
  )

  if (mode === 'present') {
    return (
      <PresentShell
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onExit={() => void exitPresent()}
        onFullscreen={toggleFullscreen}
        position={`${index + 1} / ${slides.length}`}
        wordsmith={wordsmith}
        onWordsmith={() => setWordsmith((w) => !w)}
        canEdit={can('framework.edit')}
        statusControls={wordsmith && item && kind ? <ItemStatusControls item={item} kind={kind} compact onApprove={() => setDialog('approve')} /> : null}
        chapter={slide.chapter ?? null}
        onChapter={jumpChapter}
        canCapture={!!item && can('workshop.facilitate')}
        capturing={capture}
        onCapture={() => setCapture((c) => !c)}
      >
        {stage}
        {capture && item && kind && (
          <div className="absolute inset-y-4 right-4 z-10 flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-raised text-ink shadow-pop"
            role="region"
            aria-label={`Owner response to ${item.code}`}
            onKeyDownCapture={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setCapture(false)
              }
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <div className="eyebrow">Owner response · {item.code}</div>
                <div className="text-[12px] text-muted">{session ? `${session.code} · ${session.title}` : 'No session selected'}</div>
              </div>
              <IconButton label="Close (A or Esc)" onClick={() => setCapture(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin">
              <AlignmentCapture type={kind} id={item.id} code={item.code} session={session} compact />
            </div>
          </div>
        )}
        {dialogs}
      </PresentShell>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 lg:px-4">
        <Link to={`/projects/${data.project.id}/align`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted hover:bg-sunken hover:text-ink" aria-label="Back to Align">
          <ArrowLeft className="size-4" />
          <BsaLogo height={26} clearSpace={false} className="mx-2" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">Owner Alignment Workshop</div>
          <div className="truncate text-[11.5px] text-muted">{data.project.name}</div>
        </div>
        <SessionPill />
        {data.project.isDemo && <Badge tone="warn">Demo data</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <SaveIndicator />
          <div className="mx-1 h-6 w-px bg-line" />
          <IconButton label={undo.undoLabel ? `Undo ${undo.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'} disabled={!undo.canUndo} onClick={() => void undo.undo()}>
            <Undo2 className="size-4" />
          </IconButton>
          <IconButton label={undo.redoLabel ? `Redo ${undo.redoLabel} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'} disabled={!undo.canRedo} onClick={() => void undo.redo()}>
            <Redo2 className="size-4" />
          </IconButton>
          <div className="mx-1 h-6 w-px bg-line" />
          <DeckOptionsMenu opts={opts} onChange={setOpts} />
          <Button size="sm" variant="ghost" icon={<ExternalLink className="size-3.5" />} onClick={openAudience} title="Open a separate audience window (e.g. for a second display)">
            <span className="hidden lg:inline">Audience window</span>
            {audience && <span className="size-1.5 rounded-full bg-ok-fill" aria-label="connected" />}
          </Button>
          <IconButton label={panel ? 'Hide facilitator panel (N)' : 'Show facilitator panel (N)'} onClick={() => setPanel((x) => !x)}>
            {panel ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </IconButton>
          <Button size="sm" variant="primary" icon={<MonitorPlay className="size-4" />} onClick={() => void present()} title="Present (P)">
            Present
          </Button>
        </div>
      </header>

      <div className={cx('grid min-h-0 flex-1', panel ? 'grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_400px] xl:grid-cols-[230px_minmax(0,1fr)_360px]' : 'grid-cols-[240px_minmax(0,1fr)]')}>
        <SlideRail slides={slides} current={slide.key} onSelect={go} onAddPrinciple={async () => { const id = await actions.addPrinciple(); if (id) go(`principle:${id}`) }} onAddWinTheme={async () => { const id = await actions.addWinTheme(); if (id) go(`winTheme:${id}`) }} onReorder={(ids) => void actions.reorder(ids)} orderedPrinciples={orderedPrinciples.map((p) => p.id)} canEdit={can('framework.edit')} />
        <main className="flex min-h-0 min-w-0 flex-col" aria-label="Slide">
          <RecoveryBanner />
          {item && kind ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
              <span className="font-mono text-[12px] text-muted">{item.code}</span>
              <ItemStatusControls item={item} kind={kind} onApprove={() => setDialog('approve')} />
              {can('framework.edit') && (
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {kind === 'principle' && (
                    <>
                      <IconButton label="Move earlier (Alt+↑)" onClick={() => move(item.id, -1)}>
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton label="Move later (Alt+↓)" onClick={() => move(item.id, 1)}>
                        <ArrowDown className="size-4" />
                      </IconButton>
                    </>
                  )}
                  <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={async () => { const id = await actions.duplicate(kind, item.id, item.code); if (id) go(`${kind}:${id}`) }}>
                    Duplicate
                  </Button>
                  {kind === 'principle' && (
                    <Button size="sm" variant="ghost" icon={<GitMerge className="size-3.5" />} onClick={() => setDialog('merge')}>
                      Merge
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} disabled={!!item.approval} title={item.approval ? 'Approved items stay on record; mark Not Adopted instead' : undefined} onClick={() => void removeItem()}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-[12.5px] text-muted">{SLIDE_HINTS[slide.kind]}</div>
          )}
          <div className="min-h-0 flex-1 p-4 lg:p-6">{stage}</div>
          <div className="flex items-center justify-center gap-3 border-t border-line bg-surface py-2">
            <IconButton label="Previous slide (←)" disabled={index === 0} onClick={() => step(-1)}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <span className="min-w-16 text-center text-[12.5px] text-muted tabular-nums">
              {index + 1} / {slides.length}
            </span>
            <IconButton label="Next slide (→)" disabled={index === slides.length - 1} onClick={() => step(1)}>
              <ChevronRight className="size-5" />
            </IconButton>
            <span className="hidden text-[11.5px] text-muted lg:inline">Click text on the slide to edit · ← → navigate · P present · Ctrl+Z undo</span>
          </div>
        </main>
        {panel && (
          <aside className="min-h-0 border-l border-line bg-surface max-xl:fixed max-xl:top-14 max-xl:right-0 max-xl:bottom-0 max-xl:z-20 max-xl:w-[min(380px,100vw)] max-xl:shadow-pop" aria-label="Facilitator panel">
            <FacilitatorPanel item={item} kind={kind} session={session} onSelectSession={setSessionId} slideKey={slide.key} slideLabel={slide.label} />
          </aside>
        )}
      </div>
      {dialogs}
    </div>
  )
}

function ItemStatusControls({ item, kind, compact, onApprove }: { item: WinTheme | GuidingPrinciple; kind: FrameworkKind; compact?: boolean; onApprove: () => void }) {
  const { run, can } = useProject()
  const actions = useWorkshopActions()
  const confirm = useConfirm()
  const canEdit = can('framework.edit')
  const canRecord = can('workshop.facilitate') || can('framework.approve')
  if (item.status === 'approved' || item.status === 'superseded') {
    return (
      <div className="flex items-center gap-2">
        <ApprovalBadge status={item.status} />
        {item.status === 'approved' && canEdit && (
          <Button
            size="sm"
            variant={compact ? 'secondary' : 'ghost'}
            icon={<GitBranch className="size-3.5" />}
            onClick={async () => {
              const r = await confirm({ title: `Revise approved wording of ${item.code}?`, body: 'The approved wording stays on record. Your edits become a new proposed revision that needs approval again.', confirmLabel: 'Start revision' })
              if (r.confirmed) run({ type: 'framework.openRevision', kind, id: item.id }, `Revision of ${item.code} opened`)
            }}
          >
            Revise wording
          </Button>
        )}
        {item.status === 'superseded' && canEdit && (
          <Button size="sm" variant="ghost" onClick={() => run({ type: 'framework.setReviewStatus', kind, id: item.id, status: 'proposed' }, `${item.code} reinstated`)}>
            Reinstate
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Review status" className={cx('inline-flex rounded-md border p-0.5', compact ? 'border-white/20 bg-white/5' : 'border-line-strong bg-surface')}>
        {REVIEW_STATUSES.map((s) => {
          const on = item.status === s.value
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!canEdit}
              onClick={() => void actions.setStatus(kind, item.id, s.value, item.code)}
              className={cx(
                'h-7 rounded px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors disabled:opacity-60',
                on ? (compact ? 'bg-white text-black' : 'bg-inverse text-on-inverse') : compact ? 'text-white/75 hover:text-white' : 'text-muted hover:text-ink',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      {canRecord && item.status !== 'not_adopted' && (
        <Button size="sm" variant="accent" icon={<ShieldCheck className="size-3.5" />} onClick={onApprove}>
          Record approval
        </Button>
      )}
    </div>
  )
}

function SlideRail({ slides, current, onSelect, onAddPrinciple, onAddWinTheme, onReorder, orderedPrinciples, canEdit }: { slides: SlideDef[]; current: string; onSelect: (k: string) => void; onAddPrinciple: () => void; onAddWinTheme: () => void; onReorder: (ids: string[]) => void; orderedPrinciples: string[]; canEdit: boolean }) {
  const { data } = useProject()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const alignOf = (s: SlideDef) => (s.kind === 'principle' || s.kind === 'winTheme' ? alignmentStatusOf(data, s.kind, s.id!) : null)
  const statusOf = (s: SlideDef): ApprovalStatus | null => (s.kind === 'principle' ? (data.principles.find((p) => p.id === s.id)?.status ?? null) : s.kind === 'winTheme' ? (data.winThemes.find((w) => w.id === s.id)?.status ?? null) : null)
  const drop = (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const ids = orderedPrinciples.filter((x) => x !== dragging)
    ids.splice(ids.indexOf(targetId), 0, dragging)
    onReorder(ids)
  }
  return (
    <nav className="flex min-h-0 flex-col border-r border-line bg-surface" aria-label="Slides">
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 scroll-thin">
        {slides.map((s, i) => {
          const st = statusOf(s)
          const draggable = canEdit && s.kind === 'principle'
          return (
            <li
              key={s.key}
              draggable={draggable}
              onDragStart={(e) => {
                setDragging(s.id!)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragging(null)
                setOver(null)
              }}
              onDragOver={(e) => {
                if (dragging && s.kind === 'principle') {
                  e.preventDefault()
                  setOver(s.id!)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (s.kind === 'principle') drop(s.id!)
                setOver(null)
              }}
              className={cx('group rounded-md', over === s.id && dragging !== s.id && 'ring-2 ring-accent')}
            >
              <button onClick={() => onSelect(s.key)} aria-current={s.key === current ? 'true' : undefined} className={cx('flex w-full items-start gap-2 rounded-md px-2 py-2 text-left', s.key === current ? 'bg-inverse text-on-inverse' : 'hover:bg-sunken', s.chapter && s.kind !== 'chapter' && 'pl-3', s.kind === 'chapter' && 'mt-2')}>
                <span className={cx('w-5 shrink-0 pt-0.5 font-mono text-[10.5px] tabular-nums', s.key === current ? 'opacity-70' : 'text-muted')}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('line-clamp-2 leading-snug', s.kind === 'chapter' ? 'text-[11px] font-black tracking-[0.08em] uppercase' : 'text-[12.5px]', s.kind === 'title' || s.kind === 'overview' || s.kind === 'summary' || s.kind === 'discussion' ? 'font-semibold' : '')}>{s.label}</span>
                  {st && (
                    <span className={cx('mt-0.5 flex items-center gap-1 text-[10.5px]', s.key === current ? 'opacity-75' : 'text-muted')}>
                      <span className={cx('size-1.5 rounded-full', { approved: 'bg-ok-fill', in_review: 'bg-info-fill', needs_refinement: 'bg-warn-fill', not_adopted: 'bg-danger-fill', proposed: 'bg-line-strong', superseded: 'bg-faint' }[st])} />
                      {APPROVAL_LABELS[st]}
                      {alignOf(s) && alignOf(s) !== 'not_reviewed' && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={cx('size-1.5 rounded-full', ALIGNMENT_TONE[alignOf(s)!])} />
                          {ALIGNMENT_STATUS_LABELS[alignOf(s)!]}
                        </>
                      )}
                    </span>
                  )}
                </span>
                {draggable && <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-50" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ol>
      {canEdit && (
        <div className="space-y-1.5 border-t border-line p-2">
          <Button size="sm" className="w-full justify-start" icon={<Plus className="size-3.5" />} onClick={onAddPrinciple}>
            Add principle
          </Button>
          <Button size="sm" variant="ghost" className="w-full justify-start" icon={<Plus className="size-3.5" />} onClick={onAddWinTheme}>
            Add {data.project.terminology.winTheme} alternative
          </Button>
        </div>
      )}
    </nav>
  )
}

function SaveIndicator() {
  const { state } = useSaveStatus()
  const base = 'flex items-center gap-1.5 text-[12px] whitespace-nowrap'
  switch (state.kind) {
    case 'saving':
      return (
        <span className={cx(base, 'text-muted')} role="status">
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </span>
      )
    case 'dirty':
      return (
        <span className={cx(base, 'text-warn')} role="status">
          <Pencil className="size-3.5" /> Unsaved edits
        </span>
      )
    case 'error':
      return (
        <span className={cx(base, 'text-danger')} role="alert">
          <CircleAlert className="size-3.5" /> Not saved —{' '}
          <button className="underline" onClick={state.retry}>
            retry
          </button>
        </span>
      )
    case 'saved':
      return (
        <span className={cx(base, 'text-ok')} role="status">
          <Check className="size-3.5" /> All changes saved {state.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
      )
    default:
      return (
        <span className={cx(base, 'text-muted')} role="status">
          <Check className="size-3.5" /> Up to date
        </span>
      )
  }
}

function RecoveryBanner() {
  const { recovered } = useSaveStatus()
  if (recovered.length === 0) return null
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-warn/40 bg-warn-soft px-4 py-2 text-[13px]">
      <CircleAlert className="size-4 text-warn" />
      <span className="flex-1">
        Recovered {recovered.length} unsaved edit{recovered.length === 1 ? '' : 's'} from an earlier session ({recovered.map((r) => r.label).join(', ')}). They are shown in place, highlighted.
      </span>
      <Button size="sm" variant="primary" onClick={() => recovered.forEach((r) => r.apply())}>
        Save recovered edits
      </Button>
      <Button size="sm" variant="ghost" onClick={() => recovered.forEach((r) => r.discard())}>
        Discard
      </Button>
    </div>
  )
}

function SessionPill() {
  const { data } = useProject()
  const live = liveSession(data)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000)
    return () => window.clearInterval(t)
  }, [live])
  if (!live) return <Badge tone="outline">No live session</Badge>
  const mins = live.startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(live.startedAt)) / 60000)) : 0
  return (
    <Badge tone="danger" dot title={live.title}>
      Live · {live.code} · {mins} min
    </Badge>
  )
}

function PresentShell({
  children,
  onPrev,
  onNext,
  onExit,
  onFullscreen,
  position,
  wordsmith,
  onWordsmith,
  canEdit,
  statusControls,
  chapter,
  onChapter,
  canCapture,
  capturing,
  onCapture,
}: {
  children: ReactNode
  onPrev: () => void
  onNext: () => void
  onExit: () => void
  onFullscreen: () => void
  position: string
  wordsmith: boolean
  onWordsmith: () => void
  canEdit: boolean
  statusControls: ReactNode
  chapter: Chapter | null
  onChapter: (n: Chapter) => void
  canCapture: boolean
  capturing: boolean
  onCapture: () => void
}) {
  const [visible, setVisible] = useState(true)
  const timer = useRef<number | null>(null)
  const poke = useCallback(() => {
    setVisible(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(false), 2500)
  }, [])
  useEffect(() => {
    poke()
    return () => void (timer.current && window.clearTimeout(timer.current))
  }, [poke])
  const show = visible || wordsmith || capturing
  return (
    <div className={cx('fixed inset-0 z-30 flex flex-col bg-black', !show && 'cursor-none')} onMouseMove={poke} onTouchStart={poke} onClick={poke} data-testid="present-mode">
      <div className={cx('flex min-h-0 flex-1', wordsmith && 'pb-16', capturing && 'md:pr-[416px]')}>{children}</div>
      <div className={cx('pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-opacity duration-300', show ? 'opacity-100' : 'opacity-0')}>
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-xl border border-white/15 bg-black/80 px-2 py-1.5 text-white shadow-pop backdrop-blur" role="toolbar" aria-label="Presentation controls">
          <PresentButton label="Previous (←)" onClick={onPrev}>
            <ChevronLeft className="size-5" />
          </PresentButton>
          <span className="min-w-14 text-center text-[12.5px] text-white/70 tabular-nums">{position}</span>
          <PresentButton label="Next (→)" onClick={onNext}>
            <ChevronRight className="size-5" />
          </PresentButton>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <span className="flex items-center gap-0.5" role="group" aria-label="Chapters">
            {([1, 2, 3, 4] as Chapter[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChapter(n)}
                aria-current={chapter === n ? 'step' : undefined}
                aria-label={`Chapter ${n}: ${CHAPTERS[n].title} (${n})`}
                title={`${CHAPTERS[n].title} (${n})`}
                className={cx('flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[12.5px] font-bold tabular-nums', chapter === n ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white')}
              >
                {n}
              </button>
            ))}
          </span>
          {canCapture && (
            <>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button type="button" onClick={onCapture} aria-pressed={capturing} className={cx('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium', capturing ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10')} title="Record the Owner’s response (A)">
                <MessageSquareText className="size-3.5" /> Owner response
              </button>
            </>
          )}
          {canEdit && (
            <>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button type="button" onClick={onWordsmith} aria-pressed={wordsmith} className={cx('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium', wordsmith ? 'bg-[var(--c-accent)] text-black' : 'text-white/85 hover:bg-white/10')} title="Edit wording in place (E)">
                <Pencil className="size-3.5" /> {wordsmith ? 'Editing — Esc to finish' : 'Edit in place'}
              </button>
            </>
          )}
          {statusControls && <span className="mx-1 h-5 w-px bg-white/20" />}
          {statusControls}
          <span className="mx-1 h-5 w-px bg-white/20" />
          <PresentButton label="Full screen (F)" onClick={onFullscreen}>
            <Maximize className="size-4" />
          </PresentButton>
          <PresentButton label="Exit presentation (Esc)" onClick={onExit}>
            <X className="size-4" />
          </PresentButton>
        </div>
      </div>
    </div>
  )
}

function PresentButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-8 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white">
      {children}
    </button>
  )
}

function DeckOptionsMenu({ opts, onChange }: { opts: DeckOptions; onChange: (o: DeckOptions) => void }) {
  const items: { key: keyof DeckOptions; label: string }[] = [
    { key: 'showStatus', label: 'Show review statuses' },
    { key: 'hideNotAdopted', label: 'Hide items not adopted' },
    { key: 'showOpportunities', label: 'Show design opportunities on principles' },
    { key: 'showEvidence', label: 'Show a supporting quote on principles' },
  ]
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button size="sm" variant="ghost" icon={<SlidersHorizontal className="size-3.5" />}>
          <span className="hidden lg:inline">Deck options</span>
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 w-[300px] rounded-lg border border-line bg-raised p-1.5 shadow-pop">
          {items.map((i) => (
            <DM.CheckboxItem
              key={i.key}
              checked={opts[i.key]}
              onCheckedChange={(v) => onChange({ ...opts, [i.key]: v === true })}
              onSelect={(e) => e.preventDefault()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] outline-none data-[highlighted]:bg-sunken"
            >
              <span className="flex size-4 items-center justify-center rounded border border-line-strong">
                <DM.ItemIndicator>
                  <Check className="size-3" />
                </DM.ItemIndicator>
              </span>
              {i.label}
            </DM.CheckboxItem>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
