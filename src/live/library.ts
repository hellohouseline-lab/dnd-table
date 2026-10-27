// The DM's library of art and sound. Art is shrunk in the browser (and given a thumbnail) before
// upload; sound files go up as they are. Only the DM can add, change or remove anything; players
// see the sounds (to play them) and only the picture that's on stage.

import type { Tables, TablesInsert, TablesUpdate } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { forgetFile } from './files.ts'
import { fitImage } from './images.ts'
import { supabase } from './supabase.ts'
import { matchName } from '../rules/campaignFile.ts'

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

/**
 * Pictures that come with the table (drawn for it, free to use): battle maps at 70 pixels a square,
 * and a simple example for each other kind, to try the stage with before buying art.
 */
export const STARTER_ART = [
  {
    file: 'maps/tavern.svg',
    category: 'maps',
    name: 'Tavern',
    hint: 'A bar, a fireplace, a back kitchen and a cellar trapdoor',
  },
  {
    file: 'maps/forest-road.svg',
    category: 'maps',
    name: 'Forest road',
    hint: 'A road through the trees, a stream with a bridge, a camp',
  },
  {
    file: 'maps/old-crypt.svg',
    category: 'maps',
    name: 'Old crypt',
    hint: 'Sarcophagi, an altar, a pit trap and a collapsed room',
  },
  // Painted by Matt for Death Pit of Moloch (Higgsfield, 27 October 2026), at 70 pixels a square.
  {
    file: 'maps/meadheaven-tavern.webp',
    category: 'maps',
    name: 'Meadheaven tavern',
    hint: "20 x 11 squares: a long bar, hearth, bard's corner, kitchen and stairs",
  },
  {
    file: 'maps/sheriffs-office-jail.webp',
    category: 'maps',
    name: "Sheriff's office and jail",
    hint: '18 x 10 squares: a front office, a locked gear chest and three cells',
  },
  {
    file: 'maps/meadheaven-square.webp',
    category: 'maps',
    name: 'Town square',
    hint: '32 x 18 squares: market stalls, a well, alleys and the road out of town',
  },
  {
    file: 'maps/hillside-sinkhole.webp',
    category: 'maps',
    name: 'Hillside sinkhole',
    hint: '20 x 11 squares: a hill road, an abandoned cart and a collapsing sinkhole',
  },
  {
    file: 'maps/sink-cavern.webp',
    category: 'maps',
    name: 'Sink cavern',
    hint: '14 x 8 squares: rubble under a sinkhole, an upturned wagon and a door',
  },
  {
    file: 'maps/guard-room-goblin-den.webp',
    category: 'maps',
    name: "Guard room and goblins' den",
    hint: '18 x 10 squares: a guard room with a chest, and a cave with a mud pit',
  },
  {
    file: 'maps/ritual-hall.webp',
    category: 'maps',
    name: 'Ritual hall',
    hint: '18 x 10 squares: a demon statue, two levers, an altar, six alcoves and a trapped exit',
  },
  {
    file: 'art/market-city.svg',
    category: 'places',
    name: 'Market city',
    hint: 'A city street on market day, a castle on the hill',
  },
  {
    file: 'art/campfire-night.svg',
    category: 'moments',
    name: 'Campfire at night',
    hint: 'The party round a fire under the moon',
  },
  {
    file: 'art/innkeeper.svg',
    category: 'people',
    name: 'The innkeeper',
    hint: 'A cheerful innkeeper raising a tankard',
  },
  // Painted for the table by Matt (Higgsfield, 27 October 2026).
  {
    file: 'art/scenes/crossroads.jpg',
    category: 'places',
    name: 'Crossroads',
    hint: 'A signpost on a country road, a castle on the hill',
  },
  {
    file: 'art/scenes/ancient-forest.jpg',
    category: 'places',
    name: 'Ancient forest',
    hint: 'Giant mossy trees, glowing mushrooms, a ruined arch',
  },
  {
    file: 'art/scenes/mountain-pass.jpg',
    category: 'places',
    name: 'Mountain pass',
    hint: 'A snowy trail at dusk, a lonely waystation',
  },
  {
    file: 'art/scenes/harbour-dawn.jpg',
    category: 'places',
    name: 'Harbour at dawn',
    hint: 'Docks, tall ships and a lighthouse',
  },
  {
    file: 'art/scenes/temple.jpg',
    category: 'places',
    name: 'Temple',
    hint: 'Candlelight, stained glass and a golden sun',
  },
  {
    file: 'art/scenes/general-store.jpg',
    category: 'places',
    name: 'General store',
    hint: 'Potions, ropes, lanterns and maps for sale',
  },
  {
    file: 'art/scenes/dungeon-corridor.jpg',
    category: 'places',
    name: 'Dungeon corridor',
    hint: 'Torchlit stone, cobwebs, a heavy door',
  },
  {
    file: 'art/scenes/campfire-stars.jpg',
    category: 'moments',
    name: 'Camp under the stars',
    hint: 'Tents round a fire, the Milky Way above',
  },
  {
    file: 'art/scenes/open-road.jpg',
    category: 'moments',
    name: 'The open road',
    hint: 'A long track over the moors, a journey ahead',
  },
  {
    file: 'art/scenes/forest-road-dusk.jpg',
    category: 'moments',
    name: 'Forest road at dusk',
    hint: 'Old trees arching over the track, last light',
  },
  {
    file: 'art/scenes/dawn-breaks.jpg',
    category: 'moments',
    name: 'Dawn breaks',
    hint: 'Sunrise over a misty river valley',
  },
  {
    file: 'art/scenes/storm-rolls-in.jpg',
    category: 'moments',
    name: 'Storm rolls in',
    hint: 'Thunderclouds and lightning over the hills',
  },
  {
    file: 'art/scenes/moonlit-road.jpg',
    category: 'moments',
    name: 'Moonlit road',
    hint: 'A quiet road under a full moon',
  },
  {
    file: 'art/scenes/river-ford.jpg',
    category: 'moments',
    name: 'River crossing',
    hint: 'Stepping stones beside a broken bridge',
  },
  {
    file: 'art/scenes/winter-road.jpg',
    category: 'moments',
    name: 'Winter road',
    hint: 'Snow falling on a pine forest track',
  },
  {
    file: 'art/scenes/fog-on-the-moor.jpg',
    category: 'moments',
    name: 'Fog on the moor',
    hint: 'A path into the mist, strange lights far off',
  },
  {
    file: 'art/scenes/at-sea.jpg',
    category: 'moments',
    name: 'At sea',
    hint: 'On deck, sails full, cliffs on the horizon',
  },
  {
    file: 'art/scenes/fireside-rest.jpg',
    category: 'moments',
    name: 'Rest by the fire',
    hint: 'A warm inn hearth after a long road',
  },
  {
    file: 'art/people/sheriff.jpg',
    category: 'people',
    name: 'The sheriff',
    hint: 'Broad, grey at the temples, a brass star on his coat',
  },
  {
    file: 'art/people/herb-merchant.jpg',
    category: 'people',
    name: 'The herb merchant',
    hint: 'Gaunt and tired, dried herbs in his collar',
  },
  {
    file: 'art/people/cult-leader.jpg',
    category: 'people',
    name: 'The cult leader',
    hint: 'A gleeful old villain with a glowing green skull',
  },
  {
    file: 'art/people/cultist.jpg',
    category: 'people',
    name: 'A cultist',
    hint: 'A hooded fanatic with a curved blade',
  },
  { file: 'art/people/goblin.jpg', category: 'people', name: 'A goblin', hint: 'Sly, grinning, in patched leather' },
  {
    file: 'art/people/zombie.jpg',
    category: 'people',
    name: 'A zombie',
    hint: 'A freshly risen traveller, arms reaching',
  },
  {
    file: 'art/people/halfling-merchant.jpg',
    category: 'people',
    name: 'The travelling merchant',
    hint: 'A cheerful halfling with a pack full of wares',
  },
  {
    file: 'art/people/fighter-and-squire.jpg',
    category: 'people',
    name: 'The fighter and her squire',
    hint: 'A half-orc fighter and her excitable gnome squire',
  },
  { file: 'art/people/monk.jpg', category: 'people', name: 'The monk', hint: 'Calm, shaved head, ready to strike' },
  {
    file: 'art/people/dwarf-blacksmith.jpg',
    category: 'people',
    name: 'The dwarf blacksmith',
    hint: 'Sooty arms, a hammer on her shoulder',
  },
  {
    file: 'art/people/tiefling-bard.jpg',
    category: 'people',
    name: 'The tiefling bard',
    hint: 'Lute, feathered hat and a wink',
  },
  {
    file: 'art/people/dragonborn-captain.jpg',
    category: 'people',
    name: 'The guard captain',
    hint: 'A stern dragonborn with a halberd',
  },
  {
    file: 'art/people/elf-ranger.jpg',
    category: 'people',
    name: 'The elf ranger',
    hint: 'Longbow, green cloak, a hawk on his shoulder',
  },
  {
    file: 'art/people/old-priest.jpg',
    category: 'people',
    name: 'The old priest',
    hint: 'Kindly, white-bearded, a glowing holy symbol',
  },
  {
    file: 'art/people/halfling-innkeeper.jpg',
    category: 'people',
    name: 'The halfling innkeeper',
    hint: 'Polishing a tankard behind the bar',
  },
  {
    file: 'art/people/gnome-wizard.jpg',
    category: 'people',
    name: 'The gnome wizard',
    hint: 'Wild hair, huge spectacles, a spell in hand',
  },
  {
    file: 'art/people/orc-bounty-hunter.jpg',
    category: 'people',
    name: 'The bounty hunter',
    hint: 'A grizzled orc with a crossbow and wanted posters',
  },
  {
    file: 'art/people/aasimar-paladin.jpg',
    category: 'people',
    name: 'The paladin',
    hint: 'Silver armour, a sun shield and a faint halo',
  },
  { file: 'art/people/thug.jpg', category: 'people', name: 'A thug', hint: 'A tavern bruiser with a cudgel' },
  {
    file: 'art/people/town-guard.jpg',
    category: 'people',
    name: 'A town guard',
    hint: 'Tired and stern, spear and lantern',
  },
  {
    file: 'art/people/bandit.jpg',
    category: 'people',
    name: 'A bandit',
    hint: 'A hooded roadside robber with two blades',
  },
  {
    file: 'art/people/skeleton.jpg',
    category: 'people',
    name: 'A skeleton',
    hint: 'Rusty sword, cracked shield, blue-lit eyes',
  },
  {
    file: 'art/people/giant-rat.jpg',
    category: 'people',
    name: 'A giant rat',
    hint: 'As big as a dog, red eyes in the sewer',
  },
  { file: 'art/people/wolf.jpg', category: 'people', name: 'A wolf', hint: 'Snarling in a moonlit snowy forest' },
  {
    file: 'art/people/ghoul.jpg',
    category: 'people',
    name: 'A ghoul',
    hint: 'Hunched and hungry in a misty graveyard',
  },
  { file: 'art/people/ogre.jpg', category: 'people', name: 'An ogre', hint: 'Huge, dim and holding a tree-trunk club' },
] as const satisfies readonly { file: string; category: ArtCategory; name: string; hint: string }[]

