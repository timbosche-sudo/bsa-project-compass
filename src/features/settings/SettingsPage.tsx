import { useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { formatDate } from '@/components/Collaboration'
import { Dialog, useConfirm } from '@/components/Dialog'
import { Badge, Button, Callout, Card, CardHeader, Field, IconButton, Input, optionsFrom, PageHeader, Select, Tabs, Textarea } from '@/components/ui'
import { CONFIDENTIALITY_LABELS, PHASE_LABELS, SECTOR_LABELS } from '@/domain/labels'
import { can as roleCan, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/domain/permissions'
import { CONFIDENTIALITY, ROLES, type Confidentiality, type Milestone, type Phase, type Role, type Sector, type Terminology } from '@/domain/types'

type Tab = 'profile' | 'team' | 'milestones' | 'ai' | 'audit'

export default function SettingsPage() {
  const { can } = useProject()
  const [tab, setTab] = useState<Tab>('profile')
  const tabs: { value: Tab; label: string }[] = [
    { value: 'profile', label: 'Profile & terminology' },
    { value: 'team', label: 'Team & roles' },
    { value: 'milestones', label: 'Milestones' },
    { value: 'ai', label: 'AI assistance' },
    ...(can('audit.read') ? [{ value: 'audit' as Tab, label: 'Audit log' }] : []),
  ]
  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Project Settings" description="Project profile, Owner, team permissions, terminology and AI policy. Changes are recorded in the audit log." />
      <Tabs label="Settings sections" value={tab} onChange={setTab} tabs={tabs} />
      <div className="mt-5">
        {tab === 'profile' && <ProfileSettings />}
        {tab === 'team' && <TeamSettings />}
        {tab === 'milestones' && <MilestoneSettings />}
        {tab === 'ai' && <AiSettings />}
        {tab === 'audit' && <AuditLog />}
      </div>
      <DemoControls />
    </div>
  )
}

function ProfileSettings() {
  const { data, can, run, pending } = useProject()
  const p = data.project
  const editable = can('project.configure')
  const [f, setF] = useState({ name: p.name, tagline: p.tagline, sector: p.sector, phase: p.phase, location: p.location, description: p.description, owner: { ...p.owner } })
  const [terms, setTerms] = useState<Terminology>(p.terminology)
  useEffect(() => {
    setF({ name: p.name, tagline: p.tagline, sector: p.sector, phase: p.phase, location: p.location, description: p.description, owner: { ...p.owner } })
    setTerms(p.terminology)
  }, [p])
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader title="Project and Owner profile" description={`Code ${p.code} · created ${formatDate(p.createdAt)}`} />
        <fieldset disabled={!editable} className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <Field label="Project name" required className="md:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Tagline" className="md:col-span-2">{(id) => <Input id={id} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />}</Field>
          <Field label="Sector">{(id) => <Select id={id} value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value as Sector })} options={optionsFrom(SECTOR_LABELS)} />}</Field>
          <Field label="Current phase">{(id) => <Select id={id} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as Phase })} options={optionsFrom(PHASE_LABELS)} />}</Field>
          <Field label="Location" className="md:col-span-2">{(id) => <Input id={id} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />}</Field>
          <Field label="Project description" className="md:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} />}</Field>
          <Field label="Owner organization" required>{(id) => <Input id={id} value={f.owner.name} onChange={(e) => setF({ ...f, owner: { ...f.owner, name: e.target.value } })} />}</Field>
          <Field label="Owner type">{(id) => <Input id={id} value={f.owner.type} onChange={(e) => setF({ ...f, owner: { ...f.owner, type: e.target.value } })} />}</Field>
          <Field label="Owner mission (verbatim)" className="md:col-span-2">{(id) => <Textarea id={id} value={f.owner.mission} onChange={(e) => setF({ ...f, owner: { ...f.owner, mission: e.target.value } })} rows={2} />}</Field>
          {editable && (
            <div className="md:col-span-2">
              <Button variant="primary" icon={<Save className="size-4" />} loading={pending} disabled={!f.name.trim() || !f.owner.name.trim()} onClick={() => run({ type: 'project.update', patch: f }, 'Profile saved')}>
                Save profile
              </Button>
            </div>
          )}
        </fieldset>
      </Card>
      <Card>
        <CardHeader title="Project terminology" description="Use the Owner's vocabulary. Underlying relationships stay the same." />
        <fieldset disabled={!editable} className="space-y-4 px-5 py-5">
          {(Object.keys(terms) as (keyof Terminology)[]).map((k) => (
            <Field key={k} label={{ winTheme: 'Win Theme', guidingPrinciple: 'Guiding Principle', designDriver: 'Design Driver', decision: 'Decision' }[k]}>
              {(id) => <Input id={id} value={terms[k]} onChange={(e) => setTerms({ ...terms, [k]: e.target.value })} />}
            </Field>
          ))}
          {editable && (
            <Button icon={<Save className="size-4" />} loading={pending} disabled={Object.values(terms).some((v) => !v.trim())} onClick={() => run({ type: 'project.update', patch: { terminology: terms } }, 'Terminology saved')}>
              Save terminology
            </Button>
          )}
        </fieldset>
      </Card>
    </div>
  )
}

