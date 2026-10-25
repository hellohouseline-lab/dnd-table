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
  { name: 'Character sheets', detail: 'Type in your character and the maths is done for you', status: 'next' },
  { name: 'Dice', detail: '3D dice in metal, glass and stone, and a log of every roll', status: 'later' },
  { name: 'Asking for rolls', detail: 'The DM asks, you roll, everyone sees pass or fail', status: 'later' },
  { name: 'Story and stage', detail: "The DM's notebook, scene art, music and sound", status: 'later' },
  { name: 'Combat', detail: 'The battle map, tokens and turn order', status: 'later' },
  { name: 'Cameras', detail: 'Everyone on camera inside the table', status: 'later' },
  { name: 'Stream overlay', detail: "The table on everyone's Twitch stream", status: 'later' },
  { name: 'Rehearsal', detail: 'A full dry run and final polish before the first stream', status: 'later' },
]

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  ready: 'Ready',
  next: 'Up next',
  later: 'Later',
}
