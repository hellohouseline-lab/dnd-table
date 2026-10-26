/// <reference lib="dom" />
// A real voice and camera call between two browsers, through VDO.Ninja, on the design previews
// (#/dev/call/...). Chrome's built-in test camera and tone stand in for webcams. It needs the
// internet, so it isn't part of the deploy. Run it with: npm run test:call

import { expect, test, type Frame, type Page } from '@playwright/test'

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
})

/** A VDO.Ninja frame on the page whose address contains `part`, such as 'view=dndpreviewdm'. */
async function vdoFrame(page: Page, part: string): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => f.url().includes(part)), { timeout: 30_000 }).toBe(true)
  return page.frames().find((f) => f.url().includes(part)) as Frame
}

type Picture = { width: number; audio: boolean[]; volume: number }

/** What a VDO.Ninja frame is showing: the video's width, whether each sound track is on, and its volume. */
const pictureIn = (frame: Frame) =>
  frame.evaluate((): Picture[] =>
    [...document.querySelectorAll('video')].map((v) => ({
      width: v.videoWidth,
      audio: v.srcObject instanceof MediaStream ? v.srcObject.getAudioTracks().map((t) => t.enabled) : [],
      volume: v.volume,
    })),
  )

test('the DM and a player see and hear each other, mute, and turn a voice down', async ({ browser }) => {
  test.setTimeout(150_000)
  const run = Math.random().toString(36).slice(2, 10)
  const open = async (who: string) => {
    const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
    const page = await context.newPage()
    await page.goto(`#/dev/call/${who}/${run}`)
    await page.getByRole('button', { name: 'Join voice and camera' }).first().click()
    return page
  }
  const dm = await open('dm')
  const player = await open('p1')

  // Each sees themselves straight away, from their own computer.
  for (const page of [dm, player]) {
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0)), {
        timeout: 20_000,
      })
      .toBe(true)
  }

  // Each sees and hears the other through VDO.Ninja.
  const dmSeesSam = await vdoFrame(dm, 'view=dndpreviewp1')
  const samSeesDm = await vdoFrame(player, 'view=dndpreviewdm')
  for (const frame of [dmSeesSam, samSeesDm]) {
    await expect
      .poll(async () => (await pictureIn(frame)).some((p) => p.width > 0 && p.audio.length > 0), { timeout: 60_000 })
      .toBe(true)
  }
  await expect(player.locator('iframe[src*="view=dndpreviewdm"]')).toHaveCSS('opacity', '1')
  await expect(dm.locator('iframe[src*="view=dndpreviewp1"]')).toHaveCSS('opacity', '1')

  // M mutes the DM: the plate says so and the microphone stops sending.
  await dm.locator('body').press('m')
  await expect(dm.getByLabel('Muted').first()).toBeVisible()
  const dmSender = await vdoFrame(dm, 'push=dndpreviewdm')
  await expect.poll(async () => (await pictureIn(dmSender)).flatMap((p) => p.audio)).toEqual([false])

  // Sam turns the DM's voice down on Sam's screen only.
  await player.getByLabel('Matt’s voice, on your screen').fill('0.3')
  await expect.poll(async () => (await pictureIn(samSeesDm)).map((p) => p.volume)).toEqual([0.3])

  // The DM turns the camera off; the tile shows the camera is off.
  await dm.getByRole('button', { name: 'Turn your camera off' }).click({ force: true })
  await expect(dm.getByText('Camera off').first()).toBeVisible()
  await expect(dm.getByRole('button', { name: 'Turn your camera on' })).toBeAttached()

  await dm.context().close()
  await player.context().close()
})

test('with two screens open, one sends and plays the call, and the other takes over when it closes', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const run = Math.random().toString(36).slice(2, 10)
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const first = await context.newPage()
  await first.goto(`#/dev/call/dm/${run}`)
  await first.getByRole('button', { name: 'Join voice and camera' }).first().click()
  await vdoFrame(first, 'push=dndpreviewdm')

  // The second screen knows you're in the call and shows Sam's camera, but sends nothing and plays no voices.
  const second = await context.newPage()
  await second.goto(`#/dev/call/dm/${run}`)
  await expect(second.getByRole('button', { name: 'Leave the call' })).toBeAttached()
  expect((await vdoFrame(second, 'view=dndpreviewp1')).url()).toContain('noaudio')
  expect(second.frames().some((f) => f.url().includes('push='))).toBe(false)

  // Close the first: the second sends instead and plays the voices. (A real browser first asks for a
  // click, "Click anywhere to hear everyone"; browsers started by Playwright count one from the start.)
  await first.close()
  await vdoFrame(second, 'push=dndpreviewdm')
  await expect
    .poll(() => second.frames().some((f) => f.url().includes('view=dndpreviewp1') && !f.url().includes('noaudio')))
    .toBe(true)
  await context.close()
})
