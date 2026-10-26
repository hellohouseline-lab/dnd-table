import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { carryingCapacity } from '../../rules/build/body.ts'
import { findItem, weaponProficient } from '../../rules/build/gear.ts'
import { itemName } from '../../rules/build/gearStep.ts'
import type { CharacterBuild, InventoryItem, Wallet } from '../../rules/character.ts'
import { POTIONS, USABLE, wornArmourClass } from '../../rules/items.ts'
import {
  addToInventory,
  armourTrained,
  armourWords,
  costWords,
  syncAttacks,
  toggleWorn,
  weaponWords,
} from '../../rules/manage.ts'
import type { SrdEquipment, SrdItem } from '../../rules/srd/index.ts'
import styles from '../builder/Builder.module.css'
import own from './Manage.module.css'

type ManageGearProps = {
  build: CharacterBuild
  onBuild: (build: CharacterBuild) => void
  equipment: SrdEquipment
  /** The DM can stop players adding gear for free (then it comes from shops and the DM). */
  canAdd?: boolean
}

type Shelf = 'weapons' | 'armour' | 'gear' | 'tools' | 'potions'

const SHELVES: { key: Shelf; name: string }[] = [
  { key: 'weapons', name: 'Weapons' },
  { key: 'armour', name: 'Armour' },
  { key: 'gear', name: 'Gear' },
  { key: 'tools', name: 'Kits and tools' },
  { key: 'potions', name: 'Potions' },
]

const KIND: Record<Exclude<Shelf, 'potions'>, string> = {
  weapons: 'weapon',
  armour: 'armor',
  gear: 'adventuring-gear',
  tools: 'tools',
}

const COINS: { key: keyof Wallet; name: string }[] = [
  { key: 'pp', name: 'Platinum' },
  { key: 'gp', name: 'Gold' },
  { key: 'ep', name: 'Electrum' },
  { key: 'sp', name: 'Silver' },
  { key: 'cp', name: 'Copper' },
]

type Card = { index: string; name: string; weight: number; cost: number | null; srd: SrdItem | null }

/**
 * Gear, the builder's way: everything in the free rules on shelves (weapons, armour, gear, kits
 * and potions), each with what it does in plain words and whether you're trained with it. Adding a
 * weapon puts it in your hand of cards; wearing armour sets your AC. Adding is free here: buying
 * in a shop comes later, so take the coins off below if you paid.
 */
