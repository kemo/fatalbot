// The plans of a map in a bot (spec 02, map.plans), on the flat test map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flat } from '../src/geometry.js';
import { flatMap, flatPorts, frameAt, player } from './support/flat-host.js';

const SITES = [{ mins: [450, 350, 0], maxs: [550, 450, 72] }, { mins: [450, -450, 0], maxs: [550, -350, 72] }];
const plans = {
  T: [{ points: [[-600, 200, 36, 0], [-600, 100, 36, 0], [-600, 0, 36, 0], [-600, -100, 36, 0], [-600, -200, 36, 0]], site: 0, te: 30, share: 1, won: 0.5 }],
  CT: [{ points: [[400, 400, 36, 180], [480, 300, 36, 180], [0, 0, 36, 180], [400, -400, 36, 180], [480, -300, 36, 180]], share: 1, won: 0.5 }],
};
const SIZE = 56;
const mapWith = (own = plans) => ({ ...flatMap({ sites: SITES, size: SIZE, spawns: [-800, 600] }), plans: own });
const brainWith = (ids, map = mapWith(), ports = { half: -1 }) => {
  const brain = createBrain({ map, ports: flatPorts(ports), seed: 3 });
  for (const id of ids) brain.join(id);
  return brain;
};
// The floor of the flat map at a point of its grid (32 units).
const nodeAt = (x, y) => (x / 32 + SIZE / 2) * SIZE + y / 32 + SIZE / 2;

test('a CT with a mined setup holds a place of it, and looks as its player looked', () => {
  const brain = brainWith([1]);
  brain.frame(frameAt(1, [player(1, 'CT', [600, 0, 36], { own: true }), player(9, 'T', [-800, 0, 36])]));
  brain.think(1);
  const post = brain.teams.CT.plan.posts.get(1);
  assert.ok(plans.CT[0].points.some((p) => flat(p, post.point) < 40), 'its post is a place of the setup');
  assert.equal(post.yaw, 180);
  assert.equal(brain.debug(1).goal, 'site');
  assert.deepEqual(brain.debug(1).point, post.point);
});

test('a T with a mined plan waits at its place, and goes when its way to the site takes the time that is left', () => {
  const brain = brainWith([1]);
  const goalAt = (tick, origin) => {
    brain.frame(frameAt(tick, [player(1, 'T', origin, { own: true }), player(9, 'CT', [600, 0, 36])]));
    brain.think(1);
    return brain.debug(1);
  };
  const early = goalAt(1, [-800, 0, 36]);
  assert.equal(early.goal, 'stage');
  assert.ok(plans.T[0].points.some((p) => flat(p, early.point) < 40), 'to a place of the formation');
  // The site lies about 1100 units from the place: at 240 units a second the bot goes about 5 s before second 30.
  assert.equal(goalAt(2000, [-600, 0, 36]).goal, 'stage', 'at second 20 it still waits');
  assert.notEqual(goalAt(2800, [-600, 0, 36]).goal, 'stage', 'at second 28 it is on its way');
});

test('a T that the formation has no place for waits at a place of a teammate', () => {
  const own = { T: [{ points: [[-608, 0, 36, 0]], site: 0, te: 60, share: 1, won: 0.5 }], CT: [] };
  const brain = brainWith([1, 2], mapWith(own), { half: 5000 });
  brain.frame(frameAt(1, [player(1, 'T', [-800, 32, 36], { own: true }), player(2, 'T', [-800, -32, 36], { own: true }), player(9, 'CT', [600, 0, 36])]));
  for (const id of [1, 2]) {
    brain.think(id);
    assert.equal(brain.debug(id).goal, 'stage');
    assert.deepEqual(brain.debug(id).point.slice(0, 3), [-608, 0, 36]);
  }
});

test('a T that does not get to its place in 5 s takes the place of a teammate', () => {
  const own = { T: [{ points: [[-608, 0, 36, 0], [-608, 320, 36, 0]], site: 0, te: 60, share: 1, won: 0.5 }], CT: [] };
  const brain = brainWith([1, 2], mapWith(own), { half: 5000 });
  // The frames hold bot 1 where it starts (a ladder that it cannot leave); bot 2 stands at its own place.
  const pointAt = (tick) => {
    brain.frame(frameAt(tick, [player(1, 'T', [-800, 32, 36], { own: true }), player(2, 'T', [-608, 320, 36], { own: true }), player(9, 'CT', [600, 0, 36])]));
    brain.think(1);
    brain.think(2);
    return brain.debug(1).point?.slice(0, 3) ?? null;
  };
  assert.deepEqual(pointAt(1), [-608, 0, 36], 'first the place nearest to it');
  for (let tick = 2; tick < 650; tick++) pointAt(tick);
  assert.deepEqual(pointAt(650), [-608, 320, 36], 'then the place of its teammate');
  assert.equal(brain.debug(1).goal, 'stage');
});

