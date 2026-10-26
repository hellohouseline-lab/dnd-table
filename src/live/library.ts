// The DM's library of art and sound. Art is shrunk in the browser (and given a thumbnail) before
// upload; sound files go up as they are. Only the DM can add, change or remove anything; players
// see the sounds (to play them) and only the picture that's on stage.

import type { Tables, TablesInsert, TablesUpdate } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { forgetFile } from './files.ts'
import { fitImage } from './images.ts'
import { supabase } from './supabase.ts'

export type AssetKind = 'art' | 'music' | 'ambience' | 'effect'
export type ArtCategory = 'places' | 'moments' | 'people' | 'maps'
export type Mood = 'tavern' | 'travel' | 'tension' | 'combat' | 'boss' | 'camp'

export const ART_CATEGORIES: { key: ArtCategory; name: string; hint: string }[] = [
  { key: 'places', name: 'Places', hint: 'Taverns, roads, ruins, cities' },
  { key: 'moments', name: 'Moments', hint: 'Night camp, campfire, dawn breaks, storm rolls in' },
  { key: 'people', name: 'People', hint: 'Innkeepers, villains, strangers' },
  { key: 'maps', name: 'Maps', hint: 'World and battle maps (battles arrive in milestone 6)' },
]

export const MOODS: { key: Mood; name: string }[] = [
  { key: 'tavern', name: 'Tavern' },
  { key: 'travel', name: 'Travel' },
  { key: 'tension', name: 'Tension' },
  { key: 'combat', name: 'Combat' },
  { key: 'boss', name: 'Boss' },
  { key: 'camp', name: 'Camp' },
]

export type Asset = {
  id: string
  campaignId: string
  kind: AssetKind
  category: ArtCategory | null
  mood: Mood | null
  name: string
  path: string
  thumbPath: string | null
  sizeBytes: number
  streamSafe: boolean
  credit: string
  hotkey: number | null
  createdAt: string
  /** For battle maps: the size of one 5-foot square in the picture's pixels, and where the grid starts. */
  grid: { size: number; offsetX: number; offsetY: number }
}

type AssetRow = Tables<'assets'>

export const MAX_ART_BYTES = 8 * 1024 * 1024
export const MAX_SOUND_BYTES = 15 * 1024 * 1024
const STAGE_PIXELS = 2560
const THUMB_PIXELS = 480

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

export function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: (['art', 'music', 'ambience', 'effect'] as const).find((k) => k === row.kind) ?? 'art',
    category: ART_CATEGORIES.find((c) => c.key === row.category)?.key ?? null,
    mood: MOODS.find((m) => m.key === row.mood)?.key ?? null,
    name: row.name,
    path: row.path,
    thumbPath: row.thumb_path,
    sizeBytes: row.size_bytes,
    streamSafe: row.stream_safe,
    credit: row.credit,
    hotkey: row.hotkey,
    createdAt: row.created_at,
    grid: { size: row.grid_size, offsetX: row.grid_offset_x, offsetY: row.grid_offset_y },
  }
}

/** Everything in the library you're allowed to see, oldest first. */
export async function listAssets(campaignId: string): Promise<Asset[]> {
  const { data, error } = await db().from('assets').select('*').eq('campaign_id', campaignId).order('created_at')
  if (error) throw fromDatabaseError(error)
  return data.map(rowToAsset)
}

/** One asset, such as the picture on stage. Null if you may not see it. */
export async function getAsset(id: string): Promise<Asset | null> {
  const { data, error } = await db().from('assets').select('*').eq('id', id).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToAsset(data) : null
}

/** A file's name without its extension, tidied: "tavern_night-02.webp" gives "Tavern night 02". */
export function nameFromFile(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 80) || 'Untitled'
}

