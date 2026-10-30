import type { ProjectData } from '@/domain/types'
import { assistOutputSchema, type AssistProvider, type AssistTask, type SuggestionOutput } from './types'

/**
 * Calls the server-side assist endpoint. The server — never the browser —
 * holds provider credentials, filters content by confidentiality policy,
 * treats source text as untrusted data, and validates model output.
 * The response is validated again here before it is shown or persisted.
 */
export class RemoteAiProvider implements AssistProvider {
  readonly id = 'server-ai'
  readonly label = 'Approved AI provider (server-side)'
  readonly origin = 'ai' as const

  constructor(private assist: (projectId: string, task: AssistTask) => Promise<unknown>) {}

  async run(task: AssistTask, data: ProjectData): Promise<SuggestionOutput[]> {
    const raw = await this.assist(data.project.id, task)
    const parsed = assistOutputSchema.safeParse(raw)
    if (!parsed.success) throw new Error('The assistant returned output that failed validation and was discarded.')
    return parsed.data.suggestions
  }
}
