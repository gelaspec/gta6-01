// A small seeded random number generator (mulberry32): the same seed gives the
// same city, the same traffic and the same screenshot scenes, which is what
// makes the ?shot= scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function int(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function chance(random, p) {
  return random() < p;
}

export function weighted(random, entries) {
  // entries: [[weight, value], ...] — pick a value in proportion to its weight.
  let total = 0;
  for (const [w] of entries) total += w;
  let roll = random() * total;
  for (const [w, value] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][1];
}
