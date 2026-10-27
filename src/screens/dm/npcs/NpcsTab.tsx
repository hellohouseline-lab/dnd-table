import { useState } from 'react'
import { cx } from '../../../components/cx.ts'
import { StoredImage } from '../../../components/StoredImage.tsx'
import type { Asset } from '../../../live/library.ts'
import { BLANK_NPC, type Npc, type NpcControls } from '../../../live/npcs.ts'
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
  onShow: (person: { name: string; role: string; portraitId: string | null }) => void
  onHide: () => void
  onOpenShop: (shopId: string) => void
  /** Who to open first (from a scene). */
  startId?: string | null
}

/**
 * The NPCs tab on Screen 1 (S1c): your people with their portrait, role, voice, wants, knowledge,
 * secrets and attitude to the party; Show puts their portrait and name on stage for everyone. Make
 * someone up is for the person you didn't plan.
 */
export function NpcsTab({ npcs, library, shops, shownName, onShow, onHide, onOpenShop, startId = null }: NpcsTabProps) {
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
}: {
  npc: Npc
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
  const changed = JSON.stringify(draft) !== JSON.stringify(npc)
  const set = (patch: Partial<Npc>) => setDraft((now) => ({ ...now, ...patch }))
  const portrait = art.find((a) => a.id === draft.portraitId) ?? null
  const shop = shops.find((s) => s.id === draft.shopId) ?? null
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
            <button type="button" className={styles.primary} onClick={onShow}>
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

      <div className={styles.pickers}>
        <label className={styles.field}>
          <span>Portrait</span>
          <select
            value={draft.portraitId ?? ''}
            onChange={(e) => onSave({ ...draft, portraitId: e.target.value || null })}
          >
            <option value="">None</option>
            {art.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
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
      {art.length === 0 && <p className={styles.note}>Upload portraits on Screen 2 (the Stage), under People.</p>}

      <footer className={styles.foot}>
        <button type="button" className={styles.link} onClick={onRemove}>
          Remove {npc.name}
        </button>
      </footer>
    </article>
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
