// How a player of CS 1.6 moves, past the plain walk: the jump on a run and the chain of bunny hops with its air
// strafe, and the side steps of a fight with the stop before the shots. The numbers of the game come from its
// movement code (pm_shared: air accelerate 10, the wish speed in the air capped at 30, the 1.2 speed limit of a
// jump); the habits come from the bot's profile.

import { PI, RAD, abs, atan2, clamp, cos, hypot, sin, turn } from './geometry.js';
import { WALK } from './nav.js';
import { isSniper, maxSpeedOf, stillSpeedOf } from './weapons.js';

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
// HOP_EAGER more, between HOP_LAZY (ahead of its count) and HOP_KEEN times. The profile counts the real jumps of
// a player (about 3 a minute), and a bot can jump on a part of its way only: so a bot behind its count jumps at
// almost the first place that allows it.
const HOP_EAGER = 10;
const HOP_LAZY = 0.3;
const HOP_KEEN = 40;
// `hopChain` is the part of a player's flat jumps that follow another in a chain, over all its jumps. A bot can
// chain only where the floor and its view allow it: with a chance of 0.5 there, 8.5% of its flat jumps were in a
// chain (docs/measures/2026-11-13-feet.md). So the chance at such a place is the player's part times this.
const CHAIN_GAIN = 5.9;
const CHAIN_MOST = 0.95;
// The landing of a hop: the key comes this many ticks late at most (a perfect hop every time is no hand).
const LATE_TICKS = 2;
// A stand in a fight: over this speed the keys push against the run; under it the friction ends it.
const COUNTER_OVER = 40;
// A bot that waits jumps only from a stand (units a second), this long after the last sign of an enemy (s), with
// this much room over its head (a jump rises 45 units).
const IDLE_STILL = 20;
const IDLE_CALM = 5;
const JUMP_ROOM = 48;
// The tap of the duck lifts the feet this far (units) for about this long (s): 18 units fall in 0.21 s.
const TAP_LIFT = 18;
const TAP_AIR = 0.25;
// No tap this long after the last sign of an enemy (s).
const TAP_CALM = 3;
// How a bot keeps to its profile's taps a minute: as the hop keeps to its jumps (HOP_EAGER).
const TAP_EAGER = 3;
const TAP_LAZY = 0.3;
const TAP_KEEN = 12;
// A roll of the wheel: after each tap one more follows with this chance, up to TAP_ROLL taps. In the demos a tap
// has one more within 0.8 s in 34% of the cases (docs/measures/2026-11-13-feet.md).
const TAP_MORE = 0.34;
const TAP_ROLL = 5;
// The steps of a fight change their side each 0.35 to 0.7 s for a player of the middle: by the measure of the
// arena that is this many seconds of side steps for each change (`strafeBeat` of the default profile).
const STEP_BEAT = 0.9;
// In a fight from a stand, the rest between two bursts is a step to a side (the jiggle of a player), then the
// counter-strafe stops the feet for the next burst. A side whose eye, this far over, loses the enemy is not taken.
// The step takes half the rest, REST_STEP_SECONDS at most.
const REST_STEP = 24;
const REST_STEP_SECONDS = 0.2;

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
    // In free time nothing keeps the count: a run that can hop, hops.
    const owed = (skill.jumpRate * (c.time - (s.liveAt ?? c.time))) / 60 - (s.jumps ?? 0);
    if (!c.free && random() >= (skill.jumpRate / 60) * clamp(1 + owed * HOP_EAGER, HOP_LAZY, HOP_KEEN) * dt) return false;
    // One jump needs a free corridor; the floors by a wall will do.
    if (straightAhead(c, path, s.pathIndex, run, false) < JUMP_STRAIGHT || !corridor(c, run)) return false;
    // How many hops follow the first jump: each one by the player's habit, and only from a view that lies on the
    // way (the air strafe of a chain swings the view across it).
    let more = 0;
    if (abs(turn(run - me.yaw)) <= ON_VIEW) while (more < 6 && (c.free || random() < Math.min(CHAIN_MOST, skill.hopChain * CHAIN_GAIN))) more++;
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
 * The jump of a player that waits at a place: a habit too. Half of the players' jumps on the flat start from a
 * stand (docs/measures/2026-11-11-night.md). True when the bot jumps now: it stands, it saw and heard no enemy
 * for a while, and it has room over its head. The jumps come by chance at the rate of its profile and never to
 * catch up with its count: jumps that come together at the second when the enemies arrive lose the first fight.
 */
