/// <reference lib="dom" />
// A fight end to end, in two browsers against the real Supabase project (C1, the turn loop): the DM
// starts a fight with a goblin on a battle map, the player sees the map and rolls initiative, the
// first turn starts by itself, the goblin attacks the player in two clicks, the player moves and
// attacks the goblin by picking it, the turn record comes back each turn, and the DM undoes a hit.
//
// It signs in with the two test logins (see scripts/e2e.mjs), makes a throwaway campaign with a
// made-up map, and deletes both afterwards. Run it with: npm run test:e2e

import { deflateSync } from 'node:zlib'
import { expect, test, type Browser, type Page } from '@playwright/test'

const url = process.env.VITE_SUPABASE_URL ?? ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const dmLogin = { email: process.env.E2E_DM_EMAIL ?? '', password: process.env.E2E_DM_PASSWORD ?? '' }
const playerLogin = { email: process.env.E2E_PLAYER_EMAIL ?? '', password: process.env.E2E_PLAYER_PASSWORD ?? '' }
const ready = Boolean(url && anonKey && dmLogin.password && playerLogin.password)

type Session = { access_token: string; user: { id: string } }

async function signIn(login: { email: string; password: string }): Promise<Session> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(login),
  })
  if (!response.ok) throw new Error(`Couldn't sign in as ${login.email}: ${response.status} ${await response.text()}`)
  return (await response.json()) as Session
}

