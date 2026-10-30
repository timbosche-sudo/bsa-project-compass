import { PageHeader } from '@/components/ui'
import { ThemesWorkspace } from '@/features/alignment/ThemesWorkspace'

export default function ThemesPage() {
  return (
    <div>
      <PageHeader title="Themes" description="Group what was said into recurring ideas. Each theme stays connected to the verbatim statements behind it." />
      <ThemesWorkspace />
    </div>
  )
}
