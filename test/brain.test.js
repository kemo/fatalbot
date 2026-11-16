import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { canReach, waysTo } from '../src/nav.js';
import { checkCommand, checkFrame, checkMap } from '../src/contract.js';
import { turn } from '../src/geometry.js';
import { WALL_X, flatMap, flatPorts, frameAt, player, run } from './support/flat-host.js';

const fresh = (seed = 7, wall = {}) => {
  const brain = createBrain({ map: flatMap(), ports: flatPorts(wall), seed });
  brain.join(1);
  return brain;
};
// The bot at the origin looks along x; the enemy stands in the open, 200 units ahead.
const duel = (enemyAt) => () => [player(1, 'T', [0, 0, 36], { own: true }), player(2, 'CT', enemyAt)];

test('the map and the frames of the test host hold the contract', () => {
  assert.deepEqual(checkMap(flatMap()), []);
  assert.deepEqual(checkFrame(frameAt(1, duel([200, 0, 36])())), []);
});

test('every command holds the contract', () => {
  for (const cmd of run(fresh(), 1, 300, duel([200, 60, 36]))) assert.deepEqual(checkCommand(cmd), []);
});

test('the same frames and the same seed give the same commands', () => {
  const a = run(fresh(3), 1, 400, duel([200, 60, 36]));
  const b = run(fresh(3), 1, 400, duel([200, 60, 36]));
  assert.deepEqual(a, b);
  const other = run(fresh(4), 1, 400, duel([200, 60, 36]));
  assert.notDeepEqual(a, other, 'another seed plays another hand');
});

test('a bot fires at an enemy before its crosshair, after its reaction time and not before', () => {
  const commands = run(fresh(), 1, 300, duel([200, 0, 36]));
  const first = commands.findIndex((c) => c.attack);
  assert.ok(first >= 0, 'it fires');
  // The default reaction is 0.28 s, drawn 0.8 to 1.25 times: no shot in the first 0.2 s.
  assert.ok(first * 0.01 >= 0.2, `the first shot at ${first * 0.01} s is too early`);
  assert.ok(Math.abs(turn(commands[first].yaw)) < 6, 'the view is on the enemy at the first shot');
});

test('a bot turns to an enemy that runs up at its side, and fires', () => {
  // 80 degrees to the left, out of the view field of 70: the steps turn the head.
  const runner = () => {
    const e = player(2, 'CT', [35, 200, 36]);
    e.velocity = [0, -250, 0];
    return [player(1, 'T', [0, 0, 36], { own: true }), e];
  };
  const commands = run(fresh(), 1, 300, runner);
  const first = commands.findIndex((c) => c.attack);
  assert.ok(first >= 0, 'it fires');
  assert.ok(Math.abs(turn(commands[first].yaw - 80)) < 8, `the view came round to the enemy (yaw ${commands[first].yaw.toFixed(0)})`);
});

test('a bot does not fire at a teammate', () => {
  const commands = run(fresh(), 1, 300, () => [player(1, 'T', [0, 0, 36], { own: true }), player(2, 'T', [200, 0, 36])]);
  assert.ok(commands.every((c) => !c.attack));
});

test('G6: an enemy that a bot cannot see or hear changes no command', () => {
  // Behind the wall, standing: no line of sight, no sound. Two places there give the same play.
  const behind = (y) => () => [player(1, 'T', [0, 0, 36], { own: true }), player(2, 'CT', [WALL_X + 200, y, 36])];
  const a = run(fresh(5), 1, 600, behind(-80));
  const b = run(fresh(5), 1, 600, behind(120));
  assert.deepEqual(a, b);
  assert.ok(a.every((c) => !c.attack), 'and it never fires through the wall');
});

test('G6: a slow enemy behind the wall is not heard; a running one turns the head', () => {
  const moving = (speed) => (tick) => {
    const e = player(2, 'CT', [WALL_X + 150, -150 + tick * speed * 0.01, 36]);
    e.velocity = [0, speed, 0];
    return [player(1, 'T', [0, 0, 36], { own: true, yaw: 180 }), e];
  };
  // A long wall: the enemy stays behind it all the way.
  const long = { half: 5000 };
  const still = run(fresh(9, long), 1, 300, () => [player(1, 'T', [0, 0, 36], { own: true, yaw: 180 }), player(2, 'CT', [WALL_X + 150, 0, 36])]);
  const walk = run(fresh(9, long), 1, 300, moving(120));
  assert.deepEqual(walk, still, 'a walk makes no sound');
  const ran = run(fresh(9, long), 1, 300, moving(250));
  // The bot looked away from the wall; the steps bring its view round toward them.
  const last = ran[ran.length - 1];
  assert.ok(Math.abs(turn(last.yaw)) < 60, `the view turned to the steps (yaw ${last.yaw.toFixed(0)})`);
  assert.ok(ran.every((c) => !c.attack), 'heard is not seen: no shot');
});

