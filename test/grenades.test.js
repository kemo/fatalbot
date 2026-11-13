// The grenades: the flight, the search of a throw, and the lineups of a map in the real game core.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flight, lineupsSolved, solveThrow, throwOf } from '../src/grenades.js';
import { csbihMissing, loadCore, loadLevel, loadMapData } from '../hosts/csbih/load.js';
import { csbihHost } from '../hosts/csbih/adapter.js';
import { runMatch, referenceKind } from '../hosts/csbih/arena.js';
import { fatalKind } from '../hosts/csbih/kind.js';
import { flatMap, flatPorts } from './support/flat-host.js';

const open = flatPorts({ half: -1 });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('the throw of the game: the view bent up, the speed capped at 750', () => {
  const level = throwOf([0, 0, 53], 0, 0);
  assert.ok(level.velocity[2] > 0, 'a level view throws upward');
  const up = throwOf([0, 0, 53], 90, -60);
  assert.ok(Math.abs(Math.hypot(...up.velocity) - 750) < 1e-6);
  assert.ok(Math.abs(up.velocity[0]) < 1e-6 && up.velocity[1] > 0);
  const run = throwOf([0, 0, 53], 0, 0, [250, 0, 0]);
  assert.ok(Math.abs(run.velocity[0] - level.velocity[0] - 250) < 1e-9, 'the run of the thrower adds');
});

test('a grenade flies, bounces on the floor and goes off after its fuse', () => {
  const t = throwOf([0, 0, 53], 0, -20);
  const he = flight(open, 'he', t.from, t.velocity);
  assert.ok(he.time > 1.6 && he.time < 1.7);
  assert.ok(he.point[0] > 500 && he.point[0] < 1300 && Math.abs(he.point[1]) < 1, `along its line (${he.point.map(Math.round)})`);
  assert.ok(he.point[2] >= -1 && he.point[2] < 200);
  const smoke = flight(open, 'smoke', t.from, t.velocity);
  assert.ok(smoke.point[2] < 2, 'a smoke grenade goes off on the floor');
  assert.ok(smoke.time >= 1.6);
  // The wall of the test host stops it.
  const wall = flight(flatPorts({ half: 5000 }), 'he', t.from, t.velocity);
  assert.ok(wall.point[0] < 320, 'it does not pass a wall');
});

test('a throw is found for a place where a grenade can go off, and none for a place out of reach', () => {
  const eye = [0, 0, 53];
  // Places that a throw reaches: where other throws went off. The search starts from another view.
  for (const [yaw, pitch, kind] of [[3, -23, 'flash'], [-4, -47, 'he'], [2, 8, 'smoke'], [5, -11, 'he']]) {
    const made = throwOf(eye, yaw, pitch);
    const target = flight(open, kind, made.from, made.velocity).point;
    const v = solveThrow(open, kind, eye, target, 0);
    assert.ok(v.miss < 90, `${kind} at yaw ${yaw} pitch ${pitch}: miss ${v.miss.toFixed(0)}`);
    const t = throwOf(eye, v.yaw, v.pitch);
    assert.ok(dist(flight(open, kind, t.from, t.velocity).point, target) < 90);
  }
  assert.ok(solveThrow(open, 'he', eye, [3000, 0, 0], 0).miss > 500, 'out of reach');
});

test('a brain with no lineups throws none', () => {
  const brain = createBrain({ map: flatMap(), ports: open, seed: 1 });
  assert.deepEqual(lineupsSolved(brain), { all: 0, solved: 0, miss: null });
});

const MAP = 'de_dust2';
const missing = csbihMissing(MAP) ?? false;
const core = missing ? null : await loadCore();
const level = missing ? null : loadLevel(core, MAP);
const lineups = missing ? [] : loadMapData(MAP).lineups;
const skip = missing || (lineups.length ? false : `no lineups of ${MAP} in csbih-player (tools/build-profiles.js)`);

test('the lineups of a map: a part is a throw from a stand, and it goes off near the recorded one in the game core', { skip }, async () => {
  const grenade = await import(`${(await import('../hosts/csbih/load.js')).csbihRoot()}/src/shared/game/grenade.js`);
  const sample = lineups.slice(0, 60);
  const fresh = () => new core.world.World(level.hulls, { seed: 1, nav: level.nav, rules: level.rules });
  const brain = csbihHost(core, fresh(), level, { seed: 1, lineups: sample }).brain;
  const solved = lineupsSolved(brain);
  assert.equal(solved.all, 60);
  assert.ok(solved.solved >= 15, `only ${solved.solved} of 60 solved`);
  const burst = (w) => {
    for (let i = 0; i < 900; i++) {
      w.step();
      const e = w.events.find((x) => x.type === 'burst');
      w.events.length = 0;
      if (e) return e.at;
    }
    return null;
  };
  const KEY = { he: 'hegrenade', flash: 'flashbang', smoke: 'smokegrenade' };
  let thrown = 0;
  for (let i = 0; i < sample.length && thrown < 10; i++) {
    const t = brain.nav.throws.get(i);
    if (!t) continue;
    const l = brain.map.lineups[i];
    // The recorded throw, as the game core flies it.
    const a = fresh();
    grenade.throwGrenade(a, a.addPlayer({ id: 1, team: 'T', origin: [0, 0, 0], controller: null }), l.kind, l.from, l.velocity);
    const recorded = burst(a);
    // The brain's throw by the keys: the pin out for a moment, then the key up.
    const b = fresh();
    let tick = 0;
    b.addPlayer({ id: 1, team: l.team, origin: t.stand, yaw: t.yaw, pitch: t.pitch, weapon: KEY[l.kind], weapons: [KEY[l.kind]], controller: { command: () => ({ forward: 0, side: 0, jump: false, duck: false, walk: false, attack: tick++ > 90 && tick < 110, yaw: t.yaw, pitch: t.pitch }) } });
    const mine = burst(b);
    assert.ok(recorded && mine, 'both go off');
    assert.ok(dist(recorded, mine) < 220, `lineup ${i} (${l.kind}): ${dist(recorded, mine).toFixed(0)} units apart`);
    thrown++;
  }
  assert.ok(thrown >= 5);
});

test('in a match the bots of fatalbot throw lineups', { skip }, () => {
  // Two matches: the throws of one seed go from 1 to 9 of 4 rounds with a small change of the fight.
  let throws = 0;
  for (const seed of [4, 5]) {
    const m = runMatch({ core, level, sides: { T: fatalKind(core, level, { lineups }), CT: referenceKind(core) }, seed, rounds: 4 });
    throws += m.measure.fatal.throws;
  }
  assert.ok(throws >= 4, `${throws} grenades in 8 rounds`);
});
