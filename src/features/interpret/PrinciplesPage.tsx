import { useProject } from '@/app/project'
import { PageHeader } from '@/components/ui'
import { Principles } from '@/features/vision/VisionPage'

export default function PrinciplesPage() {
  const { data } = useProject()
  const t = data.project.terminology
  return (
    <div>
      <PageHeader
        title={`${t.guidingPrinciple}s`}
        description="Durable commitments that guide design choices. Each states why it matters and what it might mean for the design — and stays traceable to what we heard."
      />
      <Principles headless />
    </div>
  )
}
