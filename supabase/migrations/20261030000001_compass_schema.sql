-- ============================================================================
-- BSA Project Compass — secure multi-user schema (Supabase / PostgreSQL 15+)
--
-- Design:
--   * Each project's domain aggregate is stored in project_state (jsonb) and is
--     changed ONLY by the server-side command handler (supabase/functions/api),
--     which runs the same validated domain rules as the client. Browsers can
--     read their own projects through RLS but can never write project content
--     directly, so domain rules cannot be bypassed via the REST API.
--   * Membership (project_members) is the source of truth for authorization
--     and is enforced by row-level security on every table.
--   * audit_events is append-only.
--   * Source files live in the private "project-sources" bucket under
--     <project_id>/<source_id>/<file>, readable only by project members via
--     short-lived signed URLs.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.compass_role as enum (
  'system_admin', 'org_admin', 'project_admin', 'editor', 'contributor', 'reviewer', 'viewer'
);

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  -- Linked when the person first signs in through the organization IdP.
  auth_user_id uuid unique,
  organization_id uuid references public.organizations (id),
  name text not null check (char_length(name) between 1 and 200),
  title text not null default '' check (char_length(title) <= 200),
  organization text not null default '' check (char_length(organization) <= 200),
  email text not null check (char_length(email) <= 200),
  is_system_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (email)
);

create table public.org_admins (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (organization_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Projects and membership
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null check (code ~ '^[A-Za-z0-9-]{1,24}$'),
  name text not null check (char_length(name) between 1 and 200),
  sector text not null check (sector in ('healing', 'learning', 'discovery', 'other')),
  phase text not null,
  owner_name text not null default '',
  is_demo boolean not null default false,
  created_by uuid references public.people (id),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role public.compass_role not null,
  added_at timestamptz not null default now(),
  primary key (project_id, person_id)
);
create index project_members_person_idx on public.project_members (person_id);

-- The domain aggregate for one project. Written only by the service role.
create table public.project_state (
  project_id uuid primary key references public.projects (id) on delete cascade,
  revision bigint not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.people (id),
  constraint project_state_size check (pg_column_size(data) < 20 * 1024 * 1024)
);

-- Append-only audit trail (mirrors aggregate audit entries, plus security events).
create table public.audit_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects (id) on delete cascade,
  actor_id uuid references public.people (id),
  action text not null,
  target_type text,
  target_id text,
  summary text not null default '',
  at timestamptz not null default now()
);
create index audit_events_project_idx on public.audit_events (project_id, at desc);

-- Metadata for uploaded source files (contents are in Storage).
create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/heic', 'text/plain')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 text,
  uploaded_by uuid not null references public.people (id),
  uploaded_at timestamptz not null default now(),
  check (storage_path like project_id::text || '/%')
);

-- AI request log (no content is stored — only what was sent where, and by whom).
create table public.ai_requests (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid not null references public.people (id),
  task text not null,
  provider text not null,
  model text not null,
  statements_sent int not null default 0,
  statements_withheld int not null default 0,
  status text not null,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, fixed search_path)
-- ---------------------------------------------------------------------------
create or replace function public.current_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.people where auth_user_id = auth.uid()
$$;

create or replace function public.is_system_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_system_admin from public.people where auth_user_id = auth.uid()), false)
$$;

create or replace function public.project_role(p_project uuid) returns public.compass_role
language sql stable security definer set search_path = public as $$
  select m.role from public.project_members m
  where m.project_id = p_project and m.person_id = public.current_person_id()
$$;

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.project_role(p_project) is not null or public.is_system_admin()
$$;

create or replace function public.can_manage_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role(p_project) in ('project_admin', 'org_admin', 'system_admin'), false)
      or public.is_system_admin()
$$;

create or replace function public.can_read_audit(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role(p_project) in ('project_admin', 'org_admin', 'system_admin', 'reviewer'), false)
      or public.is_system_admin()
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.people enable row level security;
alter table public.org_admins enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_state enable row level security;
alter table public.audit_events enable row level security;
alter table public.source_files enable row level security;
alter table public.ai_requests enable row level security;

-- Organizations: visible if you belong to any project in them.
create policy org_read on public.organizations for select to authenticated using (
  public.is_system_admin() or exists (
    select 1 from public.projects p where p.organization_id = organizations.id and public.is_project_member(p.id))
);

-- People: you can see yourself and people who share a project with you.
create policy people_read on public.people for select to authenticated using (
  auth_user_id = auth.uid() or public.is_system_admin() or exists (
    select 1 from public.project_members a
    join public.project_members b on a.project_id = b.project_id
    where a.person_id = people.id and b.person_id = public.current_person_id())
);

create policy org_admins_read on public.org_admins for select to authenticated using (public.is_system_admin() or person_id = public.current_person_id());

-- Projects: members only.
create policy projects_read on public.projects for select to authenticated using (public.is_project_member(id));

-- Membership: members can see the team. Changes go through the command API
-- (member.setRole / person.add), which checks project.manageMembers and keeps
-- the aggregate and this table in step.
create policy members_read on public.project_members for select to authenticated using (public.is_project_member(project_id));

-- Project content: read for members; NO insert/update/delete policies for
-- authenticated users — writes go through the command API (service role).
create policy state_read on public.project_state for select to authenticated using (public.is_project_member(project_id));

create policy audit_read on public.audit_events for select to authenticated using (public.can_read_audit(project_id));
create policy files_read on public.source_files for select to authenticated using (public.is_project_member(project_id));
create policy ai_read on public.ai_requests for select to authenticated using (public.can_manage_project(project_id));

-- Defence in depth: browsers never write content tables directly.
revoke insert, update, delete on public.project_members, public.project_state, public.audit_events, public.source_files, public.ai_requests, public.projects, public.people, public.organizations, public.org_admins from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Audit log is append-only for everyone, including the service role.
create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end $$;
create trigger audit_no_update before update or delete on public.audit_events
  for each row execute function public.audit_immutable();

-- Every project must keep at least one administrator.
create or replace function public.keep_one_admin() returns trigger language plpgsql as $$
declare remaining int;
begin
  select count(*) into remaining from public.project_members
   where project_id = old.project_id and role in ('project_admin', 'org_admin', 'system_admin');
  if remaining = 0 and exists (select 1 from public.projects where id = old.project_id) then
    raise exception 'a project must keep at least one administrator';
  end if;
  return null;
end $$;
create constraint trigger members_keep_admin after update or delete on public.project_members
  deferrable initially deferred for each row execute function public.keep_one_admin();

-- ---------------------------------------------------------------------------
-- Private storage for source documents
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('project-sources', 'project-sources', false, 52428800, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/heic', 'text/plain'])
    on conflict (id) do nothing;

    execute $p$
      create policy "members read project sources" on storage.objects for select to authenticated
      using (bucket_id = 'project-sources' and public.is_project_member(((storage.foldername(name))[1])::uuid))
    $p$;
    -- Uploads use signed upload URLs issued by the API after permission checks;
    -- no direct insert/update/delete policies are granted to browsers.
  end if;
end $$;
