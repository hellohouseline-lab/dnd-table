import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { useSrd } from '../../live/useSrd.ts'
import { carryingCapacity } from '../../rules/build/body.ts'
import { findItem, weaponProficient } from '../../rules/build/gear.ts'
import { itemName } from '../../rules/build/gearStep.ts'
import { EMPTY_WALLET, entryId, type Character, type InventoryItem, type Wallet } from '../../rules/character.ts'
import { POTIONS, USABLE, wornArmourClass } from '../../rules/items.ts'
import { attunedCount, ATTUNE_LIMIT, toggleAttuned } from '../../rules/magic.ts'
import { coinWords, walletCopper } from '../../rules/money.ts'
import { anOrA } from '../../rules/sheetText.ts'
import type { HandOver, StashControls } from '../../live/giving.ts'
import { loadEquipment } from '../../rules/srd/index.ts'
import { Section } from './SheetTab.tsx'
import styles from './sheet.module.css'

type TabProps = {
  character: Character
  canEdit: boolean
  onUpdate: (patch: TrackerPatch) => void
  /** Handing things to someone else in the party (left out where there's nobody to give to). */
  handing?: { party: Character[]; handOver: HandOver }
  /** The party stash: take things for yourself, and share out its coins. */
  stash?: StashControls
  /** Whether the Add box shows (the DM can stop players adding gear for free). */
  canAddGear?: boolean
}

const COINS: { key: keyof Wallet; name: string }[] = [
  { key: 'pp', name: 'Platinum' },
  { key: 'gp', name: 'Gold' },
  { key: 'ep', name: 'Electrum' },
  { key: 'sp', name: 'Silver' },
  { key: 'cp', name: 'Copper' },
]

/**
 * The Inventory tab: what the character carries (with armour worn setting the AC), how much it
 * weighs against what they can carry, and their coins. Usable things, such as potions, show what
 * they do; in a fight they're in the hand's Items set.
 */
