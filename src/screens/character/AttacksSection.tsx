import { buttonClassName } from '../../components/buttonClassName.ts'
import { Panel } from '../../components/Panel.tsx'
import { ABILITIES, ABILITY_NAME, isAbility } from '../../rules/abilities.ts'
import { entryId, type AttackEntry, type CharacterBuild } from '../../rules/character.ts'
import { customAttack, weaponAttack } from '../../rules/maths/attacks.ts'
import { formatBonus } from '../../rules/maths/core.ts'
import { findWeapon, WEAPONS } from '../../rules/srd/index.ts'
import styles from './form.module.css'

type SectionProps = { build: CharacterBuild; onChange: (build: CharacterBuild) => void }

/** Weapons from the rules list (damage fills in), or attacks typed in by hand. */
export function AttacksSection({ build, onChange }: SectionProps) {
  const setAttacks = (attacks: AttackEntry[]) => onChange({ ...build, attacks })
  const change = (id: string, patch: Partial<AttackEntry>) =>
    setAttacks(build.attacks.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  function addWeapon(index: string) {
    const weapon = findWeapon(index)
    if (!weapon) return
    setAttacks([
      ...build.attacks,
      { id: entryId(), name: weapon.name, weapon: weapon.index, proficient: true, magicBonus: 0, ability: 'strength', damageDice: '', damageType: '' },
    ])
  }

  function addTypedIn() {
    setAttacks([
      ...build.attacks,
      { id: entryId(), name: 'Unarmed strike', weapon: null, proficient: true, magicBonus: 0, ability: 'strength', damageDice: '', damageType: 'Bludgeoning' },
    ])
  }

  return (
    <Panel title="Attacks">
      {build.attacks.length === 0 && <p className={styles.note}>No attacks yet. Add the weapons your character carries.</p>}
      <ul className={styles.list}>
        {build.attacks.map((attack) => {
          const weapon = findWeapon(attack.weapon)
          const result = weapon
            ? weaponAttack(weapon, build.scores, build.level, attack.proficient, attack.magicBonus)
            : customAttack(attack, build.scores, build.level, attack.proficient, attack.magicBonus)
          return (
            <li key={attack.id} className={styles.item}>
              <div className={styles.itemRow}>
                <input
                  className={`${styles.input} ${styles.grow}`}
                  aria-label="Attack name"
                  maxLength={60}
                  value={attack.name}
                  onChange={(event) => change(attack.id, { name: event.target.value })}
                />
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={attack.proficient}
                    onChange={(event) => change(attack.id, { proficient: event.target.checked })}
                  />
                  Proficient
                </label>
                <label className={styles.check}>
                  Magic bonus
                  <input
                    className={`${styles.input} ${styles.narrow}`}
                    type="number"
                    min={0}
                    max={3}
                    value={attack.magicBonus}
                    onChange={(event) => change(attack.id, { magicBonus: Math.min(3, Math.max(0, Number(event.target.value) || 0)) })}
                  />
                </label>
                <button
                  type="button"
                  className={buttonClassName('quiet')}
                  onClick={() => setAttacks(build.attacks.filter((a) => a.id !== attack.id))}
                >
                  Remove
                </button>
              </div>
              {!weapon && (
                <div className={styles.itemRow}>
                  <select
                    className={styles.select}
                    aria-label="Ability used"
                    value={attack.ability}
                    onChange={(event) => isAbility(event.target.value) && change(attack.id, { ability: event.target.value })}
                  >
                    {ABILITIES.map((ability) => (
                      <option key={ability} value={ability}>
                        {ABILITY_NAME[ability]}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${styles.input} ${styles.narrow}`}
                    aria-label="Damage dice, like 1d6 (leave empty for 1 + modifier)"
                    placeholder="1d6"
                    maxLength={12}
                    value={attack.damageDice}
                    onChange={(event) => change(attack.id, { damageDice: event.target.value.replace(/[^0-9d+]/gi, '') })}
                  />
                  <input
                    className={styles.input}
                    aria-label="Damage type"
                    placeholder="Bludgeoning"
                    maxLength={30}
                    value={attack.damageType}
                    onChange={(event) => change(attack.id, { damageType: event.target.value })}
                  />
                </div>
              )}
              <div className={styles.result}>
                {formatBonus(result.toHit)} to hit, {result.damage} {result.damageType.toLowerCase()} damage
                {result.versatileDamage && ` (${result.versatileDamage} with two hands)`}
                {weapon && <span className={styles.muted}> · {weapon.category} {weapon.range.toLowerCase()} weapon</span>}
              </div>
            </li>
          )
        })}
      </ul>
      <div className={styles.actions}>
        <select
          className={styles.select}
          aria-label="Add a weapon from the rules"
          value=""
          onChange={(event) => addWeapon(event.target.value)}
        >
          <option value="">Add a weapon…</option>
          {(['Simple', 'Martial'] as const).map((category) => (
            <optgroup key={category} label={`${category} weapons`}>
              {WEAPONS.filter((w) => w.category === category).map((w) => (
                <option key={w.index} value={w.index}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" className={buttonClassName('quiet')} onClick={addTypedIn}>
          Add a typed-in attack
        </button>
      </div>
    </Panel>
  )
}
