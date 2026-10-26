// Pictures are shrunk in the browser before upload: Supabase's own resizing needs the Pro plan,
// and smaller files keep everyone's downloads (5 GB a month on the free plan) down.

import { TableError } from './errors.ts'

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  const webp = await as('image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await as('image/jpeg')
  if (!jpeg) throw new TableError("Your browser couldn't prepare the picture.")
  return jpeg
}

async function bitmapOf(file: Blob): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new TableError('That file isn’t a picture.')
  try {
    return await createImageBitmap(file)
  } catch {
    throw new TableError("That picture couldn't be opened. Try a JPG, PNG or WebP.")
  }
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new TableError("Your browser couldn't prepare the picture.")
  return [canvas, context]
}

/** Crops the middle square of a picture and shrinks it, as WebP where the browser can make it. */
export async function squareImage(file: Blob, size: number): Promise<Blob> {
  const bitmap = await bitmapOf(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const [canvas, context] = canvasOf(size, size)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return encode(canvas)
}

/** Shrinks a picture so its longer side is at most `longest` pixels (never enlarges), keeping its shape. */
export async function fitImage(file: Blob, longest: number): Promise<Blob> {
  const bitmap = await bitmapOf(file)
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height))
  const [canvas, context] = canvasOf(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return encode(canvas)
}
