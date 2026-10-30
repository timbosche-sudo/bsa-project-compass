/** Opaque unique identifier (UUID when available). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Next human-readable code in a sequence, e.g. nextCode('DD', ['DD-01','DD-07']) → 'DD-08'. */
export function nextCode(prefix: string, existing: string[], width = 2): string {
  const max = existing.reduce((m, code) => {
    const match = code.match(new RegExp(`^${prefix}-(\\d+)$`))
    return match ? Math.max(m, Number(match[1])) : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
