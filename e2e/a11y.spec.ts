import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const P = '/projects/demo-pharmacy'
const PAGES = [
  '',
  'understand/evidence',
  'understand/evidence/src-2',
  'understand/themes',
  'understand/questions',
  'understand/heard',
  'interpret/point-of-view',
  'interpret/vision',
  'interpret/principles',
  'interpret/opportunities',
  'interpret/success',
  'align',
  'align/presentation',
  'align/alignment',
  'align/history',
  'reports',
  'more/from-vision-to-design',
  'more/evidence-map',
  'drivers',
  'drivers/dd-3',
  'decisions/dec-1',
  'dashboard',
  'settings',
  'workshop?slide=principle:gp-4',
]

async function scan(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`)
}

for (const theme of ['light', 'dark'] as const) {
  test(`WCAG 2.2 AA automated checks — ${theme}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.addInitScript((t) => {
      if (!sessionStorage.getItem('a11y-init')) {
        localStorage.clear()
        sessionStorage.setItem('a11y-init', '1')
      }
      localStorage.setItem('compass.theme', t)
    }, theme)
    const failures: string[] = []
    for (const path of PAGES) {
      await page.goto(`${P}/${path}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const v = await scan(page)
      if (v.length) failures.push(`/${path}\n  ${v.join('\n  ')}`)
    }
    // The Thinking Partner panel with cards open.
    await page.goto(`${P}/interpret/principles?principle=gp-1`)
    await page.getByRole('button', { name: 'Thinking Partner' }).click()
    const panel = page.getByRole('complementary', { name: 'Thinking Partner' })
    await panel.getByRole('tab', { name: 'Challenge' }).click()
    await panel.getByRole('button', { name: 'Analyze' }).click()
    await expect(panel.getByRole('article').first()).toBeVisible()
    const v = await scan(page)
    if (v.length) failures.push(`thinking partner\n  ${v.join('\n  ')}`)
    expect(failures, failures.join('\n')).toEqual([])
  })
}
