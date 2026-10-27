import { useState } from 'react'
import type { Shop } from '../../../rules/shops.ts'
import type { Asset } from '../../../live/library.ts'
import type { Scene, ScenePatch } from '../../../live/story.ts'
import type { Npc } from '../../../live/npcs.ts'
import { ASKABLES } from '../../../rules/askable.ts'
import { CONTAINERS, RICHNESS, type Container, type Richness } from '../../../rules/boxes.ts'
import type { DmItem } from '../../../rules/catalogue.ts'
import type { Character } from '../../../rules/character.ts'
import { boxWords, plannedRollWords, type Fight, type PlannedRoll, type Thing } from '../../../rules/scenes.ts'
import type { SrdMonster } from '../../../rules/srd/index.ts'
import { MonsterPicker } from '../../fight/MonsterPicker.tsx'
import { DIFFICULTY_WORDS, encounterDifficulty } from '../../../rules/encounter.ts'
import styles from './StoryTab.module.css'

/** What the buttons in a scene do, on the DM screen. */
export type SceneActions = {
  onAsk: (roll: PlannedRoll) => void
  onOpenScene: (sceneId: string) => void
  onGiveItem: (dmItemId: string) => void
  onOpenBox: (container: Container, richness: Richness) => void
  onOpenShop: (shopId: string) => void
  onStartFight: (fight: Fight) => void
  onShowNpc: (npc: { id?: string; name: string; role: string; portraitId: string | null }) => void
  onOpenNpc: (npcId: string) => void
}

/** What a scene's parts can point at. */
export type SceneData = {
  scenes: Scene[]
  characters: Character[]
  dmItems: DmItem[]
  shops: Shop[]
  monsters: SrdMonster[] | null
  maps: Asset[]
  npcs: Npc[]
  /** Whoever is on stage now ('' for nobody). */
  shownNpc: string
}

type ScenePlansProps = {
  scene: Scene
  onChange: (patch: ScenePatch) => void
  data: SceneData
  actions: SceneActions
}

type Adding = 'roll' | 'choice' | 'thing' | 'fight' | null

const newId = () => crypto.randomUUID().slice(0, 8)

/**
 * In this scene (S1b): the rolls, choices, things and fight you planned, each one button; and below,
 * adding and removing them. A planned roll opens Ask for a roll filled in; a fight opens Start
 * combat filled in.
 */
