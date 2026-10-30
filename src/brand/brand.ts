/**
 * BSA brand primitives for code that cannot use CSS variables (slides with a
 * fixed presentation palette, PDF and PPTX exporters). Mirrors bsa-tokens.css.
 * Source: BSA Brand Style Guide 2026.
 */
export const BSA = {
  red: '#cc1b2d',
  white: '#ffffff',
  teal: '#56b1bf',
  grey: '#9ea09f',
  black: '#000000',
  black80: '#58595b',
  black50: '#939598',
  black25: '#c7c8ca',
  black10: '#e6e7e8',
  grey20: '#ecedec',
  teal20: '#ddeff2',
  purple: '#782076',
  navy: '#2f496e',
  darkTeal: '#3a7f8a',
  lightBlue: '#507cba',
  green: '#2bb673',
  yellow: '#fdba63',
  salmon: '#de8f70',
} as const

/** RGB triplets for jsPDF. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Typography scale for documents (Brand Style Guide p. 24–25), in points. */
export const BSA_TYPE = {
  coverTitle: { size: 36, leading: 40, weight: 'black' },
  coverSubhead: { size: 20, leading: 24, weight: 'regular' },
  headline: { size: 18, leading: 21.6, weight: 'black' },
  subhead: { size: 14, leading: 14, weight: 'black' },
  subText: { size: 12, leading: 15, weight: 'black' },
  body: { size: 10, leading: 15, weight: 'regular' },
  caption: { size: 8, leading: 9.6, weight: 'regular' },
} as const

/** Document layout (p. 26): 0.625in margins = 45pt. */
export const BSA_PRINT_MARGIN_PT = 45
