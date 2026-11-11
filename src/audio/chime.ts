// Short, soft chimes made in the browser (no audio file): two notes for something arriving in
// your pack, three rising notes when it's your turn or the DM asks you to roll. Quiet, and silent
// if the browser hasn't allowed sound yet.

let context: AudioContext | null = null

const GIFT_NOTES = [880, 1320]
const TURN_NOTES = [660, 880, 1175]

/** The chime that calls you back to the table: your turn, or a roll the DM asked for. */
export function playTurnChime(): void {
  playChime(TURN_NOTES)
}

export function playChime(notes: number[] = GIFT_NOTES): void {
  try {
    context ??= new AudioContext()
    const ctx = context
    if (ctx.state === 'suspended') void ctx.resume()
    const start = ctx.currentTime
    for (const [i, frequency] of notes.entries()) {
      const at = start + i * 0.12
      const tone = ctx.createOscillator()
      const gain = ctx.createGain()
      tone.type = 'sine'
      tone.frequency.value = frequency
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.6)
      tone.connect(gain).connect(ctx.destination)
      tone.start(at)
      tone.stop(at + 0.65)
    }
  } catch {
    // No sound: the card still shows.
  }
}