test('a dead bot and an unknown bot get an idle command', () => {
  const brain = fresh();
  const dead = player(1, 'T', [0, 0, 36], { own: true });
  dead.alive = false;
  brain.frame(frameAt(1, [dead, player(2, 'CT', [200, 0, 36])]));
  assert.deepEqual(checkCommand(brain.think(1)), []);
  assert.equal(brain.think(1).attack, false);
  assert.deepEqual(checkCommand(brain.think(99)), []);
});

test('a bot that hangs at the foot of a ladder on its way down jumps off, also when its point lies higher', () => {
  // A ladder out of a pit. The bot hangs a step over the pit's floor; its way goes to the floor above the foot
  // and under the ladder's middle, so the climb sends it down and it comes no lower.
  const sites = [{ mins: [-350, 150, 0], maxs: [-250, 250, 72] }];
  const map = { ...flatMap({ sites }), ladders: [{ mins: [-204, -16, -40], maxs: [-200, 16, 400], normal: [1, 0, 0] }] };
  const brain = createBrain({ map, ports: flatPorts({ half: 5000 }), seed: 7 });
  brain.join(1);
  const hang = () => [player(1, 'T', [-183, 0, 0], { own: true, onLadder: true, onGround: false }), player(2, 'CT', [600, 0, 36])];
  const commands = run(brain, 1, 120, hang);
  assert.ok(!commands.slice(0, 40).some((c) => c.jump), 'not at once: first it tries the ladder');
  assert.ok(commands.some((c) => c.jump), 'after a moment it jumps off');
});

test('a bot at the top of a ladder beside its floor keeps its face to the ladder, then steps off sideways', () => {
  // The ladder hangs on a wall that faces +x; the bot's way goes on to the open side of the face (+x) and to +y.
  const sites = [{ mins: [-150, 150, 0], maxs: [-50, 250, 72] }];
  const map = { ...flatMap({ sites }), ladders: [{ mins: [-204, -16, -400], maxs: [-200, 16, 80], normal: [1, 0, 0] }] };
  const hang = (z) => () => [player(1, 'T', [-183, 0, z], { own: true, onLadder: true, onGround: false }), player(2, 'CT', [600, 0, 36])];
  const play = (z) => {
    const brain = createBrain({ map, ports: flatPorts({ half: 5000 }), seed: 7 });
    brain.join(1);
    return run(brain, 1, 60, hang(z)).slice(20);
  };
  // Under the floor's height (a floor's origin is at 36): it climbs on. A view turned to the floor would send it down.
  for (const c of play(20)) {
    assert.ok(Math.abs(turn(c.yaw - 180)) < 1, `the view stays on the ladder (yaw ${c.yaw.toFixed(0)})`);
    assert.ok(c.forward > 0.9 && c.pitch < 0 && !c.side && !c.jump, 'it climbs');
  }
  // Its feet over the floor: it steps to the floor's side with no climb. Facing -x, +y is to its right.
  for (const c of play(40)) {
    assert.ok(Math.abs(turn(c.yaw - 180)) < 1, 'the view stays on the ladder');
    assert.ok(c.forward === 0 && c.side === 1 && !c.jump, 'it steps off to the right');
  }
});

test('a bot at the top of a ladder with its floor straight behind it jumps off the ladder', () => {
  // A site as narrow as one row of floors, in line with the ladder.
  const sites = [{ mins: [150, -10, 0], maxs: [250, 10, 72] }];
  const map = { ...flatMap({ sites }), ladders: [{ mins: [-204, -16, -400], maxs: [-200, 16, 80], normal: [1, 0, 0] }] };
  const brain = createBrain({ map, ports: flatPorts({ half: 5000 }), seed: 7 });
  brain.join(1);
  const commands = run(brain, 1, 60, () => [player(1, 'T', [-183, 0, 40], { own: true, onLadder: true, onGround: false }), player(2, 'CT', [600, 0, 36])]);
  assert.ok(commands.slice(20).every((c) => c.jump && c.forward === 0), 'the jump takes it off the face');
});