function TeamSettings() {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const editable = can('project.manageMembers')
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader
          title="Project team"
          description="Permissions are enforced by the command handler and, in secure mode, by database row-level security."
          actions={
            editable && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
                Add person
              </Button>
            )
          }
        />
        <div className="overflow-x-auto scroll-thin" tabIndex={0} role="region" aria-label="Table (scrolls horizontally on narrow screens)">
          <table className="table-base min-w-[620px]">
            <thead>
              <tr>
                <th>Person</th>
                <th>Organization</th>
                <th>Role</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {data.project.members.map((m) => {
                const p = data.people.find((x) => x.id === m.personId)
                if (!p) return null
                return (
                  <tr key={m.personId}>
                    <td>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[12px] text-muted">{p.title}</div>
                    </td>
                    <td className="text-ink-2">{p.organization}</td>
                    <td>
                      {editable ? (
                        <Select aria-label={`Role for ${p.name}`} className="w-auto" value={m.role} onChange={(e) => run({ type: 'member.setRole', personId: p.id, role: e.target.value as Role }, `Role updated for ${p.name}`)} options={optionsFrom(ROLE_LABELS, ROLES.filter((r) => r !== 'system_admin'))} />
                      ) : (
                        <Badge tone="outline">{ROLE_LABELS[m.role]}</Badge>
                      )}
                    </td>
                    <td>
                      {editable && (
                        <IconButton
                          label={`Remove ${p.name}`}
                          onClick={async () => {
                            const r = await confirm({ title: `Remove ${p.name} from the project?`, body: 'They lose access to all project content immediately. Their past contributions remain attributed.', confirmLabel: 'Remove', tone: 'danger' })
                            if (r.confirmed) run({ type: 'member.setRole', personId: p.id, role: null }, `${p.name} removed`)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Roles" />
        <ul className="divide-y divide-line">
          {ROLES.map((r) => (
            <li key={r} className="px-5 py-2.5 text-[12.5px]">
              <div className="font-semibold text-ink">{ROLE_LABELS[r]}</div>
              <div className="text-muted">{ROLE_DESCRIPTIONS[r]}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roleCan(r, 'framework.approve') && <Badge tone="ok">Approves</Badge>}
                {roleCan(r, 'framework.edit') && <Badge tone="accent">Edits framework</Badge>}
                {roleCan(r, 'source.create') && <Badge tone="neutral">Adds sources</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <AddPersonDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function AddPersonDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useProject()
  const { adapter } = useSession()
  const [f, setF] = useState({ name: '', title: '', organization: '', email: '' })
  const [role, setRole] = useState<Role>('contributor')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a person"
      description={adapter.mode === 'demo' ? 'Demo mode: adds a fictional persona you can switch to. Use fictional names only.' : 'The person signs in through the organization identity provider.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!f.name.trim()} onClick={async () => { if ((await run({ type: 'person.add', person: f, role }, `${f.name} added`)) !== undefined) { onOpenChange(false); setF({ name: '', title: '', organization: '', email: '' }) } }}>
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
        <Field label="Organization">{(id) => <Input id={id} value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Role" className="sm:col-span-2">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)} options={optionsFrom(ROLE_LABELS, ROLES.filter((r) => r !== 'system_admin'))} />}</Field>
      </div>
    </Dialog>
  )
}

function MilestoneSettings() {
  const { data, can, run } = useProject()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null)
  const editable = can('driver.edit')
  const list = [...data.milestones].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <Card>
      <CardHeader title="Validation milestones" description="Milestones appear on the dashboard when they fall within the next 120 days." actions={editable && <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing('new')}>Add milestone</Button>} />
      <table className="table-base">
        <thead>
          <tr>
            <th>Date</th>
            <th>Milestone</th>
            <th>Phase</th>
            <th>Drivers validated</th>
            <th>Status</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap tabular-nums">{formatDate(m.date)}</td>
              <td className="font-medium">{m.name}</td>
              <td className="text-ink-2">{PHASE_LABELS[m.phase]}</td>
              <td className="font-mono text-[11.5px] text-muted">{m.driverIds.map((id) => data.drivers.find((d) => d.id === id)?.code).join(', ') || '—'}</td>
              <td>
                {editable ? (
                  <label className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" className="accent-[var(--c-accent)]" checked={m.complete} onChange={(e) => run({ type: 'milestone.upsert', milestone: { ...m, complete: e.target.checked } })} /> Complete
                  </label>
                ) : m.complete ? 'Complete' : 'Upcoming'}
              </td>
              <td className="whitespace-nowrap">
                {editable && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Edit</Button>
                    <IconButton label={`Delete ${m.name}`} onClick={async () => { const r = await confirm({ title: `Delete milestone "${m.name}"?`, confirmLabel: 'Delete', tone: 'danger' }); if (r.confirmed) run({ type: 'milestone.delete', id: m.id }, 'Milestone deleted') }}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="px-5 py-6 text-center text-[13px] text-muted">No milestones yet.</p>}
      <MilestoneDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} milestone={editing === 'new' ? undefined : (editing ?? undefined)} />
    </Card>
  )
}

function MilestoneDialog({ open, onOpenChange, milestone }: { open: boolean; onOpenChange: (o: boolean) => void; milestone?: Milestone }) {
  const { data, run, pending } = useProject()
  const [f, setF] = useState({ name: '', date: '', phase: data.project.phase as Phase, driverIds: [] as string[], complete: false })
  useEffect(() => {
    if (open) setF(milestone ? { name: milestone.name, date: milestone.date, phase: milestone.phase, driverIds: milestone.driverIds, complete: milestone.complete } : { name: '', date: '', phase: data.project.phase, driverIds: [], complete: false })
  }, [open, milestone, data.project.phase])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={milestone ? 'Edit milestone' : 'Add milestone'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!f.name.trim() || !f.date} onClick={async () => (await run({ type: 'milestone.upsert', milestone: { ...f, ...(milestone ? { id: milestone.id } : {}) } }, 'Milestone saved')) !== undefined && onOpenChange(false)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Date" required>{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Phase">{(id) => <Select id={id} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as Phase })} options={optionsFrom(PHASE_LABELS)} />}</Field>
        <div className="sm:col-span-2">
          <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">Drivers validated at this milestone</div>
          <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-md border border-line p-2 scroll-thin">
            {data.drivers.filter((d) => d.approvalStatus !== 'superseded').map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" className="accent-[var(--c-accent)]" checked={f.driverIds.includes(d.id)} onChange={() => setF({ ...f, driverIds: f.driverIds.includes(d.id) ? f.driverIds.filter((x) => x !== d.id) : [...f.driverIds, d.id] })} />
                <span className="font-mono text-[11px] text-muted">{d.code}</span> {d.title}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function AiSettings() {
  const { data, can, run, pending } = useProject()
  const { adapter } = useSession()
  const policy = data.project.aiPolicy
  const [enabled, setEnabled] = useState(policy.enabled)
  const [allowed, setAllowed] = useState<Confidentiality[]>(policy.allowedClassifications)
  const editable = can('project.configure')
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader title="AI assistance policy" description="AI is optional. Every core workflow works without it." />
        <fieldset disabled={!editable} className="space-y-5 px-5 py-5">
          <Callout tone={adapter.mode === 'demo' ? 'ai' : 'info'} title={adapter.mode === 'demo' ? 'Demo mode: no AI model is connected' : 'Server-side provider'}>
            {adapter.mode === 'demo'
              ? 'The assistant uses transparent, deterministic rules (keyword overlap and gap analysis). No project content leaves this browser.'
              : 'When enabled, requests go to the organization-approved provider through the secure backend. Provider credentials never reach the browser.'}
          </Callout>
          <label className="flex items-start gap-3 text-[13.5px]">
            <input type="checkbox" className="mt-1 accent-[var(--c-accent)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>
              <span className="font-medium">Allow the approved AI provider for this project</span>
              <span className="block text-[12.5px] text-muted">Requires the secure backend with an organization-approved model configured server-side.</span>
            </span>
          </label>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-ink-2">Source classifications the provider may process</div>
            <div className="flex flex-wrap gap-3">
              {CONFIDENTIALITY.map((c) => (
                <label key={c} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-[var(--c-accent)]" checked={allowed.includes(c)} onChange={() => setAllowed((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))} /> {CONFIDENTIALITY_LABELS[c]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">Content from other classifications is withheld from the model on the server.</p>
          </div>
          {editable && (
            <Button variant="primary" loading={pending} icon={<Save className="size-4" />} onClick={() => run({ type: 'project.setAiPolicy', enabled, allowedClassifications: allowed }, 'AI policy saved')}>
              Save policy
            </Button>
          )}
        </fieldset>
      </Card>
      <Card>
        <CardHeader title="Safeguards" />
        <ul className="list-disc space-y-2 py-4 pr-5 pl-9 text-[12.5px] text-ink-2">
          <li>Suggestions are stored as pending and change nothing until a person accepts them.</li>
          <li>Approved principles, targets and decisions cannot be modified by the assistant.</li>
          <li>Each suggestion lists its source references, or is labelled as an inference.</li>
          <li>Model output is schema-validated before it is shown or stored.</li>
          <li>Uploaded documents are treated as untrusted data; embedded instructions are never followed.</li>
          <li>No open proxy: the server exposes fixed tasks only, scoped to project members.</li>
        </ul>
      </Card>
    </div>
  )
}

function AuditLog() {
  const { data, personName } = useProject()
  const [q, setQ] = useState('')
  const rows = data.audit.filter((a) => !q || `${a.summary} ${a.action} ${personName(a.actorId)}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Card>
      <CardHeader title="Audit log" description="Every change is recorded with actor, time and action. In secure mode the log is append-only in the database." actions={<Input aria-label="Filter audit log" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56" />} />
      <div className="max-h-[65vh] overflow-auto scroll-thin">
        <table className="table-base">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap tabular-nums text-muted">{formatDate(a.at, true)}</td>
                <td className="whitespace-nowrap">{personName(a.actorId)}</td>
                <td className="font-mono text-[11.5px] text-muted">{a.action}</td>
                <td>{a.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function DemoControls() {
  const { adapter } = useSession()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const navigate = useNavigate()
  if (adapter.mode !== 'demo' || !adapter.resetDemo) return null
  return (
    <div className="mt-10 rounded-lg border border-dashed border-line-strong p-5">
      <h2 className="text-[14px] font-semibold">Demonstration data</h2>
      <p className="mt-1 text-[13px] text-muted">Restore the synthetic demonstration projects to their original state. Sandbox projects created in this browser are removed.</p>
      <Button
        className="mt-3"
        variant="danger"
        icon={<RotateCcw className="size-4" />}
        onClick={async () => {
          const r = await confirm({ title: 'Reset all demonstration data?', body: 'All changes made in this browser are discarded.', confirmLabel: 'Reset demo', tone: 'danger' })
          if (!r.confirmed) return
          await adapter.resetDemo!()
          await qc.invalidateQueries()
          navigate('/')
        }}
      >
        Reset demo data
      </Button>
    </div>
  )
}
