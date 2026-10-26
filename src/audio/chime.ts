// A short, soft two-note chime made in the browser (no audio file), for something arriving in
// your pack. Quiet, and silent if the browser hasn't allowed sound yet.

let context: AudioContext | null = null

export function playChime(): void {
  try {
    context ??= new AudioContext()
    const ctx = context
    if (ctx.state === 'suspended') void ctx.resume()
    const start = ctx.currentTime
    for (const [i, frequency] of [880, 1320].entries()) {
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
