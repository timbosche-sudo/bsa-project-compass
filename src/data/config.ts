import type { DataMode } from './adapter'

export interface AppConfig {
  mode: DataMode
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  /** Identity provider configured in Supabase Auth (e.g. "azure" for Microsoft Entra ID). */
  identityProvider: string
  /** Set when remote mode was requested but is not fully configured. */
  configError: string | null
}

export function readConfig(env: Record<string, string | undefined> = import.meta.env): AppConfig {
  const requested = (env.VITE_DATA_MODE ?? 'demo').toLowerCase()
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || null
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || null
  const identityProvider = env.VITE_IDENTITY_PROVIDER?.trim() || 'azure'
  if (requested === 'supabase') {
    const missing = [!supabaseUrl && 'VITE_SUPABASE_URL', !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean)
    if (missing.length) {
      return { mode: 'remote', supabaseUrl, supabaseAnonKey, identityProvider, configError: `Secure mode requested but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.` }
    }
    if (supabaseUrl && !supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://localhost')) {
      return { mode: 'remote', supabaseUrl, supabaseAnonKey, identityProvider, configError: 'VITE_SUPABASE_URL must use HTTPS.' }
    }
    return { mode: 'remote', supabaseUrl, supabaseAnonKey, identityProvider, configError: null }
  }
  return { mode: 'demo', supabaseUrl: null, supabaseAnonKey: null, identityProvider, configError: null }
}