export function idleJump(c, cmd) {
  const { me, own, s, skill, time, random, dt, brain } = c;
  if (c.frame.round.phase !== 'live' || c.hurry || cmd.forward || cmd.side || cmd.duck || !me.onGround || me.onLadder || me.ducked || own.stamina > 0) return false;
  if (hypot(me.velocity[0], me.velocity[1]) > IDLE_STILL) return false;
  if (time - s.seenAt < IDLE_CALM || time - (s.alertAt ?? -Infinity) < IDLE_CALM) return false;
  const owed = (skill.jumpRate * (time - (s.liveAt ?? time))) / 60 - (s.jumps ?? 0);
  if (owed <= 0 || random() >= (skill.jumpRate / 60) * dt) return false;
  const o = me.origin;
  return brain.ports.traceHull(o, [o[0], o[1], o[2] + JUMP_ROOM], false) >= 1;
}

/**
 * The tap of the duck, the duck on the mouse wheel: a habit of the run and of the wait, as the jump is. The key is
 * down for one tick; the game stands the player up from the started duck 18 units higher (pm_shared PM_UnDuck) and
 * they fall back. The run keeps its speed, and the feet make no step in the air. A roll of the wheel gives one tap
 * or a few in a row. True when the duck key goes down now.
 *
 * The taps come by chance at the rate of the profile (`duckTaps` a minute out of a fight), the more readily the
 * further the count of the round lies behind it. Never in a fight, in a hop, on a walk (shift) or with no room.
 */
export function duckTap(c, cmd) {
  const { me, s, skill, time, random, dt, brain } = c;
  if (!(skill.duckTaps > 0) || c.frame.round.phase !== 'live' || s.hop || cmd.duck || cmd.jump || cmd.walk || !me.onGround || me.onLadder || me.ducked) return false;
  // The enemy near, by the eye or the ear: the feet stay on the floor for the first shot.
  if (time - s.seenAt < TAP_CALM || time - (s.alertAt ?? -Infinity) < TAP_CALM) {
    s.roll = 0;
    return false;
  }
  // The next tap of a roll comes when the feet are back on the floor.
  if (time - (s.tapAt ?? -Infinity) < TAP_AIR) return false;
  if (!(s.roll > 0)) {
    const owed = (skill.duckTaps * (time - (s.liveAt ?? time))) / 60 - (s.taps ?? 0);
    if (random() >= (skill.duckTaps / 60) * clamp(1 + owed * TAP_EAGER, TAP_LAZY, TAP_KEEN) * dt) return false;
    s.roll = 1;
    while (s.roll < TAP_ROLL && random() < TAP_MORE) s.roll++;
  }
  // Room for the body 18 units up, and along the way that it flies in that time.
  const o = me.origin;
  const up = [o[0], o[1], o[2] + TAP_LIFT + 2];
  const on = [up[0] + me.velocity[0] * TAP_AIR, up[1] + me.velocity[1] * TAP_AIR, up[2]];
  if (brain.ports.traceHull(o, up, false) < 1 || brain.ports.traceHull(up, on, false) < 1) {
    s.roll = 0;
    return false;
  }
  s.roll--;
  s.tapAt = time;
  s.taps = (s.taps ?? 0) + 1;
  return true;
}

/** The side step of a rest between bursts: each rest the other side, or the one side that keeps the enemy in sight. */
function restStep(c, cmd) {
  const { me, s, time, random, brain } = c;
  if (s.restFor !== s.restUntil) {
    s.restFor = s.restUntil;
    s.restStepEnd = time + Math.min(REST_STEP_SECONDS, (s.restUntil - time) / 2);
    s.restSide = 0;
    const t = s.target;
    if (t && me.onGround) {
      const yaw = cmd.yaw * RAD;
      const at = [t.origin[0], t.origin[1], t.origin[2] + t.eye];
      const keeps = (k) => {
        const to = [me.origin[0] + sin(yaw) * k * REST_STEP, me.origin[1] - cos(yaw) * k * REST_STEP, me.origin[2]];
        return brain.ports.traceHull(me.origin, to, me.ducked) >= 1 && brain.ports.traceLine([to[0], to[1], to[2] + me.eye], at) >= 1;
      };
      const first = s.lastRestSide ? -s.lastRestSide : random() < 0.5 ? 1 : -1;
      s.restSide = keeps(first) ? first : keeps(-first) ? -first : 0;
      if (s.restSide) s.lastRestSide = s.restSide;
    }
  }
  if (!s.restSide || time >= s.restStepEnd) return false;
  cmd.forward = 0;
  cmd.side = s.restSide;
  return true;
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
    if (!firing && time < (s.restUntil ?? 0) && !isSniper(cmd.weapon ?? me.weapon) && restStep(c, cmd)) return speed <= limit;
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
    s.strafeTurn = time + random(0.35, 0.7) * (c.skill.strafeBeat / STEP_BEAT);
  }
  cmd.side = s.strafeSide;
  cmd.forward = 0;
  // A rifle spreads wide on the run: while the shots go the step is a walk, between them it is a run. In some
  // fights a player does not care and fires on the run (`s.runGun`, fight.js).
  if (s.runGun) return true;
  if (firing && limit < Infinity) cmd.walk = true;
  return speed <= limit;
}
