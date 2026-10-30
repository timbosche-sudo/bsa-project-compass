import { Navigate, useParams } from 'react-router'
import { useProject } from '@/app/project'

/** Statements live within their source; deep links resolve to the source view with the statement focused. */
export default function StatementRedirect() {
  const { statementId } = useParams()
  const { data } = useProject()
  const s = data.statements.find((x) => x.id === statementId)
  const base = `/projects/${data.project.id}/intelligence`
  return <Navigate to={s ? `${base}/${s.sourceId}?statement=${s.id}` : base} replace />
}