/**
 * The flat map with its ways chosen again: `kind(a, b)` gives the kind of the way from floor a to floor b (each
 * [x, y]), or null for no way.
 */
function rewired(kind, options) {
  const map = flatMap(options);
  const { count, xyz, offsets, to } = map.nav;
  const at = (n) => [xyz[n * 3], xyz[n * 3 + 1]];
  const edges = [];
  for (let n = 0; n < count; n++) edges.push([...to.subarray(offsets[n], offsets[n + 1])].map((k) => [k, kind(at(n), at(k))]).filter((e) => e[1] !== null));
  const next = new Int32Array(count + 1);
  for (let n = 0; n < count; n++) next[n + 1] = next[n] + edges[n].length;
  return { ...map, nav: { count, xyz, offsets: next, to: new Int32Array(edges.flat().map((e) => e[0])), kinds: new Uint8Array(edges.flat().map((e) => e[1])) } };
}

/** The flat map with the floors that `lone(x, y)` picks cut off: no way leaves them and none comes to them. */
const withIsland = (lone, options) => rewired((a, b) => (lone(...a) || lone(...b) ? null : 0), options);

test('a bot on an island of the graph starts its way from the joined floor that it stands at', () => {
  // The floor nearest to the bot (32, 0) is of the island; the joined floor (64, 0) is within a step of it.
  const sites = [{ mins: [-350, -50, 0], maxs: [-250, 50, 72] }];
  const map = withIsland((x, y) => Math.abs(x) <= 32 && Math.abs(y) <= 96, { sites });
  const brain = createBrain({ map, ports: flatPorts({ half: 5000 }), seed: 7 });
  brain.join(1);
  run(brain, 1, 30, () => [player(1, 'T', [45, 0, 36], { own: true }), player(2, 'CT', [600, 0, 36])]);
  const d = brain.debug(1);
  assert.equal(d.escape, null, 'it is off the island');
  assert.deepEqual(d.path?.[0], [64, 0, 36], 'its way starts at the joined floor');
});

test('a bot on an island of the graph leaves it toward a floor that a straight walk reaches, not one behind a wall', () => {
  // The wall is the plane x = 320. The joined floor (352, 0) is the nearest and lies behind it; (256, 0) is open.
  const sites = [{ mins: [-350, -50, 0], maxs: [-250, 50, 72] }];
  const map = withIsland((x, y) => (x === 288 || x === 320) && Math.abs(y) <= 64, { sites });
  const brain = createBrain({ map, ports: flatPorts(), seed: 7 });
  brain.join(1);
  run(brain, 1, 30, () => [player(1, 'T', [310, 0, 36], { own: true }), player(2, 'CT', [-600, 0, 36])]);
  assert.deepEqual(brain.debug(1).escape, [256, 0, 36]);
});

test('the floors with a way to a point, from one search, are those that each reach it by its own search', () => {
  // The ways across x = 0 go east only (a drop): the west reaches the east, the east never the west. An island at
  // the far east has no way in and none out.
  const map = rewired((a, b) => (a[0] >= 320 || b[0] >= 320 ? (a[0] >= 320 && b[0] >= 320 ? 0 : null) : a[0] >= 0 && b[0] < 0 ? null : 0));
  const { nav } = map;
  const at = (x, y) => Array.from({ length: nav.count }, (_, n) => n).find((n) => nav.xyz[n * 3] === x && nav.xyz[n * 3 + 1] === y);
  for (const to of [at(-128, 0), at(128, 0), at(352, 0)]) {
    const bits = waysTo(nav, to);
    let joined = 0;
    for (let n = 0; n < nav.count; n++) {
      const bit = Boolean(bits[n >> 3] & (1 << (n & 7)));
      assert.equal(bit, canReach(nav, n, to), `floor ${n} to ${to}`);
      if (bit) joined++;
    }
    assert.ok(joined > 1 && joined < nav.count, 'some floors have a way, some have none');
  }
});

