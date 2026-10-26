// The builder's steps, in order (docs/C2_PLAN.md).

export const STEPS = [
  { key: 'race', name: 'Race', hint: 'Where you come from' },
  { key: 'class', name: 'Class', hint: 'What you do' },
  { key: 'background', name: 'Background', hint: 'Who you were' },
  { key: 'scores', name: 'Ability scores', hint: 'What you’re good at' },
  { key: 'level', name: 'Level', hint: 'If the DM starts you higher' },
  { key: 'gear', name: 'Gear', hint: 'What you carry' },
  { key: 'spells', name: 'Spells', hint: 'For spellcasters' },
  { key: 'who', name: 'Who they are', hint: 'Name, looks and story' },
  { key: 'review', name: 'Review', hint: 'Check and save' },
] as const

export type StepKey = (typeof STEPS)[number]['key']
