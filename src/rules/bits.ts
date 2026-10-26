// Bits and bobs: ordinary odds and ends written for this table (not from any book), for giving
// and for boxes. A few are worth something to the right buyer.

export type Bit = {
  index: string
  name: string
  /** Pounds. */
  weight: number
  /** What it's worth in copper, if anything. */
  worth: number
  /** A line about it. */
  note: string
}

const bit = (index: string, name: string, weight: number, worth: number, note: string): Bit => ({
  index: `bits-${index}`,
  name,
  weight,
  worth,
  note,
})

export const BITS: Bit[] = [
  bit('bent-spoon', 'Bent spoon', 0.1, 0, 'Pewter, bent nearly in half. Someone was angry, or very hungry.'),
  bit('fork', 'Tin fork', 0.1, 1, 'Three tines, one missing.'),
  bit('knife', 'Blunt table knife', 0.2, 1, 'Fine for butter, hopeless for anything else.'),
  bit('chipped-cup', 'Chipped cup', 0.5, 0, 'Clay, with a chip on the rim and a painted blue bird.'),
  bit('wooden-bowl', 'Wooden bowl', 0.5, 1, 'Worn smooth by years of porridge.'),
  bit('string', 'Ball of string', 0.1, 1, 'About twenty feet, a little frayed.'),
  bit('twine', 'Hank of twine', 0.2, 1, 'Coarse and strong, good for tying bundles.'),
  bit('cloth-scrap', 'Scrap of cloth', 0.1, 0, 'Faded red wool, about the size of a hand.'),
  bit('rag', 'Oily rag', 0.1, 0, 'It smells of lamp oil and old fish.'),
  bit('sack', 'Torn sack', 0.5, 0, 'Holes in the bottom. It held grain once.'),
  bit('candle-stub', 'Candle stub', 0.1, 1, 'Burns for perhaps half an hour.'),
  bit('comb', 'Wooden comb', 0.1, 2, 'Several teeth missing.'),
  bit('button', 'Tarnished button', 0, 1, 'Brass, with a stag stamped on it.'),
  bit('buttons', 'Handful of buttons', 0.1, 2, 'Bone, wood and one of glass.'),
  bit('needle', 'Bent needle and thread', 0, 1, 'Still good for a quick mend.'),
  bit('thimble', 'Thimble', 0, 2, 'Copper, dented.'),
  bit('dice', 'Pair of bone dice', 0, 5, 'One of them seems to roll a lot of sixes.'),
  bit('cards', 'Greasy deck of cards', 0.1, 5, 'Two cards are missing and one is drawn in by hand.'),
  bit('pipe', 'Clay pipe', 0.1, 2, 'The stem is cracked.'),
  bit('tobacco', 'Pouch of pipeweed', 0.1, 5, 'Dry and crumbly.'),
  bit('key', 'Small iron key', 0, 1, 'It doesn’t open anything here.'),
  bit('nails', 'Handful of nails', 0.5, 1, 'Rusty, all different sizes.'),
  bit('horseshoe', 'Old horseshoe', 2, 1, 'Some say it’s lucky.'),
  bit('broken-arrow', 'Broken arrow', 0.1, 0, 'The head is good; the shaft is snapped.'),
  bit('flint', 'Lump of flint', 0.5, 0, 'Sparks well against steel.'),
  bit('chalk', 'Stick of chalk', 0, 1, 'White, half used.'),
  bit('letter', 'Unsent letter', 0, 0, 'To someone called Merra. It ends mid-sentence.'),
  bit('map-scrap', 'Torn scrap of a map', 0, 0, 'A river, a bridge and an X with no name.'),
  bit('bread', 'Stale heel of bread', 0.5, 0, 'Hard as a rock. Edible, just.'),
  bit('cheese', 'Wedge of hard cheese', 0.5, 1, 'Wrapped in wax. Smells strong.'),
  bit('apple', 'Wrinkled apple', 0.3, 0, 'Sweet, if you don’t mind the bruise.'),
  bit('bottle', 'Empty bottle', 1, 1, 'Green glass, with a cork.'),
  bit('wine', 'Bottle of cheap wine', 1.5, 10, 'Vinegary, but it warms you.'),
  bit('toy', 'Carved wooden horse', 0.2, 2, 'A child’s toy, well loved.'),
  bit('doll', 'Rag doll', 0.3, 1, 'One button eye.'),
  bit('feather', 'Bright feather', 0, 0, 'Blue and green, from no bird you know.'),
  bit('shell', 'Seashell', 0, 0, 'Far from the sea.'),
  bit('bell', 'Little brass bell', 0.1, 5, 'It rings clear and sweet.'),
  bit('spectacles', 'Cracked spectacles', 0, 10, 'One lens cracked across.'),
  bit('locket', 'Tin locket', 0, 5, 'Inside, a tiny painted face, too faded to make out.'),
  bit('silver-ring', 'Silver ring', 0, 1000, 'Plain and well made. Worth about 10 gp.'),
  bit('copper-bracelet', 'Copper bracelet', 0, 200, 'Green with age. Worth about 2 gp.'),
  bit('pearl', 'Small pearl', 0, 1000, 'Worth about 10 gp to a jeweller.'),
  bit('agate', 'Polished agate', 0, 1000, 'Banded brown and white. Worth about 10 gp.'),
  bit('gold-tooth', 'Gold tooth', 0, 500, 'Best not to ask. Worth about 5 gp.'),
]
