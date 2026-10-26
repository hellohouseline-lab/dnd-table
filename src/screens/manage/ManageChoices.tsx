import { cx } from '../../components/cx.ts'
import type { CharacterBuild } from '../../rules/character.ts'
import { applyChoice, choiceGroups } from '../../rules/manage.ts'
import type { SrdClass, SrdFeature } from '../../rules/srd/index.ts'
import styles from '../builder/Builder.module.css'
import own from './Manage.module.css'

type ManageChoicesProps = {
  build: CharacterBuild
  onBuild: (build: CharacterBuild) => void
  cls: SrdClass
  features: Record<string, SrdFeature>
}

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

/**
 * The choices the class has made so far (a fighting style, expertise, metamagic, invocations), with
 * what's picked now. Changing one after the fact is a house rule, so the screen says to ask the DM.
 */
export function ManageChoices({ build, onBuild, cls, features }: ManageChoicesProps) {
  const groups = choiceGroups(cls, build, features)
  if (groups.length === 0) {
    return (
      <p className={styles.note}>
        A level {build.level} {cls.name.toLowerCase()} hasn&rsquo;t had any choices like a fighting style or expertise
        yet. Your path shows when they come.
      </p>
    )
  }
  return (
    <div className={styles.step}>
      <p className={styles.note}>
        The rules don&rsquo;t usually let you change these once picked. Talk to your DM before you swap one.
      </p>
      {groups.map((group) => {
        const toggle = (index: string) => {
          const on = group.picked.includes(index)
          const picked = on
            ? group.picked.filter((p) => p !== index)
            : group.choose === 1
              ? [index]
              : [...group.picked, index]
          if (picked.length <= group.choose) onBuild(applyChoice(build, group, picked))
        }
        const full = group.picked.length >= group.choose
        return (
          <div key={group.name} className={styles.detail}>
            <h3 className={styles.choiceTitle}>
              {group.name}: {group.picked.length} of {group.choose}
            </h3>
            <div className={styles.ancestryGrid}>
              {group.options.map((option) => {
                const on = group.picked.includes(option.index)
                const blocked = !on && (!option.allowed || (full && group.choose > 1))
                return (
                  <button
                    key={option.index}
                    type="button"
                    className={cx(styles.option, on && styles.picked)}
                    aria-pressed={on}
                    disabled={blocked}
                    title={option.desc || undefined}
                    onClick={() => toggle(option.index)}
                  >
                    <span className={styles.optionName}>{option.name}</span>
                    {option.desc && <span className={styles.optionLine}>{first(option.desc)}</span>}
                    {!option.allowed && option.why && <span className={own.bad}>Not yet: {option.why}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
