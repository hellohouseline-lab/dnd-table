import { useEffect, useState } from 'react'
import { cx } from '../../../components/cx.ts'
import { matchName, parseCampaign, planWarnings, planWords, type CampaignPlan } from '../../../rules/campaignFile.ts'
import { AI_PROMPT_TO_COPY, CAMPAIGN_EXAMPLE } from '../../../rules/campaignTemplate.ts'
import { DIFFICULTY_WORDS, encounterDifficulty } from '../../../rules/encounter.ts'
import type { SrdMonster } from '../../../rules/srd/index.ts'
import type { CampaignPresetControls } from '../../../live/campaignPresets.ts'
import dialog from '../RestDialog.module.css'
import own from '../GiveDialog.module.css'
import styles from './PasteDialog.module.css'

type PasteDialogProps = {
  monsters: SrdMonster[]
  /** Names of pictures, music and maps in the library, and of shops, to say what won't be found. */
  assetNames: string[]
  shopNames: string[]
  /** The party's levels, for how hard each fight is. */
  partyLevels: number[]
  /** Adds the campaign to the story; resolves with what was added, or throws a problem. */
  onImport: (plan: CampaignPlan) => Promise<string>
  onClose: () => void
  /** Your saved campaigns, to start from one or save this one. */
  presets?: CampaignPresetControls
}

/**
 * Paste your notes (S1d): paste a campaign written in the table's format (by you, or by an AI with
 * Copy the format for your AI) or loose notes with headings, see what it makes before adding it,
 * then Add it to my story.
 */
