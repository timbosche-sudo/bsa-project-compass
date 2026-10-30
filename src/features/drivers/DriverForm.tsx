import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProject } from '@/app/project'
import { Dialog } from '@/components/Dialog'
import { Button, Callout, Field, Input, optionsFrom, Segmented, Select, Textarea } from '@/components/ui'
import { driverPrincipleIds } from '@/domain/drivers'
import { PHASE_LABELS, REQUIREMENT_CLASS_LABELS } from '@/domain/labels'
import type { DesignDriver, DriverContent, Phase, RequirementClass } from '@/domain/types'

const EMPTY: DriverContent = {
  title: '',
  description: '',
  intendedOutcome: '',
  scope: 'facility',
  requirementClass: 'team_proposed',
  ownerTerm: '',
  measure: { kind: 'qualitative', unit: '', methodology: '', baseline: null, target: null, targetStatus: 'not_set', acceptanceCriteria: '', current: null, currentAsOf: null },
  ownerPersonId: null,
  ownerOrganization: '',
  phase: 'design_development',
  targetDate: null,
  validationMethod: '',
  risks: [],
  dependencyIds: [],
}

function contentOf(d: DesignDriver): DriverContent {
  const { title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds } = d
  return structuredClone({ title, description, intendedOutcome, scope, requirementClass, ownerTerm, measure, ownerPersonId, ownerOrganization, phase, targetDate, validationMethod, risks, dependencyIds })
}

