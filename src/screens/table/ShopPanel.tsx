import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Shopping } from '../../live/shops.ts'
import { useSrd } from '../../live/useSrd.ts'
import { weaponProficient } from '../../rules/build/gear.ts'
import type { Character } from '../../rules/character.ts'
import { armourWords, weaponWords } from '../../rules/manage.ts'
import { coinsFor, coinWords, walletCopper } from '../../rules/money.ts'
import {
  linePrice,
  needsPrice,
  sellPrice,
  shopTag,
  shopTags,
  type Shop,
  type ShopTag,
  type StockLine,
} from '../../rules/shops.ts'
import type { Haggle } from '../../live/shops.ts'
import { readCoins } from '../../rules/money.ts'
import { loadEquipment, type SrdEquipment } from '../../rules/srd/index.ts'
import styles from './ShopPanel.module.css'

type ShopPanelProps = {
  character: Character
  shopping: Shopping
  onClose: () => void
}

const coins = (copper: number) => (copper > 0 ? coinWords(coinsFor(copper)) : 'free')

/**
 * A shop the DM has opened, on a player's screen: the shelves with prices and how many are left,
 * Buy (the coins come out with change made), and Sell for anything the shop will take.
 */
export function ShopPanel({ character, shopping, onClose }: ShopPanelProps) {
  const equipment = useSrd(loadEquipment)
  const [shopId, setShopId] = useState(shopping.shops[0]?.id ?? null)
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [tags, setTags] = useState<ShopTag[]>([])
  const [search, setSearch] = useState('')
  const shop = shopping.shops.find((s) => s.id === shopId) ?? shopping.shops[0] ?? null

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  if (!shop) {
    return (
      <section className={styles.panel} aria-label="Shop">
        <p>The shop has closed.</p>
        <button type="button" className={styles.close} onClick={onClose}>
          Back to the table
        </button>
      </section>
    )
  }

  async function run(task: () => Promise<string | null>, done: string) {
    setBusy(true)
    setStatus(null)
    const problem = await task()
    setBusy(false)
    setStatus(problem ? { ok: false, text: problem } : { ok: true, text: done })
  }

  return (
    <section className={styles.panel} aria-label="Shop">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{shop.name}</h2>
          {shop.keeper && <div className={styles.keeper}>{shop.keeper} runs it</div>}
        </div>
        <span className={styles.purse}>Your purse: {coinWords(character.wallet)}</span>
        <button type="button" className={styles.close} onClick={onClose}>
          Back to the table
        </button>
      </header>
      {shopping.shops.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Which shop">
          {shopping.shops.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === shop.id}
              className={cx(styles.tab, s.id === shop.id && styles.tabOn)}
              onClick={() => setShopId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.tabs} role="tablist" aria-label="Buy or sell">
        <button
          type="button"
          role="tab"
          aria-selected={side === 'buy'}
          className={cx(styles.tab, side === 'buy' && styles.tabOn)}
          onClick={() => setSide('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'sell'}
          className={cx(styles.tab, side === 'sell' && styles.tabOn)}
          disabled={!shop.buys}
          title={shop.buys ? undefined : 'This shop doesn’t buy'}
          onClick={() => setSide('sell')}
        >
          Sell
        </button>
      </div>
      {status && (
        <p className={status.ok ? styles.ok : styles.problem} role="status">
          {status.text}
        </p>
      )}

      {side === 'buy' ? (
        <>
          <div className={styles.filters}>
            <input
              className={styles.search}
              value={search}
              placeholder="Look for something"
              aria-label="Look for something in the shop"
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.tags} role="group" aria-label="What kind">
              {shopTags(shop.stock, equipment).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={cx(styles.tag, tags.includes(t.key) && styles.tagOn)}
                  aria-pressed={tags.includes(t.key)}
                  onClick={() =>
                    setTags((now) => (now.includes(t.key) ? now.filter((k) => k !== t.key) : [...now, t.key]))
                  }
                >
                  {t.name} <span className={styles.muted}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className={styles.grid} aria-label="On the shelves">
            {shop.stock
              .filter((line) => !needsPrice(line) && line.quantity !== 0)
              .filter((line) => tags.length === 0 || tags.includes(shopTag(line, equipment)))
              .filter((line) => !search.trim() || line.name.toLowerCase().includes(search.trim().toLowerCase()))
              .map((line) => {
                const srd = line.item && equipment ? equipment.items.find((i) => i.index === line.item) : undefined
                const proficient =
                  srd?.kind === 'weapon' ? weaponProficient(srd, character.otherProficiencies.split(/,\s*/)) : null
                return (
                  <BuyCard
                    key={line.id}
                    line={line}
                    shop={shop}
                    equipment={equipment}
                    wallet={walletCopper(character.wallet)}
                    busy={busy}
                    haggle={shopping.haggles.find((h) => h.stockId === line.id && h.shopId === shop.id) ?? null}
                    onBuy={(bundles) =>
                      void run(
                        () => shopping.buy(shop.id, line.id, bundles, proficient),
                        `You bought ${bundles > 1 ? `${bundles} × ` : ''}${line.name} for ${coins(linePrice(line, shop.markup) * bundles)}.`,
                      )
                    }
                    onHaggle={(bundles, offer) =>
                      void run(
                        () => shopping.haggle(shop.id, line.id, bundles, offer, proficient),
                        `You offer ${coins(offer)}. ${shop.keeper || 'The shopkeeper'} is thinking about it.`,
                      )
                    }
                    onTakeCounter={(haggleId, take) =>
                      void run(
                        () => shopping.takeCounter(haggleId, take),
                        take ? `It’s yours.` : 'You leave it on the shelf.',
                      )
                    }
                  />
                )
              })}
          </ul>
        </>
      ) : (
        <ul className={styles.sellList} aria-label="Your things">
          {character.inventory.map((item) => {
            const each = equipment ? sellPrice(item, shop, equipment) : null
            return (
              <li key={item.id}>
                <span>
                  {item.quantity > 1 && `${item.quantity} × `}
                  {item.name}
                </span>
                {each === null ? (
                  <span className={styles.muted}>{item.worn ? 'Take it off first' : 'They won’t buy it'}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.buy}
                    disabled={busy}
                    aria-label={`Sell ${item.name} for ${coins(each)}`}
                    onClick={() =>
                      void run(() => shopping.sell(shop.id, item.id, 1), `You sold ${item.name} for ${coins(each)}.`)
                    }
                  >
                    Sell one for {coins(each)}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function BuyCard({
  line,
  shop,
  equipment,
  wallet,
  busy,
  haggle,
  onBuy,
  onHaggle,
  onTakeCounter,
}: {
  line: StockLine
  shop: Shop
  equipment: SrdEquipment | null
  wallet: number
  busy: boolean
  /** Your latest offer for this, if any. */
  haggle: Haggle | null
  onBuy: (bundles: number) => void
  onHaggle: (bundles: number, offer: number) => void
  onTakeCounter: (haggleId: string, take: boolean) => void
}) {
  const [bundles, setBundles] = useState(1)
  const [haggling, setHaggling] = useState(false)
  const [offerText, setOfferText] = useState('')
  const price = linePrice(line, shop.markup)
  const srd = line.item && equipment ? equipment.items.find((i) => i.index === line.item) : undefined
  const words = srd?.kind === 'weapon' ? weaponWords(srd.index) : srd?.armour ? armourWords(srd) : (line.note ?? '')
  const max = line.quantity ?? 99
  const offer = offerText.trim() ? readCoins(offerText) : null
  const keeper = shop.keeper || 'The shopkeeper'
  return (
    <li className={styles.card}>
      <span className={styles.name}>{line.name}</span>
      {words && <span className={styles.words}>{words}</span>}
      <span className={styles.price}>
        {coins(price)}
        {line.quantity !== null && <span className={styles.muted}> · {line.quantity} left</span>}
      </span>
      {haggle?.status === 'open' && (
        <span className={styles.haggleNote}>
          You offered {coins(haggle.offer)}. {keeper} is thinking about it.
        </span>
      )}
      {haggle?.status === 'countered' && haggle.counter !== null && (
        <span className={styles.haggleNote}>
          {keeper} says {coins(haggle.counter)}.{' '}
          <span className={styles.buyRow}>
            <button
              type="button"
              className={styles.buy}
              disabled={busy || haggle.counter > wallet}
              onClick={() => onTakeCounter(haggle.id, true)}
            >
              Take it
            </button>
            <button type="button" className={styles.link} onClick={() => onTakeCounter(haggle.id, false)}>
              Leave it
            </button>
          </span>
        </span>
      )}
      {haggle?.status === 'refused' && <span className={styles.haggleNote}>{keeper} won&rsquo;t go that low.</span>}
      <span className={styles.buyRow}>
        <input
          type="number"
          min={1}
          max={max}
          value={bundles}
          aria-label={`How many ${line.name}`}
          onChange={(e) => setBundles(Math.max(1, Math.min(max, Math.floor(Number(e.target.value) || 1))))}
        />
        <button
          type="button"
          className={styles.buy}
          disabled={busy || price * bundles > wallet}
          title={price * bundles > wallet ? 'You haven’t enough coins' : undefined}
          aria-label={`Buy ${line.name}`}
          onClick={() => onBuy(bundles)}
        >
          Buy
        </button>
        <button
          type="button"
          className={styles.link}
          aria-expanded={haggling}
          aria-label={`Haggle for ${line.name}`}
          onClick={() => setHaggling(!haggling)}
        >
          Haggle
        </button>
      </span>
      {haggling && (
        <form
          className={styles.buyRow}
          aria-label={`Your offer for ${line.name}`}
          onSubmit={(e) => {
            e.preventDefault()
            if (offer !== null) {
              onHaggle(bundles, offer)
              setHaggling(false)
              setOfferText('')
            }
          }}
        >
          <input
            className={styles.offerInput}
            value={offerText}
            placeholder="gp"
            aria-label={`What you'll pay for ${line.name}`}
            onChange={(e) => setOfferText(e.target.value)}
          />
          <button type="submit" className={styles.buy} disabled={offer === null || offer > wallet}>
            Offer
          </button>
        </form>
      )}
    </li>
  )
}
