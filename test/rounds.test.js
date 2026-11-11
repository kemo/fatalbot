// The shape of a round: the first death, the plant and the numbers at it, the Ts in a site.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeOf, shapeTable } from '../hosts/csbih/rounds.js';
import { STEP } from '../hosts/csbih/strategies.js';

// Two sites; the Ts walk east to site 0. A lane is a player's place each STEP seconds, null once dead.
const zones = { sites: [{ mid: [1000, 0, 36], mins: [900, -100, 0], maxs: [1100, 100, 72] }, { mid: [-1000, 0, 36], mins: [-1100, -100, 0], maxs: [-900, 100, 72] }], spawn: { T: [0, -2000, 36], CT: [0, 2000, 36] } };
const lane = (from, to, steps, dieAt = Infinity) => Array.from({ length: steps }, (_, i) => (i >= dieAt ? null : [from[0] + ((to[0] - from[0]) * i) / (steps - 1), from[1] + ((to[1] - from[1]) * i) / (steps - 1), 36, 0]));
/** A round of 60 s: `tDie` and `ctDie` give the step at which each player of a side dies. */
const round = (winner, plant, tDie = [], ctDie = []) => ({
  seconds: 60, winner, plant, buy: { T: 'full', CT: 'full' },
  T: [0, 1, 2, 3, 4].map((i) => lane([i * 40, -2000], [1000 + i * 30, 0], 31, tDie[i])),
  CT: [0, 1, 2, 3, 4].map((i) => lane([i * 40, 2000], [1000 + i * 30, 300], 31, ctDie[i])),
});

test('the shape of a round: the first death, the numbers at the plant, the Ts in the site', () => {
  // A CT dies at step 5 (10 s), a T at step 10, a second CT at step 12. The plant is at 50 s (step 25).
  const s = shapeOf(zones, round('T', { t: 50, at: [1010, 5, 0] }, [10], [5, 12]));
  assert.deepEqual(s.first, { side: 'CT', t: 5 * STEP });
  assert.deepEqual(s.plant, { t: 50, T: 4, CT: 3 });
  assert.equal(s.site, 0);
  assert.ok(s.te > 20 && s.te <= 60, 'a T stood in the site');
  assert.equal(s.entry.T, 4);
  assert.ok(s.entry.tAtSite >= 1 && s.later.tAtSite >= s.entry.tAtSite, 'more Ts are in the site 10 s later');
  // A T and a CT die in one step: no side died first.
  assert.equal(shapeOf(zones, round('T', null, [5], [5])).first.side, 'both');
  // The Ts die on the way: no plant, no site.
  const stopped = shapeOf(zones, round('CT', null, [8, 8, 8, 8, 8]));
  assert.deepEqual([stopped.plant, stopped.site, stopped.entry], [null, null, null]);
});

test('the table of many shapes: shares of the wins by the first death and by the plant', () => {
  const shapes = [
    shapeOf(zones, round('T', { t: 50, at: [1010, 5, 0] }, [], [5, 12])),
    shapeOf(zones, round('T', { t: 50, at: [1010, 5, 0] }, [10], [5])),
    shapeOf(zones, round('CT', { t: 50, at: [1010, 5, 0] }, [4, 6, 7], [20])),
    shapeOf(zones, round('CT', null, [8, 8, 8, 8, 8])),
  ];
  const table = Object.fromEntries(shapeTable(shapes).map(([title, value]) => [title, value]));
  assert.equal(table.Rounds, 4);
  assert.equal(table['The Ts win'], 0.5);
  assert.equal(table['The first death is a CT'], 0.5);
  assert.equal(table['The Ts win after a CT died first'], 1);
  assert.equal(table['The Ts win after a T died first'], 0);
  assert.equal(table['Rounds with a plant'], 0.75);
  assert.equal(table['The Ts win with no plant'], 0);
  // At the three plants: 5 against 3, 4 against 4, 2 against 4.
  assert.ok(Math.abs(table['Plants with two or more Ts ahead'] - 1 / 3) < 1e-9);
  assert.ok(Math.abs(table['Plants with the sides level'] - 1 / 3) < 1e-9);
  assert.equal(table['The Ts win a plant with the CTs ahead'], 0);
  assert.equal(table['Rounds in which no T stood in a site'], 0.25);
});
