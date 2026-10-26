import { cx } from '../../components/cx.ts'
import type { BuilderDraft } from '../../rules/build/draft.ts'
import type { Story } from '../../rules/character.ts'
import type { SrdBackground } from '../../rules/srd/index.ts'
import styles from './Builder.module.css'

type WhoStepProps = {
  draft: BuilderDraft
  onDraft: (draft: BuilderDraft) => void
  background: SrdBackground | null
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
  { key: 'height', label: 'Height', placeholder: '4 ft 6' },
  { key: 'weight', label: 'Weight', placeholder: '12 stone' },
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
export function WhoStep({ draft, onDraft, background }: WhoStepProps) {
  const story = draft.story
  const set = (key: keyof Story, value: string) => onDraft({ ...draft, story: { ...story, [key]: value } })

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h2 className={styles.stepTitle}>Who are you?</h2>
        <p className={styles.stepLead}>
          Only your name is needed. The rest helps you play your character and gives the DM threads to pull.
        </p>
      </div>

      <div className={styles.detail}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Your character&rsquo;s name</span>
          <input
            value={draft.name}
            maxLength={60}
            placeholder="Bruenna Stonehelm"
            onChange={(event) => onDraft({ ...draft, name: event.target.value })}
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
