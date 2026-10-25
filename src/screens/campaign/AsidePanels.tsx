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

  return (
    <Panel title="At the table now">
      <ul className={styles.people}>
        {[...dm, ...players].map((member) => {
          const here = online.has(member.user_id)
          const state = here ? 'Here' : member.here_tonight ? 'Not here yet' : 'Not tonight'
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

/** Holds the camera box from the design until cameras arrive in milestone 7. */
export function CameraPanel() {
  return (
    <Panel title="Your camera">
      <div className={styles.preview}>Camera preview 16:9</div>
      <div className={styles.small}>
        Cameras come in a later milestone, once your group has picked how to share video and voice.
      </div>
    </Panel>
  )
}
