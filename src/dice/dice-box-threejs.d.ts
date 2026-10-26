// Types for the parts of @3d-dice/dice-box-threejs 0.0.12 that diceTray.ts uses. The package ships
// no types of its own.

declare module '@3d-dice/dice-box-threejs' {
  export type DiceColorset = {
    name: string
    foreground: string
    background: string
    outline: string
    edge?: string
    /** A name from the library's texture list, or 'none'. */
    texture: string
    /** 'none' (plastic), 'glass', 'metal', 'perfectmetal' or 'wood'. */
    material: string
  }

  export type DiceBoxConfig = {
    assetPath?: string
    sounds?: boolean
    shadows?: boolean
    theme_customColorset?: DiceColorset | null
    theme_material?: string
    light_intensity?: number
    gravity_multiplier?: number
    baseScale?: number
    strength?: number
    iterationLimit?: number
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig)
    initialize(): Promise<void>
    updateConfig(config: DiceBoxConfig): Promise<void>
    /** Resolves when the dice stop. 'n' dice can be made to land on given faces with '@'. */
    roll(notation: string): Promise<unknown>
    clearDice(): void
    setDimensions(dimensions?: { x: number; y: number }): void
    renderer: {
      domElement: HTMLCanvasElement
      setPixelRatio(ratio: number): void
      dispose(): void
      forceContextLoss(): void
    }
    DiceColors: {
      loadImage(path: string): Promise<CanvasImageSource | undefined>
    }
  }
}
