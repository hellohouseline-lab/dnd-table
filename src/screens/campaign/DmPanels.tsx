import { useState, type FormEvent } from 'react'
import { href, navigate } from '../../app/router.ts'
import { ButtonLink } from '../../components/Button.tsx'
import { buttonClassName } from '../../components/buttonClassName.ts'
import { cx } from '../../components/cx.ts'
import { Notice } from '../../components/Notice.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Parchment } from '../../components/Parchment.tsx'
import {
  removeMember,
  renewJoinCode,
  setHereTonight,
  deleteCampaign,
  updateCampaign,
  type Campaign,
  type Member,
} from '../../live/campaigns.ts'
import { messageFor } from '../../live/errors.ts'
import { inviteLink } from '../../live/joinCode.ts'
import type { Character } from '../../rules/character.ts'
import { CampaignFields, type CampaignForm } from './CampaignFields.tsx'
import { seatsFilled } from './describeParty.ts'
import styles from './DmPanels.module.css'

/** The way into the DM's own screen: the party at a glance, the roll log and the DM's dice. */
export function DmScreenPanel({ campaign }: { campaign: Campaign }) {
  return (
    <Panel title="Run the game">
      <p className={styles.text}>
        Your DM screen shows the party at a glance, everyone&rsquo;s dice as they land and the roll log. Keep it open
        while you play.
      </p>
      <ButtonLink href={href(`/c/${campaign.id}/dm`)} variant="primary">
        Open the DM screen
      </ButtonLink>
    </Panel>
  )
}

type DmInviteProps = { campaign: Campaign; siteUrl: string; onRenewed: () => void }

