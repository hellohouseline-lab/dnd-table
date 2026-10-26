import { beforeAll, describe, expect, it } from 'vitest'
import { BITS } from './bits.ts'
import { giftItem } from './magic.ts'
import {
  boughtItem,
  linePrice,
  magicLine,
  needsPrice,
  sellPrice,
  shopTag,
  shopTags,
  startingStock,
  type Shop,
} from './shops.ts'
import { loadEquipment, loadMagicItems, type SrdEquipment, type SrdMagicItem } from './srd/index.ts'

let equipment: SrdEquipment
let magic: SrdMagicItem[]
beforeAll(async () => {
  equipment = await loadEquipment()
  magic = await loadMagicItems()
})
const shopOf = (kind: Shop['kind'], markup = 100): Shop => ({
  id: 's',
  name: 'Shop',
  keeper: '',
  kind,
  markup,
  buys: true,
  open: true,
  stock: startingStock(kind, equipment, magic),
})

describe('shops', () => {
  it('stocks each kind of shop from the free rules', () => {
    const general = shopOf('general')
    expect(general.stock.map((l) => l.item)).toEqual(
      expect.arrayContaining(['rope-hempen-50-feet', 'torch', 'backpack']),
    )
    expect(general.stock.find((l) => l.item === 'torch')?.quantity).toBeNull()
    const smith = shopOf('blacksmith')
    expect(smith.stock.some((l) => l.item === 'longsword')).toBe(true)
    expect(smith.stock.some((l) => l.item === 'chain-mail')).toBe(true)
    expect(smith.stock.some((l) => l.item === 'longbow')).toBe(false)
    const fletcher = shopOf('fletcher')
    expect(fletcher.stock.find((l) => l.item === 'arrow')).toMatchObject({ name: 'Arrow (20)', bundle: 20, cost: 100 })
    const alchemist = shopOf('alchemist')
    expect(alchemist.stock.find((l) => l.magic === 'potion-of-healing-common')).toMatchObject({
      cost: 5000,
      quantity: 3,
    })
    for (const kind of ['general', 'blacksmith', 'alchemist', 'fletcher', 'merchant'] as const) {
      expect(shopOf(kind).stock.length).toBeGreaterThan(5)
    }
  })

  it('prices with the mark-up, or the DM own price', () => {
    const rope = shopOf('general').stock.find((l) => l.item === 'rope-hempen-50-feet')!
    expect(linePrice(rope, 100)).toBe(100)
    expect(linePrice(rope, 125)).toBe(125)
    expect(linePrice(rope, 80)).toBe(80)
    expect(linePrice({ ...rope, price: 300 }, 80)).toBe(300)
    const cloak = magicLine(
      magic.find((m) => m.index === 'cloak-of-protection')!,
      null,
      1,
    )
    expect(needsPrice(cloak)).toBe(true)
    expect(needsPrice({ ...cloak, price: 50000 })).toBe(false)
  })

  it('turns a bundle into a pack line', () => {
    const arrows = shopOf('fletcher').stock.find((l) => l.item === 'arrow')!
    expect(boughtItem(arrows, 2)).toMatchObject({ item: 'arrow', name: 'Arrow', quantity: 40 })
  })

  it('buys back for half the book price, and magic only if it stocks it', () => {
    const general = shopOf('general')
    const rope = giftItem({ kind: 'gear', item: equipment.items.find((i) => i.index === 'rope-hempen-50-feet')! }, 1)
    expect(sellPrice(rope, general, equipment)).toBe(50)
    const ring = giftItem({ kind: 'bit', bit: BITS.find((b) => b.index === 'bits-silver-ring')! }, 1)
    expect(sellPrice(ring, general, equipment)).toBe(500)
    expect(sellPrice({ ...rope, worn: true }, general, equipment)).toBeNull()
    expect(sellPrice(rope, { ...general, buys: false }, equipment)).toBeNull()
    const potion = giftItem(
      { kind: 'magic', magic: magic.find((m) => m.index === 'potion-of-healing-common')!, base: null },
      1,
    )
    expect(sellPrice(potion, general, equipment)).toBeNull()
    expect(sellPrice(potion, shopOf('alchemist'), equipment)).toBe(2500)
    const arrows = giftItem({ kind: 'gear', item: equipment.items.find((i) => i.index === 'arrow')! }, 20)
    expect(sellPrice(arrows, general, equipment)).toBe(2)
  })

  it('tags the shelves', () => {
    const smith = shopOf('blacksmith')
    expect(shopTags(smith.stock, equipment).map((t) => t.key)).toEqual(['weapons', 'armour'])
    const alchemist = shopOf('alchemist')
    expect(
      shopTag(
        alchemist.stock.find((l) => l.magic === 'potion-of-healing-common')!,
        equipment,
      ),
    ).toBe('potions')
    expect(
      shopTag(
        alchemist.stock.find((l) => l.item === 'herbalism-kit')!,
        equipment,
      ),
    ).toBe('tools')
    const ring = magicLine(
      magic.find((m) => m.index === 'ring-of-protection')!,
      null,
      1,
    )
    expect(shopTag(ring, equipment)).toBe('jewellery')
    expect(
      shopTag(
        magicLine(
          magic.find((m) => m.index === 'bag-of-holding')!,
          null,
          1,
        ),
        equipment,
      ),
    ).toBe('magic')
    const general = shopOf('general')
    expect(
      shopTag(
        general.stock.find((l) => l.item === 'rope-hempen-50-feet')!,
        equipment,
      ),
    ).toBe('gear')
    expect(
      shopTag({ ...general.stock[0], item: 'bits-silver-ring', name: 'Silver ring', magic: undefined }, equipment),
    ).toBe('jewellery')
    expect(shopTag({ ...general.stock[0], item: 'bits-bent-spoon', name: 'Bent spoon' }, equipment)).toBe('misc')
  })
})