export function ScenePlans({ scene, onChange, data, actions }: ScenePlansProps) {
  const [adding, setAdding] = useState<Adding>(null)
  const nameOf = (id: string) => data.characters.find((c) => c.id === id)?.name ?? 'someone'
  const monsterName = (index: string) => data.monsters?.find((m) => m.index === index)?.name ?? index
  const empty = scene.rolls.length === 0 && scene.choices.length === 0 && scene.things.length === 0 && !scene.fight

  return (
    <section className={styles.block} aria-label="In this scene">
      <h3 className={styles.blockTitle}>In this scene</h3>
      {empty && (
        <p className={styles.note}>
          Plan a roll, a choice, something to hand out or a fight, and it waits here as a button.
        </p>
      )}

      <ul className={styles.plans}>
        {scene.rolls.map((roll) => (
          <li key={roll.id}>
            <button type="button" className={styles.planButton} onClick={() => actions.onAsk(roll)}>
              Ask: {plannedRollWords(roll, roll.who.map(nameOf))}
            </button>
            {roll.note && <span className={styles.planNote}>{roll.note}</span>}
            <Remove onClick={() => onChange({ rolls: scene.rolls.filter((r) => r.id !== roll.id) })} />
          </li>
        ))}
        {scene.choices.map((choice) => {
          const to = data.scenes.find((s) => s.id === choice.sceneId)
          return (
            <li key={choice.id}>
              <span className={styles.planNote}>If {choice.text.replace(/^if /i, '')}:</span>
              {to ? (
                <button type="button" className={styles.planLink} onClick={() => actions.onOpenScene(to.id)}>
                  {to.title || 'a scene'}
                </button>
              ) : (
                <span className={styles.planNote}>no scene picked</span>
              )}
              <Remove onClick={() => onChange({ choices: scene.choices.filter((c) => c.id !== choice.id) })} />
            </li>
          )
        })}
        {scene.things.map((thing) => (
          <li key={thing.id}>
            <ThingButton thing={thing} data={data} actions={actions} />
            <Remove onClick={() => onChange({ things: scene.things.filter((t) => t.id !== thing.id) })} />
          </li>
        ))}
        {scene.fight && (
          <li>
            <button
              type="button"
              className={styles.planButton}
              onClick={() => scene.fight && actions.onStartFight(scene.fight)}
            >
              Start the fight:{' '}
              {scene.fight.monsters.length > 0
                ? scene.fight.monsters.map((m) => `${m.count} × ${monsterName(m.index)}`).join(', ')
                : 'pick the monsters'}
              {fightRating(scene.fight, data) && ` (${fightRating(scene.fight, data)} for this party)`}
            </button>
            <Remove onClick={() => onChange({ fight: null })} />
          </li>
        )}
      </ul>

      <div className={styles.adders} role="group" aria-label="Plan something">
        {(
          [
            ['roll', 'Plan a roll'],
            ['choice', 'Add a choice'],
            ['thing', 'Something to hand out'],
            ['fight', scene.fight ? 'Change the fight' : 'Plan a fight'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={styles.link}
            aria-expanded={adding === key}
            onClick={() => setAdding(adding === key ? null : key)}
          >
            {label}
          </button>
        ))}
      </div>

      {adding === 'roll' && (
        <RollForm
          characters={data.characters}
          onAdd={(roll) => {
            onChange({ rolls: [...scene.rolls, roll] })
            setAdding(null)
          }}
        />
      )}
      {adding === 'choice' && (
        <ChoiceForm
          scenes={data.scenes.filter((s) => s.id !== scene.id)}
          onAdd={(text, sceneId) => {
            onChange({ choices: [...scene.choices, { id: newId(), text, sceneId }] })
            setAdding(null)
          }}
        />
      )}
      {adding === 'thing' && (
        <ThingForm
          data={data}
          onAdd={(thing) => {
            onChange({ things: [...scene.things, thing] })
            setAdding(null)
          }}
        />
      )}
      {adding === 'fight' && (
        <FightForm
          fight={scene.fight ?? { monsters: [], mapId: null }}
          data={data}
          onChange={(fight) => onChange({ fight })}
          onDone={() => setAdding(null)}
        />
      )}
    </section>
  )
}

/** How hard a planned fight is for the party here now: "hard". */
function fightRating(fight: Fight, data: SceneData): string | null {
  const xps = fight.monsters.flatMap((m) => {
    const monster = data.monsters?.find((x) => x.index === m.index)
    return monster ? Array.from({ length: m.count }, () => monster.xp) : []
  })
  if (xps.length === 0 || data.characters.length === 0) return null
  return DIFFICULTY_WORDS[
    encounterDifficulty(
      data.characters.map((c) => c.level),
      xps,
    ).difficulty
  ]
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.remove} aria-label="Remove it from the scene" onClick={onClick}>
      ×
    </button>
  )
}

function ThingButton({ thing, data, actions }: { thing: Thing; data: SceneData; actions: SceneActions }) {
  if (thing.kind === 'item') {
    const item = data.dmItems.find((i) => i.id === thing.dmItemId)
    return (
      <button type="button" className={styles.planButton} onClick={() => actions.onGiveItem(thing.dmItemId)}>
        Give {item?.name ?? 'an item'}
      </button>
    )
  }
  if (thing.kind === 'box') {
    return (
      <button
        type="button"
        className={styles.planButton}
        onClick={() => actions.onOpenBox(thing.container, thing.richness)}
      >
        {thing.container === 'body' ? 'Search' : 'Open'}{' '}
        {boxWords(thing.container, thing.richness).replace(/^An? /, (a) => a.toLowerCase())}
      </button>
    )
  }
  const shop = data.shops.find((s) => s.id === thing.shopId)
  return (
    <button
      type="button"
      className={styles.planButton}
      disabled={!shop || shop.open}
      onClick={() => actions.onOpenShop(thing.shopId)}
    >
      {shop?.open ? `${shop.name} is open` : `Open ${shop?.name ?? 'a shop'}`}
    </button>
  )
}

