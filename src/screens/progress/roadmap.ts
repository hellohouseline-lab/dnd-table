// The build progress shown on the holding page. Update the statuses as each milestone merges.

export type MilestoneStatus = 'ready' | 'next' | 'later'

export type Milestone = {
  name: string
  detail: string
  status: MilestoneStatus
}

export const ROADMAP: Milestone[] = [
  { name: 'The table is set', detail: 'The look of the table, the credits and this page', status: 'ready' },
  { name: 'Sign in and join', detail: 'Email login links, the campaign and its join code', status: 'ready' },
  { name: 'Character sheets', detail: 'Type in your character and the maths is done for you', status: 'ready' },
  { name: 'Dice', detail: '3D dice in metal, glass and stone, and a log of every roll', status: 'ready' },
  { name: 'Asking for rolls', detail: 'The DM asks, you roll, the DM rules pass or fail', status: 'ready' },
  { name: 'Story and stage', detail: "The DM's notebook, scene art, music and sound", status: 'ready' },
  { name: 'Combat', detail: 'The battle map, tokens and turn order', status: 'ready' },
  { name: 'Cameras and voice', detail: 'Everyone on camera and talking, inside the table', status: 'ready' },
  { name: 'Turns and attacks', detail: 'Whose turn it is, what you have left, and attacks that land', status: 'ready' },
  {
    name: 'Spells and the fight’s rules',
    detail: 'Spells with slots and concentration, areas on the map, opportunity attacks and death saves',
    status: 'ready',
  },
  {
    name: 'Cards that explain themselves',
    detail: 'What each attack, spell and feature does, and quick checks for the DM',
    status: 'ready',
  },
  {
    name: 'The DM has the last word',
    detail: 'The DM rules on every roll, players roll for the DM, death saves anywhere, concentration tracked',
    status: 'ready',
  },
  {
    name: 'Character builder',
    detail: 'Build step by step or pick a ready-made character, with gear, spells and a backstory',
    status: 'ready',
  },
  {
    name: 'Levelling up',
    detail: 'The DM says when; every choice is a card; see the path ahead',
    status: 'ready',
  },
  {
    name: 'Items and gold',
    detail: 'Give items and gold, take them back, offers, boxes to open, the party stash, and what things are worth',
    status: 'ready',
  },
  { name: 'Shops', detail: 'Shopkeepers with stock and prices; buy, sell and haggle', status: 'ready' },
  {
    name: 'Story mode',
    detail: 'Chapters and scenes with Go here, planned rolls and fights, secret outcomes, and NPCs to show',
    status: 'ready',
  },
  {
    name: 'Your campaign in one paste',
    detail:
      'Paste a campaign (yours, or written by an AI from the campaign template) and it becomes chapters, scenes, people, items and ready fights, with how hard each fight is',
    status: 'ready',
  },
  {
    name: 'NPC notes and the party stash',
    detail: 'What has happened with each person, noted when you show them; add or take coins in the party stash',
    status: 'ready',
  },
  {
    name: 'Rules for players',
    detail: 'Conditions, your turn, dice, rests and spells in plain words, beside the table, for players and the DM',
    status: 'ready',
  },
  {
    name: 'The rest of the combat rules',
    detail: 'Talk cards for a parley, and conditions that wear off by themselves',
    status: 'next',
  },
  { name: 'Stream overlay', detail: "The table on everyone's Twitch stream", status: 'later' },
  { name: 'Rehearsal', detail: 'A full dry run and final polish before the first stream', status: 'later' },
  {
    name: 'A whole campaign, built for you',
    detail:
      'Give the table one campaign file and it makes the shops, stocks them and sets everything up (a later phase)',
    status: 'later',
  },
]

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  ready: 'Ready',
  next: 'Up next',
  later: 'Later',
}
