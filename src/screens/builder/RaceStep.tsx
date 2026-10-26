import { ABILITY_NAME, ABILITY_SHORT } from '../../rules/abilities.ts'
import { cx } from '../../components/cx.ts'
import { LANGUAGES, languageChoices, togglePick, withRacePicked, type BuilderDraft } from '../../rules/build/draft.ts'
import { describeBonuses } from '../../rules/srd/defaults.ts'
import type { SrdRace, SrdRaces, SrdSpell } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'
import { RACE_EMBLEMS, RACE_WORDS, SUBRACE_WORDS } from './raceWords.ts'
import { Icon } from '../../components/Icon.tsx'

type RaceStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  races: SrdRaces
  spells: SrdSpell[] | null
}

/** "Rock Gnome" from "rock-gnome" when there's no name to hand. */
const words = (index: string) => index.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** The first sentence of a description, for a card. */
const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

/**
 * Step 1: where you come from. The nine SRD races as cards, then, once one is picked, its kinds
 * (subraces), what it gives, and anything it asks you to choose: a half-elf's two +1s, extra
 * languages, a dragonborn's ancestry, a high elf's cantrip.
 */
export function RaceStep({ draft, onDraft, races, spells }: RaceStepProps) {
  const race = races.races.find((r) => r.index === draft.race) ?? null

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>Where do you come from?</h2>
        <p className={styles.stepLead}>
          Your race gives you bonuses to your ability scores, your speed and some special traits. Any race can be any
          class, so pick the one you like the sound of.
        </p>
      </div>

      <ul className={styles.raceGrid}>
        {[...races.races, null].map((r) => {
          const index = r?.index ?? 'other'
          const picked = draft.race === index
          return (
            <li key={index}>
              <button
                type="button"
                className={cx(styles.raceCard, picked && styles.picked, !r && styles.raceOther)}
                aria-pressed={picked}
                onClick={() => onDraft(withRacePicked(draft, index))}
              >
                <span className={styles.crest} aria-hidden="true">
                  {r && RACE_EMBLEMS[r.index] ? <Icon name={RACE_EMBLEMS[r.index]} size={24} /> : '?'}
                </span>
                <span className={styles.raceName}>{r ? r.name : 'Another race'}</span>
                <span className={styles.raceLine}>{RACE_WORDS[index]}</span>
                {r && (
                  <span className={styles.raceFacts}>
                    {r.index === 'human' ? '+1 to all' : describeBonuses(r.abilityBonuses)}
                    {r.abilityBonusChoice && ', +1 to two'} · {r.speed} ft · {r.size}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {draft.race === 'other' && (
        <div className={styles.detail}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Your race&rsquo;s name</span>
            <input
              value={draft.otherRace}
              maxLength={40}
              placeholder="Goliath"
              onChange={(event) => onDraft({ ...draft, otherRace: event.target.value })}
            />
          </label>
          <p className={styles.note}>
            Its bonuses and traits aren&rsquo;t in the free rules, so you&rsquo;ll add them on your sheet after the
            builder. Your DM can help.
          </p>
        </div>
      )}

      {race && <RaceDetail draft={draft} onDraft={onDraft} races={races} race={race} spells={spells} />}
    </div>
  )
}

function RaceDetail({ draft, onDraft, races, race, spells }: RaceStepProps & { race: SrdRace }) {
  const subrace = race.subraces.find((s) => s.index === draft.subrace) ?? null
  const traitIndexes = [...race.traits, ...(subrace?.traits ?? [])]
  const choosing = traitIndexes.filter((index) => races.traits[index]?.choice)
  const knownLanguages = new Set(race.languages)
  const languageCount = languageChoices(race, draft.subrace)

  return (
    <div className={styles.detail}>
      {race.subraces.length > 0 && (
        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>What kind of {race.name.toLowerCase()}?</h3>
          <div className={styles.optionRow}>
            {race.subraces.map((s) => (
              <button
                key={s.index}
                type="button"
                className={cx(styles.option, draft.subrace === s.index && styles.picked)}
                aria-pressed={draft.subrace === s.index}
                onClick={() => onDraft({ ...draft, subrace: s.index, traitPicks: {} })}
              >
                <span className={styles.optionName}>{s.name}</span>
                <span className={styles.optionLine}>{SUBRACE_WORDS[s.index] ?? describeBonuses(s.abilityBonuses)}</span>
              </button>
            ))}
          </div>
          <p className={styles.note}>The free rules have one kind of each; others from books can be typed in later.</p>
        </div>
      )}

      {race.abilityBonusChoice && (
        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>
            Pick {race.abilityBonusChoice.choose} abilities for +1 each ({draft.bonusPicks.length} of{' '}
            {race.abilityBonusChoice.choose})
          </h3>
          <div className={styles.optionRow}>
            {race.abilityBonusChoice.from.map((ability) => {
              const on = draft.bonusPicks.includes(ability)
              return (
                <button
                  key={ability}
                  type="button"
                  className={cx(styles.chip, on && styles.picked)}
                  aria-pressed={on}
                  onClick={() =>
                    onDraft({
                      ...draft,
                      bonusPicks: togglePick(draft.bonusPicks, ability, race.abilityBonusChoice?.choose ?? 2),
                    })
                  }
                >
                  +1 {ABILITY_NAME[ability]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {choosing.map((index) => {
        const trait = races.traits[index]
        const choice = trait.choice
        if (!choice) return null
        const picked = draft.traitPicks[index]
        const pick = (value: string) => onDraft({ ...draft, traitPicks: { ...draft.traitPicks, [index]: value } })
        if (choice.kind === 'trait') {
          return (
            <div key={index} className={styles.choice}>
              <h3 className={styles.choiceTitle}>{trait.name}: pick one</h3>
              <p className={styles.note}>
                {trait.name === 'Draconic Ancestry'
                  ? 'Your dragon’s colour sets your breath weapon and the damage you resist.'
                  : first(trait.desc)}
              </p>
              <div className={styles.ancestryGrid}>
                {choice.from.map((option) => {
                  const sub = races.traits[option]
                  const colour = (sub?.name ?? words(option)).replace(/^Draconic Ancestry \(?/i, '').replace(/\)$/, '')
                  return (
                    <button
                      key={option}
                      type="button"
                      className={cx(styles.option, picked === option && styles.picked)}
                      aria-pressed={picked === option}
                      onClick={() => pick(option)}
                    >
                      <span className={styles.optionName}>{colour}</span>
                      <span className={styles.optionLine}>
                        {sub?.damageType ? `${sub.damageType[0].toUpperCase()}${sub.damageType.slice(1)}` : ''}
                        {sub?.breath
                          ? ` · ${sub.breath.area.size} ft ${sub.breath.area.type}${sub.breath.save ? `, ${ABILITY_NAME[sub.breath.save]} save` : ''}`
                          : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        }
        if (choice.kind === 'spell') {
          return (
            <div key={index} className={styles.choice}>
              <h3 className={styles.choiceTitle}>{trait.name}: pick one cantrip</h3>
              <div className={styles.optionRow}>
                {choice.from.map((option) => {
                  const spell = spells?.find((s) => s.index === option)
                  return (
                    <button
                      key={option}
                      type="button"
                      className={cx(styles.chip, picked === option && styles.picked)}
                      aria-pressed={picked === option}
                      title={spell ? first(spell.desc) : undefined}
                      onClick={() => pick(option)}
                    >
                      {spell?.name ?? words(option)}
                    </button>
                  )
                })}
              </div>
              <p className={styles.note}>Hold the mouse on a cantrip to see what it does.</p>
            </div>
          )
        }
        return null
      })}

      {languageCount > 0 && (
        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>
            Pick {languageCount === 1 ? 'an extra language' : `${languageCount} extra languages`}
          </h3>
          <div className={styles.optionRow}>
            {LANGUAGES.filter((l) => !knownLanguages.has(l)).map((language) => {
              const on = draft.languagePicks.includes(language)
              return (
                <button
                  key={language}
                  type="button"
                  className={cx(styles.chip, on && styles.picked)}
                  aria-pressed={on}
                  onClick={() =>
                    onDraft({
                      ...draft,
                      languagePicks: togglePick(draft.languagePicks, language, languageCount),
                    })
                  }
                >
                  {language}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.choice}>
        <h3 className={styles.choiceTitle}>
          What being {/^[aeiou]/i.test(race.name) ? 'an' : 'a'} {race.name.toLowerCase()} gives you
        </h3>
        <ul className={styles.traitList}>
          {traitIndexes
            .filter((index) => !races.traits[index]?.choice || races.traits[index]?.choice?.kind !== 'trait')
            .map((index) => {
              const trait = races.traits[index]
              if (!trait) return null
              return (
                <li key={index}>
                  <details>
                    <summary>
                      <span className={styles.traitName}>{trait.name}</span>
                      <span className={styles.traitLine}>{first(trait.desc)}</span>
                    </summary>
                    <p>{trait.desc}</p>
                  </details>
                </li>
              )
            })}
          <li>
            <span className={styles.traitName}>Speaks</span>
            <span className={styles.traitLine}>{race.languages.join(', ')}</span>
          </li>
          {Object.keys(race.abilityBonuses).length > 0 && (
            <li>
              <span className={styles.traitName}>Ability bonuses</span>
              <span className={styles.traitLine}>
                {(Object.entries(race.abilityBonuses) as [keyof typeof ABILITY_SHORT, number][])
                  .map(([a, n]) => `+${n} ${ABILITY_NAME[a]}`)
                  .join(', ')}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