function RollForm({ characters, onAdd }: { characters: Character[]; onAdd: (roll: PlannedRoll) => void }) {
  const [key, setKey] = useState('skill:perception')
  const [dc, setDc] = useState(13)
  const [outcomeShown, setOutcomeShown] = useState(true)
  const [who, setWho] = useState<string[]>([])
  const [note, setNote] = useState('')
  return (
    <form
      className={styles.planForm}
      aria-label="Plan a roll"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd({ id: newId(), key, dc, outcomeShown, who, note: note.trim() })
      }}
    >
      <label className={styles.field}>
        <span>Check</span>
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {ASKABLES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>DC</span>
        <input
          type="number"
          min={1}
          max={40}
          value={dc}
          aria-label="DC"
          onChange={(e) => setDc(Math.min(40, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
        />
      </label>
      <div className={styles.whoRow} role="group" aria-label="Who rolls">
        <span>Who</span>
        <label>
          <input type="checkbox" checked={who.length === 0} onChange={() => setWho([])} />
          Everyone
        </label>
        {characters.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={who.includes(c.id)}
              onChange={(e) => setWho((now) => (e.target.checked ? [...now, c.id] : now.filter((w) => w !== c.id)))}
            />
            {c.name}
          </label>
        ))}
      </div>
      <label>
        <input type="checkbox" checked={outcomeShown} onChange={(e) => setOutcomeShown(e.target.checked)} />
        Tell players the outcome
      </label>
      <label className={styles.field}>
        <span>What for</span>
        <input
          value={note}
          maxLength={120}
          placeholder="to spot the hooded figure"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button type="submit" className={styles.secondary}>
        Add the roll
      </button>
    </form>
  )
}

function ChoiceForm({ scenes, onAdd }: { scenes: Scene[]; onAdd: (text: string, sceneId: string | null) => void }) {
  const [text, setText] = useState('')
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? '')
  return (
    <form
      className={styles.planForm}
      aria-label="Add a choice"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onAdd(text.trim(), sceneId || null)
      }}
    >
      <label className={styles.field}>
        <span>If</span>
        <input
          value={text}
          maxLength={120}
          placeholder="they take the mill road"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Go to</span>
        <select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
          <option value="">No scene yet</option>
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || 'A scene'}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.secondary} disabled={!text.trim()}>
        Add the choice
      </button>
    </form>
  )
}

