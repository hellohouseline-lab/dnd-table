import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DICE_STYLE } from '../../dice/style.ts'
import type { Member } from '../../live/campaigns.ts'
import type { AskedRoll } from '../../live/rollRequests.ts'
import type { Roll } from '../../live/rolls.ts'
import { ASKABLES, askableFor, findAskable, namesText, passes, PRESET_KEYS } from '../../rules/askable.ts'
import { halfDamage } from '../../rules/maths/hitPoints.ts'
import { answerRoll } from '../../rules/rolls.ts'
import { sampleCharacters, sampleFighter, sampleMembers, sampleWizard } from '../dev/sampleData.ts'
import { AskRollDialog } from './AskRollDialog.tsx'
import { RequestResults } from './RequestResults.tsx'
import { askSentence, closestMiss, requestChips, resultSentence, suggestedCondition } from './requestStatus.ts'
import { RollPrompt, RollResult } from './RollPrompt.tsx'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const conSave: AskedRoll = {
  id: 'q1',
  campaignId: 'preview',
  kind: 'save',
  ability: 'constitution',
  skill: null,
  label: 'Constitution saving throw',
  plain: 'Steel yourself against poison, sickness or exhaustion.',
  characterIds: [sampleFighter.id, sampleWizard.id],
  shownDc: null,
  status: 'open',
  createdAt: '2026-10-26T20:00:00Z',
}

function answer(characterId: string, rollerId: string, d20: number, modifier: number, dc = 15): Roll {
  const total = d20 + modifier
  return {
    id: `a-${characterId}`,
    campaignId: 'preview',
    rollerId,
    characterId,
    label: conSave.label,
    kind: 'save',
    mode: 'normal',
    dice: [{ sides: 20, value: d20, dropped: false }],
    modifier,
    parts: [],
    total,
    natural: d20,
    damage: null,
    secret: false,
    style: DEFAULT_DICE_STYLE,
    createdAt: '2026-10-26T20:01:00Z',
    requestId: conSave.id,
    passed: total >= dc,
    passedByDice: total >= dc,
  }
}

describe('what the DM can ask for', () => {
  it('has every skill, save and plain ability check, each with words for the DM and the player', () => {
    expect(ASKABLES).toHaveLength(18 + 6 + 6)
    expect(ASKABLES.every((a) => a.short && a.plain && a.label)).toBe(true)
  })

  it('has the nine presets from the design', () => {
    expect(PRESET_KEYS.map((key) => findAskable(key)?.name)).toEqual([
      'Perception',
      'Investigation',
      'Insight',
      'Stealth',
      'Athletics',
      'Persuasion',
      'Dexterity save',
      'Constitution save',
      'Wisdom save',
    ])
    expect(findAskable('save:constitution')).toMatchObject({
      label: 'Constitution saving throw',
      short: 'Resist poison or exhaustion',
    })
  })

  it('finds what a saved request was', () => {
    expect(askableFor({ kind: 'skill', ability: 'wisdom', skill: 'perception' })?.label).toBe('Perception check')
    expect(askableFor({ kind: 'ability', ability: 'strength', skill: null })?.label).toBe('Strength check')
  })

  it('passes on meeting or beating the DC, whatever the d20 showed', () => {
    expect(passes(15, 15)).toBe(true)
    expect(passes(14, 15)).toBe(false)
  })

  it('halves damage rounding down', () => {
    expect([halfDamage(9), halfDamage(1), halfDamage(0)]).toEqual([4, 0, 0])
  })

  it('names people in a list', () => {
    expect(namesText(['Thorin'])).toBe('Thorin')
    expect(namesText(['Thorin', 'Elowen', 'Pip'])).toBe('Thorin, Elowen and Pip')
  })
})

describe('a character’s answer', () => {
  it('uses the right save and bonus under the request’s name', () => {
    const roll = answerRoll(sampleFighter, conSave)
    expect(roll).toMatchObject({ label: 'Constitution saving throw', kind: 'save', requestId: 'q1', secret: false })
    expect(roll.modifier).toBe(4)
  })

  it('applies conditions: a poisoned character has disadvantage on checks', () => {
    const insight = {
      ...conSave,
      kind: 'skill' as const,
      ability: 'wisdom' as const,
      skill: 'insight',
      label: 'Insight check',
    }
    expect(answerRoll(sampleWizard, insight).mode).toBe('disadvantage')
    expect(answerRoll(sampleWizard, conSave).mode).toBe('normal')
  })
})

