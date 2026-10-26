import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { TrackerPatch } from '../../live/characterRows.ts'
import { useSrd } from '../../live/useSrd.ts'
import { carryingCapacity } from '../../rules/build/body.ts'
import { findItem } from '../../rules/build/gear.ts'
import { itemName } from '../../rules/build/gearStep.ts'
import { entryId, type Character, type InventoryItem, type Wallet } from '../../rules/character.ts'
import { POTIONS, USABLE, wornArmourClass } from '../../rules/items.ts'
import { loadEquipment } from '../../rules/srd/index.ts'
import { Section } from './SheetTab.tsx'
import styles from './sheet.module.css'

type TabProps = { character: Character; canEdit: boolean; onUpdate: (patch: TrackerPatch) => void }

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
export function InventoryTab({ character, canEdit, onUpdate }: TabProps) {
  const equipment = useSrd(loadEquipment)
  const [adding, setAdding] = useState('')
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
                    <th scope="row">
                      {item.name}
                      {item.uses !== null && <span className={styles.muted}> ({item.uses} uses left)</span>}
                      {usable && <div className={styles.itemUse}>{usable.what}</div>}
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {weight > capacity && <p className={styles.warn}>That&rsquo;s more than you can carry.</p>}
        {canEdit && (
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
        <p className={styles.sectionNoteBlock}>
          10 copper make a silver, 10 silver a gold, 10 gold a platinum. Shops arrive later.
        </p>
      </Section>
    </div>
  )
}
