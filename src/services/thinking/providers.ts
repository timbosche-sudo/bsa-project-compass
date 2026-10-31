import type { DataAdapter } from '@/data/adapter'
import { nodeExists } from '@/domain/traceability'
import type { ProjectData, ThinkingMode } from '@/domain/types'
import { suggestionOutputSchema, type SuggestionOutput } from '@/services/ai/types'
import { buildProjectContext, type ProjectContext } from './context'
import { analyze, RULES_PROVIDER_LABEL, type AnalysisRequest, type AnalysisResult } from './engine'

/**
 * Thinking Partner provider abstraction.
 *
 *   Analysis interface (UI)  →  ThinkingProvider.analyze(request)
 *                                  ├─ RulesThinkingProvider   (available now, in the browser, no network)
 *                                  └─ ApprovedAiThinkingProvider (disabled until an approved provider and server endpoint exist)
 *   Every provider's output   →  validateSuggestions()  →  suggestion.add  →  human review
 *
 * A model-backed provider must run server-side: the browser sends only the
 * request; the server builds the context from stored data, filters it by the
 * project's confidentiality policy, calls the approved model, validates the
 * structured output and returns suggestions. No keys or model calls in the client.
 */
export interface ProviderStatus {
  available: boolean
  reason?: string
}

export interface ThinkingProvider {
  readonly id: string
  readonly label: string
  /** How results are labelled on cards. */
  readonly method: 'rules' | 'ai'
  status(): ProviderStatus
  analyze(data: ProjectData, request: AnalysisRequest): Promise<AnalysisResult>
  /** The structured context the provider reads, for display and for a future server call. */
  context(data: ProjectData, request: AnalysisRequest): ProjectContext
}

export class RulesThinkingProvider implements ThinkingProvider {
  readonly id = 'evidence-intelligence-v2'
  readonly label = RULES_PROVIDER_LABEL
  readonly method = 'rules' as const
  status() {
    return { available: true }
  }
  context(data: ProjectData, r: AnalysisRequest) {
    return buildProjectContext(data, r.workspace, r.mode, r.focus)
  }
  async analyze(data: ProjectData, r: AnalysisRequest) {
    const result = await analyze(data, r)
    return { ...result, suggestions: validateSuggestions(result.suggestions, data) }
  }
}

/** Model-only capabilities per mode. Shown disabled; never simulated. */
export const MODEL_ONLY: Record<ThinkingMode, string[]> = {
  explore: ['Find semantic connections between statements that share no words', 'Summarize long transcripts into candidate statements'],
  challenge: ['Critique the direction as an experienced planner would', 'Find blind spots across all evidence'],
  develop: ['Draft alternative points of view and vision narratives from the evidence', 'Suggest design opportunities and outcomes in the project’s language'],
  refine: ['Propose clearer wording for a principle', 'Combine competing alternatives into one draft'],
}

/**
 * Placeholder for a future approved, server-side model. It is never available
 * in this build: no provider has been approved, and the server endpoint for
 * Thinking Partner analyses does not exist yet.
 */
export class ApprovedAiThinkingProvider implements ThinkingProvider {
  readonly id = 'approved-ai'
  readonly label = 'Approved AI provider (server-side)'
  readonly method = 'ai' as const
  constructor(private adapter: DataAdapter) {}
  status(): ProviderStatus {
    if (this.adapter.mode !== 'remote') return { available: false, reason: 'Requires an approved AI provider. This demonstration has no AI connection.' }
    return { available: false, reason: 'Requires an approved AI provider and a server-side Thinking Partner endpoint, which are not yet in place.' }
  }
  context(data: ProjectData, r: AnalysisRequest) {
    return buildProjectContext(data, r.workspace, r.mode, r.focus)
  }
  async analyze(): Promise<AnalysisResult> {
    throw new Error(this.status().reason)
  }
}

export function thinkingProviders(adapter: DataAdapter) {
  return { rules: new RulesThinkingProvider(), ai: new ApprovedAiThinkingProvider(adapter) }
}

/**
 * Suggestion validation, applied to every provider's output before anything is
 * stored: structure, allowed kinds and actions, and references that must exist
 * in this project. Invalid suggestions are dropped, never repaired by guessing.
 */
export function validateSuggestions(out: SuggestionOutput[], data: ProjectData): SuggestionOutput[] {
  return out.filter((s) => {
    const parsed = suggestionOutputSchema.safeParse(s)
    if (!parsed.success) return false
    const refs = [...s.evidence, ...(s.target ? [s.target] : []), ...(s.card?.scope.focus ? [s.card.scope.focus] : [])]
    if (!refs.every((r) => nodeExists(data, r))) return false
    if (s.card) {
      const hasStatements = s.evidence.some((e) => e.type === 'statement')
      // The evidence label must match what is actually cited.
      if (s.card.evidenceStatus === 'direct' && !hasStatements) return false
      if (s.card.evidenceStatus === 'inference' && s.evidence.length) return false
    }
    return true
  })
}
