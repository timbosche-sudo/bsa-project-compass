# Quality hardening: accessibility and performance

## Accessibility (WCAG 2.2 AA, automated)

**How it is checked.** `e2e/a11y.spec.ts` runs axe-core (`@axe-core/playwright` 4.13.0, pinned) against the WCAG 2.0/2.1/2.2 A and AA rule sets.

- **Pages:** 24, covering every stage page, source detail, Align, Reports, More tools, Drivers, Decision Lab, Dashboard, Settings and the Owner Workshop.
- **Panel:** the Thinking Partner panel with suggestion cards open.
- **Themes:** light and dark.
- **Viewports:** desktop, iPad landscape and iPad portrait, as part of the normal end-to-end run.
- **Gate:** any violation fails the test.

### What the first audit found, and the fixes

| Finding | Cause | Fix |
|---|---|---|
| **Text contrast** (41 findings, serious) | Small text set in the brand's 50% black (`text-faint`, about 3:1) and labels at 50–70% opacity | The brand permits only black at 80, 50, 25 and 10%. Text now uses 80% black (`text-muted`, about 7:1). Black-50 remains for rules and borders. De-emphasized labels and inactive states use 80% opacity or the muted tone instead of 50–70%. |
| **Touch target size** (serious) | Icon buttons around 22 px (move up/down, edit, delete) | Every small icon button is now at least 24 × 24 px |
| **Scrollable region not keyboard-focusable** (serious) | Wide tables in horizontally scrolling containers | The containers are focusable, labelled regions, so keyboard users can scroll them |

**Result:** no violations in either theme.

### Keyboard and focus (Thinking Partner)

- The Thinking Partner button exposes `aria-expanded` and `aria-controls`.
- Opening the panel moves focus to its heading. A panel restored on page load doesn't take focus.
- **Esc** closes the panel and returns focus to the button. Dialogs and text fields inside the panel keep their own Esc behaviour.
- The panel, cards, mode tabs, canvas states and exploration choices are all keyboard-operable. Controls are at least 32 px tall for touch.

### Presentation navigation

Workshop navigation by arrow keys, Page Up/Down and 1–4 now reads the current slide from the URL at the moment of the key press. Rapid presses, such as from a presentation clicker, no longer skip or repeat slides.

### Not covered by automation

Automated checks find roughly a third to a half of accessibility issues. Still to be done:

- a manual screen-reader pass (NVDA with Edge on Windows; VoiceOver on iPad);
- zoom to 400% and text-spacing checks;
- review of the 16:9 slide content. Slides use fixed brand colours and scale with the stage, and each slide's text is real, selectable text.

## Performance (start-up)

| | Before | After |
|---|---|---|
| Start-up JavaScript (main chunk) | 723 KB (217 KB gzipped) | **333 KB (106 KB gzipped)** |

What changed:

- **Demo adapter and synthetic seed** (114 KB, 31 KB gzipped) load on demand in demo mode. The secure build loads only the Supabase auth and remote adapter.
- **Thinking Partner panel and rules engine** (82 KB, 25 KB gzipped) load the first time the panel opens.
- **Project Home** is code-split like the other pages.
- **Export libraries** (PDF, PowerPoint, Word, about 1.2 MB in total) were already loaded only when an export is requested.

React, React Router, TanStack Query, zod and the domain core remain in the start-up path.

**Possible next step:** move command validation to `zod/mini`, which could save about 50 KB gzipped. Not done, because it touches every schema.
