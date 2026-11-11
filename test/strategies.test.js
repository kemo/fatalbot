// The strategies of recorded matches: the grouping of formations, the attack of a round, and the plans in a bot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attackOf, fitRounds, formationGap, groupFormations, plansOf, strategiesOf, STEP } from '../hosts/csbih/strategies.js';

const five = (x, y) => [0, 1, 2, 3, 4].map((i) => [x + i * 40, y, 36, 0]);

test('two formations lie apart by the mean of their players, paired the nearest way', () => {
  const a = five(0, 0);
  assert.equal(formationGap(a, a), 0);
  // The same places in another order: still the same formation.
  assert.equal(formationGap(a, [a[3], a[0], a[4], a[1], a[2]]), 0);
  assert.equal(formationGap(a, five(0, 100)), 100);
});

test('formations near each other are one strategy, and its face is one of them', () => {
  const forms = [];
  for (let i = 0; i < 12; i++) forms.push(five(i * 10, 0));
  for (let i = 0; i < 5; i++) forms.push(five(3000 + i * 10, 2000));
  const groups = groupFormations(forms);
  assert.deepEqual(groups.map((g) => g.members.length), [12, 5]);
  assert.ok(forms.includes(groups[0].points), 'the face is a formation that a team stood in');
});

// A map of two sites; a round where the Ts walk east to site 0 and plant, and one where they never get there.
const zones = { sites: [{ mid: [1000, 0, 36], mins: [900, -100, 0], maxs: [1100, 100, 72] }, { mid: [-1000, 0, 36], mins: [-1100, -100, 0], maxs: [-900, 100, 72] }], spawn: { T: [0, -2000, 36], CT: [0, 2000, 36] } };
const lane = (from, to, steps, dieAt = Infinity) => Array.from({ length: steps }, (_, i) => (i >= dieAt ? null : [from[0] + ((to[0] - from[0]) * i) / (steps - 1), from[1] + ((to[1] - from[1]) * i) / (steps - 1), 36, 0]));
const round = (winner, tTo, plant, dieAt) => ({
  seconds: 60, winner, plant, buy: { T: 'full', CT: 'full' },
  T: [0, 1, 2, 3, 4].map((i) => lane([i * 40, -2000], [tTo[0] + i * 30, tTo[1]], 31, dieAt)),
  CT: [0, 1, 2, 3, 4].map((i) => lane([i * 40, 2000], [900 + i * 30, 300], 31)),
});

test('the attack of a round: the site of the plant and the second of the first T in it', () => {
  const planted = attackOf(zones, round('T', [1000, 0], { t: 50, at: [1010, 5, 0] }));
  assert.equal(planted.site, 0);
  assert.ok(planted.te > 20 && planted.te <= 60 && planted.te % STEP === 0);
  // The Ts die on the way: no site.
  assert.deepEqual(attackOf(zones, round('CT', [1000, 0], null, 8)), { site: null, te: null });
});

test('the strategies of a map: shares, wins, the site, and the plans for the bots', () => {
  const rounds = [];
  for (let i = 0; i < 8; i++) rounds.push(round(i < 6 ? 'T' : 'CT', [1000, 0], { t: 50, at: [1000, 0, 0] }));
  for (let i = 0; i < 5; i++) rounds.push(round('CT', [-1000, 0], { t: 55, at: [-1000, 0, 0] }));
  const found = strategiesOf(zones, rounds);
  assert.equal(found.rounds, 13);
  assert.ok(Math.abs(found.tWon - 6 / 13) < 1e-9);
  assert.deepEqual(found.sites.map((s) => s.rounds), [8, 5]);
  assert.equal(found.T.length, 2, 'the Ts stood two ways at second 20');
  assert.deepEqual(found.T.map((s) => s.rounds), [8, 5]);
  assert.ok(Math.abs(found.T[0].won - 0.75) < 1e-9 && found.T[0].sites[0] === 1);
  assert.equal(found.CT.length, 1, 'the CTs stood one way');
  const plans = plansOf(found);
  assert.deepEqual(plans.T.map((p) => p.site), [0, 1]);
  assert.equal(plans.T[0].points.length, 5);
  assert.ok(plans.T[0].te > 0);
  assert.equal(plans.CT.length, 1);
});

// A stand-in for the game core: a round holds its players, and a place is in a wall where the level says so.
const fakeCore = {
  hull: { HULL_STAND: 0, newTrace: () => ({ startSolid: false }), traceBox: (hulls, _hull, from, _to, tr) => { tr.startSolid = hulls.solid(from); } },
  demoRound: { demoRound: (_timeline, round) => ({ players: round.players }) },
};
// The level: two spawns, and a wall everywhere under z = 0 and beyond x = 5000.
const fakeLevel = { hulls: { solid: (o) => o[2] < 0 || o[0] > 5000 }, rules: { spawns: [{ side: 'T', origin: [0, 0, 36] }, { side: 'CT', origin: [2000, 0, 36] }] } };
const startAt = (...places) => ({ players: places.map((origin) => ({ origin })) });

test('the rounds of a recording that are played on its level: both signs of another map are needed', () => {
  const atSpawns = startAt([0, 10, 36], [20, 0, 36], [2000, 10, 36], [1990, 0, 36]);
  // At their spawns, a few units inside the floor: the sample of the respawn.
  const sunk = startAt([0, 10, -5], [20, 0, -5], [2000, 10, -5], [1990, 0, -5]);
  // The start of the round read late: the players ran off, into free space.
  const late = startAt([600, 300, 36], [700, 300, 36], [1400, 300, 36], [1500, 300, 36]);
  // Another map: far from every spawn, and inside the walls of this level.
  const other = startAt([6000, 0, 36], [6100, 0, 36], [7000, 0, 36], [7100, 0, 36]);
  assert.deepEqual(fitRounds(fakeCore, fakeLevel, null, [atSpawns, sunk, late, atSpawns, other]), [atSpawns, sunk, late, atSpawns]);
  // Most rounds start far from every spawn: the recording is of another map, and only the rounds at the spawns stay.
  const elsewhere = startAt([900, 900, 36], [950, 900, 36], [1000, 900, 36]);
  assert.deepEqual(fitRounds(fakeCore, fakeLevel, null, [atSpawns, elsewhere, elsewhere, other]), [atSpawns]);
  // A round with no player of its own counts for nothing and stays.
  assert.deepEqual(fitRounds(fakeCore, fakeLevel, null, [startAt(), atSpawns]).length, 2);
});
