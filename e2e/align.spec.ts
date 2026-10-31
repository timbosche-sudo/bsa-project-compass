import JSZip from 'jszip'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const P = '/projects/demo-pharmacy'
const W = `${P}/workshop`

async function fresh(page: Page, path: string) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(path)
}

async function zipText(path: string, file: RegExp) {
  const zip = await JSZip.loadAsync(readFileSync(path))
  const names = Object.keys(zip.files).filter((n) => file.test(n))
  return (await Promise.all(names.map((n) => zip.file(n)!.async('string')))).join(' ')
}

test('the Owner presentation tells a four-chapter story and chapters are one key away', async ({ page }) => {
  await fresh(page, `${W}?slide=title`)
  const stage = page.getByTestId('slide-stage')
  await expect(stage).toBeVisible()
  const rail = page.getByRole('navigation', { name: 'Slides' })
  for (const c of ['1. What We Heard', '2. What We Believe', '3. What Will Guide Us', '4. What Success Could Look Like']) await expect(rail).toContainText(c)
  await page.keyboard.press('p')
  await expect(page.getByTestId('present-mode')).toBeVisible()
  await page.keyboard.press('2')
  await expect(page).toHaveURL(/slide=chapter(%3A|:)2/)
  await expect(stage).toContainText('Our interpretation, and the direction we recommend.')
  await page.keyboard.press('ArrowRight')
  await expect(stage).toContainText('Make the promise behind every dose unbreakable')
  await page.keyboard.press('1')
  await expect(page).toHaveURL(/slide=chapter(%3A|:)1/)
  await expect(stage).toContainText('What you told us matters most.')
  await page.keyboard.press('ArrowRight')
  await expect(stage).toContainText('Key aspirations')
  await expect(stage).toContainText('“Every patient is waiting on a specific dose')
  // Unreviewed, rules-generated items never reach the Owner.
  await expect(stage).not.toContainText('Patient and community voices')
  await page.keyboard.press('4')
  await expect(page).toHaveURL(/slide=chapter(%3A|:)4/)
  await expect(stage).toContainText('What Success Could Look Like')
  await page.keyboard.press('ArrowRight')
  await expect(stage).toContainText('If we deliver on this vision, what should be different or better?')
})

test('Owner responses are captured while presenting and drive the live alignment slide', async ({ page }) => {
  await fresh(page, `${W}?slide=principle:gp-6`)
  await expect(page.getByTestId('slide-stage')).toBeVisible()
  const panel = page.getByRole('complementary', { name: 'Facilitator panel' })
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /Show facilitator panel/ }).click()
  await panel.getByRole('tab', { name: 'Session' }).click()
  await panel.getByRole('button', { name: 'Start session' }).click()
  await expect(page.getByText(/Live · WS-02/)).toBeVisible()

  await page.keyboard.press('p')
  await expect(page.getByTestId('present-mode')).toBeVisible()
  await page.keyboard.press('a')
  const capture = page.getByRole('region', { name: 'Owner response to GP-06' })
  await capture.getByRole('radio', { name: 'Aligned with refinements' }).click()
  await expect(capture.getByRole('radio', { name: 'Aligned with refinements' })).toHaveAttribute('aria-checked', 'true')
  await capture.getByRole('textbox', { name: 'GP-06 Requested refinements' }).fill('Say “early validation”, not “decisions made quickly”.')
  await capture.getByRole('textbox', { name: 'GP-06 Feedback' }).click()
  await expect(capture.getByText(/Recorded by Avery Lindqvist/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(capture).toHaveCount(0)
  await page.keyboard.press('End')
  const stage = page.getByTestId('slide-stage')
  await expect(stage).toContainText('Where we landed')
  await expect(stage).toContainText(/Aligned with refinements\s*1\s*GP-06/)
  await page.keyboard.press('Escape')

  await page.goto(`${P}/align/alignment`)
  const row = page.getByRole('row').filter({ hasText: 'GP-06' })
  await expect(row).toContainText('Aligned with refinements')
  await expect(row).toContainText('early validation')
  // The proposed direction was preserved when the session started.
  await page.goto(`${P}/align/history`)
  await expect(page.getByRole('list', { name: 'Saved versions' })).toContainText('As presented — WS-02')
})

test('an aligned direction cannot be recorded while items are unreviewed; saved versions can be restored as new versions', async ({ page }) => {
  await fresh(page, `${P}/align/alignment`)
  await expect(page.getByRole('button', { name: 'Record aligned direction' })).toBeDisabled()
  await expect(page.getByText('Not yet aligned')).toBeVisible()

  await page.goto(`${P}/interpret/principles?principle=gp-3`)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Statement').fill('Growth and automation refresh happen without interrupting service.')
  await page.getByRole('dialog').getByRole('button', { name: /Save/ }).click()

  await page.goto(`${P}/align/history`)
  await expect(page.getByText('Changed since').first()).toBeVisible()
  await page.getByRole('button', { name: 'Restore this wording' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restore as new versions' }).click()
  await expect(page.getByText(/Restored from DIR-01/).first()).toBeVisible()
  await page.goto(`${P}/interpret/principles?principle=gp-3`)
  await expect(page.getByText('The facility absorbs growth and technology change without interrupting service.').first()).toBeVisible()

  await page.goto(`${P}/align/history`)
  await page.getByRole('button', { name: 'Save current direction' }).click()
  await page.getByRole('dialog').getByLabel('Label').fill('Revision after DD review')
  await page.getByRole('dialog').getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('list', { name: 'Saved versions' })).toContainText('Revision after DD review')
})

test('deliverables download as valid, editable files', async ({ page }) => {
  await fresh(page, `${P}/reports`)
  const card = (name: RegExp) => page.locator('section').filter({ has: page.getByRole('heading', { name }) }).last()

  const [pptx] = await Promise.all([page.waitForEvent('download'), card(/Owner Alignment Presentation/).getByRole('button', { name: 'Download PPTX' }).click()])
  expect(pptx.suggestedFilename()).toMatch(/owner-alignment-presentation-DEMO-.*\.pptx$/)
  const slides = await zipText((await pptx.path())!, /^ppt\/slides\/slide\d+\.xml$/)
  for (const t of ['What We Heard', 'What We Believe', 'What Will Guide Us', 'What Success Could Look Like', 'Every Dose. Every Patient. Every Tomorrow.']) expect(slides).toContain(t)

  const [docx] = await Promise.all([page.waitForEvent('download'), card(/and Principles Document/).getByRole('button', { name: 'Download Word' }).click()])
  expect(docx.suggestedFilename()).toMatch(/vision-and-principles-DEMO-.*\.docx$/)
  const body = await zipText((await docx.path())!, /^word\/document\.xml$/)
  for (const t of ['Why it matters', 'Emerging design implications', 'Key evidence', 'Working draft — not yet aligned with the Owner']) expect(body).toContain(t)

  const [pdf] = await Promise.all([page.waitForEvent('download'), card(/Internal Synthesis Report/).getByRole('button', { name: 'Download PDF' }).click()])
  expect(pdf.suggestedFilename()).toMatch(/internal-synthesis-report-DEMO-.*\.pdf$/)
  const bytes = readFileSync((await pdf.path())!)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(bytes.length).toBeGreaterThan(20000)

  const [sum] = await Promise.all([page.waitForEvent('download'), card(/Workshop Summary/).getByRole('button', { name: 'Word', exact: true }).click()])
  expect(await zipText((await sum.path())!, /^word\/document\.xml$/)).toContain('Remaining strategic questions')
})
