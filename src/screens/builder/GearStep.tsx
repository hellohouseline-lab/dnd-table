import { cx } from '../../components/cx.ts'
import type { BuilderDraft } from '../../rules/build/draft.ts'
import type { GearPick } from '../../rules/build/gear.ts'
import { findItem, coinText } from '../../rules/build/gear.ts'
import { categoryWords, itemName, optionWords, type GearSummary } from '../../rules/build/gearStep.ts'
import type { GearChoice, SrdBackground, SrdClass, SrdEquipment } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'

type GearStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  cls: SrdClass
  background: SrdBackground | null
  equipment: SrdEquipment
  summary: GearSummary
}

/** "(a) chain mail or (b) leather armor…" without the letters, for a heading. */
const choiceTitle = (choice: GearChoice, i: number) =>
  choice.desc ? choice.desc.replace(/\([a-c]\)\s*/g, '').replace(/^./, (c) => c.toUpperCase()) : `Choice ${i + 1}`

/**
 * Step 6: what you carry. Each of the class's starting choices as cards (with a pick from the list
 * where it says "a martial weapon"), then the background's kit, then everything together: armour
 * worn and the AC it gives, weapons ready as attacks, the weight and the coins.
 */
export function GearStep({ draft, onDraft, cls, background, equipment, summary }: GearStepProps) {
  function choices(list: GearChoice[], picks: (GearPick | null)[], key: 'gearPicks' | 'backgroundGearPicks') {
    const set = (i: number, pick: GearPick) => {
      const next = [...picks]
      next[i] = pick
      onDraft({ ...draft, [key]: next })
    }
    return list.map((choice, i) => {
      const pick = picks[i] ?? null
      return (
        <div key={`${key}-${i}`} className={styles.choice}>
          <h3 className={styles.choiceTitle}>{choiceTitle(choice, i)}</h3>
          <div className={styles.ancestryGrid}>
            {choice.options.map((option, o) => {
              const on = pick?.option === o
              let category = 0
              return (
                <div key={o} className={cx(styles.option, styles.gearOption, on && styles.picked)}>
                  <button
                    type="button"
                    className={styles.gearPick}
                    aria-pressed={on}
                    onClick={() => !on && set(i, { option: o, picks: [] })}
                  >
                    <span className={styles.optionName}>{optionWords(option, equipment)}</span>
                    {option.map((part) => {
                      if (!('item' in part)) return null
                      const item = findItem(equipment, part.item)
                      return item?.contents ? (
                        <span key={part.item} className={styles.optionLine}>
                          Holds:{' '}
                          {item.contents
                            .map(
                              (c) =>
                                `${itemName(findItem(equipment, c.item)?.name ?? c.item)}${c.quantity > 1 ? ` (${c.quantity})` : ''}`,
                            )
                            .join(', ')}
                        </span>
                      ) : null
                    })}
                  </button>
                  {on &&
                    option.map((part) => {
                      if (!('category' in part)) return null
                      const slot = category++
                      const items = (equipment.categories[part.category] ?? [])
                        .map((index) => findItem(equipment, index))
                        .filter((item) => item !== undefined)
                      const chosen = pick?.picks[slot] ?? []
                      return Array.from({ length: part.choose }, (_, n) => (
                        <select
                          key={`${part.category}-${n}`}
                          className={styles.scoreSelect}
                          aria-label={`Pick ${categoryWords(part)}${part.choose > 1 ? ` (${n + 1})` : ''}`}
                          value={chosen[n] ?? ''}
                          onChange={(event) => {
                            const picksNow = [...(pick?.picks ?? [])]
                            const slotPicks = [...(picksNow[slot] ?? [])]
                            slotPicks[n] = event.target.value
                            picksNow[slot] = slotPicks.filter(Boolean)
                            set(i, { option: o, picks: picksNow })
                          }}
                        >
                          <option value="">Pick {categoryWords(part)}…</option>
                          {items.map((item) => (
                            <option key={item.index} value={item.index}>
                              {itemName(item.name)}
                            </option>
                          ))}
                        </select>
                      ))
                    })}
                </div>
              )
            })}
          </div>
        </div>
      )
    })
  }

  const ac = summary.ac
  const heavy = summary.capacity !== null && summary.weight > summary.capacity

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>What do you carry?</h2>
        <p className={styles.stepLead}>
          Every {cls.name.toLowerCase()} starts with some gear, and you choose between a few options. Armour sets your
          armour class; weapons become cards in your hand.
        </p>
      </div>

      <div className={styles.detail}>
        {cls.startingGear.length > 0 && (
          <p className={styles.plays}>
            <strong>Yours already:</strong>{' '}
            {cls.startingGear
              .map(
                (g) =>
                  `${g.quantity > 1 ? `${g.quantity} × ` : ''}${itemName(findItem(equipment, g.item)?.name ?? g.item)}`,
              )
              .join(', ')}
          </p>
        )}
        {choices(cls.startingChoices, draft.gearPicks, 'gearPicks')}
      </div>

      {background && (background.gear.length > 0 || background.gearChoices.length > 0) && (
        <div className={styles.detail}>
          <p className={styles.plays}>
            <strong>From your background ({background.name}):</strong>{' '}
            {background.gear.map((g) => itemName(findItem(equipment, g.item)?.name ?? g.item)).join(', ')}
            {background.gold > 0 && `, and ${background.gold} gp in your purse`}
          </p>
          {choices(background.gearChoices, draft.backgroundGearPicks, 'backgroundGearPicks')}
        </div>
      )}

      <div className={styles.detail}>
        <h3 className={styles.choiceTitle}>All together</h3>
        <div className={styles.gearFacts}>
          <div>
            <span className={styles.summaryLabel}>Armour class</span>
            <span className={styles.bigFact}>{ac?.ac ?? '–'}</span>
            <span className={styles.note}>{ac ? ac.how : 'Set your scores first'}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Carrying</span>
            <span className={cx(styles.bigFact, heavy && styles.tooHeavy)}>{summary.weight} lb</span>
            <span className={styles.note}>
              {summary.capacity === null ? '' : `of ${summary.capacity} lb you can carry`}
              {heavy ? '. Too much!' : ''}
            </span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Coins</span>
            <span className={styles.bigFact}>{coinText(summary.wallet.gp * 100)}</span>
          </div>
        </div>
        {ac?.slowed && (
          <p className={styles.warn}>This armour needs more Strength: your speed drops by 10 feet in it.</p>
        )}
        {ac?.stealthDisadvantage && (
          <p className={styles.note}>This armour is noisy: Stealth checks have disadvantage.</p>
        )}
        <ul className={styles.inventoryList}>
          {summary.owned.map((o) => {
            const item = findItem(equipment, o.item)
            const worn = o.item === summary.worn.armour || (summary.worn.shield && item?.sub === 'Shield')
            return (
              <li key={o.item}>
                <span>
                  {o.quantity > 1 ? `${o.quantity} × ` : ''}
                  {itemName(item?.name ?? o.item)}
                </span>
                {worn && <span className={styles.wornTag}>worn</span>}
                {summary.attacks.some((a) => a.weapon === o.item) && (
                  <span className={styles.wornTag}>in your hand</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
