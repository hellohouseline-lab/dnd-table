// Join codes are six letters and digits with no look-alikes (no I, O, 0 or 1), like K7QM2P.
// The database makes them and checks them; these helpers tidy what people type and build links.

const JOIN_CODE = /^[A-HJ-NP-Z2-9]{6}$/

/** 'k7q-m2p' and ' K7Q M2P ' both become 'K7QM2P'. */
export function normaliseJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isJoinCode(code: string): boolean {
  return JOIN_CODE.test(code)
}

/** The link players open to join: the site address plus '#/join/<code>'. */
export function inviteLink(siteUrl: string, code: string): string {
  return `${siteUrl}#/join/${code}`
}
