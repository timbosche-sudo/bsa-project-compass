import { expect, test, type Page } from '@playwright/test'

const P = '/projects/demo-pharmacy'

async function fresh(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${P}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Specialty Pharmacy Fulfillment Center' })).toBeVisible()
}

async function persona(page: Page, name: string) {
  await page.getByRole('button', { name: 'Identity and role' }).click()
  await page.getByRole('menuitem', { name: new RegExp(name) }).click()
}

test.beforeEach(async ({ page }) => fresh(page))

test('navigates every primary section with breadcrumbs and search', async ({ page }) => {
  const sections = ['Project Intelligence', 'Alignment Studio', 'Vision & Principles', 'Design Drivers', 'Decision Lab', 'Success Dashboard', 'Reports', 'Project Settings']
  for (const s of sections) {
    await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name: s }).click()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(s === 'Reports' ? 'Reports' : s)
  }
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search query' }).fill('DD-07')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Daylight and views for staff' })).toBeVisible()
})

test('registers a source, records a verbatim statement and keeps it after reload', async ({ page }) => {
  await page.goto(`${P}/intelligence`)
  await page.getByRole('button', { name: 'Register source' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Title').fill('Synthetic follow-up interview')
  await dlg.getByRole('button', { name: 'Register source' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Synthetic follow-up interview' })).toBeVisible()
  await page.getByRole('button', { name: 'Record statement' }).click()
  await page.getByRole('dialog').getByLabel('Original wording (verbatim)').fill('We need the night shift to feel safe arriving.')
  await page.getByRole('dialog').getByRole('button', { name: 'Record statement' }).click()
  await expect(page.getByText('“We need the night shift to feel safe arriving.”')).toBeVisible()
  await page.reload()
  await expect(page.getByText('“We need the night shift to feel safe arriving.”')).toBeVisible()
  await expect(page.getByText('Orphaned — not yet linked')).toBeVisible()
})

test('corrects and verifies a handwritten transcription beside the image', async ({ page }) => {
  await page.goto(`${P}/intelligence/src-2`)
  await expect(page.getByRole('img', { name: /original photograph/ })).toBeVisible()
  const row = page.locator('#stmt-st-8')
  await expect(row.getByRole('button', { name: 'Verify' })).toBeDisabled()
  await row.getByRole('button', { name: 'Correct' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Words still uncertain').fill('')
  await dlg.getByLabel('Reason for correction').fill('Confirmed with facilitator')
  await dlg.getByRole('button', { name: 'Save correction' }).click()
  await row.getByRole('button', { name: 'Verify' }).click()
  await expect(row.getByText('Transcription: Verified')).toBeVisible()
  await row.getByRole('button', { name: /revision/ }).click()
  await expect(row.getByText('Confirmed with facilitator')).toBeVisible()
})

test('enforces roles: viewers cannot edit; reviewers approve; approved text is locked', async ({ page }) => {
  await persona(page, 'Casey Brandt')
  await page.goto(`${P}/drivers`)
  await expect(page.getByRole('button', { name: /New design driver/ })).toHaveCount(0)

  await persona(page, 'Dr. Morgan Ellery')
  await page.goto(`${P}/vision`)
  await page.getByRole('button', { name: 'Approve' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(/Approved v4 by Dr. Morgan Ellery/)).toBeVisible()
  await persona(page, 'Jordan Okafor')
  await page.goto(`${P}/vision`)
  const wt = page.locator('section[aria-labelledby="wt"]')
  await expect(wt.getByText('Locked').first()).toBeVisible()
  await expect(wt.getByRole('button', { name: 'Open revision' })).toBeVisible()
})

test('driver verification requires evidence and a reviewer', async ({ page }) => {
  await persona(page, 'Dr. Morgan Ellery')
  await page.goto(`${P}/drivers/dd-3`)
  await page.getByRole('button', { name: 'Record verification' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Verification evidence').fill('too short')
  await expect(dlg.getByRole('button', { name: 'Record verification' })).toBeDisabled()
  await dlg.getByLabel('Verification evidence').fill('DD 50% flow model reviewed with operations: zero cross-flow intersections.')
  await dlg.getByRole('button', { name: 'Record verification' }).click()
  await expect(page.getByText('Verified — achieved')).toBeVisible()
  await expect(page.getByText(/Reviewer: Dr. Morgan Ellery/)).toBeVisible()
})

test('Decision Lab: reviewer approves the recommended alternative and the record locks', async ({ page }) => {
  await persona(page, 'Dr. Morgan Ellery')
  await page.goto(`${P}/decisions/dec-1`)
  await expect(page.getByText('Evaluation complete — ready for recommendation.')).toBeVisible()
  await page.getByRole('button', { name: 'Approve decision' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve final decision' }).click()
  await expect(page.getByText('Final decision: A — Adjacent to receiving')).toBeVisible()
  await expect(page.getByLabel('Alternative name').first()).toBeDisabled()
})

test('exports download real files', async ({ page }) => {
  await page.goto(`${P}/reports`)
  for (const [button, ext] of [
    ['Download PDF', '.pdf'],
    ['Download PPTX', '.pptx'],
  ] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).first().click()])
    expect(dl.suggestedFilename()).toMatch(new RegExp(`MVH-SPF-.*-DEMO-.*\\${ext}$`))
    const path = await dl.path()
    expect((await import('node:fs')).statSync(path!).size).toBeGreaterThan(2000)
  }
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).first().click()])
  const text = (await import('node:fs')).readFileSync((await csv.path())!, 'utf8')
  expect(text).toContain('SYNTHETIC DEMONSTRATION DATA')
  expect(text).toContain('Resilient critical systems')
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'XLSX' }).first().click()])
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/)
})

test('projects are isolated by membership', async ({ page }) => {
  await persona(page, 'Sam Delacroix')
  await page.goto('/projects/demo-learning')
  await expect(page.getByRole('heading', { name: 'No access to this project' })).toBeVisible()
})

test('relationship explorer focuses a chain and offers an accessible list', async ({ page }) => {
  await page.goto(`${P}/alignment?tab=explorer`)
  await page.getByRole('combobox', { name: 'Focus on a principle' }).selectOption({ label: 'Focus: GP-01 Reliability by Design' })
  await page.getByRole('radio', { name: 'Accessible list' }).click()
  const table = page.getByRole('table')
  await expect(table).toContainText('DD-02')
  await expect(table).not.toContainText('Workforce training pathway')
})
