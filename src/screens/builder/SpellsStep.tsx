import { cx } from '../../components/cx.ts'
import { togglePick, type BuilderDraft } from '../../rules/build/draft.ts'
import type { SpellPlan } from '../../rules/build/spellsStep.ts'
import type { SrdSpell } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'

type SpellsStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  className: string
  plan: SpellPlan
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

const HOW_WORDS: Record<SpellPlan['how'], string> = {
  known: 'You know these spells for good. You can swap one for another when you level up.',
  spellbook:
    'You write these in your spellbook. Each day you prepare some of them to cast; you can learn more from scrolls and other books.',
  prepared:
    'You can pray for any spell on your list. Pick the ones you have prepared today; you can change them after each long rest.',
  none: '',
}

/**
 * Step 7: spells for casters. Cantrips (cast any time) and level 1 spells from the class's list,
 * as many as the class allows; a wizard then prepares some from their book. A subclass's spells
 * (a Life cleric's Bless) are shown as always ready.
 */
export function SpellsStep({ draft, onDraft, className, plan }: SpellsStepProps) {
  if (plan.how === 'none') {
    return (
      <div className={styles.step}>
        <div className={styles.stepIntro}>
          <h2 className={styles.stepTitle}>Spells</h2>
          <p className={styles.stepLead}>
            {plan.spells === 0 && plan.cantrips === 0
              ? `A level 1 ${className.toLowerCase()} doesn’t cast spells, so there’s nothing to pick here.`
              : ''}
            {draft.traitPicks['high-elf-cantrip'] ? ' Your high elf cantrip is already yours.' : ''}
          </p>
        </div>
      </div>
    )
  }

  const card = (spell: SrdSpell, list: 'cantripPicks' | 'spellPicks' | 'preparedPicks', max: number) => {
    const on = draft[list].includes(spell.index)
    return (
      <button
        key={spell.index}
        type="button"
        className={cx(styles.option, styles.spellOption, on && styles.picked)}
        aria-pressed={on}
        title={spell.desc}
        onClick={() => {
          const next = { ...draft, [list]: togglePick(draft[list], spell.index, max) }
          // Dropping a spell from the book unprepares it too.
          if (list === 'spellPicks') next.preparedPicks = next.preparedPicks.filter((p) => next.spellPicks.includes(p))
          onDraft(next)
        }}
      >
        <span className={styles.optionName}>
          {spell.name}
          {spell.concentration && (
            <span className={styles.concMark} title="Concentration">
              {' '}
              C
            </span>
          )}
        </span>
        <span className={styles.optionLine}>{first(spell.desc)}</span>
        <span className={styles.spellMeta}>
          {spell.castingTime} · {spell.range}
        </span>
      </button>
    )
  }

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>Your spells</h2>
        <p className={styles.stepLead}>{HOW_WORDS[plan.how]}</p>
      </div>

      {plan.always.length > 0 && (
        <div className={styles.detail}>
          <p className={styles.plays}>
            <strong>Always ready, from your subclass:</strong> {plan.always.map((s) => s.name).join(', ')}
          </p>
        </div>
      )}

      {plan.cantrips > 0 && (
        <div className={styles.detail}>
          <h3 className={styles.choiceTitle}>
            Cantrips: pick {plan.cantrips} ({draft.cantripPicks.length} of {plan.cantrips}). Cast them as often as you
            like.
          </h3>
          <div className={styles.ancestryGrid}>
            {plan.cantripList
              .filter((s) => s.index !== draft.traitPicks['high-elf-cantrip'])
              .map((s) => card(s, 'cantripPicks', plan.cantrips))}
          </div>
        </div>
      )}

      {plan.spells > 0 && (
        <div className={styles.detail}>
          <h3 className={styles.choiceTitle}>
            {plan.how === 'spellbook'
              ? `Your spellbook: pick ${plan.spells}`
              : plan.how === 'prepared'
                ? `Prepared today: pick ${plan.spells}`
                : `Spells you know: pick ${plan.spells}`}{' '}
            ({draft.spellPicks.length} of {plan.spells}). Each uses a spell slot.
          </h3>
          <div className={styles.ancestryGrid}>{plan.spellList.map((s) => card(s, 'spellPicks', plan.spells))}</div>
        </div>
      )}

      {plan.prepare !== null && draft.spellPicks.length > 0 && (
        <div className={styles.detail}>
          <h3 className={styles.choiceTitle}>
            Prepare {Math.min(plan.prepare, draft.spellPicks.length)} from your book ({draft.preparedPicks.length} of{' '}
            {Math.min(plan.prepare, draft.spellPicks.length)})
          </h3>
          <div className={styles.ancestryGrid}>
            {plan.spellList
              .filter((s) => draft.spellPicks.includes(s.index))
              .map((s) => card(s, 'preparedPicks', plan.prepare ?? 0))}
          </div>
        </div>
      )}
      <p className={styles.note}>Hold the mouse on a spell to read all of it. C means it needs concentration.</p>
    </div>
  )
}
