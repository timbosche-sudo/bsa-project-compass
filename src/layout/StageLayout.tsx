import * as RD from '@radix-ui/react-dialog'
import { Lightbulb, Lock, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useProject } from '@/app/project'
import { SuggestionsPanel } from '@/components/SuggestionsPanel'
import { Button, cx, InStageContext } from '@/components/ui'
import type { AssistTask } from '@/services/ai'

export interface StageStep {
  to: string
  label: string
  hint?: string
}

export interface StageDef {
  number?: string
  name: string
  purpose: string
  steps: StageStep[]
  /** Rules-based tasks available in this stage's Thinking Partner. */
  tasks?: AssistTask[]
  /** Model-only capabilities, shown disabled so the team knows what an approved provider would add. */
  modelOnly?: string[]
}

/**
 * A stage (Understand, Interpret, More) — a slim header with the stage purpose,
 * step navigation and an optional Thinking Partner drawer. Pages inside render
 * compact headers so the stage, not the page, frames the work.
 */
export function StageLayout({ stage }: { stage: StageDef }) {
  const { data } = useProject()
  const [partner, setPartner] = useState(false)
  const base = `/projects/${data.project.id}`
  return (
    <div>
      <div className="mb-6 border-b border-line">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <div className="eyebrow flex items-center gap-2">
              {stage.number && <span className="font-mono text-ink">{stage.number}</span>}
              <span>{stage.name}</span>
            </div>
            <p className="mt-1 max-w-3xl text-[13px] text-muted">{stage.purpose}</p>
          </div>
          {stage.tasks && (
            <Button size="sm" icon={<Lightbulb className="size-4" />} onClick={() => setPartner(true)} aria-haspopup="dialog">
              Thinking Partner
            </Button>
          )}
        </div>
        <nav aria-label={`${stage.name} steps`} className="-mb-px flex gap-1 overflow-x-auto scroll-thin">
          {stage.steps.map((s, i) => (
            <NavLink
              key={s.to}
              to={`${base}/${s.to}`}
              title={s.hint}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors',
                  isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
                )
              }
            >
              {stage.number && <span className="font-mono text-[10.5px] opacity-60 tabular-nums">{i + 1}</span>}
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <InStageContext.Provider value>
        <Outlet />
      </InStageContext.Provider>
      {stage.tasks && <ThinkingPartner open={partner} onOpenChange={setPartner} tasks={stage.tasks} modelOnly={stage.modelOnly ?? []} />}
    </div>
  )
}

function ThinkingPartner({ open, onOpenChange, tasks, modelOnly }: { open: boolean; onOpenChange: (o: boolean) => void; tasks: AssistTask[]; modelOnly: string[] }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <RD.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(460px,100vw)] flex-col border-l border-line bg-canvas shadow-pop">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <RD.Title className="text-[16px] font-semibold text-ink">Thinking Partner</RD.Title>
              <RD.Description className="mt-1 text-[12.5px] text-muted">Questions and observations to sharpen the team’s thinking. It proposes; people decide.</RD.Description>
            </div>
            <RD.Close className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Close Thinking Partner">
              <X className="size-4" />
            </RD.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scroll-thin">
            <SuggestionsPanel tasks={tasks} />
            {modelOnly.length > 0 && <ModelOnly items={modelOnly} />}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}

export function ModelOnly({ items, children }: { items: string[]; children?: ReactNode }) {
  return (
    <section aria-label="Capabilities that require an approved AI provider" className="rounded-lg border border-dashed border-line-strong p-4">
      <div className="eyebrow mb-2">Requires an approved AI provider</div>
      {children ?? <p className="mb-3 text-[12.5px] text-muted">No AI model is connected. These capabilities stay off until BSA approves a provider for this project’s data classification.</p>}
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i}>
            <button type="button" disabled className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-[13px] text-muted opacity-70" aria-disabled>
              <Lock className="size-3.5 shrink-0" />
              <span className="flex-1">{i}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
