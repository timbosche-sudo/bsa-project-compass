import { EyeOff, MonitorPlay } from 'lucide-react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { Button, Callout, Card, cx, PageHeader } from '@/components/ui'
import { HEARD_SECTION_LABELS } from '@/domain/labels'
import { isActiveFramework } from '@/domain/wording'
import { buildSlides, CHAPTERS, DEFAULT_DECK, presentableHeard, presentableOutcomes, type Chapter } from '@/features/workshop/Slides'

/** The Owner presentation at a glance: what each chapter will show, and what is held back. */
export default function PresentationPage() {
  const { data, can, run } = useProject()
  const base = `/projects/${data.project.id}`
  const slides = buildSlides(data, DEFAULT_DECK)
  const heldBack = {
    heard: data.heard.filter((h) => !h.inPresentation || !h.reviewed).length,
    opportunities: data.opportunities.filter((o) => !o.inPresentation).length,
    outcomes: data.outcomes.filter((o) => !o.inPresentation).length,
  }
  const principles = [...data.principles].sort((a, b) => a.order - b.order).filter((p) => isActiveFramework(p.status) && p.status !== 'not_adopted')
  const vision = data.winThemes.filter((w) => isActiveFramework(w.status) && w.status !== 'not_adopted')
  const outcomes = presentableOutcomes(data)

  const chapter = (n: Chapter, body: React.ReactNode, editTo: string, count: number) => (
    <Card key={n} className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[13px] text-muted">{String(n).padStart(2, '0')}</span>
          <h2 className="text-[18px] font-black">{CHAPTERS[n].title}</h2>
          <span className="text-[12.5px] text-muted">{count} slide{count === 1 ? '' : 's'}</span>
        </div>
        <Link to={`${base}/${editTo}`} className="text-[13px] font-medium underline decoration-accent decoration-2 underline-offset-4">
          Edit content
        </Link>
      </div>
      <p className="mt-1 text-[13px] text-muted">{CHAPTERS[n].purpose}</p>
      <div className="mt-4">{body}</div>
    </Card>
  )
  const count = (n: Chapter) => slides.filter((s) => s.chapter === n).length

  return (
    <div>
      <PageHeader
        title="Owner Presentation"
        description="A four-chapter story that begins with what BSA heard and leads with its recommendation. Only reviewed items marked for the presentation appear; analysis, evidence tables and internal notes stay in the Studio."
        actions={
          <Link to={`${base}/workshop`}>
            <Button variant="primary" icon={<MonitorPlay className="size-4" />}>
              Open presentation
            </Button>
          </Link>
        }
      />
      <div className="space-y-4">
        {chapter(
          1,
          <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {Object.entries(HEARD_SECTION_LABELS).map(([sec, label]) => {
              const xs = presentableHeard(data, sec as never)
              return (
                <li key={sec} className={cx(!xs.length && 'text-muted')}>
                  <div className="eyebrow">{label}</div>
                  <p className="text-[13px] text-ink-2">{xs.length ? xs.map((h) => h.title).join(' · ') : 'Nothing marked for the presentation — no slide.'}</p>
                </li>
              )
            })}
          </ul>,
          'understand/heard',
          count(1),
        )}
        {chapter(
          2,
          <div className="space-y-2 text-[13px]">
            <p>
              <span className="eyebrow mr-2">Point of view</span>
              {data.pointOfView?.centralAmbition || <span className="text-muted">Not written — no slide.</span>}
            </p>
            {vision.map((w) => (
              <p key={w.id}>
                <span className="eyebrow mr-2">{w.code}</span>
                <span className="font-semibold">{w.statement}</span>
              </p>
            ))}
          </div>,
          'interpret/point-of-view',
          count(2),
        )}
        {chapter(
          3,
          <ol className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
            {principles.map((p) => {
              const opps = data.opportunities.filter((o) => o.inPresentation && o.principleIds.includes(p.id)).slice(0, 2)
              return (
                <li key={p.id}>
                  <span className="font-mono text-[11px] text-muted">{p.code}</span> <span className="font-semibold">{p.title}</span>
                  <span className="block text-[12px] text-muted">
                    {p.whyItMatters ? 'Why it matters' : 'No “why it matters” yet'} · {opps.length ? `Opportunities: ${opps.map((o) => o.title).join(', ')}` : 'No opportunities shown'}
                  </span>
                </li>
              )
            })}
          </ol>,
          'interpret/principles',
          count(3),
        )}
        {chapter(
          4,
          outcomes.length ? (
            <ul className="grid gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-2">
              {outcomes.slice(0, 8).map((o) => (
                <li key={o.id}>{o.statement}</li>
              ))}
              {outcomes.length > 8 && <li className="text-muted">{outcomes.length - 8} more are not shown — the slide keeps to eight.</li>}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No outcomes marked for the presentation — the chapter is left out.</p>
          ),
          'interpret/success',
          count(4),
        )}
        <Callout tone="neutral" icon={<EyeOff className="size-4" />}>
          Held back from the Owner: {heldBack.heard} What We Heard item(s) not reviewed or not selected, {heldBack.opportunities} design opportunit{heldBack.opportunities === 1 ? 'y' : 'ies'}, {heldBack.outcomes} potential outcome(s).
          {' '}The deck also includes a discussion slide and a live “where we are aligned” slide.
        </Callout>
        {can('framework.edit') && !data.directions.some((d) => d.state === 'bsa_proposed') && (
          <Callout tone="info" title="Save the direction before you present">
            Saving a version keeps what BSA proposed recoverable after the conversation changes it. Starting a workshop session also saves one automatically.{' '}
            <button className="underline" onClick={() => run({ type: 'direction.snapshot', label: 'Prepared for the Owner', state: 'bsa_proposed', sessionId: null, note: '' }, 'Direction saved')}>
              Save now
            </button>
          </Callout>
        )}
      </div>
    </div>
  )
}
