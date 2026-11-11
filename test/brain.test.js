import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
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
