import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../../components/cx.ts'
import type { GivingControls } from '../../../live/giving.ts'
import type { ShopControls } from '../../../live/shops.ts'
import { BITS } from '../../../rules/bits.ts'
import { buildCatalogue } from '../../../rules/catalogue.ts'
import { coinsFor, coinWords, readCoins } from '../../../rules/money.ts'
import {
  lineFor,
  linePrice,
  MARKUPS,
  needsPrice,
  SHOP_KINDS,
  startingStock,
  type Shop,
  type ShopKind,
  type StockLine,
} from '../../../rules/shops.ts'
import type { SrdEquipment, SrdMagicItem } from '../../../rules/srd/index.ts'
import own from '../GiveDialog.module.css'
import styles from '../RestDialog.module.css'
import box from './BoxDialog.module.css'
import shopStyles from './ShopDialog.module.css'
import { Status, type StatusLine } from './Status.tsx'

type ShopDialogProps = {
  /** The shop to change, or null to make one. */
  shop: Shop | null
  equipment: SrdEquipment
  magicItems: SrdMagicItem[]
  giving: GivingControls
  shops: ShopControls
  onClose: () => void
}

const price = (copper: number) => (copper > 0 ? coinWords(coinsFor(copper)) : 'free')

/**
 * Make or change a shop (I1c): what kind (its shelves fill from the free rules), its name, the
 * shopkeeper and your note on them, cheap, fair or pricey, whether it buys, and the shelves
 * themselves: any price or how many changed, lines taken away, anything added.
 */
