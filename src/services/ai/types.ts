import { z } from 'zod'
import { nodeRefSchema } from '@/domain/schemas'
import { SUGGESTION_KINDS, type ProjectData } from '@/domain/types'

export const ASSIST_TASKS = ['suggest_relationships', 'suggest_themes', 'find_missing_requirements', 'validation_questions', 'critical_questions', 'principle_quality'] as const
export type AssistTask = (typeof ASSIST_TASKS)[number]

export const ASSIST_TASK_LABELS: Record<AssistTask, string> = {
  suggest_relationships: 'Identify related evidence',
  suggest_themes: 'Suggest thematic groupings',
  find_missing_requirements: 'Find requirements missing from the framework',
  validation_questions: 'Recommend validation questions',
  critical_questions: 'Raise critical questions (tensions, missing voices, solutions vs needs)',
  principle_quality: 'Review principle quality (distinct, grounded, balanced, clear)',
}

/** Structured output contract. Anything a provider returns is validated before it can be persisted. */
export const suggestionOutputSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS),
  title: z.string().min(1).max(300),
  body: z.string().max(4000),
  evidence: z.array(nodeRefSchema).max(40),
  target: nodeRefSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
})
export const assistOutputSchema = z.object({ suggestions: z.array(suggestionOutputSchema).max(50) })
export type SuggestionOutput = z.infer<typeof suggestionOutputSchema>

export interface AssistProvider {
  readonly id: string
  readonly label: string
  /** 'rules' = deterministic heuristics, no model. 'ai' = approved model behind the server. */
  readonly origin: 'rules' | 'ai'
  run(task: AssistTask, data: ProjectData): Promise<SuggestionOutput[]>
}
