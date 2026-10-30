import { expect, test, type Page } from '@playwright/test'

const P = '/projects/demo-pharmacy'

async function fresh(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(P)
  await expect(page.getByRole('heading', { level: 1, name: 'Specialty Pharmacy Fulfillment Center' })).toBeVisible()
}

test.beforeEach(async ({ page }) => fresh(page))

test('Project Home shows the stage, working vision, readiness and no task counts', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Project stages' })).toContainText('Understand')
  await expect(page.getByText('Every Dose. Every Patient. Every Tomorrow.')).toBeVisible()
  await expect(page.getByText('A qualitative check — not a score.')).toBeVisible()
  await expect(page.getByText(/awaiting review/i)).toHaveCount(0)
})

test('Understand: compose What We Heard with evidence and preview it for the Owner', async ({ page }) => {
  await page.goto(`${P}/understand/heard`)
  await page.getByRole('button', { name: 'Add to Critical tensions' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Title').fill('Night shift feels unseen')
  await dlg.getByLabel('Narrative').fill('Night-shift staff describe the facility as designed for the day shift.')
  await dlg.getByRole('button', { name: 'Add item' }).click()
  const item = page.getByRole('listitem').filter({ hasText: 'Night shift feels unseen' })
  await item.getByRole('button', { name: 'Statements…' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Filter').fill('ST-019')
  await picker.getByRole('checkbox').first().check()
  await picker.getByRole('button', { name: 'Save evidence' }).click()
  await expect(item.getByRole('link', { name: /ST-019/ })).toBeVisible()
  await page.reload()
  await page.getByRole('radio', { name: 'Owner-ready preview' }).click()
  const preview = page.getByRole('region', { name: 'Critical tensions' })
  await expect(preview).toContainText('Night shift feels unseen')
  // Unreviewed, rules-generated items never reach the Owner view.
  await expect(page.getByText('Patient and community voices are largely absent')).toHaveCount(0)
})

test('Understand: the Thinking Partner raises questions that become open questions only when accepted', async ({ page }) => {
  await page.goto(`${P}/understand/questions`)
  const panel = page.locator('section').filter({ hasText: 'Suggestions for review' }).first()
  await panel.getByRole('combobox', { name: 'Assistant task' }).selectOption({ label: 'Raise critical questions (tensions, missing voices, solutions vs needs)' })
  await panel.getByRole('button', { name: 'Analyze' }).click()
  const suggestion = panel.getByRole('listitem').filter({ hasText: 'No statements attributed to: Patients' })
  await expect(suggestion).toBeVisible()
  await suggestion.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByText(/Should we seek input from patients, families or caregivers/)).toBeVisible()
})

test('Interpret: point of view keeps one recommended direction and versions edits', async ({ page }) => {
  await page.goto(`${P}/interpret/point-of-view`)
  await page.getByRole('button', { name: 'Edit Central ambition' }).click()
  await page.getByRole('textbox', { name: 'Central ambition' }).fill('Make every dose a promise kept.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Make every dose a promise kept.').first()).toBeVisible()
  await expect(page.getByText(/2 saved versions/)).toBeVisible()
  await page.getByRole('button', { name: 'Recommend', exact: true }).first().click()
  await expect(page.getByText('Recommended', { exact: true }).filter({ visible: true })).toHaveCount(2) // badge + pressed button
})

test('Interpret: principle support text is editable without changing the versioned wording', async ({ page }) => {
  await page.goto(`${P}/interpret/principles?principle=gp-2`)
  const version = await page.locator('.code-tag').filter({ hasText: 'GP-02' }).last().textContent()
  await page.getByRole('button', { name: 'Edit Why it matters' }).click()
  await page.getByRole('textbox', { name: 'Why it matters' }).fill('Seven crossings were observed at the morning peak.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Seven crossings were observed at the morning peak.')).toBeVisible()
  await expect(page.locator('.code-tag').filter({ hasText: 'GP-02' }).last()).toHaveText(version!)
})

test('Interpret to design: add an opportunity and outcome, then record evidence of progress', async ({ page }) => {
  await page.goto(`${P}/interpret/opportunities`)
  await page.getByRole('button', { name: 'Add opportunity for GP-05' }).click()
  await expect(page.getByRole('heading', { name: 'New design opportunity' })).toBeVisible()
  await page.goto(`${P}/interpret/success`)
  await page.getByRole('button', { name: 'Add potential outcome for GP-05' }).click()
  await expect(page.getByText('Describe what would be different if this succeeds.')).toBeVisible()
  await page.goto(`${P}/more/from-vision-to-design`)
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: /Speed with Certainty/ }) })
  await card.getByText('Evidence of progress (1)').click()
  await card.getByRole('button', { name: 'Add evidence of progress' }).click()
  await card.getByRole('textbox', { name: 'What was observed' }).fill('Owner confirmed the decision schedule at the coordination meeting.')
  await card.getByRole('button', { name: 'Record' }).click()
  await expect(card.getByText('Owner confirmed the decision schedule')).toBeVisible()
  await expect(card.getByText('Evidence of progress (2)')).toBeVisible()
})

test('Model-only features are labelled and disabled', async ({ page }) => {
  await page.goto(`${P}/interpret/principles`)
  await page.getByRole('button', { name: 'Thinking Partner' }).click()
  const drawer = page.getByRole('dialog', { name: 'Thinking Partner' })
  await expect(drawer.getByText('Requires an approved AI provider')).toBeVisible()
  await expect(drawer.getByRole('button', { name: /Draft “why it matters”/ })).toBeDisabled()
})
