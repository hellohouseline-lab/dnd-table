import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { Shopping } from '../../live/shops.ts'
import { useSrd } from '../../live/useSrd.ts'
import { weaponProficient } from '../../rules/build/gear.ts'
import type { Character } from '../../rules/character.ts'
import { armourWords, weaponWords } from '../../rules/manage.ts'
import { coinsFor, coinWords, walletCopper } from '../../rules/money.ts'
import { linePrice, needsPrice, sellPrice, type Shop, type StockLine } from '../../rules/shops.ts'
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
        <ul className={styles.grid} aria-label="On the shelves">
          {shop.stock
            .filter((line) => !needsPrice(line) && line.quantity !== 0)
            .map((line) => (
              <BuyCard
                key={line.id}
                line={line}
                shop={shop}
                equipment={equipment}
                wallet={walletCopper(character.wallet)}
                busy={busy}
                onBuy={(bundles) => {
                  const srd = line.item && equipment ? equipment.items.find((i) => i.index === line.item) : undefined
                  const proficient =
                    srd?.kind === 'weapon' ? weaponProficient(srd, character.otherProficiencies.split(/,\s*/)) : null
                  void run(
                    () => shopping.buy(shop.id, line.id, bundles, proficient),
                    `You bought ${bundles > 1 ? `${bundles} × ` : ''}${line.name} for ${coins(linePrice(line, shop.markup) * bundles)}.`,
                  )
                }}
              />
            ))}
        </ul>
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
  onBuy,
}: {
  line: StockLine
  shop: Shop
  equipment: SrdEquipment | null
  wallet: number
  busy: boolean
  onBuy: (bundles: number) => void
}) {
  const [bundles, setBundles] = useState(1)
  const price = linePrice(line, shop.markup)
  const srd = line.item && equipment ? equipment.items.find((i) => i.index === line.item) : undefined
  const words = srd?.kind === 'weapon' ? weaponWords(srd.index) : srd?.armour ? armourWords(srd) : (line.note ?? '')
  const max = line.quantity ?? 99
  return (
    <li className={styles.card}>
      <span className={styles.name}>{line.name}</span>
      {words && <span className={styles.words}>{words}</span>}
      <span className={styles.price}>
        {coins(price)}
        {line.quantity !== null && <span className={styles.muted}> · {line.quantity} left</span>}
      </span>
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
      </span>
    </li>
  )
}
