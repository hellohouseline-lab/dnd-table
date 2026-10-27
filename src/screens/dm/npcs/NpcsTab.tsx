import { useState } from 'react'
import { cx } from '../../../components/cx.ts'
import { StoredImage } from '../../../components/StoredImage.tsx'
import { PRESET_PORTRAITS, type Asset, type PresetPortrait } from '../../../live/library.ts'
import { BLANK_NPC, type Npc, type NpcControls, type NpcNote } from '../../../live/npcs.ts'
import { ATTITUDES, capital, madeUpNotes, makeSomeoneUp, type MadeUp } from '../../../rules/npcs.ts'
import type { Shop } from '../../../rules/shops.ts'
import styles from './NpcsTab.module.css'

type NpcsTabProps = {
  npcs: NpcControls
  /** Pictures from the library, for portraits. */
  library: Asset[]
  shops: Shop[]
  /** The name of whoever is on stage now ('' for nobody). */
  shownName: string
  onShow: (person: { id?: string; name: string; role: string; portraitId: string | null }) => void
  onHide: () => void
  onOpenShop: (shopId: string) => void
  /** Who to open first (from a scene). */
  startId?: string | null
  /** The note showing someone adds to their card ("Met the party at The Rusty Flagon."). */
  meetNote: string
  /** Puts a ready-made portrait in the library under People, to use as someone's portrait. */
  onAddPortrait?: (preset: PresetPortrait) => Promise<Asset>
}

/**
 * The NPCs tab on Screen 1 (S1c): your people with their portrait, role, voice, wants, knowledge,
 * secrets and attitude to the party; Show puts their portrait and name on stage for everyone. Make
 * someone up is for the person you didn't plan.
 */
