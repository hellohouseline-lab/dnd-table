import { describe, expect, it } from 'vitest'
import { EMPTY_WALLET } from './character.ts'
import { coinsFor, coinWords, giftWords, pay, readCoins, splitCoins, walletCopper } from './money.ts'

const purse = (coins: Partial<typeof EMPTY_WALLET>) => ({ ...EMPTY_WALLET, ...coins })

describe('coins', () => {
  it('counts a purse and makes amounts in the fewest coins', () => {
    expect(walletCopper(purse({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }))).toBe(1000 + 200 + 50 + 30 + 4)
    expect(coinsFor(1234)).toEqual(purse({ gp: 12, sp: 3, cp: 4 }))
  })

  it('pays from the smallest coins first and breaks a bigger coin for change', () => {
    // 3 sp from a single gold piece: 7 sp back.
    expect(pay(purse({ gp: 1 }), 30)).toEqual(purse({ sp: 7 }))
    // Copper and silver go first; a gold piece is left alone.
    expect(pay(purse({ gp: 1, sp: 5, cp: 8 }), 45)).toEqual(purse({ gp: 1, sp: 1, cp: 3 }))
    // 33 cp from 3 sp and 5 cp: the last silver is broken.
    expect(pay(purse({ sp: 3, cp: 5 }), 33)).toEqual(purse({ cp: 2 }))
    expect(pay(purse({ pp: 1 }), 150)).toEqual(purse({ gp: 8, sp: 5 }))
    expect(pay(purse({ gp: 1 }), 101)).toBeNull()
    expect(pay(purse({ gp: 1 }), 0)).toEqual(purse({ gp: 1 }))
  })

  it('splits evenly, leaving the odd coins over', () => {
    expect(splitCoins(4700, 4)).toEqual({ each: 1175, left: 0 })
    expect(splitCoins(1000, 3)).toEqual({ each: 333, left: 1 })
    expect(coinWords(coinsFor(1175))).toBe('11 gp 7 sp 5 cp')
    expect(coinWords(EMPTY_WALLET)).toBe('nothing')
  })

  it('reads coins typed in', () => {
    expect(readCoins('12')).toBe(1200)
    expect(readCoins('2.5')).toBe(250)
    expect(readCoins('3 gp 4 sp')).toBe(340)
    expect(readCoins('1pp 5cp')).toBe(1005)
    expect(readCoins('lots')).toBeNull()
    expect(readCoins('3 gp and a bit')).toBeNull()
  })

  it('says what a gift was to the one who got it', () => {
    const items = [{ name: 'Longsword +1', quantity: 1 }]
    expect(giftWords({ items, copper: 500 }, null)).toBe('You got Longsword +1 and 5 gp')
    expect(giftWords({ items: [{ name: 'Torch', quantity: 3 }], copper: 0 }, 'Mira')).toBe('Mira gave you 3 × Torch')
    expect(giftWords({ items: [], copper: 1175 }, null)).toBe('You got 11 gp 7 sp 5 cp')
  })
})
