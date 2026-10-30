import { Copy, FileText, Image, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { formatDate } from '@/components/Collaboration'
import { LinkedChips, StatementQuote } from '@/components/Evidence'
import { ConfidentialityBadge } from '@/components/StatusBadge'
import { Badge, Button, Card, EmptyState, Input, optionsFrom, PageHeader, Select, Tabs } from '@/components/ui'
import { CONFIDENTIALITY_LABELS, EXTRACTION_LABELS, SOURCE_TYPE_LABELS, STATEMENT_KIND_LABELS } from '@/domain/labels'
import { accepted } from '@/domain/traceability'
import type { NodeRef, SourceType, StatementKind } from '@/domain/types'
import { SourceFormDialog } from './forms'

type Tab = 'sources' | 'statements'

export default function IntelligencePage() {
  const { data, can } = useProject()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = (params.get('tab') as Tab) ?? (params.get('filter') ? 'statements' : 'sources')
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        eyebrow="Understand"
        title="Evidence"
        description="Every source and every extracted statement, with original wording, attribution and verification status. Interpretation is always kept separate from what was said."
        actions={
          can('source.create') && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Register source
            </Button>
          )
        }
      />
      <Tabs
        label="Intelligence views"
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'sources', label: 'Sources', count: data.sources.length },
          { value: 'statements', label: 'Statements', count: data.statements.length },
        ]}
      />
      <div className="mt-5">{tab === 'sources' ? <SourcesTable /> : <StatementsList initialFilter={params.get('filter')} />}</div>
      <SourceFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => navigate(`/projects/${data.project.id}/understand/evidence/${id}`)} />
    </div>
  )
}

function SourcesTable() {
  const { data, can, personName } = useProject()
  const [q, setQ] = useState('')
  const [type, setType] = useState<SourceType | ''>('')
  const [conf, setConf] = useState('')
  const rows = data.sources.filter(
    (s) => (!type || s.type === type) && (!conf || s.confidentiality === conf) && (!q || `${s.code} ${s.title} ${s.author} ${s.organization}`.toLowerCase().includes(q.toLowerCase())),
  )
  if (data.sources.length === 0)
    return (
      <EmptyState title="No sources yet" icon={<FileText className="size-6" />}>
        {can('source.create') ? 'Register workshop notes, Owner requirements, research and observations to begin building the evidence base.' : 'Sources registered by the team will appear here.'}
      </EmptyState>
    )
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search sources…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sources" />
        </div>
        <Select aria-label="Filter by type" className="w-auto" value={type} onChange={(e) => setType(e.target.value as SourceType | '')} options={[{ value: '', label: 'All types' }, ...optionsFrom(SOURCE_TYPE_LABELS)]} />
        <Select aria-label="Filter by confidentiality" className="w-auto" value={conf} onChange={(e) => setConf(e.target.value)} options={[{ value: '', label: 'All classifications' }, ...optionsFrom(CONFIDENTIALITY_LABELS)]} />
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="table-base min-w-[880px]">
          <thead>
            <tr>
              <th className="w-20">ID</th>
              <th>Source</th>
              <th>Type</th>
              <th>Author · Organization</th>
              <th>Date</th>
              <th>Classification</th>
              <th>Extraction</th>
              <th className="text-right">Statements</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const count = data.statements.filter((x) => x.sourceId === s.id).length
              const dup = s.possibleDuplicateOf ? data.sources.find((x) => x.id === s.possibleDuplicateOf) : null
              return (
                <tr key={s.id}>
                  <td className="font-mono text-[12px] text-muted">{s.code}</td>
                  <td>
                    <Link to={s.id} className="font-medium text-ink hover:underline">
                      {s.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                      {s.file && (
                        <span className="flex items-center gap-1">
                          {s.file.mimeType.startsWith('image/') ? <Image className="size-3" /> : <FileText className="size-3" />}
                          {s.file.name}
                        </span>
                      )}
                      <span>Uploaded by {personName(s.uploadedBy)}</span>
                      {s.version > 1 && <span>v{s.version}</span>}
                      {dup && (
                        <Badge tone="warn">
                          <Copy className="size-3" /> Possible duplicate of {dup.code}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-ink-2">{SOURCE_TYPE_LABELS[s.type]}</td>
                  <td className="text-ink-2">
                    {s.author || '—'}
                    <div className="text-[11.5px] text-muted">{s.organization}</div>
                  </td>
                  <td className="whitespace-nowrap text-ink-2 tabular-nums">{formatDate(s.date)}</td>
                  <td>
                    <ConfidentialityBadge level={s.confidentiality} />
                  </td>
                  <td>
                    <Badge tone={s.extractionStatus === 'verified' ? 'ok' : s.extractionStatus === 'not_started' ? 'outline' : 'info'}>{EXTRACTION_LABELS[s.extractionStatus]}</Badge>
                  </td>
                  <td className="text-right tabular-nums">{count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted">No sources match these filters.</p>}
      </div>
    </Card>
  )
}

function StatementsList({ initialFilter }: { initialFilter: string | null }) {
  const { data } = useProject()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<StatementKind | ''>('')
  const [linkage, setLinkage] = useState<'all' | 'orphan' | 'transcription'>(initialFilter === 'transcription' ? 'transcription' : initialFilter === 'orphan' ? 'orphan' : 'all')
  const rels = useMemo(() => accepted(data), [data])
  const linksOf = (id: string): NodeRef[] => rels.filter((r) => r.from.type === 'statement' && r.from.id === id && r.type !== 'conflicts_with').map((r) => r.to)
  const rows = data.statements.filter((s) => {
    if (kind && s.kind !== kind) return false
    if (linkage === 'orphan' && linksOf(s.id).length > 0) return false
    if (linkage === 'transcription' && !(s.transcriptionStatus === 'unverified' || s.transcriptionStatus === 'uncertain')) return false
    if (q && !`${s.code} ${s.originalText} ${s.speaker} ${s.interpretation}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search original wording, speaker, interpretation…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search statements" />
        </div>
        <Select aria-label="Filter by statement type" className="w-auto" value={kind} onChange={(e) => setKind(e.target.value as StatementKind | '')} options={[{ value: '', label: 'All statement types' }, ...optionsFrom(STATEMENT_KIND_LABELS)]} />
        <Select
          aria-label="Filter by status"
          className="w-auto"
          value={linkage}
          onChange={(e) => setLinkage(e.target.value as typeof linkage)}
          options={[
            { value: 'all', label: 'All statements' },
            { value: 'orphan', label: 'Orphaned (not linked)' },
            { value: 'transcription', label: 'Transcription to verify' },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No statements match">Adjust filters, or record statements from a source.</EmptyState>
      ) : (
        <Card as="div">
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_340px]">
                <StatementQuote statement={s} />
                <div className="space-y-1.5 lg:border-l lg:border-line lg:pl-4">
                  <div className="eyebrow">Linked to</div>
                  <LinkedChips refs={linksOf(s.id)} empty="Orphaned — not yet linked" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