export function ShopDialog({ shop, equipment, magicItems, giving, shops, onClose }: ShopDialogProps) {
  const [draft, setDraft] = useState<Shop | null>(shop)
  const [note, setNote] = useState(shop ? (shops.notes[shop.id] ?? '') : '')
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusLine | null>(null)
  const entries = useMemo(
    () => buildCatalogue({ magic: magicItems, equipment, bits: BITS, yours: giving.yours }),
    [magicItems, equipment, giving.yours],
  )

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  function start(kind: ShopKind) {
    setDraft({
      id: crypto.randomUUID(),
      name: SHOP_KINDS.find((k) => k.key === kind)?.name ?? 'A shop',
      keeper: '',
      kind,
      markup: 100,
      buys: true,
      open: false,
      stock: startingStock(kind, equipment, magicItems),
    })
  }

  if (!draft) {
    return (
      <div className={cx(styles.card, own.card)} role="dialog" aria-labelledby="shop-title">
        <h2 id="shop-title" className={styles.title}>
          Make a shop
        </h2>
        <p className={styles.lead}>What kind of shop? Its shelves fill from the free rules at their real prices.</p>
        <div className={box.options} role="radiogroup" aria-label="What kind of shop">
          {SHOP_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={false}
              className={box.option}
              onClick={() => start(k.key)}
            >
              <span className={own.name}>{k.name}</span>
              <span className={own.words}>{k.line}</span>
            </button>
          ))}
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const setLine = (id: string, patch: Partial<StockLine>) =>
    setDraft({ ...draft, stock: draft.stock.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const unpriced = draft.stock.filter(needsPrice)
  const matches = adding.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(adding.trim().toLowerCase())).slice(0, 8)
    : []

  async function save() {
    if (!draft) return
    setBusy(true)
    const problem = await shops.save(draft, note)
    setBusy(false)
    if (problem) setStatus({ ok: false, text: problem })
    else onClose()
  }

  return (
    <div className={cx(styles.card, own.card)} role="dialog" aria-labelledby="shop-title">
      <div className={own.head}>
        <h2 id="shop-title" className={styles.title}>
          {shop ? 'Change the shop' : 'Make a shop'}
        </h2>
      </div>
      <div className={shopStyles.layout}>
        <div className={shopStyles.about}>
          <label className={own.field}>
            <span className={styles.legend}>Name</span>
            <input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className={own.field}>
            <span className={styles.legend}>Shopkeeper</span>
            <input
              value={draft.keeper}
              maxLength={60}
              placeholder="Brenna"
              onChange={(e) => setDraft({ ...draft, keeper: e.target.value })}
            />
          </label>
          <label className={own.field}>
            <span className={styles.legend}>Your note on them (only you see it)</span>
            <textarea
              value={note}
              rows={3}
              maxLength={500}
              placeholder="Never stops talking about her son in the city guard."
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className={box.choice} role="radiogroup" aria-label="Prices">
            <span className={styles.legend}>Prices</span>
            <div className={own.sides}>
              {MARKUPS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={draft.markup === m.key}
                  className={cx(own.side, draft.markup === m.key && own.sideOn)}
                  title={m.line}
                  onClick={() => setDraft({ ...draft, markup: m.key })}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.person}>
            <input
              type="checkbox"
              checked={draft.buys}
              onChange={(e) => setDraft({ ...draft, buys: e.target.checked })}
            />
            Buys from players (half the book price)
          </label>
          <div className={own.field}>
            <span className={styles.legend}>Add to the shelves</span>
            <input
              className={own.search}
              value={adding}
              placeholder="A cloak, a potion, one of your items…"
              aria-label="Add to the shelves"
              onChange={(e) => setAdding(e.target.value)}
            />
            {matches.length > 0 && (
              <ul className={box.matches}>
                {matches.map((m) => (
                  <li key={m.key}>
                    <button
                      type="button"
                      className={own.link}
                      onClick={() => {
                        const line = lineFor(m.gift, m.source === 'magic' ? 1 : 5)
                        if (line) setDraft({ ...draft, stock: [line, ...draft.stock] })
                        setAdding('')
                      }}
                    >
                      {m.name}
                    </button>{' '}
                    <span className={own.words}>{m.line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={shopStyles.shelves}>
          {unpriced.length > 0 && (
            <p className={own.problem}>
              Set a price for {unpriced.map((l) => l.name).join(', ')}: the free rules don&rsquo;t price magic items.
            </p>
          )}
          <table className={shopStyles.table} aria-label="On the shelves">
            <thead>
              <tr>
                <th>Item</th>
                <th>Book price</th>
                <th>Price here</th>
                <th>How many</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.stock.map((line) => (
                <ShelfRow
                  key={line.id}
                  line={line}
                  markup={draft.markup}
                  onChange={(patch) => setLine(line.id, patch)}
                  onRemove={() => setDraft({ ...draft, stock: draft.stock.filter((l) => l.id !== line.id) })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Status status={status} />
      <div className={styles.buttons}>
        {shop && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              if (window.confirm(`Close ${shop.name} for good? Its shelves are lost.`))
                void shops.remove(shop.id).then(onClose)
            }}
          >
            Close it for good
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !draft.name.trim()}
          onClick={() => void save()}
        >
          {shop ? 'Save changes' : 'Make the shop'}
        </button>
      </div>
    </div>
  )
}

function ShelfRow({
  line,
  markup,
  onChange,
  onRemove,
}: {
  line: StockLine
  markup: number
  onChange: (patch: Partial<StockLine>) => void
  onRemove: () => void
}) {
  const [text, setText] = useState(line.price !== null ? coinWords(coinsFor(line.price)) : '')
  const typed = text.trim() ? readCoins(text) : null
  return (
    <tr className={needsPrice(line) ? shopStyles.unpriced : undefined}>
      <th scope="row">{line.name}</th>
      <td>{line.cost > 0 ? price(line.cost) : '–'}</td>
      <td>
        <input
          value={text}
          placeholder={needsPrice(line) ? 'Set a price' : price(linePrice({ ...line, price: null }, markup))}
          aria-label={`Price of ${line.name}`}
          aria-invalid={text.trim() !== '' && typed === null}
          onChange={(e) => {
            setText(e.target.value)
            const copper = e.target.value.trim() ? readCoins(e.target.value) : null
            if (!e.target.value.trim()) onChange({ price: null })
            else if (copper !== null) onChange({ price: copper })
          }}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={line.quantity ?? ''}
          placeholder="plenty"
          aria-label={`How many ${line.name}`}
          onChange={(e) =>
            onChange({ quantity: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)) })
          }
        />
      </td>
      <td>
        <button type="button" className={own.link} aria-label={`Take ${line.name} off the shelves`} onClick={onRemove}>
          Take off
        </button>
      </td>
    </tr>
  )
}
