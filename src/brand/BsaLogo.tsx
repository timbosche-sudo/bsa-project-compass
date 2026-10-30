import { BSA } from './brand'
import { BSA_LOGO_ASPECT, BSA_LOGO_PATHS, BSA_LOGO_VIEWBOX, LOGO_FILL, type LogoVariant } from './logo'

type Length = number | string
const css = (v: Length) => (typeof v === 'number' ? `${v}px` : v)

/**
 * Official BSA logo (Brand Style Guide 2026, pp. 10–15).
 * - `auto`: red logo in light appearance, white logo in dark appearance
 *   (the red logo must never sit on dark or blue backgrounds).
 * - Clear space of half the logo height is applied by default; pass
 *   `clearSpace={false}` only when the surrounding layout guarantees it.
 * - Never add strokes, effects, text or taglines, or change proportions.
 */
export function BsaLogo({ variant = 'auto', height = 32, clearSpace = true, title = 'BSA', className }: { variant?: LogoVariant | 'auto'; height?: Length; clearSpace?: boolean; title?: string; className?: string }) {
  const h = css(height)
  const svg = (v: LogoVariant, extra: string) => (
    <svg viewBox={BSA_LOGO_VIEWBOX} role="img" aria-label={title} className={extra} style={{ height: h, width: `calc(${h} * ${BSA_LOGO_ASPECT})` }}>
      <g fill={LOGO_FILL[v]}>
        {BSA_LOGO_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  )
  return (
    <span className={className} style={{ display: 'inline-block', padding: clearSpace ? `calc(${h} / 2)` : 0, lineHeight: 0 }}>
      {variant === 'auto' ? (
        <>
          {svg('red', 'block dark:hidden')}
          {svg('white', 'hidden dark:block')}
        </>
      ) : (
        svg(variant, 'block')
      )}
    </span>
  )
}

/**
 * Red-box logo, centered — the only public red-box variation (p. 13).
 * The box must touch an edge of the page or surface, centered at top or bottom.
 */
export function BsaRedBox({ height = 40, edge = 'top', className }: { height?: Length; edge?: 'top' | 'bottom'; className?: string }) {
  const h = css(height)
  return (
    <div className={className} style={{ display: 'flex', justifyContent: 'center', alignItems: edge === 'top' ? 'flex-start' : 'flex-end' }}>
      <div style={{ background: BSA.red, padding: `calc(${h} * 0.6) calc(${h} * 0.8)`, lineHeight: 0 }}>
        <BsaLogo variant="white" height={height} clearSpace={false} />
      </div>
    </div>
  )
}
