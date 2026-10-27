import { useState } from 'react'
import { cx } from '../../../components/cx.ts'
import type { GivingControls } from '../../../live/giving.ts'
import { weaponProficient } from '../../../rules/build/gear.ts'
import { itemName } from '../../../rules/build/gearStep.ts'
import {
  filterCatalogue,
  RARITIES,
  SOURCES,
  TYPE_TAGS,
  type CatalogueFilter,
  type Entry,
} from '../../../rules/catalogue.ts'
import type { Character } from '../../../rules/character.ts'
import { giftItem, giftName, needsBase, type Gift } from '../../../rules/magic.ts'
import type { SrdEquipment, SrdMagicItem } from '../../../rules/srd/index.ts'
import { entryValue, valueWords } from '../../../rules/value.ts'
import own from '../GiveDialog.module.css'
import styles from '../RestDialog.module.css'
import { Status, type StatusLine } from './Status.tsx'

type GiveThingsProps = {
  characters: Character[]
  who: string | null
  onWho: (id: string) => void
  catalogue: Entry[]
  /** Card keys ticked to start with. */
  startTicked?: string[]
  equipment: SrdEquipment
  magicItems: SrdMagicItem[]
  giving: GivingControls
  /** A key item was given: fill in who has it in the notebook. */
  onKeyItem: (name: string, holder: string) => void
  onMake: () => void
  onClose: () => void
}

type Ticked = { entry: Entry; quantity: number; base: string }

const SHOWN = 150

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/**
 * The Give browser: every item as a card, narrowed with tags (where from, rarity, type) and words.
 * Tick as many as you like, say how many and who, and give them all at once. A +1 weapon or armour
 * asks which weapon or armour in the list of ticked things.
 */
