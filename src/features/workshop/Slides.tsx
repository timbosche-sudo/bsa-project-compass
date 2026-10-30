import { Check, Lock } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useProject } from '@/app/project'
import { cx } from '@/components/ui'
import { APPROVAL_LABELS, CATEGORY_LABELS } from '@/domain/labels'
import { evidenceFor } from '@/domain/traceability'
import type { ApprovalStatus, GuidingPrinciple, ProjectData, WinTheme, WorkshopSession } from '@/domain/types'
import type { FrameworkKind } from '@/domain/workshop'
import { InlineField } from './InlineField'
import { drafts, useWorkshopActions, type EditableField } from './state'

export type Mode = 'present' | 'edit'

export interface SlideDef {
  key: string
  kind: 'title' | 'winTheme' | 'overview' | 'principle' | 'summary'
  id?: string
  label: string
}

export interface DeckOptions {
  showStatus: boolean
  hideNotAdopted: boolean
}

export function buildSlides(data: ProjectData, opts: DeckOptions): SlideDef[] {
  const keep = (s: ApprovalStatus) => s !== 'superseded' && !(opts.hideNotAdopted && s === 'not_adopted')
  const wts = data.winThemes.filter((w) => keep(w.status))
  const principles = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => keep(p.status))
  return [
    { key: 'title', kind: 'title', label: 'Title' },
    ...wts.map((w) => ({ key: `winTheme:${w.id}`, kind: 'winTheme' as const, id: w.id, label: `${w.code} ${w.statement}` })),
    { key: 'overview', kind: 'overview', label: `${data.project.terminology.guidingPrinciple}s` },
    ...principles.map((p) => ({ key: `principle:${p.id}`, kind: 'principle' as const, id: p.id, label: `${p.code} ${p.title}` })),
    { key: 'summary', kind: 'summary', label: 'Outcomes' },
  ]
}

// Fixed presentation palette: slides look the same in light or dark app themes.
const S = { ink: '#0B0D0F', paper: '#FFFFFF', accent: '#0B8FA1', cyan: '#22C3D6', muted: '#5F656B', line: '#E2E2DE' }

const STATUS_STYLE: Record<ApprovalStatus, { bg: string; fg: string }> = {
  proposed: { bg: '#EEEEEB', fg: '#3A3F45' },
  in_review: { bg: '#E5ECFB', fg: '#2A5BD7' },
  needs_refinement: { bg: '#FBF0D9', fg: '#8A5700' },
  approved: { bg: '#E3F3EA', fg: '#1D7A50' },
  not_adopted: { bg: '#FAE3E1', fg: '#B3261E' },
  superseded: { bg: '#EEEEEB', fg: '#62686F' },
}

