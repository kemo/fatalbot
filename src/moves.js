// How a player of CS 1.6 moves, past the plain walk: the jump on a run and the chain of bunny hops with its air
// strafe, and the side steps of a fight with the stop before the shots. The numbers of the game come from its
// movement code (pm_shared: air accelerate 10, the wish speed in the air capped at 30, the 1.2 speed limit of a
// jump); the habits come from the bot's profile.

import { PI, RAD, abs, atan2, clamp, cos, hypot, sin, turn } from './geometry.js';
import { WALK } from './nav.js';
import { maxSpeedOf, stillSpeedOf } from './weapons.js';

// A jump on a run needs this much straight floor ahead; a hop after it needs this much more.
const JUMP_STRAIGHT = 220;
const HOP_STRAIGHT = 420;
// The floors of the run must be open ones: this many ways out of each (a floor by a wall or an edge has fewer).
const OPEN_WAYS = 7;
// The floors of the way that the straight run looks at, and how far off its line a floor still counts (degrees).
const LOOK_FLOORS = 20;
const ON_LINE = 10;
// A jump starts only while the run is this near the line of the way (degrees); a chain of hops only while the view
// is this near it too.
const ON_WAY = 10;
const ON_VIEW = 6;
// The box of the bot must pass this far along the way, and a little to each side of it.
const CLEAR_AHEAD = 220;
const CLEAR_SIDE = 20;
// In the air the view swings this far to each side of the way (degrees), over about this long (s): the velocity
// follows the view and grows.
const SWING = 8;
const AIR_SECONDS = 0.6;
// Over this part of the weapon's speed the air strafe lets go: the game cuts a jump over 1.2.
const AIR_FULL = 1.12;
// A hop starts only from a run this fast, as a part of the weapon's speed.
const RUN_FAST = 0.9;
// How a bot keeps to its profile's jumps a minute: each jump that it owes multiplies the chance of a start by
// HOP_EAGER more, between HOP_LAZY (ahead of its count) and HOP_KEEN times.
const HOP_EAGER = 3;
const HOP_LAZY = 0.3;
const HOP_KEEN = 12;
// The landing of a hop: the key comes this many ticks late at most (a perfect hop every time is no hand).
const LATE_TICKS = 2;
// A stand in a fight: over this speed the keys push against the run; under it the friction ends it.
const COUNTER_OVER = 40;

/**
 * The straight level run that the way gives from the bot along `run` (degrees), in units: the distance to the
 * furthest of the next floors that lies on that line, on the bot's level, with the bot's box free all the way to
 * it; with `open`, over open floors only (a chain of hops swings to each side). A way on the grid goes in steps to each side of its line, so a floor off the line is passed
 * over, not an end.
 */
export function straightAhead(c, path, from, run, open = true) {
  if (!path) return 0;
  const { me, brain } = c;
  const { nav, ports } = brain;
  const o = me.origin;
  let far = 0;
  for (let i = from; i < Math.min(path.length, from + LOOK_FLOORS); i++) {
    const n = path[i];
    if (n.kind !== WALK || abs(n.point[2] - o[2]) > 18) break;
    if (open && nav.offsets[n.node + 1] - nav.offsets[n.node] < OPEN_WAYS) break;
    const dx = n.point[0] - o[0];
    const dy = n.point[1] - o[1];
    const d = hypot(dx, dy);
    if (d <= far || d < 48 || abs(turn((atan2(dy, dx) * 180) / PI - run)) > ON_LINE) continue;
    if (ports.traceHull(o, [n.point[0], n.point[1], o[2]], false) >= 1) far = d;
  }
  return far;
}

/** True when the bot's box passes CLEAR_AHEAD units along `run` (degrees), on its line and beside it. */
function corridor(c, run) {
  const { me, brain } = c;
  const o = me.origin;
  const dx = cos(run * RAD);
  const dy = sin(run * RAD);
  for (const side of [0, CLEAR_SIDE, -CLEAR_SIDE]) {
    const from = [o[0] - dy * side, o[1] + dx * side, o[2]];
    if (brain.ports.traceHull(from, [from[0] + dx * CLEAR_AHEAD, from[1] + dy * CLEAR_AHEAD, from[2]], false) < 1) return false;
  }
  return true;
}

/**
 * A jump on a calm run, and the bunny hops after it: in the air the forward key is up, a strafe key is down and the
 * view turns to that side, so the speed grows as a player's does; on the landing the jump comes again, and the view
 * swings back across the way. True while the hop holds the keys of this tick.
 *
 * A jump is a habit, not a gain: the game slows the run for 1.3 s after the last landing. So a bot in a hurry
 * (`c.hurry`) never hops.
 */