export type StarterArt = (typeof STARTER_ART)[number]

/**
 * Pictures painted for one campaign (Matt's Death Pit of Moloch, Higgsfield, 27 October 2026). They
 * aren't offered with the pictures that come with the table: a campaign that names one ("Picture:
 * Sink cavern") brings it into the library as it's added.
 */
export const CAMPAIGN_ART = [
  { file: 'art/campaign/key-art.jpg', category: 'moments', name: 'Death Pit of Moloch key art' },
  { file: 'art/campaign/meadheaven-town.jpg', category: 'places', name: 'Meadheaven town' },
  { file: 'art/campaign/tavern-interior.jpg', category: 'places', name: 'Tavern interior' },
  { file: 'art/campaign/tavern-brawl.jpg', category: 'moments', name: 'Tavern brawl' },
  { file: 'art/campaign/jail-cell.jpg', category: 'places', name: 'Jail cell' },
  { file: 'art/campaign/sink-cavern.jpg', category: 'places', name: 'Sink cavern' },
  { file: 'art/campaign/cultist-guard-room.jpg', category: 'places', name: 'Cultist guard room' },
  { file: 'art/campaign/goblins-den.jpg', category: 'places', name: "Goblins' den" },
  { file: 'art/campaign/ritual-hall.jpg', category: 'places', name: 'Ritual hall' },
  { file: 'art/campaign/daylight-exit.jpg', category: 'moments', name: 'Daylight exit' },
  { file: 'art/campaign/empty-cavern.jpg', category: 'moments', name: 'Empty cavern' },
] as const satisfies readonly { file: string; category: ArtCategory; name: string }[]

