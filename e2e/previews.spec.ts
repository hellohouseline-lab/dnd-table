// The roll flow's screens, clicked through on the local design previews (made-up people, dice thrown
// in the browser, no database). It needs no logins, so it can run anywhere; rollFlow.spec.ts checks
// the real thing across two browsers.

import { expect, test } from '@playwright/test'

test('the DM asks for a save, sees the answers come in, changes one and plays on', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Ask for a roll' }).click()
  await page.getByRole('button', { name: /Constitution save/ }).click()
  await expect(page.getByText('Everyone makes a Constitution saving throw. 15 or more passes.')).toBeVisible()
  await page.getByRole('button', { name: 'Send to players' }).click()

  const results = page.getByRole('region', { name: 'Constitution saving throw' })
  await expect(results).toContainText('Waiting for the dice')
  await expect(results).toContainText('everyone has rolled', { timeout: 10_000 })
  const flip = results.getByRole('button', { name: /Make it a (pass|fail)/ })
  const before = await flip.textContent()
  await flip.click()
  await expect(results.getByRole('button', { name: /Make it a (pass|fail)/ })).not.toHaveText(before ?? '')
  await expect(results).toContainText('by you')

  await results.getByRole('button', { name: 'Done, play on' }).click()
  await expect(results).toBeHidden()
})

test('the player gets the prompt, rolls, and sees pass or fail', async ({ page }) => {
  await page.goto('#/dev/table/asked')
  const prompt = page.getByRole('dialog', { name: 'Constitution saving throw' })
  await expect(prompt).toContainText('Your bonus +4')
  await expect(prompt).toContainText('Target kept secret')
  await expect(page.getByLabel('The table')).toContainText('Your roll')

  await prompt.getByRole('button', { name: 'Roll the d20' }).click()
  const result = page.getByRole('status').filter({ hasText: 'Everyone at the table sees your result' })
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result).toContainText(/\d+ \+ 4 = \d+/)
  await expect(result).toContainText(/Passed|Failed|Natural/)
  await expect(page.getByLabel('The table')).toContainText(/Passed|Failed/)

  await result.getByRole('button', { name: 'Back to the table' }).click()
  await expect(result).toBeHidden()
})
