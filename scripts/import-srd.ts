// Imports the 2014 SRD 5.1 rules data from the 5e-database project and writes slim copies to
// src/rules/srd/. The output is committed, so builds don't depend on the network.
//
// Run with: node scripts/import-srd.ts   (Node 24 runs TypeScript directly)
//
// Source: github.com/5e-bits/5e-srd-api, folder packages/5e-database/src/2014/en, pinned to one
// commit. The project's code is MIT; the SRD 5.1 content is CC-BY-4.0 (see CREDITS.md). Only the
// 2014 folder is ever read, never 2024.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDefence } from '../src/rules/damage.ts'

const COMMIT = '386930c2e93a7f2c9ba2a9715ccc5b95d8926e41'
const BASE = `https://raw.githubusercontent.com/5e-bits/5e-srd-api/${COMMIT}/packages/5e-database/src/2014/en`
const OUT = 'src/rules/srd'

const SOURCE = {
  project: '5e-database (github.com/5e-bits/5e-srd-api), 2014 SRD 5.1 data',
  commit: COMMIT,
  licence: 'Data: SRD 5.1 by Wizards of the Coast, CC-BY-4.0. 5e-database: MIT.',
}

type Ref = { index: string; name: string }
type Raw = Record<string, any>

const ABILITY: Record<string, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
}

async function load(name: string): Promise<Raw[]> {
  const response = await fetch(`${BASE}/5e-SRD-${name}.json`)
  if (!response.ok) throw new Error(`Couldn't download ${name}: ${response.status}`)
  return (await response.json()) as Raw[]
}

function write(file: string, data: Record<string, unknown>): void {
  writeFileSync(join(OUT, file), `${JSON.stringify({ source: SOURCE, ...data }, null, 1)}\n`)
  console.log(`wrote ${file}`)
}