export type CampaignArt = (typeof CAMPAIGN_ART)[number]
export type StarterMap = Extract<StarterArt, { category: 'maps' }>

export const STARTER_MAPS = STARTER_ART.filter((s): s is StarterMap => s.category === 'maps')

/** Where a starter picture's drawing is served from. */
export function starterMapUrl(starter: { file: string }): string {
  return `${import.meta.env.BASE_URL}${starter.file}`
}

/**
 * Adds a starter picture to this table's library, like any upload: a drawing is turned into a
 * picture in the browser first. A map's squares are 70 pixels, the grid's default, so they line up.
 */
export async function addStarterMap(
  campaignId: string,
  starter: { file: string; category: ArtCategory; name: string },
): Promise<Asset> {
  // A painted picture goes up as it is.
  if (!starter.file.endsWith('.svg')) {
    const response = await fetch(starterMapUrl(starter))
    if (!response.ok) throw new TableError(`“${starter.name}” couldn't be loaded. Check your connection.`)
    const blob = await response.blob()
    const extension = starter.file.split('.').pop() ?? 'jpg'
    return uploadArt(
      campaignId,
      new File([blob], `${starter.name}.${extension}`, { type: blob.type }),
      starter.category,
    )
  }
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
  return uploadArt(campaignId, new File([blob], `${starter.name}.png`, { type: 'image/png' }), starter.category)
}

