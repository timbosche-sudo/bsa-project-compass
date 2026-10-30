import { Check, Lock } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useProject } from '@/app/project'
import { BSA } from '@/brand/brand'
import { BsaLogo, BsaRedBox } from '@/brand/BsaLogo'
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

/**
 * Fixed presentation palette from the BSA Brand Style Guide 2026: white or
 * black backgrounds, black/white text, teal and red as restrained accents.
 * Slides look the same regardless of the app's light/dark appearance.
 */
const S = { ink: BSA.black, paper: BSA.white, muted: BSA.black80, faint: BSA.black50, line: BSA.black10, teal: BSA.teal, red: BSA.red }

/** Status: 20% screen of a palette color behind black text, with a solid dot. */
const STATUS_STYLE: Record<ApprovalStatus, { bg: string; dot: string }> = {
  proposed: { bg: BSA.grey20, dot: BSA.black50 },
  in_review: { bg: '#dce5f1', dot: BSA.lightBlue },
  needs_refinement: { bg: '#fff1e0', dot: BSA.yellow },
  approved: { bg: '#d5f0e3', dot: BSA.green },
  not_adopted: { bg: '#f5d1d5', dot: BSA.red },
  superseded: { bg: BSA.grey20, dot: BSA.black50 },
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
      <div className="@container relative overflow-hidden shadow-pop" style={{ width: size.w, height: size.h, background: S.paper, color: S.ink, fontFamily: 'var(--bsa-font)' }} data-testid="slide-stage">
        {size.w > 0 && children}
      </div>
    </div>
  )
}

export function StatusPill({ status, dark }: { status: ApprovalStatus; dark?: boolean }) {
  const st = STATUS_STYLE[status]
  return (
    <span
      className="inline-flex items-center gap-[0.55cqw] rounded-full px-[1cqw] py-[0.3cqw] text-[1.05cqw] font-bold whitespace-nowrap"
      style={dark ? { background: 'rgba(255,255,255,0.1)', color: S.paper } : { background: st.bg, color: S.ink }}
    >
      {status === 'approved' ? <Check style={{ width: '1.1cqw', height: '1.1cqw', color: dark ? BSA.green : '#165b3a' }} /> : <span className="rounded-full" style={{ width: '0.6cqw', height: '0.6cqw', background: st.dot }} />}
      {APPROVAL_LABELS[status]}
    </span>
  )
}