export function GiveThings({
  characters,
  who,
  onWho,
  catalogue,
  startTicked = [],
  equipment,
  magicItems,
  giving,
  onKeyItem,
  onMake,
  onClose,
}: GiveThingsProps) {
  const [filter, setFilter] = useState<CatalogueFilter>({ sources: [], rarities: [], types: [], search: '' })
  const [ticked, setTicked] = useState<Ticked[]>(() =>
    catalogue.filter((e) => startTicked.includes(e.key)).map((entry) => ({ entry, quantity: 1, base: '' })),
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusLine | null>(null)
  const character = characters.find((c) => c.id === who) ?? null
  const shown = filterCatalogue(catalogue, filter)
  const isTicked = (key: string) => ticked.some((t) => t.entry.key === key)
  const typed = filter.search.trim()

  const baseOf = (t: Ticked) => {
    const kind = t.entry.gift.kind === 'magic' ? needsBase(t.entry.gift.magic) : null
    return { kind, item: kind ? (equipment.items.find((i) => i.index === t.base) ?? null) : null }
  }
  const giftOf = (t: Ticked): Gift =>
    t.entry.gift.kind === 'magic' ? { ...t.entry.gift, base: baseOf(t).item } : t.entry.gift
  const missingBase = ticked.some((t) => baseOf(t).kind && !baseOf(t).item)

  function tick(entry: Entry) {
    setStatus(null)
    setTicked((now) =>
      now.some((t) => t.entry.key === entry.key)
        ? now.filter((t) => t.entry.key !== entry.key)
        : [...now, { entry, quantity: 1, base: '' }],
    )
  }

  async function give() {
    if (!character || ticked.length === 0) return
    const items = ticked.map((t) => giftItem(giftOf(t), t.quantity))
    const weapons: Record<string, boolean> = {}
    for (const item of items) {
      const srd = item.item ? equipment.items.find((i) => i.index === item.item) : undefined
      if (srd?.kind === 'weapon') weapons[srd.index] = weaponProficient(srd, character.otherProficiencies.split(/,\s*/))
    }
    setBusy(true)
    setStatus(null)
    const problem = await giving.give(character.id, items, weapons, 0)
    setBusy(false)
    if (problem) {
      setStatus({ ok: false, text: problem })
      return
    }
    for (const t of ticked) {
      if (t.entry.gift.kind === 'yours' && t.entry.gift.item.key) onKeyItem(t.entry.gift.item.name, character.name)
    }
    setStatus({
      ok: true,
      text: `${character.name} got ${items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(', ')}.`,
    })
    setTicked([])
  }

  return (
    <div className={own.browser}>
      <div className={own.filters}>
        <input
          className={own.search}
          value={filter.search}
          placeholder="Look for something: rope, cloak, healing…"
          aria-label="Look for something"
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />
        <TagRow
          label="Where from"
          tags={SOURCES}
          on={filter.sources}
          onToggle={(key) => setFilter({ ...filter, sources: toggle(filter.sources, key) })}
        />
        <TagRow
          label="Rarity"
          tags={RARITIES}
          on={filter.rarities}
          onToggle={(key) => setFilter({ ...filter, rarities: toggle(filter.rarities, key) })}
        />
        <TagRow
          label="Type"
          tags={TYPE_TAGS}
          on={filter.types}
          onToggle={(key) => setFilter({ ...filter, types: toggle(filter.types, key) })}
        />
        <p className={styles.note}>
          {shown.length} {shown.length === 1 ? 'thing' : 'things'}
          {shown.length > SHOWN && `, showing the first ${SHOWN}: add a tag to narrow it down`}.{' '}
          {(filter.sources.length > 0 || filter.rarities.length > 0 || filter.types.length > 0 || filter.search) && (
            <button
              type="button"
              className={own.link}
              onClick={() => setFilter({ sources: [], rarities: [], types: [], search: '' })}
            >
              Clear the tags
            </button>
          )}{' '}
          <button type="button" className={own.link} onClick={onMake}>
            Make your own item
          </button>
        </p>
      </div>

      <ul className={own.grid} aria-label="Things to give">
        {shown.slice(0, SHOWN).map((entry) => {
          const on = isTicked(entry.key)
          return (
            <li key={entry.key} className={cx(own.item, on && own.itemOn)}>
              <span className={own.name}>{entry.name}</span>
              <span className={own.words}>{entry.line}</span>
              {entry.source !== 'gear' && valueWords(entryValue(entry.gift, equipment, magicItems)) && (
                <span className={own.worth}>Worth {valueWords(entryValue(entry.gift, equipment, magicItems))}</span>
              )}
              {entry.desc && (
                <details className={own.more}>
                  <summary>All of it</summary>
                  <p>{entry.desc}</p>
                </details>
              )}
              <button
                type="button"
                className={own.tick}
                aria-pressed={on}
                aria-label={`${on ? 'Untick' : 'Tick'} ${entry.name}`}
                onClick={() => tick(entry)}
              >
                {on ? 'Ticked' : 'Tick'}
              </button>
            </li>
          )
        })}
        {typed && (
          <li className={own.item}>
            <span className={own.name}>&ldquo;{typed}&rdquo;</span>
            <span className={own.words}>Something of your own, with just a name</span>
            <button
              type="button"
              className={own.tick}
              onClick={() =>
                tick({
                  key: `typed:${typed}`,
                  name: typed,
                  line: '',
                  desc: '',
                  source: 'yours',
                  rarity: null,
                  type: 'other',
                  gift: { kind: 'typed', name: typed },
                })
              }
            >
              Tick
            </button>
          </li>
        )}
      </ul>

      <div className={own.tray} aria-label="Ticked to give">
        {ticked.length === 0 ? (
          <p className={styles.note}>Tick things above to give them.</p>
        ) : (
          <ul className={own.tickedList}>
            {ticked.map((t) => {
              const base = baseOf(t)
              return (
                <li key={t.entry.key}>
                  <span className={own.tickedName}>{giftName(giftOf(t))}</span>
                  {base.kind && (
                    <select
                      value={t.base}
                      aria-label={
                        base.kind === 'weapon' ? `Which weapon for ${t.entry.name}` : `Which armour for ${t.entry.name}`
                      }
                      onChange={(e) =>
                        setTicked((now) =>
                          now.map((x) => (x.entry.key === t.entry.key ? { ...x, base: e.target.value } : x)),
                        )
                      }
                    >
                      <option value="">{base.kind === 'weapon' ? 'Which weapon?' : 'Which armour?'}</option>
                      {equipment.items
                        .filter((i) => (base.kind === 'weapon' ? i.kind === 'weapon' : i.kind === 'armor'))
                        .map((i) => (
                          <option key={i.index} value={i.index}>
                            {itemName(i.name)}
                          </option>
                        ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={t.quantity}
                    aria-label={`How many ${t.entry.name}`}
                    onChange={(e) =>
                      setTicked((now) =>
                        now.map((x) =>
                          x.entry.key === t.entry.key
                            ? { ...x, quantity: Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))) }
                            : x,
                        ),
                      )
                    }
                  />
                  <button type="button" className={own.link} onClick={() => tick(t.entry)}>
                    Take off
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className={own.trayFoot}>
          <span className={styles.legend}>To</span>
          <div className={own.whoRow} role="radiogroup" aria-label="Who gets it">
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={who === c.id}
                className={cx(own.side, who === c.id && own.sideOn)}
                onClick={() => onWho(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <span className={own.grow} />
          <Status status={status} />
          <button type="button" className={styles.secondary} onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!character || ticked.length === 0 || missingBase || busy}
            onClick={() => void give()}
          >
            {character && ticked.length > 0
              ? `Give ${ticked.length === 1 ? 'it' : `all ${ticked.length}`} to ${character.name}`
              : 'Give'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TagRow<K extends string>({
  label,
  tags,
  on,
  onToggle,
}: {
  label: string
  tags: { key: K; name: string }[]
  on: K[]
  onToggle: (key: K) => void
}) {
  return (
    <div className={own.tagRow} role="group" aria-label={label}>
      <span className={own.tagLabel}>{label}</span>
      {tags.map((tag) => (
        <button
          key={tag.key}
          type="button"
          className={cx(own.tag, on.includes(tag.key) && own.tagOn)}
          aria-pressed={on.includes(tag.key)}
          onClick={() => onToggle(tag.key)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
