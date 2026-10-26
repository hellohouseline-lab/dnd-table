// Reading and saving character sheets and portraits. The database decides who may change what:
// a player only their own character, the DM any in their campaign.

import type { Character, CharacterBuild } from '../rules/character.ts'
import { buildToRow, rowToCharacter, trackersToRow, type TrackerPatch } from './characterRows.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { squareImage } from './images.ts'
import { supabase } from './supabase.ts'

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

/** Everyone's characters at this table, oldest first. */
export async function listCharacters(campaignId: string): Promise<Character[]> {
  const { data, error } = await db().from('characters').select('*').eq('campaign_id', campaignId).order('created_at')
  if (error) throw fromDatabaseError(error)
  return data.map(rowToCharacter)
}

export async function getCharacter(characterId: string): Promise<Character | null> {
  const { data, error } = await db().from('characters').select('*').eq('id', characterId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data ? rowToCharacter(data) : null
}

/** Makes a character for a player, starting on full hit points. */
export async function createCharacter(campaignId: string, ownerId: string, build: CharacterBuild): Promise<Character> {
  const { data, error } = await db()
    .from('characters')
    .insert({
      ...buildToRow(build),
      name: build.name.trim(),
      campaign_id: campaignId,
      owner_id: ownerId,
      current_hp: build.maxHp,
    })
    .select('*')
    .single()
  if (error) throw characterError(error)
  return rowToCharacter(data)
}

/** Saves the character form. Current hit points are kept, but never left above a lowered maximum. */
export async function saveCharacterBuild(character: Character, build: CharacterBuild): Promise<Character> {
  const { data, error } = await db()
    .from('characters')
    .update({
      ...buildToRow(build),
      current_hp: Math.min(character.currentHp, build.maxHp),
      hit_dice_used: Math.min(character.hitDiceUsed, build.level),
    })
    .eq('id', character.id)
    .select('*')
    .single()
  if (error) throw characterError(error)
  return rowToCharacter(data)
}

/** Saves things that change in play: hit points, uses, slots, conditions and so on. */
export async function saveTrackers(characterId: string, patch: TrackerPatch): Promise<Character> {
  const { data, error } = await db()
    .from('characters')
    .update(trackersToRow(patch))
    .eq('id', characterId)
    .select('*')
    .single()
  if (error) throw characterError(error)
  return rowToCharacter(data)
}

function characterError(error: { code?: string; message?: string }): TableError {
  if (error.code === '23505') return new TableError('You already have a character at this table.')
  // An update the rules refused returns no row at all.
  if (error.code === 'PGRST116') return new TableError("You can't change this character.")
  return fromDatabaseError(error)
}

// ---------------------------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------------------------

const PORTRAIT_SIZE = 512
const SIGNED_URL_SECONDS = 6 * 60 * 60
const portraitUrls = new Map<string, Promise<string | null>>()

/** Squares, shrinks and uploads a portrait, then points the character at it. Returns the new path. */
export async function uploadPortrait(character: Character, file: File): Promise<Character> {
  const image = await squareImage(file, PORTRAIT_SIZE)
  const extension = image.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${character.campaignId}/${character.id}/${Date.now()}.${extension}`
  const storage = db().storage.from('portraits')
  const { error } = await storage.upload(path, image, { contentType: image.type, cacheControl: '31536000' })
  if (error) throw new TableError("The portrait couldn't be uploaded. Try a smaller picture, or try again.")
  const updated = await saveTrackers(character.id, { portraitPath: path })
  if (character.portraitPath) void storage.remove([character.portraitPath])
  return updated
}

/** A temporary link to show a private portrait, shared across the screen. */
export function portraitUrl(path: string): Promise<string | null> {
  let url = portraitUrls.get(path)
  if (!url) {
    url = db()
      .storage.from('portraits')
      .createSignedUrl(path, SIGNED_URL_SECONDS)
      .then(({ data }) => data?.signedUrl ?? null)
    portraitUrls.set(path, url)
  }
  return url
}