/** ALL CAPS title: Lato Black, 100 tracking. */
function Caps({ children, dark, muted }: { children: ReactNode; dark?: boolean; muted?: boolean }) {
  return (
    <span className={cx('text-[1.15cqw] tracking-[0.1em] uppercase', muted ? 'font-normal' : 'font-black')} style={{ color: dark ? (muted ? 'rgba(255,255,255,0.8)' : S.paper) : muted ? S.muted : S.ink }}>
      {children}
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

/** Official logo bottom-left with clear space; page reference bottom-right, as in BSA documents. */
function Footer({ index, total, dark }: { index: number; total: number; dark?: boolean }) {
  const { data } = useProject()
  return (
    <div className="absolute inset-x-[4.5cqw] bottom-[2.6cqw] flex items-end justify-between text-[0.95cqw]" style={{ color: dark ? 'rgba(255,255,255,0.8)' : S.muted }}>
      <BsaLogo variant={dark ? 'white' : 'red'} height="2.2cqw" clearSpace={false} />
      <span className="flex items-center gap-[1.2cqw]">
        {data.project.isDemo && <span>Synthetic demonstration data</span>}
        <span>{data.project.name}</span>
        <span className="tabular-nums">
          {index + 1} | {total}
        </span>
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
    <div className="mt-[2cqw] inline-flex items-center gap-[0.7cqw] border-t pt-[0.9cqw] text-[1.1cqw]" style={{ borderColor: dark ? S.paper : S.ink, color: dark ? S.paper : S.ink }}>
      <Lock style={{ width: '1.1cqw', height: '1.1cqw' }} />
      <span className="font-black tracking-[0.1em] uppercase">Adopted wording</span>
      <span>
        approved by {who} · {new Date(item.approval.approvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  )
}

/** Header band used on content slides: caps title, optional detail and status, then a 1pt division line. */
function Header({ title, detail, status, dark }: { title: ReactNode; detail?: ReactNode; status?: ReactNode; dark?: boolean }) {
  return (
    <div className="absolute top-[4.5cqw] right-[4.5cqw] left-[6cqw]">
      <div className="flex items-center justify-between gap-[1.5cqw] pb-[1.2cqw]">
        <div className="flex items-center gap-[1.4cqw]">
          <Caps dark={dark}>{title}</Caps>
          {detail && <Caps dark={dark} muted>{detail}</Caps>}
        </div>
        {status}
      </div>
      <div style={{ height: 1, background: dark ? S.paper : S.ink }} />
    </div>
  )
}

function TitleSlide({ index, total, session }: SlideProps) {
  const { data } = useProject()
  const p = data.project
  return (
    <div className="absolute inset-0" style={{ background: S.ink, color: S.paper }}>
      {/* Red-box logo, centered, touching the top edge (Brand Style Guide p. 13). */}
      <BsaRedBox height="4.4cqw" edge="top" />
      <div className="absolute right-[8cqw] bottom-[11cqw] left-[8cqw] text-center">
        <Caps dark muted>
          {p.owner.name}
        </Caps>
        <h1 className="mt-[1.4cqw] text-[5.2cqw] leading-[1.08] font-black">{p.name}</h1>
        <div className="mx-auto mt-[2.2cqw] mb-[2cqw] h-px w-[10cqw]" style={{ background: S.paper }} />
        <div className="text-[1.9cqw] font-black tracking-[0.1em] uppercase">Owner Alignment Workshop</div>
        {session && (
          <div className="mt-[0.8cqw] text-[1.45cqw]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {session.title} · {new Date(session.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
      <div className="absolute inset-x-[4.5cqw] bottom-[2.6cqw] flex justify-between text-[0.95cqw]" style={{ color: 'rgba(255,255,255,0.8)' }}>
        <span>{data.project.isDemo ? 'Synthetic demonstration data' : ''}</span>
        <span className="tabular-nums">
          {index + 1} | {total}
        </span>
      </div>
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
    <div className="absolute inset-0" style={{ background: S.ink, color: S.paper }}>
      <Header dark title={data.project.terminology.winTheme} detail={alternatives.length > 1 ? `Alternative ${String.fromCharCode(65 + n)} of ${alternatives.length}` : undefined} status={opts.showStatus ? <StatusPill status={w.status} dark /> : undefined} />
      <div className="absolute top-[13.5cqw] left-[6cqw] w-[82cqw]">
        <div className="text-[5.8cqw] leading-[1.08] font-black">
          <Editable kind="winTheme" item={w} field="statement" mode={mode} label="Win Theme statement" placeholder="Win Theme" />
        </div>
        <div className="mt-[2.6cqw] max-w-[66cqw] text-[1.8cqw] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.8)' }}>
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
    <div className="absolute inset-0">
      <Header title="What success must look like" detail={`${ps.length} ${data.project.terminology.guidingPrinciple}s`} />
      <h2 className="absolute top-[10.5cqw] left-[6cqw] text-[3.4cqw] font-black">{data.project.terminology.guidingPrinciple}s</h2>
      <div className="absolute top-[17cqw] right-[4.5cqw] left-[6cqw] grid gap-x-[2.4cqw] gap-y-[2.2cqw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {ps.map((p, i) => (
          <div key={p.id} className="border-t pt-[1.1cqw]" style={{ borderColor: S.ink, opacity: p.status === 'not_adopted' ? 0.45 : 1 }}>
            <div className="flex items-center justify-between gap-[0.6cqw]">
              <span className="text-[1.3cqw] font-black tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              {opts.showStatus && <StatusPill status={p.status} />}
            </div>
            <div className="mt-[0.8cqw] text-[1.95cqw] leading-[1.15] font-black">{p.title}</div>
            <div className="mt-[0.6cqw] line-clamp-3 text-[1.2cqw] leading-[1.45]" style={{ color: S.muted }}>
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
      <Header title={`${data.project.terminology.guidingPrinciple} ${String(n).padStart(2, '0')}`} detail={CATEGORY_LABELS[p.category]} status={opts.showStatus ? <StatusPill status={p.status} /> : undefined} />
      <div className="absolute top-[12cqw] left-[6cqw] w-[80cqw]">
        <h2 className="text-[5.2cqw] leading-[1.06] font-black">
          <Editable kind="principle" item={p} field="title" mode={mode} label="Title" placeholder="Principle title" singleLine />
        </h2>
        <div className="mt-[2.2cqw] text-[2.5cqw] leading-[1.35]">
          <Editable kind="principle" item={p} field="statement" mode={mode} label="Statement" placeholder="What success must look like" />
        </div>
        <div className="mt-[1.8cqw] max-w-[68cqw] text-[1.45cqw] leading-[1.55]" style={{ color: S.muted }}>
          <Editable kind="principle" item={p} field="intent" mode={mode} label="Intent" placeholder="Expanded intent (optional)" />
        </div>
        <ApprovalStamp item={p} />
      </div>
      {evidence > 0 && (
        <div className="absolute right-[4.5cqw] bottom-[6cqw] text-[1.05cqw]" style={{ color: S.muted }}>
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
  const groups: { label: string; statuses: ApprovalStatus[]; dot: string }[] = [
    { label: 'Adopted', statuses: ['approved'], dot: BSA.green },
    { label: 'In discussion', statuses: ['in_review', 'proposed'], dot: BSA.lightBlue },
    { label: 'Needs refinement', statuses: ['needs_refinement'], dot: BSA.yellow },
    { label: 'Not adopted', statuses: ['not_adopted'], dot: BSA.red },
  ]
  return (
    <div className="absolute inset-0">
      <Header title="Workshop outcomes" />
      <h2 className="absolute top-[10.5cqw] left-[6cqw] text-[3.4cqw] font-black">Where we landed</h2>
      <div className="absolute top-[17cqw] right-[4.5cqw] left-[6cqw] grid grid-cols-4 gap-[2.4cqw]">
        {groups.map((g) => {
          const xs = items.filter((i) => g.statuses.includes(i.status))
          return (
            <div key={g.label}>
              <div className="flex items-end justify-between border-b pb-[0.7cqw]" style={{ borderColor: S.ink }}>
                <span className="flex items-center gap-[0.6cqw] text-[1.15cqw] font-black tracking-[0.1em] uppercase">
                  <span className="rounded-full" style={{ width: '0.8cqw', height: '0.8cqw', background: g.dot }} />
                  {g.label}
                </span>
                <span className="text-[2.6cqw] leading-none font-black tabular-nums">{xs.length}</span>
              </div>
              <ul className="mt-[1cqw] space-y-[0.7cqw]">
                {xs.map((i) => (
                  <li key={i.code} className="text-[1.2cqw] leading-[1.35]">
                    <span className="font-bold" style={{ color: S.muted }}>
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