/** The join code and invite link, with copy and "make a new code". */
export function DmInvitePanel({ campaign, siteUrl, onRenewed }: DmInviteProps) {
  const link = inviteLink(siteUrl, campaign.join_code)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Your browser blocked copying. Select the link and copy it yourself.')
    }
  }

  async function renew() {
    setBusy(true)
    setError(null)
    try {
      await renewJoinCode(campaign.id)
      setConfirming(false)
      onRenewed()
    } catch (caught) {
      setError(messageFor(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Parchment title="Invite your players" corners>
      <p className={styles.inkText}>
        Send each player the invite link. They sign in with their email, type the name they want at the table, and
        they&rsquo;re in. They can also type the code on their Your tables page.
      </p>
      <div className={styles.codeBlock}>
        <span className={styles.codeLabel}>Join code</span>
        <span className={styles.code} aria-label={`Join code ${campaign.join_code.split('').join(' ')}`}>
          {campaign.join_code}
        </span>
      </div>
      <div className={styles.link}>{link}</div>
      <div className={styles.actions}>
        <button type="button" className={buttonClassName('ink', { size: 'small' })} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        {confirming ? (
          <span className={styles.confirm}>
            <span>The old code and link will stop working.</span>
            <button
              type="button"
              className={buttonClassName('ink', { size: 'small' })}
              disabled={busy}
              onClick={() => void renew()}
            >
              Make a new code
            </button>
            <button type="button" className={buttonClassName('quietInk')} onClick={() => setConfirming(false)}>
              Keep this one
            </button>
          </span>
        ) : (
          <button type="button" className={buttonClassName('quietInk')} onClick={() => setConfirming(true)}>
            Make a new code
          </button>
        )}
      </div>
      {error && <div className={styles.inkError}>{error}</div>}
    </Parchment>
  )
}

type DmPartyProps = {
  campaign: Campaign
  members: Member[]
  characters: Character[]
  online: ReadonlySet<string>
  onChanged: () => void
}

/** Everyone who has joined, with their character, "Here tonight" and "Remove" for each player. */
export function DmPartyPanel({ campaign, members, characters, online, onChanged }: DmPartyProps) {
  const players = members.filter((member) => member.role === 'player')
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      setError(messageFor(caught))
    }
  }

  return (
    <Panel title="The party">
      <p>{seatsFilled(players.length, campaign.party_size)}.</p>
      {players.length > 0 && (
        <ul className={styles.party}>
          {players.map((player) => {
            const character = characters.find((c) => c.ownerId === player.user_id)
            return (
              <li key={player.user_id} className={styles.player}>
                <span className={cx(styles.dot, online.has(player.user_id) && styles.here)} aria-hidden="true" />
                <span className={styles.playerName}>
                  {player.display_name}
                  <span className={styles.characterName}>
                    {character ? ` · ${character.name}` : ' · no character yet'}
                  </span>
                </span>
                {character && (
                  <ButtonLink href={href(`/c/${campaign.id}/sheet/${character.id}`)} variant="quiet">
                    Sheet
                  </ButtonLink>
                )}
                <label className={styles.tonight}>
                  <input
                    type="checkbox"
                    checked={player.here_tonight}
                    onChange={(event) =>
                      void act(() => setHereTonight(campaign.id, player.user_id, event.target.checked))
                    }
                  />
                  Here tonight
                </label>
                {removing === player.user_id ? (
                  <span className={styles.confirm}>
                    <button
                      type="button"
                      className={buttonClassName('outline', { size: 'small' })}
                      onClick={() => void act(() => removeMember(campaign.id, player.user_id))}
                    >
                      Remove {player.display_name}
                    </button>
                    <button type="button" className={buttonClassName('quiet')} onClick={() => setRemoving(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={buttonClassName('quiet')}
                    onClick={() => setRemoving(player.user_id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Panel>
  )
}

/** Change the campaign's name, party size or starting level. */
export function DmDetailsPanel({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const [form, setForm] = useState<CampaignForm>({
    name: campaign.name,
    party_size: campaign.party_size,
    starting_level: campaign.starting_level,
  })
  // Gold for every new character's purse, on top of their background's.
  const [gold, setGold] = useState(campaign.starting_gold)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function remove() {
    if (
      !window.confirm(
        `Delete ${campaign.name} for everyone? Its characters, story, pictures, sounds and rolls all go, and it can't be undone.`,
      )
    )
      return
    setDeleting(true)
    setMessage(null)
    try {
      await deleteCampaign(campaign.id)
      navigate('/', { replace: true })
    } catch (caught) {
      setMessage({ tone: 'error', text: messageFor(caught) })
      setDeleting(false)
    }
  }
  const changed =
    form.name !== campaign.name ||
    form.party_size !== campaign.party_size ||
    form.starting_level !== campaign.starting_level ||
    gold !== campaign.starting_gold

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateCampaign(campaign.id, { ...form, starting_gold: gold })
      setMessage({ tone: 'success', text: 'Saved.' })
      onSaved()
    } catch (caught) {
      setMessage({ tone: 'error', text: messageFor(caught) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Campaign details">
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <CampaignFields
          value={form}
          onChange={(value) => {
            setForm(value)
            setMessage(null)
          }}
        />
        <label className={styles.goldField}>
          <span>Starting gold (gp), on top of each background&rsquo;s</span>
          <input
            type="number"
            min={0}
            max={100000}
            value={gold}
            onChange={(event) => {
              setGold(Math.max(0, Math.min(100000, Math.round(Number(event.target.value) || 0))))
              setMessage(null)
            }}
          />
        </label>
        <p className={styles.goldNote}>
          A character made below the starting level, or below the party&rsquo;s level if they&rsquo;ve gone further,
          levels up to it straight away, one level at a time. Someone dropping in for a night joins with the invite
          link, makes a character, and you can add them to a fight that&rsquo;s already going.
        </p>
        <div>
          <button type="submit" className={buttonClassName('primary', { size: 'small' })} disabled={saving || !changed}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </form>
      <div className={styles.danger}>
        <button
          type="button"
          className={buttonClassName('outline', { size: 'small' })}
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? 'Deleting…' : 'Delete this table'}
        </button>
        <span className={styles.goldNote}>
          For everyone: characters, story, pictures, sounds and rolls. It can&rsquo;t be undone.
        </span>
      </div>
    </Panel>
  )
}
