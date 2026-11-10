// The random of the brain: seeded, integer arithmetic only, so the same seed gives the same numbers on every engine.

import { PI, cos, log, max, sqrt } from './geometry.js';

/**
 * A stream of random numbers (mulberry32). `random()` is in [0, 1); `random(lo, hi)` in [lo, hi); `random.gauss()`
 * is normal with mean 0 and deviation 1; `random.fork(n)` is another stream that depends on this seed and `n` only.
 */
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random = (lo, hi) => (lo === undefined ? next() : lo + next() * (hi - lo));
  random.gauss = () => sqrt(-2 * log(max(1e-9, next()))) * cos(2 * PI * next());
  random.fork = (n) => seeded(Math.imul((seed >>> 0) ^ 0x9e3779b9, (n | 0) * 2 + 1) ^ ((n | 0) * 0x85ebca6b));
  return random;
}
