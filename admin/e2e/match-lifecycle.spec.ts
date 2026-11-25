import { expect, test } from '@playwright/test'
import { demo } from './demo.ts'
import { logInAsDemoAdmin } from './login.ts'

test('an admin creates a season, schedules a match, records its events and plays it to the end', async ({ page }) => {
  const [home, away] = demo.teams
  const scorer = { firstname: 'Elio', lastname: 'Vérif', number: 7 }

  await logInAsDemoAdmin(page)

  await page.getByRole('tab', { name: 'Joueurs' }).click()
  await page.getByRole('button', { name: 'Nouveau joueur' }).click()
  const playerForm = page.getByRole('dialog', { name: 'Nouveau joueur' })
  await playerForm.getByLabel('Prénom', { exact: true }).fill(scorer.firstname)
  await playerForm.getByLabel('Nom', { exact: true }).fill(scorer.lastname)
  await playerForm.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(playerForm).toBeHidden()

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
  const seasonUrl = page.url()

  await page.getByRole('link', { name: home, exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter un joueur' }).click()
  const joinForm = page.getByRole('dialog', { name: 'Ajouter un joueur' })
  await joinForm.getByLabel('Joueur').selectOption({ label: `${scorer.firstname} ${scorer.lastname}` })
  await joinForm.getByLabel('Numéro').fill(String(scorer.number))
  await joinForm.getByLabel("Date d'arrivée").fill('2027-08-28')
  await joinForm.getByRole('button', { name: 'Ajouter' }).click()
  await expect(joinForm).toBeHidden()
  await page.goto(seasonUrl)

  await page.getByRole('tab', { name: 'Matchs' }).click()
  await page.getByRole('button', { name: 'Programmer un match' }).click()
  const scheduleForm = page.getByRole('dialog', { name: 'Programmer un match' })
  await scheduleForm.getByLabel('Domicile').selectOption({ label: home })
  await scheduleForm.getByLabel('Extérieur').selectOption({ label: away })
  await scheduleForm.getByLabel('Journée').fill('1')
  await scheduleForm.getByLabel("Coup d'envoi").fill('2027-09-04T15:00')
  await scheduleForm.getByRole('button', { name: 'Programmer' }).click()
  await expect(scheduleForm).toBeHidden()

  const header = page.getByRole('region', { name: 'Match', exact: true })
  await expect(header).toContainText('04/09/2027 15:00')
  await expect(header).toContainText('Programmé')

  await page.getByRole('button', { name: 'Démarrer' }).click()
  await expect(header).toContainText('En cours')
  await expect(header).toContainText('0 – 0')

  const correct = async (homeGoals: string, awayGoals: string) => {
    await page.getByRole('button', { name: 'Corriger le score' }).click()
    const scoreForm = page.getByRole('dialog', { name: 'Corriger le score' })
    await scoreForm.getByLabel(home).fill(homeGoals)
    await scoreForm.getByLabel(away).fill(awayGoals)
    await scoreForm.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(scoreForm).toBeHidden()
    await expect(header).toContainText(`${homeGoals} – ${awayGoals}`)
  }
  const events = page.getByRole('region', { name: 'Faits de match' })
  const record = async (type: string, player: string, minute: string) => {
    await events.getByRole('button', { name: type, exact: true }).click()
    const form = page.getByRole('dialog', { name: type })
    await form.getByRole('button', { name: home }).click()
    await form.getByLabel(player).selectOption({ label: `${scorer.number} · ${scorer.firstname} ${scorer.lastname}` })
    await form.getByLabel('Minute').fill(minute)
    await form.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(form).toBeHidden()
  }
  await record('But', 'Buteur', '12')
  await expect(header).toContainText('1 – 0')
  await record('Carton jaune', 'Joueur', '30')
  const list = page.getByRole('list', { name: 'Faits de match' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('listitem').first()).toContainText('Carton jaune')
  await expect(list.getByRole('listitem').last()).toContainText(`${scorer.firstname} ${scorer.lastname}`)

  await page.getByRole('button', { name: 'Terminer' }).click()
  await page.getByRole('dialog', { name: 'Terminer le match' }).getByRole('button', { name: 'Terminer' }).click()
  await expect(header).toContainText('Terminé')
  await expect(page.getByRole('button', { name: 'Démarrer' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Retour aux matchs' }).click()
  await page.getByRole('tab', { name: 'Classement' }).click()
  await expect(page.getByRole('row').nth(1)).toContainText(home)

  await page.getByRole('tab', { name: 'Matchs' }).click()
  await page.getByRole('row').filter({ hasText: home }).getByRole('link').click()
  await correct('1', '3')
  await expect(header).toContainText('Terminé')

  await page.getByRole('link', { name: 'Retour aux matchs' }).click()
  await page.getByRole('tab', { name: 'Classement' }).click()
  await expect(page.getByRole('row').nth(1)).toContainText(away)
})
