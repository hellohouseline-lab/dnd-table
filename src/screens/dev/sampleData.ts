// Made-up people and characters for the local design previews and the render tests.
// Never used by the live site.

import type { Campaign, Member } from '../../live/campaigns.ts'
import { newBuild, type Character } from '../../rules/character.ts'

export const sampleCampaign: Campaign = {
  id: 'preview',
  name: 'The Sunless Citadel',
  dm_id: 'dm',
  party_size: 4,
  starting_level: 2,
  join_code: 'K7QM2P',
  camera_key: 'abcdef0123456789abcdef01',
  created_at: '2026-10-25T20:00:00Z',
}

const joined = '2026-10-20T20:00:00Z'

export const sampleMembers: Member[] = [
  {
    campaign_id: 'preview',
    user_id: 'dm',
    camera_id: 'dndpreviewdm',
    role: 'dm',
    display_name: 'Matt',
    here_tonight: true,
    joined_at: joined,
    dice_style: {},
  },
  {
    campaign_id: 'preview',
    user_id: 'p1',
    camera_id: 'dndpreviewp1',
    role: 'player',
    display_name: 'Sam',
    here_tonight: true,
    joined_at: joined,
    dice_style: { material: 'glass', colour: 'ruby', numbers: 'gold' },
  },
  {
    campaign_id: 'preview',
    user_id: 'p2',
    camera_id: 'dndpreviewp2',
    role: 'player',
    display_name: 'Alex',
    here_tonight: false,
    joined_at: joined,
    dice_style: { material: 'stone', colour: 'slate', numbers: 'white' },
  },
]

const trackers = {
  campaignId: 'preview',
  tempHp: 0,
  hitDiceUsed: 0,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
  stable: false,
  dead: false,
  concentrationDc: null,
  conditions: [],
  resistances: [],
  vulnerabilities: [],
  immunities: [],
  exhaustion: 0,
  inspiration: false,
  concentration: null,
  portraitPath: null,
  updatedAt: joined,
}

export const sampleFighter: Character = {
  ...newBuild(),
  ...trackers,
  id: 'fighter',
  ownerId: 'p1',
  name: 'Thorin Ironfist',
  race: 'Dwarf',
  subrace: 'Hill Dwarf',
  className: 'Fighter',
  background: 'Acolyte',
  level: 2,
  scores: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 12, charisma: 8 },
  maxHp: 20,
  currentHp: 17,
  armourClass: 18,
  speed: 25,
  hitDie: 10,
  saveProficiencies: ['strength', 'constitution'],
  skillProficiencies: ['athletics', 'insight', 'perception', 'religion'],
  otherProficiencies: 'All armor, Shields, Simple Weapons, Martial Weapons',
  languages: 'Common, Dwarvish',
  attacks: [
    {
      id: 'a1',
      name: 'Longsword',
      weapon: 'longsword',
      proficient: true,
      magicBonus: 0,
      ability: 'strength',
      damageDice: '',
      damageType: '',
    },
    {
      id: 'a2',
      name: 'Handaxe',
      weapon: 'handaxe',
      proficient: true,
      magicBonus: 0,
      ability: 'strength',
      damageDice: '',
      damageType: '',
    },
  ],
  features: [
    {
      id: 'f1',
      name: 'Second Wind',
      description: 'On your turn, use a bonus action to regain 1d10 + your fighter level hit points.',
      usesMax: 1,
      usesLeft: 1,
      recharge: 'short',
    },
    {
      id: 'f2',
      name: 'Action Surge',
      description: 'On your turn, take one additional action.',
      usesMax: 1,
      usesLeft: 0,
      recharge: 'short',
    },
    {
      id: 'f3',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet.',
      usesMax: null,
      usesLeft: 0,
      recharge: null,
    },
  ],
}

export const sampleWizard: Character = {
  ...newBuild(),
  ...trackers,
  id: 'wizard',
  ownerId: 'p2',
  name: 'Elowen',
  race: 'Elf',
  subrace: 'High Elf',
  className: 'Wizard',
  level: 2,
  scores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 12, charisma: 10 },
  maxHp: 14,
  currentHp: 12,
  armourClass: 12,
  hitDie: 6,
  saveProficiencies: ['intelligence', 'wisdom'],
  skillProficiencies: ['arcana', 'history'],
  spellcasting: {
    ability: 'intelligence',
    slotsMax: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    slotsUsed: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    spells: [
      { id: 's1', index: 'fire-bolt', name: 'Fire Bolt', level: 0, prepared: true },
      { id: 's2', index: 'magic-missile', name: 'Magic Missile', level: 1, prepared: true },
      { id: 's3', index: 'sleep', name: 'Sleep', level: 1, prepared: false },
    ],
  },
  conditions: ['poisoned'],
  resistances: [],
  vulnerabilities: [],
  immunities: [],
}

export const sampleCharacters = [sampleFighter, sampleWizard]
