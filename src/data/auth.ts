/**
 * Minimal Supabase Auth (GoTrue) client using the OAuth PKCE flow against the
 * organization-approved identity provider. Access tokens are kept in memory;
 * only the refresh token is kept in sessionStorage (cleared when the tab closes).
 *
 * STATUS: written against the documented GoTrue endpoints but not yet verified
 * against a provisioned project. See docs/SECURITY.md.
 */
const VERIFIER_KEY = 'compass.pkce.verifier'
const REFRESH_KEY = 'compass.refresh'

export interface Session {
  accessToken: string
  expiresAt: number
  userId: string
  email: string
}

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class SupabaseAuth {
  private session: Session | null = null

  constructor(
    private url: string,
    private anonKey: string,
    private provider: string,
  ) {}

  async signIn(): Promise<never> {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    const redirect = window.location.origin + window.location.pathname
    const q = new URLSearchParams({ provider: this.provider, redirect_to: redirect, code_challenge: challenge, code_challenge_method: 's256' })
    window.location.assign(`${this.url}/auth/v1/authorize?${q}`)
    return new Promise<never>(() => {})
  }

  /** Completes a redirect sign-in or refreshes an existing session. */
  async restore(): Promise<Session | null> {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const verifier = sessionStorage.getItem(VERIFIER_KEY)
      sessionStorage.removeItem(VERIFIER_KEY)
      window.history.replaceState(null, '', window.location.pathname)
      if (verifier) return this.token('pkce', { auth_code: code, code_verifier: verifier })
    }
    const refresh = sessionStorage.getItem(REFRESH_KEY)
    return refresh ? this.token('refresh_token', { refresh_token: refresh }) : null
  }

  async accessToken(): Promise<string> {
    if (this.session && this.session.expiresAt - 60_000 > Date.now()) return this.session.accessToken
    const s = await this.restore()
    if (!s) throw new Error('Your session has expired. Please sign in again.')
    return s.accessToken
  }

  async signOut() {
    const token = this.session?.accessToken
    this.session = null
    sessionStorage.removeItem(REFRESH_KEY)
    if (token) await fetch(`${this.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: this.anonKey, Authorization: `Bearer ${token}` } }).catch(() => {})
  }

  private async token(grant: string, body: Record<string, string>): Promise<Session | null> {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      sessionStorage.removeItem(REFRESH_KEY)
      return null
    }
    const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } }
    sessionStorage.setItem(REFRESH_KEY, j.refresh_token)
    this.session = { accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000, userId: j.user.id, email: j.user.email }
    return this.session
  }
}