test('a bot on an island finds a floor further off that a straight walk reaches, when the nearest ones lie behind a wall', () => {
  // Everything east of the wall (x = 320, y from -200 to 200) is an island. The 32 nearest joined floors lie behind
  // the wall; a straight walk passes the wall's end to a floor further off.
  const sites = [{ mins: [-350, -50, 0], maxs: [-250, 50, 72] }];
  const map = withIsland((x) => x >= 320, { sites, size: 56 });
  const ports = flatPorts();
  const brain = createBrain({ map, ports, seed: 7 });
  brain.join(1);
  run(brain, 1, 30, () => [player(1, 'T', [360, 0, 36], { own: true }), player(2, 'CT', [-600, 0, 36])]);
  const out = brain.debug(1).escape;
  assert.ok(out && out[0] < 320 && Math.abs(out[1]) > 300, `past the wall's end (${out})`);
  assert.equal(ports.traceHull([360, 0, 36], out, false), 1, 'a straight walk reaches it');
});

test('a bot on an island with no way out from its place walks inside the island to the floor that has one', () => {
  // The wall is 1400 long, and the island is a strip of two floors along its east side: no joined floor within
  // reach of the bot has a straight walk to it. The strip's floors near the wall's end have one.
  const sites = [{ mins: [-350, -50, 0], maxs: [-250, 50, 72] }];
  const part = (x) => (x <= 288 ? 'joined' : x === 352 || x === 384 ? 'strip' : null);
  const map = rewired((a, b) => (part(a[0]) && part(a[0]) === part(b[0]) ? 0 : null), { sites, size: 56 });
  const brain = createBrain({ map, ports: flatPorts({ half: 700 }), seed: 7 });
  brain.join(1);
  run(brain, 1, 30, () => [player(1, 'T', [360, 0, 36], { own: true }), player(2, 'CT', [-600, 0, 36])]);
  const d = brain.debug(1);
  assert.equal(d.escape, null, 'no straight walk from here');
  const end = d.path?.at(-1);
  assert.ok(end && end[0] >= 352 && Math.abs(end[1]) >= 500, `its way leads along the wall, inside the island (${end})`);
  // At that floor the straight walk off the island starts.
  run(brain, 1, 30, () => [player(1, 'T', end, { own: true }), player(2, 'CT', [-600, 0, 36])]);
  const out = brain.debug(1).escape;
  assert.ok(out && out[0] < 320, `a floor of the joined part (${out})`);
});

test('a bot that gives up at a ladder that it cannot take finds a way without that ladder', () => {
  // Two halves of the map, the east one 100 units higher. A ladder joins them at y = 0, a walk far to the north.
  const LADDER = 3;
  const cross = (a, b) => a[0] < 0 !== b[0] < 0;
  const map = rewired((a, b) => (!cross(a, b) ? 0 : a[1] === 0 && b[1] === 0 ? LADDER : Math.min(a[1], b[1]) >= 288 ? 0 : null), { sites: [{ mins: [200, -50, 100], maxs: [300, 50, 172] }] });
  for (let n = 0; n < map.nav.count; n++) if (map.nav.xyz[n * 3] >= 0) map.nav.xyz[n * 3 + 2] = 136;
  map.ladders = [{ mins: [-20, -16, -400], maxs: [-16, 16, 150], normal: [-1, 0, 0] }];
  const brain = createBrain({ map, ports: flatPorts({ half: 5000 }), seed: 7 });
  brain.join(1);
  // The frames hold the bot at the ladder's foot: it does not get up the ladder.
  const stand = () => [player(1, 'T', [-32, 0, 36], { own: true }), player(2, 'CT', [600, 0, 36])];
  const overLadder = () => (brain.debug(1).path ?? []).some((p, i, path) => i > 0 && p[0] === 0 && p[1] === 0 && path[i - 1][0] === -32 && path[i - 1][1] === 0);
  const players = (tick) => {
    if (tick === 200) assert.ok(overLadder(), 'first its way goes up the ladder');
    return stand();
  };
  run(brain, 1, 700, players);
  assert.ok(brain.debug(1).path?.length > 0 && !overLadder(), 'after it gave up, its way leaves the ladder out');
});

