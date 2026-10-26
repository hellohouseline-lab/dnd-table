// The roll flow's screens, clicked through on the local design previews (made-up people, dice thrown
// in the browser, no database). It needs no logins, so it can run anywhere; rollFlow.spec.ts checks
// the real thing across two browsers.

import { expect, test } from '@playwright/test'

test('the DM asks for a save, sees the answers come in, changes one and plays on', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Ask for a roll' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Constitution save/ })
    .click()
  await expect(page.getByText('Everyone makes a Constitution saving throw. 15 or more passes.')).toBeVisible()
  await page.getByRole('button', { name: 'Send to players' }).click()

  const results = page.getByRole('region', { name: 'Constitution saving throw' })
  await expect(results).toContainText('Waiting for the dice')
  await expect(results).toContainText('everyone has rolled', { timeout: 10_000 })
  // The DM rules on each answer: here, against what the dice say for the first one.
  const first = results.getByRole('group', { name: /Rule on .*'s roll/ }).first()
  const said = (await results.textContent())?.match(/dice say (pass|fail)/)?.[1]
  await first.getByRole('button', { name: said === 'pass' ? 'Fail' : 'Pass', exact: true }).click()
  await expect(results).toContainText('by you')
  const flip = results.getByRole('button', { name: /Make it a (pass|fail)/ }).first()
  const before = await flip.textContent()
  await flip.click()
  await expect(results.getByRole('button', { name: /Make it a (pass|fail)/ }).first()).not.toHaveText(before ?? '')

  await results.getByRole('button', { name: 'Done, play on' }).click()
  await expect(results).toBeHidden()
})

test('the player gets the prompt, rolls, and waits for the DM to rule', async ({ page }) => {
  await page.goto('#/dev/table/asked')
  const prompt = page.getByRole('dialog', { name: 'Constitution saving throw' })
  await expect(prompt).toContainText('Your bonus +4')
  await expect(prompt).toContainText('Target kept secret')
  await expect(page.getByLabel('The table')).toContainText('Your roll')

  await prompt.getByRole('button', { name: 'Roll the d20' }).click()
  const result = page.getByRole('status').filter({ hasText: 'Everyone at the table sees your result' })
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result).toContainText(/\d+ \+ 4 = \d+/)
  // No pass or fail until the DM rules on it.
  await expect(result).toContainText('The DM is deciding whether it passes')
  await expect(page.getByLabel('The table')).toContainText('Rolled')

  await result.getByRole('button', { name: 'Back to the table' }).click()
  await expect(result).toBeHidden()
})

test('the DM uploads a picture, puts it on stage and plays music', async ({ page }) => {
  await page.goto('#/dev/stage')
  // A small picture and a short sound, made here rather than kept as files.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNgYPj/n4GBgYGJAQoAAD4ABDYfjLMAAAAASUVORK5CYII=',
    'base64',
  )
  await page
    .locator('input[type=file][accept^="image"]')
    .setInputFiles({ name: 'tavern.png', mimeType: 'image/png', buffer: png })
  const tile = page.getByRole('region', { name: 'Art library' }).getByRole('button', { name: 'Tavern', exact: true })
  await expect(tile).toBeVisible()
  await tile.click()
  await expect(page.getByText('On stage', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'On stage: Tavern' })).toBeVisible()

  const music = page.getByRole('region', { name: 'Music' })
  await music
    .locator('input[type=file]')
    .setInputFiles({ name: 'merry-inn.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from([0]) })
  await music.getByRole('button', { name: 'Merry inn', exact: true }).click()
  await expect(music).toContainText('Merry inn')
  await expect(page.getByRole('button', { name: 'Pause the music' })).toBeVisible()
})

test('the DM writes in the notebook, rests the party and sees it in the log', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  const notebook = page.getByRole('region', { name: 'Your notebook' })
  await notebook.getByPlaceholder('Add a step, then press Enter').fill('Find the secret door')
  await notebook.getByPlaceholder('Add a step, then press Enter').press('Enter')
  await expect(notebook).toContainText('Find the secret door')
  await notebook.getByLabel('Quick note').fill('The innkeeper flinched at the word ruins')
  await notebook.getByRole('button', { name: 'Add', exact: true }).click()

  await page.getByRole('button', { name: 'Rest' }).click()
  await page.getByRole('radio', { name: /Long rest/ }).click()
  await page.getByRole('button', { name: 'Take a long rest' }).click()
  await expect(page.getByText('Morning comes.')).toBeVisible()
  await page.getByRole('button', { name: 'Back to the party' }).click()

  await page.getByRole('tab', { name: 'Log' }).click()
  const log = page.getByRole('region', { name: 'Roll log' })
  await expect(log).toContainText('The innkeeper flinched at the word ruins')
  await expect(log).toContainText('Long rest.')
})

