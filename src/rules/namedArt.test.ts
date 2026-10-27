import { describe, expect, it } from 'vitest'
import { namedArt, parseCampaign } from './campaignFile.ts'

const CAMPAIGN = `# Campaign: The Test Pit

## Cast

### NPC: Roland Tress
Role: Sheriff
Portrait: Sheriff

### NPC: Grudge
Role: Landlady
Portrait: Dwarf blacksmith

## Places
- Picture: Sink cavern, for Scene 1.1
- Map: Meadheaven tavern, for Scenes 1.2 and 1.3, 5 ft grid
- Map: Town square, for Scene 1.4, 5 ft grid

# Chapter 1: Into the Pit

## Scene 1.1: The Den
Read aloud:
> Goblins.
Fight: 3 goblin; map: Guard room and goblins' den
`

describe('the art a campaign names', () => {
  it('finds fight maps, the maps in its places list, and portraits', () => {
    const art = namedArt(parseCampaign(CAMPAIGN))
    expect(art.portraits).toEqual(['Sheriff', 'Dwarf blacksmith'])
    expect(art.maps).toEqual(
      expect.arrayContaining(["Guard room and goblins' den", 'Meadheaven tavern', 'Town square']),
    )
    expect(art.maps).not.toContain('Sink cavern')
  })
})

describe('bringing in the art that comes with the table', () => {
  it('picks the starter maps and ready-made portraits a campaign names, unless the library has them', async () => {
    const { artForCampaign } = await import('../live/library.ts')
    const art = artForCampaign({ maps: ['Meadheaven tavern', 'Nowhere'], portraits: ['Sheriff', 'Herb merchant'] }, [])
    expect(art.maps.map((m) => m.name)).toEqual(['Meadheaven tavern'])
    expect(art.portraits.map((p) => p.key)).toEqual(['sheriff', 'herb-merchant'])
    const has = artForCampaign({ maps: [], portraits: ['Herb merchant'] }, [
      { name: 'Herb merchant', category: 'people' } as never,
    ])
    expect(has.portraits).toEqual([])
  })
})

describe('reading rolls and people the way an AI writes them', () => {
  it('knows a bare ability check, a tool check and a saving throw written out', async () => {
    const { parseRoll } = await import('./campaignFile.ts')
    expect(parseRoll('Strength DC 12, open DC: to lift the wagon').key).toBe('ability:strength')
    expect(parseRoll("Dexterity (thieves' tools) DC 11, open DC: to pick the lock").key).toBe('ability:dexterity')
    expect(parseRoll('Dexterity saving throw DC 11: to dodge the spikes').key).toBe('save:dexterity')
    expect(parseRoll('Wisdom (Insight) DC 12: to spot the cheat').key).toBe('skill:insight')
  })
  it('leaves "(suggested name)" off a person', () => {
    const plan = parseCampaign(
      '# Campaign: X\n\n## Cast\n\n### NPC: Grudge Halloway (suggested name)\nRole: Landlady\n',
    )
    expect(plan.people[0].name).toBe('Grudge Halloway')
  })
})