/** 16:9 stage that letterboxes into whatever space it is given. */
export function SlideStage({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      const w = Math.min(width, (height * 16) / 9)
      setSize({ w, h: (w * 9) / 16 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={outer} className={cx('flex min-h-0 min-w-0 items-center justify-center', className)}>
      <div className="@container relative overflow-hidden shadow-pop" style={{ width: size.w, height: size.h, background: S.paper, color: S.ink, fontFamily: 'var(--font-sans)' }} data-testid="slide-stage">
        {size.w > 0 && children}
      </div>
    </div>
  )
}

export function StatusPill({ status, dark }: { status: ApprovalStatus; dark?: boolean }) {
  const st = STATUS_STYLE[status]
  return (
    <span className="inline-flex items-center gap-[0.4cqw] rounded-full px-[0.9cqw] py-[0.25cqw] text-[1.05cqw] font-semibold whitespace-nowrap" style={dark ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { background: st.bg, color: st.fg }}>
      {status === 'approved' && <Check style={{ width: '1.1cqw', height: '1.1cqw' }} />}
      {APPROVAL_LABELS[status]}
    </span>
  )
}

interface SlideProps {
  slide: SlideDef
  mode: Mode
  index: number
  total: number
  opts: DeckOptions
  session: WorkshopSession | null
}

export function Slide(props: SlideProps) {
  switch (props.slide.kind) {
    case 'title':
      return <TitleSlide {...props} />
    case 'winTheme':
      return <WinThemeSlide {...props} />
    case 'overview':
      return <OverviewSlide {...props} />
    case 'principle':
      return <PrincipleSlide {...props} />
    case 'summary':
      return <SummarySlide {...props} />
  }
}

function Footer({ index, total, dark }: { index: number; total: number; dark?: boolean }) {
  const { data } = useProject()
  return (
    <div className="absolute inset-x-[4cqw] bottom-[2.2cqw] flex items-end justify-between text-[0.95cqw]" style={{ color: dark ? 'rgba(255,255,255,0.55)' : S.muted }}>
      <span>
        <span className="font-semibold tracking-[0.12em]">BSA</span> · {data.project.name}
        {data.project.isDemo && <span style={{ color: dark ? '#F0875F' : '#B83A14' }}> · Synthetic demonstration data</span>}
      </span>
      <span className="tabular-nums">
        {index + 1} / {total}
      </span>
    </div>
  )
}

/** Static text in Present mode; presentation-styled inline editor in Edit mode. */
type EditableProps = { kind: FrameworkKind; item: WinTheme | GuidingPrinciple; field: EditableField; mode: Mode; label: string; placeholder?: string; singleLine?: boolean }

function Editable(props: EditableProps) {
  const { can } = useProject()
  const { item, field, mode, placeholder } = props
  const value = String((item as unknown as Record<string, string>)[field] ?? '')
  const editable = mode === 'edit' && can('framework.edit') && item.status !== 'approved' && item.status !== 'superseded'
  if (!editable) return <span className="whitespace-pre-wrap">{value || (mode === 'edit' ? <span style={{ opacity: 0.4 }}>{placeholder}</span> : null)}</span>
  return <EditableField {...props} value={value} />
}

/** Only mounted in Edit mode, inside the workshop editing providers. */
function EditableField({ kind, item, field, label, placeholder, singleLine, value }: EditableProps & { value: string }) {
  const { data } = useProject()
  const { saveField } = useWorkshopActions()
  return (
    <InlineField
      value={value}
      label={`${item.code} ${label}`}
      placeholder={placeholder}
      singleLine={singleLine}
      required={field === 'title' || field === 'statement'}
      draftKey={drafts.key(data.project.id, `${kind}:${item.id}:${field}`)}
      onSave={(next, before) => saveField(kind, item.id, field, next, before, `${item.code} ${label.toLowerCase()}`)}
    />
  )
}

function ApprovalStamp({ item, dark }: { item: WinTheme | GuidingPrinciple; dark?: boolean }) {
  const { data } = useProject()
  if (item.status !== 'approved' || !item.approval) return null
  const who = data.people.find((p) => p.id === item.approval!.approvedBy)?.name ?? 'Approver'
  return (
    <div className="mt-[1.6cqw] inline-flex items-center gap-[0.6cqw] rounded-[0.5cqw] border px-[1cqw] py-[0.5cqw] text-[1.05cqw]" style={{ borderColor: dark ? 'rgba(255,255,255,0.25)' : '#BFE3CF', color: dark ? '#9BE3C0' : '#1D7A50' }}>
      <Lock style={{ width: '1.1cqw', height: '1.1cqw' }} />
      Adopted wording · approved by {who} · {new Date(item.approval.approvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
    </div>
  )
}

function TitleSlide({ index, total, session }: SlideProps) {
  const { data } = useProject()
  const p = data.project
  return (
    <div className="absolute inset-0" style={{ background: S.ink, color: '#fff' }}>
      <div className="absolute top-[-14cqw] right-[-10cqw] size-[46cqw] rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <div className="absolute top-[-6cqw] right-[-3cqw] size-[28cqw] rounded-full border" style={{ borderColor: 'rgba(34,195,214,0.45)' }} />
      <div className="absolute top-[5cqw] left-[6cqw] text-[1.15cqw] font-bold tracking-[0.3em]" style={{ color: S.cyan }}>
        BSA PROJECT COMPASS
      </div>
      <div className="absolute bottom-[12cqw] left-[6cqw] max-w-[78cqw]">
        <div className="text-[1.6cqw] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {p.owner.name}
        </div>
        <h1 className="mt-[0.8cqw] text-[5.4cqw] leading-[1.03] font-semibold tracking-[-0.03em]">{p.name}</h1>
        <div className="mt-[2cqw] text-[2.2cqw] font-medium" style={{ color: S.cyan }}>
          Owner Alignment Workshop
        </div>
        {session && (
          <div className="mt-[0.6cqw] text-[1.4cqw]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {session.title} · {new Date(session.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
      <Footer index={index} total={total} dark />
    </div>
  )
}

function WinThemeSlide({ slide, mode, index, total, opts }: SlideProps) {
  const { data } = useProject()
  const w = data.winThemes.find((x) => x.id === slide.id)
  if (!w) return <Missing />
  const alternatives = data.winThemes.filter((x) => x.status !== 'superseded' && !(opts.hideNotAdopted && x.status === 'not_adopted'))
  const n = alternatives.findIndex((x) => x.id === w.id)
  return (
    <div className="absolute inset-0" style={{ background: S.ink, color: '#fff' }}>
      <div className="absolute top-[5cqw] left-[6cqw] flex items-center gap-[1.2cqw]">
        <span className="text-[1.15cqw] font-bold tracking-[0.3em]" style={{ color: S.cyan }}>
          {data.project.terminology.winTheme.toUpperCase()}
        </span>
        {alternatives.length > 1 && <span className="text-[1.15cqw]" style={{ color: 'rgba(255,255,255,0.6)' }}>Alternative {String.fromCharCode(65 + n)} of {alternatives.length}</span>}
        {opts.showStatus && <StatusPill status={w.status} dark />}
      </div>
      <div className="absolute top-[12cqw] left-[6cqw] w-[84cqw]">
        <div className="text-[5.6cqw] leading-[1.06] font-semibold tracking-[-0.03em]">
          <Editable kind="winTheme" item={w} field="statement" mode={mode} label="Win Theme statement" placeholder="Win Theme" />
        </div>
        <div className="mt-[2.4cqw] max-w-[70cqw] text-[1.75cqw] leading-[1.45]" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <Editable kind="winTheme" item={w} field="narrative" mode={mode} label="Win Theme narrative" placeholder="Supporting narrative" />
        </div>
        <ApprovalStamp item={w} dark />
      </div>
      <Footer index={index} total={total} dark />
    </div>
  )
}

function OverviewSlide({ index, total, opts }: SlideProps) {
  const { data } = useProject()
  const ps = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => p.status !== 'superseded' && !(opts.hideNotAdopted && p.status === 'not_adopted'))
  const cols = ps.length <= 4 ? 2 : ps.length <= 6 ? 3 : 4
  return (
    <div className="absolute inset-0 px-[6cqw] pt-[5cqw]">
      <div className="text-[1.15cqw] font-bold tracking-[0.3em]" style={{ color: S.accent }}>
        WHAT SUCCESS MUST LOOK LIKE
      </div>
      <h2 className="mt-[0.6cqw] text-[3.4cqw] font-semibold tracking-[-0.025em]">{data.project.terminology.guidingPrinciple}s</h2>
      <div className="mt-[2.4cqw] grid gap-[1.4cqw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {ps.map((p, i) => (
          <div key={p.id} className="rounded-[0.8cqw] border px-[1.5cqw] py-[1.3cqw]" style={{ borderColor: S.line, opacity: p.status === 'not_adopted' ? 0.45 : 1 }}>
            <div className="flex items-center justify-between gap-[0.6cqw]">
              <span className="font-mono text-[1.15cqw] font-semibold" style={{ color: S.accent }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {opts.showStatus && <StatusPill status={p.status} />}
            </div>
            <div className="mt-[0.7cqw] text-[1.9cqw] leading-[1.15] font-semibold tracking-[-0.015em]">{p.title}</div>
            <div className="mt-[0.5cqw] line-clamp-3 text-[1.15cqw] leading-[1.4]" style={{ color: S.muted }}>
              {p.statement}
            </div>
          </div>
        ))}
      </div>
      <Footer index={index} total={total} />
    </div>
  )
}

function PrincipleSlide({ slide, mode, index, total, opts }: SlideProps) {
  const { data } = useProject()
  const p = data.principles.find((x) => x.id === slide.id)
  if (!p) return <Missing />
  const active = [...data.principles].sort((a, b) => a.order - b.order).filter((x) => x.status !== 'superseded' && !(opts.hideNotAdopted && x.status === 'not_adopted'))
  const n = active.findIndex((x) => x.id === p.id) + 1
  const evidence = evidenceFor(data, { type: 'principle', id: p.id }).all.length
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-y-0 left-0 w-[0.8cqw]" style={{ background: p.status === 'approved' ? '#1D7A50' : S.accent }} />
      <div className="absolute top-[5cqw] right-[5cqw] left-[6cqw] flex items-center justify-between">
        <div className="flex items-center gap-[1.2cqw] text-[1.15cqw] font-bold tracking-[0.25em]" style={{ color: S.accent }}>
          <span>
            {data.project.terminology.guidingPrinciple.toUpperCase()} {String(n).padStart(2, '0')}
          </span>
          <span className="font-medium tracking-[0.1em]" style={{ color: S.muted }}>
            {CATEGORY_LABELS[p.category].toUpperCase()}
          </span>
        </div>
        {opts.showStatus && <StatusPill status={p.status} />}
      </div>
      <div className="absolute top-[11cqw] left-[6cqw] w-[80cqw]">
        <h2 className="text-[5cqw] leading-[1.05] font-semibold tracking-[-0.03em]">
          <Editable kind="principle" item={p} field="title" mode={mode} label="Title" placeholder="Principle title" singleLine />
        </h2>
        <div className="mt-[2cqw] text-[2.5cqw] leading-[1.32] font-medium tracking-[-0.01em]">
          <Editable kind="principle" item={p} field="statement" mode={mode} label="Statement" placeholder="What success must look like" />
        </div>
        <div className="mt-[1.8cqw] max-w-[70cqw] text-[1.45cqw] leading-[1.5]" style={{ color: S.muted }}>
          <Editable kind="principle" item={p} field="intent" mode={mode} label="Intent" placeholder="Expanded intent (optional)" />
        </div>
        <ApprovalStamp item={p} />
      </div>
      {evidence > 0 && (
        <div className="absolute right-[5cqw] bottom-[5cqw] text-[1.05cqw]" style={{ color: S.muted }}>
          Grounded in {evidence} stakeholder and Owner statement{evidence === 1 ? '' : 's'}
        </div>
      )}
      <Footer index={index} total={total} />
    </div>
  )
}

function SummarySlide({ index, total, opts }: SlideProps) {
  const { data } = useProject()
  const items = [
    ...data.winThemes.filter((w) => w.status !== 'superseded').map((w) => ({ code: w.code, title: w.statement, status: w.status })),
    ...[...data.principles].sort((a, b) => a.order - b.order).filter((p) => p.status !== 'superseded').map((p) => ({ code: p.code, title: p.title, status: p.status })),
  ].filter((i) => !(opts.hideNotAdopted && i.status === 'not_adopted'))
  const groups: { label: string; statuses: ApprovalStatus[] }[] = [
    { label: 'Adopted', statuses: ['approved'] },
    { label: 'In discussion', statuses: ['in_review', 'proposed'] },
    { label: 'Needs refinement', statuses: ['needs_refinement'] },
    { label: 'Not adopted', statuses: ['not_adopted'] },
  ]
  return (
    <div className="absolute inset-0 px-[6cqw] pt-[5cqw]">
      <div className="text-[1.15cqw] font-bold tracking-[0.3em]" style={{ color: S.accent }}>
        WORKSHOP OUTCOMES
      </div>
      <h2 className="mt-[0.6cqw] text-[3.4cqw] font-semibold tracking-[-0.025em]">Where we landed</h2>
      <div className="mt-[2.4cqw] grid grid-cols-4 gap-[1.6cqw]">
        {groups.map((g) => {
          const xs = items.filter((i) => g.statuses.includes(i.status))
          return (
            <div key={g.label}>
              <div className="flex items-baseline justify-between border-b pb-[0.6cqw]" style={{ borderColor: S.line }}>
                <span className="text-[1.4cqw] font-semibold">{g.label}</span>
                <span className="text-[2.4cqw] font-semibold tabular-nums">{xs.length}</span>
              </div>
              <ul className="mt-[0.8cqw] space-y-[0.6cqw]">
                {xs.map((i) => (
                  <li key={i.code} className="text-[1.15cqw] leading-[1.35]">
                    <span className="font-mono" style={{ color: S.muted }}>
                      {i.code}
                    </span>{' '}
                    {i.title}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <Footer index={index} total={total} />
    </div>
  )
}

function Missing() {
  return <div className="absolute inset-0 flex items-center justify-center text-[2cqw]" style={{ color: S.muted }}>This item is no longer in the project.</div>
}
