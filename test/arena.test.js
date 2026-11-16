// The arena's own rules, without a level: what a tool plays for a pairing of kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gauge, measureLine, ordersOf, summarize } from '../hosts/csbih/arena.js';

test('two kinds play each side on a seed, and one kind against itself plays the seed once', () => {
  assert.deepEqual(ordersOf('fatal', 'ref'), [['fatal', 'ref'], ['ref', 'fatal']]);
  assert.deepEqual(ordersOf('fatal', 'ref', false), [['fatal', 'ref']]);
  // The same kinds and the same seed give the same match: a second order would count each round two times.
  assert.deepEqual(ordersOf('fatal', 'fatal'), [['fatal', 'fatal']]);
});

test('the head share counts the kills with a gun only, and the plants of a kind count its rounds as the Ts', () => {
  const core = { hull: { HULL_POINT: 0, newTrace: () => ({}), traceBox: () => {} } };
  const players = new Map([1, 2, 3, 4].map((id) => [id, { id, team: id <= 2 ? 'T' : 'CT' }]));
  const g = gauge(core, { players, time: 0 }, (id) => (id <= 2 ? 'fatal' : 'ref'), ['fatal', 'ref']);
  g.events([
    { type: 'kill', killer: 1, victim: 3, weapon: 'ak47', headshot: true },
    { type: 'kill', killer: 1, victim: 4, weapon: 'deagle', headshot: true },
    { type: 'kill', killer: 2, victim: 3, weapon: 'knife', headshot: true },
    { type: 'kill', killer: 2, victim: 4, weapon: 'hegrenade', headshot: false },
  ]);
  assert.match(measureLine('fatal', g.measure.fatal), /kills 4 deaths 0 headshots 100\.0% of 2 gun kills/);

  const round = (planted) => ({ winner: 'T', reason: 'x', seconds: 60, planted, kills: { T: 0, CT: 0 } });
  const match = (T, CT, plants) => ({ sides: { T, CT }, rounds: [round(plants > 0), round(plants > 1), round(false), round(false)], measure: {}, ticks: 1, stepMs: 0 });
  const s = summarize([match('fatal', 'ref', 2), match('ref', 'fatal', 0)]);
  assert.match(measureLine('fatal', s.measure.fatal), /G4 plants as the Ts 50\.0% of 4 rounds/);
  assert.match(measureLine('ref', s.measure.ref), /G4 plants as the Ts 0\.0% of 4 rounds/);
});
