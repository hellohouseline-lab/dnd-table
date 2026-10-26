import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import {
  CM_PER_INCH,
  heightText,
  KG_PER_POUND,
  parseHeight,
  parseWeight,
  typicalWords,
  weightText,
} from '../../rules/build/measures.ts'
import type { BuilderDraft } from '../../rules/build/draft.ts'
import type { Story } from '../../rules/character.ts'
import type { SrdBackground } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'

type WhoStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  background: SrdBackground | null
  /** The race, for a guide to the usual height and weight. */
  race: { index: string | null; name: string } | null
}

const ALIGNMENTS: [string, string][] = [
  ['Lawful good', 'Does the right thing, by the rules'],
  ['Neutral good', 'Does the most good they can'],
  ['Chaotic good', 'Follows their heart to help others'],
  ['Lawful neutral', 'Order, tradition and their code first'],
  ['True neutral', 'Keeps out of it, or keeps a balance'],
  ['Chaotic neutral', 'Free, and follows their whims'],
  ['Lawful evil', 'Takes what they want, within a code'],
  ['Neutral evil', 'Whatever they can get away with'],
  ['Chaotic evil', 'Cruel and destructive'],
]

const LOOKS: { key: keyof Story; label: string; placeholder: string }[] = [
  { key: 'age', label: 'Age', placeholder: '27' },
  { key: 'eyes', label: 'Eyes', placeholder: 'Grey' },
  { key: 'skin', label: 'Skin', placeholder: 'Weathered, tanned' },
  { key: 'hair', label: 'Hair', placeholder: 'Red, braided beard' },
]

const NATURE: {
  key: keyof Story
  label: string
  ideas: keyof Pick<SrdBackground, 'personality' | 'ideals' | 'bonds' | 'flaws'>
}[] = [
  { key: 'personality', label: 'Personality', ideas: 'personality' },
  { key: 'ideals', label: 'Ideals', ideas: 'ideals' },
  { key: 'bonds', label: 'Bonds', ideas: 'bonds' },
  { key: 'flaws', label: 'Flaws', ideas: 'flaws' },
]

/**
 * Step 8: who they are. A name (the only thing needed), an alignment, looks, and their nature with
 * ideas from the background to pick or change, then goals and a backstory. All shown on the party
 * cards for the DM.
 */
export function WhoStep({ draft, onDraft, background, race }: WhoStepProps) {
  return (
    <StoryFields
      name={draft.name}
      onName={(name) => onDraft({ ...draft, name })}
      story={draft.story}
      onStory={(story) => onDraft({ ...draft, story })}
      background={background}
      race={race}
    />
  )
}

type StoryFieldsProps = {
  name: string
  onName: (name: string) => void
  story: Story
  onStory: (story: Story) => void
  background: SrdBackground | null
  race: { index: string | null; name: string } | null
  /** The heading: "Who are you?" in the builder. */
  title?: string
}

