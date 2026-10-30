import type { DataAdapter } from '@/data/adapter'
import type { ProjectData } from '@/domain/types'
import { RemoteAiProvider } from './remoteProvider'
import { RulesProvider } from './rulesProvider'
import type { AssistProvider } from './types'

export * from './types'

/**
 * Selects the assistant for a project. AI is optional: only when the secure
 * backend exposes the assist endpoint AND the project's AI policy is enabled
 * is the server-side model used. Otherwise the deterministic rules provider
 * runs locally and every core workflow remains available.
 */
export function assistProviderFor(adapter: DataAdapter, data: ProjectData): AssistProvider {
  if (adapter.mode === 'remote' && adapter.assist && data.project.aiPolicy.enabled) {
    const assist = adapter.assist.bind(adapter)
    return new RemoteAiProvider((projectId, task) => assist(projectId, task))
  }
  return new RulesProvider()
}
