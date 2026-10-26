// A thin wrapper round the 3D dice library (@3d-dice/dice-box-threejs), so the rest of the app never
// touches it and it could be swapped for another. The library is chosen because it can make dice
// land on numbers that were already thrown, which is how every screen shows the same throw.
//
// Throws play one after another. The dice stay on the table for a few seconds, then fade away.

import type { DiceColorset } from '@3d-dice/dice-box-threejs'
import type { RolledDie } from '../rules/dice.ts'
import { throwNotation } from './notation.ts'
import { diceColour, numberColour, type DiceMaterial, type DiceStyle } from './style.ts'
import { textureFor } from './textures.ts'

export type TrayThrow = { dice: Pick<RolledDie, 'sides' | 'value'>[]; style: DiceStyle }

export type DiceTray = {
  /** Throws the dice and resolves once they've landed (or straight away if the tray is gone). */
  throw(dice: TrayThrow): Promise<void>
  destroy(): void
}

/** How long the dice stay on the table after landing, how long they take to fade, and the longest a throw may take. */
const SHOWN_MS = 3500
const FADE_MS = 500
const LONGEST_THROW_MS = 9000

// The library's own names for each material, and the texture each one uses (drawn in textures.ts).
const LOOKS: Record<DiceMaterial, { material: string; texture: string }> = {
  plastic: { material: 'none', texture: 'none' },
  glass: { material: 'glass', texture: 'none' },
  metal: { material: 'metal', texture: 'metal' },
  stone: { material: 'wood', texture: 'paper' },
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

let colorsets = 0

/**
 * The library keeps colour sets by name and shares texture settings between them, so every throw
 * gets a fresh name to make sure it's drawn with exactly its own style.
 */
export function colorsetFor(style: DiceStyle): DiceColorset {
  const look = LOOKS[style.material]
  const body = diceColour(style).hex
  colorsets += 1
  return {
    name: `table-dice-${colorsets}`,
    foreground: numberColour(style).hex,
    // Glass lets the light through: the body is partly see-through, the numbers stay solid.
    background: style.material === 'glass' ? withAlpha(body, 0.6) : body,
    edge: style.material === 'glass' ? withAlpha(body, 0.85) : body,
    outline: 'none',
    texture: look.texture,
    material: look.material,
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createDiceTray(container: HTMLElement): Promise<DiceTray> {
  const { default: DiceBox } = await import('@3d-dice/dice-box-threejs')
  if (!container.id) container.id = `dice-tray-${Math.random().toString(36).slice(2)}`

  const box = new DiceBox(`#${container.id}`, {
    sounds: false,
    shadows: true,
    light_intensity: 0.9,
    strength: 1.3,
  })
  box.DiceColors.loadImage = (path) => Promise.resolve(textureFor(path))
  await box.initialize()
  box.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  box.setDimensions({ x: container.clientWidth, y: container.clientHeight })

  let destroyed = false
  let queue: Promise<void> = Promise.resolve()
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  const setState = (state: 'idle' | 'rolling' | 'landed' | 'fading') => {
    container.dataset.state = state
  }
  setState('idle')

  async function play(dice: TrayThrow): Promise<void> {
    if (destroyed || dice.dice.length === 0) return
    clearTimeout(hideTimer)
    setState('rolling')
    await box.updateConfig({ theme_customColorset: colorsetFor(dice.style) })
    await Promise.race([box.roll(throwNotation(dice.dice)), wait(LONGEST_THROW_MS)])
    if (destroyed) return
    setState('landed')
    hideTimer = setTimeout(() => {
      setState('fading')
      hideTimer = setTimeout(() => {
        box.clearDice()
        setState('idle')
      }, FADE_MS)
    }, SHOWN_MS)
  }

  return {
    throw(dice) {
      // Give each throw a moment on the table before the next one sweeps it away.
      const next = queue.then(() => play(dice))
      queue = next.then(() => wait(1200)).catch(() => undefined)
      return next.catch(() => undefined)
    },
    destroy() {
      destroyed = true
      clearTimeout(hideTimer)
      box.clearDice()
      // The library listens for window resizes for good; make that a no-op from now on.
      box.setDimensions = () => undefined
      box.renderer.dispose()
      box.renderer.forceContextLoss()
      box.renderer.domElement.remove()
    },
  }
}
