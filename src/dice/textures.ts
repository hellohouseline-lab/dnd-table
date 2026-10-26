// The textures for metal and stone dice, drawn here in code rather than shipped as image files, so
// everything on the dice is our own work. The 3D library asks for its textures by file name; the
// tray hands it these canvases instead.

type Painter = (context: CanvasRenderingContext2D, size: number) => void

const SIZE = 256
const made = new Map<string, HTMLCanvasElement>()

/** Brushed metal: fine horizontal streaks, light enough that the dice colour shows through. */
const brushed: Painter = (context, size) => {
  context.fillStyle = '#ececec'
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    const shade = 150 + Math.floor(Math.random() * 105)
    context.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.08 + Math.random() * 0.22})`
    context.lineWidth = 0.5 + Math.random()
    const y = Math.random() * size
    const x = Math.random() * size * 0.6
    context.beginPath()
    context.moveTo(x - size * 0.3, y)
    context.lineTo(x + size * (0.3 + Math.random() * 0.6), y + (Math.random() - 0.5) * 2)
    context.stroke()
  }
}

/** Stone: soft cloudy patches with dark and light speckles. */
const speckled: Painter = (context, size) => {
  context.fillStyle = '#d9d6d2'
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 160; i++) {
    const shade = 120 + Math.floor(Math.random() * 120)
    context.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 8}, 0.18)`
    context.beginPath()
    context.arc(Math.random() * size, Math.random() * size, 6 + Math.random() * 26, 0, Math.PI * 2)
    context.fill()
  }
  for (let i = 0; i < 2600; i++) {
    const dark = Math.random() < 0.7
    const shade = dark ? 40 + Math.floor(Math.random() * 70) : 235 + Math.floor(Math.random() * 20)
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${dark ? 0.55 : 0.8})`
    const r = Math.random() < 0.9 ? 0.6 + Math.random() * 0.8 : 1.5 + Math.random() * 1.5
    context.fillRect(Math.random() * size, Math.random() * size, r, r)
  }
}

// The library's file names, mapped to what we draw. 'metal' and 'paper' are the texture names the
// tray asks for (see diceTray.ts); their bump maps give the surface a little depth.
const PAINTERS: Record<string, Painter> = {
  'textures/metal.webp': brushed,
  'textures/metal-bump.webp': brushed,
  'textures/paper.webp': speckled,
  'textures/paper-bump.webp': speckled,
}

export function textureFor(path: string): HTMLCanvasElement | undefined {
  const name = Object.keys(PAINTERS).find((key) => path.endsWith(key))
  if (!name) return undefined
  let canvas = made.get(name)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const context = canvas.getContext('2d')
    if (context) PAINTERS[name](context, SIZE)
    made.set(name, canvas)
  }
  return canvas
}