export function DriverFormDialog({ open, onOpenChange, driver, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; driver?: DesignDriver; onSaved?: (id: string) => void }) {
  const { data, run, pending } = useProject()
  const [form, setForm] = useState<DriverContent>(EMPTY)
  const [principleIds, setPrincipleIds] = useState<string[]>([])
  const [risks, setRisks] = useState('')
  const [note, setNote] = useState('')
  const locked = driver?.approvalStatus === 'approved'

  useEffect(() => {
    if (!open) return
    const c = driver ? contentOf(driver) : structuredClone(EMPTY)
    setForm(c)
    setRisks(c.risks.join('\n'))
    setPrincipleIds(driver ? driverPrincipleIds(data, driver.id) : [])
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, driver])

  const set = <K extends keyof DriverContent>(k: K, v: DriverContent[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setM = <K extends keyof DriverContent['measure']>(k: K, v: DriverContent['measure'][K]) => setForm((f) => ({ ...f, measure: { ...f.measure, [k]: v } }))
  const blankToNull = (s: string) => (s.trim() === '' ? null : s)

  const save = async () => {
    const content: DriverContent = { ...form, risks: risks.split('\n').map((r) => r.trim()).filter(Boolean) }
    if (driver) {
      const ok = await run({ type: 'driver.edit', id: driver.id, content, note }, 'Driver saved as a new version')
      if (ok !== undefined) onOpenChange(false)
    } else {
      const id = await run({ type: 'driver.create', content, principleIds }, 'Driver proposed')
      if (id) {
        onOpenChange(false)
        onSaved?.(id)
      }
    }
  }

  const m = form.measure
  const people = data.project.members.map((mem) => data.people.find((p) => p.id === mem.personId)).filter(Boolean)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={driver ? `Edit ${driver.code}` : `New ${data.project.terminology.designDriver.toLowerCase()}`}
      description="Do not enter a numeric target unless a source supports it. Leave unknown values blank — they are shown as unknown, never guessed."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!form.title.trim()} onClick={save}>
            {driver ? 'Save new version' : 'Propose driver'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {locked && (
          <Callout tone="ok" icon={<Lock className="size-4 text-ok" />} title="Approved commitment is locked">
            Title, description, outcome, requirement class, measure and target can only change through a revision. Owner, schedule, validation, risks and dependencies remain editable.
          </Callout>
        )}
        <fieldset className="grid gap-4 md:grid-cols-2" disabled={locked}>
          <legend className="eyebrow mb-2 md:col-span-2">Commitment</legend>
          <Field label="Title" required className="md:col-span-2">
            {(id) => <Input id={id} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />}
          </Field>
          <Field label="Description" className="md:col-span-2">
            {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />}
          </Field>
          <Field label="Intended outcome" className="md:col-span-2">
            {(id) => <Textarea id={id} value={form.intendedOutcome} onChange={(e) => set('intendedOutcome', e.target.value)} rows={2} />}
          </Field>
          <Field label="Scope">
            {(id) => (
              <Select
                id={id}
                value={form.scope}
                onChange={(e) => set('scope', e.target.value as DriverContent['scope'])}
                options={[
                  { value: 'facility', label: 'Facility outcome' },
                  { value: 'delivery', label: 'Project delivery' },
                ]}
              />
            )}
          </Field>
          <Field label="Owner requirement classification">
            {(id) => <Select id={id} value={form.requirementClass} onChange={(e) => set('requirementClass', e.target.value as RequirementClass)} options={optionsFrom(REQUIREMENT_CLASS_LABELS)} />}
          </Field>
          <Field label="Owner's original term (verbatim)" className="md:col-span-2" hint="Preserve the Owner's wording, e.g. the RFP phrase this driver answers.">
            {(id) => <Input id={id} value={form.ownerTerm} onChange={(e) => set('ownerTerm', e.target.value)} maxLength={200} />}
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={locked}>
          <legend className="eyebrow mb-2 md:col-span-2">Measure of success</legend>
          <div className="md:col-span-2">
            <Segmented
              label="Measure type"
              value={m.kind}
              onChange={(v) => !locked && setM('kind', v)}
              options={[
                { value: 'qualitative', label: 'Qualitative acceptance criteria' },
                { value: 'quantitative', label: 'Quantitative target' },
              ]}
            />
          </div>
          {m.kind === 'quantitative' ? (
            <>
              <Field label="Unit of measure">
                {(id) => <Input id={id} value={m.unit} onChange={(e) => setM('unit', e.target.value)} placeholder="e.g. hours of autonomous operation" />}
              </Field>
              <Field label="Baseline" hint="Blank = unknown">
                {(id) => <Input id={id} value={m.baseline ?? ''} onChange={(e) => setM('baseline', blankToNull(e.target.value))} />}
              </Field>
              <Field label="Target value" hint={driver ? 'Changing the target resets it to “awaiting approval”.' : 'Blank = not set. Targets require separate approval.'}>
                {(id) => <Input id={id} value={m.target ?? ''} onChange={(e) => setM('target', blankToNull(e.target.value))} />}
              </Field>
              <Field label="Measurement methodology" className="md:col-span-2">
                {(id) => <Textarea id={id} value={m.methodology} onChange={(e) => setM('methodology', e.target.value)} rows={2} />}
              </Field>
            </>
          ) : (
            <Field label="Acceptance criteria" className="md:col-span-2" hint="What evidence will show this condition of satisfaction has been met?">
              {(id) => <Textarea id={id} value={m.acceptanceCriteria} onChange={(e) => setM('acceptanceCriteria', e.target.value)} rows={3} />}
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="eyebrow mb-2 md:col-span-2">Accountability & validation</legend>
          <Field label="Accountable owner">
            {(id) => (
              <Select
                id={id}
                value={form.ownerPersonId ?? ''}
                onChange={(e) => {
                  const p = data.people.find((x) => x.id === e.target.value)
                  setForm((f) => ({ ...f, ownerPersonId: e.target.value || null, ownerOrganization: p ? p.organization : f.ownerOrganization }))
                }}
                options={[{ value: '', label: 'Unassigned' }, ...people.map((p) => ({ value: p!.id, label: `${p!.name} — ${p!.organization}` }))]}
              />
            )}
          </Field>
          <Field label="Responsible organization">
            {(id) => <Input id={id} value={form.ownerOrganization} onChange={(e) => set('ownerOrganization', e.target.value)} />}
          </Field>
          <Field label="Project phase">
            {(id) => <Select id={id} value={form.phase} onChange={(e) => set('phase', e.target.value as Phase)} options={optionsFrom(PHASE_LABELS)} />}
          </Field>
          <Field label="Target date">
            {(id) => <Input id={id} type="date" value={form.targetDate ?? ''} onChange={(e) => set('targetDate', e.target.value || null)} />}
          </Field>
          <Field label="Validation method" className="md:col-span-2">
            {(id) => <Textarea id={id} value={form.validationMethod} onChange={(e) => set('validationMethod', e.target.value)} rows={2} />}
          </Field>
          <Field label="Risks (one per line)">
            {(id) => <Textarea id={id} value={risks} onChange={(e) => setRisks(e.target.value)} rows={3} />}
          </Field>
          <Field label="Depends on">
            {() => (
              <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-md border border-line p-2 scroll-thin">
                {data.drivers
                  .filter((d) => d.id !== driver?.id && d.approvalStatus !== 'superseded')
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-[12.5px]">
                      <input type="checkbox" className="accent-[var(--c-accent)]" checked={form.dependencyIds.includes(d.id)} onChange={() => set('dependencyIds', form.dependencyIds.includes(d.id) ? form.dependencyIds.filter((x) => x !== d.id) : [...form.dependencyIds, d.id])} />
                      <span className="font-mono text-[11px] text-muted">{d.code}</span> {d.title}
                    </label>
                  ))}
              </div>
            )}
          </Field>
        </fieldset>

        {!driver && (
          <fieldset>
            <legend className="eyebrow mb-2">Implements guiding principles</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.principles
                .filter((p) => p.status !== 'superseded')
                .map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
                    <input type="checkbox" className="accent-[var(--c-accent)]" checked={principleIds.includes(p.id)} onChange={() => setPrincipleIds((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))} />
                    <span className="font-mono text-[11px] text-muted">{p.code}</span> {p.title}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        {driver && (
          <Field label="Change note">
            {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}