test('the DM starts a fight with two goblins, runs a turn and reveals one', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Start combat' }).click()
  const dialog = page.getByRole('dialog', { name: 'Start combat' })
  await dialog.getByLabel('Find a monster').fill('goblin')
  await dialog.getByRole('button', { name: /^Goblin CR 1\/4/ }).click()
  await expect(dialog).toContainText('1 × Goblin')
  await dialog.getByRole('button', { name: 'One more Goblin' }).click()
  await expect(dialog).toContainText('2 × Goblin')
  // A mystery: players see "Unknown creature" until the DM reveals them.
  await dialog.getByLabel('Players know what these are').uncheck()
  await dialog.getByRole('button', { name: 'Start the fight' }).click()

  const order = page.getByRole('region', { name: 'Turn order' })
  await expect(order).toContainText('Goblin A')
  await expect(order).toContainText('Goblin B')
  await expect(order).toContainText('players see “Unknown creature 1”')
  await expect(page.getByText('In combat · Round 1')).toBeVisible()

  await order.getByRole('button', { name: /^Goblin A/ }).click()
  const acting = page.getByRole('region', { name: 'Acting now' })
  await expect(acting).toContainText('Scimitar')
  await acting.getByRole('button', { name: /Reveal name/ }).click()
  await expect(acting).toContainText('Players see its name.')

  await page.getByRole('button', { name: 'End fight' }).click({ trial: true })
})

