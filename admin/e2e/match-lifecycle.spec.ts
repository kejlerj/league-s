import { expect, test } from '@playwright/test'
import { demo } from './demo.ts'
import { logInAsDemoAdmin } from './login.ts'

test('an admin creates a season, schedules a match and plays it to the end', async ({ page }) => {
  const [home, away] = demo.teams

  await logInAsDemoAdmin(page)

  await page.getByRole('tab', { name: 'Saisons' }).click()
  await page.getByRole('button', { name: 'Nouvelle saison' }).click()
  const seasonForm = page.getByRole('dialog', { name: 'Nouvelle saison' })
  await seasonForm.getByLabel('Nom').fill('2027-2028')
  await seasonForm.getByLabel('Début').fill('2027-08-28')
  await seasonForm.getByLabel('Fin').fill('2028-05-28')
  await seasonForm.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(seasonForm).toBeHidden()

  await page.getByRole('link', { name: '2027-2028' }).click()
  await expect(page.getByRole('heading', { name: '2027-2028' })).toBeVisible()
  for (const team of [home, away]) {
    await page.getByLabel('Inscrire une équipe').selectOption({ label: team })
    await page.getByRole('button', { name: 'Inscrire', exact: true }).click()
    await expect(page.getByRole('cell', { name: team, exact: true })).toBeVisible()
  }

  await page.getByRole('tab', { name: 'Matchs' }).click()
  await page.getByRole('button', { name: 'Programmer un match' }).click()
  const scheduleForm = page.getByRole('dialog', { name: 'Programmer un match' })
  await scheduleForm.getByLabel('Domicile').selectOption({ label: home })
  await scheduleForm.getByLabel('Extérieur').selectOption({ label: away })
  await scheduleForm.getByLabel('Journée').fill('1')
  await scheduleForm.getByLabel("Coup d'envoi").fill('2027-09-04T15:00')
  await scheduleForm.getByRole('button', { name: 'Programmer' }).click()
  await expect(scheduleForm).toBeHidden()

  const match = page.getByRole('row').filter({ hasText: home })
  await expect(match).toContainText('04/09/2027 15:00')
  await expect(match).toContainText('Programmé')

  await match.getByRole('button', { name: 'Démarrer' }).click()
  await page.getByRole('dialog', { name: 'Démarrer le match' }).getByRole('button', { name: 'Démarrer' }).click()
  await expect(match).toContainText('En cours')
  await expect(match).toContainText('0 – 0')

  await match.getByRole('button', { name: 'Score' }).click()
  const scoreForm = page.getByRole('dialog', { name: 'Score' })
  await scoreForm.getByLabel(home).fill('2')
  await scoreForm.getByLabel(away).fill('1')
  await scoreForm.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(scoreForm).toBeHidden()
  await expect(match).toContainText('2 – 1')

  await match.getByRole('button', { name: 'Terminer' }).click()
  await page.getByRole('dialog', { name: 'Terminer le match' }).getByRole('button', { name: 'Terminer' }).click()
  await expect(match).toContainText('Terminé')
  await expect(match.getByRole('button', { name: 'Score' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Classement' }).click()
  await expect(page.getByRole('row').nth(1)).toContainText(home)
})
