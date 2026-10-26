// The builder's plain words for each SRD race and subrace: one line on the card, in our own words.

import type { IconName } from '../../components/Icon.tsx'

export const RACE_WORDS: Record<string, string> = {
  dwarf: 'Tough and steady. Hard to poison, sees in the dark, and heavy armour doesn’t slow you.',
  elf: 'Graceful and keen-eyed. Never truly sleeps, can’t be charmed easily, and sees in the dark.',
  halfling: 'Small, nimble and lucky: roll a 1 and you can roll again. Brave in the face of fear.',
  human: 'Adaptable and ambitious: +1 to every ability score, and an extra language.',
  dragonborn: 'Dragon blood: breathe fire, frost or lightning once a rest, and shrug off that damage.',
  gnome: 'Small, clever and curious. Hard to fool with magic, and sees in the dark.',
  'half-elf': 'Charming and versatile: +2 Charisma, +1 to two more of your choice, and two extra skills.',
  'half-orc': 'Strong and fierce. Once a day, drop to 1 hit point instead of 0, and land savage critical hits.',
  tiefling: 'Infernal heritage: resistant to fire, sees in the dark, and knows a little magic.',
  other: 'Playing a race from another book? Type its name here and add its traits on your sheet.',
}

export const SUBRACE_WORDS: Record<string, string> = {
  'hill-dwarf': 'Wise and hardy: +1 Wisdom and an extra hit point every level.',
  'high-elf': 'Sharp-minded: +1 Intelligence, a wizard cantrip and an extra language.',
  'lightfoot-halfling': 'Easy to overlook: +1 Charisma, and can hide behind bigger folk.',
  'rock-gnome': 'Tinkerer: +1 Constitution, knows how things are made, builds clockwork toys.',
}

/** Each race's emblem on its card. */
export const RACE_EMBLEMS: Record<string, IconName> = {
  dwarf: 'hammer',
  elf: 'bow',
  halfling: 'leaf',
  human: 'sword',
  dragonborn: 'flame',
  gnome: 'cog',
  'half-elf': 'star',
  'half-orc': 'axe',
  tiefling: 'horns',
}