export function InventoryTab({ character, canEdit, onUpdate, handing, stash, canAddGear = true }: TabProps) {
  const equipment = useSrd(loadEquipment)
  const [adding, setAdding] = useState('')
  const [givingId, setGivingId] = useState<string | null>(null)
  const [handed, setHanded] = useState<{ ok: boolean; text: string } | null>(null)
  const others = handing?.party.filter((c) => c.id !== character.id) ?? []

  async function takeFromStash(item: InventoryItem) {
    const srd = item.item && equipment ? findItem(equipment, item.item) : undefined
    const proficient = srd?.kind === 'weapon' ? weaponProficient(srd, character.otherProficiencies.split(/,\s*/)) : null
    const problem = await stash!.take(item.id, item.quantity, proficient)
    setHanded(
      problem ? { ok: false, text: problem } : { ok: true, text: `You took ${item.name} from the party stash.` },
    )
  }

  async function splitStash() {
    const problem = await stash!.split()
    setHanded(problem ? { ok: false, text: problem } : { ok: true, text: 'The coins are shared out across the party.' })
  }
  const attuned = attunedCount(character.inventory)

  async function hand(to: Character, what: { item: InventoryItem | null; quantity: number; coins: Wallet }) {
    const srd = what.item?.item && equipment ? findItem(equipment, what.item.item) : undefined
    const proficient = srd?.kind === 'weapon' ? weaponProficient(srd, to.otherProficiencies.split(/,\s*/)) : null
    const problem = await handing!.handOver(to.id, {
      itemId: what.item?.id ?? null,
      quantity: what.quantity,
      coins: what.coins,
      proficient,
    })
    const given = [
      what.item ? `${what.quantity > 1 ? `${what.quantity} ×` : anOrA(what.item.name)} ${what.item.name}` : '',
      coinWords(what.coins),
    ]
      .filter((t) => t && t !== 'nothing')
      .join(' and ')
    setHanded(problem ? { ok: false, text: problem } : { ok: true, text: `You gave ${to.name} ${given}.` })
    if (!problem) setGivingId(null)
  }
  const { inventory, wallet } = character
  const weight = inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
  const capacity = carryingCapacity(character.scores.strength)

  function save(next: InventoryItem[]) {
    const ac = equipment ? wornArmourClass(character, next, equipment) : null
    onUpdate(ac !== null && ac !== character.armourClass ? { inventory: next, armourClass: ac } : { inventory: next })
  }

  function add() {
    const name = adding.trim()
    if (!name) return
    const potion = POTIONS.find((p) => p.name.toLowerCase() === name.toLowerCase())
    const found = potion
      ? { index: potion.index, name: potion.name, weight: potion.weight }
      : equipment?.items.find((i) => itemName(i.name).toLowerCase() === name.toLowerCase())
    const existing = found ? inventory.find((i) => i.item === found.index) : undefined
    if (existing) save(inventory.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i)))
    else
      save([
        ...inventory,
        {
          id: entryId(),
          item: found?.index ?? null,
          name: found ? itemName(found.name) : name.slice(0, 60),
          quantity: 1,
          weight: found?.weight ?? 0,
          worn: false,
          uses: found?.index === 'healers-kit' ? 10 : null,
        },
      ])
    setAdding('')
  }

  return (
    <div className={styles.inventoryColumns}>
      <Section title="What you carry" note={`${weight} of ${capacity} lb`}>
        {inventory.length === 0 ? (
          <p className={styles.empty}>
            Nothing yet. Starting gear comes from the character builder, or add things here.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>How many</th>
                <th>Weight</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const srd = item.item && equipment ? findItem(equipment, item.item) : undefined
                const wearable = Boolean(srd?.armour)
                const usable = item.item ? USABLE[item.item] : undefined
                return (
                  <tr key={item.id}>
                    <th scope="row" className={item.magic ? styles.magicItem : undefined}>
                      {item.name}
                      {item.uses !== null && <span className={styles.muted}> ({item.uses} uses left)</span>}
                      {usable && <div className={styles.itemUse}>{usable.what}</div>}
                      {item.note && <div className={styles.itemUse}>{item.note}</div>}
                    </th>
                    <td>
                      {canEdit ? (
                        <span className={styles.inline}>
                          <button
                            type="button"
                            className={styles.stepper}
                            aria-label={`One fewer ${item.name}`}
                            onClick={() =>
                              save(
                                item.quantity <= 1
                                  ? inventory.filter((i) => i.id !== item.id)
                                  : inventory.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)),
                              )
                            }
                          >
                            −
                          </button>
                          {item.quantity}
                          <button
                            type="button"
                            className={styles.stepper}
                            aria-label={`One more ${item.name}`}
                            onClick={() =>
                              save(inventory.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)))
                            }
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td>{item.weight ? `${item.weight * item.quantity} lb` : '–'}</td>
                    <td>
                      {wearable && (
                        <button
                          type="button"
                          className={cx(styles.toggle, item.worn && styles.toggleOn)}
                          disabled={!canEdit}
                          aria-pressed={item.worn}
                          onClick={() =>
                            save(
                              inventory.map((i) => {
                                if (i.id === item.id) return { ...i, worn: !i.worn }
                                // One suit of armour at a time.
                                const other = i.item && equipment ? findItem(equipment, i.item) : undefined
                                const both = other?.armour && other.sub !== 'Shield' && srd?.sub !== 'Shield'
                                return !item.worn && both ? { ...i, worn: false } : i
                              }),
                            )
                          }
                        >
                          {item.worn ? 'Worn' : 'Wear it'}
                        </button>
                      )}
                      {item.attune && (
                        <button
                          type="button"
                          className={cx(styles.toggle, item.attuned && styles.toggleOn)}
                          disabled={!canEdit || (!item.attuned && attuned >= ATTUNE_LIMIT)}
                          aria-pressed={Boolean(item.attuned)}
                          title={
                            !item.attuned && attuned >= ATTUNE_LIMIT
                              ? `You can be attuned to ${ATTUNE_LIMIT} things at once. Stop attuning to one first.`
                              : 'It only works while you are attuned to it (a short rest with it, by the rules).'
                          }
                          onClick={() => {
                            const next = toggleAttuned(inventory, item.id)
                            if (next) save(next)
                          }}
                        >
                          {item.attuned ? 'Attuned' : 'Attune'}
                        </button>
                      )}
                      {canEdit && others.length > 0 && !item.worn && (
                        <button
                          type="button"
                          className={styles.toggle}
                          aria-expanded={givingId === item.id}
                          onClick={() => {
                            setHanded(null)
                            setGivingId(givingId === item.id ? null : item.id)
                          }}
                        >
                          Give to…
                        </button>
                      )}
                      {givingId === item.id && (
                        <HandOverRow
                          others={others}
                          max={item.quantity}
                          label={item.name}
                          onGive={(to, quantity) => void hand(to, { item, quantity, coins: EMPTY_WALLET })}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {weight > capacity && <p className={styles.warn}>That&rsquo;s more than you can carry.</p>}
        {handed && (
          <p className={handed.ok ? styles.handedOk : styles.warn} role="status">
            {handed.text}
          </p>
        )}
        {attuned > 0 && (
          <p className={styles.sectionNoteBlock}>
            Attuned to {attuned} of {ATTUNE_LIMIT}.
          </p>
        )}
        {canEdit && !canAddGear && (
          <p className={styles.sectionNoteBlock}>Your DM adds things for now. Buy them in a shop when one is open.</p>
        )}
        {canEdit && canAddGear && (
          <div className={styles.inline}>
            <input
              className={styles.addInput}
              list="srd-items"
              aria-label="Add an item"
              placeholder="Add an item: a rope, a potion of healing…"
              value={adding}
              maxLength={60}
              onChange={(event) => setAdding(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && add()}
            />
            <datalist id="srd-items">
              {POTIONS.map((p) => (
                <option key={p.index} value={p.name} />
              ))}
              {equipment?.items.map((i) => (
                <option key={i.index} value={itemName(i.name)} />
              ))}
            </datalist>
            <button type="button" className={styles.toggle} onClick={add} disabled={!adding.trim()}>
              Add
            </button>
          </div>
        )}
      </Section>

      <Section title="Coins">
        <div className={styles.coins}>
          {COINS.map((coin) => (
            <label key={coin.key} className={styles.coin}>
              <span className={styles.muted}>{coin.name}</span>
              <input
                type="number"
                min={0}
                max={999999}
                disabled={!canEdit}
                value={wallet[coin.key]}
                aria-label={`${coin.name} pieces`}
                onChange={(event) =>
                  onUpdate({
                    wallet: { ...wallet, [coin.key]: Math.max(0, Math.round(Number(event.target.value) || 0)) },
                  })
                }
              />
            </label>
          ))}
        </div>
        {canEdit && others.length > 0 && (
          <CoinsOver
            others={others}
            wallet={wallet}
            onGive={(to, coins) => void hand(to, { item: null, quantity: 0, coins })}
          />
        )}
        <p className={styles.sectionNoteBlock}>
          10 copper make a silver, 10 silver a gold, 10 gold a platinum. Shops arrive later.
        </p>
      </Section>

      {stash && (stash.stash.items.length > 0 || walletCopper(stash.stash.wallet) > 0) && (
        <Section title="Party stash" note="shared by everyone">
          {stash.stash.items.length > 0 && (
            <ul className={styles.stashList}>
              {stash.stash.items.map((item) => (
                <li key={item.id}>
                  <span className={item.magic ? styles.magicItem : undefined}>
                    {item.quantity > 1 && `${item.quantity} × `}
                    {item.name}
                    {item.note && <span className={styles.muted}> · {item.note}</span>}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-label={`Take ${item.name}`}
                      onClick={() => void takeFromStash(item)}
                    >
                      Take
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {walletCopper(stash.stash.wallet) > 0 && (
            <p className={styles.inline}>
              <strong>{coinWords(stash.stash.wallet)}</strong>
              {canEdit && (
                <button type="button" className={styles.toggle} onClick={() => void splitStash()}>
                  Split the coins
                </button>
              )}
            </p>
          )}
        </Section>
      )}
    </div>
  )
}

/** Who to give it to, and how many of a stack. */
function HandOverRow({
  others,
  max,
  label,
  onGive,
}: {
  others: Character[]
  max: number
  label: string
  onGive: (to: Character, quantity: number) => void
}) {
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const friend = others.find((c) => c.id === to)
  return (
    <span className={styles.handOver} role="group" aria-label={`Give ${label}`}>
      <select value={to} aria-label="Give it to" onChange={(e) => setTo(e.target.value)}>
        {others.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {max > 1 && (
        <input
          type="number"
          min={1}
          max={max}
          value={quantity}
          aria-label="How many"
          onChange={(e) => setQuantity(Math.max(1, Math.min(max, Math.floor(Number(e.target.value) || 1))))}
        />
      )}
      <button
        type="button"
        className={styles.toggle}
        disabled={!friend}
        onClick={() => friend && onGive(friend, quantity)}
      >
        Hand over
      </button>
    </span>
  )
}

/** Give some coins of one kind to someone else. */
function CoinsOver({
  others,
  wallet,
  onGive,
}: {
  others: Character[]
  wallet: Wallet
  onGive: (to: Character, coins: Wallet) => void
}) {
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [coin, setCoin] = useState<keyof Wallet>('gp')
  const [count, setCount] = useState(1)
  const friend = others.find((c) => c.id === to)
  return (
    <div className={styles.handOver} role="group" aria-label="Give coins">
      <span className={styles.muted}>Give</span>
      <input
        type="number"
        min={1}
        max={wallet[coin]}
        value={count}
        aria-label="How many coins"
        onChange={(e) => setCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
      />
      <select value={coin} aria-label="Which coins" onChange={(e) => setCoin(e.target.value as keyof Wallet)}>
        {COINS.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name.toLowerCase()}
          </option>
        ))}
      </select>
      <span className={styles.muted}>to</span>
      <select value={to} aria-label="Give the coins to" onChange={(e) => setTo(e.target.value)}>
        {others.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.toggle}
        disabled={!friend || count > wallet[coin]}
        onClick={() => friend && onGive(friend, { ...EMPTY_WALLET, [coin]: count })}
      >
        Hand over
      </button>
    </div>
  )
}
