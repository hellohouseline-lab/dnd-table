import { useEffect, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { GivingControls } from '../../live/giving.ts'
import { weaponProficient } from '../../rules/build/gear.ts'
import { itemName } from '../../rules/build/gearStep.ts'
import type { Character } from '../../rules/character.ts'
import { giftItem, giftName, magicWords, needsBase, type Gift } from '../../rules/magic.ts'
import { armourWords, costWords, weaponWords } from '../../rules/manage.ts'
import { coinsFor, coinWords, readCoins, splitCoins, walletCopper } from '../../rules/money.ts'
import type { SrdEquipment, SrdItem, SrdMagicItem } from '../../rules/srd/index.ts'
import own from './GiveDialog.module.css'
import styles from './RestDialog.module.css'

type GiveDialogProps = {
  characters: Character[]
  /** Who to start with (from a Party card), or null. */
  only: string | null
  equipment: SrdEquipment
  magicItems: SrdMagicItem[]
  giving: GivingControls
  onClose: () => void
}

type Found = { key: string; name: string; words: string; gift: Gift }
type CoinWay = 'give' | 'split' | 'take'

const LIMIT = 24

/**
 * Give an item (the verb button, or Give on a Party card): find anything in the free rules (gear,
 * weapons, armour, magic items) or type something in, pick who gets it and press Give. A +1
 * weapon or armour asks which weapon or armour. The Coins side gives coins to one, shares them
 * across the party (odd coins to the party stash), or takes them.
 */
export function GiveDialog({ characters, only, equipment, magicItems, giving, onClose }: GiveDialogProps) {
  const [side, setSide] = useState<'items' | 'coins'>('items')
  const [who, setWho] = useState<string | null>(only ?? characters[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Found | null>(null)
  const [baseIndex, setBaseIndex] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [coinText, setCoinText] = useState('')
  const [way, setWay] = useState<CoinWay>('give')
  const [sharing, setSharing] = useState<string[]>(() => characters.map((c) => c.id))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const character = characters.find((c) => c.id === who) ?? null
  const query = search.trim().toLowerCase()
  const found: Found[] = query
    ? [
        ...magicItems
          .filter((m) => m.name.toLowerCase().includes(query))
          .map((m) => ({
            key: `m:${m.index}`,
            name: m.name,
            words: magicWords(m),
            gift: { kind: 'magic', magic: m, base: null } as Gift,
          })),
        ...equipment.items
          .filter((i) => i.kind !== 'mounts-and-vehicles' && itemName(i.name).toLowerCase().includes(query))
          .map((i) => ({
            key: `g:${i.index}`,
            name: itemName(i.name),
            words: gearWords(i),
            gift: { kind: 'gear', item: i } as Gift,
          })),
      ].slice(0, LIMIT)
    : []

  const baseKind = picked?.gift.kind === 'magic' ? needsBase(picked.gift.magic) : null
  const bases = baseKind
    ? equipment.items.filter((i) => (baseKind === 'weapon' ? i.kind === 'weapon' : i.kind === 'armor'))
    : []
  const base = bases.find((i) => i.index === baseIndex) ?? null
  const gift: Gift | null =
    picked && picked.gift.kind === 'magic' ? { ...picked.gift, base: baseKind ? base : null } : (picked?.gift ?? null)
  const ready = Boolean(character && gift && (!baseKind || base))

  async function run(task: () => Promise<string | null>, done: string) {
    setBusy(true)
    setStatus(null)
    const problem = await task()
    setBusy(false)
    setStatus(problem ? { ok: false, text: problem } : { ok: true, text: done })
    return problem === null
  }

  async function give(what: Gift) {
    if (!character) return
    const item = giftItem(what, quantity)
    const srd = item.item ? equipment.items.find((i) => i.index === item.item) : undefined
    const weapons: Record<string, boolean> =
      srd?.kind === 'weapon' ? { [srd.index]: weaponProficient(srd, character.otherProficiencies.split(/,\s*/)) } : {}
    const ok = await run(
      () => giving.give(character.id, [item], weapons, 0),
      `${character.name} got ${quantity > 1 ? `${quantity} × ` : ''}${item.name}.`,
    )
    if (ok) {
      setPicked(null)
      setSearch('')
      setQuantity(1)
      setBaseIndex('')
    }
  }

  const copper = readCoins(coinText)
  const share = copper && sharing.length > 0 ? splitCoins(copper, sharing.length) : null

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

  const whoPicker = (
    <fieldset className={styles.who}>
      <legend className={styles.legend}>{way === 'take' && side === 'coins' ? 'Take from' : 'Who gets it'}</legend>
      {characters.map((c) => (
        <label key={c.id} className={styles.person}>
          <input type="radio" name="give-who" checked={who === c.id} onChange={() => setWho(c.id)} />
          {c.name}
        </label>
      ))}
      {characters.length === 0 && <p className={styles.note}>Nobody has a character yet.</p>}
    </fieldset>
  )

  return (
    <div className={cx(styles.card, own.card)} role="dialog" aria-labelledby="give-title">
      <h2 id="give-title" className={styles.title}>
        Give
      </h2>
      <div className={own.sides} role="tablist" aria-label="Items or coins">
        {(['items', 'coins'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            className={cx(own.side, side === s && own.sideOn)}
            onClick={() => {
              setSide(s)
              setStatus(null)
            }}
          >
            {s === 'items' ? 'Items' : 'Coins'}
          </button>
        ))}
      </div>

      {side === 'items' ? (
        <>
          {whoPicker}
          <label className={own.field}>
            <span className={styles.legend}>What</span>
            <input
              value={search}
              autoFocus
              placeholder="Potion, longsword, cloak, +1…"
              onChange={(e) => {
                setSearch(e.target.value)
                setPicked(null)
              }}
            />
          </label>
          {picked ? (
            <div className={own.picked}>
              <span className={own.name}>{gift ? giftName(gift) : picked.name}</span>
              <span className={own.words}>{picked.words}</span>
              {baseKind && (
                <label className={own.field}>
                  <span className={styles.legend}>{baseKind === 'weapon' ? 'Which weapon' : 'Which armour'}</span>
                  <select value={baseIndex} onChange={(e) => setBaseIndex(e.target.value)}>
                    <option value="">Pick one</option>
                    {bases.map((b) => (
                      <option key={b.index} value={b.index}>
                        {itemName(b.name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className={own.link} onClick={() => setPicked(null)}>
                Pick something else
              </button>
            </div>
          ) : (
            query && (
              <ul className={own.results} aria-label="Things to give">
                {found.map((f) => (
                  <li key={f.key}>
                    <button type="button" className={own.result} onClick={() => setPicked(f)}>
                      <span className={own.name}>{f.name}</span>
                      <span className={own.words}>{f.words}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className={own.result}
                    onClick={() =>
                      setPicked({
                        key: 'typed',
                        name: search.trim(),
                        words: 'Your own',
                        gift: { kind: 'typed', name: search },
                      })
                    }
                  >
                    <span className={own.name}>&ldquo;{search.trim()}&rdquo;</span>
                    <span className={own.words}>Something of your own, by that name</span>
                  </button>
                </li>
              </ul>
            )
          )}
          <label className={own.field}>
            <span className={styles.legend}>How many</span>
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              className={own.small}
              onChange={(e) => setQuantity(Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))))}
            />
          </label>
          <Status status={status} />
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Done
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={!ready || busy}
              onClick={() => gift && void give(gift)}
            >
              {character && gift ? `Give to ${character.name}` : 'Give'}
            </button>
          </div>
        </>
      ) : (
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
          {way === 'split' ? (
            <fieldset className={styles.who}>
              <legend className={styles.legend}>Who shares it</legend>
              {characters.map((c) => (
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
              ))}
            </fieldset>
          ) : (
            whoPicker
          )}
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
      )}
    </div>
  )
}

function Status({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null
  return (
    <p className={status.ok ? own.ok : own.problem} role="status">
      {status.text}
    </p>
  )
}

function gearWords(item: SrdItem): string {
  if (item.kind === 'weapon') return weaponWords(item.index)
  if (item.armour) return armourWords(item)
  return [item.sub, item.cost ? costWords(item.cost) : null].filter(Boolean).join(' · ')
}
