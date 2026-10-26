import { useState } from 'react'
import { cx } from '../../../components/cx.ts'
import type { GivingControls } from '../../../live/giving.ts'
import type { Character } from '../../../rules/character.ts'
import { coinsFor, coinWords, readCoins, splitCoins, walletCopper } from '../../../rules/money.ts'
import own from '../GiveDialog.module.css'
import styles from '../RestDialog.module.css'
import { Status, type StatusLine } from './Status.tsx'

type CoinWay = 'give' | 'split' | 'take'

type GiveCoinsProps = {
  characters: Character[]
  who: string | null
  onWho: (id: string) => void
  giving: GivingControls
  onClose: () => void
}

/** Coins: give to one, share across the party (odd coins to the party stash), or take, with change made. */
export function GiveCoins({ characters, who, onWho, giving, onClose }: GiveCoinsProps) {
  const [coinText, setCoinText] = useState('')
  const [way, setWay] = useState<CoinWay>('give')
  const [sharing, setSharing] = useState<string[]>(() => characters.map((c) => c.id))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusLine | null>(null)
  const character = characters.find((c) => c.id === who) ?? null
  const copper = readCoins(coinText)
  const share = copper && sharing.length > 0 ? splitCoins(copper, sharing.length) : null

  async function run(task: () => Promise<string | null>, done: string) {
    setBusy(true)
    setStatus(null)
    const problem = await task()
    setBusy(false)
    setStatus(problem ? { ok: false, text: problem } : { ok: true, text: done })
  }

  async function coins() {
    if (!copper) return
    if (way === 'split') {
      await run(
        () => giving.split(sharing, copper),
        `Shared out: ${coinWords(coinsFor(share?.each ?? 0))} each${share?.left ? `, ${coinWords(coinsFor(share.left))} to the party stash` : ''}.`,
      )
    } else if (character) {
      await run(
        () => (way === 'give' ? giving.give(character.id, [], {}, copper) : giving.take(character.id, copper)),
        way === 'give'
          ? `${character.name} got ${coinWords(coinsFor(copper))}.`
          : `${character.name} paid ${coinWords(coinsFor(copper))}.`,
      )
    }
  }

  return (
    <>
      <div className={own.sides} role="radiogroup" aria-label="Give, share or take">
        {(
          [
            ['give', 'Give to one'],
            ['split', 'Split across the party'],
            ['take', 'Take from one'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={way === key}
            className={cx(own.side, way === key && own.sideOn)}
            onClick={() => setWay(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <fieldset className={styles.who}>
        <legend className={styles.legend}>
          {way === 'split' ? 'Who shares it' : way === 'take' ? 'Take from' : 'Who gets it'}
        </legend>
        {characters.map((c) =>
          way === 'split' ? (
            <label key={c.id} className={styles.person}>
              <input
                type="checkbox"
                checked={sharing.includes(c.id)}
                onChange={(e) =>
                  setSharing((now) => (e.target.checked ? [...now, c.id] : now.filter((id) => id !== c.id)))
                }
              />
              {c.name}
            </label>
          ) : (
            <label key={c.id} className={styles.person}>
              <input type="radio" name="coins-who" checked={who === c.id} onChange={() => onWho(c.id)} />
              {c.name}
            </label>
          ),
        )}
      </fieldset>
      <label className={own.field}>
        <span className={styles.legend}>How much</span>
        <input
          value={coinText}
          placeholder="47, or 3 gp 5 sp"
          onChange={(e) => setCoinText(e.target.value)}
          aria-invalid={coinText.trim() !== '' && copper === null}
        />
      </label>
      <p className={styles.note}>
        {coinText.trim() && copper === null
          ? 'Type gold pieces (47, or 2.5), or coins such as 3 gp 5 sp.'
          : way === 'split' && share
            ? `${coinWords(coinsFor(share.each))} each${share.left ? `, and ${coinWords(coinsFor(share.left))} to the party stash` : ''}.`
            : way === 'take' && character
              ? `${character.name} has ${coinWords(character.wallet)} (${coinWords(coinsFor(walletCopper(character.wallet)))} in all). Change is made for them.`
              : 'A number on its own is gold pieces.'}
      </p>
      <Status status={status} />
      <div className={styles.buttons}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Done
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!copper || busy || (way === 'split' ? sharing.length === 0 : !character)}
          onClick={() => void coins()}
        >
          {!copper
            ? 'Give'
            : way === 'split'
              ? `Split ${coinWords(coinsFor(copper))}`
              : way === 'give'
                ? `Give ${coinWords(coinsFor(copper))}`
                : `Take ${coinWords(coinsFor(copper))}`}
        </button>
      </div>
    </>
  )
}
