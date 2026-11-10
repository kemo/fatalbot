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