/** Name, alignment, looks (height and weight pickers) and nature: the builder's step, and Change your character. */
export function StoryFields({
  name,
  onName,
  story,
  onStory,
  background,
  race,
  title = 'Who are you?',
}: StoryFieldsProps) {
  const set = (key: keyof Story, value: string) => onStory({ ...story, [key]: value })
  const [metric, setMetric] = useState(true)
  const typical = race ? typicalWords(race.index, race.name) : null
  const inches = parseHeight(story.height)
  const pounds = parseWeight(story.weight)

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>{title}</h2>
        <p className={styles.stepLead}>
          Only your name is needed. The rest helps you play your character and gives the DM threads to pull.
        </p>
      </div>

      <div className={styles.detail}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Your character&rsquo;s name</span>
          <input
            value={name}
            maxLength={60}
            placeholder="Bruenna Stonehelm"
            onChange={(event) => onName(event.target.value)}
          />
        </label>

        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>Alignment: how they tend to act</h3>
          <div className={styles.alignGrid}>
            {ALIGNMENTS.map(([name, line]) => (
              <button
                key={name}
                type="button"
                className={cx(styles.option, story.alignment === name && styles.picked)}
                aria-pressed={story.alignment === name}
                onClick={() => set('alignment', story.alignment === name ? '' : name)}
              >
                <span className={styles.optionName}>{name}</span>
                <span className={styles.optionLine}>{line}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>How they look</h3>
          <div className={styles.unitRow} role="group" aria-label="Units">
            <button
              type="button"
              className={cx(styles.chip, metric && styles.picked)}
              aria-pressed={metric}
              onClick={() => setMetric(true)}
            >
              Centimetres and kilograms
            </button>
            <button
              type="button"
              className={cx(styles.chip, !metric && styles.picked)}
              aria-pressed={!metric}
              onClick={() => setMetric(false)}
            >
              Feet and pounds
            </button>
          </div>
          <div className={styles.measureGrid}>
            <div className={styles.smallField}>
              <span className={styles.fieldLabel}>Height</span>
              {metric ? (
                <select
                  className={styles.scoreSelect}
                  aria-label="Height in centimetres"
                  value={inches === null ? '' : Math.round(inches * CM_PER_INCH)}
                  onChange={(event) =>
                    set('height', event.target.value ? heightText(Number(event.target.value) / CM_PER_INCH) : '')
                  }
                >
                  <option value="">Pick…</option>
                  {range(60, 250).map((cm) => (
                    <option key={cm} value={cm}>
                      {cm} cm
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.inline}>
                  <select
                    className={styles.scoreSelect}
                    aria-label="Height in feet"
                    value={inches === null ? '' : Math.floor(inches / 12)}
                    onChange={(event) =>
                      set(
                        'height',
                        event.target.value ? heightText(Number(event.target.value) * 12 + ((inches ?? 0) % 12)) : '',
                      )
                    }
                  >
                    <option value="">ft</option>
                    {range(2, 8).map((ft) => (
                      <option key={ft} value={ft}>
                        {ft} ft
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.scoreSelect}
                    aria-label="And inches"
                    value={inches === null ? '' : Math.round(inches % 12)}
                    onChange={(event) =>
                      set('height', heightText(Math.floor((inches ?? 60) / 12) * 12 + Number(event.target.value)))
                    }
                  >
                    {range(0, 11).map((inch) => (
                      <option key={inch} value={inch}>
                        {inch} in
                      </option>
                    ))}
                  </select>
                </span>
              )}
              <span className={styles.note}>{story.height || typical?.height || ''}</span>
            </div>
            <div className={styles.smallField}>
              <span className={styles.fieldLabel}>Weight</span>
              <select
                className={styles.scoreSelect}
                aria-label={metric ? 'Weight in kilograms' : 'Weight in pounds'}
                value={pounds === null ? '' : metric ? Math.round(pounds * KG_PER_POUND) : Math.round(pounds)}
                onChange={(event) =>
                  set(
                    'weight',
                    event.target.value
                      ? weightText(metric ? Number(event.target.value) / KG_PER_POUND : Number(event.target.value))
                      : '',
                  )
                }
              >
                <option value="">Pick…</option>
                {(metric ? range(10, 200) : range(20, 440)).map((n) => (
                  <option key={n} value={n}>
                    {n} {metric ? 'kg' : 'lb'}
                  </option>
                ))}
              </select>
              <span className={styles.note}>{story.weight || typical?.weight || ''}</span>
            </div>
          </div>
          <div className={styles.looksGrid}>
            {LOOKS.map((look) => (
              <label key={look.key} className={styles.smallField}>
                <span className={styles.fieldLabel}>{look.label}</span>
                <input
                  value={story[look.key]}
                  maxLength={60}
                  placeholder={look.placeholder}
                  onChange={(event) => set(look.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.detail}>
        {NATURE.map((part) => {
          const ideas = background?.[part.ideas] ?? []
          return (
            <div key={part.key} className={styles.choice}>
              <h3 className={styles.choiceTitle}>{part.label}</h3>
              {ideas.length > 0 && (
                <div className={styles.ideas}>
                  {ideas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      className={cx(styles.idea, story[part.key] === idea && styles.picked)}
                      onClick={() => set(part.key, idea)}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                className={styles.textarea}
                aria-label={part.label}
                rows={2}
                maxLength={600}
                placeholder={ideas.length > 0 ? 'Pick an idea above, or write your own' : 'Write your own'}
                value={story[part.key]}
                onChange={(event) => set(part.key, event.target.value)}
              />
            </div>
          )
        })}
        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>Goals</h3>
          <textarea
            className={styles.textarea}
            aria-label="Goals"
            rows={2}
            maxLength={600}
            placeholder="Find my missing sister; earn enough to buy back the family farm"
            value={story.goals}
            onChange={(event) => set('goals', event.target.value)}
          />
        </div>
        <div className={styles.choice}>
          <h3 className={styles.choiceTitle}>Backstory</h3>
          <textarea
            className={styles.textarea}
            aria-label="Backstory"
            rows={5}
            maxLength={2000}
            placeholder="Where they grew up, what happened, and why they took to the road"
            value={story.backstory}
            onChange={(event) => set('backstory', event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