/**
 * Ready-made portraits that come with the table (painted by Matt, Higgsfield, 27 October 2026), served
 * from this site: square, the face in the middle, so they fill a round miniature. A monster from the
 * free rules in `monsters` shows its portrait on its miniature; any of them can be an NPC's portrait.
 */
export const PRESET_PORTRAITS = [
  { key: 'goblin', name: 'Goblin', monsters: ['goblin'] },
  { key: 'zombie', name: 'Zombie', monsters: ['zombie'] },
  { key: 'skeleton', name: 'Skeleton', monsters: ['skeleton'] },
  { key: 'giant-rat', name: 'Giant rat', monsters: ['giant-rat'] },
  { key: 'wolf', name: 'Wolf', monsters: ['wolf'] },
  { key: 'ghoul', name: 'Ghoul', monsters: ['ghoul'] },
  { key: 'ogre', name: 'Ogre', monsters: ['ogre'] },
  { key: 'cultist', name: 'Cultist', monsters: ['cultist'] },
  { key: 'cult-leader', name: 'Cult leader', monsters: ['cult-fanatic'] },
  { key: 'thug', name: 'Thug', monsters: ['thug'] },
  { key: 'bandit', name: 'Bandit', monsters: ['bandit'] },
  { key: 'town-guard', name: 'Town guard', monsters: ['guard'] },
  { key: 'sheriff', name: 'Town sheriff', monsters: [] },
  { key: 'herb-merchant', name: 'Herb merchant', monsters: [] },
  { key: 'halfling-merchant', name: 'Travelling merchant', monsters: [] },
  { key: 'halfling-innkeeper', name: 'Halfling innkeeper', monsters: [] },
  { key: 'dwarf-blacksmith', name: 'Dwarf blacksmith', monsters: [] },
  { key: 'old-priest', name: 'Old priest', monsters: [] },
  { key: 'dragonborn-captain', name: 'Guard captain', monsters: [] },
  { key: 'orc-bounty-hunter', name: 'Orc bounty hunter', monsters: [] },
  { key: 'tiefling-bard', name: 'Tiefling bard', monsters: [] },
  { key: 'elf-ranger', name: 'Elf ranger', monsters: [] },
  { key: 'monk', name: 'Monk', monsters: [] },
  { key: 'gnome-wizard', name: 'Gnome wizard', monsters: [] },
  { key: 'gnome-squire', name: 'Gnome squire', monsters: [] },
  { key: 'half-orc-fighter', name: 'Half-orc fighter', monsters: [] },
  { key: 'aasimar-paladin', name: 'Aasimar paladin', monsters: [] },
] as const satisfies readonly { key: string; name: string; monsters: readonly string[] }[]

export type PresetPortrait = (typeof PRESET_PORTRAITS)[number]

export function presetPortraitUrl(key: string): string {
  return `${import.meta.env.BASE_URL}art/tokens/${key}.jpg`
}

/** The ready-made portrait for a monster from the free rules, if there is one. */
export function portraitForMonster(monsterIndex: string): PresetPortrait | undefined {
  return PRESET_PORTRAITS.find((p) => (p.monsters as readonly string[]).includes(monsterIndex))
}

/** A ready-made portrait put in this table's library under People (for an NPC), once. */
export function addPresetPortrait(campaignId: string, preset: PresetPortrait): Promise<Asset> {
  return addStarterMap(campaignId, { file: `art/tokens/${preset.key}.jpg`, category: 'people', name: preset.name })
}

/**
 * The maps, ready-made portraits and campaign pictures that come with the table which a campaign
 * names (a scene's fight map or picture, "Map: Ritual hall" in its notes, a person's portrait) and
 * this library doesn't have yet, so adding the campaign can bring them in first.
 */
export function artForCampaign(
  names: { maps: string[]; portraits: string[]; pictures: string[] },
  library: Asset[],
): { maps: StarterMap[]; portraits: PresetPortrait[]; pictures: CampaignArt[] } {
  const has = (category: ArtCategory, name: string) => library.some((a) => a.category === category && a.name === name)
  const pick = <T extends { name: string }>(things: readonly T[], wanted: string[]) =>
    things.filter((t) => wanted.some((w) => matchName([t], (x) => x.name, w)))
  return {
    maps: pick(STARTER_MAPS, names.maps).filter((m) => !has('maps', m.name)),
    portraits: pick(PRESET_PORTRAITS, names.portraits).filter((p) => !has('people', p.name)),
    pictures: pick(CAMPAIGN_ART, names.pictures).filter((p) => !has(p.category, p.name)),
  }
}
