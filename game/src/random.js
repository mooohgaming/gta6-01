// A small seeded random number generator (mulberry32): the same seed gives the
// same city, the same traffic and the same story, which is what makes the
// screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.range = (min, max) => min + random() * (max - min);
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.int = (min, max) => min + Math.floor(random() * (max - min + 1));
  return random;
}
