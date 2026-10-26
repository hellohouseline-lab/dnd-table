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

const text = (lines: string[] | string | undefined): string =>
  Array.isArray(lines) ? lines.join('\n\n') : (lines ?? '')
const bonuses = (list: Raw[] = []): Record<string, number> =>
  Object.fromEntries(list.map((b) => [ABILITY[b.ability_score.index], b.bonus]))

/** A cost in copper pieces: 1 gp is 100 cp, 1 sp 10, 1 ep 50, 1 pp 1000. */
const COPPER: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
const copper = (cost: Raw | undefined): number => (cost ? cost.quantity * (COPPER[cost.unit] ?? 0) : 0)

/**
 * A starting-gear choice, made plain: each option is a list of parts, a part being an item (with how
 * many) or a pick from a category ("a martial weapon").
 */
type GearPart = { item: string; quantity: number } | { category: string; choose: number; desc: string }
function gearOption(option: Raw): GearPart[] {
  if (option.option_type === 'counted_reference') return [{ item: option.of.index, quantity: option.count }]
  if (option.option_type === 'reference') return [{ item: option.item.index, quantity: 1 }]
  if (option.option_type === 'multiple') return (option.items as Raw[]).flatMap(gearOption)
  if (option.option_type === 'choice') {
    const choice = option.choice
    if (choice.from.option_set_type === 'equipment_category') {
      return [{ category: choice.from.equipment_category.index, choose: choice.choose, desc: choice.desc ?? '' }]
    }
    // A choice inside a choice: offer its first option (rare in the SRD).
    return gearOption((choice.from.options as Raw[])[0])
  }
  return []
}
function gearChoice(choice: Raw): { desc: string; choose: number; options: GearPart[][] } {
  if (choice.from.option_set_type === 'equipment_category') {
    return {
      desc: choice.desc ?? '',
      choose: 1,
      options: [[{ category: choice.from.equipment_category.index, choose: choice.choose, desc: choice.desc ?? '' }]],
    }
  }
  return { desc: choice.desc ?? '', choose: choice.choose, options: (choice.from.options as Raw[]).map(gearOption) }
}

