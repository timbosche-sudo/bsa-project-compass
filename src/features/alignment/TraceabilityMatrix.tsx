import { Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { ExportButtons } from '@/components/ExportButtons'
import { ConfidenceBadge, CriticalityBadge, KindBadge, OriginBadge } from '@/components/StatusBadge'
import { Badge, Button, Card, cx, Input, Select } from '@/components/ui'
import { NODE_TYPE_LABELS, RELATIONSHIP_LABELS, STATEMENT_KIND_LABELS } from '@/domain/labels'
import { nodeLabel, nodePath, traceRows } from '@/domain/traceability'
import { traceabilityTable } from '@/exporters/tables'

export function TraceabilityMatrix() {
  const { data, can, run, personName } = useProject()
  const rows = useMemo(() => traceRows(data), [data])
  const [q, setQ] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [principleId, setPrincipleId] = useState('')
  const [kind, setKind] = useState('')
  const [only, setOnly] = useState<'' | 'gaps' | 'pending' | 'critical'>('')
  const [open, setOpen] = useState<string | null>(null)
  const base = `/projects/${data.project.id}`

  const filtered = rows.filter((r) => {
    if (sourceId && r.sourceId !== sourceId) return false
    if (themeId && !r.themes.some((t) => t.id === themeId)) return false
    if (principleId && !r.principles.some((p) => p.id === principleId)) return false
    if (kind && r.kind !== kind) return false
    if (only === 'gaps' && (r.themes.length || r.principles.length || r.drivers.length)) return false
    if (only === 'pending' && !r.relationships.some((x) => x.status === 'proposed')) return false
    if (only === 'critical' && r.criticality !== 'critical' && r.kind !== 'nonnegotiable') return false
    if (q) {
      const hay = [r.statementCode, r.statementText, r.sourceCode, r.sourceTitle, ...r.themes.map((t) => t.title), ...r.principles.map((p) => p.title), ...r.drivers.map((d) => d.title)].join(' ').toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  const chips = (items: { id: string; code: string; title: string; via?: string }[], type: 'theme' | 'principle' | 'driver' | 'decision') =>
    items.length === 0 ? (
      <span className="text-faint">—</span>
    ) : (
      <span className="flex flex-col gap-1">
        {items.map((i) => (
          <Link key={i.id} to={nodePath(data.project.id, { type, id: i.id })} className="group block leading-snug" title={i.title}>
            <span className="font-mono text-[11px] text-muted">{i.code}</span> <span className="text-ink-2 group-hover:underline">{i.title}</span>
            {i.via && i.via !== 'direct' && <span className="ml-1 text-[10.5px] text-faint">via {i.via}</span>}
          </Link>
        ))}
      </span>
    )

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search source, statement, theme, principle…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search matrix" />
        </div>
        <Select aria-label="Source" className="w-auto max-w-[180px]" value={sourceId} onChange={(e) => setSourceId(e.target.value)} options={[{ value: '', label: 'All sources' }, ...data.sources.map((s) => ({ value: s.id, label: `${s.code} ${s.title}` }))]} />
        <Select aria-label="Theme" className="w-auto max-w-[180px]" value={themeId} onChange={(e) => setThemeId(e.target.value)} options={[{ value: '', label: 'All themes' }, ...data.themes.filter((t) => t.status !== 'archived').map((t) => ({ value: t.id, label: `${t.code} ${t.title}` }))]} />
        <Select aria-label="Principle" className="w-auto max-w-[180px]" value={principleId} onChange={(e) => setPrincipleId(e.target.value)} options={[{ value: '', label: 'All principles' }, ...data.principles.map((p) => ({ value: p.id, label: `${p.code} ${p.title}` }))]} />
        <Select aria-label="Statement type" className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: '', label: 'All types' }, ...Object.entries(STATEMENT_KIND_LABELS).map(([value, label]) => ({ value, label }))]} />
        <Select
          aria-label="Show"
          className="w-auto"
          value={only}
          onChange={(e) => setOnly(e.target.value as typeof only)}
          options={[
            { value: '', label: 'All rows' },
            { value: 'gaps', label: 'Untraced only' },
            { value: 'pending', label: 'Awaiting review' },
            { value: 'critical', label: 'Critical / non-negotiable' },
          ]}
        />
        <ExportButtons build={() => traceabilityTable(data)} kind="traceability-matrix" sheet="Traceability" />
      </div>
      <div className="max-h-[70vh] overflow-auto scroll-thin">
        <table className="table-base min-w-[1100px]">
          <thead>
            <tr>
              <th className="w-8" aria-label="Expand" />
              <th className="w-[30%]">Source statement</th>
              <th>Source</th>
              <th>Theme</th>
              <th>Guiding Principle</th>
              <th>Design Driver</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const expanded = open === r.statementId
              const pending = r.relationships.filter((x) => x.status === 'proposed').length
              return (
                <Fragment key={r.statementId}>
                  <tr className={cx(expanded && '[&>td]:bg-sunken/60')}>
                    <td>
                      <button aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${r.statementCode} evidence detail`} className="rounded p-0.5 text-muted hover:bg-sunken hover:text-ink" onClick={() => setOpen(expanded ? null : r.statementId)}>
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-start gap-2">
                        <Link to={nodePath(data.project.id, { type: 'statement', id: r.statementId })} className="font-mono text-[11px] text-muted hover:text-ink">
                          {r.statementCode}
                        </Link>
                        <span className="quote">“{r.statementText}”</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 pl-12">
                        <KindBadge kind={r.kind} />
                        <CriticalityBadge level={r.criticality} />
                        {pending > 0 && <Badge tone="ai">{pending} awaiting review</Badge>}
                      </div>
                    </td>
                    <td>
                      <Link to={`${base}/intelligence/${r.sourceId}`} className="text-ink-2 hover:underline">
                        <span className="font-mono text-[11px] text-muted">{r.sourceCode}</span> {r.sourceTitle}
                      </Link>
                      {r.locator && <div className="text-[11.5px] text-muted">{r.locator}</div>}
                    </td>
                    <td>{chips(r.themes, 'theme')}</td>
                    <td>{chips(r.principles, 'principle')}</td>
                    <td>{chips(r.drivers, 'driver')}</td>
                    <td>{chips(r.decisions, 'decision')}</td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td />
                      <td colSpan={6} className="bg-sunken/60">
                        <div className="eyebrow mb-2">Relationship detail</div>
                        {r.relationships.length === 0 ? (
                          <p className="text-[12.5px] text-muted">No relationships recorded for this statement.</p>
                        ) : (
                          <ul className="space-y-2">
                            {r.relationships.map((rel) => {
                              const other = rel.from.type === 'statement' && rel.from.id === r.statementId ? rel.to : rel.from
                              const l = nodeLabel(data, other)
                              return (
                                <li key={rel.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]">
                                  <span className="text-muted">{RELATIONSHIP_LABELS[rel.type]}</span>
                                  <span className="font-medium">
                                    {NODE_TYPE_LABELS[other.type]} <span className="font-mono text-[11px]">{l.code}</span> {l.title.slice(0, 80)}
                                  </span>
                                  <OriginBadge origin={rel.origin} />
                                  <ConfidenceBadge level={rel.confidence} />
                                  <Badge tone={rel.status === 'accepted' ? 'ok' : rel.status === 'proposed' ? 'ai' : 'danger'}>{rel.status}</Badge>
                                  <span className="text-muted">
                                    Proposed by {personName(rel.proposedBy)}
                                    {rel.reviewedBy && ` · reviewed by ${personName(rel.reviewedBy)}`} · {formatDate(rel.updatedAt)}
                                  </span>
                                  {rel.explanation && <span className="w-full text-ink-2">{rel.explanation}</span>}
                                  {rel.status === 'proposed' && can('relationship.review') && (
                                    <span className="flex gap-1.5">
                                      <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => run({ type: 'relationship.review', id: rel.id, decision: 'accepted' }, 'Relationship accepted')}>
                                        Accept
                                      </Button>
                                      <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run({ type: 'relationship.review', id: rel.id, decision: 'rejected' }, 'Relationship rejected')}>
                                        Reject
                                      </Button>
                                    </span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-muted">No rows match these filters.</p>}
      </div>
      <div className="border-t border-line px-4 py-2 text-[12px] text-muted">
        {filtered.length} of {rows.length} statements · “via theme” and “via principle” show derived links; only accepted relationships are traced.
      </div>
    </Card>
  )
}
