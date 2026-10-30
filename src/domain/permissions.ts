import type { Membership, Person, Project, Role } from './types'

/**
 * Capability-based authorization. The same table is enforced by the command
 * handler (server-side in production) and mirrored by Postgres RLS policies
 * in `supabase/migrations`. UI checks are a convenience only.
 */
export const CAPABILITIES = [
  'project.read',
  'project.configure',
  'project.manageMembers',
  'source.create',
  'source.edit',
  'source.delete',
  'statement.create',
  'statement.verify',
  'relationship.propose',
  'relationship.review',
  'theme.edit',
  'framework.edit',
  'framework.approve',
  'driver.edit',
  'driver.approve',
  'driver.recordMeasurement',
  'driver.verify',
  'decision.edit',
  'decision.recommend',
  'decision.approve',
  'comment.create',
  'suggestion.request',
  'suggestion.review',
  'report.export',
  'audit.read',
] as const
export type Capability = (typeof CAPABILITIES)[number]

const READ: Capability[] = ['project.read', 'report.export']
const CONTRIBUTE: Capability[] = [
  ...READ,
  'source.create',
  'statement.create',
  'relationship.propose',
  'comment.create',
  'suggestion.request',
]
const EDIT: Capability[] = [
  ...CONTRIBUTE,
  'source.edit',
  'statement.verify',
  'relationship.review',
  'theme.edit',
  'framework.edit',
  'driver.edit',
  'driver.recordMeasurement',
  'decision.edit',
  'decision.recommend',
  'suggestion.review',
]
const REVIEW: Capability[] = [
  ...READ,
  'comment.create',
  'statement.verify',
  'relationship.review',
  'framework.approve',
  'driver.approve',
  'driver.verify',
  'decision.approve',
  'suggestion.review',
  'audit.read',
]
const PROJECT_ADMIN: Capability[] = [
  ...new Set<Capability>([...EDIT, ...REVIEW, 'project.configure', 'project.manageMembers', 'source.delete']),
]

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  system_admin: new Set(CAPABILITIES),
  org_admin: new Set(CAPABILITIES),
  project_admin: new Set(PROJECT_ADMIN),
  editor: new Set(EDIT),
  contributor: new Set(CONTRIBUTE),
  reviewer: new Set(REVIEW),
  viewer: new Set(READ),
}

export const ROLE_LABELS: Record<Role, string> = {
  system_admin: 'System Administrator',
  org_admin: 'Organization Administrator',
  project_admin: 'Project Administrator',
  editor: 'Editor',
  contributor: 'Contributor',
  reviewer: 'Reviewer / Approver',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  system_admin: 'Platform operations across all organizations.',
  org_admin: 'Manages projects and people within the organization.',
  project_admin: 'Configures the project, team and terminology; full edit and approval.',
  editor: 'Creates and edits sources, themes, principles, drivers and decisions.',
  contributor: 'Adds sources, statements, comments and proposed relationships.',
  reviewer: 'Reviews and formally approves principles, targets, verifications and decisions.',
  viewer: 'Read-only access and exports.',
}

export function roleFor(project: Project, personId: string | null | undefined): Role | null {
  if (!personId) return null
  return project.members.find((m: Membership) => m.personId === personId)?.role ?? null
}

export function can(role: Role | null, capability: Capability): boolean {
  if (!role) return false
  return ROLE_CAPABILITIES[role].has(capability)
}

export class PermissionError extends Error {
  constructor(
    public readonly capability: Capability,
    actor: Person | string,
  ) {
    super(`Not permitted: ${typeof actor === 'string' ? actor : actor.name} lacks "${capability}".`)
    this.name = 'PermissionError'
  }
}
