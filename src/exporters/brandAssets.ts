import type { jsPDF } from 'jspdf'
import blackUrl from '@/brand/fonts/Lato-Black.subset.ttf?url'
import italicUrl from '@/brand/fonts/Lato-Italic.subset.ttf?url'
import regularUrl from '@/brand/fonts/Lato-Regular.subset.ttf?url'
import { logoPng, type LogoVariant } from '@/brand/logo'

/**
 * Brand assets for document exporters: Lato (OFL, subset to Latin-1 plus
 * typographic punctuation) and rasterized official logos. Loaded on demand
 * and cached for the session.
 */
let fonts: Promise<Record<string, string>> | null = null
const logos = new Map<string, Promise<string>>()

async function toBase64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function registerLato(pdf: jsPDF) {
  fonts ??= (async () => ({
    'Lato-Regular.ttf': await toBase64(regularUrl),
    'Lato-Black.ttf': await toBase64(blackUrl),
    'Lato-Italic.ttf': await toBase64(italicUrl),
  }))()
  const f = await fonts
  for (const [name, data] of Object.entries(f)) pdf.addFileToVFS(name, data)
  pdf.addFont('Lato-Regular.ttf', 'Lato', 'normal')
  // Brand headings and emphasis use Lato Black.
  pdf.addFont('Lato-Black.ttf', 'Lato', 'bold')
  pdf.addFont('Lato-Italic.ttf', 'Lato', 'italic')
}

export function brandLogo(variant: LogoVariant): Promise<string> {
  if (!logos.has(variant)) logos.set(variant, logoPng(variant, 480))
  return logos.get(variant)!
}
