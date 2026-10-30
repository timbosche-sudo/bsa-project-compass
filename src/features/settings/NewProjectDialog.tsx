import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '@/app/session'
import { Dialog } from '@/components/Dialog'
import { Button, Callout, Field, Input, optionsFrom, Select } from '@/components/ui'
import { PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import type { Phase, Sector } from '@/domain/types'

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { adapter, actor } = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', code: '', sector: 'healing' as Sector, phase: 'strategy' as Phase, ownerName: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await adapter.createProject(form, actor!.id)
      await qc.invalidateQueries({ queryKey: ['projects'] })
      onOpenChange(false)
      setForm({ name: '', code: '', sector: 'healing', phase: 'strategy', ownerName: '' })
      navigate(`/projects/${created.id}/settings`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="You become the Project Administrator and can invite the team in Project Settings."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!form.name.trim() || !form.code.trim() || !form.ownerName.trim()} onClick={submit}>
            Create project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {adapter.mode === 'demo' && (
          <Callout tone="warn" title="Demo sandbox project">
            Demo mode stores data only in this browser and is not secure. Use fictional content only. Real projects must be created in the secure deployment.
          </Callout>
        )}
        <Field label="Project name" required>
          {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project code" required hint="Letters, numbers and dashes">
            {(id) => <Input id={id} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={24} />}
          </Field>
          <Field label="Owner organization" required>
            {(id) => <Input id={id} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} maxLength={200} />}
          </Field>
          <Field label="Sector">
            {(id) => <Select id={id} value={form.sector} onChange={(e) => set('sector', e.target.value as Sector)} options={optionsFrom(SECTOR_LABELS)} />}
          </Field>
          <Field label="Current phase">
            {(id) => <Select id={id} value={form.phase} onChange={(e) => set('phase', e.target.value as Phase)} options={optionsFrom(PHASE_LABELS)} />}
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}
