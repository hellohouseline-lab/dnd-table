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
    /You (succeed on|fail|roll a 20 on) a (\w+ )?death save/,
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
  await page.getByRole('button', { name: 'Build my own' }).click()
  await page.getByRole('button', { name: /Half-Elf/ }).click()
  const summary = page.getByRole('complementary', { name: 'Your character so far' })
  await expect(summary).toContainText('Level 1 Half-Elf')
  await expect(page.getByText(/Still to pick: Pick 2 abilities/)).toBeVisible()
  await page.getByRole('button', { name: '+1 Dexterity' }).click()
  await page.getByRole('button', { name: '+1 Wisdom' }).click()
  await page.getByRole('button', { name: 'Dwarvish' }).click()
  await page.getByRole('button', { name: 'Stealth', exact: true }).click()
  await page.getByRole('button', { name: 'Persuasion', exact: true }).click()
  await expect(page.getByText('Race done.')).toBeVisible()
  await expect(summary).toContainText('Common, Elvish, Dwarvish')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toContainText('✓')
})

test('the builder: a hill dwarf fighter, acolyte, with the standard set, in four steps', async ({ page }) => {
  await page.goto('#/dev/builder')
  await page.getByRole('button', { name: 'Build my own' }).click()
  const summary = page.getByRole('complementary', { name: 'Your character so far' })
  await page.getByRole('button', { name: /^Dwarf/ }).click()
  await page.getByRole('button', { name: /Hill Dwarf/ }).click()
  await page.getByRole('button', { name: 'Next: Class' }).click()

  await page.getByRole('button', { name: /^Fighter/ }).click()
  await page.getByRole('button', { name: 'Athletics', exact: true }).click()
  await page.getByRole('button', { name: 'Insight', exact: true }).click()
  await page.getByRole('button', { name: /^Defense/ }).click()
  await expect(summary).toContainText('Level 1 Hill Dwarf Fighter')
  await page.getByRole('button', { name: 'Next: Background' }).click()

  await page.getByRole('button', { name: /^Acolyte/ }).click()
  // Insight comes from the class already, so the Acolyte's is swapped.
  await expect(page.getByText(/You have Insight already/)).toBeVisible()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'Elvish', exact: true }).click()
  await page.getByRole('button', { name: 'Giant', exact: true }).click()
  await page.getByRole('button', { name: 'Next: Ability scores' }).click()

  await page.getByRole('button', { name: /^Standard set/ }).click()
  await expect(page.getByLabel('Strength score')).toHaveValue('15')
  // Hill dwarf: Constitution 14 + 2 = 16, and hit points 10 + 3 + 1.
  await expect(summary).toContainText('16')
  await expect(summary.getByText('14', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Ability scores done.')).toBeVisible()
  await expect(summary).toContainText('Athletics, History, Insight, Religion')

  await page.getByRole('button', { name: /^Point buy/ }).click()
  await expect(page.getByText(/Points left: 27/)).toBeVisible()
  await page.getByRole('button', { name: 'Raise Strength' }).click()
  await expect(page.getByText(/Points left: 26/)).toBeVisible()
})