function ThingForm({ data, onAdd }: { data: SceneData; onAdd: (thing: Thing) => void }) {
  const [kind, setKind] = useState<Thing['kind']>(data.dmItems.length > 0 ? 'item' : 'box')
  const [dmItemId, setDmItemId] = useState(data.dmItems[0]?.id ?? '')
  const [container, setContainer] = useState<Container>('chest')
  const [richness, setRichness] = useState<Richness>('ordinary')
  const [shopId, setShopId] = useState(data.shops[0]?.id ?? '')
  const ready = kind === 'item' ? Boolean(dmItemId) : kind === 'shop' ? Boolean(shopId) : true
  return (
    <form
      className={styles.planForm}
      aria-label="Something to hand out"
      onSubmit={(e) => {
        e.preventDefault()
        const id = newId()
        if (kind === 'item' && dmItemId) onAdd({ id, kind, dmItemId })
        else if (kind === 'shop' && shopId) onAdd({ id, kind, shopId })
        else if (kind === 'box') onAdd({ id, kind, container, richness })
      }}
    >
      <label className={styles.field}>
        <span>What</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as Thing['kind'])}>
          <option value="item">One of your items</option>
          <option value="box">A box to open</option>
          <option value="shop">A shop to open</option>
        </select>
      </label>
      {kind === 'item' &&
        (data.dmItems.length === 0 ? (
          <p className={styles.note}>Make your own items in Give, under Make your own.</p>
        ) : (
          <label className={styles.field}>
            <span>Item</span>
            <select value={dmItemId} onChange={(e) => setDmItemId(e.target.value)}>
              {data.dmItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.key ? ' (key item)' : ''}
                </option>
              ))}
            </select>
          </label>
        ))}
      {kind === 'box' && (
        <>
          <label className={styles.field}>
            <span>Box</span>
            <select value={container} onChange={(e) => setContainer(e.target.value as Container)}>
              {CONTAINERS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>How rich</span>
            <select value={richness} onChange={(e) => setRichness(e.target.value as Richness)}>
              {RICHNESS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {kind === 'shop' &&
        (data.shops.length === 0 ? (
          <p className={styles.note}>Make a shop on the Items and loot tab first.</p>
        ) : (
          <label className={styles.field}>
            <span>Shop</span>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
              {data.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      <button type="submit" className={styles.secondary} disabled={!ready}>
        Add it
      </button>
    </form>
  )
}

function FightForm({
  fight,
  data,
  onChange,
  onDone,
}: {
  fight: Fight
  data: SceneData
  onChange: (fight: Fight) => void
  onDone: () => void
}) {
  const name = (index: string) => data.monsters?.find((m) => m.index === index)?.name ?? index
  const set = (index: string, by: number) => {
    const there = fight.monsters.find((m) => m.index === index)
    const count = Math.min(8, (there?.count ?? 0) + by)
    const monsters =
      count <= 0
        ? fight.monsters.filter((m) => m.index !== index)
        : there
          ? fight.monsters.map((m) => (m.index === index ? { ...m, count } : m))
          : [...fight.monsters, { index, count }]
    onChange({ ...fight, monsters })
  }
  return (
    <div className={styles.planForm} role="group" aria-label="Plan a fight">
      {fight.monsters.length > 0 && (
        <ul className={styles.plans}>
          {fight.monsters.map((m) => (
            <li key={m.index}>
              <button
                type="button"
                className={styles.remove}
                aria-label={`One fewer ${name(m.index)}`}
                onClick={() => set(m.index, -1)}
              >
                −
              </button>
              {m.count} × {name(m.index)}
              <button
                type="button"
                className={styles.remove}
                aria-label={`One more ${name(m.index)}`}
                onClick={() => set(m.index, 1)}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}
      <MonsterPicker monsters={data.monsters} quick onPick={(pick) => set(pick.monster.index, 1)} />
      <label className={styles.field}>
        <span>Map</span>
        <select value={fight.mapId ?? ''} onChange={(e) => onChange({ ...fight, mapId: e.target.value || null })}>
          <option value="">Pick when it starts</option>
          {data.maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={styles.secondary} onClick={onDone}>
        Done
      </button>
    </div>
  )
}

/** People here: who's in the scene, each with Show (on stage) and a link to their card. */
export function ScenePeople({
  scene,
  onChange,
  data,
  actions,
}: {
  scene: Scene
  onChange: (patch: ScenePatch) => void
  data: SceneData
  actions: SceneActions
}) {
  const here = scene.people.flatMap((id) => data.npcs.filter((n) => n.id === id))
  const others = data.npcs.filter((n) => !scene.people.includes(n.id))
  return (
    <section className={styles.block} aria-label="People here">
      <h3 className={styles.blockTitle}>People here</h3>
      {here.length > 0 && (
        <ul className={styles.plans}>
          {here.map((npc) => (
            <li key={npc.id}>
              <button type="button" className={styles.planLink} onClick={() => actions.onOpenNpc(npc.id)}>
                {npc.name}
              </button>
              {npc.role && <span className={styles.planNote}>{npc.role}</span>}
              <button
                type="button"
                className={styles.planButton}
                disabled={data.shownNpc === npc.name}
                onClick={() => actions.onShowNpc(npc)}
              >
                {data.shownNpc === npc.name ? 'On stage' : `Show ${npc.name}`}
              </button>
              <Remove onClick={() => onChange({ people: scene.people.filter((p) => p !== npc.id) })} />
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 ? (
        <label className={styles.field}>
          <span>Add</span>
          <select
            value=""
            aria-label="Add someone to this scene"
            onChange={(e) => e.target.value && onChange({ people: [...scene.people, e.target.value] })}
          >
            <option value="">Someone who&rsquo;s here…</option>
            {others.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
                {n.role ? `, ${n.role}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        here.length === 0 && <p className={styles.note}>Make people on the NPCs tab, then add them here.</p>
      )}
    </section>
  )
}
