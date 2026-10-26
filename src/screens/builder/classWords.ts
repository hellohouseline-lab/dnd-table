// The builder's plain words for each SRD class: one line on the card, how it plays, and an emblem.

import type { IconName } from '../../components/Icon.tsx'
import { SKILLS } from '../../rules/srd/index.ts'

/** A skill's name from its index; thieves' tools too, for expertise. */
export const skillName = (index: string) =>
  index === 'thieves-tools' ? 'Thieves’ tools' : (SKILLS.find((s) => s.index === index)?.name ?? index)

export const CLASS_WORDS: Record<string, { line: string; plays: string; icon: IconName }> = {
  barbarian: {
    line: 'A furious warrior who rages through pain.',
    plays: 'Front line. Lots of hit points; rage to hit harder and shrug off blows.',
    icon: 'axe',
  },
  bard: {
    line: 'A performer whose music and words are magic.',
    plays: 'Helper and talker. Inspire friends, heal a little, charm and trick foes.',
    icon: 'music',
  },
  cleric: {
    line: 'A priest who channels the power of a god.',
    plays: 'Healer and protector, in armour. Bless friends, heal wounds, smite the undead.',
    icon: 'sun',
  },
  druid: {
    line: 'A keeper of the wild who can turn into beasts.',
    plays: 'Nature magic and Wild Shape: become a wolf or a bear when it counts.',
    icon: 'leaf',
  },
  fighter: {
    line: 'A trained soldier, master of weapons and armour.',
    plays: 'Simple and strong. Hits hard, wears the best armour, catches a second wind.',
    icon: 'sword',
  },
  monk: {
    line: 'A martial artist who fights with fists and focus.',
    plays: 'Fast and slippery. Many quick strikes, no armour needed, ki for tricks.',
    icon: 'fist',
  },
  paladin: {
    line: 'A holy knight bound by an oath.',
    plays: 'Front line with healing hands. Smite foes with radiant power.',
    icon: 'shield',
  },
  ranger: {
    line: 'A hunter and tracker of the wilds.',
    plays: 'Bow and blade. Tracks prey, knows the land, a little nature magic.',
    icon: 'bow',
  },
  rogue: {
    line: 'A sneak and a specialist with a deadly strike.',
    plays: 'Stealth and skill. Strike hard from hiding; Cunning Action gets you out.',
    icon: 'dagger',
  },
  sorcerer: {
    line: 'Magic in the blood, shaped by will.',
    plays: 'Blast and bend spells. Fewer spells than a wizard, but twisted to suit you.',
    icon: 'flame',
  },
  warlock: {
    line: 'A spellcaster who made a pact with a patron.',
    plays: 'Eldritch Blast every turn, a few strong spells, and strange gifts.',
    icon: 'eye',
  },
  wizard: {
    line: 'A scholar of magic with a book of spells.',
    plays: 'The most spells. Fragile, so stay back and change the fight with magic.',
    icon: 'staff',
  },
}