test('a bot that waits at its place jumps now and then, by the count of its profile, and never with an enemy near', () => {
  // A CT holds a post of the site; its player jumped 12 times a minute. The long wall (x = 320) hides the enemy.
  const map = () => flatMap({ sites: [{ mins: [450, 350, 0], maxs: [550, 450, 72] }], size: 56, spawns: [-800, 600] });
  const wait = (seed, enemyAt, phase = 'live', jumpRate = 12) => {
    const brain = createBrain({ map: map(), ports: flatPorts({ half: 5000 }), seed });
    brain.join(1, { profile: { jumpRate } });
    brain.frame(frameAt(1, [player(1, 'CT', [600, 0, 36], { own: true }), player(2, 'T', [-800, 0, 36])]));
    brain.think(1);
    const { point: post, watch } = brain.teams.CT.plan.posts.get(1);
    const enemy = enemyAt(post, watch);
    // The bot stands on the floor of its post that it wants to stand on (it steps between them, tactics.js restless).
    return run(brain, 1, 3000, () => [player(1, 'CT', brain.debug(1).point ?? post, { own: true }), player(2, 'T', enemy)], () => ({ phase }));
  };
  // On the other side of the wall from the post.
  const hidden = (post) => [post[0] < WALL_X ? WALL_X + 300 : WALL_X - 300, post[1], 36];
  let jumps = 0;
  for (const seed of [1, 2, 3, 4]) jumps += wait(seed, hidden).filter((c) => c.jump).length;
  // 30 s at 12 a minute are 6 jumps of each bot, by chance: no burst of jumps to catch up with the count.
  assert.ok(jumps > 4 && jumps < 60, `it jumps at about its rate (${jumps} jumps of four bots in 30 s each)`);
  assert.ok(wait(1, hidden, 'live', 0).every((c) => !c.jump), 'a player that never jumped does not');
  assert.ok(wait(1, hidden, 'freeze').every((c) => !c.jump), 'not in the freeze time');
  // An enemy on its own side of the wall, a quarter of the way to the place that it watches: a fight, no jump of a habit.
  const fought = wait(1, (post, watch) => [post[0] + (watch[0] - post[0]) / 4, post[1] + (watch[1] - post[1]) / 4, 36]);
  assert.ok(fought.some((c) => c.attack) && fought.every((c) => !c.jump), 'not with an enemy in sight');
});

test('a bot taps the duck on its wait and on its run at the rate of its profile, one tick each, and never with an enemy near', () => {
  const map = () => flatMap({ sites: [{ mins: [450, 350, 0], maxs: [550, 450, 72] }], size: 56, spawns: [-800, 600] });
  const wait = (seed, enemyAt, phase = 'live', duckTaps = 12, ports = { half: 5000 }) => {
    const brain = createBrain({ map: map(), ports: flatPorts(ports), seed });
    brain.join(1, { profile: { duckTaps, jumpRate: 0 } });
    brain.frame(frameAt(1, [player(1, 'CT', [600, 0, 36], { own: true }), player(2, 'T', [-800, 0, 36])]));
    brain.think(1);
    const { point: post, watch } = brain.teams.CT.plan.posts.get(1);
    const enemy = enemyAt(post, watch);
    return run(brain, 1, 3000, () => [player(1, 'CT', brain.debug(1).point ?? post, { own: true }), player(2, 'T', enemy)], () => ({ phase }));
  };
  const hidden = (post) => [post[0] < WALL_X ? WALL_X + 300 : WALL_X - 300, post[1], 36];
  let taps = 0;
  for (const seed of [1, 2, 3, 4]) {
    const commands = wait(seed, hidden);
    taps += commands.filter((c) => c.duck).length;
    // The key is down for one tick, and the next tap of a roll waits for the fall of this one.
    assert.ok(commands.every((c, i) => !c.duck || commands.slice(i + 1, i + 25).every((d) => !d.duck)), 'no held duck, and no tap in the air');
  }
  // 30 s at 12 a minute are 6 taps of each bot.
  assert.ok(taps > 8 && taps < 60, `it taps at about its rate (${taps} taps of four bots in 30 s each)`);
  assert.ok(wait(1, hidden, 'live', 0).every((c) => !c.duck), 'a player that never tapped does not');
  assert.ok(wait(1, hidden, 'freeze').every((c) => !c.duck), 'not in the freeze time');
  const fought = wait(1, (post, watch) => [post[0] + (watch[0] - post[0]) / 4, post[1] + (watch[1] - post[1]) / 4, 36]);
  assert.ok(fought.some((c) => c.attack) && fought.every((c) => !c.duck), 'not with an enemy in sight');
});

test('at a frame step of 0.02 s a bot sees an enemy and fires after its reaction time', () => {
  const commands = run(fresh(), 1, 150, duel([200, 0, 36]), () => ({ dt: 0.02 }));
  const first = commands.findIndex((c) => c.attack);
  assert.ok(first >= 0, 'it fires');
  assert.ok((first + 1) * 0.02 >= 0.2, `the first shot at ${(first + 1) * 0.02} s is too early`);
  assert.ok(Math.abs(turn(commands[first].yaw)) < 6, 'the view is on the enemy at the first shot');
});