const text = (lines: string[] | string | undefined): string => (Array.isArray(lines) ? lines.join('\n\n') : (lines ?? ''))
const bonuses = (list: Raw[] = []): Record<string, number> =>
  Object.fromEntries(list.map((b) => [ABILITY[b.ability_score.index], b.bonus]))

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const [skills, conditions, equipment, classes, levels, races, subraces, traits, backgrounds, features, spells, monsters] =
    await Promise.all(
      ['Skills', 'Conditions', 'Equipment', 'Classes', 'Levels', 'Races', 'Subraces', 'Traits', 'Backgrounds', 'Features', 'Spells', 'Monsters'].map(
        load,
      ),
    )

  // Small and needed everywhere on the sheet: skills, conditions, weapons.
  write('basics.json', {
    skills: skills.map((s) => ({ index: s.index, name: s.name, ability: ABILITY[s.ability_score.index] })),
    conditions: conditions.map((c) => ({ index: c.index, name: c.name, desc: text(c.desc) })),
    weapons: equipment
      .filter((e) => e.equipment_category.index === 'weapon' && e.damage)
      .map((w) => ({
        index: w.index,
        name: w.name,
        category: w.weapon_category,
        range: w.weapon_range,
        damageDice: w.damage.damage_dice,
        damageType: w.damage.damage_type.name,
        properties: (w.properties as Ref[]).map((p) => p.index),
        versatileDice: w.two_handed_damage?.damage_dice,
        normalRange: w.range?.long ? w.range.normal : w.throw_range?.normal,
        longRange: w.range?.long ?? w.throw_range?.long,
      })),
  })

  write('classes.json', {
    classes: classes.map((c) => {
      const own = levels.filter((l) => l.class?.index === c.index && !l.subclass)
      const subclassLevels = levels.filter((l) => l.class?.index === c.index && l.subclass)
      return {
        index: c.index,
        name: c.name,
        hitDie: c.hit_die,
        saves: (c.saving_throws as Ref[]).map((s) => ABILITY[s.index]),
        spellcastingAbility: c.spellcasting ? ABILITY[c.spellcasting.spellcasting_ability.index] : null,
        skillChoices: (() => {
          const choice = (c.proficiency_choices as Raw[]).find((p) =>
            (p.from?.options ?? []).some((o: Raw) => o.item?.index?.startsWith('skill-')),
          )
          if (!choice) return null
          return {
            choose: choice.choose,
            from: (choice.from.options as Raw[])
              .filter((o) => o.item?.index?.startsWith('skill-'))
              .map((o) => o.item.index.replace(/^skill-/, '')),
          }
        })(),
        proficiencies: (c.proficiencies as Ref[])
          .filter((p) => !p.index.startsWith('saving-throw-'))
          .map((p) => p.name),
        subclasses: (c.subclasses as Ref[]).map((s) => ({ index: s.index, name: s.name })),
        levels: Object.fromEntries(
          own
            .sort((a, b) => a.level - b.level)
            .map((l) => [
              l.level,
              {
                profBonus: l.prof_bonus,
                features: (l.features as Ref[]).map((f) => f.index),
                slots: Array.from({ length: 9 }, (_, i) => l.spellcasting?.[`spell_slots_level_${i + 1}`] ?? 0),
                cantripsKnown: l.spellcasting?.cantrips_known,
                spellsKnown: l.spellcasting?.spells_known,
              },
            ]),
        ),
        subclassFeatures: Object.fromEntries(
          (c.subclasses as Ref[]).map((s) => [
            s.index,
            Object.fromEntries(
              subclassLevels
                .filter((l) => l.subclass.index === s.index)
                .map((l) => [l.level, (l.features as Ref[]).map((f) => f.index)]),
            ),
          ]),
        ),
      }
    }),
  })

  write('races.json', {
    races: races.map((r) => ({
      index: r.index,
      name: r.name,
      speed: r.speed,
      size: r.size,
      abilityBonuses: bonuses(r.ability_bonuses),
      languages: (r.languages as Ref[]).map((l) => l.name),
      traits: (r.traits as Ref[]).map((t) => t.index),
      subraces: subraces
        .filter((s) => s.race.index === r.index)
        .map((s) => ({
          index: s.index,
          name: s.name,
          abilityBonuses: bonuses(s.ability_bonuses),
          traits: (s.racial_traits as Ref[]).map((t) => t.index),
        })),
    })),
    traits: Object.fromEntries(traits.map((t) => [t.index, { name: t.name, desc: text(t.desc) }])),
  })

  write('backgrounds.json', {
    backgrounds: backgrounds.map((b) => ({
      index: b.index,
      name: b.name,
      skills: (b.starting_proficiencies as Ref[])
        .filter((p) => p.index.startsWith('skill-'))
        .map((p) => p.index.replace(/^skill-/, '')),
      feature: b.feature ? { name: b.feature.name, desc: text(b.feature.desc) } : null,
    })),
  })

  write('features.json', {
    features: Object.fromEntries(
      features.map((f) => [
        f.index,
        { name: f.name, class: f.class?.index ?? null, subclass: f.subclass?.index ?? null, level: f.level, desc: text(f.desc) },
      ]),
    ),
  })

  write('spells.json', {
    spells: spells.map((s) => ({
      index: s.index,
      name: s.name,
      level: s.level,
      school: s.school.name,
      castingTime: s.casting_time,
      range: s.range,
      components: (s.components as string[]).join(', ') + (s.material ? ` (${s.material})` : ''),
      duration: s.duration,
      concentration: s.concentration,
      ritual: s.ritual,
      classes: (s.classes as Ref[]).map((c) => c.index),
      desc: text(s.desc),
      higherLevel: s.higher_level ? text(s.higher_level) : undefined,
      attackType: s.attack_type,
      save: s.dc ? ABILITY[s.dc.dc_type.index] : undefined,
      // What a save does on a success: half the damage, or none.
      dcSuccess: s.dc?.dc_success === 'half' || s.dc?.dc_success === 'none' ? s.dc.dc_success : undefined,
      // Damage by slot level ("8d6" at 3rd), or for cantrips by character level ("2d10" from 5th).
      damage: s.damage?.damage_type
        ? {
            type: (s.damage.damage_type.name as string).toLowerCase(),
            slots: s.damage.damage_at_slot_level,
            levels: s.damage.damage_at_character_level,
          }
        : undefined,
      heal: s.heal_at_slot_level ?? undefined,
      area: s.area_of_effect ? { type: s.area_of_effect.type, size: s.area_of_effect.size } : undefined,
    })),
  })

  // Monsters, for the DM's Add a monster and Acting now card. Loaded only on the DM's screens.
  const feet = (value: string | undefined): number => Number.parseInt(value ?? '0', 10) || 0
  const action = (a: Raw) => ({
    name: a.name,
    desc: a.desc ?? '',
    attackBonus: typeof a.attack_bonus === 'number' ? a.attack_bonus : undefined,
    damage: ((a.damage ?? []) as Raw[])
      .filter((d) => d.damage_dice && d.damage_type)
      .map((d) => ({ dice: d.damage_dice as string, type: (d.damage_type.name as string).toLowerCase() })),
    dc: a.dc ? { ability: ABILITY[a.dc.dc_type.index], value: a.dc.dc_value, success: a.dc.success_type } : undefined,
  })
  write('monsters.json', {
    monsters: monsters.map((m) => ({
      index: m.index,
      name: m.name,
      size: m.size,
      type: m.type,
      ac: (m.armor_class as Raw[])[0]?.value ?? 10,
      hp: m.hit_points,
      hitDice: m.hit_dice,
      speed: feet(m.speed?.walk),
      speedText: Object.entries((m.speed ?? {}) as Record<string, string>)
        .map(([how, value]) => (how === 'walk' ? value : `${how} ${value}`))
        .join(', '),
      scores: Object.fromEntries(Object.values(ABILITY).map((ability) => [ability, m[ability]])),
      cr: m.challenge_rating,
      xp: m.xp,
      passivePerception: m.senses?.passive_perception ?? 10,
      traits: ((m.special_abilities ?? []) as Raw[]).map((t) => ({ name: t.name, desc: t.desc ?? '' })),
      actions: ((m.actions ?? []) as Raw[]).map(action),
      reactions: ((m.reactions ?? []) as Raw[]).map(action),
      legendary: ((m.legendary_actions ?? []) as Raw[]).map(action),
      resistances: ((m.damage_resistances ?? []) as string[]).flatMap(parseDefence),
      vulnerabilities: ((m.damage_vulnerabilities ?? []) as string[]).flatMap(parseDefence),
      immunities: ((m.damage_immunities ?? []) as string[]).flatMap(parseDefence),
      conditionImmunities: ((m.condition_immunities ?? []) as Raw[]).map((c) => c.index as string),
      // Saving throws it's proficient in, as the whole bonus: { dexterity: 5 }.
      saves: Object.fromEntries(
        ((m.proficiencies ?? []) as Raw[])
          .filter((p) => String(p.proficiency?.index ?? '').startsWith('saving-throw-'))
          .map((p) => [ABILITY[String(p.proficiency.index).slice('saving-throw-'.length)], p.value as number]),
      ),
    })),
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