export function hop(c, cmd, path, target, run, distance, kind) {
  const { me, own, s, skill, random, dt } = c;
  const speed = hypot(me.velocity[0], me.velocity[1]);
  const top = maxSpeedOf(cmd.weapon ?? me.weapon);
  let h = s.hop;
  if (!h) {
    if (c.hurry || !me.onGround || me.onLadder || me.ducked || own.stamina > 0 || kind !== WALK || speed < top * RUN_FAST) return false;
    // The run must already go along the way: a jump out of a bend flies on along the old line, into the wall.
    if (abs(turn(run - (atan2(me.velocity[1], me.velocity[0]) * 180) / PI)) > ON_WAY) return false;
    // The profile counts a player's jumps over all its time, and a bot can hop on a part of its time only. So it
    // jumps the more readily the further its count of the round lies behind the profile's.
    const owed = (skill.jumpRate * (c.time - (s.liveAt ?? c.time))) / 60 - (s.jumps ?? 0);
    if (random() >= (skill.jumpRate / 60) * clamp(1 + owed * HOP_EAGER, HOP_LAZY, HOP_KEEN) * dt) return false;
    // One jump needs a free corridor; the floors by a wall will do.
    if (straightAhead(c, path, s.pathIndex, run, false) < JUMP_STRAIGHT || !corridor(c, run)) return false;
    // How many hops follow the first jump: each one by the player's habit, and only from a view that lies on the
    // way (the air strafe of a chain swings the view across it).
    let more = 0;
    if (abs(turn(run - me.yaw)) <= ON_VIEW) while (more < 6 && random() < skill.hopChain) more++;
    h = s.hop = { more, swing: more > 0, dir: random() < 0.5 ? 1 : -1, rate: SWING / AIR_SECONDS, air: false, late: 0, tick: c.tick };
    cmd.jump = true;
    return false;
  }
  // The hop is over when the walk did not call it for a while (a fight, a hold, another goal).
  if (c.tick - h.tick > 2) {
    s.hop = null;
    return false;
  }
  h.tick = c.tick;
  if (!me.onGround) {
    h.air = true;
    // One jump alone flies on with the keys of the walk.
    if (!h.swing) return false;
    // The air strafe: no forward key, the strafe key, and the view turning the same way. A right strafe turns right.
    cmd.forward = 0;
    cmd.side = speed < top * AIR_FULL ? h.dir : 0;
    cmd.yaw = turn(me.yaw - h.dir * h.rate * dt);
    cmd.pitch = me.pitch;
    return true;
  }
  if (!h.air) return false;
  // Landed. The next hop, when the habit, the floor ahead and the speed allow it; the key a moment late now and then.
  h.air = false;
  if (h.more <= 0 || c.hurry || me.ducked || straightAhead(c, path, s.pathIndex, run) < HOP_STRAIGHT || !corridor(c, run)) {
    s.hop = null;
    return false;
  }
  if (h.late === 0) h.late = 1 + Math.floor(random() * (LATE_TICKS + 1));
  if (--h.late > 0) {
    h.air = true;
    return false;
  }
  h.more--;
  // The view swings back across the way: left of it, the next strafe turns right, as far past the way as SWING.
  const off = turn(run - me.yaw);
  h.dir = off > 0 ? -1 : 1;
  h.rate = (abs(off) + SWING) / AIR_SECONDS;
  cmd.jump = true;
  return false;
}

/**
 * The feet in a fight, as players of 1.6 fought: side to side, a step each 0.35 to 0.7 s, and under the gun's
 * speed limit while the shots go (the walk key, or the stop at the turn). `firing` is true when the trigger is
 * about to be down. Returns true when the gun is steady enough to fire now.
 */
export function fightStep(c, cmd, firing) {
  const { me, s, time, random } = c;
  const limit = stillSpeedOf(cmd.weapon ?? me.weapon);
  const speed = hypot(me.velocity[0], me.velocity[1]);
  if (!s.strafe) {
    // A stand: the keys against the run stop the feet in a few ticks (the counter-strafe), then nothing is held.
    if (speed > COUNTER_OVER && me.onGround) {
      const yaw = cmd.yaw * RAD;
      cmd.forward = -(me.velocity[0] * cos(yaw) + me.velocity[1] * sin(yaw)) / speed;
      cmd.side = -(me.velocity[0] * sin(yaw) - me.velocity[1] * cos(yaw)) / speed;
    }
    return speed <= limit;
  }
  if (time >= (s.strafeTurn ?? 0)) {
    s.strafeSide = s.strafeSide === 1 ? -1 : 1;
    s.strafeTurn = time + random(0.35, 0.7);
  }
  cmd.side = s.strafeSide;
  cmd.forward = 0;
  // A rifle spreads wide on the run: while the shots go the step is a walk, between them it is a run. In some
  // fights a player does not care and fires on the run (`s.runGun`, fight.js).
  if (s.runGun) return true;
  if (firing && limit < Infinity) cmd.walk = true;
  return speed <= limit;
}
