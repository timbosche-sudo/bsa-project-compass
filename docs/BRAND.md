# BSA Brand Integration

Project Compass follows the **BSA Brand Style Guide 2026** and the official BSA logo file. This document records how the standards are implemented, how other BSA Intelligence applications can reuse them, and the open items for the Visual Brand Manager to confirm.

## Sources

| Material | Location in this repo |
|---|---|
| Official logo (SVG, as supplied) | `src/brand/bsa-logo-official.svg`. The vector paths are reproduced verbatim in `src/brand/logo.ts`, and a unit test fails if they ever differ from the official file. |
| Brand Style Guide 2026 | Not committed: it is a 4.9 MB document with photography. The values used are cited by page below. |
| Lato typeface | `@fontsource/lato` for the web app. `src/brand/fonts/*.subset.ttf` (SIL Open Font License, `OFL.txt` included) for PDF embedding. |

> **Note:** a separate "BSA Intelligence Design System" file was not received with this request. The token layer below is derived from the Brand Style Guide and is structured so a design system can replace or extend it without component changes.

## Reusable token architecture

```
src/brand/bsa-tokens.css   Brand primitives (--bsa-*): palette, approved greys and screens, Lato, caps tracking, print layout
src/brand/brand.ts         The same primitives for TypeScript (slides, PDF, PPTX), plus the document type scale
src/brand/logo.ts          Official logo paths, approved color variants, rasterizer for exporters
src/brand/BsaLogo.tsx      <BsaLogo variant="auto|red|white|black"> with built-in clear space; <BsaRedBox edge="top|bottom">
src/styles/index.css       Project Compass semantic tokens (--c-*) mapped onto the --bsa-* primitives
```

To reuse it in another BSA application, copy `src/brand/`, import `bsa-tokens.css`, and map its own semantic tokens to the primitives. Components should reference semantic tokens only.

## How the standards are applied

| Standard (page) | Implementation |
|---|---|
| Primary colors red, white, teal, grey, black (p. 20) | Brand primitives. Red is reserved for the logo, the red box, and critical or not-adopted states. Teal provides interactive accents (focus, selection, meters, link underlines) and quotations. |
| Backgrounds limited to white, 20% grey, 20% teal or black (p. 20) | Light appearance: white canvas and surfaces, with 20% grey for insets, hovers and table headers. Dark appearance: black, using approved white screens (p. 23) for raised surfaces and lines. |
| Text black or white; quote text is the only teal text (pp. 20, 25) | All UI text is black or white. Secondary text uses the approved 80% and 50% black tones. Links are black with a teal underline. Verbatim stakeholder statements use the quotation style. |
| Greys only in approved tones (p. 20) | Black 80% / 50% / 25% / 10%, and white screens of 10% / 25% / 50% / 80% on black. |
| Secondary colors in lesser proportion (p. 21) | Used only for status dots, fills and 20% tints: green (approved/verified), yellow (needs refinement/awaiting), light blue (discussing/info), purple (AI suggestions), plus salmon from the BSA color library (p. 43) for "at risk". |
| Lato; Lato Black headlines; ALL CAPS titles with 100 tracking (p. 24) | Lato is the only typeface (Regular 400, Bold 700, Black 900). Page titles, card and section headings use Lato Black, and caps labels use `tracking: 0.1em`. |
| Red logo on white/light; white logo on red, dark or busy backgrounds; never red on dark or blue (pp. 11–13, 16) | `BsaLogo variant="auto"` switches red/white with the appearance. Dark slides and the black title slide use the white logo. |
| Red box, centered, touching an edge (p. 13) | The workshop title slide, the PDF report cover and the PPTX title slide use the centered red box touching the top edge. |
| Clear space equal to the inner height of the B, about half the logo height (p. 15) | Built into `BsaLogo`, and respected by the surrounding padding wherever `clearSpace={false}` is used. |
| Minimum size 0.5 in tall (p. 15) | PDF and PPTX: exactly 0.5 in. Screen sizes: see the open items. |
| No alterations, strokes, effects, taglines or lockups (pp. 10, 16, 17) | The logo is always rendered from the official paths. "Project Compass" is set apart below the logo with clear space; it is never joined into a lockup. |
| Document margins 0.625 in, 1 pt black division lines (p. 26) | PDF margins are 45 pt. Section headings are followed by a 1 pt black rule, and the footer reads "BSA \| n" as in the guide. App page tables use a black header rule. |
| Circles are perfect circles (p. 27) | Status dots and pills use perfect circles and pill shapes. Other corners are kept crisp (2–6 px radii). |
| No AI-generated imagery (p. 38) | The app contains no photography or generated imagery. Demo handwritten notes are plain SVG illustrations labelled as synthetic. |

### Accessibility substitutions (please confirm)

Some brand hues are too light for small text on white, which would fail WCAG 2.1 AA contrast. Where a status must be written in color, the app uses the **same hue multiplied by an approved black screen** (p. 23), and on black backgrounds the hue lightened by a white screen:

| Use | Value | Derivation |
|---|---|---|
| Approved / verified text | `#165b3a` | Green #2bb673 × 50% black |
| Needs-refinement text | `#7f5d32` | Yellow #fdba63 × 50% black |
| At-risk text | `#6f4838` | Salmon #de8f70 × 50% black |
| Info text | `#406395` | Light blue #507cba × 80% |
| Quotations on white | `#3a7f8a` | BSA dark teal (secondary palette), because teal #56b1bf on white is only 2.3:1 |
| Danger text on black | `#d95462` | Red + 25% white screen |
| AI text on black | `#bc90bb` | Purple + 50% white screen |

Badges keep their text black or white, carrying the color only in the tint and the dot.

## Open items for the Visual Brand Manager

1. **Logo red:** the supplied logo file uses `#de1c28`, while the guide specifies red `#cc1b2d` (Pantone 3517 C). The app renders the logo exactly as supplied and uses `#cc1b2d` for brand-red surfaces such as the red box. Please confirm which value is authoritative for screen use.
2. **On-screen minimum size:** the 0.5 in minimum is honored in PDF and PPTX. On screen, the logo is 32 px in the navigation, 26 px in the Workshop toolbar, about 2.2% of slide width in slide footers (≈ 42 px on a 1920 px display), and 4.4% of slide width in the title-slide red box. Please confirm screen minimums for digital products.
3. **Product naming:** the navigation shows "BSA Intelligence" above "Project Compass", set apart from the logo. Please confirm the family name and treatment.
4. **Design system file:** if a BSA Intelligence design system exists, share it and the primitives in `bsa-tokens.css` can be aligned to it.
5. **PowerPoint fonts:** the PPTX references "Lato" and "Lato Black", which must be installed (standard on BSA machines). PowerPoint substitutes a default font otherwise.
