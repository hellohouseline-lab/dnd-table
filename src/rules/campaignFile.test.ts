import { describe, expect, it } from 'vitest'
import { matchName, parseCampaign, parseFight, parseRoll, planWarnings, planWords } from './campaignFile.ts'
import doc from '../../docs/CAMPAIGN_TEMPLATE.md?raw'
import { SHORT_LAYOUT } from './campaignFile.fixture.ts'
import { AI_PROMPT, AI_PROMPT_TO_COPY, CAMPAIGN_EXAMPLE, CAMPAIGN_TEMPLATE } from './campaignTemplate.ts'

describe('pasting a campaign', () => {
  it('reads the campaign template example: notes, chapters, scenes numbered, endings and the cast', () => {
    const plan = parseCampaign(CAMPAIGN_EXAMPLE)
    expect(plan.title).toBe('The Drowned Bell')
    expect(planWords(plan)).toBe('4 chapters, 6 scenes, 2 people and 1 item')
    expect(plan.chapters.map((c) => c.title)).toEqual([
      'Campaign notes',
      'Chapter 1: The Village',
      'Chapter 2: The Chapel',
      'Endings',
    ])
    expect(plan.chapters[0].scenes[0].reminders).toContain('Truth: The old bell-keeper rings a sunken bell')
    expect(plan.people[0]).toMatchObject({ name: 'Old Tobin', attitude: 'friendly', place: 'The chapel on the cliff' })
    expect(plan.people[0].voice).toContain('Look: Stooped')
    expect(plan.people[1].wants).toContain('Quest: Find her brother')
    expect(plan.items[0]).toMatchObject({ name: "Hag's pearl", key: true })

    const [inn, cliff] = plan.chapters[1].scenes
    expect(inn).toMatchObject({ number: '1.1', title: 'The Gull and Anchor', people: ['Old Tobin', 'Marra'] })
    expect(inn.reminders).toMatch(/^Goal: The party learns/)
    expect(inn.rolls[0]).toMatchObject({ key: 'skill:perception', dc: 13 })
    expect(inn.reminders).toContain('pass: they find the trail; fail: Tobin pockets them first')
    expect(inn.reminders).toContain('Side quest: Marra asks them')
    expect(inn.choices).toEqual([{ text: 'they follow the trail', to: 'Scene 1.2' }])
    expect(cliff.fight).toEqual([
      { name: 'Sahuagin', count: 2 },
      { name: 'Merfolk', count: 2 },
    ])
    expect(cliff.map).toBe('Cliff path')
    expect(cliff.reminders).toContain('Checkpoint: The log says')

    const chapel = plan.chapters[2].scenes[0]
    expect(chapel.gives).toEqual(["Hag's pearl"])
    expect(chapel.reminders).toContain('Level up: Everyone reaches level 3')
    expect(chapel.reminders).toContain('If someone falls:')
    expect(chapel.choices.map((c) => c.to)).toEqual(['Ending: Silence the bell', "Ending: The keeper's bargain"])
    expect(plan.chapters[3].scenes.map((s) => s.title)).toEqual(['Silence the bell', "The keeper's bargain"])
  })

  it('keeps an If line as a reminder, unless it leads to a scene', () => {
    const scene = parseCampaign(
      '## Scene 1.1: Gate\nIf: they have the key: the gate opens without a roll\nIf: they climb -> Scene 1.2\n## Scene 1.2: Wall',
    ).chapters[0].scenes[0]
    expect(scene.reminders).toBe('If: they have the key: the gate opens without a roll')
    expect(scene.choices).toEqual([{ text: 'they climb', to: 'Scene 1.2' }])
  })

  it('keeps docs/CAMPAIGN_TEMPLATE.md and what the app copies the same', () => {
    expect(doc).toContain(`\`\`\`markdown\n${CAMPAIGN_TEMPLATE}\`\`\``)
    expect(doc).toContain(`\`\`\`markdown\n${CAMPAIGN_EXAMPLE}\`\`\``)
    expect(doc).toContain(`\`\`\`text\n${AI_PROMPT}\`\`\``)
    expect(AI_PROMPT_TO_COPY).toContain('## Scene 1.1: <title>')
    expect(AI_PROMPT_TO_COPY).toContain('# Campaign: The Drowned Bell')
    expect(parseCampaign(CAMPAIGN_TEMPLATE).chapters.length).toBeGreaterThan(0)
  })

  it('reads the shorter layout into chapters, scenes, people and items', () => {
    const plan = parseCampaign(SHORT_LAYOUT)
    expect(plan.title).toBe('The Ember Road')
    expect(planWords(plan)).toBe('2 chapters, 3 scenes, 2 people and 2 items')
    expect(plan.people[0]).toMatchObject({
      name: 'Brenna',
      role: 'Innkeeper',
      attitude: 'warm',
      secrets: 'She owes the goblins money.',
    })
    expect(plan.items[0]).toMatchObject({ name: 'The Raven Seal', key: true })
    expect(plan.items[1].description).toContain('Brenna')

    const [flagon, road] = plan.chapters[0].scenes
    expect(flagon).toMatchObject({
      title: 'The Rusty Flagon',
      place: 'The Rusty Flagon, Millbrook',
      picture: 'Tavern',
      music: 'Tavern',
      people: ['Brenna'],
    })
    expect(flagon.readAloud).toBe(
      'Rain drums on the shutters. Inside the Rusty Flagon, smoke curls from a hearth big enough to roast an ox,\nand every head turns as you shake the water from your cloaks.',
    )
    expect(flagon.reminders).toContain('A hooded figure in the corner is a spy')
    expect(flagon.reminders).toContain('Checkpoint: the party knows where the merchant went.')
    expect(flagon.rolls).toHaveLength(2)
    expect(flagon.rolls[0]).toMatchObject({
      key: 'skill:perception',
      dc: 13,
      outcomeShown: false,
      note: 'notice the hooded figure watching',
    })
    expect(flagon.choices).toEqual([{ text: 'they take the mill road', to: 'The Mill Road' }])

    expect(road.fight).toEqual([{ name: 'Goblin', count: 3 }])
    expect(road.boxes).toEqual([{ container: 'body', richness: 'ordinary' }])
    expect(road.map).toBe('Forest road')
    expect(road.reminders).toContain('Balance: an easy-to-medium fight')

    const mill = plan.chapters[1].scenes[0]
    expect(mill.fight).toEqual([
      { name: 'Hobgoblin', count: 1 },
      { name: 'Goblin', count: 4 },
    ])
    expect(mill.gives).toEqual(['The Raven Seal', "Merchant's ledger"])
    expect(mill.reminders).toContain('Level up: everyone reaches level 2')
    expect(mill.reminders).toContain('If a character dies:')
  })

  it('reads loose notes too: headings for scenes, quotes for read-aloud, the rest as reminders', () => {
    const plan = parseCampaign(
      `## The Crypt\n### Gate\nThe gate is locked.\n> Cold air sighs from the dark.\n### Tomb\nA wight waits.`,
    )
    expect(plan.chapters).toHaveLength(1)
    expect(plan.chapters[0].scenes.map((s) => s.title)).toEqual(['Gate', 'Tomb'])
    expect(plan.chapters[0].scenes[0]).toMatchObject({
      readAloud: 'Cold air sighs from the dark.',
      reminders: 'The gate is locked.',
    })
    expect(parseCampaign('### A lone scene').chapters[0]).toMatchObject({
      title: 'Chapter 1',
      scenes: [{ title: 'A lone scene' }],
    })
  })

  it('reads rolls and fights written in different ways', () => {
    expect(parseRoll('Dexterity save DC 14, show the number, Wren and Thorin')).toMatchObject({
      key: 'save:dexterity',
      dc: 14,
      outcomeShown: true,
      who: ['Wren and Thorin'],
    })
    expect(parseRoll('Sleight of Hand DC 12').key).toBe('skill:sleight-of-hand')
    // AIs write long dashes; they work as well as a plain one.
    expect(parseRoll('Stealth DC 11 — to slip past the guard').note).toBe('slip past the guard')
    expect(parseFight('Goblin x3, 2 × Wolf, Ogre')).toEqual([
      { name: 'Goblin', count: 3 },
      { name: 'Wolf', count: 2 },
      { name: 'Ogre', count: 1 },
    ])
  })

  it('matches names loosely and warns about what it cannot find', () => {
    const monsters = ['Goblin', 'Wolf', 'Bugbear']
    expect(matchName(monsters, (m) => m, 'goblins')).toBe('Goblin')
    expect(matchName(monsters, (m) => m, 'Wolves')).toBeUndefined()
    const plan = parseCampaign(SHORT_LAYOUT)
    const warnings = planWarnings(plan, { monsters: ['Goblin'], assets: ['Tavern'], shops: [] })
    expect(warnings).toContain("Hobgoblin isn't a monster in the free rules (in The Old Mill)")
    expect(warnings).toContain('Nothing called Forest road in your library yet (in The Mill Road)')
    expect(warnings.some((w) => w.includes('Tavern'))).toBe(false)
  })
})
