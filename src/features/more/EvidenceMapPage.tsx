import { useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { PageHeader, Tabs } from '@/components/ui'
import { RelationshipExplorer } from '@/features/alignment/RelationshipExplorer'
import { TraceabilityMatrix } from '@/features/alignment/TraceabilityMatrix'

type Tab = 'matrix' | 'explorer'

/** The full evidence graph, for teams that want to audit traceability in detail. */
export default function EvidenceMapPage() {
  const { data } = useProject()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'explorer' ? 'explorer' : 'matrix'
  const pending = data.relationships.filter((r) => r.status === 'proposed').length
  return (
    <div>
      <PageHeader title="Evidence Map" description="Trace every statement to the themes, principles, drivers and decisions it informs — as a matrix or as a graph." />
      <Tabs
        label="Evidence map views"
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'matrix', label: 'Traceability Matrix', count: pending || undefined },
          { value: 'explorer', label: 'Relationship Explorer' },
        ]}
      />
      <div className="mt-5">{tab === 'matrix' ? <TraceabilityMatrix /> : <RelationshipExplorer />}</div>
    </div>
  )
}
