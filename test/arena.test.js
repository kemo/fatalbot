// The arena's own rules, without a level: what a tool plays for a pairing of kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordersOf } from '../hosts/csbih/arena.js';

test('two kinds play each side on a seed, and one kind against itself plays the seed once', () => {
  assert.deepEqual(ordersOf('fatal', 'ref'), [['fatal', 'ref'], ['ref', 'fatal']]);
  assert.deepEqual(ordersOf('fatal', 'ref', false), [['fatal', 'ref']]);
  // The same kinds and the same seed give the same match: a second order would count each round two times.
  assert.deepEqual(ordersOf('fatal', 'fatal'), [['fatal', 'fatal']]);
});
