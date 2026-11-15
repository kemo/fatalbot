// The fight in the csbih host, on levels of boxes: what the bots fire at and how their feet go. Skips with no
// checkout of csbih-player (README, "Run"). Ported from csbih-player test/game-fatal.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { csbihMissing, csbihRoot, loadCore } from '../hosts/csbih/load.js';
import { csbihHost } from '../hosts/csbih/adapter.js';

const skip = csbihMissing() ?? false;
const core = skip ? null : await loadCore();
const { boxLevel } = skip ? {} : await import(pathToFileURL(join(csbihRoot(), 'test', 'support', 'boxes.js')).href);

const FLOOR = [[-4000, -4000, -64], [4000, 4000, 0]];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// A head and a body around the origin, as the hit boxes of the player model lie in the aim pose.
const BODY = [{ bone: 0, group: 1, min: [-6, -6, 20], max: [6, 6, 34] }, { bone: 0, group: 2, min: [-14, -14, -36], max: [14, 14, 20] }];

// A flat graph over the floor: a floor every 64 units, each joined to its eight neighbours by a walk.
function gridNav(half = 1536, step = 64) {
  const side = Math.floor((half * 2) / step) + 1;
  const count = side * side;
  const xyz = new Float32Array(count * 3);
  const edges = [];
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      xyz.set([-half + i * step, -half + j * step, 36], (i * side + j) * 3);
      const list = [];
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if ((di || dj) && i + di >= 0 && i + di < side && j + dj >= 0 && j + dj < side) list.push((i + di) * side + j + dj);
      edges.push(list);
    }
  }
  const offsets = new Int32Array(count + 1);
  edges.forEach((list, n) => { offsets[n + 1] = offsets[n] + list.length; });
  const to = new Int32Array(edges.flat());
  return { count, xyz, offsets, to, kinds: new Uint8Array(to.length), cells: new Map() };
}

/**
 * A world of boxes with a bot of fatalbot for each of `players` ({id, team, origin, yaw, weapon, bot}). `boxes`
 * false: the bodies take no hit. Returns {world, players, run(ticks, onShot)}.
 */
function arena(seed, walls, players, { profile, boxes = true }) {
  const nav = gridNav();
  const world = new core.world.World(boxLevel([FLOOR, ...walls]), { rules: { spawns: [] }, seed, nav });
  world.bodyOf = (p) => ({ x: p.body.origin[0], y: p.body.origin[1], z: p.body.origin[2], yaw: p.yaw, matrices: [IDENTITY], boxes: boxes ? BODY : [] });
  const host = csbihHost(core, world, { map: 'de_x', nav, rules: world.rules }, { seed });
  host.clock = () => 100;
  const made = players.map(({ id, team, origin, yaw, weapon, bot }) => {
    const p = world.addPlayer({ id, team, origin, yaw, weapon });
    if (bot) p.controller = host.controller(id, { profile });
    return p;
  });
  const run = (ticks, onShot) => {
    for (let i = 0; i < ticks && made.every((p) => p.alive); i++) {
      const from = world.events.length;
      world.step();
      for (const e of world.events.slice(from)) if (e.type === 'shot') onShot(e, world.players.get(e.player), i);
    }
  };
  return { world, players: made, run };
}

const STAND = { reaction: 0.25, moveInFight: 0, duckInFight: 0 };

// Two bots that stand in a fight across a wall's corner (x 300 to 340, y up to 0): the line between their eyes
// passes the corner's edge by a few units more for each step of `past`.
function cornerFight(seed, past) {
  const ctY = 199 + past * 3;
  const yaw = (Math.atan2(ctY + 100, 900) * 180) / Math.PI;
  const { run } = arena(seed, [[[300, -600, 0], [340, 0, 200]]], [
    { id: 1, team: 'T', origin: [0, -100, 37], yaw, weapon: 'ak47', bot: true },
    { id: 2, team: 'CT', origin: [900, ctY, 37], yaw: yaw + 180, weapon: 'm4a1', bot: true },
  ], { profile: STAND });
  const out = { shots: 0, corner: 0, hit: 0 };
  run(500, (e) => {
    const h = e.hits[0];
    out.shots++;
    if (h?.victim) out.hit++;
    else if (h?.wall && h.to[0] > 290 && h.to[0] < 350 && h.to[2] > 1) out.corner++;
  });
  return out;
}

