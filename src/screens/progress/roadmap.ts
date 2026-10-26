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
  { name: 'Asking for rolls', detail: 'The DM asks, you roll, everyone sees pass or fail', status: 'ready' },
  { name: 'Story and stage', detail: "The DM's notebook, scene art, music and sound", status: 'ready' },
  { name: 'Combat', detail: 'The battle map, tokens and turn order', status: 'ready' },
  { name: 'Cameras', detail: 'Everyone on camera inside the table', status: 'next' },
  { name: 'Stream overlay', detail: "The table on everyone's Twitch stream", status: 'later' },
  { name: 'Rehearsal', detail: 'A full dry run and final polish before the first stream', status: 'later' },
]

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  ready: 'Ready',
  next: 'Up next',
  later: 'Later',
}