test('a smoke cloud between a bot and an enemy hides the enemy; a cloud beside the line does not', () => {
  const smoked = (origin) => run(fresh(), 1, 300, duel([300, 0, 36]), () => ({ smokes: [{ origin, radius: 115 }] }));
  assert.ok(smoked([150, 0, 46]).every((c) => !c.attack), 'no shot through the cloud');
  assert.ok(smoked([150, 300, 46]).some((c) => c.attack), 'a shot past the cloud');
});

test('two brains on one level play as each brain alone, side by side and one after the other', () => {
  const sites = [{ mins: [-500, -50, 0], maxs: [-400, 50, 72] }];
  const brainOn = (map, seed) => {
    const brain = createBrain({ map, ports: flatPorts(), seed });
    brain.join(1);
    return brain;
  };
  const players = (at) => () => [player(1, 'T', at, { own: true }), player(2, 'CT', [WALL_X + 200, 0, 36])];
  const alone = (seed, at) => run(brainOn(flatMap({ sites }), seed), 1, 400, players(at));
  const a = alone(3, [300, -200, 36]);
  const b = alone(4, [100, 250, 36]);
  // Side by side: the two brains take their ticks in turn on one map (one graph, nav.js navOf).
  const map = flatMap({ sites });
  const [ba, bb] = [brainOn(map, 3), brainOn(map, 4)];
  const [ca, cb] = [[], []];
  const view = { a: null, b: null };
  for (let tick = 1; tick <= 400; tick++) {
    for (const [brain, at, out, k] of [[ba, [300, -200, 36], ca, 'a'], [bb, [100, 250, 36], cb, 'b']]) {
      const list = players(at)();
      if (view[k]) [list[0].yaw, list[0].pitch] = [view[k].yaw, view[k].pitch];
      brain.frame(frameAt(tick, list));
      const cmd = brain.think(1);
      view[k] = cmd;
      out.push(cmd);
    }
  }
  assert.deepEqual(ca, a);
  assert.deepEqual(cb, b);
  // One after the other: a later brain on a level that another brain used.
  const used = flatMap({ sites });
  run(brainOn(used, 3), 1, 400, players([300, -200, 36]));
  assert.deepEqual(run(brainOn(used, 4), 1, 400, players([100, 250, 36])), b);
});

test('a bot fetches the dropped C4 while a teammate that the brain does not drive is nearer to it', () => {
  const fetchers = (person) => {
    const brain = createBrain({ map: flatMap({ size: 60, sites: [{ mins: [500, -50, 0], maxs: [600, 50, 72] }] }), ports: flatPorts({ half: 0 }), seed: 3 });
    brain.join(1);
    brain.join(2);
    const goals = new Set();
    const bomb = { state: 'dropped', carrier: null, origin: [0, 0, 0], explodeAt: null, defuser: null, arming: null };
    for (let tick = 1; tick <= 300; tick++) {
      const list = [player(1, 'T', [-300, 0, 36], { own: true }), player(2, 'T', [-300, 64, 36], { own: true }), player(9, 'CT', [800, 800, 36])];
      // A person 90 units from the bomb, who does not take it.
      if (person) list.push(player(3, 'T', [-80, 40, 36]));
      brain.frame(frameAt(tick, list, { bomb, events: tick === 1 ? [{ type: 'dropped', at: [0, 0, 0] }] : [] }));
      for (const id of [1, 2]) {
        brain.think(id);
        if (brain.debug(id).goal === 'fetch') goals.add(id);
      }
    }
    return [...goals];
  };
  assert.deepEqual(fetchers(false), [1]);
  assert.deepEqual(fetchers(true), [1]);
});

