// The route of a recorded player (src/route.js): a bot that plays on for that player keeps its route until its own
// round leaves the recording. Each bot leaves by what it meets itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flatMap, flatPorts, frameAt, player } from './support/flat-host.js';

// A player that walked east along y = `y` at 100 units a second from x = -600, looking north, for `seconds`.
const walkEast = (y, seconds = 30) => (s) => (s < 0 || s > seconds ? null : { x: -600 + 100 * s, y, z: 36, yaw: 90, pitch: 0, duck: false, weapon: 'ak47', bomb: false });
const fresh = (routes) => {
  const brain = createBrain({ map: flatMap({ size: 56 }), ports: flatPorts(), seed: 5 });
  for (const [id, route] of Object.entries(routes)) brain.join(Number(id), { route });
  return brain;
};
/** Runs `ticks` frames; `players(tick, time)` gives the players. Returns the last command of each bot in `ids`. */
function play(brain, ids, ticks, players) {
  const last = {};
  for (let tick = 1; tick <= ticks; tick++) {
    brain.frame(frameAt(tick, players(tick, tick * 0.01)));
    for (const id of ids) last[id] = brain.think(id);
  }
  return last;
}
// The bot stands where its route was a quarter of a second ago: it has to keep walking to stay on it.
const lagging = (id, route, time, extra = {}) => {
  const at = route(Math.max(0, time - 0.25));
  return player(id, 'T', [at.x, at.y, 36], { own: true, yaw: 90, ...extra });
};

test('a bot that cannot reach the place where its player stood stops its feet there', () => {
  // The player stood at one place. The frames hold the bot 20 units from it, as a wall would.
  const route = () => ({ x: -600, y: -400, z: 36, yaw: 90, pitch: 0, duck: false, weapon: 'ak47', bomb: false });
  const brain = fresh({ 1: route });
  const held = () => [player(1, 'T', [-620, -400, 36], { own: true, yaw: 90 }), player(9, 'CT', [-600, 800, 36], { alive: false })];
  const keys = [];
  for (let tick = 1; tick <= 120; tick++) {
    brain.frame(frameAt(tick, held()));
    const cmd = brain.think(1);
    keys.push(Math.hypot(cmd.forward, cmd.side));
  }
  assert.ok(keys[19] > 0.5, 'at first it walks to the place');
  assert.equal(keys[119], 0, 'with no step nearer for 0.4 s it stands');
  assert.equal(brain.debug(1).route, 'on');
});

test('a bot on a route walks where its player walked and looks where its player looked', () => {
  const route = walkEast(-400);
  const brain = fresh({ 1: route });
  const cmd = play(brain, [1], 300, (tick, time) => [lagging(1, route, time), player(9, 'CT', [-600, 800, 36], { alive: false })])[1];
  assert.equal(brain.debug(1).route, 'on');
  assert.equal(brain.debug(1).goal, 'route');
  // The view is the player's (north); the way is east: a step to the right of the view.
  assert.ok(Math.abs(cmd.yaw - 90) < 5, `the view of the player (${cmd.yaw})`);
  assert.ok(cmd.side > 0.8 && Math.abs(cmd.forward) < 0.5, `it strafes along the route (forward ${cmd.forward}, side ${cmd.side})`);
});

test('a route ends where the recording of its player ends, and the bot plays on by itself', () => {
  const route = walkEast(-400, 2);
  const brain = fresh({ 1: route });
  // The frames move the bot on along the same line after the recording's end.
  play(brain, [1], 400, (tick, time) => [lagging(1, walkEast(-400, 99), time), player(9, 'CT', [-600, 800, 36], { alive: false })]);
  assert.equal(brain.debug(1).route, 'route-end');
  assert.notEqual(brain.debug(1).goal, 'route');
});

test('each bot leaves its route by what it meets itself: one fights, the other walks on', () => {
  // Bot 1 walks west of the wall (x = 320), bot 2 east of it; the enemy stands east of the wall, north of bot 2.
  const west = (s) => (s > 30 ? null : { x: 100, y: -300 + 20 * s, z: 36, yaw: 90, pitch: 0, duck: false, weapon: 'ak47' });
  const east = (s) => (s > 30 ? null : { x: 500, y: -300 + 20 * s, z: 36, yaw: 90, pitch: 0, duck: false, weapon: 'ak47' });
  const brain = fresh({ 1: west, 2: east });
  const at = (id, route, time) => {
    const p = route(Math.max(0, time - 0.25));
    return player(id, 'T', [p.x, p.y, 36], { own: true, yaw: 90 });
  };
  play(brain, [1, 2], 300, (tick, time) => [
    at(1, west, time), at(2, east, time),
    // A teammate that the recording still has alive is dead, and so are three enemies: no bot leaves for that.
    player(3, 'T', [0, -500, 36], { alive: false }),
    player(9, 'CT', [500, 300, 36]), player(10, 'CT', [0, 800, 36], { alive: false }), player(11, 'CT', [0, 800, 36], { alive: false }), player(12, 'CT', [0, 800, 36], { alive: false }),
  ]);
  assert.equal(brain.debug(2).route, 'fight', 'the bot that sees the enemy');
  assert.equal(brain.debug(1).route, 'on', 'the bot behind the wall');
});

test('a bot that is hit leaves its route', () => {
  const route = walkEast(-400);
  const brain = fresh({ 1: route });
  play(brain, [1], 200, (tick, time) => {
    const me = lagging(1, route, time);
    if (tick > 100) me.own.hurt = { at: 1, by: 9 };
    return [me, player(9, 'CT', [-600, 800, 36], { alive: false })];
  });
  assert.equal(brain.debug(1).route, 'hit');
});

test('a bot with no route has none', () => {
  const brain = fresh({});
  brain.join(1);
  play(brain, [1], 20, () => [player(1, 'T', [-300, 0, 36], { own: true }), player(9, 'CT', [300, 600, 36], { alive: false })]);
  assert.equal(brain.debug(1).route, null);
});
