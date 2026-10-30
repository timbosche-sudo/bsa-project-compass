import { useSearchParams } from 'react-router'
import { useProject } from '@/app/project'
import { PageHeader, Tabs } from '@/components/ui'
import { RelationshipExplorer } from './RelationshipExplorer'
import { ThemesWorkspace } from './ThemesWorkspace'
import { TraceabilityMatrix } from './TraceabilityMatrix'

type Tab = 'themes' | 'matrix' | 'explorer'

export default function AlignmentPage() {
  const { data } = useProject()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'themes'
  const pending = data.relationships.filter((r) => r.status === 'proposed').length
  return (
    <div>
      <PageHeader
        eyebrow="Synthesis"
        title="Alignment Studio"
        description="Group stakeholder statements into themes, surface conflicts and overlooked requirements, and trace every principle and driver back to its evidence."
      />
      <Tabs
        label="Alignment views"
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'themes', label: 'Themes', count: data.themes.filter((t) => t.status !== 'archived').length },
          { value: 'matrix', label: 'Traceability Matrix', count: pending || undefined },
          { value: 'explorer', label: 'Relationship Explorer' },
        ]}
      />
      <div className="mt-5">
        {tab === 'themes' && <ThemesWorkspace />}
        {tab === 'matrix' && <TraceabilityMatrix />}
        {tab === 'explorer' && <RelationshipExplorer />}
      </div>
    </div>
  )
}
