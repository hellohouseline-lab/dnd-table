// Coins (2014 rules): 10 copper make a silver, 5 silver an electrum, 2 electrum a gold, 10 gold a
// platinum. Paying spends the smallest coins first and breaks a bigger coin only when it has to,
// with change in the fewest gold, silver and copper coins (decision 39). Splitting shares coins
// evenly, and what can't be shared stays in the party stash (decision 38). The server does the
// same sums in `private.pay` and friends; these are for the screens and the tests.

import { EMPTY_WALLET, type Wallet } from './character.ts'

export const COIN_VALUE: Record<keyof Wallet, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
const SMALLEST_FIRST: (keyof Wallet)[] = ['cp', 'sp', 'ep', 'gp', 'pp']

export const COIN_NAME: Record<keyof Wallet, string> = {
  pp: 'Platinum',
  gp: 'Gold',
  ep: 'Electrum',
  sp: 'Silver',
  cp: 'Copper',
}

/** What a purse is worth, in copper. */
export function walletCopper(wallet: Wallet): number {
  return SMALLEST_FIRST.reduce((sum, coin) => sum + wallet[coin] * COIN_VALUE[coin], 0)
}

/** An amount in the fewest gold, silver and copper coins. */
export function coinsFor(copper: number): Wallet {
  const c = Math.max(0, Math.floor(copper))
  return { ...EMPTY_WALLET, gp: Math.floor(c / 100), sp: Math.floor((c % 100) / 10), cp: c % 10 }
}

export function addWallets(a: Wallet, b: Wallet): Wallet {
  return { cp: a.cp + b.cp, sp: a.sp + b.sp, ep: a.ep + b.ep, gp: a.gp + b.gp, pp: a.pp + b.pp }
}

/** Whether a purse holds at least these coins, coin for coin. */
export function hasCoins(wallet: Wallet, coins: Wallet): boolean {
  return SMALLEST_FIRST.every((coin) => wallet[coin] >= coins[coin])
}

export function subtractCoins(wallet: Wallet, coins: Wallet): Wallet {
  return {
    cp: wallet.cp - coins.cp,
    sp: wallet.sp - coins.sp,
    ep: wallet.ep - coins.ep,
    gp: wallet.gp - coins.gp,
    pp: wallet.pp - coins.pp,
  }
}

/**
 * Pays an amount (in copper) from a purse: the smallest coins first, then one bigger coin broken
 * if that's not enough, with the change back in the fewest coins. Null if the purse can't cover it.
 */
export function pay(wallet: Wallet, copper: number): Wallet | null {
  if (copper <= 0) return wallet
  if (walletCopper(wallet) < copper) return null
  const left = { ...wallet }
  let owed = copper
  for (const coin of SMALLEST_FIRST) {
    const used = Math.min(left[coin], Math.floor(owed / COIN_VALUE[coin]))
    left[coin] -= used
    owed -= used * COIN_VALUE[coin]
  }
  if (owed === 0) return left
  // Break the smallest coin that covers what's still owed.
  const coin = SMALLEST_FIRST.find((c) => left[c] > 0 && COIN_VALUE[c] >= owed)
  if (!coin) return null
  left[coin] -= 1
  return addWallets(left, coinsFor(COIN_VALUE[coin] - owed))
}

/** An amount shared between some people: each one's share, and what's left over for the stash. */
export function splitCoins(copper: number, people: number): { each: number; left: number } {
  if (people <= 0) return { each: 0, left: copper }
  const each = Math.floor(copper / people)
  return { each, left: copper - each * people }
}

/** "12 gp 5 sp", "nothing". */
export function coinWords(wallet: Wallet): string {
  const order: (keyof Wallet)[] = ['pp', 'gp', 'ep', 'sp', 'cp']
  return (
    order
      .filter((c) => wallet[c] > 0)
      .map((c) => `${wallet[c]} ${c}`)
      .join(' ') || 'nothing'
  )
}

/** Gold pieces typed as text ("12", "12.5", "3 gp 4 sp") to copper; null if it can't be read. */
export function readCoins(text: string): number | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  if (/^\d+(\.\d{1,2})?$/.test(t)) return Math.round(Number(t) * 100)
  const parts = [...t.matchAll(/(\d+)\s*(pp|gp|ep|sp|cp)\b/g)]
  if (parts.length === 0 || t.replace(/(\d+)\s*(pp|gp|ep|sp|cp)\b/g, '').trim() !== '') return null
  return parts.reduce((sum, p) => sum + Number(p[1]) * COIN_VALUE[p[2] as keyof Wallet], 0)
}

/** What a gift says to the one who got it: "You got Longsword +1 and 5 gp", "Mira gave you a Rope". */
export function giftWords(
  gift: { items: { name: string; quantity: number }[]; copper: number },
  fromName: string | null,
): string {
  const things = [
    ...gift.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)),
    ...(gift.copper > 0 ? [coinWords(coinsFor(gift.copper))] : []),
  ]
  const list =
    things.length > 1 ? `${things.slice(0, -1).join(', ')} and ${things[things.length - 1]}` : (things[0] ?? '')
  return fromName ? `${fromName} gave you ${list}` : `You got ${list}`
}