/** A string or reference option set, as plain values. */
const optionValues = (from: Raw): string[] =>
  ((from?.options ?? []) as Raw[]).map((o) =>
    typeof o === 'string'
      ? o
      : o.option_type === 'string'
        ? o.string
        : o.option_type === 'ideal'
          ? o.desc
          : (o.item?.index ?? ''),
  )

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const [
    skills,
    conditions,
    equipment,
    classes,
    levels,
    races,
    subraces,
    traits,
    backgrounds,
    features,
    spells,
    monsters,
    categories,
    subclassRows,
    magicItems,
  ] = await Promise.all(
    [
      'Skills',
      'Conditions',
      'Equipment',
      'Classes',
      'Levels',
      'Races',
      'Subraces',
      'Traits',
      'Backgrounds',
      'Features',
      'Spells',
      'Monsters',
      'Equipment-Categories',
      'Subclasses',
      'Magic-Items',
    ].map(load),
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
                // The class's own numbers at this level: rages, ki points, sneak attack, Wild Shape limits.
                extras: l.class_specific ?? {},
                abilityScoreIncreases: l.ability_score_bonuses ?? 0,
              },
            ]),
        ),
        startingGear: ((c.starting_equipment ?? []) as Raw[]).map((e) => ({
          item: e.equipment.index,
          quantity: e.quantity,
        })),
        startingChoices: ((c.starting_equipment_options ?? []) as Raw[]).map(gearChoice),
        // Spells a subclass always has prepared (a Life cleric's, a Land druid's by terrain).
        subclassSpells: Object.fromEntries(
          (c.subclasses as Ref[]).map((s) => {
            const row = subclassRows.find((r) => r.index === s.index)
            return [
              s.index,
              ((row?.spells ?? []) as Raw[]).map((sp) => ({
                spell: sp.spell.index,
                level: (sp.prerequisites as Raw[]).find((p) => p.type === 'level')?.index?.match(/(\d+)$/)?.[1]
                  ? Number((sp.prerequisites as Raw[]).find((p) => p.type === 'level').index.match(/(\d+)$/)[1])
                  : 1,
                terrain:
                  (sp.prerequisites as Raw[])
                    .find((p) => p.type === 'feature')
                    ?.index?.replace(/^circle-of-the-land-/, '') ?? null,
              })),
            ]
          }),
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
      // Half-elves pick two abilities for +1 each; humans and half-elves pick extra languages.
      abilityBonusChoice: r.ability_bonus_options
        ? {
            choose: r.ability_bonus_options.choose,
            from: (r.ability_bonus_options.from.options as Raw[]).map((o) => ABILITY[o.ability_score.index]),
          }
        : undefined,
      languageChoices: r.language_options?.choose ?? 0,
      subraces: subraces
        .filter((s) => s.race.index === r.index)
        .map((s) => ({
          index: s.index,
          name: s.name,
          abilityBonuses: bonuses(s.ability_bonuses),
          traits: (s.racial_traits as Ref[]).map((t) => t.index),
          languageChoices: s.language_options?.choose ?? 0,
        })),
    })),
    traits: Object.fromEntries(
      traits.map((t) => [
        t.index,
        {
          name: t.name,
          desc: text(t.desc),
          // A choice the trait brings: a high elf's cantrip, a dragonborn's ancestry.
          choice: t.trait_specific?.spell_options
            ? {
                kind: 'spell',
                choose: t.trait_specific.spell_options.choose,
                from: optionValues(t.trait_specific.spell_options.from),
              }
            : t.trait_specific?.subtrait_options
              ? {
                  kind: 'trait',
                  choose: t.trait_specific.subtrait_options.choose,
                  from: optionValues(t.trait_specific.subtrait_options.from),
                }
              : undefined,
          damageType: t.trait_specific?.damage_type?.name?.toLowerCase(),
          breath: t.trait_specific?.breath_weapon
            ? {
                area: t.trait_specific.breath_weapon.area_of_effect,
                save: ABILITY[t.trait_specific.breath_weapon.dc?.dc_type?.index] ?? null,
              }
            : undefined,
        },
      ]),
    ),
  })

  write('backgrounds.json', {
    backgrounds: backgrounds.map((b) => ({
      index: b.index,
      name: b.name,
      skills: (b.starting_proficiencies as Ref[])
        .filter((p) => p.index.startsWith('skill-'))
        .map((p) => p.index.replace(/^skill-/, '')),
      feature: b.feature ? { name: b.feature.name, desc: text(b.feature.desc) } : null,
      languageChoices: b.language_options?.choose ?? 0,
      gear: ((b.starting_equipment ?? []) as Raw[]).map((e) => ({ item: e.equipment.index, quantity: e.quantity })),
      gearChoices: ((b.starting_equipment_options ?? []) as Raw[]).map(gearChoice),
      gold: b.starting_gold ? copper(b.starting_gold) / 100 : 0,
      // Ideas for who the character is, to pick from or write your own.
      personality: optionValues(b.personality_traits?.from),
      ideals: optionValues(b.ideals?.from),
      bonds: optionValues(b.bonds?.from),
      flaws: optionValues(b.flaws?.from),
    })),
  })

  write('features.json', {
    features: Object.fromEntries(
      features.map((f) => [
        f.index,
        {
          name: f.name,
          class: f.class?.index ?? null,
          subclass: f.subclass?.index ?? null,
          level: f.level,
          desc: text(f.desc),
          // What the feature asks you to choose: a fighting style, two skills for expertise, invocations.
          choice: (() => {
            const fs = f.feature_specific
            if (!fs) return undefined
            if (fs.subfeature_options) {
              return {
                kind: 'feature',
                choose: fs.subfeature_options.choose,
                from: optionValues(fs.subfeature_options.from),
              }
            }
            if (fs.expertise_options) {
              // A rogue's "two skills, or one skill and thieves' tools" is two picks from the skills and the tools.
              const nested = (fs.expertise_options.from.options as Raw[]).filter((o) => o.option_type === 'choice')
              const flat = (o: Raw): string[] =>
                o.option_type === 'choice'
                  ? (o.choice.from.options as Raw[]).flatMap(flat)
                  : o.option_type === 'multiple'
                    ? (o.items as Raw[]).flatMap(flat)
                    : o.item
                      ? [o.item.index]
                      : []
              return {
                kind: 'skill',
                choose: nested.length > 0 ? nested[0].choice.choose : fs.expertise_options.choose,
                from: [...new Set((fs.expertise_options.from.options as Raw[]).flatMap(flat))].map((o) =>
                  o.replace(/^skill-/, ''),
                ),
              }
            }
            if (fs.invocations) {
              return { kind: 'feature', choose: 0, from: (fs.invocations as Ref[]).map((i) => i.index) }
            }
            const strings = fs.enemy_type_options ?? fs.terrain_type_options
            if (strings) return { kind: 'text', choose: strings.choose, from: optionValues(strings.from) }
            return undefined
          })(),
          parent: f.parent?.index ?? undefined,
          prerequisites: ((f.prerequisites ?? []) as Raw[]).map((p) =>
            p.type === 'level'
              ? { level: p.level as number }
              : p.type === 'spell'
                ? { spell: String(p.spell).split('/').pop() }
                : { feature: String(p.feature).split('/').pop() },
          ),
        },
      ]),
    ),
  })

  // Armour and gear, for starting kits, AC and the shop. Costs are in copper pieces.
  const categoryItems = (index: string): string[] =>
    ((categories.find((c) => c.index === index)?.equipment ?? []) as Ref[]).map((e) => e.index)
  write('equipment.json', {
    items: equipment.map((e) => ({
      index: e.index,
      name: e.name,
      kind: e.equipment_category.index,
      sub:
        e.armor_category ?? e.weapon_category ?? e.gear_category?.name ?? e.tool_category ?? e.vehicle_category ?? null,
      weight: e.weight ?? 0,
      cost: copper(e.cost),
      contents: e.contents
        ? (e.contents as Raw[]).map((c) => ({ item: c.item.index, quantity: c.quantity }))
        : undefined,
      armour: e.armor_class
        ? {
            base: e.armor_class.base,
            dexBonus: e.armor_class.dex_bonus,
            maxDex: e.armor_class.max_bonus ?? null,
            strength: e.str_minimum ?? 0,
            stealthDisadvantage: e.stealth_disadvantage ?? false,
          }
        : undefined,
    })),
    // The categories a starting-gear choice can ask for ("a martial weapon", "a musical instrument").
    categories: Object.fromEntries(
      [
        ...new Set(
          [
            ...classes.flatMap((c) => c.starting_equipment_options ?? []),
            ...backgrounds.flatMap((b) => b.starting_equipment_options ?? []),
          ]
            .flatMap((choice: Raw) => JSON.stringify(choice).match(/equipment-categories\/([a-z-]+)/g) ?? [])
            .map((m: string) => m.split('/').pop() as string),
        ),
      ].map((index) => [index, categoryItems(index)]),
    ),
  })

  // A spell's damage comes as a list (one entry for every spell in the SRD).
  const spellDamage = (s: Raw): Raw | undefined => (Array.isArray(s.damage) ? s.damage[0] : s.damage)
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
      damage: spellDamage(s)?.damage_type
        ? {
            type: String(spellDamage(s)?.damage_type?.name ?? '').toLowerCase(),
            slots: spellDamage(s)?.damage_at_slot_level,
            levels: spellDamage(s)?.damage_at_character_level,
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
      // Skills it's proficient in, as the whole bonus: { stealth: 6 }.
      skills: Object.fromEntries(
        ((m.proficiencies ?? []) as Raw[])
          .filter((p) => String(p.proficiency?.index ?? '').startsWith('skill-'))
          .map((p) => [String(p.proficiency.index).slice('skill-'.length), p.value as number]),
      ),
      // Saving throws it's proficient in, as the whole bonus: { dexterity: 5 }.
      saves: Object.fromEntries(
        ((m.proficiencies ?? []) as Raw[])
          .filter((p) => String(p.proficiency?.index ?? '').startsWith('saving-throw-'))
          .map((p) => [ABILITY[String(p.proficiency.index).slice('saving-throw-'.length)], p.value as number]),
      ),
    })),
  })
  // Magic items: the real items, not the "any potion of healing" parents with variants. A +1
  // weapon, armour or ammunition is one item here; the table pairs it with a weapon or armour.
  write('magic-items.json', {
    items: magicItems
      .filter((m) => !(m.variants as Raw[] | undefined)?.length)
      .map((m) => {
        const [line, ...rest] = m.desc as string[]
        const plus = /^(weapon|armor|ammunition)-(\d)$/.exec(m.index)
        return {
          index: m.index,
          name: m.name,
          kind: m.equipment_category.index,
          rarity: m.rarity.name,
          attune: /requires attunement/i.test(line ?? ''),
          ...(plus ? { bonus: Number(plus[2]) } : {}),
          line: line ?? '',
          desc: rest.join('\n\n'),
        }
      }),
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