/** "12.4 MB", "640 KB". */
export function sizeText(bytes: number): string {
  if (bytes <= 0) return 'nothing yet'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function upload(bucket: 'art' | 'audio', path: string, file: Blob, contentType: string) {
  const { error } = await db().storage.from(bucket).upload(path, file, { contentType, cacheControl: '31536000' })
  if (error) throw new TableError(`“${path.split('/').pop()}” couldn't be uploaded. Check its size and try again.`)
}

/** Adds a picture: shrunk to 2560 pixels on its longer side, with a small thumbnail for the library. */
export async function uploadArt(campaignId: string, file: File, category: ArtCategory): Promise<Asset> {
  if (file.size > 4 * MAX_ART_BYTES)
    throw new TableError(`“${file.name}” is too big. Pictures can be up to 32 MB before shrinking.`)
  const [stageImage, thumb] = await Promise.all([fitImage(file, STAGE_PIXELS), fitImage(file, THUMB_PIXELS)])
  if (stageImage.size > MAX_ART_BYTES) throw new TableError(`“${file.name}” is still over 8 MB after shrinking.`)
  const id = crypto.randomUUID()
  const extension = stageImage.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${campaignId}/${id}.${extension}`
  const thumbPath = `${campaignId}/${id}-thumb.${extension}`
  await upload('art', path, stageImage, stageImage.type)
  await upload('art', thumbPath, thumb, thumb.type)
  return insert({
    id,
    campaign_id: campaignId,
    kind: 'art',
    category,
    name: nameFromFile(file.name),
    path,
    thumb_path: thumbPath,
    size_bytes: stageImage.size + thumb.size,
  })
}

export type SoundDetails = {
  kind: Exclude<AssetKind, 'art'>
  mood?: Mood
  hotkey?: number | null
  streamSafe: boolean
  credit: string
}

/** The sound formats every browser plays. */
export function soundType(file: File): 'audio/mpeg' | 'audio/ogg' | null {
  if (/\.mp3$/i.test(file.name) || file.type === 'audio/mpeg' || file.type === 'audio/mp3') return 'audio/mpeg'
  if (/\.(ogg|oga)$/i.test(file.name) || file.type === 'audio/ogg') return 'audio/ogg'
  return null
}

/** Adds music, an ambience loop or a sound effect, as an MP3 or OGG file up to 15 MB. */
export async function uploadSound(campaignId: string, file: File, details: SoundDetails): Promise<Asset> {
  const type = soundType(file)
  if (!type) throw new TableError(`“${file.name}” isn't an MP3 or OGG file.`)
  if (file.size > MAX_SOUND_BYTES) throw new TableError(`“${file.name}” is over 15 MB. Try a shorter or smaller file.`)
  const id = crypto.randomUUID()
  const path = `${campaignId}/${id}.${type === 'audio/mpeg' ? 'mp3' : 'ogg'}`
  await upload('audio', path, file, type)
  return insert({
    id,
    campaign_id: campaignId,
    kind: details.kind,
    mood: details.kind === 'music' ? (details.mood ?? 'tavern') : null,
    hotkey: details.kind === 'effect' ? (details.hotkey ?? null) : null,
    name: nameFromFile(file.name),
    path,
    size_bytes: file.size,
    stream_safe: details.streamSafe,
    credit: details.credit.trim().slice(0, 200),
  })
}

async function insert(row: TablesInsert<'assets'>): Promise<Asset> {
  const { data, error } = await db().from('assets').insert(row).select('*').single()
  if (error) throw fromDatabaseError(error)
  return rowToAsset(data)
}

export type AssetPatch = Partial<
  Pick<Asset, 'name' | 'category' | 'mood' | 'streamSafe' | 'credit' | 'hotkey' | 'grid'>
>

export async function updateAsset(id: string, patch: AssetPatch): Promise<Asset> {
  const row: TablesUpdate<'assets'> = {}
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 80) || 'Untitled'
  if (patch.category !== undefined) row.category = patch.category
  if (patch.mood !== undefined) row.mood = patch.mood
  if (patch.streamSafe !== undefined) row.stream_safe = patch.streamSafe
  if (patch.credit !== undefined) row.credit = patch.credit.trim().slice(0, 200)
  if (patch.hotkey !== undefined) row.hotkey = patch.hotkey
  if (patch.grid !== undefined) {
    row.grid_size = Math.round(Math.min(400, Math.max(10, patch.grid.size)))
    row.grid_offset_x = Math.round(Math.min(400, Math.max(-400, patch.grid.offsetX)))
    row.grid_offset_y = Math.round(Math.min(400, Math.max(-400, patch.grid.offsetY)))
  }
  const { data, error } = await db().from('assets').update(row).eq('id', id).select('*').single()
  if (error) throw fromDatabaseError(error)
  return rowToAsset(data)
}

/** Removes an asset and its files. If it was on stage or playing, the stage lets go of it. */
export async function deleteAsset(asset: Asset): Promise<void> {
  const { error } = await db().from('assets').delete().eq('id', asset.id)
  if (error) throw fromDatabaseError(error)
  const bucket = asset.kind === 'art' ? 'art' : 'audio'
  const paths = [asset.path, ...(asset.thumbPath ? [asset.thumbPath] : [])]
  await db().storage.from(bucket).remove(paths)
  paths.forEach((path) => forgetFile(bucket, path))
}

/** Battle maps that come with the table (drawn for it, free to use), at 70 pixels a square. */
export const STARTER_MAPS = [
  { file: 'tavern.svg', name: 'Tavern', hint: 'A bar, a fireplace, a back kitchen and a cellar trapdoor' },
  { file: 'forest-road.svg', name: 'Forest road', hint: 'A road through the trees, a stream with a bridge, a camp' },
  { file: 'old-crypt.svg', name: 'Old crypt', hint: 'Sarcophagi, an altar, a pit trap and a collapsed room' },
] as const

export type StarterMap = (typeof STARTER_MAPS)[number]

/** Where a starter map's drawing is served from. */
export function starterMapUrl(starter: StarterMap): string {
  return `${import.meta.env.BASE_URL}maps/${starter.file}`
}

/**
 * Adds a starter map to this table's library, like any uploaded map: the drawing is turned into a
 * picture in the browser first. Its squares are 70 pixels, the grid's default, so they line up.
 */
export async function addStarterMap(campaignId: string, starter: StarterMap): Promise<Asset> {
  const image = new Image()
  image.src = starterMapUrl(starter)
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new TableError("Your browser couldn't prepare the map.")
  context.drawImage(image, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new TableError("Your browser couldn't prepare the map.")
  return uploadArt(campaignId, new File([blob], `${starter.name}.png`, { type: 'image/png' }), 'maps')
}
