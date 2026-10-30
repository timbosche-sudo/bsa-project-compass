import { Maximize } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useProject } from '@/app/project'
import { buildSlides, Slide, SlideStage, type DeckOptions } from './Slides'
import { workshopChannel, type ChannelMessage } from './WorkshopPage'

/**
 * Audience window: presentation only, no facilitator controls or notes.
 * Follows the facilitator's slide (same browser, via BroadcastChannel) and
 * re-renders as soon as edits are saved.
 */
export default function AudiencePage() {
  const { projectId = '' } = useParams()
  const { data } = useProject()
  const [key, setKey] = useState<string | null>(null)
  const [opts, setOpts] = useState<DeckOptions>({ showStatus: true, hideNotAdopted: false })
  const [hint, setHint] = useState(true)

  useEffect(() => {
    document.title = `${data.project.name} — Audience`
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(workshopChannel(projectId))
    ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
      if (e.data.type === 'slide') {
        setKey(e.data.key)
        setOpts(e.data.opts)
      }
    }
    ch.postMessage({ type: 'hello' } satisfies ChannelMessage)
    const bye = () => ch.postMessage({ type: 'audience-bye' } satisfies ChannelMessage)
    window.addEventListener('beforeunload', bye)
    return () => {
      bye()
      window.removeEventListener('beforeunload', bye)
      ch.close()
    }
  }, [projectId, data.project.name])

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 4000)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const slides = useMemo(() => buildSlides(data, opts), [data, opts])
  const index = Math.max(0, slides.findIndex((s) => s.key === key))
  const slide = slides[index]
  const live = data.workshops.find((w) => w.status === 'live') ?? null

  return (
    <div className="fixed inset-0 bg-black" onDoubleClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} data-testid="audience-view">
      <SlideStage className="h-full w-full">
        <Slide slide={slide} mode="present" index={index} total={slides.length} opts={opts} session={live} />
      </SlideStage>
      <div className={`pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] text-white/80 transition-opacity duration-700 ${hint ? 'opacity-100' : 'opacity-0'}`}>
        <Maximize className="size-3.5" /> Audience view · press F or double-click for full screen{key ? '' : ' · waiting for the facilitator…'}
      </div>
    </div>
  )
}