test('a player dashes, then ends their turn', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await expect(page.getByText('Your turn · Round 1')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Turn order' })).toContainText('Unknown creature 2')
  const turn = page.getByRole('region', { name: 'This turn' })
  await expect(turn).toContainText('25 of 25 ft')
  await turn.getByRole('button', { name: 'Dash' }).click()
  await expect(turn).toContainText('50 of 50 ft')
  await expect(turn).toContainText(/Action\s*Used/)
  await expect(turn.getByRole('button', { name: 'Dodge' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText('You dash.')
  await turn.getByRole('button', { name: 'End turn' }).click()
  await expect(page.getByText('Round 1 · Goblin A is acting')).toBeVisible()
  await expect(turn).toContainText('Waiting for your turn')
})

test('a player attacks a goblin by picking it, and their action is spent', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  const hand = page.getByLabel('Your hand')
  await hand.getByRole('button', { name: /Longsword/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Pick a target for Longsword' })).toBeVisible()
  await page
    .getByRole('list', { name: 'Turn order' })
    .getByRole('button', { name: /Goblin A/ })
    .click()
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText(/You (hit|miss) Goblin A with Longsword/)
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Action\s*Used/)
  await hand.getByRole('button', { name: /Longsword/ }).click()
  await expect(page.getByText('You have used your action this turn.')).toBeVisible()
})

test('a player can only attack what their weapon reaches', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await page
    .getByRole('button', { name: /Longsword/ })
    .first()
    .click()
  await page
    .getByRole('list', { name: 'Turn order' })
    .getByRole('button', { name: /Unknown creature 2/ })
    .click()
  await expect(page.getByText(/That's \d+ ft away, and it only reaches 5 ft\. Move closer/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Action\s*Ready/)
})

test("the DM runs a goblin's turn from the Battle screen in two clicks, and undoes it", async ({ page }) => {
  await page.goto('#/dev/battle')
  await expect(page.getByText('Battle · Round 1 · Thorin Ironfist is acting')).toBeVisible()
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(page.getByText('Battle · Round 1 · Goblin A is acting')).toBeVisible()
  await page.keyboard.press('1')
  await expect(page.getByRole('status').filter({ hasText: 'Pick a target for Goblin A: Scimitar' })).toBeVisible()
  await page
    .getByRole('region', { name: 'Turn order' })
    .getByRole('button', { name: 'Thorin Ironfist', exact: true })
    .click()
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText(/Goblin A (hits|misses) Thorin Ironfist with Scimitar/)
  await feed.getByRole('button', { name: 'Undo' }).click()
  await expect(feed).toContainText('(undone)')
  await expect(page.getByRole('region', { name: 'Turn order' })).toContainText('17/20')
})

test('the DM asks for a roll in the middle of a fight, from the Battle screen', async ({ page }) => {
  await page.goto('#/dev/battle')
  await page.getByRole('button', { name: 'Ask for a roll' }).click()
  await page.getByRole('button', { name: /Constitution save/ }).click()
  await page.getByRole('button', { name: 'Send to players' }).click()
  const results = page.getByRole('region', { name: 'Constitution saving throw' })
  await expect(results).toContainText('everyone has rolled', { timeout: 10_000 })
  await results.getByRole('button', { name: 'Done, play on' }).click()
  await expect(results).toBeHidden()
})

test('a player strikes a goblin slipping out of reach, with their reaction', async ({ page }) => {
  await page.goto('#/dev/table/reaction')
  const chance = page.getByRole('dialog', { name: 'Goblin A is getting away' })
  await expect(chance).toContainText('use your reaction to make one melee attack')
  await chance.getByRole('button', { name: 'Attack with Longsword' }).click()
  await expect(chance).toBeHidden()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText(
    /You (hit|miss) Goblin A with Longsword as they move away/,
  )
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Reaction\s*Used/)
})

test('a player at 0 hit points rolls one death save on their turn', async ({ page }) => {
  await page.goto('#/dev/table/dying')
  const saves = page.getByRole('region', { name: 'Death saves' })
  await expect(saves).toContainText('Dying')
  await expect(page.getByRole('button', { name: 'Dash' })).toBeDisabled()
  await saves.getByRole('button', { name: 'Roll a death save' }).click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText(
    /You (succeed on|fail|roll a 20 on) a death save/,
  )
  await expect(saves.getByRole('button', { name: 'Roll a death save' })).toBeHidden()
})

test('a wizard casts Magic Missile at a goblin, which spends the action', async ({ page }) => {
  await page.goto('#/dev/table/caster')
  const hand = page.getByLabel('Your hand')
  await hand.getByRole('button', { name: /Magic Missile/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Cast Magic Missile: click who' })).toBeVisible()
  await page
    .getByRole('list', { name: 'Turn order' })
    .getByRole('button', { name: /Goblin A/ })
    .click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText(
    /Your Magic Missile hits Goblin A for \d+ force/,
  )
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Action\s*Used/)
  await expect(hand.getByRole('button', { name: /Fire Bolt/ })).toBeDisabled()
  await expect(
    page.getByRole('region', { name: 'At a glance' }).getByRole('group', { name: '1st-level slots left: 2 of 4' }),
  ).toBeVisible()
})

test('a wizard puts Darkness on the map and concentrates on it', async ({ page }) => {
  await page.goto('#/dev/table/caster')
  await page
    .getByLabel('Your hand')
    .getByRole('button', { name: /Darkness/ })
    .click()
  await expect(page.getByRole('status').filter({ hasText: 'Cast Darkness: click where it goes' })).toContainText(
    'Uses a 2nd-level slot',
  )
  const map = page.locator('canvas').first()
  const box = await map.boundingBox()
  if (!box) throw new Error('No map')
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5)
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5)
  await expect(page.getByText(/Concentrating:\s*Darkness/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText('You cast Darkness.')
  // Everyone sees it on her camera tile, and a C in the turn order.
  await expect(page.getByLabel('The table')).toContainText('Darkness')
  await expect(page.getByRole('list', { name: 'Turn order' }).getByTitle('Concentrating on Darkness')).toBeVisible()
  // Its timer: 10 minutes.
  await expect(page.getByRole('region', { name: 'At a glance' })).toContainText(
    'Darkness (concentration) · about 10 minutes left',
  )
  await page.getByRole('button', { name: 'Lost it' }).click()
  await expect(page.getByText(/Concentrating:\s*Darkness/)).toBeHidden()
})

test('a pop-up closes with its ✕, Escape, or a click outside it', async ({ page }) => {
  await page.goto('#/dev/battle')
  const ask = page.getByRole('button', { name: 'Ask for a roll' })
  const dialog = page.getByRole('dialog')
  await ask.click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(10, 300)
  await expect(dialog).toBeHidden()
  await ask.click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await ask.click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('a fighter uses Second Wind from its card, and takes it back', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await page
    .getByLabel('Your hand')
    .getByRole('button', { name: /Second Wind/ })
    .click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText('You use Second Wind.')
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Bonus action\s*Used/)
  await page
    .getByRole('status')
    .filter({ hasText: 'You used Second Wind.' })
    .getByRole('button', { name: 'Undo' })
    .click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText('(undone)')
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Bonus action\s*Ready/)
})

test('hovering on a card for a few seconds shows what it does', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await page
    .getByLabel('Your hand')
    .getByRole('button', { name: /Longsword/ })
    .hover()
  const info = page.getByRole('tooltip', { name: 'About Longsword' })
  await expect(info).toBeHidden()
  await expect(info).toBeVisible({ timeout: 5000 })
  await expect(info.getByRole('term').filter({ hasText: 'To hit' })).toBeVisible()
  await expect(info).toContainText('Martial melee weapon')
  await page.mouse.move(5, 5)
  await expect(info).toBeHidden()
})

test('the DM asks the party for a Perception check in one click', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  const quick = page.getByRole('region', { name: 'Quick checks' })
  await quick.getByRole('button', { name: 'Hard 20' }).click()
  await page.getByRole('checkbox', { name: 'Elowen rolls the quick check' }).check()
  await expect(quick).toContainText('ask the 2 players ticked')
  await quick.getByRole('button', { name: 'Perception', exact: true }).click()
  const results = page.getByRole('region', { name: 'Perception check' })
  await expect(results).toContainText('Needed 20 or more')
  await expect(results).toContainText('everyone has rolled', { timeout: 10_000 })
  // Nobody sees pass or fail until the DM rules: here, going with the dice.
  await expect(results).toContainText('to rule on')
  await expect(results).toContainText(/dice say (pass|fail)/)
  await results.getByRole('button', { name: 'Go with the dice for everyone' }).click()
  await expect(results).not.toContainText('to rule on')
  await expect(results).toContainText(/Passed|Failed/)
  await page.keyboard.press('Escape')
  // Every saving throw is in its own section.
  await quick.getByText('Saving throws').click()
  await expect(quick.getByRole('button', { name: 'Charisma save' })).toBeVisible()
})

test('a fighter has a Bonus actions set, in blue, that greys out once the bonus action is used', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await page.getByRole('button', { name: /Bonus actions/ }).click()
  const hand = page.getByLabel('Your hand')
  await expect(hand.getByRole('button', { name: /Second Wind/ })).toBeEnabled()
  await hand.getByRole('button', { name: /Second Wind/ }).click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText('You use Second Wind.')
  await expect(hand.getByRole('button', { name: /Second Wind/ })).toBeDisabled()
})

