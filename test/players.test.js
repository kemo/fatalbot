// The measures of the recorded players (hosts/csbih/players.js), on tracks made by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimOf, burstSteps, errorOf, median, shotsBy, shotsOfKill, spread, tracksOf } from '../hosts/csbih/players.js';
import { seeded } from '../src/random.js';

test('the samples of a timeline become tracks, with the fine view angles of version 8', () => {
  // One row: the time, then for each player its number, x, y, z, the yaw in tenths and the flags (the pitch in
  // tenths over -90 from bit 4, dead in bit 0, ducked in bit 3).
  const flags = (pitch, dead, duck) => ((Math.round(pitch * 10) + 900) << 4) | (duck ? 8 : 0) | (dead ? 1 : 0);
  const tracks = tracksOf({ version: 8, samples: [[1.5, 7, 100, 200, 36, 905, flags(-12.5, false, true)], [1.55, 7, 101, 200, 36, 910, flags(3, true, false)]] });
  assert.deepEqual(tracks.get(7), [[1.5, { x: 100, y: 200, z: 36, yaw: 90.5, pitch: -12.5, dead: false, duck: true }], [1.55, { x: 101, y: 200, z: 36, yaw: 91, pitch: 3, dead: true, duck: false }]]);
});

// The killer stands at the origin and looks along x; the victim stands 500 units ahead. The middle of a head is
// 22 over a standing player's origin and the eye is 17 over it: the head lies 5 units over the eye's height.
const still = (id, x, yaw = 0, pitch = 0) => [id, [[0, { x, y: 0, z: 36, yaw, pitch, dead: false, duck: false }]]];
const pitchTo = (under) => (Math.atan2(under - 5, 500) * 180) / Math.PI;

test('the shots of a kill: how far under the head the crosshair is at each shot, in units', () => {
  const tracks = new Map([still(1, 0, 0, pitchTo(10)), still(2, 500)]);
  const shots = shotsBy([[9.0, 1], [8.5, 1], [9.2, 1], [9.1, 2], [5, 1]]);
  const burst = shotsOfKill(tracks, shots, { t: 9.2, killer: 1, victim: 2 });
  assert.equal(burst.length, 3, 'the three shots of the killer in the last 2 s, not the victim\'s and not an old one');
  for (const [error, low, side] of burst) {
    assert.ok(Math.abs(low - 10) < 0.2, `10 units under the head (${low})`);
    assert.ok(side < 0.2);
    assert.ok(Math.abs(error - 1.15) < 0.05, `about 1.15 degrees (${error})`);
  }
  const over = shotsOfKill(new Map([still(1, 0, 0, pitchTo(-8)), still(2, 500)]), shots, { t: 9.2, killer: 1, victim: 2 });
  assert.ok(over[0][1] < -7.8 && over[0][1] > -8.2, 'over the head is a number under zero');
  const away = shotsOfKill(new Map([still(1, 0, 40), still(2, 500)]), shots, { t: 9.2, killer: 1, victim: 2 });
  assert.equal(away.length, 0, 'a shot that goes another way is no shot of this kill');
});

test('the shots by their number: the first, the second, and the later ones together', () => {
  const steps = burstSteps([{ shots: [[1, 4, 0], [1, 6, 0], [1, 9, 0], [1, 12, 0], [1, 16, 0]] }, { shots: [[2, 2, 0]] }]);
  assert.equal(steps[0].n, 2);
  assert.equal(steps[0].low.p50, 4);
  assert.equal(steps[1].low.p50, 6);
  assert.equal(steps[3].n, 2, 'shots 4 and 5 of the first kill');
  assert.equal(steps[5].n, 0);
});

test('the spread of a list and the error of a number from many demos', () => {
  const s = spread([5, 1, 3, 2, 4, null, NaN]);
  assert.deepEqual(s, { n: 5, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 });
  assert.equal(median([9, 1, 5]), 5);
  // Twenty demos with the same number have no error; demos that differ have one, and the same seed gives it again.
  const same = Array.from({ length: 20 }, () => [4]);
  const mean = (demos) => demos.flat().reduce((n, v) => n + v, 0) / demos.length;
  assert.equal(errorOf(same, mean, seeded(1)), 0);
  const mixed = Array.from({ length: 20 }, (_, i) => [i % 2 ? 0 : 10]);
  const error = errorOf(mixed, mean, seeded(1));
  assert.ok(error > 0.8 && error < 1.5, `near 5 / sqrt(20) = 1.1 (${error})`);
  assert.equal(errorOf(mixed, mean, seeded(1)), error);
});

test('the aim of many demos: the share of the kills to the head, of all and of each player', () => {
  const player = (kills, heads) => ({ kills, heads, groups: { rifle: [kills, heads] }, fights: [], bursts: [] });
  const demos = [[player(40, 10), player(20, 10)], [player(40, 30), player(5, 5)]];
  const aim = aimOf(demos, seeded(1));
  assert.equal(aim.kills, 105);
  assert.equal(aim.head.all, 55 / 105);
  assert.equal(aim.head.players.n, 3, 'a player with 5 kills is too few for a share of its own');
  assert.equal(aim.head.players.p50, 0.5);
  assert.ok(aim.head.error > 0);
  assert.equal(aimOf(demos, seeded(1), 'pistol').kills, 0);
});
