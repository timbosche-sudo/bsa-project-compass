// Supabase Edge Function: authenticated Project Compass API.
// Deploy: supabase functions deploy api
// Secrets: supabase secrets set ALLOWED_ORIGIN=https://compass.example.org AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... AI_MODEL=...
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { handle, type AiClient, type Store } from '../_shared/api.ts'
import type { Confidentiality, ProjectData } from '../../../src/domain/types.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const SUPABASE_URL = env('SUPABASE_URL')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const ANON_KEY = env('SUPABASE_ANON_KEY')
const ALLOWED_ORIGIN = env('ALLOWED_ORIGIN')

function cors(origin: string | null): HeadersInit {
  const ok = origin && ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** Postgres-backed store. Uses the service role ONLY after the caller is authenticated and authorized by handle(). */
function pgStore(admin: SupabaseClient): Store {
  return {
    async personForAuthUser(authUserId, email) {
      let { data } = await admin.from('people').select('id,name,title,organization,email,is_system_admin').eq('auth_user_id', authUserId).maybeSingle()
      if (!data && email) {
        // First sign-in: link a pre-registered person record by verified email.
        const linked = await admin.from('people').update({ auth_user_id: authUserId }).eq('email', email.toLowerCase()).is('auth_user_id', null).select('id,name,title,organization,email,is_system_admin').maybeSingle()
        data = linked.data
      }
      return data ? { id: data.id, name: data.name, title: data.title, organization: data.organization, email: data.email, isSystemAdmin: data.is_system_admin } : null
    },
    async projectsFor(personId) {
      const { data, error } = await admin.from('project_members').select('projects(id,code,name,sector,phase,is_demo,owner_name)').eq('person_id', personId)
      if (error) throw error
      return (data ?? []).map((r: any) => ({ id: r.projects.id, code: r.projects.code, name: r.projects.name, sector: r.projects.sector, phase: r.projects.phase, isDemo: r.projects.is_demo, ownerName: r.projects.owner_name }))
    },
    async members(projectId) {
      const { data, error } = await admin.from('project_members').select('person_id,role').eq('project_id', projectId)
      if (error) throw error
      return (data ?? []).map((m) => ({ personId: m.person_id, role: m.role }))
    },
    async loadState(projectId) {
      const { data } = await admin.from('project_state').select('data,revision').eq('project_id', projectId).maybeSingle()
      return data ? ({ ...(data.data as ProjectData), revision: Number(data.revision) }) : null
    },
    async saveState(projectId, data, expectedRevision, actorId) {
      const { data: rows, error } = await admin
        .from('project_state')
        .update({ data, revision: data.revision, updated_at: new Date().toISOString(), updated_by: actorId })
        .eq('project_id', projectId)
        .eq('revision', expectedRevision)
        .select('project_id')
      if (error) throw error
      return (rows ?? []).length === 1
    },
    async syncMembership(projectId, data) {
      for (const p of data.people) {
        if (p.email) await admin.from('people').upsert({ id: p.id, name: p.name, title: p.title, organization: p.organization, email: p.email.toLowerCase() }, { onConflict: 'id', ignoreDuplicates: true })
      }
      const current = await this.members(projectId)
      const wanted = new Map(data.project.members.map((m) => [m.personId, m.role]))
      for (const m of current) if (!wanted.has(m.personId)) await admin.from('project_members').delete().eq('project_id', projectId).eq('person_id', m.personId)
      for (const [personId, role] of wanted) await admin.from('project_members').upsert({ project_id: projectId, person_id: personId, role })
    },
    async appendAudit(projectId, events) {
      await admin.from('audit_events').insert(events.map((e) => ({ project_id: projectId, actor_id: e.actorId, action: e.action, target_type: e.target?.type ?? null, target_id: e.target?.id ?? null, summary: e.summary.slice(0, 1000), at: e.at })))
    },
    async createProject(data, organizationName) {
      const { data: org } = await admin.from('organizations').select('id').eq('name', organizationName || 'BSA').maybeSingle()
      const orgId = org?.id ?? (await admin.from('organizations').insert({ name: organizationName || 'BSA' }).select('id').single()).data!.id
      const p = data.project
      const { error } = await admin.from('projects').insert({ id: p.id, organization_id: orgId, code: p.code, name: p.name, sector: p.sector, phase: p.phase, owner_name: p.owner.name, is_demo: false, created_by: p.members[0].personId })
      if (error) throw error
      await admin.from('project_members').insert({ project_id: p.id, person_id: p.members[0].personId, role: 'project_admin' })
      await admin.from('project_state').insert({ project_id: p.id, data, revision: 1 })
    },
    async signedUploadUrl(path) {
      const { data, error } = await admin.storage.from('project-sources').createSignedUploadUrl(path)
      if (error) throw error
      return data.signedUrl
    },
    async signedDownloadUrl(path, seconds) {
      const { data, error } = await admin.storage.from('project-sources').createSignedUrl(path, seconds)
      if (error) throw error
      return data.signedUrl
    },
    async logAi(e) {
      await admin.from('ai_requests').insert({ project_id: e.projectId, actor_id: e.actorId, task: e.task, provider: e.provider, model: e.model, statements_sent: e.sent, statements_withheld: e.withheld, status: e.status })
    },
  }
}

/** Organization-approved provider adapter. Only fixed tasks reach it (see handle()). */
function anthropic(): AiClient | null {
  if (env('AI_PROVIDER') !== 'anthropic' || !env('ANTHROPIC_API_KEY')) return null
  const model = env('AI_MODEL') || 'claude-sonnet-5-5'
  return {
    provider: 'anthropic',
    model,
    allowedClassifications: (env('AI_ALLOWED_CONFIDENTIALITY') || 'public').split(',').map((s) => s.trim()) as Confidentiality[],
    async complete(system, user) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
      })
      if (!res.ok) throw new Error(`AI provider error ${res.status}`)
      const j = await res.json()
      return (j.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('')
    },
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^.*?\/api/, '') || '/'

  // Verify the caller's token with Supabase Auth (signature, expiry, revocation).
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: auth } = token ? await userClient.auth.getUser(token) : { data: { user: null } }

  const raw = request.method === 'POST' ? await request.text() : ''
  let body: unknown = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { ...cors(origin), 'content-type': 'application/json' } })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const result = await handle(
    { method: request.method, path, body, rawBodyBytes: raw.length, authUserId: auth.user?.id ?? null, email: auth.user?.email ?? null },
    pgStore(admin),
    anthropic(),
  )
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...cors(origin), 'content-type': 'application/json', 'cache-control': 'no-store' } })
})
