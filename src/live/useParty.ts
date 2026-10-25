import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../rules/character.ts'
import { useCharacterChanges } from './campaignChannel.ts'
import { applyCharacterChange, type CharacterChange, type TrackerPatch } from './characterRows.ts'
import { listCharacters, saveTrackers } from './characters.ts'
import { messageFor } from './errors.ts'

export type Party =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      characters: Character[]
      /** Changes trackers straight away on screen, then saves them. */
      update: (characterId: string, patch: TrackerPatch) => void
      /** Puts a character saved elsewhere (the form, a portrait) into the list. */
      replace: (character: Character) => void
      /** The last save that failed, in plain words. */
      saveError: string | null
    }

/**
 * Everyone's characters at the table, kept up to date live. Your own changes show at once; while
 * a save is on its way, live echoes of older values for that character are ignored, so nothing
 * flickers back.
 */
export function useParty(campaignId: string, userId: string): Party {
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saving = useRef(new Map<string, number>())

  useEffect(() => {
    let current = true
    listCharacters(campaignId).then(
      (list) => current && setCharacters(list),
      (error: unknown) => current && setLoadError(messageFor(error)),
    )
    return () => {
      current = false
    }
  }, [campaignId])

  const onChange = useCallback((change: CharacterChange) => {
    const id = change.type === 'delete' ? change.id : change.row.id
    if ((saving.current.get(id) ?? 0) > 0) return
    setCharacters((list) => (list ? applyCharacterChange(list, change) : list))
  }, [])
  useCharacterChanges(campaignId, userId, onChange)

  const replace = useCallback((character: Character) => {
    setCharacters((list) => list && list.map((c) => (c.id === character.id ? character : c)))
  }, [])

  const update = useCallback(
    (characterId: string, patch: TrackerPatch) => {
      setSaveError(null)
      setCharacters((list) => list && list.map((c) => (c.id === characterId ? { ...c, ...patch } : c)))
      const pending = saving.current
      pending.set(characterId, (pending.get(characterId) ?? 0) + 1)
      saveTrackers(characterId, patch)
        .then((saved) => {
          pending.set(characterId, (pending.get(characterId) ?? 1) - 1)
          if (pending.get(characterId) === 0) replace(saved)
        })
        .catch((error: unknown) => {
          pending.set(characterId, (pending.get(characterId) ?? 1) - 1)
          setSaveError(messageFor(error))
          // Put back what the database really has.
          void listCharacters(campaignId).then(setCharacters, () => {})
        })
    },
    [campaignId, replace],
  )

  if (loadError) return { status: 'error', message: loadError }
  if (!characters) return { status: 'loading' }
  return { status: 'ready', characters, update, replace, saveError }
}