export function ManageGear({ build, onBuild, equipment, canAdd = true }: ManageGearProps) {
  const [shelf, setShelf] = useState<Shelf>('weapons')
  const [search, setSearch] = useState('')
  const { inventory, wallet } = build
  const weight = inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
  const capacity = carryingCapacity(build.scores.strength)
  const profs = build.otherProficiencies

  function save(next: InventoryItem[]) {
    const ac = wornArmourClass(build, next, equipment)
    onBuild({
      ...build,
      inventory: next,
      attacks: syncAttacks(build.attacks, next, equipment, profs),
      armourClass: ac ?? build.armourClass,
    })
  }

  const query = search.trim().toLowerCase()
  const cards: Card[] = (
    shelf === 'potions'
      ? POTIONS.map((p) => ({ index: p.index, name: p.name, weight: p.weight, cost: null, srd: null }))
      : equipment.items
          .filter((i) => i.kind === KIND[shelf])
          .map((i) => ({ index: i.index, name: itemName(i.name), weight: i.weight, cost: i.cost, srd: i }))
  ).filter((c) => !query || c.name.toLowerCase().includes(query))

  function words(card: Card): string {
    if (card.srd?.kind === 'weapon') return weaponWords(card.index)
    if (card.srd?.armour) return armourWords(card.srd)
    if (card.srd?.contents) {
      return `Holds ${card.srd.contents
        .map(
          (c) =>
            `${c.quantity > 1 ? `${c.quantity} ` : ''}${itemName(findItem(equipment, c.item)?.name ?? c.item).toLowerCase()}`,
        )
        .join(', ')}`
    }
    return USABLE[card.index]?.what ?? card.srd?.sub ?? ''
  }

  function training(card: Card): { text: string; good: boolean } | null {
    if (card.srd?.kind === 'weapon') {
      return weaponProficient(card.srd, profs.split(/,\s*/))
        ? { text: 'You’re trained with it', good: true }
        : { text: 'Not trained: no training bonus to hit', good: false }
    }
    if (card.srd?.armour) {
      return armourTrained(card.srd, profs)
        ? { text: 'You’re trained to wear it', good: true }
        : {
            text: 'Not trained: you can’t cast spells in it, and attacks and Strength or Dexterity rolls are at disadvantage',
            good: false,
          }
    }
    return null
  }

  const carried = (index: string) => inventory.find((i) => i.item === index)?.quantity ?? 0

  return (
    <div className={own.gearColumns}>
      <div className={styles.step}>
        <div className={styles.detail}>
          <div className={styles.optionRow} role="tablist" aria-label="Shelves">
            {SHELVES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={shelf === s.key}
                className={cx(styles.chip, shelf === s.key && styles.picked)}
                onClick={() => setShelf(s.key)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Look for something</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rope, longbow, chain mail…"
            />
          </label>
          <p className={styles.note}>
            {canAdd
              ? 'Adding something here doesn\u2019t spend your coins. If you bought it, take the cost off your coins.'
              : 'Your DM adds things for now: buy them in a shop when one is open. You can still see what everything does.'}
          </p>
        </div>

        <ul className={own.cardGrid}>
          {cards.map((card) => {
            const train = training(card)
            const count = carried(card.index)
            return (
              <li key={card.index} className={cx(styles.option, own.card, count > 0 && styles.picked)}>
                <span className={styles.optionName}>{card.name}</span>
                <span className={styles.spellMeta}>
                  {[card.cost !== null ? costWords(card.cost) : null, card.weight ? `${card.weight} lb` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={styles.optionLine}>{words(card)}</span>
                {train && <span className={train.good ? own.good : own.bad}>{train.text}</span>}
                <span className={own.cardActions}>
                  {canAdd && (
                    <button
                      type="button"
                      className={own.cardButton}
                      aria-label={`Add ${card.name}`}
                      onClick={() => save(addToInventory(inventory, card, equipment))}
                    >
                      Add
                    </button>
                  )}
                  {count > 0 && <span className={own.tag}>You carry {count}</span>}
                </span>
              </li>
            )
          })}
          {cards.length === 0 && <li className={styles.note}>Nothing on this shelf by that name.</li>}
        </ul>
      </div>

      <aside className={styles.detail} aria-label="What you carry">
        <h3 className={styles.choiceTitle}>What you carry</h3>
        <p className={styles.plays}>
          <strong>AC {build.armourClass}</strong> · {weight} of {capacity} lb
        </p>
        {inventory.length === 0 ? (
          <p className={styles.note}>Nothing yet. Add something from the shelves.</p>
        ) : (
          <ul className={own.carryList}>
            {inventory.map((i) => {
              const srd = i.item ? findItem(equipment, i.item) : undefined
              return (
                <li key={i.id}>
                  <span className={own.carryName}>
                    {i.name}
                    {i.worn && <span className={styles.wornTag}>worn</span>}
                  </span>
                  <span className={own.carryButtons}>
                    {srd?.armour && (
                      <button
                        type="button"
                        className={own.cardLink}
                        onClick={() => save(toggleWorn(inventory, i.id, equipment))}
                      >
                        {i.worn ? 'Take off' : 'Wear'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={own.step}
                      aria-label={`One fewer ${i.name}`}
                      onClick={() =>
                        save(
                          i.quantity <= 1
                            ? inventory.filter((x) => x.id !== i.id)
                            : inventory.map((x) => (x.id === i.id ? { ...x, quantity: x.quantity - 1 } : x)),
                        )
                      }
                    >
                      −
                    </button>
                    <span className={own.count}>{i.quantity}</span>
                    <button
                      type="button"
                      className={own.step}
                      aria-label={`One more ${i.name}`}
                      onClick={() =>
                        save(inventory.map((x) => (x.id === i.id ? { ...x, quantity: x.quantity + 1 } : x)))
                      }
                    >
                      +
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className={styles.choiceTitle}>Coins</h3>
        <div className={own.coins}>
          {COINS.map((coin) => (
            <label key={coin.key} className={styles.smallField}>
              <span className={styles.fieldLabel}>{coin.name}</span>
              <input
                type="number"
                min={0}
                value={wallet[coin.key]}
                onChange={(e) =>
                  onBuild({
                    ...build,
                    wallet: { ...wallet, [coin.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) },
                  })
                }
              />
            </label>
          ))}
        </div>
      </aside>
    </div>
  )
}
