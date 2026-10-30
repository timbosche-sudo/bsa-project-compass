import { ArrowDownUp, LayoutGrid, Plus, Rows3, Search, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { ExportButtons } from '@/components/ExportButtons'
import { DriverStatusBadge, TargetBadge } from '@/components/StatusBadge'
import { Badge, Button, Card, cx, EmptyState, Input, Meter, PageHeader, Select, Unknown } from '@/components/ui'
import { driverCompleteness, driverPrincipleIds, driverStatus, measurementState, MEASUREMENT_STATE_LABELS, type MeasurementState } from '@/domain/drivers'
import { DRIVER_STATUS_LABELS, PHASE_LABELS, REQUIREMENT_CLASS_LABELS } from '@/domain/labels'
import { DRIVER_STATUSES, PHASES, type DesignDriver, type DriverStatus } from '@/domain/types'
import { driverRegisterTable } from '@/exporters/tables'
import { DriverFormDialog } from './DriverForm'
import { isActiveFramework } from '@/domain/wording'

type View = 'table' | 'cards' | 'principle' | 'owner' | 'phase'
type SortKey = 'code' | 'title' | 'status' | 'owner' | 'phase' | 'completeness'

export default function DriversPage() {
  const { data, can, personName } = useProject()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'code', dir: 1 })
  const view = (params.get('view') as View) || 'table'
  const status = (params.get('status') as DriverStatus | null) ?? ''
  const measurement = (params.get('measurement') as MeasurementState | null) ?? ''
  const principle = params.get('principle') ?? ''
  const scope = params.get('scope') ?? ''
  const t = data.project.terminology

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries(DRIVER_STATUSES.map((s) => [s, 0])) as Record<DriverStatus, number>
    data.drivers.forEach((d) => c[driverStatus(d)]++)
    return c
  }, [data.drivers])

  const rows = useMemo(() => {
    const filtered = data.drivers.filter((d) => {
      if (status && driverStatus(d) !== status) return false
      if (measurement && measurementState(d) !== measurement) return false
      if (principle && !driverPrincipleIds(data, d.id).includes(principle)) return false
      if (scope && d.scope !== scope) return false
      if (!status && d.approvalStatus === 'superseded') return false
      if (q && !`${d.code} ${d.title} ${d.description} ${d.ownerOrganization} ${d.ownerTerm}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
    const val = (d: DesignDriver): string | number => {
      switch (sort.key) {
        case 'code':
          return d.code
        case 'title':
          return d.title.toLowerCase()
        case 'status':
          return DRIVER_STATUSES.indexOf(driverStatus(d))
        case 'owner':
          return personName(d.ownerPersonId).toLowerCase()
        case 'phase':
          return PHASES.indexOf(d.phase)
        case 'completeness':
          return driverCompleteness(data, d).ratio
      }
    }
    return [...filtered].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir)
  }, [data, status, measurement, principle, scope, q, sort, personName])

  return (
    <div>
      <PageHeader
        eyebrow="Layer three"
        title={`${t.designDriver} register`}
        description="Actionable, measurable expectations that put guiding principles to work. Approval and performance are tracked separately; verification requires evidence and a named reviewer."
        actions={
          <>
            <ExportButtons build={() => driverRegisterTable(data)} kind="design-driver-register" sheet="Design Drivers" />
            {can('driver.edit') && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                New {t.designDriver.toLowerCase()}
              </Button>
            )}
          </>
        }
      />

      {/* Status dashboard strip */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-8" role="group" aria-label="Filter by status">
        {DRIVER_STATUSES.map((s) => (
          <button key={s} aria-pressed={status === s} onClick={() => update('status', status === s ? '' : s)} className={cx('bg-surface px-3 py-2.5 text-left hover:bg-sunken', status === s && 'bg-sunken ring-2 ring-accent ring-inset')}>
            <div className="text-[20px] font-semibold tabular-nums">{counts[s]}</div>
            <div className="text-[11.5px] text-muted">{DRIVER_STATUS_LABELS[s]}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder={`Search ${t.designDriver.toLowerCase()}s…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drivers" />
        </div>
        <Select aria-label="Principle" className="w-auto max-w-[220px]" value={principle} onChange={(e) => update('principle', e.target.value)} options={[{ value: '', label: 'All principles' }, ...data.principles.filter((p) => isActiveFramework(p.status)).map((p) => ({ value: p.id, label: `${p.code} ${p.title}` }))]} />
        <Select aria-label="Measurement" className="w-auto" value={measurement} onChange={(e) => update('measurement', e.target.value)} options={[{ value: '', label: 'Any measurement state' }, ...Object.entries(MEASUREMENT_STATE_LABELS).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="Scope" className="w-auto" value={scope} onChange={(e) => update('scope', e.target.value)} options={[{ value: '', label: 'Facility & delivery' }, { value: 'facility', label: 'Facility' }, { value: 'delivery', label: 'Project delivery' }]} />
        <Select
          aria-label="View"
          className="w-auto"
          value={view}
          onChange={(e) => update('view', e.target.value)}
          options={[
            { value: 'table', label: 'View: Table' },
            { value: 'cards', label: 'View: Cards' },
            { value: 'principle', label: 'Group: Guiding principle' },
            { value: 'owner', label: 'Group: Accountability' },
            { value: 'phase', label: 'Group: Project phase' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={data.drivers.length ? 'No drivers match these filters' : `No ${t.designDriver.toLowerCase()}s yet`}>
          {data.drivers.length ? 'Clear filters to see the full register.' : 'Create drivers that turn approved principles into measurable expectations.'}
        </EmptyState>
      ) : view === 'table' ? (
        <DriverTable rows={rows} sort={sort} onSort={(key) => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))} />
      ) : view === 'cards' ? (
        <CardGrid rows={rows} />
      ) : (
        <Grouped rows={rows} by={view} />
      )}
      <DriverFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => navigate(`/projects/${data.project.id}/drivers/${id}`)} />
    </div>
  )
}

function TargetCell({ d }: { d: DesignDriver }) {
  const m = d.measure
  if (m.kind === 'qualitative') return <span className="text-[12px] text-ink-2">Qualitative criteria</span>
  return (
    <div className="text-[12.5px]">
      <div>
        {m.target ? (
          <span className="font-medium tabular-nums">
            {m.target} <span className="text-muted">{m.unit}</span>
          </span>
        ) : (
          <Unknown>Not set</Unknown>
        )}
      </div>
      <div className="text-[11.5px] text-muted">
        Now: {m.current ? <span className="tabular-nums text-ink-2">{m.current}</span> : <Unknown>not yet measured</Unknown>}
      </div>
    </div>
  )
}

function DriverTable({ rows, sort, onSort }: { rows: DesignDriver[]; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void }) {
  const { data, personName } = useProject()
  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => onSort(key)}>
        {label} <ArrowDownUp className={cx('size-3', sort.key === key ? 'text-ink' : 'opacity-40')} />
      </button>
    </th>
  )
  return (
    <Card>
      <div className="overflow-x-auto scroll-thin">
        <table className="table-base min-w-[1080px]">
          <thead>
            <tr>
              {th('code', 'ID', 'w-16')}
              {th('title', 'Design Driver')}
              <th>Principles</th>
              {th('status', 'Status')}
              <th>Target · Current</th>
              {th('owner', 'Accountable')}
              {th('phase', 'Phase')}
              {th('completeness', 'Definition')}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const comp = driverCompleteness(data, d)
              return (
                <tr key={d.id}>
                  <td className="font-mono text-[12px] text-muted">{d.code}</td>
                  <td>
                    <Link to={d.id} className="font-medium text-ink hover:underline">
                      {d.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge tone="outline">{d.scope === 'facility' ? 'Facility' : 'Delivery'}</Badge>
                      {d.requirementClass === 'owner_mandatory' && <Badge tone="inverse">{REQUIREMENT_CLASS_LABELS.owner_mandatory}</Badge>}
                    </div>
                  </td>
                  <td className="font-mono text-[11.5px] text-muted">{driverPrincipleIds(data, d.id).map((id) => data.principles.find((p) => p.id === id)?.code).join(' ') || <Unknown>None</Unknown>}</td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <DriverStatusBadge status={driverStatus(d)} />
                      {d.measure.kind === 'quantitative' && d.measure.targetStatus !== 'approved' && <TargetBadge status={d.measure.targetStatus} />}
                    </div>
                  </td>
                  <td>
                    <TargetCell d={d} />
                  </td>
                  <td className="text-[12.5px]">
                    {d.ownerPersonId ? personName(d.ownerPersonId) : (
                      <span className="flex items-center gap-1 text-warn">
                        <UserX className="size-3.5" /> Unassigned
                      </span>
                    )}
                    <div className="text-[11.5px] text-muted">{d.ownerOrganization}</div>
                  </td>
                  <td className="text-[12.5px] whitespace-nowrap text-ink-2">{PHASE_LABELS[d.phase]}</td>
                  <td className="w-28">
                    <Meter value={comp.ratio} label={`${d.code} definition completeness`} />
                    <div className="mt-1 text-[11px] text-muted tabular-nums">{Math.round(comp.ratio * 100)}% defined</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[12px] text-muted">“Definition” measures how completely a driver is specified — it is not a measure of performance or success.</p>
    </Card>
  )
}

function DriverCard({ d }: { d: DesignDriver }) {
  const { data, personName } = useProject()
  const comp = driverCompleteness(data, d)
  return (
    <Link to={`/projects/${data.project.id}/drivers/${d.id}`} className="block">
      <Card className="h-full p-4 transition-colors hover:border-line-strong">
        <div className="flex items-center justify-between gap-2">
          <span className="code-tag">{d.code}</span>
          <DriverStatusBadge status={driverStatus(d)} />
        </div>
        <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{d.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{d.intendedOutcome || d.description}</p>
        <div className="mt-3 rounded-md bg-sunken px-3 py-2">
          <TargetCell d={d} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted">
          <span>{d.ownerPersonId ? personName(d.ownerPersonId) : <span className="text-warn">No owner</span>}</span>
          <span>{PHASE_LABELS[d.phase]}</span>
        </div>
        <div className="mt-2">
          <Meter value={comp.ratio} label="Definition completeness" />
        </div>
      </Card>
    </Link>
  )
}

function CardGrid({ rows }: { rows: DesignDriver[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((d) => (
        <DriverCard key={d.id} d={d} />
      ))}
    </div>
  )
}

function Grouped({ rows, by }: { rows: DesignDriver[]; by: 'principle' | 'owner' | 'phase' }) {
  const { data, personName } = useProject()
  const groups = new Map<string, { label: string; items: DesignDriver[] }>()
  const add = (key: string, label: string, d: DesignDriver) => {
    const g = groups.get(key) ?? { label, items: [] }
    g.items.push(d)
    groups.set(key, g)
  }
  for (const d of rows) {
    if (by === 'principle') {
      const ids = driverPrincipleIds(data, d.id)
      if (!ids.length) add('zz', 'Not linked to a principle', d)
      ids.forEach((id) => {
        const p = data.principles.find((x) => x.id === id)!
        add(String(p.order).padStart(3, '0'), `${p.code} ${p.title}`, d)
      })
    } else if (by === 'owner') {
      add(d.ownerPersonId ?? 'zz', d.ownerPersonId ? `${personName(d.ownerPersonId)} · ${d.ownerOrganization}` : 'No accountable owner', d)
    } else {
      add(String(PHASES.indexOf(d.phase)).padStart(2, '0'), PHASE_LABELS[d.phase], d)
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return (
    <div className="space-y-8">
      {sorted.map(([key, g]) => (
        <section key={key} aria-label={g.label}>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            {by === 'principle' ? <Rows3 className="size-4 text-muted" /> : <LayoutGrid className="size-4 text-muted" />}
            {g.label} <span className="text-[12px] font-normal text-muted">({g.items.length})</span>
          </h2>
          <CardGrid rows={g.items} />
        </section>
      ))}
    </div>
  )
}
