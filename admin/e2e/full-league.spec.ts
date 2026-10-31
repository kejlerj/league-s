import { expect, test, type Page } from '@playwright/test'
import { checkLeague } from './checkLeague.ts'
import { demo } from './demo.ts'
import { logIn } from './login.ts'

async function create(page: Page, newLabel: string, fields: Record<string, string>) {
  await page.getByRole('button', { name: newLabel }).click()
  const form = page.getByRole('dialog', { name: newLabel })
  for (const [label, value] of Object.entries(fields)) {
    await form.getByLabel(label, { exact: true }).fill(value)
  }
  await form.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(form).toBeHidden()
}

async function confirm(page: Page, title: string, label: string) {
  const dialog = page.getByRole('dialog', { name: title })
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('a superadmin builds a full league through the admin', async ({ page }) => {
  test.setTimeout(300_000)
  const { squads, fixtures, season } = checkLeague

  await logIn(page, demo.superadminEmail, demo.superadminPassword)
  await create(page, 'Nouvelle ligue', { Nom: checkLeague.name })
  await page.getByRole('link', { name: checkLeague.name }).click()
  await expect(page.getByRole('heading', { name: checkLeague.name })).toBeVisible()

  await page.getByRole('tab', { name: 'Équipes' }).click()
  for (const { team } of squads) {
    await create(page, 'Nouvelle équipe', { Nom: team })
  }

  await page.getByRole('tab', { name: 'Joueurs' }).click()
  for (const { players } of squads) {
    for (const player of players) {
      await create(page, 'Nouveau joueur', { Prénom: player.firstname, Nom: player.lastname })
    }
  }

  await page.getByRole('tab', { name: 'Saisons' }).click()
  await create(page, 'Nouvelle saison', { Nom: season.name, Début: season.startOn, Fin: season.endOn })
  await page.getByRole('link', { name: season.name }).click()
  await expect(page.getByRole('heading', { name: season.name })).toBeVisible()
  const seasonUrl = page.url()

  for (const { team } of squads) {
    await page.getByLabel('Inscrire une équipe').selectOption({ label: team })
    await page.getByRole('button', { name: 'Inscrire', exact: true }).click()
    await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible()
  }

  for (const { team, players } of squads) {
    await page.getByRole('link', { name: team, exact: true }).click()
    await expect(page.getByRole('heading', { name: team })).toBeVisible()
    for (const player of players) {
      await page.getByRole('button', { name: 'Ajouter un joueur' }).click()
      const form = page.getByRole('dialog', { name: 'Ajouter un joueur' })
      await form.getByLabel('Joueur').selectOption({ label: `${player.firstname} ${player.lastname}` })
      await form.getByLabel('Numéro').fill(String(player.number))
      await form.getByLabel("Date d'arrivée").fill(season.startOn)
      await form.getByRole('button', { name: 'Ajouter' }).click()
      await expect(form).toBeHidden()
    }
    await expect(page.getByRole('row')).toHaveCount(players.length + 1)
    await page.goto(seasonUrl)
  }

  await page.getByRole('tab', { name: 'Matchs' }).click()
  for (const fixture of fixtures) {
    await page.getByRole('button', { name: 'Programmer un match' }).click()
    const form = page.getByRole('dialog', { name: 'Programmer un match' })
    await form.getByLabel('Domicile').selectOption({ label: fixture.home })
    await form.getByLabel('Extérieur').selectOption({ label: fixture.away })
    await form.getByLabel('Journée').fill(String(fixture.matchday))
    await form.getByLabel("Coup d'envoi").fill(fixture.kickoff)
    await form.getByRole('button', { name: 'Programmer' }).click()
    await expect(form).toBeHidden()
  }

  for (const { home, away, outcome } of fixtures) {
    const row = page.getByRole('row').filter({ hasText: home }).filter({ hasText: away })
    const act = (name: string) => row.getByRole('button', { name, exact: true }).click()

    if (outcome.status === 'finished' || outcome.status === 'live') {
      await act('Démarrer')
      await confirm(page, 'Démarrer le match', 'Démarrer')
      await act('Score')
      const form = page.getByRole('dialog', { name: 'Score' })
      await form.getByLabel(home).fill(String(outcome.score[0]))
      await form.getByLabel(away).fill(String(outcome.score[1]))
      await form.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(form).toBeHidden()
      await expect(row).toContainText(`${outcome.score[0]} – ${outcome.score[1]}`)
    }
    if (outcome.status === 'finished') {
      await act('Terminer')
      await confirm(page, 'Terminer le match', 'Terminer')
      if (outcome.video) {
        await act('Modifier')
        const form = page.getByRole('dialog', { name: 'Modifier le match' })
        await form.getByLabel('Lien vidéo (URL)').fill(outcome.video)
        await form.getByRole('button', { name: 'Enregistrer' }).click()
        await expect(form).toBeHidden()
      }
    }
    if (outcome.status === 'postponed') {
      await act('Reporter')
      const form = page.getByRole('dialog', { name: 'Reporter le match' })
      await form.getByRole('button', { name: 'Reporter' }).click()
      await expect(form).toBeHidden()
    }
    if (outcome.status === 'cancelled') {
      await act('Annuler')
      await confirm(page, 'Annuler le match', 'Annuler le match')
    }
  }

  const statusLabels = { finished: 'Terminé', live: 'En cours', postponed: 'Reporté', cancelled: 'Annulé', scheduled: 'Programmé' }
  for (const { home, away, outcome } of fixtures) {
    await expect(page.getByRole('row').filter({ hasText: home }).filter({ hasText: away })).toContainText(statusLabels[outcome.status])
  }

  await page.getByRole('tab', { name: 'Classement' }).click()
  const rows = page.getByRole('row')
  await expect(rows).toHaveCount(squads.length + 1)
  await expect(rows.nth(1)).toContainText('Les Faucons')
  await expect(rows.nth(2)).toContainText('Les Aigles')
})
