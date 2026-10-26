import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../../components/cx.ts'
import type { GivingControls } from '../../../live/giving.ts'
import { BITS } from '../../../rules/bits.ts'
import {
  CONTAINERS,
  DEFAULT_BOXES,
  openBox,
  partyLevel,
  rarityCap,
  rerollFind,
  RICHNESS,
  SEARCH_ROLLS,
  type BoxAsk,
  type BoxContents,
  type BoxSettings,
  type Richness,
} from '../../../rules/boxes.ts'
import { weaponProficient } from '../../../rules/build/gear.ts'
import { buildCatalogue, RARITIES } from '../../../rules/catalogue.ts'
import { entryId, type Character } from '../../../rules/character.ts'
import { giftItem } from '../../../rules/magic.ts'
import { coinWords, readCoins, walletCopper } from '../../../rules/money.ts'
import { entryValue, valueWords } from '../../../rules/value.ts'
import type { SrdEquipment, SrdMagicItem } from '../../../rules/srd/index.ts'
import own from '../GiveDialog.module.css'
import styles from '../RestDialog.module.css'
import box from './BoxDialog.module.css'
import { Status, type StatusLine } from './Status.tsx'

type BoxDialogProps = {
  characters: Character[]
  equipment: SrdEquipment
  magicItems: SrdMagicItem[]
  giving: GivingControls
  /** How full boxes are: the DM's own numbers (saved in the notebook), or ours. */
  settings: BoxSettings
  onSettings: (settings: BoxSettings) => void
  onKeyItem: (name: string, holder: string) => void
  onClose: () => void
}

const PARTS = [
  { key: 'bits', name: 'Bits and bobs' },
  { key: 'gear', name: 'Gear' },
  { key: 'gold', name: 'Gold' },
  { key: 'magic', name: 'Magic items' },
] as const

/**
 * Open a box (I1b): pick the container, how rich it is and the search roll if there was one, and
 * the table fills it from bits and bobs, gear, coins and magic items that suit the party's level.
 * Roll any find again, take it out or add something, change the coins, then give it all to one
 * person or put it on the table for the party.
 */
