import { Navigate, useLocation, useParams } from 'react-router'
import { useProject } from '@/app/project'

/** Compass 1.x URLs keep working: bookmarks and shared links land on the new location. */
export function LegacyIntelligence() {
  const { data } = useProject()
  const rest = useParams()['*'] ?? ''
  const { search } = useLocation()
  return <Navigate to={`/projects/${data.project.id}/understand/evidence${rest ? `/${rest}` : ''}${search}`} replace />
}

export function LegacyAlignment() {
  const { data } = useProject()
  const params = new URLSearchParams(useLocation().search)
  const tab = params.get('tab')
  const base = `/projects/${data.project.id}`
  if (tab === 'matrix' || tab === 'explorer') return <Navigate to={`${base}/more/evidence-map?tab=${tab}`} replace />
  const theme = params.get('theme')
  return <Navigate to={`${base}/understand/themes${theme ? `?theme=${encodeURIComponent(theme)}` : ''}`} replace />
}

export function LegacyVision() {
  const { data } = useProject()
  const params = new URLSearchParams(useLocation().search)
  const base = `/projects/${data.project.id}`
  const principle = params.get('principle')
  if (principle) return <Navigate to={`${base}/interpret/principles?principle=${encodeURIComponent(principle)}`} replace />
  return <Navigate to={`${base}/interpret/vision`} replace />
}
