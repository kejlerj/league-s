import { expect, type Page } from '@playwright/test'
import { demo } from './demo.ts'

export async function logInAsDemoAdmin(page: Page) {
  await page.goto('login')
  await page.getByLabel('E-mail').fill(demo.adminEmail)
  await page.getByLabel('Mot de passe').fill(demo.adminPassword)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: demo.leagueName })).toBeVisible()
}