test('after attacking with one light weapon, the player is offered an off-hand attack with the other', async ({
  page,
}) => {
  await page.goto('#/dev/table/dual')
  const ready = page.getByRole('region', { name: 'Bonus action ready' })
  await expect(ready).toHaveCount(0)
  await page
    .getByLabel('Your hand')
    .getByRole('button', { name: /Shortsword/ })
    .click()
  await page
    .getByRole('list', { name: 'Turn order' })
    .getByRole('button', { name: /Goblin A/ })
    .click()
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText(/You (hit|miss) Goblin A with Shortsword/)
  await expect(ready).toContainText('You attacked, so you can also use your bonus action')
  await ready.getByRole('button', { name: /Off-hand attack: Dagger/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Off-hand attack with Dagger' })).toBeVisible()
  await page
    .getByRole('list', { name: 'Turn order' })
    .getByRole('button', { name: /Goblin A/ })
    .click()
  await expect(feed).toContainText(/Dagger/)
  await expect(ready).toHaveCount(0)
})

test("the DM uses a goblin's Nimble Escape from its card", async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('#/dev/battle')
  const card = page.getByRole('region', { name: 'Acting now' })
  for (let i = 0; i < 3 && !(await card.innerText()).includes('Goblin'); i++) await page.keyboard.press('n')
  const bonus = card.getByRole('region', { name: 'Its bonus action' })
  await expect(bonus).toContainText('Nimble Escape')
  await bonus.getByRole('button', { name: 'Disengage' }).click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText(
    /Goblin \w+ disengages \(bonus action\)/i,
  )
  await expect(bonus).toContainText('used this turn')
  await expect(bonus.getByRole('button', { name: /Hide/ })).toBeDisabled()
})

test('the builder: a player picks a half-elf and its choices', async ({ page }) => {
  await page.goto('#/dev/builder')
  await page.getByRole('button', { name: /Half-Elf/ }).click()
  const summary = page.getByRole('complementary', { name: 'Your character so far' })
  await expect(summary).toContainText('Level 1 Half-Elf')
  await expect(page.getByText(/Still to pick: Pick 2 abilities/)).toBeVisible()
  await page.getByRole('button', { name: '+1 Dexterity' }).click()
  await page.getByRole('button', { name: '+1 Wisdom' }).click()
  await page.getByRole('button', { name: 'Dwarvish' }).click()
  await expect(page.getByText('Race done. The class step comes next.')).toBeVisible()
  await expect(summary).toContainText('Common, Elvish, Dwarvish')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toContainText('✓')
})
