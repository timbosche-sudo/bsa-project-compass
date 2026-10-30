import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useParams, Link } from 'react-router'
import { ProjectProvider, useProjectQuery, useProjects } from '@/app/project'
import { SessionProvider, useSession } from '@/app/session'
import { ConfirmProvider } from '@/components/Dialog'
import { ToastProvider } from '@/components/Toast'
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui'
import { AccessDeniedError, type DataAdapter } from '@/data/adapter'
import { SupabaseAuth } from '@/data/auth'
import { readConfig } from '@/data/config'
import { DEFAULT_DEMO_PERSONA, DemoAdapter } from '@/data/demoAdapter'
import { RemoteAdapter } from '@/data/remoteAdapter'
import type { Person } from '@/domain/types'
import { AppShell } from '@/layout/AppShell'
import { BsaLogo } from '@/brand/BsaLogo'
import ProjectHome from '@/features/home/ProjectHome'
import { LegacyAlignment, LegacyIntelligence, LegacyVision } from '@/features/redirects'
import { InterpretStage, MoreStage, UnderstandStage } from '@/layout/stages'
import { NewProjectDialog } from '@/features/settings/NewProjectDialog'

const IntelligencePage = lazy(() => import('@/features/intelligence/IntelligencePage'))
const ThemesPage = lazy(() => import('@/features/understand/ThemesPage'))
const QuestionsPage = lazy(() => import('@/features/understand/QuestionsPage'))
const HeardPage = lazy(() => import('@/features/understand/HeardPage'))
const PointOfViewPage = lazy(() => import('@/features/interpret/PointOfViewPage'))
const VisionDraftsPage = lazy(() => import('@/features/interpret/VisionDraftsPage'))
const PrinciplesPage = lazy(() => import('@/features/interpret/PrinciplesPage'))
const OpportunitiesPage = lazy(() => import('@/features/interpret/OpportunitiesPage'))
const SuccessPage = lazy(() => import('@/features/interpret/SuccessPage'))
const AlignPage = lazy(() => import('@/features/align/AlignPage'))
const FromVisionToDesignPage = lazy(() => import('@/features/more/FromVisionToDesignPage'))
const EvidenceMapPage = lazy(() => import('@/features/more/EvidenceMapPage'))
const SourceDetailPage = lazy(() => import('@/features/intelligence/SourceDetailPage'))
const StatementRedirect = lazy(() => import('@/features/intelligence/StatementRedirect'))
const DriversPage = lazy(() => import('@/features/drivers/DriversPage'))
const DriverDetailPage = lazy(() => import('@/features/drivers/DriverDetailPage'))
const DecisionsPage = lazy(() => import('@/features/decisions/DecisionsPage'))
const DecisionDetailPage = lazy(() => import('@/features/decisions/DecisionDetailPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const WorkshopPage = lazy(() => import('@/features/workshop/WorkshopPage'))
const AudiencePage = lazy(() => import('@/features/workshop/AudiencePage'))

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

function page(el: ReactNode) {
  return <Suspense fallback={<Loading />}>{el}</Suspense>
}

const router = createBrowserRouter(
  [
    { path: '/', element: <Home /> },
    {
      path: '/projects/:projectId',
      element: <ProjectRoute />,
      children: [
        // Workshop Mode runs full-window, without the application chrome.
        { path: 'workshop', element: page(<WorkshopPage />) },
        { path: 'workshop/audience', element: page(<AudiencePage />) },
        {
          element: (
            <AppShell>
              <Outlet />
            </AppShell>
          ),
          children: [
            { index: true, element: <ProjectHome /> },
            {
              path: 'understand',
              element: <UnderstandStage />,
              children: [
                { index: true, element: <Navigate to="evidence" replace /> },
                { path: 'evidence', element: page(<IntelligencePage />) },
                { path: 'evidence/statement/:statementId', element: page(<StatementRedirect />) },
                { path: 'evidence/:sourceId', element: page(<SourceDetailPage />) },
                { path: 'themes', element: page(<ThemesPage />) },
                { path: 'questions', element: page(<QuestionsPage />) },
                { path: 'heard', element: page(<HeardPage />) },
              ],
            },
            {
              path: 'interpret',
              element: <InterpretStage />,
              children: [
                { index: true, element: <Navigate to="point-of-view" replace /> },
                { path: 'point-of-view', element: page(<PointOfViewPage />) },
                { path: 'vision', element: page(<VisionDraftsPage />) },
                { path: 'principles', element: page(<PrinciplesPage />) },
                { path: 'opportunities', element: page(<OpportunitiesPage />) },
                { path: 'success', element: page(<SuccessPage />) },
              ],
            },
            { path: 'align', element: page(<AlignPage />) },
            {
              path: 'more',
              element: <MoreStage />,
              children: [
                { index: true, element: <Navigate to="from-vision-to-design" replace /> },
                { path: 'from-vision-to-design', element: page(<FromVisionToDesignPage />) },
                { path: 'evidence-map', element: page(<EvidenceMapPage />) },
              ],
            },
            // Compass 1.x locations
            { path: 'intelligence/*', element: <LegacyIntelligence /> },
            { path: 'alignment', element: <LegacyAlignment /> },
            { path: 'vision', element: <LegacyVision /> },
        { path: 'drivers', element: page(<DriversPage />) },
        { path: 'drivers/:driverId', element: page(<DriverDetailPage />) },
        { path: 'decisions', element: page(<DecisionsPage />) },
        { path: 'decisions/:decisionId', element: page(<DecisionDetailPage />) },
        { path: 'dashboard', element: page(<DashboardPage />) },
        { path: 'reports', element: page(<ReportsPage />) },
        { path: 'settings', element: page(<SettingsPage />) },
        { path: '*', element: <NotFound /> },
          ],
        },
      ],
    },
    { path: '*', element: <NotFound standalone /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <Bootstrap>
            <RouterProvider router={router} />
          </Bootstrap>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

type BootState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'signin'; auth: SupabaseAuth }
  | { status: 'ready'; adapter: DataAdapter; identities: Person[]; actorId: string; signOut?: () => void }

function Bootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootState>({ status: 'loading' })
  useEffect(() => {
    const config = readConfig()
    ;(async () => {
      if (config.configError) throw new Error(config.configError)
      if (config.mode === 'demo') {
        const adapter = new DemoAdapter()
        const identities = await adapter.listIdentities()
        setState({ status: 'ready', adapter, identities, actorId: DEFAULT_DEMO_PERSONA })
        return
      }
      const auth = new SupabaseAuth(config.supabaseUrl!, config.supabaseAnonKey!, config.identityProvider)
      const session = await auth.restore()
      if (!session) return setState({ status: 'signin', auth })
      const adapter = new RemoteAdapter(config.supabaseUrl!, config.supabaseAnonKey!, auth)
      const identities = await adapter.listIdentities()
      setState({
        status: 'ready',
        adapter,
        identities,
        actorId: identities[0].id,
        signOut: () => auth.signOut().then(() => window.location.reload()),
      })
    })().catch((error) => setState({ status: 'error', error }))
  }, [])

  if (state.status === 'loading') return <Loading label="Starting Project Compass" />
  if (state.status === 'error')
    return (
      <Centered>
        <ErrorState title="Project Compass could not start" error={state.error} />
      </Centered>
    )
  if (state.status === 'signin')
    return (
      <Centered>
        <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-card">
          <div className="mb-4 flex justify-center">
            <BsaLogo height={48} />
          </div>
          <h1 className="text-[22px] font-black">Project Compass</h1>
          <p className="mt-1 mb-6 text-[13px] text-muted">Sign in with your organization account to continue.</p>
          <Button variant="primary" onClick={() => state.auth.signIn()}>
            Sign in with organization SSO
          </Button>
        </div>
      </Centered>
    )
  return (
    <SessionProvider adapter={state.adapter} identities={state.identities} defaultActorId={state.actorId} signOut={state.signOut}>
      {children}
    </SessionProvider>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">{children}</div>
}

function Home() {
  const projects = useProjects()
  const { actor, adapter } = useSession()
  const [creating, setCreating] = useState(false)
  if (projects.isLoading) return <Loading label="Loading projects" />
  if (projects.error) return <Centered><ErrorState error={projects.error} /></Centered>
  const first = projects.data?.[0]
  if (first) return <Navigate to={`/projects/${first.id}`} replace />
  return (
    <Centered>
      <EmptyState title="No projects yet" action={<Button variant="primary" onClick={() => setCreating(true)}>Create a project</Button>}>
        {actor?.name} is not a member of any project{adapter.mode === 'demo' ? '. Switch demo persona or create a sandbox project.' : '. Ask a project administrator for access.'}
      </EmptyState>
      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </Centered>
  )
}

function ProjectRoute() {
  const { projectId = '' } = useParams()
  const query = useProjectQuery(projectId, { live: true })
  if (query.isLoading) return <Loading label="Loading project" />
  if (query.error || !query.data) {
    const denied = query.error instanceof AccessDeniedError
    return (
      <Centered>
        <ErrorState
          title={denied ? 'No access to this project' : 'Could not load project'}
          error={query.error ?? 'Not found'}
          action={
            <Link to="/">
              <Button>Go to my projects</Button>
            </Link>
          }
        />
      </Centered>
    )
  }
  return (
    <ProjectProvider data={query.data}>
      <Outlet />
    </ProjectProvider>
  )
}

function NotFound({ standalone }: { standalone?: boolean }) {
  const body = (
    <EmptyState title="Page not found" action={<Link to="/"><Button>Go home</Button></Link>}>
      The page you requested does not exist.
    </EmptyState>
  )
  return standalone ? <Centered>{body}</Centered> : body
}
