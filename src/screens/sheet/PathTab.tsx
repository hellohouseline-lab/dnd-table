import { useSrd } from '../../live/useSrd.ts'
import { subclassIndex } from '../../rules/build/applyLevelUp.ts'
import { pathAhead, type LevelPlan } from '../../rules/build/levelUp.ts'
import { nextWildShape, wildShapeBeasts, wildShapeLimits, type WildShapeLimits } from '../../rules/build/wildShape.ts'
import type { Character } from '../../rules/character.ts'
import { crText } from '../../rules/combat.ts'
import { loadClasses, loadFeatures, loadMonsters, type SrdClass, type SrdMonster } from '../../rules/srd/index.ts'
import { Section } from './SheetTab.tsx'
import styles from './sheet.module.css'

const first = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text

function planLines(plan: LevelPlan): string[] {
  return [
    ...(plan.profUp ? [`Training bonus goes up to +${plan.profBonus}`] : []),
    ...(plan.chooseSubclass ? ['Pick your path (subclass)'] : []),
    ...(plan.abilityIncrease ? ['Ability score increase: +2 to one score, or +1 to two'] : []),
    ...plan.choices.map((c) => `Choose ${c.choose === 1 ? 'a' : c.choose} ${c.name.toLowerCase()}`),
    ...plan.numbers.map((n) => `${n.label}: ${n.before ? `${n.before} → ` : ''}${n.after}`),
    ...(plan.cantrips > 0 ? [`${plan.cantrips} new cantrip${plan.cantrips === 1 ? '' : 's'}`] : []),
    ...(plan.spells > 0 ? [`${plan.spells} new spell${plan.spells === 1 ? '' : 's'}`] : []),
    ...(plan.newSpellLevel ? [`Level ${plan.newSpellLevel} spells unlocked`] : []),
  ]
}

const limitsWords = (l: WildShapeLimits) =>
  `beasts up to challenge ${crText(l.maxCr)}${l.swim ? '' : ', no swimmers'}${l.fly ? '' : ', no fliers'}`

/**
 * Your path: every level from the next to 20 for the character's class, with what each brings and
 * the choices coming, so a player can plan. A druid also sees the beasts they can Wild Shape into
 * now and the next change.
 */
export function PathTab({ character }: { character: Character }) {
  const classes = useSrd(loadClasses)
  const features = useSrd(loadFeatures)
  const cls = classes?.find((c) => c.name.toLowerCase() === character.className.trim().toLowerCase()) ?? null
  if (!classes || !features) return <p className={styles.empty}>Opening the book…</p>
  if (!cls) {
    return (
      <p className={styles.empty}>
        Your path follows the free rules&rsquo; classes. For a class from another book, your DM can help you plan.
      </p>
    )
  }
  if (character.level >= 20) return <p className={styles.empty}>Level 20: the top of the path. Well done.</p>

  const plans = pathAhead(
    cls,
    character.level,
    subclassIndex(cls, character, null),
    { features: [], spells: [] },
    features,
  )
  return (
    <div className={cls.index === 'druid' ? styles.pathColumns : undefined}>
      <Section
        title={`Your path as ${/^[aeiou]/i.test(cls.name) ? 'an' : 'a'} ${cls.name.toLowerCase()}`}
        note={`now level ${character.level}`}
      >
        <ol className={styles.pathList}>
          {plans.map((plan, i) => (
            <li key={plan.level} className={i === 0 ? styles.pathNext : undefined}>
              <div className={styles.pathLevel}>
                Level {plan.level}
                {i === 0 && <span className={styles.pathTag}>next</span>}
              </div>
              <ul className={styles.pathItems}>
                {plan.features
                  .filter(
                    (f) =>
                      !plan.choices.some((c) => c.feature === f.index) && !/ability score improvement/i.test(f.name),
                  )
                  .map((f) => (
                    <li key={f.index} title={f.desc}>
                      <strong>{f.name}</strong>: {first(f.desc)}
                    </li>
                  ))}
                {planLines(plan).map((text) => (
                  <li key={text}>{text}</li>
                ))}
                {plan.features.length === 0 && planLines(plan).length === 0 && <li>More hit points.</li>}
              </ul>
            </li>
          ))}
        </ol>
      </Section>
      {cls.index === 'druid' && <WildShapes druid={cls} level={character.level} />}
    </div>
  )
}

function WildShapes({ druid, level }: { druid: SrdClass; level: number }) {
  const monsters = useSrd(loadMonsters)
  const now = wildShapeLimits(druid, level)
  const next = nextWildShape(druid, level)
  const list = (limits: WildShapeLimits, all: SrdMonster[]) => wildShapeBeasts(all, limits)
  return (
    <Section title="Wild Shape" note={now ? limitsWords(now) : 'from level 2'}>
      {!monsters ? (
        <p className={styles.empty}>Finding the beasts…</p>
      ) : (
        <>
          {now && (
            <ul className={styles.beasts}>
              {list(now, monsters).map((m) => (
                <li key={m.index} title={m.actions.map((a) => `${a.name}: ${a.desc}`).join('\n\n')}>
                  <strong>{m.name}</strong> · challenge {crText(m.cr)} · {m.hp} hit points · AC {m.ac} · {m.speedText}
                </li>
              ))}
            </ul>
          )}
          {next && (
            <p className={styles.sectionNoteBlock}>
              At level {next.level}: {limitsWords(next.limits)}, adding{' '}
              {list(next.limits, monsters)
                .filter((m) => !now || !list(now, monsters).some((n) => n.index === m.index))
                .slice(0, 8)
                .map((m) => m.name)
                .join(', ')}{' '}
              and more.
            </p>
          )}
        </>
      )}
    </Section>
  )
}
