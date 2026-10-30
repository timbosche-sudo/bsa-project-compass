import * as DM from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  FlaskConical,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  Plus,
  Presentation,
  Search,
  Settings,
  Sun,
  Target,
  Telescope,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router'
import { useProject, useProjects } from '@/app/project'
import { useSession } from '@/app/session'
import { Dialog } from '@/components/Dialog'
import { cx } from '@/components/ui'
import { NODE_TYPE_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { ROLE_LABELS, roleFor } from '@/domain/permissions'
import { search, searchIndex } from '@/domain/search'
import { NewProjectDialog } from '@/features/settings/NewProjectDialog'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

function useNav(): NavItem[] {
  const { data } = useProject()
  const t = data.project.terminology
  return [
    { to: '', label: 'Project Overview', icon: <Compass className="size-4" />, end: true },
    { to: 'intelligence', label: 'Project Intelligence', icon: <Telescope className="size-4" /> },
    { to: 'alignment', label: 'Alignment Studio', icon: <Layers className="size-4" /> },
    { to: 'vision', label: 'Vision & Principles', icon: <Lightbulb className="size-4" /> },
    { to: 'workshop', label: 'Owner Workshop', icon: <Presentation className="size-4" /> },
    { to: 'drivers', label: `${t.designDriver}s`, icon: <Target className="size-4" /> },
    { to: 'decisions', label: `${t.decision} Lab`, icon: <FlaskConical className="size-4" /> },
    { to: 'dashboard', label: 'Success Dashboard', icon: <LayoutDashboard className="size-4" /> },
    { to: 'reports', label: 'Reports', icon: <FileText className="size-4" /> },
    { to: 'settings', label: 'Project Settings', icon: <Settings className="size-4" /> },
  ]
}

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const { adapter } = useSession()

  useEffect(() => setNavOpen(false), [location.pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col">
      {adapter.mode === 'demo' && <DemoBanner />}
      <div className="flex min-h-0 flex-1">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        {/* Sidebar: persistent ≥1024px, drawer below */}
        <div className={cx('fixed inset-0 z-30 bg-black/40 lg:hidden', navOpen ? 'block' : 'hidden')} onClick={() => setNavOpen(false)} aria-hidden />
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Primary"
        >
          <Sidebar onClose={() => setNavOpen(false)} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setNavOpen(true)} onSearch={() => setSearchOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

function DemoBanner() {
  return (
    <div role="note" className="no-print flex items-center justify-center gap-2 bg-inverse px-4 py-1.5 text-center text-[12px] text-on-inverse">
      <span className="rounded-sm bg-accent px-1.5 py-px text-[10.5px] font-bold tracking-wider text-on-accent">DEMO</span>
      <span>
        Synthetic demonstration mode — data is fictional and stored only in this browser. Not secure; do not enter real or confidential project content.
      </span>
    </div>
  )
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const nav = useNav()
  const { data } = useProject()
  return (
    <>
      <div className="flex h-14 items-center justify-between gap-2 border-b border-line px-4">
        <Link to="/" className="flex items-center gap-2.5" aria-label="BSA Project Compass home">
          <BrandMark />
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold tracking-tight text-ink">Project Compass</span>
            <span className="block text-[10.5px] font-medium tracking-[0.14em] text-muted uppercase">BSA</span>
          </span>
        </Link>
        <button className="rounded p-1 text-muted hover:bg-sunken lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X className="size-4" />
        </button>
      </div>
      <div className="border-b border-line p-3">
        <ProjectSwitcher />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 scroll-thin" aria-label="Project sections">
        <ul className="space-y-0.5">
          {nav.map((item, i) => (
            <li key={item.to}>
              <NavLink
                to={`/projects/${data.project.id}/${item.to}`}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'group flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                    isActive ? 'bg-inverse text-on-inverse' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                  )
                }
              >
                <span className="font-mono text-[10.5px] opacity-50 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                {item.icon}
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-line px-4 py-3 text-[11px] leading-snug text-faint">
        From Vision to Measurable Impact
        <br />© BSA
      </div>
    </>
  )
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="6" className="fill-inverse" />
      <circle cx="16" cy="16" r="9.5" fill="none" className="stroke-on-inverse" strokeWidth="1.4" />
      <path d="M16 6.5 19 16l-3 9.5L13 16z" className="fill-accent" />
      <path d="M16 16 13 16 16 25.5z" className="fill-on-inverse" />
    </svg>
  )
}

function ProjectSwitcher() {
  const { data } = useProject()
  const projects = useProjects()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const p = data.project
  return (
    <>
      <DM.Root>
        <DM.Trigger className="flex w-full items-center gap-2.5 rounded-md border border-line px-2.5 py-2 text-left hover:bg-sunken" aria-label="Switch project">
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-accent-soft font-mono text-[10px] font-semibold text-accent-strong">{p.code.slice(0, 3)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
            <span className="block truncate text-[11.5px] text-muted">
              {SECTOR_LABELS[p.sector]} · {PHASE_LABELS[p.phase]}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="start" sideOffset={6} className="z-50 w-[300px] rounded-lg border border-line bg-raised p-1.5 shadow-pop">
            <DM.Label className="eyebrow px-2 py-1.5">Your projects</DM.Label>
            {projects.data?.map((x) => (
              <DM.Item key={x.id} onSelect={() => navigate(`/projects/${x.id}`)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] outline-none data-[highlighted]:bg-sunken">
                <span className="flex size-7 items-center justify-center rounded bg-sunken font-mono text-[9.5px] font-semibold text-muted">{x.code.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{x.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {x.ownerName}
                    {x.isDemo && ' · Demo'}
                  </span>
                </span>
                {x.id === p.id && <Check className="size-4 text-accent" />}
              </DM.Item>
            ))}
            <DM.Separator className="my-1 h-px bg-line" />
            <DM.Item onSelect={() => setCreating(true)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium text-ink outline-none data-[highlighted]:bg-sunken">
              <Plus className="size-4" /> New project
            </DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { theme, toggleTheme } = useSession()
  return (
    <div className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button className="rounded-md p-1.5 text-muted hover:bg-sunken lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={onSearch} className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-muted hover:text-ink" aria-label="Search project (Ctrl+K)">
          <Search className="size-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] md:inline">⌘K</kbd>
        </button>
        <button onClick={toggleTheme} className="rounded-md p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <IdentityMenu />
      </div>
    </div>
  )
}

const SECTION_LABELS: Record<string, string> = {
  intelligence: 'Project Intelligence',
  alignment: 'Alignment Studio',
  vision: 'Vision & Principles',
  workshop: 'Owner Workshop',
  drivers: 'Design Drivers',
  decisions: 'Decision Lab',
  dashboard: 'Success Dashboard',
  reports: 'Reports',
  settings: 'Project Settings',
}

function Breadcrumbs() {
  const { data } = useProject()
  const params = useParams()
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)
  const section = parts[2]
  const crumbs: { label: string; to?: string }[] = [{ label: data.project.name, to: `/projects/${data.project.id}` }]
  if (section) crumbs.push({ label: SECTION_LABELS[section] ?? section, to: `/projects/${data.project.id}/${section}` })
  if (params.sourceId) crumbs.push({ label: data.sources.find((s) => s.id === params.sourceId)?.code ?? 'Source' })
  if (params.driverId) crumbs.push({ label: data.drivers.find((s) => s.id === params.driverId)?.code ?? 'Driver' })
  if (params.decisionId) crumbs.push({ label: data.decisions.find((s) => s.id === params.decisionId)?.code ?? 'Decision' })
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={i} className={cx('flex min-w-0 items-center gap-1', i === 0 && crumbs.length > 2 && 'hidden md:flex')}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />}
              {c.to && !last ? (
                <Link to={c.to} className="truncate text-muted hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="truncate font-medium text-ink">
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function IdentityMenu() {
  const { adapter, identities, actor, setActorId, signOut } = useSession()
  const { data } = useProject()
  const role = roleFor(data.project, actor?.id)
  const navigate = useNavigate()
  return (
    <DM.Root>
      <DM.Trigger className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface pr-2 pl-1 text-[13px] hover:bg-sunken" aria-label="Identity and role">
        <span className="flex size-6 items-center justify-center rounded bg-inverse text-[10px] font-semibold text-on-inverse">{initials(actor?.name ?? '?')}</span>
        <span className="hidden max-w-[160px] truncate font-medium text-ink sm:inline">{actor?.name}</span>
        <span className="hidden text-muted xl:inline">· {role ? ROLE_LABELS[role] : 'No access'}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 max-h-[70vh] w-[320px] overflow-y-auto rounded-lg border border-line bg-raised p-1.5 shadow-pop">
          {adapter.mode === 'demo' ? (
            <>
              <div className="px-2 pt-1.5 pb-2">
                <div className="eyebrow">Demo persona</div>
                <p className="mt-1 text-[12px] leading-snug text-muted">Switch personas to see role-based permissions. This is not authentication.</p>
              </div>
              {identities.map((p) => {
                const r = roleFor(data.project, p.id)
                return (
                  <DM.Item
                    key={p.id}
                    onSelect={() => {
                      setActorId(p.id)
                      if (!r) navigate('/')
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-sunken"
                  >
                    <span className="flex size-7 items-center justify-center rounded bg-sunken text-[10px] font-semibold text-ink-2">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {p.organization} · {r ? ROLE_LABELS[r] : 'Not on this project'}
                      </span>
                    </span>
                    {p.id === actor?.id && <Check className="size-4 text-accent" />}
                  </DM.Item>
                )
              })}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 py-2 text-[13px]">
                <UserRound className="size-4 text-muted" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{actor?.name}</span>
                  <span className="block text-[12px] text-muted">{role ? ROLE_LABELS[role] : 'No access'}</span>
                </span>
              </div>
              {signOut && (
                <DM.Item onSelect={signOut} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] outline-none data-[highlighted]:bg-sunken">
                  <LogOut className="size-4" /> Sign out
                </DM.Item>
              )}
            </>
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

export function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useProject()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const index = useMemo(() => searchIndex(data), [data])
  const hits = useMemo(() => search(index, q), [index, q])
  useEffect(() => {
    setActive(0)
  }, [q])
  useEffect(() => {
    if (!open) setQ('')
  }, [open])
  const go = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Search this project" size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, hits.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && hits[active]) go(hits[active].path)
            }}
            placeholder="Search sources, statements, themes, principles, drivers, decisions…"
            className="input pl-9"
            aria-label="Search query"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="search-results"
            aria-activedescendant={hits[active] ? `hit-${active}` : undefined}
          />
        </div>
        {q && hits.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No matches for “{q}”.</p>}
        <ul id="search-results" role="listbox" className="max-h-[55vh] space-y-0.5 overflow-y-auto scroll-thin">
          {hits.map((h, i) => (
            <li key={`${h.type}-${h.id}`} id={`hit-${i}`} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h.path)}
                className={cx('flex w-full items-start gap-3 rounded-md px-3 py-2 text-left', i === active ? 'bg-sunken' : '')}
              >
                <span className="w-16 shrink-0 pt-0.5 font-mono text-[11px] text-muted">{h.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[13.5px] font-medium text-ink">{h.title}</span>
                  <span className="text-[11.5px] text-muted">{NODE_TYPE_LABELS[h.type]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!q && <p className="text-[12.5px] text-muted">Tip: search by code, e.g. “DD-07” or “ST-017”.</p>}
      </div>
    </Dialog>
  )
}