test('the exit of an island is the same for a bot alone and for a bot after others on the level, and a straight walk reaches it', () => {
  // The island of the test before. Bots A and B have the same nearest floor; B's own straight walk to A's exit meets
  // the wall, and the graph of a level (nav.js navOf) is shared by every brain on it.
  const sites = [{ mins: [-350, -50, 0], maxs: [-250, 50, 72] }];
  const mapOf = () => withIsland((x) => x >= 320, { sites, size: 56 });
  const [A, B] = [[366, -14, 36], [338, 10, 36]];
  const ports = flatPorts();
  const play = (brain, id, at) => ({ commands: run(brain, id, 30, () => [player(id, 'T', at, { own: true }), player(9, 'CT', [-600, 0, 36])]), escape: brain.debug(id).escape });
  const brainOf = (map, ...ids) => {
    const brain = createBrain({ map, ports, seed: 7 });
    for (const id of ids) brain.join(id);
    return brain;
  };
  const alone = play(brainOf(mapOf(), 2), 2, B);
  const map = mapOf();
  const first = play(brainOf(map, 1), 1, A);
  assert.deepEqual(play(brainOf(map, 2), 2, B), alone, 'a later brain on the level');
  const one = brainOf(mapOf(), 1, 2);
  play(one, 1, A);
  assert.deepEqual(play(one, 2, B), alone, 'a later bot of one brain');
  for (const [at, { escape }] of [[A, first], [B, alone]]) assert.equal(ports.traceHull(at, escape, false), 1, `a straight walk from ${at} to ${escape}`);
});

test('G6: a hit whose shot the bot did not hear tells the side, not the place; a grenade tells not even the side', () => {
  // The shooter stands behind a long wall, silent and out of earshot of a silencer (500 units), and hits the bot.
  const hit = (at, weapon) => run(fresh(5, { half: 5000 }), 1, 150, (tick) => {
    const me = player(1, 'T', [0, 0, 36], { own: true, yaw: 180 });
    if (tick >= 21) me.own.hurt = { at: 0.21, by: 2 };
    return [me, player(2, 'CT', at)];
  }, (tick) => {
    if (tick === 20 && weapon !== 'hegrenade') return { events: [{ type: 'shot', player: 2, weapon, silenced: true }] };
    return tick === 21 ? { events: [{ type: 'hurt', player: 1, by: 2, weapon }] } : {};
  });
  // One bearing, two distances: the same play.
  const near = hit([WALL_X + 400, -300, 36], 'm4a1');
  assert.deepEqual(hit([2 * (WALL_X + 400), -600, 36], 'm4a1'), near);
  assert.ok(near.slice(30).some((c) => Math.abs(turn(c.yaw - 180)) > 30), 'the eyes go to the side of the hit');
  // An HE grenade: two places of the thrower, the same play.
  assert.deepEqual(hit([WALL_X + 400, -300, 36], 'hegrenade'), hit([WALL_X + 400, 300, 36], 'hegrenade'));
});

test('G6: a runner heard behind a wall is placed at each step with a new error, and not tracked between steps', () => {
  const brain = fresh(9, { half: 5000 });
  const at = (tick) => [WALL_X + 300, -400 + tick * 2.5, 36];
  const heard = [];
  run(brain, 1, 200, (tick) => {
    const e = player(2, 'CT', at(tick));
    e.velocity = [0, 250, 0];
    const n = brain.bots.get(1).s.noise;
    if (n && tick > 20) heard.push({ point: n.point, off: [n.point[0] - at(tick - 1)[0], n.point[1] - at(tick - 1)[1]] });
    return [player(1, 'T', [0, 0, 36], { own: true, yaw: 180 }), e];
  });
  const places = new Set(heard.map((h) => h.point.join()));
  // A step each 0.3 s: about 6 places in 1.8 s, each with its own error against the true place.
  assert.ok(places.size >= 4 && places.size <= 8, `${places.size} places`);
  const offs = new Set(heard.map((h) => h.off.map(Math.round).join()));
  assert.ok(offs.size > places.size, 'the place stays while the runner moves on');
});

test('smoke hides by the length of the line inside the cloud: an enemy at its near edge is seen, one deep in it is not', () => {
  const play = (smokes) => run(fresh(), 1, 300, duel([300, 0, 36]), () => ({ smokes }));
  const clear = play([]);
  // A cloud of radius 115 hides behind 80.5 units of smoke on the line. The enemy 35 units inside its near edge, and
  // the bot 35 units inside the edge of a cloud behind it: 35 units of smoke, so the same play as with none.
  assert.deepEqual(play([{ origin: [380, 0, 46], radius: 115 }]), clear);
  assert.deepEqual(play([{ origin: [-80, 0, 50], radius: 115 }]), clear);
  // The enemy 35 units inside the far edge: the line crosses most of the cloud.
  assert.ok(play([{ origin: [220, 0, 46], radius: 115 }]).every((c) => !c.attack));
});