describe('the words around a request', () => {
  it('says what is about to be sent', () => {
    expect(askSentence([], true, 'Constitution saving throw', 15)).toEqual({
      who: 'Everyone',
      verb: 'makes',
      check: 'a Constitution saving throw',
      target: '15 or more',
    })
    expect(askSentence(['Thorin', 'Elowen'], false, 'Insight check', 10)).toMatchObject({
      who: 'Thorin and Elowen',
      verb: 'make',
      check: 'an Insight check',
    })
  })

  it('explains that the total decides on checks and saves', () => {
    const base = { kind: 'save' as const, passedByDice: null }
    expect(resultSentence({ ...base, natural: 20, total: 18, passed: false })).toMatch(
      /natural 20, but .* total still decides: 18 falls short/,
    )
    expect(resultSentence({ ...base, natural: 1, total: 16, passed: true })).toMatch(/natural 1, but .* 16 is enough/)
    expect(resultSentence({ ...base, natural: 12, total: 15, passed: true })).toBe('15 is enough. Well done.')
    expect(resultSentence({ kind: 'save', natural: 12, total: 12, passed: true, passedByDice: false })).toMatch(
      /DM turned it into a pass/,
    )
  })

  it('points out a near miss', () => {
    const answers = [answer('fighter', 'p1', 10, 4), answer('wizard', 'p2', 3, 2)]
    expect(closestMiss(answers, 15)?.by).toBe(1)
    expect(closestMiss([answer('wizard', 'p2', 3, 2)], 15)).toBeNull()
  })

  it('suggests a condition to follow a failed save', () => {
    expect(suggestedCondition(conSave)).toBe('poisoned')
    expect(suggestedCondition({ kind: 'save', ability: 'wisdom' })).toBe('frightened')
  })
})

describe('camera chips', () => {
  const members = sampleMembers as Member[]

  it('shows the DM who is still rolling and everyone’s verdict', () => {
    const chips = requestChips({
      request: conSave,
      answers: [answer('wizard', 'p2', 9, 2)],
      members,
      characters: sampleCharacters,
      viewerId: 'dm',
    })
    expect(chips).toEqual({
      dm: { label: 'Waiting', tone: 'quiet' },
      p1: { label: 'Rolling', tone: 'quiet' },
      p2: { label: 'Failed', tone: 'fail' },
    })
  })

  it('hides verdicts from a player who still has to roll', () => {
    const chips = requestChips({
      request: conSave,
      answers: [answer('wizard', 'p2', 19, 2)],
      members,
      characters: sampleCharacters,
      viewerId: 'p1',
    })
    expect(chips.p1).toEqual({ label: 'Your roll', tone: 'gold' })
    expect(chips.p2).toEqual({ label: 'Rolled', tone: 'pass' })
  })

  it('says results are in once everyone has rolled', () => {
    const chips = requestChips({
      request: conSave,
      answers: [answer('fighter', 'p1', 14, 4), answer('wizard', 'p2', 9, 2)],
      members,
      characters: sampleCharacters,
      viewerId: 'p1',
    })
    expect(chips).toMatchObject({ dm: { label: 'Results in' }, p1: { label: 'Passed' }, p2: { label: 'Failed' } })
  })

  it('shows nothing when nobody has been asked', () => {
    expect(requestChips({ request: null, answers: [], members, characters: sampleCharacters, viewerId: 'p1' })).toEqual(
      {},
    )
  })
})

describe('the roll flow screens', () => {
  it('asks with the nine presets, who rolls and how hard', () => {
    const html = text(
      renderToStaticMarkup(
        <AskRollDialog
          characters={sampleCharacters}
          hereTonight={[sampleFighter]}
          onSend={async () => true}
          onCancel={noop}
        />,
      ),
    )
    expect(html).toContain('Ask for a roll')
    expect(html).toMatch(/Constitution save Resist poison or exhaustion/)
    expect(html).toMatch(/Everyone Thorin Ironfist Elowen/)
    expect(html).toMatch(/Medium 15 A real challenge/)
    expect(html).toContain('Tell players the number')
  })

  it('prompts the player with their bonus and a secret target', () => {
    const html = text(
      renderToStaticMarkup(
        <RollPrompt request={conSave} character={sampleFighter} mode="normal" onModeChange={noop} onRoll={noop} />,
      ),
    )
    expect(html).toMatch(/The Dungeon Master calls for a roll Constitution saving throw/)
    expect(html).toMatch(/Your bonus \+4 Target kept secret Normal roll/)
    expect(html).toContain('Roll the d20')
  })

  it('shows a natural 20 that still fails, and the number when the DM shared it', () => {
    const roll = { ...answer('fighter', 'p1', 20, -6, 15) }
    const html = text(renderToStaticMarkup(<RollResult roll={roll} shownDc={15} onClose={noop} />))
    expect(html).toMatch(/20 − 6 = 14 vs DC 15 Natural 20 Failed/)
    expect(html).toMatch(/total still decides: 14 falls short/)
  })

  it('lists everyone’s results for the DM, with a way to change each', () => {
    const html = text(
      renderToStaticMarkup(
        <RequestResults
          request={conSave}
          answers={[answer('fighter', 'p1', 14, 4)]}
          dc={15}
          characters={sampleCharacters}
          onOverride={noop}
          onAccept={noop}
          onRollFor={noop}
          onDamage={noop}
          onCondition={noop}
          onRollDamage={async () => null}
          onDone={noop}
          onHide={noop}
        />,
      ),
    )
    expect(html).toMatch(/Waiting for the dice Constitution saving throw/)
    expect(html).toMatch(/Needed 15 or more · number kept secret · 1 of 2 rolled/)
    expect(html).toMatch(/Thorin Ironfist rolled 14 \+ 4 = 18 Passed Make it a fail/)
    expect(html).toMatch(/Elowen hasn’t rolled yet Roll for them/)
    expect(html).toContain('Poison the ones who failed')
    expect(html).toContain('Done, play on')
  })
})