test('a place of a plan on a floor that no bot walks to or stands on moves to the nearest floor that a bot can take', () => {
  const postOf = (change) => {
    const map = mapWith({ T: [], CT: [{ points: [[448, 448, 36, 180]], share: 1, won: 0.5 }] });
    change(map.nav, nodeAt(448, 448));
    const brain = brainWith([1], map);
    brain.frame(frameAt(1, [player(1, 'CT', [600, 0, 36], { own: true }), player(9, 'T', [-800, 0, 36])]));
    brain.think(1);
    return brain.teams.CT.plan.posts.get(1);
  };
  assert.deepEqual(postOf(() => {}).point, [448, 448, 36], 'the floor of the place itself, when a bot can take it');
  // A box top with no way up in the graph: no edge leads to the floor.
  const island = postOf((nav, n) => {
    for (let a = 0; a < nav.count; a++) for (let e = nav.offsets[a]; e < nav.offsets[a + 1]; e++) if (nav.to[e] === n) nav.to[e] = a;
  });
  assert.equal(flat(island.point, [448, 448]), 32, 'the floor next to the box');
  assert.equal(island.yaw, 180, 'with the view of the place');
  // The end of a ladder with no floor beside it: every edge of the floor is a ladder.
  const ladderEnd = postOf((nav, n) => nav.kinds.fill(3, nav.offsets[n], nav.offsets[n + 1]));
  assert.equal(flat(ladderEnd.point, [448, 448]), 32, 'the floor next to the ladder');
});

test('a bot that stands in the way of a teammate steps out of it when the teammate is held up', () => {
  // Bot 1 stands at its place; bot 2 wants to pass on to its own and does not get on (the frames hold it). A long
  // wall hides the enemy: a bot in a fight keeps its feet for the fight.
  const own = { T: [{ points: [[-608, 0, 36, 0], [-576, 288, 36, 0]], site: 0, te: 60, share: 1, won: 0.5 }], CT: [] };
  const stepOf = (cmd) => ({ moves: Math.hypot(cmd.forward, cmd.side) > 0.5, toward: ((cmd.yaw + (Math.atan2(-cmd.side, cmd.forward) * 180) / Math.PI) * Math.PI) / 180 });
  const firstStep = (floor) => {
    const brain = brainWith([1, 2], mapWith(own), { half: 5000, floor });
    let yaw = [0, 0];
    for (let tick = 1; tick <= 150; tick++) {
      brain.frame(frameAt(tick, [player(1, 'T', [-608, 0, 36], { own: true, yaw: yaw[0] }), player(2, 'T', [-648, 0, 36], { own: true, yaw: yaw[1] }), player(9, 'CT', [600, 0, 36])]));
      const first = brain.think(1);
      const second = brain.think(2);
      yaw = [first.yaw, second.yaw];
      if (tick === 20) assert.ok(!stepOf(first).moves, 'at its place it stands');
      if (tick > 20 && stepOf(first).moves) return { tick, toward: stepOf(first).toward };
    }
    return null;
  };
  const step = firstStep(() => true);
  assert.ok(step, 'it steps within 1.5 s');
  assert.ok(step.tick > 40, 'not before the teammate was held up for a moment');
  // The teammate comes along x: the step goes along y, out of its line.
  assert.ok(Math.abs(Math.sin(step.toward)) > 0.9, 'it steps across the way of the teammate');
  // A ledge on the side that it took: the step goes to the other side, where the floor is.
  const side = Math.sign(Math.sin(step.toward));
  const other = firstStep((x, y) => y * side < 20);
  assert.ok(other && Math.sin(other.toward) * side < -0.9, 'no step off the ledge');
  // A ledge on both sides: on ahead of the teammate.
  const ahead = firstStep((x, y) => Math.abs(y) < 20);
  assert.ok(ahead && Math.cos(ahead.toward) > 0.9, 'between two ledges it goes on ahead');
});
