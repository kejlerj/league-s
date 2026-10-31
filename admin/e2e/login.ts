import { expect, type Page } from '@playwright/test'
import { demo } from './demo.ts'

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

export async function logInAsDemoAdmin(page: Page) {
  await logIn(page, demo.adminEmail, demo.adminPassword)
  await expect(page.getByRole('heading', { name: demo.leagueName })).toBeVisible()
}
