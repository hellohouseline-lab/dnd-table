import { useState } from 'react'
import type { Haggle, ShopControls } from '../../../live/shops.ts'
import type { Character } from '../../../rules/character.ts'
import { coinsFor, coinWords, readCoins } from '../../../rules/money.ts'
import type { SrdEquipment, SrdMagicItem } from '../../../rules/srd/index.ts'
import { marketValue, priceVerdict, valueWords, type Value } from '../../../rules/value.ts'
import styles from './HaggleCards.module.css'

type HaggleCardsProps = {
  haggles: Haggle[]
  shops: ShopControls
  characters: Character[]
  /** Ask the haggler for a Persuasion check first. */
  onPersuade: (characterId: string) => void
  /** For what it's worth (only the DM sees it). */
  equipment: SrdEquipment | null
  magicItems: SrdMagicItem[] | null
  className?: string
}

const coins = (copper: number) => (copper > 0 ? coinWords(coinsFor(copper)) : 'nothing')

/**
 * A player is haggling: their offer against the asking price, with Agree (it's sold at their
 * price), No, a counter-price, or a Persuasion check first. On Screen 1 whatever tab is open.
 */
export function HaggleCards({
  haggles,
  shops,
  characters,
  onPersuade,
  equipment,
  magicItems,
  className,
}: HaggleCardsProps) {
  const open = haggles.filter((h) => h.status === 'open')
  if (open.length === 0) return null
  return (
    <div className={className} aria-label="Haggling">
      {open.map((h) => {
        const line = shops.shops.find((s) => s.id === h.shopId)?.stock.find((l) => l.id === h.stockId)
        const value = line && equipment ? marketValue(line, equipment, magicItems) : null
        return (
          <HaggleCard
            key={h.id}
            haggle={h}
            value={value}
            count={line ? h.bundles * line.bundle : h.bundles}
            who={characters.find((c) => c.id === h.characterId)?.name ?? 'Someone'}
            shop={shops.shops.find((s) => s.id === h.shopId)?.name ?? 'the shop'}
            onAnswer={(agree, counter) => shops.answerHaggle(h.id, agree, counter)}
            onPersuade={() => onPersuade(h.characterId)}
          />
        )
      })}
    </div>
  )
}

function HaggleCard({
  haggle,
  value,
  count,
  who,
  shop,
  onAnswer,
  onPersuade,
}: {
  haggle: Haggle
  value: Value | null
  count: number
  who: string
  shop: string
  onAnswer: (agree: boolean, counter: number | null) => Promise<string | null>
  onPersuade: () => void
}) {
  const [counter, setCounter] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const copper = counter.trim() ? readCoins(counter) : null
  const answer = async (agree: boolean, price: number | null) => {
    setBusy(true)
    setProblem(await onAnswer(agree, price))
    setBusy(false)
  }
  const what = `${haggle.bundles > 1 ? `${haggle.bundles} × ` : ''}${haggle.itemName}`
  return (
    <article className={styles.card} aria-label={`${who} is haggling`}>
      <p className={styles.text}>
        <strong>{who}</strong> offers <strong>{coins(haggle.offer)}</strong> for {what} at {shop}.
      </p>
      <p className={styles.asking}>
        The shop asks {coins(haggle.asking)}.{value && ` It’s worth ${valueWords(value, count)}`}
        {value &&
          priceVerdict(haggle.offer, value, count) &&
          `, so their offer is ${priceVerdict(haggle.offer, value, count)}`}
        {value && '.'}
      </p>
      {problem && <p className={styles.problem}>{problem}</p>}
      <div className={styles.buttons}>
        <button type="button" className={styles.agree} disabled={busy} onClick={() => void answer(true, null)}>
          Agree
        </button>
        <button type="button" className={styles.no} disabled={busy} onClick={() => void answer(false, null)}>
          No
        </button>
        <button type="button" className={styles.no} onClick={onPersuade}>
          Ask for Persuasion
        </button>
      </div>
      <form
        className={styles.counter}
        onSubmit={(e) => {
          e.preventDefault()
          if (copper !== null) void answer(false, copper)
        }}
      >
        <input
          value={counter}
          placeholder="gp"
          aria-label={`Counter-price for ${who}`}
          onChange={(e) => setCounter(e.target.value)}
        />
        <button type="submit" className={styles.no} disabled={busy || copper === null}>
          Counter
        </button>
      </form>
    </article>
  )
}
