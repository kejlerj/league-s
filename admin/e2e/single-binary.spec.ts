import { expect, test } from '@playwright/test'
import { demo } from './demo.ts'
import { logInAsDemoAdmin } from './login.ts'

test('the binary serves a deep link of the admin, which loads with no blocked resource', async ({ page }) => {
  await logInAsDemoAdmin(page)

  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(error.message))

  await page.goto(`leagues/${demo.leagueId}/seasons/${demo.currentSeasonId}`)
  await page.reload()
  await expect(page.getByRole('heading', { name: demo.currentSeasonName })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Équipes' })).toBeVisible()

  expect(problems).toEqual([])
})
