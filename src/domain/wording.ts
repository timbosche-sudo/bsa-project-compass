import type { GuidingPrinciple, WinTheme } from './types'

/**
 * Canonical wording of a Win Theme or Guiding Principle. Approval freezes
 * exactly this text, and approvals are refused if it changed after it was
 * shown to the approver.
 */
export function wordingOf(e: Pick<WinTheme, 'statement' | 'narrative'> | Pick<GuidingPrinciple, 'title' | 'statement' | 'intent'>): string {
  if ('title' in e) return [e.title, e.statement, e.intent].map((s) => s.trim()).join('\n\n')
  return [e.statement, e.narrative].map((s) => s.trim()).join('\n\n')
}

/** Active framework items: not superseded and not rejected ("Not Adopted"). */
export function isActiveFramework(status: string): boolean {
  return status !== 'superseded' && status !== 'not_adopted'
}