test('two bots at a corner fire at the part of the body in sight, and hold fire while the corner is in front of the sight', { skip }, () => {
  const sum = { shots: 0, corner: 0, hit: 0 };
  for (const past of [1, 3, 6]) {
    for (let seed = 1; seed <= 10; seed++) {
      const r = cornerFight(seed, past);
      for (const k in sum) sum[k] += r[k];
    }
  }
  assert.ok(sum.shots > 50, `the bots fought: ${JSON.stringify(sum)}`);
  assert.ok(sum.corner / sum.shots < 0.15, `few shots go into the corner: ${JSON.stringify(sum)}`);
});

// A bot at 800 units from an enemy that takes no hit: the fight goes on for many bursts.
function longFight(profile, ticks, onShot) {
  const { players, run } = arena(5, [], [
    { id: 1, team: 'CT', origin: [0, 0, 37], yaw: 0, weapon: 'm4a1', bot: true },
    { id: 2, team: 'T', origin: [800, 0, 37], yaw: 180, weapon: 'ak47', bot: false },
  ], { profile, boxes: false });
  run(ticks, (e, p, i) => e.player === 1 && onShot(p, i));
  return players[0];
}

test('a bot whose clip is empty in a fight reloads and fires on: it does not pull the trigger of an empty gun', { skip }, () => {
  // A pistol at 400 units from an enemy that takes no hit: the fight is longer than one clip.
  const { world, players, run } = arena(5, [], [
    { id: 1, team: 'CT', origin: [0, 0, 37], yaw: 0, weapon: 'usp', bot: true },
    { id: 2, team: 'T', origin: [400, 0, 37], yaw: 180, weapon: 'glock18', bot: false },
  ], { profile: STAND, boxes: false });
  let shots = 0;
  let dry = 0;
  const gun = players[0].guns.get('usp');
  const clip = gun.clip;
  for (let i = 0; i < 25; i++) {
    run(100, (e) => { if (e.player === 1) shots++; });
    if (gun.clip === 0 && gun.reloadEnd === null) dry++;
  }
  const reloads = world.events.filter((e) => e.type === 'reload' && e.player === 1).length;
  assert.ok(reloads >= 2, `the bot reloaded ${reloads} times in 25 s`);
  assert.ok(shots > clip * 2, `the bot fired ${shots} shots of a clip of ${clip}`);
  assert.ok(dry <= 1, `the bot held an empty gun at ${dry} of 25 looks`);
});

test('a bot with no round left takes the knife and goes at the enemy', { skip }, () => {
  const { players, run } = arena(5, [], [
    { id: 1, team: 'CT', origin: [0, 0, 37], yaw: 0, weapon: 'usp', bot: true },
    { id: 2, team: 'T', origin: [400, 0, 37], yaw: 180, weapon: 'glock18', bot: false },
  ], { profile: STAND, boxes: false });
  Object.assign(players[0].guns.get('usp'), { clip: 0, reserve: 0 });
  let shots = 0;
  run(300, (e) => { if (e.player === 1 && e.weapon !== 'knife') shots++; });
  assert.equal(players[0].weapon, 'knife');
  assert.equal(shots, 0);
  assert.ok(players[0].body.origin[0] > 150, `the bot went ${players[0].body.origin[0].toFixed(0)} units toward the enemy`);
});

test('a bot that fights from a stand steps to a side between bursts, and stands still for each shot far away', { skip }, () => {
  let shots = 0;
  let fast = 0;
  let side = 0;
  const bot = longFight(STAND, 400, (p) => {
    shots++;
    side = Math.max(side, Math.abs(p.body.origin[1]));
    if (Math.hypot(p.body.velocity[0], p.body.velocity[1]) > 140) fast++;
  });
  assert.ok(bot.alive);
  assert.ok(shots >= 10, `the bot fired bursts: ${shots}`);
  assert.ok(side > 10, `the bot stepped to a side: ${side.toFixed(1)}`);
  assert.equal(fast, 0, 'no shot on the run at 800 units');
});

test('a bot that fights ducked is down for most of its shots, not only from the end of its first burst', { skip }, () => {
  let shots = 0;
  let ducked = 0;
  longFight({ ...STAND, duckInFight: 1 }, 300, (p) => {
    shots++;
    if (p.body.ducked) ducked++;
  });
  assert.ok(shots >= 6, `the bot fired: ${shots}`);
  assert.ok(ducked / shots > 0.7, `ducked shots: ${ducked} of ${shots}`);
});
