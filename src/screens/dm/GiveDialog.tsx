import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../components/cx.ts'
import type { GivingControls } from '../../live/giving.ts'
import { BITS } from '../../rules/bits.ts'
import { buildCatalogue } from '../../rules/catalogue.ts'
import type { Character } from '../../rules/character.ts'
import type { SrdEquipment, SrdMagicItem } from '../../rules/srd/index.ts'
import { GiveCoins } from './give/GiveCoins.tsx'
import { GiveThings } from './give/GiveThings.tsx'
import { YourItems } from './give/YourItems.tsx'
import own from './GiveDialog.module.css'
import styles from './RestDialog.module.css'

type GiveDialogProps = {
  characters: Character[]
  /** Who to start with (from a Party card), or null. */
  only: string | null
  equipment: SrdEquipment
  magicItems: SrdMagicItem[]
  giving: GivingControls
  /** A key item was given: fill in who has it in the notebook. */
  onKeyItem: (name: string, holder: string) => void
  onClose: () => void
}

type Side = 'things' | 'coins' | 'make'

/**
 * Give (the verb button, or Give on a Party card): things to browse and tick, coins to give, share
 * or take, and your own items to make.
 */
export function GiveDialog({ characters, only, equipment, magicItems, giving, onKeyItem, onClose }: GiveDialogProps) {
  const [side, setSide] = useState<Side>('things')
  const [who, setWho] = useState<string | null>(only ?? characters[0]?.id ?? null)
  const catalogue = useMemo(
    () => buildCatalogue({ magic: magicItems, equipment, bits: BITS, yours: giving.yours }),
    [magicItems, equipment, giving.yours],
  )

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className={cx(styles.card, own.card)} role="dialog" aria-labelledby="give-title">
      <div className={own.head}>
        <h2 id="give-title" className={styles.title}>
          Give
        </h2>
        <div className={own.sides} role="tablist" aria-label="Things, coins or your own items">
          {(
            [
              ['things', 'Things'],
              ['coins', 'Coins'],
              ['make', 'Make your own'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={side === key}
              className={cx(own.side, side === key && own.sideOn)}
              onClick={() => setSide(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {side === 'things' ? (
        <GiveThings
          characters={characters}
          who={who}
          onWho={setWho}
          catalogue={catalogue}
          equipment={equipment}
          magicItems={magicItems}
          giving={giving}
          onKeyItem={onKeyItem}
          onMake={() => setSide('make')}
          onClose={onClose}
        />
      ) : side === 'coins' ? (
        <GiveCoins characters={characters} who={who} onWho={setWho} giving={giving} onClose={onClose} />
      ) : (
        <YourItems giving={giving} onDone={() => setSide('things')} />
      )}
    </div>
  )
}