async function api<T>(session: Session, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

async function signedInPage(browser: Browser, session: Session): Promise<Page> {
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  const context = await browser.newContext()
  await context.addInitScript({
    content: `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify(session))})`,
  })
  return context.newPage()
}

/** A plain stone-grey picture, 700 by 420, to use as the battle map. */
function mapPicture(): Buffer {
  const width = 700
  const height = 420
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const check = Buffer.alloc(4)
    check.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, check])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour: RGB
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set([60, 52, 46], y * (width * 3 + 1) + 1 + x * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test.skip(!ready, 'Needs the two test logins: run it with npm run test:e2e')

let dm: Session
let campaignId = ''
let mapPath = ''

test.afterAll(async () => {
  if (!dm || !campaignId) return
  await api(dm, `campaigns?id=eq.${campaignId}`, { method: 'DELETE' })
  if (mapPath) {
    await fetch(`${url}/storage/v1/object/art/${mapPath}`, {
      method: 'DELETE',
      headers: { apikey: anonKey, Authorization: `Bearer ${dm.access_token}` },
    })
  }
})

test('a fight on a battle map, from Start combat to attacks, turns and Undo', async ({ browser }) => {
  test.setTimeout(180_000)

  // A throwaway table: the DM starts it, the player joins and makes a fighter with a longsword.
  dm = await signIn(dmLogin)
  const player = await signIn(playerLogin)
  campaignId = await api<string>(dm, 'rpc/create_campaign', { body: { p_name: 'Fight test', p_dm_name: 'Test DM' } })
  const [{ join_code }] = await api<{ join_code: string }[]>(dm, `campaigns?id=eq.${campaignId}&select=join_code`, {
    method: 'GET',
  })
  await api(player, 'rpc/join_campaign', { body: { p_code: join_code, p_display_name: 'Test player' } })
  await api(player, 'characters', {
    body: {
      campaign_id: campaignId,
      owner_id: player.user.id,
      name: 'Test Fighter',
      class: 'Fighter',
      level: 1,
      strength: 16,
      speed: 30,
      armour_class: 16,
      max_hp: 20,
      current_hp: 20,
      attacks: [
        {
          id: 'longsword',
          name: 'Longsword',
          weapon: 'longsword',
          proficient: true,
          magicBonus: 0,
          ability: 'strength',
          damageDice: '',
          damageType: '',
        },
      ],
    },
  })

  // A battle map in the library.
  mapPath = `${campaignId}/fight-test-map.png`
  const picture = mapPicture()
  const uploaded = await fetch(`${url}/storage/v1/object/art/${mapPath}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${dm.access_token}`, 'Content-Type': 'image/png' },
    body: new Uint8Array(picture),
  })
  if (!uploaded.ok) throw new Error(`Map upload: ${uploaded.status} ${await uploaded.text()}`)
  await api(dm, 'assets', {
    body: { campaign_id: campaignId, kind: 'art', category: 'maps', name: 'Test map', path: mapPath, size_bytes: picture.length },
  })

  const dmPage = await signedInPage(browser, dm)
  const playerPage = await signedInPage(browser, player)
  await dmPage.goto(`#/c/${campaignId}/dm`)
  await playerPage.goto(`#/c/${campaignId}/play`)
  await expect(playerPage.getByText('Test Fighter').first()).toBeVisible()

  // The DM starts a fight with a goblin, on the map, and players know what it is.
  await dmPage.getByRole('button', { name: 'Start combat' }).click()
  const dialog = dmPage.getByRole('dialog', { name: 'Start combat' })
  await dialog.getByLabel('Find a monster').fill('goblin')
  await dialog.getByRole('button', { name: /^Goblin CR 1\/4/ }).click()
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /Test map/ })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Start the fight' }).click()

  // The player sees the map with miniatures, and rolls initiative.
  await expect(playerPage.getByText('Drag to move around')).toBeVisible({ timeout: 20_000 })
  const prompt = playerPage.getByRole('dialog', { name: 'Roll initiative' })
  await prompt.getByRole('button', { name: 'Roll the d20' }).click()

  // Everyone has rolled: the first turn starts by itself, on both screens.
  const order = dmPage.getByRole('region', { name: 'Turn order' })
  await expect(order.getByText('Acting')).toBeVisible({ timeout: 20_000 })
  const playerFirst = await playerPage
    .getByText('Your turn · Round 1')
    .waitFor({ timeout: 8_000 })
    .then(
      () => true,
      () => false,
    )

  async function goblinTurn() {
    await expect(dmPage.getByRole('region', { name: 'Acting now' })).toContainText('Goblin A')
    await dmPage.getByRole('region', { name: 'Acting now' }).getByRole('button', { name: /Scimitar/ }).click()
    await order.getByRole('button', { name: 'Test Fighter', exact: true }).click()
    await expect(dmPage.getByRole('region', { name: 'What happened' })).toContainText(
      /Goblin A (hits|misses) Test Fighter with Scimitar/,
    )
    await expect(playerPage.getByRole('region', { name: 'What happened' })).toContainText(
      /Goblin A (hits|misses) you with Scimitar/,
    )
    await dmPage.getByRole('button', { name: 'Next turn' }).click()
  }

  if (!playerFirst) await goblinTurn()

  // The player's turn: everything ready, movement counted, then an attack on the goblin.
  await expect(playerPage.getByText(/Your turn · Round \d/)).toBeVisible({ timeout: 20_000 })
  const turn = playerPage.getByRole('region', { name: 'This turn' })
  await expect(turn).toContainText(/Action\s*Ready/)
  await expect(turn).toContainText('30 of 30 ft')
  const [token] = await api<{ id: string; x: number; y: number }[]>(
    player,
    `tokens?campaign_id=eq.${campaignId}&character_id=not.is.null&select=id,x,y`,
    { method: 'GET' },
  )
  await api(player, 'rpc/move_token', { body: { p_token_id: token.id, p_x: token.x + 1, p_y: token.y } })
  await expect(turn).toContainText('25 of 30 ft')
  await expect(
    api(player, 'rpc/move_token', { body: { p_token_id: token.id, p_x: token.x + 20, p_y: token.y } }),
  ).rejects.toThrow(/You can move 25 more feet this turn/)

  await playerPage.getByRole('button', { name: /Longsword/ }).first().click()
  await playerPage.getByRole('list', { name: 'Turn order' }).getByRole('button', { name: /Goblin A/ }).click()
  await expect(playerPage.getByRole('region', { name: 'What happened' })).toContainText(
    /You (hit|miss) Goblin A with Longsword/,
  )
  await expect(dmPage.getByRole('region', { name: 'What happened' })).toContainText(
    /Test Fighter (hits|misses) Goblin A with Longsword/,
  )
  await expect(turn).toContainText(/Action\s*Used/)

  // The DM undoes it: the player's action comes back.
  await dmPage.getByRole('region', { name: 'What happened' }).getByRole('button', { name: 'Undo' }).click()
  await expect(dmPage.getByRole('region', { name: 'What happened' })).toContainText('(undone)')
  await expect(turn).toContainText(/Action\s*Ready/)

  // End turn: the goblin acts, then the player's next turn starts fresh.
  await turn.getByRole('button', { name: 'End turn' }).click()
  await goblinTurn()
  await expect(playerPage.getByText(/Your turn · Round \d/)).toBeVisible({ timeout: 20_000 })
  await expect(turn).toContainText('30 of 30 ft')
})
