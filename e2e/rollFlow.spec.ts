// The roll flow end to end, in two browsers: the DM asks for a Constitution save, the player rolls
// it, and both see the same result. Then the DM changes the result and closes the request.
//
// It runs against the real Supabase project with two test logins (see scripts/e2e.mjs), makes a
// throwaway campaign for the run and deletes it afterwards.

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

/** A browser already signed in: the session goes where the Supabase client looks for it. */
async function signedInPage(browser: Browser, session: Session): Promise<Page> {
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  const context = await browser.newContext()
  await context.addInitScript({
    content: `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify(session))})`,
  })
  return context.newPage()
}

test.skip(!ready, 'Needs the two test logins: run it with npm run test:e2e')

let dm: Session
let campaignId = ''

test.afterAll(async () => {
  if (dm && campaignId) await api(dm, `campaigns?id=eq.${campaignId}`, { method: 'DELETE' })
})

test('the DM asks for a save, the player rolls it, and both see the same result', async ({ browser }) => {
  // A throwaway table: the DM starts it, the player joins and makes a character.
  dm = await signIn(dmLogin)
  const player = await signIn(playerLogin)
  campaignId = await api<string>(dm, 'rpc/create_campaign', {
    body: { p_name: 'Roll flow test', p_dm_name: 'Test DM' },
  })
  const [{ join_code }] = await api<{ join_code: string }[]>(dm, `campaigns?id=eq.${campaignId}&select=join_code`, {
    method: 'GET',
  })
  await api(player, 'rpc/join_campaign', { body: { p_code: join_code, p_display_name: 'Test player' } })
  await api(player, 'characters', {
    body: {
      campaign_id: campaignId,
      owner_id: player.user.id,
      name: 'Test Fighter',
      constitution: 14,
      save_proficiencies: ['constitution'],
      max_hp: 12,
      current_hp: 12,
    },
  })

  const dmPage = await signedInPage(browser, dm)
  const playerPage = await signedInPage(browser, player)
  await dmPage.goto(`#/c/${campaignId}/dm`)
  await playerPage.goto(`#/c/${campaignId}/play`)
  await expect(playerPage.getByText('Test Fighter').first()).toBeVisible()

  // The DM asks everyone for a Constitution save against a secret DC 15.
  await dmPage.getByRole('button', { name: 'Ask for a roll' }).click()
  await dmPage.getByRole('button', { name: /Constitution save/ }).click()
  await expect(dmPage.getByText('Everyone makes a Constitution saving throw. 15 or more passes.')).toBeVisible()
  await dmPage.getByRole('button', { name: 'Send to players' }).click()

  // The player gets the prompt with their bonus (+2 Constitution, +2 proficiency) and rolls.
  const prompt = playerPage.getByRole('dialog', { name: 'Constitution saving throw' })
  await expect(prompt).toContainText('Your bonus +4')
  await expect(prompt).toContainText('Target kept secret')
  await prompt.getByRole('button', { name: 'Roll the d20' }).click()

  // Once the dice land, the player sees their total, and waits for the DM's ruling...
  const result = playerPage.getByRole('status').filter({ hasText: 'Everyone at the table sees your result' })
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result).toContainText('Waiting for the DM')
  const sum = (await result.textContent()) ?? ''
  const total = Number(/= (\d+)/.exec(sum)?.[1])
  const passed = total >= 15
  expect(sum).not.toContain('DC 15')

  // ...the DM sees the same total and what the dice say, and rules against the dice...
  const results = dmPage.getByRole('region', { name: 'Constitution saving throw' })
  await expect(results).toContainText(`= ${total}`)
  await expect(results).toContainText(`dice say ${passed ? 'pass' : 'fail'}`)
  await expect(results).toContainText('everyone has rolled')
  await results.getByRole('button', { name: passed ? 'Fail' : 'Pass', exact: true }).click()
  await expect(results).toContainText(passed ? 'Failed by you' : 'Passed by you')

  // ...and only now does the player see it.
  await expect(result).toContainText(passed ? 'The DM turned it into a fail.' : 'The DM turned it into a pass.')

  // Done, play on: the request closes and the player's card goes away.
  await results.getByRole('button', { name: 'Done, play on' }).click()
  await expect(result).toBeHidden()
  await expect(dmPage.getByRole('region', { name: 'Constitution saving throw' })).toBeHidden()
})
