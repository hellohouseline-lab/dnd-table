// A thin wrapper round Howler.js, so the rest of the app never touches it and it could be swapped.
// Each browser plays its own copy of every sound: the stage says what should be playing and from
// when, and the mixer makes it so. Music crossfades and loops; ambience loops at the DM's levels;
// effects play once. Each listener's own volume sits on top of the DM's mix.

import { Howl, Howler } from 'howler'

export type Sound = { id: string; url: string; format: 'mp3' | 'ogg' }

export type MusicWanted = Sound & {
  playing: boolean
  /** Server time in ms when the looping track would have started (while playing). */
  startedAt: number | null
  /** Seconds in (while paused). */
  position: number
  volume: number
}

export type AmbienceWanted = Sound & { level: number }

type Listener = () => void

const CROSSFADE_MS = 2500
const FADE_MS = 400

/** Where a looping track should be now, in seconds. */
export function musicOffset(
  want: Pick<MusicWanted, 'playing' | 'startedAt' | 'position'>,
  duration: number,
  now: number,
): number {
  if (!want.playing || want.startedAt === null || !(duration > 0)) return Math.max(0, want.position)
  const elapsed = Math.max(0, (now - want.startedAt) / 1000)
  return elapsed % duration
}

function fadeOutAndUnload(howl: Howl, ms = CROSSFADE_MS) {
  if (!howl.playing()) {
    howl.unload()
    return
  }
  howl.fade(howl.volume(), 0, ms)
  setTimeout(() => howl.unload(), ms + 50)
}

class Mixer {
  private music: { want: MusicWanted; howl: Howl; loaded: boolean } | null = null
  private ambience = new Map<string, { howl: Howl; level: number }>()
  private effects = new Map<string, Howl>()
  private listeners = new Set<Listener>()
  private now: () => number = Date.now
  locked = false

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setLocked(locked: boolean) {
    if (this.locked === locked) return
    this.locked = locked
    this.listeners.forEach((listener) => listener())
  }

  /** Browsers only play sound after the person has clicked or typed on the page. */
  private watch(howl: Howl, resume: () => void) {
    howl.on('playerror', () => {
      this.setLocked(true)
      howl.once('unlock', () => {
        this.setLocked(false)
        resume()
      })
    })
    howl.on('play', () => this.setLocked(false))
  }

  setClock(now: () => number) {
    this.now = now
  }

  /** This listener's own volume, 0 to 1, on top of the DM's mix. */
  setMasterVolume(volume: number) {
    Howler.volume(Math.min(1, Math.max(0, volume)))
  }

  setMusic(want: MusicWanted | null) {
    const current = this.music
    if (current && want && current.want.id === want.id) {
      const before = current.want
      current.want = want
      if (!current.loaded) return
      if (want.playing && (!before.playing || before.startedAt !== want.startedAt)) this.startMusic(current)
      else if (!want.playing && before.playing) current.howl.pause()
      if (want.volume !== before.volume && want.playing) current.howl.fade(current.howl.volume(), want.volume, FADE_MS)
      return
    }

    if (current) fadeOutAndUnload(current.howl)
    this.music = null
    if (!want) return

    const howl = new Howl({ src: [want.url], format: [want.format], html5: true, loop: true, volume: 0 })
    const entry = { want, howl, loaded: false }
    this.music = entry
    this.watch(howl, () => entry.want.playing && this.startMusic(entry))
    howl.once('load', () => {
      entry.loaded = true
      if (this.music === entry && entry.want.playing) this.startMusic(entry)
    })
  }

  private startMusic(entry: { want: MusicWanted; howl: Howl }) {
    const { howl, want } = entry
    howl.seek(musicOffset(want, howl.duration(), this.now()))
    if (!howl.playing()) howl.play()
    howl.fade(howl.volume(), want.volume, CROSSFADE_MS)
  }

  setAmbience(wanted: AmbienceWanted[]) {
    for (const [id, entry] of this.ambience) {
      if (!wanted.some((w) => w.id === id)) {
        fadeOutAndUnload(entry.howl, FADE_MS * 3)
        this.ambience.delete(id)
      }
    }
    for (const want of wanted) {
      const entry = this.ambience.get(want.id)
      if (entry) {
        if (entry.level !== want.level) entry.howl.fade(entry.howl.volume(), want.level, FADE_MS)
        entry.level = want.level
        continue
      }
      const howl = new Howl({ src: [want.url], format: [want.format], html5: true, loop: true, volume: 0 })
      const start = () => {
        if (!howl.playing()) howl.play()
        howl.fade(0, this.ambience.get(want.id)?.level ?? want.level, CROSSFADE_MS)
      }
      this.watch(howl, start)
      howl.once('load', start)
      this.ambience.set(want.id, { howl, level: want.level })
    }
  }

  /** Loads a sound effect ahead of time, so it fires the moment it's pressed. */
  preloadEffect(sound: Sound) {
    if (this.effects.has(sound.id)) return
    const howl = new Howl({ src: [sound.url], format: [sound.format] })
    this.watch(howl, () => undefined)
    this.effects.set(sound.id, howl)
  }

  playEffect(sound: Sound) {
    this.preloadEffect(sound)
    this.effects.get(sound.id)?.play()
  }

  stopAll() {
    if (this.music) this.music.howl.unload()
    this.music = null
    this.ambience.forEach((entry) => entry.howl.unload())
    this.ambience.clear()
  }
}

export const mixer = new Mixer()
