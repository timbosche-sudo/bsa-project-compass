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
import { AppShell, BrandMark } from '@/layout/AppShell'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { NewProjectDialog } from '@/features/settings/NewProjectDialog'

const IntelligencePage = lazy(() => import('@/features/intelligence/IntelligencePage'))
const SourceDetailPage = lazy(() => import('@/features/intelligence/SourceDetailPage'))
const StatementRedirect = lazy(() => import('@/features/intelligence/StatementRedirect'))
const AlignmentPage = lazy(() => import('@/features/alignment/AlignmentPage'))
const VisionPage = lazy(() => import('@/features/vision/VisionPage'))
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
        { index: true, element: <OverviewPage /> },
        { path: 'intelligence', element: page(<IntelligencePage />) },
        { path: 'intelligence/statement/:statementId', element: page(<StatementRedirect />) },
        { path: 'intelligence/:sourceId', element: page(<SourceDetailPage />) },
        { path: 'alignment', element: page(<AlignmentPage />) },
        { path: 'vision', element: page(<VisionPage />) },
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
            <BrandMark size={40} />
          </div>
          <h1 className="text-[20px] font-semibold">BSA Project Compass</h1>
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
