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
    detail: 'Give items and gold, offers, boxes to open and the party stash',
    status: 'ready',
  },
  { name: 'Shops', detail: 'Shopkeepers with stock and prices; buy and sell', status: 'ready' },
  { name: 'Story mode', detail: 'Your campaign on the DM’s screen, scene by scene', status: 'next' },
  {
    name: 'The rest of the combat rules',
    detail: 'Talk cards for a parley, and conditions that wear off by themselves',
    status: 'later',
  },
  { name: 'Stream overlay', detail: "The table on everyone's Twitch stream", status: 'later' },
  { name: 'Rehearsal', detail: 'A full dry run and final polish before the first stream', status: 'later' },
]

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  ready: 'Ready',
  next: 'Up next',
  later: 'Later',
}
