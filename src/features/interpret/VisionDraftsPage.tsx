import { useProject } from '@/app/project'
import { PageHeader } from '@/components/ui'
import { WinThemes } from '@/features/vision/VisionPage'

export default function VisionDraftsPage() {
  const { data } = useProject()
  const t = data.project.terminology
  return (
    <div>
      <PageHeader
        title={t.winTheme}
        description={`Draft and compare ${t.winTheme.toLowerCase()} statements that say why the project matters. Keep alternatives side by side until the Owner is ready to align on one.`}
      />
      <WinThemes headless />
    </div>
  )
}