export function NpcsTab({
  npcs,
  library,
  shops,
  shownName,
  onShow,
  onHide,
  onOpenShop,
  startId = null,
  meetNote,
  onAddPortrait,
}: NpcsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(startId)
  const [madeUp, setMadeUp] = useState<MadeUp | null>(null)
  const selected = npcs.npcs.find((n) => n.id === selectedId) ?? null
  const art = library.filter((a) => a.kind === 'art' && a.category !== 'maps')
  const portraitOf = (npc: Npc) => art.find((a) => a.id === npc.portraitId) ?? null

  async function add(start: Npc) {
    const saved = await npcs.save(start)
    if (saved) {
      setSelectedId(saved.id)
      setMadeUp(null)
    }
  }

  return (
    <div className={styles.tab}>
      <nav className={styles.list} aria-label="Your people">
        <div className={styles.listButtons}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void add({ ...BLANK_NPC, name: 'Someone new' })}
          >
            New person
          </button>
          <button type="button" className={styles.secondary} onClick={() => setMadeUp(makeSomeoneUp())}>
            Make someone up
          </button>
        </div>
        {shownName && (
          <p className={styles.onStage}>
            On stage: <strong>{shownName}</strong>{' '}
            <button type="button" className={styles.link} onClick={onHide}>
              Hide
            </button>
          </p>
        )}
        <ul className={styles.people}>
          {npcs.npcs.map((npc) => {
            const portrait = portraitOf(npc)
            return (
              <li key={npc.id}>
                <button
                  type="button"
                  className={cx(styles.person, selected?.id === npc.id && styles.personOn)}
                  aria-current={selected?.id === npc.id}
                  onClick={() => {
                    setSelectedId(npc.id)
                    setMadeUp(null)
                  }}
                >
                  <span className={styles.face}>
                    {portrait ? (
                      <StoredImage path={portrait.thumbPath ?? portrait.path} alt="" />
                    ) : (
                      npc.name.slice(0, 1)
                    )}
                  </span>
                  <span className={styles.who}>
                    <span className={styles.name}>{npc.name}</span>
                    <span className={styles.role}>
                      {[npc.role, ATTITUDES.find((a) => a.key === npc.attitude)?.name.toLowerCase()]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {npcs.status === 'ready' && npcs.npcs.length === 0 && (
          <p className={styles.note}>No people yet. Make the innkeeper, the villain, the guard at the gate.</p>
        )}
        {npcs.error && <p className={styles.problem}>{npcs.error}</p>}
      </nav>

      {madeUp ? (
        <article className={styles.card} aria-label="Someone made up">
          <h2 className={styles.title}>{madeUp.name}</h2>
          <p className={styles.made}>
            A {madeUp.role}. Has {madeUp.look}, and {madeUp.quirk}. Talks {madeUp.voice.replace(/^a /, 'in a ')}.
          </p>
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setMadeUp(makeSomeoneUp())}>
              Someone else
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => onShow({ name: madeUp.name, role: capital(madeUp.role), portraitId: null })}
            >
              Show them
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() =>
                void add({ ...BLANK_NPC, name: madeUp.name, role: capital(madeUp.role), voice: madeUpNotes(madeUp) })
              }
            >
              Keep them
            </button>
          </div>
        </article>
      ) : selected ? (
        <PersonEditor
          key={selected.id}
          npc={selected}
          art={art}
          shops={shops}
          shown={shownName === selected.name}
          onSave={(npc) => void npcs.save(npc)}
          onAddPortrait={onAddPortrait}
          meetNote={meetNote}
          onShow={() => onShow({ name: selected.name, role: selected.role, portraitId: selected.portraitId })}
          onHide={onHide}
          onOpenShop={onOpenShop}
          onRemove={() => {
            if (window.confirm(`Remove ${selected.name}?`)) {
              void npcs.remove(selected.id)
              setSelectedId(null)
            }
          }}
        />
      ) : (
        <p className={styles.note}>Pick someone, make someone new, or make someone up.</p>
      )}
    </div>
  )
}

function PersonEditor({
  npc,
  art,
  shops,
  shown,
  onSave,
  onShow,
  onHide,
  onOpenShop,
  onRemove,
  meetNote,
  onAddPortrait,
}: {
  npc: Npc
  meetNote: string
  onAddPortrait?: (preset: PresetPortrait) => Promise<Asset>
  art: Asset[]
  shops: Shop[]
  shown: boolean
  onSave: (npc: Npc) => void
  onShow: () => void
  onHide: () => void
  onOpenShop: (shopId: string) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(npc)
  const [adding, setAdding] = useState<string | null>(null)
  // Ready-made portraits not yet in the library (one already added is picked from the library).
  const ready = PRESET_PORTRAITS.filter((p) => !art.some((a) => a.category === 'people' && a.name === p.name))
  const changed = JSON.stringify(draft) !== JSON.stringify(npc)
  const set = (patch: Partial<Npc>) => setDraft((now) => ({ ...now, ...patch }))
  const portrait = art.find((a) => a.id === draft.portraitId) ?? null
  const shop = shops.find((s) => s.id === draft.shopId) ?? null
  function choosePortrait(portraitId: string | null) {
    const next = { ...draft, portraitId }
    setDraft(next)
    onSave(next)
  }
  // Saves when you leave a box, so typing never fights the save.
  const saveSoon = () => changed && onSave(draft)

  return (
    <article className={styles.card} aria-label={`Person: ${npc.name}`} onBlur={saveSoon}>
      <header className={styles.head}>
        <div className={styles.portrait}>
          {portrait ? (
            <StoredImage path={portrait.thumbPath ?? portrait.path} alt={portrait.name} />
          ) : (
            <span>No portrait</span>
          )}
        </div>
        <div className={styles.titles}>
          <input
            className={styles.titleInput}
            value={draft.name}
            maxLength={80}
            aria-label="Name"
            onChange={(e) => set({ name: e.target.value })}
          />
          <input
            className={styles.roleInput}
            value={draft.role}
            maxLength={80}
            placeholder="Their role: innkeeper, captain of the guard"
            aria-label="Role"
            onChange={(e) => set({ role: e.target.value })}
          />
          <input
            className={styles.roleInput}
            value={draft.place}
            maxLength={120}
            placeholder="Where they're found"
            aria-label="Where they're found"
            onChange={(e) => set({ place: e.target.value })}
          />
        </div>
        <div className={styles.headButtons}>
          {shown ? (
            <button type="button" className={styles.secondary} onClick={onHide}>
              Hide
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                // Their card notes the meeting (once a scene), with anything typed saved too.
                const note = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), text: meetNote }
                const next =
                  draft.history[0]?.text === meetNote ? draft : { ...draft, history: [note, ...draft.history] }
                setDraft(next)
                onSave(next)
                onShow()
              }}
            >
              Show
            </button>
          )}
          {changed && (
            <button type="button" className={styles.secondary} onClick={() => onSave(draft)}>
              Save
            </button>
          )}
        </div>
      </header>

      <div className={styles.attitudes} role="radiogroup" aria-label="How they feel about the party">
        {ATTITUDES.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={draft.attitude === a.key}
            title={a.line}
            className={cx(styles.attitude, styles[a.key], draft.attitude === a.key && styles.attitudeOn)}
            onClick={() => {
              const next = { ...draft, attitude: a.key }
              setDraft(next)
              onSave(next)
            }}
          >
            {a.name}
          </button>
        ))}
      </div>

      <Field
        label="How they talk"
        value={draft.voice}
        onChange={(voice) => set({ voice })}
        rows={2}
        placeholder="Gravelly, slow, calls everyone friend"
      />
      <Field
        label="What they want"
        value={draft.wants}
        onChange={(wants) => set({ wants })}
        rows={2}
        placeholder="Their son home safe from the mine"
      />
      <Field
        label="What they know"
        value={draft.knows}
        onChange={(knows) => set({ knows })}
        rows={3}
        placeholder="The merchant left for the old mill two nights ago"
      />
      <Field
        label="Their secrets (only you see these)"
        value={draft.secrets}
        onChange={(secrets) => set({ secrets })}
        rows={3}
        placeholder="She owes the goblins money"
      />

      <History
        notes={draft.history}
        onChange={(history) => {
          const next = { ...draft, history }
          setDraft(next)
          onSave(next)
        }}
      />

      <div className={styles.pickers}>
        <label className={styles.field}>
          <span>Portrait</span>
          <select
            value={adding ? `preset:${adding}` : (draft.portraitId ?? '')}
            disabled={adding !== null}
            onChange={(e) => {
              const preset = PRESET_PORTRAITS.find((p) => `preset:${p.key}` === e.target.value)
              if (!preset) return choosePortrait(e.target.value || null)
              if (!onAddPortrait) return
              setAdding(preset.key)
              void onAddPortrait(preset)
                .then((asset) => choosePortrait(asset.id))
                .catch(() => undefined)
                .finally(() => setAdding(null))
            }}
          >
            <option value="">None</option>
            {art.length > 0 && (
              <optgroup label="Your pictures">
                {art.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {onAddPortrait && ready.length > 0 && (
              <optgroup label="Ready-made (added to your library)">
                {ready.map((p) => (
                  <option key={p.key} value={`preset:${p.key}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className={styles.field}>
          <span>Keeps a shop</span>
          <select value={draft.shopId ?? ''} onChange={(e) => onSave({ ...draft, shopId: e.target.value || null })}>
            <option value="">No</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {shop && (
          <button type="button" className={styles.secondary} disabled={shop.open} onClick={() => onOpenShop(shop.id)}>
            {shop.open ? `${shop.name} is open` : `Open ${shop.name}`}
          </button>
        )}
      </div>
      {art.length === 0 && (
        <p className={styles.note}>
          Pick a ready-made portrait, or upload your own on Screen 2 (the Stage), under People.
        </p>
      )}

      <footer className={styles.foot}>
        <button type="button" className={styles.link} onClick={onRemove}>
          Remove {npc.name}
        </button>
      </footer>
    </article>
  )
}

/** What's happened with them: a note a line, newest first, with the date. */
function History({ notes, onChange }: { notes: NpcNote[]; onChange: (notes: NpcNote[]) => void }) {
  const [text, setText] = useState('')
  const when = (at: string) => (at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
  return (
    <section className={styles.block} aria-label="What's happened">
      <span className={styles.blockTitle}>What&rsquo;s happened</span>
      <form
        className={styles.noteForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          onChange([{ id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), text: text.trim() }, ...notes])
          setText('')
        }}
      >
        <input
          value={text}
          maxLength={500}
          placeholder="Lied about the mill. Gave them a free room. Wants the ledger back."
          aria-label="Add a note about them"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className={styles.secondary} disabled={!text.trim()}>
          Add
        </button>
      </form>
      {notes.length > 0 && (
        <ul className={styles.history}>
          {notes.map((note) => (
            <li key={note.id}>
              <span className={styles.when}>{when(note.at)}</span>
              <span className={styles.noteText}>{note.text}</span>
              <button
                type="button"
                className={styles.link}
                aria-label="Remove this note"
                onClick={() => onChange(notes.filter((n) => n.id !== note.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows: number
  placeholder: string
}) {
  return (
    <label className={styles.block}>
      <span className={styles.blockTitle}>{label}</span>
      <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