export function BoxDialog({
  characters,
  equipment,
  magicItems,
  giving,
  settings,
  onSettings,
  onKeyItem,
  onClose,
}: BoxDialogProps) {
  const [ask, setAsk] = useState<BoxAsk>(() => ({
    container: 'chest',
    richness: 'ordinary',
    level: partyLevel(characters.map((c) => c.level)),
    search: 'none',
  }))
  const [contents, setContents] = useState<BoxContents | null>(null)
  const [coinText, setCoinText] = useState('')
  const [adding, setAdding] = useState('')
  const [who, setWho] = useState<string | null>(characters[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusLine | null>(null)
  const [tuning, setTuning] = useState(false)
  const entries = useMemo(
    () => buildCatalogue({ magic: magicItems, equipment, bits: BITS, yours: giving.yours }),
    [magicItems, equipment, giving.yours],
  )

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  function open() {
    const opened = openBox(entries, ask, settings)
    setContents(opened)
    setCoinText(walletCopper(opened.coins) > 0 ? coinWords(opened.coins) : '')
    setStatus(null)
  }

  const copper = coinText.trim() ? readCoins(coinText) : 0
  const character = characters.find((c) => c.id === who) ?? null
  const matches = adding.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(adding.trim().toLowerCase())).slice(0, 8)
    : []

  async function hand(to: 'one' | 'table') {
    if (!contents || copper === null) return
    const items = contents.finds.map((f) => giftItem(f.entry.gift, f.quantity))
    setBusy(true)
    setStatus(null)
    let problem: string | null
    if (to === 'table') {
      problem = await giving.putOnTable(items, copper)
    } else {
      if (!character) return
      const weapons: Record<string, boolean> = {}
      for (const item of items) {
        const srd = item.item ? equipment.items.find((i) => i.index === item.item) : undefined
        if (srd?.kind === 'weapon')
          weapons[srd.index] = weaponProficient(srd, character.otherProficiencies.split(/,\s*/))
      }
      problem = await giving.give(character.id, items, weapons, copper)
    }
    setBusy(false)
    if (problem) {
      setStatus({ ok: false, text: problem })
      return
    }
    for (const f of contents.finds) {
      if (f.entry.gift.kind === 'yours' && f.entry.gift.item.key) {
        onKeyItem(f.entry.gift.item.name, to === 'table' ? 'On the table' : (character?.name ?? ''))
      }
    }
    setStatus({
      ok: true,
      text: to === 'table' ? 'It’s on the table for the party.' : `${character?.name} has it all.`,
    })
    setContents(null)
  }

  const setPart = (richness: Richness, part: (typeof PARTS)[number]['key'], end: 0 | 1, value: number) => {
    const span = [...settings[richness][part]] as [number, number]
    span[end] = Math.max(0, Math.min(part === 'gold' ? 10000 : 20, value))
    onSettings({ ...settings, [richness]: { ...settings[richness], [part]: span } })
  }

  return (
    <div className={cx(styles.card, own.card)} role="dialog" aria-labelledby="box-title">
      <div className={own.head}>
        <h2 id="box-title" className={styles.title}>
          Open a box
        </h2>
        {contents && (
          <button type="button" className={own.link} onClick={() => setContents(null)}>
            A different box
          </button>
        )}
      </div>

      {!contents ? (
        <div className={box.setup}>
          <Choice
            label="What is it"
            options={CONTAINERS}
            value={ask.container}
            onPick={(container) => setAsk({ ...ask, container })}
          />
          <Choice
            label="How rich"
            options={RICHNESS}
            value={ask.richness}
            onPick={(richness) => setAsk({ ...ask, richness })}
          />
          <Choice
            label="Their search roll"
            options={SEARCH_ROLLS}
            value={ask.search}
            onPick={(search) => setAsk({ ...ask, search })}
          />
          <label className={box.level}>
            <span className={styles.legend}>Party level</span>
            <input
              type="number"
              min={1}
              max={20}
              value={ask.level}
              onChange={(e) =>
                setAsk({ ...ask, level: Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))) })
              }
            />
            <span className={styles.note}>
              Magic items up to {RARITIES.find((r) => r.key === rarityCap(ask.level))?.name.toLowerCase()}.
            </span>
          </label>

          <details className={box.tune} open={tuning} onToggle={(e) => setTuning(e.currentTarget.open)}>
            <summary>How full boxes are</summary>
            <table className={box.table}>
              <thead>
                <tr>
                  <th />
                  {PARTS.map((p) => (
                    <th key={p.key}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RICHNESS.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.name}</th>
                    {PARTS.map((p) => (
                      <td key={p.key}>
                        {[0, 1].map((end) => (
                          <input
                            key={end}
                            type="number"
                            min={0}
                            step={p.key === 'gold' ? 1 : 1}
                            aria-label={`${r.name}: ${p.name}, ${end === 0 ? 'fewest' : 'most'}`}
                            value={settings[r.key][p.key][end]}
                            onChange={(e) => setPart(r.key, p.key, end as 0 | 1, Number(e.target.value) || 0)}
                          />
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>
              Fewest and most of each. Gold is in gold pieces. A hoard holds more gold and magic, a sack less.{' '}
              <button type="button" className={own.link} onClick={() => onSettings(DEFAULT_BOXES)}>
                Back to ours
              </button>
            </p>
          </details>

          <Status status={status} />
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Done
            </button>
            <button type="button" className={styles.primary} onClick={open}>
              Open it
            </button>
          </div>
        </div>
      ) : (
        <div className={own.browser}>
          <ul className={own.grid} aria-label="In the box">
            {contents.finds.map((f) => (
              <li key={f.id} className={own.item}>
                <span className={own.name}>
                  {f.quantity > 1 && `${f.quantity} × `}
                  {f.entry.name}
                </span>
                <span className={own.words}>{f.entry.line}</span>
                {valueWords(entryValue(f.entry.gift, equipment, magicItems), f.quantity) && (
                  <span className={own.worth}>
                    Worth {valueWords(entryValue(f.entry.gift, equipment, magicItems), f.quantity)}
                  </span>
                )}
                {f.entry.desc && (
                  <details className={own.more}>
                    <summary>All of it</summary>
                    <p>{f.entry.desc}</p>
                  </details>
                )}
                <span className={box.findButtons}>
                  <button
                    type="button"
                    className={own.tick}
                    aria-label={`Roll again for ${f.entry.name}`}
                    onClick={() =>
                      setContents({
                        ...contents,
                        finds: contents.finds.map((x) => (x.id === f.id ? rerollFind(entries, ask, f) : x)),
                      })
                    }
                  >
                    Roll again
                  </button>
                  <button
                    type="button"
                    className={own.link}
                    aria-label={`Take out ${f.entry.name}`}
                    onClick={() => setContents({ ...contents, finds: contents.finds.filter((x) => x.id !== f.id) })}
                  >
                    Take out
                  </button>
                </span>
              </li>
            ))}
            {contents.finds.length === 0 && <li className={styles.note}>Nothing but dust.</li>}
          </ul>

          <div className={box.extras}>
            <label className={own.field}>
              <span className={styles.legend}>Coins</span>
              <input
                value={coinText}
                placeholder="None"
                aria-label="Coins in the box"
                aria-invalid={copper === null}
                onChange={(e) => setCoinText(e.target.value)}
              />
            </label>
            <div className={own.field}>
              <span className={styles.legend}>Add something</span>
              <input
                className={own.search}
                value={adding}
                placeholder="A key item of yours, a rope, a potion…"
                aria-label="Add something to the box"
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
                          setContents({
                            ...contents,
                            finds: [...contents.finds, { id: entryId(), entry: m, quantity: 1 }],
                          })
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
          {copper === null && <p className={own.problem}>Type coins such as 12 gp 5 sp, or a number of gold pieces.</p>}

          <div className={own.trayFoot}>
            <div className={own.whoRow} role="radiogroup" aria-label="Who gets it">
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={who === c.id}
                  className={cx(own.side, who === c.id && own.sideOn)}
                  onClick={() => setWho(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <span className={own.grow} />
            <Status status={status} />
            <button type="button" className={styles.secondary} onClick={open}>
              Open it again
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy || copper === null}
              onClick={() => void hand('table')}
            >
              Put it on the table
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !character || copper === null}
              onClick={() => void hand('one')}
            >
              {character ? `Give it all to ${character.name}` : 'Give'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Choice<K extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: { key: K; name: string; line: string }[]
  value: K
  onPick: (key: K) => void
}) {
  return (
    <div className={box.choice} role="radiogroup" aria-label={label}>
      <span className={styles.legend}>{label}</span>
      <div className={box.options}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            className={cx(box.option, value === o.key && box.optionOn)}
            onClick={() => onPick(o.key)}
          >
            <span className={own.name}>{o.name}</span>
            <span className={own.words}>{o.line}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