export function PasteDialog({
  monsters,
  assetNames,
  shopNames,
  partyLevels,
  onImport,
  onClose,
  presets,
}: PasteDialogProps) {
  const [text, setText] = useState('')
  const saved = presets?.presets.find((p) => p.body === text) ?? null
  const [busy, setBusy] = useState(false)
  // Saving a preset adds nothing to the story, so it has its own word on its own button.
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const plan = text.trim() ? parseCampaign(text) : null
  const warnings = plan
    ? planWarnings(plan, { monsters: monsters.map((m) => m.name), assets: assetNames, shops: shopNames })
    : []

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  function fightWords(fight: { name: string; count: number }[]): string {
    const xps = fight.flatMap((f) => {
      const m = matchName(monsters, (x) => x.name, f.name)
      return m ? Array.from({ length: f.count }, () => m.xp) : []
    })
    const what = fight.map((f) => `${f.count} × ${f.name}`).join(', ')
    if (xps.length === 0 || partyLevels.length === 0) return what
    return `${what} (${DIFFICULTY_WORDS[encounterDifficulty(partyLevels, xps).difficulty]})`
  }

  async function savePreset() {
    if (!plan || !presets) return
    const name = (plan.title || 'My campaign').slice(0, 120)
    setSaving(true)
    setStatus(null)
    try {
      await presets.save(name, text)
      setStatus({
        ok: true,
        text: `Saved as a preset: ${name}. Start any table from it here, under Your saved campaigns.`,
      })
    } catch (caught) {
      setStatus({ ok: false, text: caught instanceof Error ? caught.message : String(caught) })
    }
    setSaving(false)
  }

  async function add() {
    if (!plan) return
    setBusy(true)
    setStatus(null)
    try {
      const added = await onImport(plan)
      setStatus({ ok: true, text: `Added: ${added}.` })
      setText('')
    } catch (caught) {
      setStatus({ ok: false, text: caught instanceof Error ? caught.message : String(caught) })
    }
    setBusy(false)
  }

  return (
    <div className={cx(dialog.card, own.card)} role="dialog" aria-labelledby="paste-title">
      <div className={own.head}>
        <h2 id="paste-title" className={dialog.title}>
          Paste your notes
        </h2>
        <span className={styles.grow} />
        <button
          type="button"
          className={dialog.secondary}
          onClick={() => {
            void navigator.clipboard?.writeText(AI_PROMPT_TO_COPY).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied: paste it to your AI' : 'Copy the format for your AI'}
        </button>
        <button type="button" className={dialog.secondary} onClick={() => setText(CAMPAIGN_EXAMPLE)}>
          Try the example
        </button>
      </div>
      {presets && presets.presets.length > 0 && (
        <label className={styles.saved}>
          <span>Your saved campaigns</span>
          <select
            aria-label="Your saved campaigns"
            value={saved?.id ?? ''}
            onChange={(e) => {
              const preset = presets.presets.find((p) => p.id === e.target.value)
              if (!preset) return
              setText(preset.body)
              setStatus(null)
            }}
          >
            <option value="">Start from a saved campaign…</option>
            {presets.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {saved && (
            <button
              type="button"
              className={dialog.secondary}
              onClick={() => {
                if (window.confirm(`Forget the saved campaign ${saved.name}? Tables already started from it keep it.`))
                  void presets.remove(saved.id).then(() => setText(''))
              }}
            >
              Forget it
            </button>
          )}
        </label>
      )}
      <p className={dialog.lead}>
        Paste your campaign: chapters as <strong># Chapter 1:</strong> headings, scenes as{' '}
        <strong>## Scene 1.1:</strong> headings, and lines such as <strong>Read aloud:</strong>, <strong>Rolls:</strong>
        , <strong>Fight:</strong> and <strong>People:</strong>. Copy the format for your AI gives Fable (or any AI) the
        whole template and an example to fill in from your notes. Loose notes with headings work too. It all stays
        private to you.
      </p>

      <div className={styles.layout}>
        <textarea
          className={styles.paste}
          value={text}
          placeholder="# Chapter 1: The Village&#10;&#10;## Scene 1.1: The Gull and Anchor&#10;Read aloud:&#10;> Rain drums on the shutters…"
          aria-label="Your campaign notes"
          onChange={(e) => {
            setText(e.target.value)
            setStatus(null)
          }}
        />
        <section className={styles.preview} aria-label="What it makes">
          {!plan ? (
            <p className={dialog.note}>What it makes shows here as you paste.</p>
          ) : (
            <>
              <p className={styles.summary}>
                {plan.title && <strong>{plan.title}: </strong>}
                {planWords(plan)}
              </p>
              {plan.chapters.map((chapter, i) => (
                <div key={i} className={styles.chapter}>
                  <div className={styles.chapterTitle}>{chapter.title}</div>
                  <ul className={styles.scenes}>
                    {chapter.scenes.map((scene, j) => (
                      <li key={j}>
                        <span className={styles.sceneTitle}>{scene.title || 'A scene'}</span>
                        <span className={styles.bits}>
                          {[
                            scene.readAloud && 'read-aloud',
                            scene.rolls.length > 0 &&
                              `${scene.rolls.length} roll${scene.rolls.length === 1 ? '' : 's'}`,
                            scene.people.length > 0 && scene.people.join(', '),
                            scene.choices.length > 0 &&
                              `${scene.choices.length} choice${scene.choices.length === 1 ? '' : 's'}`,
                            scene.fight.length > 0 && `fight: ${fightWords(scene.fight)}`,
                            scene.gives.length + scene.boxes.length > 0 && 'things to hand out',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(plan.people.length > 0 || plan.items.length > 0) && (
                <p className={dialog.note}>
                  {[
                    plan.people.length > 0 && `People: ${plan.people.map((p) => p.name).join(', ')}`,
                    plan.items.length > 0 && `Items: ${plan.items.map((i) => i.name).join(', ')}`,
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  .
                </p>
              )}
              {warnings.length > 0 && (
                <div className={styles.warnings}>
                  <div className={styles.chapterTitle}>Worth knowing</div>
                  <ul>
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p className={dialog.note}>
                    It still adds everything: missing monsters go into the scene&rsquo;s reminders, and you can pick
                    pictures and music later.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {status && (
        <p className={status.ok ? own.ok : own.problem} role="status">
          {status.text}
        </p>
      )}
      <div className={dialog.buttons}>
        <button type="button" className={dialog.secondary} onClick={onClose}>
          Done
        </button>
        {presets && (
          <button
            type="button"
            className={dialog.secondary}
            disabled={!plan || busy || saving || saved !== null}
            title="Keep this campaign to start any of your tables from. Only you can see it."
            onClick={() => void savePreset()}
          >
            {saving ? 'Saving…' : saved ? 'Saved as a preset' : 'Save as a preset'}
          </button>
        )}
        <button type="button" className={dialog.primary} disabled={!plan || busy || saving} onClick={() => void add()}>
          {busy ? 'Adding…' : 'Add it to my story'}
        </button>
      </div>
    </div>
  )
}
