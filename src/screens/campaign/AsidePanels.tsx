import { CameraCheck } from '../../call/CameraCheck.tsx'
import { useTableCall } from '../../call/callContext.ts'
import { cx } from '../../components/cx.ts'
import { Panel } from '../../components/Panel.tsx'
import type { Member } from '../../live/campaigns.ts'
import type { Character } from '../../rules/character.ts'
import styles from './AsidePanels.module.css'

type AtTheTableProps = {
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  myId: string
  partySize: number
}

/** Who is at the table right now, as on the Join screen design, with empty seats shown. */
export function AtTheTablePanel({ members, characters, online, myId, partySize }: AtTheTableProps) {
  const dm = members.filter((member) => member.role === 'dm')
  const players = members.filter((member) => member.role === 'player')
  const emptySeats = Math.max(0, partySize - players.length)
  const call = useTableCall()

  return (
    <Panel title="At the table now">
      <ul className={styles.people}>
        {[...dm, ...players].map((member) => {
          const here = online.has(member.user_id)
          const inCall = call?.calls.has(member.user_id) ?? false
          const state = inCall ? 'In the call' : here ? 'Here' : member.here_tonight ? 'Not here yet' : 'Not tonight'
          const character = characters.find((c) => c.ownerId === member.user_id)
          return (
            <li key={member.user_id} className={styles.person}>
              <span className={cx(styles.dot, here && styles.here)} aria-hidden="true" />
              <span className={styles.name}>
                {member.display_name}
                {member.role === 'dm' && ' (DM)'}
                {member.user_id === myId && ' · you'}
                {character && ` · ${character.name}`}
              </span>
              <span className={styles.state}>{state}</span>
            </li>
          )
        })}
        {Array.from({ length: emptySeats }, (_, i) => (
          <li key={`seat-${i}`} className={cx(styles.person, styles.empty)}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.name}>Empty seat</span>
            <span className={styles.state}>Waiting</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** "Your camera" from the Join screen design: check it, pick your devices and join the call. */
export function CameraPanel({ isDm = false }: { isDm?: boolean }) {
  return (
    <Panel title="Your camera">
      <CameraCheck isDm={isDm} />
    </Panel>
  )
}