test('the builder: a fighter picks starting gear and gets AC 18 from chain mail and a shield', async ({ page }) => {
  await page.goto('#/dev/builder')
  await page.getByRole('button', { name: 'Build my own' }).click()
  await page.getByRole('button', { name: /^Human/ }).click()
  await page.getByRole('button', { name: 'Elvish', exact: true }).click()
  await page.getByRole('button', { name: 'Next: Class' }).click()
  await page.getByRole('button', { name: /^Fighter/ }).click()
  await page.getByRole('button', { name: 'Athletics', exact: true }).click()
  await page.getByRole('button', { name: 'Perception', exact: true }).click()
  await page.getByRole('button', { name: /^Defense/ }).click()
  await page.getByRole('button', { name: 'Next: Background' }).click()
  await page.getByRole('button', { name: /^Acolyte/ }).click()
  await page.getByRole('button', { name: 'Giant', exact: true }).click()
  await page.getByRole('button', { name: 'Orc', exact: true }).click()
  await page.getByRole('button', { name: 'Next: Ability scores' }).click()
  await page.getByRole('button', { name: /^Standard set/ }).click()
  await page.getByRole('button', { name: 'Next: Level' }).click()
  await page.getByRole('button', { name: 'Next: Gear' }).click()

  await page.getByRole('button', { name: 'Chain Mail', exact: true }).click()
  await page.getByRole('button', { name: 'a martial weapon and Shield' }).click()
  await page.getByLabel('Pick a martial weapon').selectOption('longsword')
  await page.getByRole('button', { name: '2 × Handaxe' }).click()
  await page.getByRole('button', { name: /^Explorer/ }).click()
  await page.getByRole('button', { name: 'one of the holy symbols' }).click()
  await page.getByLabel('Pick one of the holy symbols').selectOption('amulet')
  await expect(page.getByText('Gear done.')).toBeVisible()
  const summary = page.getByRole('complementary', { name: 'Your character so far' })
  await expect(summary).toContainText('Longsword, Handaxe')
  await expect(page.getByText('Chain Mail 16, shield +2')).toBeVisible()

  // A fighter has no spells; then a name, an alignment, and the review.
  await page.getByRole('button', { name: 'Next: Spells' }).click()
  await expect(page.getByText(/doesn’t cast spells/)).toBeVisible()
  await page.getByRole('button', { name: 'Next: Who they are' }).click()
  await page.getByLabel('Your character’s name').fill('Bruenna Stonehelm')
  await page.getByLabel('Height in centimetres').selectOption('157')
  await expect(page.getByText('5 ft 2 in (157 cm)')).toBeVisible()
  await page.getByRole('button', { name: 'Feet and pounds' }).click()
  await expect(page.getByLabel('Height in feet')).toHaveValue('5')
  await page.getByRole('button', { name: /^Lawful good/ }).click()
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await expect(page.getByRole('heading', { name: 'Meet Bruenna Stonehelm' })).toBeVisible()
  await expect(page.getByText(/Level 1 Human Fighter, once an acolyte/)).toBeVisible()
  await expect(page.getByText(/Second Wind \(1 use\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Save and go to the table' }).click()
  await expect(page.getByText('Saved (in the preview nothing is kept).')).toBeVisible()
})

test('outside a fight, a player rolls a d20 for the DM, with advantage', async ({ page }) => {
  await page.goto('#/dev/table')
  await page.getByRole('button', { name: 'Checks', exact: true }).click()
  const hand = page.getByLabel('Your hand')
  await expect(hand.getByRole('button', { name: /Roll a d20/ })).toBeVisible()
  await hand.getByRole('button', { name: /^Check Advantage/ }).click()
  // Two dice, the higher counting, landing for everyone.
  await expect(page.getByRole('status').filter({ hasText: 'A roll for the DM' })).toBeVisible({ timeout: 10_000 })

  // In a fight the hand is for fighting: no Checks set.
  await page.goto('#/dev/table/fight')
  await expect(page.getByRole('button', { name: 'Bonus actions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checks', exact: true })).toHaveCount(0)
})

test("the DM says what a player's roll was, from buttons with each total, and judges it", async ({ page }) => {
  await page.goto('#/dev/dm-rolls')
  const card = page.getByRole('region', { name: "Thorin Ironfist's roll for you" })
  await expect(card).toContainText('rolled for you with advantage')
  await card.getByRole('button', { name: /^DEX/ }).click()
  await expect(card).toContainText('Dexterity save: 11 +1 = 12')
  await card.getByRole('button', { name: 'Medium 15' }).click()
  await expect(card).toContainText('dice say fail')
  await card.getByRole('button', { name: 'Pass', exact: true }).click()
  await expect(card).toBeHidden()
})

test('a fighter drinks a potion from the Items set, which takes the action', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  await page.getByRole('group', { name: 'Which cards' }).getByRole('button', { name: 'Items' }).click()
  const hand = page.getByLabel('Your hand')
  await expect(hand.getByRole('button', { name: /Potion of Healing\s*2 left/ })).toBeVisible()
  await hand.getByRole('button', { name: /Potion of Healing/ }).click()
  await page.getByRole('region', { name: 'Potion of Healing' }).getByRole('button', { name: 'Drink it' }).click()
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText(/You drink a Potion of Healing: \d+ hit points back\./)
  await expect(page.getByRole('region', { name: 'This turn' })).toContainText(/Action\s*Used/)
  await expect(hand.getByRole('button', { name: /Potion of Healing/ })).toBeDisabled()
})

test('the sheet has an Inventory tab with coins, and worn armour', async ({ page }) => {
  await page.goto('#/dev/table')
  await page.getByRole('button', { name: /Sheet/ }).first().click()
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await expect(page.getByText('Chain Mail')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Worn' }).first()).toBeVisible()
  await expect(page.getByLabel('Gold pieces')).toHaveValue('15')
})

test('levelling up: a fighter takes level 3, picks a path and the average hit points', async ({ page }) => {
  await page.goto('#/dev/level-up')
  await expect(page.getByRole('heading', { name: 'Level up to 3' })).toBeVisible()
  await expect(page.getByText(/Still to pick: Pick your path/)).toBeVisible()
  await page.getByRole('button', { name: 'Champion' }).click()
  await expect(page.getByText('Improved Critical')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Champion' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/\+8 hit points/)).toBeVisible()
  await page.getByRole('button', { name: 'Take level 3' }).click()
  await expect(page.getByText(/Saved in the preview: level 3/)).toBeVisible()
})

test('the DM lets a character level up from the Party tab', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  const card = page.getByRole('article', { name: 'Thorin Ironfist' })
  await card.getByRole('button', { name: 'Level up' }).click()
  await expect(card).toContainText('Level up waiting: Thorin Ironfist can go to level 3 on their screen.')
})

test('a sheet copies as text, with a picture description', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('#/dev/table')
  await page.getByRole('button', { name: /Sheet/ }).first().click()
  await page.getByRole('button', { name: 'Copy as text' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('THORIN IRONFIST')
  expect(text).toContain('PICTURE DESCRIPTION')
  expect(text).toContain('A fantasy character portrait of Thorin Ironfist')
})

test('the builder: a ready-made character in one click, then a name of your own', async ({ page }) => {
  await page.goto('#/dev/builder')
  await page.getByRole('button', { name: /^Tinka Gearwhistle/ }).click()
  await expect(page.getByLabel('Your character’s name')).toHaveValue('Tinka Gearwhistle')
  await page.getByLabel('Your character’s name').fill('Pemberly Gearwhistle')
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await expect(page.getByRole('heading', { name: 'Meet Pemberly Gearwhistle' })).toBeVisible()
  await expect(page.getByText(/Level 1 Rock Gnome Wizard, once an acolyte/)).toBeVisible()
  await expect(page.getByText('Ready when you are.')).toBeVisible()
})

test('the builder: Surprise me makes a whole character', async ({ page }) => {
  await page.goto('#/dev/builder')
  await page.getByRole('button', { name: 'Surprise me' }).click()
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await expect(page.getByText('Ready when you are.')).toBeVisible()
})

test('the sheet shows Your path: every level ahead and the choices coming', async ({ page }) => {
  await page.goto('#/dev/table')
  await page.getByRole('button', { name: /Sheet/ }).first().click()
  await page.getByRole('tab', { name: 'Your path' }).click()
  await expect(page.getByText('Level 3next')).toBeVisible()
  await expect(page.getByText('Pick your path (subclass)')).toBeVisible()
  await expect(page.getByText(/Extra Attack/).first()).toBeVisible()
})

test('change your character: learn spells, add gear, wear armour, save', async ({ page }) => {
  await page.goto('#/dev/change/wizard')
  await expect(page.getByRole('heading', { name: 'Change your character' })).toBeVisible()
  await expect(page.getByText('Cantrips: 1 of 3 · In your spellbook: 5 · Prepared today: 4 of 6')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Acid Splash' }).getByRole('button', { name: 'Learn' }).click()
  await page.getByRole('button', { name: 'Level 1', exact: true }).click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alarm' })
    .getByRole('button', { name: 'Add to spellbook' })
    .click()
  await expect(page.getByText('Cantrips: 2 of 3 · In your spellbook: 6 · Prepared today: 4 of 6')).toBeVisible()

  await page.getByRole('tab', { name: 'Gear' }).click()
  await page.getByRole('button', { name: 'Add Longsword' }).click()
  await page.getByRole('tab', { name: 'Armour' }).click()
  const chain = page.getByRole('listitem').filter({ hasText: 'Chain Mail' })
  await expect(chain).toContainText('AC 16 · needs Strength 13')
  await expect(chain).toContainText('Not trained')
  await page.getByRole('button', { name: 'Add Chain Mail' }).click()
  const carry = page.getByRole('complementary', { name: 'What you carry' })
  await carry.getByRole('listitem').filter({ hasText: 'Chain Mail' }).getByRole('button', { name: 'Wear' }).click()
  await expect(carry).toContainText('AC 16')

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
})

test('change your character: a fighter picks a fighting style', async ({ page }) => {
  await page.goto('#/dev/change/fighter')
  await expect(page.getByRole('tab', { name: 'Spells' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Your choices' }).click()
  await page.getByRole('button', { name: /Defense/ }).click()
  await expect(page.getByText('Fighting Style: 1 of 1')).toBeVisible()
  await page.getByRole('button', { name: /Archery/ }).click()
  await expect(page.getByRole('button', { name: /Archery/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /Defense/ })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('tab', { name: 'Who they are' }).click()
  await expect(page.getByRole('textbox').first()).toHaveValue('Thorin Ironfist')
})

test('levelling up: a bard picks a new spell from cards and swaps one', async ({ page }) => {
  await page.goto('#/dev/level-up/bard')
  await expect(page.getByRole('heading', { name: 'Level up to 3' })).toBeVisible()
  await page.getByRole('button', { name: 'Lore', exact: true }).click()
  await page.getByRole('button', { name: 'Arcana', exact: true }).click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page
    .getByRole('list', { name: /New spells/ })
    .getByRole('button', { name: 'Pick Hold Person' })
    .click()
  await page.getByRole('button', { name: 'Forget Sleep' }).click()
  await expect(page.getByText(/Pick the spell to learn in its place/)).toBeVisible()
  await page.getByRole('list', { name: 'Learn in its place' }).getByRole('button', { name: 'Pick Silence' }).click()
  await page.getByRole('button', { name: 'Take level 3' }).click()
  const saved = page.getByText(/Saved in the preview: level 3/)
  await expect(saved).toContainText('Hold Person')
  await expect(saved).toContainText('Silence')
  await expect(saved).not.toContainText('Sleep')
})

test('levelling up: a wizard adds to the book and prepares more', async ({ page }) => {
  await page.goto('#/dev/level-up/wizard')
  await expect(page.getByRole('heading', { name: 'Level up to 4' })).toBeVisible()
  await page.getByRole('button', { name: 'More Intelligence' }).click()
  await page.getByRole('button', { name: 'More Intelligence' }).click()
  await page
    .getByRole('list', { name: /New cantrips/ })
    .getByRole('button', { name: 'Pick Light' })
    .click()
  const book = page.getByRole('list', { name: /For your spellbook/ })
  await book.getByRole('button', { name: 'Pick Web' }).click()
  await book.getByRole('button', { name: 'Pick Blur' }).click()
  const prepare = page.getByRole('list', { name: /Prepare more today/ })
  await prepare.getByRole('button', { name: 'Pick Sleep' }).click()
  await prepare.getByRole('button', { name: 'Pick Web' }).click()
  await page.getByRole('button', { name: 'Take level 4' }).click()
  const saved = page.getByText(/Saved in the preview: level 4/)
  await expect(saved).toContainText('Sleep, Burning Hands')
  await expect(saved).toContainText('Web, Blur (in the book)')
})

test('the DM gives a Longsword +1, splits gold and takes a fine', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Give an item' }).click()
  const give = page.getByRole('dialog', { name: 'Give' })
  await give.getByRole('textbox', { name: 'Look for something' }).fill('weapon, +1')
  await give.getByRole('button', { name: 'Tick Weapon, +1' }).click()
  await give.getByRole('combobox', { name: 'Which weapon for Weapon, +1' }).selectOption('longsword')
  await give.getByRole('radio', { name: 'Thorin Ironfist' }).click()
  await give.getByRole('button', { name: 'Give it to Thorin Ironfist' }).click()
  await expect(give.getByRole('status')).toHaveText('Thorin Ironfist got Longsword +1.')

  await give.getByRole('tab', { name: 'Coins' }).click()
  await give.getByRole('radio', { name: 'Split across the party' }).click()
  await give.getByPlaceholder(/47/).fill('47')
  await expect(give.getByText('23 gp 5 sp each.')).toBeVisible()
  await give.getByRole('button', { name: 'Split 47 gp' }).click()
  await expect(give.getByRole('status')).toHaveText('Shared out: 23 gp 5 sp each.')

  await give.getByRole('radio', { name: 'Take from one' }).click()
  await give.getByRole('radio', { name: 'Elowen' }).click()
  await give.getByPlaceholder(/47/).fill('500')
  await give.getByRole('button', { name: 'Take 500 gp' }).click()
  await expect(give.getByRole('status')).toContainText('Elowen only has')
  await give.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('tab', { name: 'Items and loot' }).click()
  const thorin = page.getByRole('article', { name: "Thorin Ironfist's things" })
  await expect(thorin).toContainText('Longsword +1')
  await expect(thorin.getByLabel(/^Coins:/)).toHaveAttribute('aria-label', 'Coins: 38 gp 9 sp 8 cp')
})

test('the Give browser: tags, ticking several, and a key item for the notebook', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Give an item' }).click()
  const give = page.getByRole('dialog', { name: 'Give' })
  await give.getByRole('group', { name: 'Rarity' }).getByRole('button', { name: 'Uncommon' }).click()
  await give.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Rings' }).click()
  const cards = give.getByRole('list', { name: 'Things to give' })
  await expect(cards.getByText('Ring of Jumping')).toBeVisible()
  await expect(cards.getByText('Cloak of Protection')).toHaveCount(0)
  await give.getByRole('button', { name: 'Tick Ring of Jumping' }).click()

  await give.getByRole('button', { name: 'Clear the tags' }).click()
  await give.getByRole('group', { name: 'Where from' }).getByRole('button', { name: 'Your items' }).click()
  await give.getByRole('button', { name: 'Tick The Raven Seal' }).click()
  await give.getByRole('group', { name: 'Where from' }).getByRole('button', { name: 'Your items' }).click()
  await give.getByRole('group', { name: 'Where from' }).getByRole('button', { name: 'Bits and bobs' }).click()
  await give.getByRole('button', { name: 'Tick Bent spoon' }).click()
  await give.getByRole('radio', { name: 'Elowen' }).click()
  await give.getByRole('button', { name: 'Give all 3 to Elowen' }).click()
  await expect(give.getByRole('status')).toHaveText('Elowen got Ring of Jumping, The Raven Seal, Bent spoon.')
  await give.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('input[placeholder="not found"]').last()).toHaveValue('Elowen')
})

test('the DM makes an item of their own', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  await page.getByRole('button', { name: 'Give an item' }).click()
  const give = page.getByRole('dialog', { name: 'Give' })
  await give.getByRole('tab', { name: 'Make your own' }).click()
  await give.getByPlaceholder('The Raven Seal').fill('Silver key')
  await give.getByRole('textbox', { name: 'What it is' }).fill('Small and cold. It opens the crypt door.')
  await give.getByRole('checkbox', { name: /Key item/ }).check()
  await give.getByRole('button', { name: 'Save the item' }).click()
  await expect(give.getByRole('status')).toHaveText('Silver key is saved. Find it under Your items.')
  await give.getByRole('button', { name: 'Back to giving' }).click()
  await give.getByRole('group', { name: 'Where from' }).getByRole('button', { name: 'Your items' }).click()
  await expect(give.getByRole('list', { name: 'Things to give' }).getByText('Silver key')).toBeVisible()
})

test('gold in one click, and an offer to buy that the player takes', async ({ page }) => {
  await page.goto('#/dev/dm/items')
  const thorin = page.getByRole('article', { name: "Thorin Ironfist's things" })
  await thorin.getByRole('button', { name: 'Add 5 gp' }).click()
  await thorin.getByRole('button', { name: 'Add 10 gp' }).click()
  await expect(thorin.getByRole('status')).toHaveText('Adding 15 gp…')
  await expect(thorin.getByLabel(/^Coins:/)).toHaveAttribute('aria-label', 'Coins: 30 gp 4 sp 8 cp')

  await thorin.getByRole('button', { name: 'Offer to buy Handaxe' }).click()
  await thorin.getByRole('textbox', { name: "How much you'll pay" }).fill('3')
  await thorin.getByRole('button', { name: 'Offer', exact: true }).click()
  await expect(thorin).toContainText('Offered 3 gp, waiting')
  await expect(thorin).toContainText('Thorin Ironfist sold Handaxe for 3 gp.')
})

test('a player sells to the DM from an offer card', async ({ page }) => {
  await page.goto('#/dev/table/gift')
  const offer = page.getByRole('dialog', { name: 'An offer for your things' })
  await expect(offer).toHaveText(/The DM offers 3 gp for your Handaxe\./)
  await offer.getByRole('button', { name: 'Sell' }).click()
  await expect(offer).toHaveCount(0)
})

test('a player hands a potion to a friend, a gift lands with a card, and a cloak is attuned', async ({ page }) => {
  await page.goto('#/dev/table/gift')
  await expect(page.getByRole('button', { name: 'You got Longsword +1 and 5 gp' })).toBeVisible()
  await page.getByRole('button', { name: 'You got Longsword +1 and 5 gp' }).click()
  const potion = page.getByRole('row').filter({ hasText: 'Potion of Healing' })
  await potion.getByRole('button', { name: 'Give to…' }).click()
  await potion.getByRole('button', { name: 'Hand over' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'You gave Elowen' })).toHaveText(
    'You gave Elowen a Potion of Healing.',
  )
  const cloak = page.getByRole('row').filter({ hasText: 'Cloak of Protection' })
  await cloak.getByRole('button', { name: 'Attune' }).click()
  await expect(cloak.getByRole('button', { name: 'Attuned' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Attuned to 1 of 3.')).toBeVisible()
})

test('the DM opens a valuable chest, adds a key item and puts it on the table', async ({ page }) => {
  await page.goto('#/dev/dm/items')
  await page.getByRole('button', { name: 'Open a box' }).click()
  const box = page.getByRole('dialog', { name: 'Open a box' })
  await box.getByRole('radio', { name: /^Valuable/ }).click()
  await box.getByRole('radio', { name: /^15 to 19/ }).click()
  await expect(box.getByText('Magic items up to uncommon.')).toBeVisible()
  await box.getByText('How full boxes are').click()
  await box.getByRole('spinbutton', { name: 'Junk: Bits and bobs, most' }).fill('6')
  await expect(box.getByRole('spinbutton', { name: 'Junk: Bits and bobs, most' })).toHaveValue('6')
  await box.getByRole('button', { name: 'Open it', exact: true }).click()

  const inside = box.getByRole('list', { name: 'In the box' })
  await expect(inside.getByRole('listitem').first()).toBeVisible()
  await expect(box.getByRole('textbox', { name: 'Coins in the box' })).toHaveValue(/gp/)
  const first = inside.getByRole('button', { name: /^Roll again for / }).first()
  await first.click()
  await box.getByRole('textbox', { name: 'Add something to the box' }).fill('raven')
  await box.getByRole('button', { name: 'The Raven Seal' }).click()
  await expect(inside).toContainText('The Raven Seal')
  await box.getByRole('button', { name: 'Put it on the table' }).click()
  await expect(box.getByRole('status')).toHaveText('It’s on the table for the party.')
  await box.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByRole('region', { name: 'Party stash' })).toContainText('The Raven Seal')
  await expect(page.locator('input[placeholder="not found"]').last()).toHaveValue('On the table')
})

test('a player takes from the party stash and shares out its coins', async ({ page }) => {
  await page.goto('#/dev/table/gift')
  await page.getByTitle('What you carry and your coins').click()
  const stash = page.getByRole('region', { name: 'Party stash' })
  await expect(stash).toContainText('To someone called Merra.')
  await stash.getByRole('button', { name: 'Take Dagger' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'You took' })).toHaveText(
    'You took Dagger from the party stash.',
  )
  await stash.getByRole('button', { name: 'Split the coins' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'shared' })).toHaveText(
    'The coins are shared out across the party.',
  )
})

test('the DM makes a pricey blacksmith with a magic cloak, opens it, and undoes a sale', async ({ page }) => {
  await page.goto('#/dev/dm/items')
  const shops = page.getByRole('region', { name: 'Shops' })
  await shops.getByRole('button', { name: 'Make a shop' }).click()
  const dialog = page.getByRole('dialog', { name: 'Make a shop' })
  await dialog.getByRole('radio', { name: /^Blacksmith/ }).click()
  await dialog.getByPlaceholder('Brenna').fill('Old Harl')
  await dialog.getByRole('radio', { name: 'Pricey' }).click()
  const shelves = dialog.getByRole('table', { name: 'On the shelves' })
  await expect(shelves.getByRole('textbox', { name: 'Price of Longsword' })).toHaveAttribute(
    'placeholder',
    '18 gp 7 sp 5 cp',
  )
  await dialog.getByRole('textbox', { name: 'Add to the shelves' }).fill('cloak of protection')
  await dialog.getByRole('button', { name: 'Cloak of Protection' }).click()
  await expect(dialog.getByText(/Set a price for Cloak of Protection/)).toBeVisible()
  await shelves.getByRole('textbox', { name: 'Price of Cloak of Protection' }).fill('400')
  await expect(dialog.getByText(/Set a price for/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Make the shop' }).click()

  await expect(shops).toContainText('Blacksmith')
  await expect(shops).toContainText('Old Harl')
  await shops.getByRole('button', { name: 'Open Blacksmith' }).click()
  await expect(shops.getByRole('button', { name: 'Close Blacksmith' })).toHaveAttribute('aria-pressed', 'true')

  const sales = shops.getByRole('list', { name: 'Sales' })
  await expect(sales).toContainText('Elowen bought 2 × Torch for 2 cp')
  await sales.getByRole('button', { name: 'Undo' }).click()
  await expect(sales).toContainText('undone')
  await shops.getByRole('checkbox', { name: /Players can add gear for free/ }).uncheck()
  await expect(shops.getByRole('checkbox', { name: /Players can add gear for free/ })).not.toBeChecked()
})

test('a player buys rope and sells a handaxe in an open shop', async ({ page }) => {
  await page.goto('#/dev/table/gift')
  await page.getByRole('button', { name: 'Brenna’s Goods is open' }).click()
  const shop = page.getByRole('region', { name: 'Shop' })
  await expect(shop).toContainText('Your purse: 15 gp 4 sp 8 cp')
  await shop.getByRole('button', { name: 'Buy Rope, hempen (50 feet)' }).click()
  await expect(shop.getByRole('status')).toHaveText('You bought Rope, hempen (50 feet) for 1 gp.')
  await expect(shop).toContainText('Your purse: 14 gp 4 sp 8 cp')
  await shop.getByRole('tab', { name: 'Sell' }).click()
  await shop.getByRole('button', { name: 'Sell Handaxe for 2 gp 5 sp' }).click()
  await expect(shop.getByRole('status')).toHaveText('You sold Handaxe for 2 gp 5 sp.')
  await expect(shop).toContainText('Your purse: 16 gp 9 sp 8 cp')
})

test('a player narrows the shop with tags and haggles for rope', async ({ page }) => {
  await page.goto('#/dev/table/gift')
  await page.getByRole('button', { name: 'Brenna’s Goods is open' }).click()
  const shop = page.getByRole('region', { name: 'Shop' })
  const shelves = shop.getByRole('list', { name: 'On the shelves' })
  await shop
    .getByRole('group', { name: 'What kind' })
    .getByRole('button', { name: /Kits and tools/ })
    .click()
  await expect(shelves.getByText("Climber's Kit")).toBeVisible()
  await expect(shelves.getByText('Rope, hempen (50 feet)')).toHaveCount(0)
  await shop
    .getByRole('group', { name: 'What kind' })
    .getByRole('button', { name: /Kits and tools/ })
    .click()

  await shop.getByRole('button', { name: 'Haggle for Rope, hempen (50 feet)' }).click()
  await shop.getByRole('textbox', { name: "What you'll pay for Rope, hempen (50 feet)" }).fill('0.5')
  await shop
    .getByRole('form', { name: 'Your offer for Rope, hempen (50 feet)' })
    .getByRole('button', { name: 'Offer' })
    .click()
  await expect(shop.getByRole('status')).toHaveText('You offer 5 sp. Brenna is thinking about it.')
  await expect(shelves.getByText('Brenna says 7 sp 5 cp.')).toBeVisible()
  await shelves.getByRole('button', { name: 'Take it' }).click()
  await expect(shop.getByRole('status')).toHaveText('It’s yours.')
  await expect(shop).toContainText('Your purse: 14 gp 7 sp 3 cp')
})

test('the DM answers a haggle: Persuasion first, then a counter-price', async ({ page }) => {
  await page.goto('#/dev/dm/haggle')
  const card = page.getByRole('article', { name: 'Elowen is haggling' })
  await expect(card).toContainText('Elowen offers 15 gp for Crossbow, light')
  await expect(card).toContainText('The shop asks 25 gp.')
  await card.getByRole('button', { name: 'Ask for Persuasion' }).click()
  await expect(page.getByRole('dialog')).toContainText('Persuasion')
  await page.keyboard.press('Escape')
  await card.getByRole('textbox', { name: 'Counter-price for Elowen' }).fill('20')
  await card.getByRole('button', { name: 'Counter' }).click()
  await expect(card).toHaveCount(0)
})

test('the DM sees what things are worth, and clears the party stash', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('#/dev/dm/items')
  const thorin = page.getByRole('article', { name: "Thorin Ironfist's things" })
  await expect(thorin).toContainText('Longsword · 15 gp')
  await thorin.getByRole('button', { name: 'Offer to buy Handaxe' }).click()
  await expect(thorin).toContainText('Worth 5 gp')
  await thorin.getByRole('textbox', { name: "How much you'll pay" }).fill('1')
  await expect(thorin).toContainText('Worth 5 gp: that’s cheap')

  const shops = page.getByRole('region', { name: 'Shops' })
  await shops.getByRole('button', { name: 'Make a shop' }).click()
  const dialog = page.getByRole('dialog', { name: 'Make a shop' })
  await dialog.getByRole('radio', { name: /^Blacksmith/ }).click()
  await dialog.getByRole('radio', { name: 'Pricey' }).click()
  await expect(dialog.getByRole('row').filter({ hasText: /^Longsword/ })).toContainText('pricey')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Open a box' }).click()
  const box = page.getByRole('dialog', { name: 'Open a box' })
  await box.getByRole('button', { name: 'Open it', exact: true }).click()
  await box.getByRole('textbox', { name: 'Add something to the box' }).fill('bent spoon')
  await box.getByRole('button', { name: 'Bent spoon' }).click()
  await box.getByRole('button', { name: 'Put it on the table' }).click()
  await box.getByRole('button', { name: 'Done' }).click()
  const stash = page.getByRole('region', { name: 'Party stash' })
  await stash.getByRole('button', { name: 'Take Bent spoon out of the stash' }).click()
  await expect(stash).not.toContainText('Bent spoon')
  await stash.getByRole('button', { name: 'Clear the stash' }).click()
  await expect(stash).toContainText('Empty.')
})

test('story mode: the DM writes a scene, goes there and shows the read-aloud', async ({ page }) => {
  await page.goto('#/dev/dm/story')
  const outline = page.getByRole('navigation', { name: 'Chapters and scenes' })
  await expect(outline).toContainText('Arrive at the tavern')
  await outline.getByRole('button', { name: 'The mill road' }).click()
  const scene = page.getByRole('article', { name: 'Scene: The mill road' })
  await expect(scene.getByRole('textbox', { name: 'Reminders' })).toHaveValue(/Goblin tracks/)
  await scene.getByRole('button', { name: 'Go here' }).click()
  await expect(page.getByText('Scene now:')).toContainText('The mill road')
  await expect(outline.getByRole('button', { name: /The mill road/ })).toContainText('Where we are')
  await expect(scene.getByRole('button', { name: 'Go here again' })).toBeVisible()

  await scene.getByRole('button', { name: 'Show the read-aloud' }).click()
  await expect(scene.getByText('Everyone can read this on the stage now.')).toBeVisible()
  await scene.getByRole('button', { name: 'Take it off the stage' }).click()
  await expect(scene.getByText('Everyone can read this on the stage now.')).toHaveCount(0)

  await outline.getByRole('button', { name: 'New scene' }).click()
  const fresh = page.getByRole('article', { name: 'Scene: A new scene' })
  await fresh.getByRole('textbox', { name: 'Scene title' }).fill('The old mill')
  await expect(outline).toContainText('The old mill')
})

test('story mode: players read the read-aloud on stage', async ({ page }) => {
  await page.goto('#/dev/table/story')
  await expect(page.getByRole('region', { name: 'Read aloud' })).toContainText('Rain drums on the shutters.')
})

test('story mode: a scene plans a secret roll, a choice, a body to search and a fight', async ({ page }) => {
  await page.goto('#/dev/dm/story')
  const plans = page.getByRole('region', { name: 'In this scene' })
  await plans.getByRole('button', { name: 'Ask: Perception, DC 13, secret DC, outcome kept' }).click()
  const ask = page.getByRole('dialog', { name: 'Ask for a roll' })
  await expect(ask.getByRole('button', { name: /Perception/ }).first()).toHaveAttribute('aria-pressed', 'true')
  await expect(ask.getByRole('spinbutton')).toHaveValue('13')
  await expect(ask.getByRole('checkbox', { name: 'Tell players the outcome' })).not.toBeChecked()
  await expect(ask).toContainText('Only you will know who passed.')
  await ask.getByRole('button', { name: 'Roll behind the screen' }).click()
  await expect(ask).toHaveCount(0)

  await plans.getByRole('button', { name: 'Search an ordinary body' }).click()
  const box = page.getByRole('dialog', { name: 'Open a box' })
  await expect(box.getByRole('radio', { name: /^A body/ })).toHaveAttribute('aria-checked', 'true')
  await box.getByRole('button', { name: 'Done' }).click()

  await plans.getByRole('button', { name: 'The mill road' }).click()
  const road = page.getByRole('region', { name: 'In this scene' })
  await road.getByRole('button', { name: 'Start the fight: 3 × Goblin' }).click()
  const fight = page.getByRole('dialog', { name: 'Start combat' })
  await expect(fight.getByRole('list', { name: 'Monsters in this fight' })).toContainText('3 × Goblin')
  await fight.getByRole('button', { name: 'Cancel' }).click()

  await road.getByRole('button', { name: 'Plan a roll' }).click()
  const form = road.getByRole('form', { name: 'Plan a roll' })
  await form.getByRole('combobox').first().selectOption('skill:survival')
  await form.getByRole('spinbutton', { name: 'DC' }).fill('12')
  await form.getByRole('button', { name: 'Add the roll' }).click()
  await expect(road.getByRole('button', { name: 'Ask: Survival, DC 12, secret DC' })).toBeVisible()
})

test('NPCs: the DM edits a person, shows them, and makes someone up', async ({ page }) => {
  await page.goto('#/dev/dm/npcs')
  const people = page.getByRole('navigation', { name: 'Your people' })
  await people.getByRole('button', { name: /Brenna/ }).click()
  const brenna = page.getByRole('article', { name: 'Person: Brenna' })
  await expect(brenna.getByRole('textbox', { name: /Their secrets/ })).toHaveValue('She owes the goblins money.')
  await brenna.getByRole('radio', { name: 'Wary' }).click()
  await expect(brenna.getByRole('radio', { name: 'Wary' })).toHaveAttribute('aria-checked', 'true')
  await brenna.getByRole('button', { name: 'Show' }).click()
  await expect(people).toContainText('On stage: Brenna')
  await brenna.getByRole('button', { name: 'Hide' }).click()
  await expect(people).not.toContainText('On stage:')

  await people.getByRole('button', { name: 'Make someone up' }).click()
  const madeUp = page.getByRole('article', { name: 'Someone made up' })
  const name = (await madeUp.getByRole('heading').textContent()) ?? ''
  await madeUp.getByRole('button', { name: 'Keep them' }).click()
  await expect(people.getByRole('button', { name: new RegExp(name) })).toBeVisible()
})

test('NPCs: a scene shows who is there, and the player sees them on stage', async ({ page }) => {
  await page.goto('#/dev/dm/story')
  const here = page.getByRole('region', { name: 'People here' })
  await here.getByRole('button', { name: 'Show Brenna' }).click()
  await expect(here.getByRole('button', { name: 'On stage' })).toBeDisabled()
  await page.goto('#/dev/table/story')
  await expect(page.getByRole('region', { name: 'On stage: Brenna' })).toContainText('Innkeeper')
})

test('the DM takes a handaxe away from a player', async ({ page }) => {
  await page.goto('#/dev/dm/items')
  const thorin = page.getByRole('article', { name: "Thorin Ironfist's things" })
  await thorin.getByRole('button', { name: 'Take Handaxe away from Thorin Ironfist' }).click()
  await thorin.getByRole('spinbutton', { name: 'How many to take away' }).fill('1')
  await thorin.getByRole('button', { name: 'Take it', exact: true }).click()
  await expect(thorin).not.toContainText('2 × Handaxe')
  await expect(thorin).toContainText('Handaxe')
})

test('paste your notes: the example becomes chapters and scenes, with how hard each fight is', async ({ page }) => {
  await page.goto('#/dev/dm/story')
  await page
    .getByRole('navigation', { name: 'Chapters and scenes' })
    .getByRole('button', { name: 'Paste your notes' })
    .click()
  const paste = page.getByRole('dialog', { name: 'Paste your notes' })
  await paste.getByRole('button', { name: 'Try the example' }).click()
  const preview = paste.getByRole('region', { name: 'What it makes' })
  await expect(preview).toContainText('The Drowned Bell: 4 chapters, 6 scenes, 2 people and 1 item')
  await expect(preview).toContainText('fight: 2 × Sahuagin, 2 × Merfolk (')
  await expect(preview).toContainText('Nothing called Cliff path in your library yet')
  await paste.getByRole('button', { name: 'Add it to my story' }).click()
  await expect(paste.getByRole('status')).toContainText('Added: 4 chapters, 6 scenes')
  await paste.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('navigation', { name: 'Chapters and scenes' })).toContainText('The Bell Chapel')
})

test('notes on an NPC, and one when they are shown', async ({ page }) => {
  await page.goto('#/dev/dm/npcs')
  await page
    .getByRole('navigation', { name: 'Your people' })
    .getByRole('button', { name: /Brenna/ })
    .click()
  const brenna = page.getByRole('article', { name: 'Person: Brenna' })
  await brenna.getByRole('textbox', { name: 'Add a note about them' }).fill('Lied about the mill.')
  await brenna.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(brenna.getByRole('region', { name: "What's happened" })).toContainText('Lied about the mill.')
  await brenna.getByRole('button', { name: 'Show' }).click()
  await expect(brenna.getByRole('region', { name: "What's happened" })).toContainText('Met the party.')
})

test('the DM puts coins in the party stash', async ({ page }) => {
  await page.goto('#/dev/dm/items')
  const stash = page.getByRole('region', { name: 'Party stash' })
  await stash.getByRole('button', { name: 'Add 10 gp' }).click()
  await expect(stash).toContainText('10')
  await expect(stash.getByLabel(/^Coins:/)).toHaveAttribute('aria-label', 'Coins: 10 gp')
})

test('rules: a player looks up prone from the Rules button, and from their own conditions', async ({ page }) => {
  await page.goto('#/dev/table/rules')
  await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Rules' }).click()
  const rules = page.getByRole('region', { name: 'Rules' })
  await expect(rules.getByRole('tab', { name: 'Conditions' })).toHaveAttribute('aria-selected', 'true')
  // Your own conditions come first, marked.
  await expect(rules.getByRole('listitem').first()).toContainText('You')
  await rules.getByRole('searchbox', { name: 'Search the rules' }).fill('dash')
  await expect(rules.getByRole('button', { name: /Action: Dash/ })).toBeVisible()
  await expect(rules).toContainText('extra movement equal to your speed')
  await rules.getByRole('button', { name: 'Close' }).click()
  await expect(rules).toBeHidden()

  await page.getByRole('region', { name: 'Abilities and conditions' }).getByRole('button', { name: 'Prone' }).click()
  await expect(rules.getByRole('button', { name: /Prone/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(rules).toContainText("You're lying on the ground")
  await rules.getByText('The rules’ words').first().click()
  await expect(rules).toContainText("A prone creature's only movement option is to crawl")
  await page.keyboard.press('Escape')
  await expect(rules).toBeHidden()
})

test('rules: the sections explain turns, dice and rests', async ({ page }) => {
  await page.goto('#/dev/table/rules')
  await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Rules' }).click()
  const rules = page.getByRole('region', { name: 'Rules' })
  await rules.getByRole('tab', { name: 'Rolling dice' }).click()
  await rules.getByRole('button', { name: 'Advantage and disadvantage' }).click()
  await expect(rules).toContainText('roll two d20s and use the higher')
  await rules.getByRole('button', { name: 'The 18 skills' }).click()
  await expect(rules).toContainText('Athletics (Strength): climbing, jumping, swimming')
  await rules.getByRole('tab', { name: 'Resting' }).click()
  await rules.getByRole('button', { name: 'Short rest' }).click()
  await expect(rules).toContainText('spend hit dice')
})

test('the DM searches their quick notes, by session, on the Log tab', async ({ page }) => {
  await page.goto('#/dev/dm/party')
  const notebook = page.getByRole('region', { name: 'Your notebook' })
  await notebook.getByLabel('Quick note').fill('Tobin wears a pearl on a string')
  await notebook.getByRole('button', { name: 'Add', exact: true }).click()
  await notebook.getByLabel('Quick note').fill('The party owes the innkeeper 5 gp')
  await notebook.getByRole('button', { name: 'Add', exact: true }).click()

  await page.getByRole('tab', { name: 'Log' }).click()
  await page.getByRole('button', { name: 'Session notes' }).click()
  const notes = page.getByRole('region', { name: 'Session notes' })
  await expect(notes).toContainText('Session 1')
  await notes.getByLabel('Search your notes').fill('pearl')
  await expect(notes).toContainText('1 note found')
  await expect(notes.locator('mark')).toHaveText('pearl')
  await expect(notes).not.toContainText('innkeeper')
})

test('rules: a wizard finds her spells, and the DM opens Rules with the ? key', async ({ page }) => {
  await page.goto('#/dev/table/caster')
  await page.keyboard.press('?')
  const rules = page.getByRole('region', { name: 'Rules' })
  await rules.getByRole('tab', { name: 'Spells' }).click()
  const spells = rules.getByRole('list', { name: 'Spells', exact: true })
  await expect(spells.getByRole('listitem').first()).toContainText('Fire Bolt')
  await expect(spells.getByRole('listitem').first()).toContainText('Yours')
  await rules.getByRole('button', { name: '1', exact: true }).click()
  await spells.getByRole('button', { name: /Magic Missile/ }).click()
  await expect(spells).toContainText('three glowing darts')
  await page.keyboard.press('/')
  await page.keyboard.type('concentration')
  await expect(rules.getByRole('list', { name: 'What we found' }).getByRole('listitem').first()).toContainText(
    'Concentration',
  )
  await page.keyboard.press('Escape')
  await expect(rules).toBeHidden()

  await page.goto('#/dev/dm/story')
  await page.keyboard.press('?')
  const dmRules = page.getByRole('region', { name: 'Rules' })
  await dmRules.getByRole('searchbox', { name: 'Search the rules' }).fill('fireball')
  await dmRules.getByRole('button', { name: /^Fireball/ }).click()
  await expect(dmRules).toContainText('A bright streak flashes from your pointing finger')
  await page.getByRole('button', { name: 'Rules', pressed: true }).click()
  await expect(dmRules).toBeHidden()
})

test('rules: in a fight, your own condition in the turn order opens what it does', async ({ page }) => {
  await page.goto('#/dev/table/dying')
  await page.getByRole('list', { name: 'Turn order' }).getByRole('button', { name: 'Unconscious' }).click()
  const rules = page.getByRole('region', { name: 'Rules' })
  await expect(rules.getByRole('button', { name: /Unconscious/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(rules).toContainText("You're out cold")
})

test('conditions: the DM paralyses a goblin for 2 rounds with a save each turn, and it counts down', async ({
  page,
}) => {
  await page.goto('#/dev/battle')
  await page.getByRole('button', { name: 'Goblin A', exact: true }).click()
  const acting = page.getByRole('region', { name: 'Acting now' })
  await expect(acting).toContainText('Goblin A')
  await acting.getByLabel('Add a condition').selectOption('paralyzed')
  const picker = acting.getByRole('group', { name: 'How long is it paralysed?' })
  await picker.getByLabel('How long').selectOption({ label: '2 rounds' })
  await picker.getByLabel('Save each turn').selectOption('wisdom')
  await picker.getByLabel('Save DC').fill('30')
  await picker.getByRole('button', { name: 'Put it on' }).click()
  await expect(acting).toContainText('Paralysed · 2 rounds · saves each turn (Wisdom DC 30)')
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText('Goblin A is now paralysed for 2 rounds, with a Wisdom save each turn.')

  // Turns go round: a round comes off as the goblin's turn starts, and it fails its save as it ends.
  for (let i = 0; i < 5 && !(await feed.textContent())?.includes('still paralysed'); i++) {
    await page.getByRole('button', { name: 'Next turn' }).click()
  }
  await expect(feed).toContainText('Goblin A is still paralysed.')
  await page.getByRole('button', { name: 'Goblin A', exact: true }).click()
  await expect(acting).toContainText('Paralysed · 1 round · saves each turn (Wisdom DC 30)')
})

test('conditions: a player stands up, breaks free and shakes off poison on their turn', async ({ page }) => {
  await page.goto('#/dev/table/held')
  const yours = page.getByRole('region', { name: 'Your conditions' })
  await expect(yours).toContainText('You’re poisoned (9 rounds · saves each turn (Constitution))')
  const ribbon = page.getByRole('list', { name: 'Turn order' })
  await expect(ribbon.getByRole('button', { name: 'Prone' })).toBeVisible()
  await yours.getByRole('button', { name: 'Stand up (13 ft)' }).click()
  await expect(ribbon.getByRole('button', { name: 'Prone' })).toBeHidden()
  await yours.getByRole('button', { name: 'Break free' }).click()
  await expect(ribbon.getByRole('button', { name: 'Grappled' })).toBeHidden()
  await yours.getByRole('button', { name: 'Roll a Constitution save to shake off Poisoned' }).click()
  await expect(ribbon.getByRole('button', { name: /Poisoned/ })).toBeHidden()
  await expect(yours).toBeHidden()
})

test('talk: a player tries to persuade the goblins with their action, and it shows in the feed', async ({ page }) => {
  await page.goto('#/dev/table/fight')
  const talk = page.getByRole('region', { name: 'Talk' })
  await talk.getByRole('button', { name: 'Persuade' }).click()
  await expect(talk.getByLabel('Who to')).toHaveValue('everyone')
  await talk.getByPlaceholder('Optional: say it in a line').fill('Lay down your arms and you can walk away.')
  await talk.getByRole('button', { name: 'Persuade: roll Persuasion' }).click()
  await expect(page.getByRole('region', { name: 'What happened' })).toContainText(
    'You try to persuade Goblin A and Unknown creature 2: ‘Lay down your arms and you can walk away.’ (Persuasion',
  )
  // It spent the action.
  await expect(talk.getByRole('button', { name: 'Intimidate' })).toBeDisabled()
})

test('talk: the DM answers a talk card, the goblins surrender, then a parley pauses the fight', async ({ page }) => {
  await page.goto('#/dev/battle/talk')
  const cards = page.getByRole('list', { name: 'Talk cards' })
  await expect(cards).toContainText('Thorin Ironfist tries to intimidate Goblin A and Goblin B. Intimidation 16')
  // The quiet morale nudge for the goblin that's nearly dead.
  await expect(page.getByRole('list', { name: 'Morale' })).toContainText(
    'Goblin B is nearly dead: it might run or beg.',
  )
  await cards.getByRole('button', { name: 'It works' }).click()
  await cards.getByRole('button', { name: 'They surrender' }).click()
  await expect(cards).toBeHidden()
  const feed = page.getByRole('region', { name: 'What happened' })
  await expect(feed).toContainText("Thorin Ironfist's words work: Goblin A and Goblin B surrender.")
  await expect(page.getByRole('region', { name: 'Turn order' })).toContainText('Surrendered')
  await expect(page.getByRole('list', { name: 'Morale' })).toBeHidden()

  // Undo brings the card back.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(cards).toBeVisible()

  // A parley: Next turn waits until Back to the fight.
  await page.getByRole('button', { name: 'Parley', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Parley: talking, not fighting' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next turn' })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to the fight' }).click()
  await expect(feed).toContainText('Back to the fight.')
  await expect(page.getByRole('button', { name: 'Next turn' })).toBeEnabled()
})

test('ready-made art: the DM adds a painted place from the pictures that come with the table', async ({ page }) => {
  await page.goto('#/dev/stage')
  const library = page.getByRole('region', { name: 'Art library' })
  await library.getByRole('button', { name: 'Add Crossroads' }).click()
  await expect(library.getByRole('button', { name: 'Crossroads', exact: true })).toBeVisible()
  await expect(library.getByRole('button', { name: 'Add Crossroads' })).toBeHidden()
  // And one of the painted battle maps.
  await library.getByRole('tab', { name: 'Maps' }).click()
  await library.getByRole('button', { name: 'Add Ritual hall' }).click()
  await expect(library.getByRole('button', { name: 'Ritual hall', exact: true })).toBeVisible()
})

test('ready-made art: an NPC gets a ready-made portrait, and a goblin shows its picture in the turn order', async ({
  page,
}) => {
  await page.goto('#/dev/dm/npcs')
  await page
    .getByRole('navigation', { name: 'Your people' })
    .getByRole('button', { name: /Brenna/ })
    .click()
  const brenna = page.getByRole('article', { name: 'Person: Brenna' })
  await brenna.getByLabel('Portrait').selectOption({ label: 'Town sheriff' })
  await expect(brenna.getByRole('img', { name: 'Town sheriff' })).toBeVisible()
  await expect(brenna.getByLabel('Portrait')).toHaveValue(/./)

  await page.goto('#/dev/battle')
  const goblin = page.getByRole('button', { name: 'Goblin A', exact: true })
  await expect(goblin.locator('img')).toHaveAttribute('src', /art\/tokens\/goblin\.jpg$/)
})

test('saved campaigns: the DM saves a campaign as a preset, then starts from it', async ({ page }) => {
  await page.goto('#/dev/dm/story')
  await page
    .getByRole('navigation', { name: 'Chapters and scenes' })
    .getByRole('button', { name: 'Paste your notes' })
    .click()
  const paste = page.getByRole('dialog', { name: 'Paste your notes' })
  await expect(paste.getByLabel('Your saved campaigns')).toBeHidden()
  await paste.getByRole('button', { name: 'Try the example' }).click()
  await paste.getByRole('button', { name: 'Save as a preset' }).click()
  await expect(paste.getByRole('status')).toContainText('Saved as a preset: The Drowned Bell')
  await expect(paste.getByRole('button', { name: 'Saved as a preset' })).toBeDisabled()

  await paste.getByRole('textbox', { name: 'Your campaign notes' }).fill('')
  await paste.getByLabel('Your saved campaigns').selectOption({ label: 'The Drowned Bell' })
  const preview = paste.getByRole('region', { name: 'What it makes' })
  await expect(preview).toContainText('The Drowned Bell: 4 chapters, 6 scenes')
  await paste.getByRole('button', { name: 'Add it to my story' }).click()
  await expect(paste.getByRole('status')).toContainText('Added: 4 chapters, 6 scenes')
})
