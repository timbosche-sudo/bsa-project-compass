import { describe, expect, it } from 'vitest'
import official from '@/brand/bsa-logo-official.svg?raw'
import { BSA_LOGO_FILE_RED, BSA_LOGO_PATHS, BSA_LOGO_VIEWBOX } from '@/brand/logo'

describe('BSA logo', () => {
  it('uses the official vector paths, proportions and color exactly as supplied', () => {
    const paths = [...official.matchAll(/<path class="cls-1" d="([^"]+)"/g)].map((m) => m[1])
    expect(paths).toEqual([...BSA_LOGO_PATHS])
    expect(official).toContain(`viewBox="${BSA_LOGO_VIEWBOX}"`)
    expect(official).toContain(`fill: ${BSA_LOGO_FILE_RED}`)
  })
})
