// The walk of a bot to a point by the level's graph: the way pulled tight, the jump onto a ledge, the ladder, and
// what a bot does when it does not get on. Ported from csbih-player (bot.js walkTo, climb, stuckCheck, giveUp),
// which holds the fixes of many stuck bots; the traces go through the ports.

import { PI, RAD, abs, atan2, cos, hypot, max, min, sign, sin } from './geometry.js';
import { JUMP, LADDER, WALK, canReach, findPath, navParts, nearestNode, nodePoint } from './nav.js';
import { lookAt } from './aim.js';
import { restLook } from './watch.js';
import { bestGun, maxSpeedOf } from './weapons.js';
import { hop } from './moves.js';

// The look for a ledge: this far ahead, a step up, and the height a jump with the legs up clears.
const LEDGE_AHEAD = 24;
export const STEP = 18;
const JUMP_CLEARS = 54;
// A bot that wants to move and stays within this many units for STUCK_SECONDS is stuck (a ducked walk goes 21 in
// that time): it steps aside from a player, else jumps.
const STUCK_CIRCLE = 16;
const STUCK_SECONDS = 0.25;
// Held up this long by a teammate that stands, within BLOCKED_NEAR of its point, a bot stands too for BLOCKED_WAIT.
const BLOCKED_SECONDS = 0.8;
const BLOCKED_NEAR = 400;
const BLOCKED_WAIT = 4;
// Held up this long by a teammate that stands, a bot asks it for the way. The teammate steps WAY_STEP aside where
// it has more than WAY_ROOM, and stays out of the way for WAY_SECONDS.
const WAY_ASK = 0.4;
const WAY_STEP = 72;
const WAY_ROOM = 40;
const WAY_SECONDS = 2.5;
// On a walk of the graph a ledge ahead counts once the bot has been slow for this long (s).
const HELD_UP = 0.08;
// A straight walk is looked for up to this many floors ahead; the view looks this far along the way.
const PULL = 10;
const LOOK_AHEAD = 480;
// On the last floor of its way a bot that came no nearer to the point for this long is there.
const END_SECONDS = 0.5;
// A goal that the bot cannot reach: it stayed within GIVE_UP_CIRCLE for GIVE_UP_SECONDS while the point lay further.
const GIVE_UP_CIRCLE = 48;
const GIVE_UP_RISE = 72;
const GIVE_UP_SECONDS = 5;
const GIVE_UP_GAP = 64;
// How far an island's bot looks for a floor of the part of the graph it wants to reach.
const ESCAPE_REACH = 640;
// That many of the nearest floors are asked for a way to the point.
const ESCAPE_TRIES = 32;
// Off the ladder's line by more than this, the bot lines up this far in front of its face before it goes in.
const LADDER_LINE = 6;
const LADDER_FRONT = 48;
// The view on a ladder: 30 degrees up climbs at 200 x (cos + sin) = 273 a second, 60 down descends as fast.
const LADDER_UP_PITCH = -30;
const LADDER_DOWN_PITCH = 60;
// A bot further than this from a ladder's middle line, short of its side edge, steps back toward the middle.
const LADDER_EDGE = 8;
// A bot's origin this high over a ladder's lowest point stands at its foot.
const LADDER_FOOT = 48;
// A bot that hangs within this far over a ladder's foot line for this long jumps off it.
const FOOT_BAND = 16;
const FOOT_HANG = 0.5;
// The feet of a bot that steps off a ladder sideways are this far over the floor it steps onto.
const LADDER_CLEAR = 2;
// A bot left on a ladder climbs on toward a point this far up or down: past either end.
const LADDER_LEAVE = 400;

const fits = (ports, origin, ducked) => ports.traceHull(origin, origin, ducked) >= 1;
const tr = { fraction: 1, startSolid: false, end: [0, 0, 0] };

/** A whole number for a point, the same for points within a cell of 32 units. */
export function pointKey(p) {
  return (Math.round(p[0] / 32) * 73856093) ^ (Math.round(p[1] / 32) * 19349663) ^ (Math.round(p[2] / 32) * 83492791);
}

/**
 * Walks to a point by the graph: the way is found again when the point moves, every few seconds, or when stuck.
 * Without a graph it walks straight. `facing` turns the view along the way. Returns true while it walks, false
 * when the bot is there.
 */
export function walkTo(c, cmd, point, facing) {
  const { me, own, s, skill, time, random, brain } = c;
  const { nav, ports } = brain;
  const o = me.origin;
  const left = hypot(point[0] - o[0], point[1] - o[1]);
  // There: at the point, at its height (a ladder's top is right over its foot).
  if (left < 24 && abs(point[2] - o[2]) < 20) {
    if (facing) rest(c, cmd);
    return false;
  }
  const key = pointKey(point);
  // A teammate stands in the way, near the point: this is as near as the bot gets for now (stuckCheck).
  if (s.blocked?.key === key && time < s.blocked.until && left < BLOCKED_NEAR && !me.onLadder && abs(point[2] - o[2]) < 40) {
    if (facing) rest(c, cmd);
    return false;
  }
  s.walked = c.tick;
  // The player's habits on the way: the walk near the end of it, the knife out on a long run far from a fight.
  if (s.walkFor !== key) {
    s.walkFor = key;
    s.walkNear = random() < skill.walkShare * 2;
    s.knifeOut = random() < skill.knifeRun;
  }
  if (s.walkNear && left < 500) cmd.walk = true;
  // With no enemy left (free time) every run is a calm one.
  const calm = c.free || (time - s.seenAt > 5 && time - (s.alertAt ?? -Infinity) > 5);
  if (facing && calm && s.knifeOut && left > 1200 && own.weapons.knife && cmd.weapon === undefined) cmd.weapon = 'knife';
  else if (facing && !c.free && me.weapon === 'knife' && (left < 800 || !calm)) cmd.weapon = bestGun(own);
  // On a ladder the way holds: its floors lie far below and above, and a new search would pick a wrong one.
  if (nav && !me.onLadder && (s.pathKey !== key || time - s.pathAt > 4 || (s.stuckSince !== null && time - s.stuckSince > 1))) findWay(c, point, key);
  // Off the island: the way is found again at once.
  if (s.escape && hypot(s.escape[0] - o[0], s.escape[1] - o[1]) < 24) {
    s.escape = null;
    s.pathAt = -Infinity;
  }
  let target = s.escape ?? point;
  let kind = null;
  const path = s.path;
  if (path) {
    const reached = (n) => hypot(n.point[0] - o[0], n.point[1] - o[1]) < 24 && abs(n.point[2] - o[2]) < 40;
    while (s.pathIndex < path.length - 1 && reached(path[s.pathIndex])) s.pathIndex++;
    // The straight line to the pulled floor passes the floors between at a distance, so they are never reached: a
    // floor further from the pulled one than the bot is lies behind the bot.
    const pull = min(s.pullTo ?? 0, path.length - 1);
    if (pull > s.pathIndex) {
      const p = path[pull].point;
      const gap = hypot(p[0] - o[0], p[1] - o[1]);
      while (s.pathIndex < pull && hypot(p[0] - path[s.pathIndex].point[0], p[1] - path[s.pathIndex].point[1]) > gap) s.pathIndex++;
    }
    // The way pulled tight: the furthest of the next floors that a straight walk reaches on the same level, so the
    // bot runs a line and not the steps of the grid. On the ground only: in the air the line to a floor is no walk.
    if (s.pullTo === undefined || s.pullTo < s.pathIndex || (c.every(0.04) && me.onGround)) s.pullTo = pullTight(c, path, s.pathIndex);
    const i = max(s.pathIndex, min(s.pullTo, path.length - 1));
    target = path[i].point;
    kind = path[s.pathIndex].kind;
    // On the last floor of the way, or on the way to it: where the bot comes no nearer to the point for a moment
    // is as near as it gets, and it stands there. The point can lie off the graph (a spot between two floors), or
    // a teammate can stand on it (a place of a team's formation holds two players a step apart).
    if (s.pathIndex === path.length - 1 && !s.escape && me.onGround && !me.onLadder) {
      const gap = hypot(left, point[2] - o[2]);
      if (s.endKey !== key || gap < s.endBest - 1) {
        s.endKey = key;
        s.endBest = gap;
        s.endAt = time;
      } else if (time - s.endAt > END_SECONDS && left <= GIVE_UP_GAP) {
        if (facing) rest(c, cmd);
        return false;
      }
      if (reached(path[s.pathIndex])) target = point;
    }
  }
  // A ladder: face it and hold forward, the view up to climb and down to descend.
  if ((kind === LADDER || (me.onLadder && !me.onGround)) && climb(c, cmd, target)) return true;
  const dx = target[0] - o[0];
  const dy = target[1] - o[1];
  const distance = hypot(dx, dy) || 1;
  const run = (atan2(dy, dx) * 180) / PI;
  // The view looks along the way a little ahead, not at the next floor of the grid: a player looks where they go.
  if (facing) {
    const ahead = lookAhead(path, s.pathIndex, o) ?? target;
    lookAt(c, cmd, (atan2(ahead[1] - o[1], ahead[0] - o[0]) * 180) / PI, 0);
  }
  const rel = (run - cmd.yaw) * RAD;
  cmd.forward = cos(rel);
  cmd.side = -sin(rel);
  // A long straight run with nothing to fear: a jump, or a chain of bunny hops, as the player's habit has it.
  if (facing && calm && !cmd.walk && hop(c, cmd, path, target, run, distance, kind)) return true;
  if (!me.onGround) {
    // In the air toward a higher place: the legs come up (the duck jump), as players cleared a crate.
    if (target[2] > o[2] + 10) cmd.duck = true;
    return true;
  }
  const fresh = own.stamina <= 0;
  // A jump where the way has a jump, or at a ledge that a step does not climb. On a walk of the graph the movement
  // climbs the steps itself, so there a ledge counts only once it holds the bot up: a jump at full speed (the
  // reference bot's, on any stairs) slows the run for a second and can carry the bot off the stairs.
  const held = kind === null || slowFor(c, cmd) > HELD_UP;
  if (fresh && ((kind === JUMP && distance < 48) || (held && ledgeAhead(c, dx / distance, dy / distance)))) cmd.jump = true;
  stuckCheck(c, cmd, fresh);
  return true;
}

/** The seconds that the bot has run at under half the speed that its keys ask for. */
function slowFor(c, cmd) {
  const { me, s, time } = c;
  const want = maxSpeedOf(cmd.weapon ?? me.weapon) * (cmd.walk ? 0.52 : 1) * (me.ducked ? 0.34 : 1);
  if (hypot(me.velocity[0], me.velocity[1]) >= want * 0.5) s.slowSince = null;
  else s.slowSince ??= time;
  return s.slowSince === null ? 0 : time - s.slowSince;
}

/** At the point with no view of its own to keep: the bot looks where an enemy comes from, never at the wall. */
function rest(c, cmd) {
  const v = restLook(c);
  lookAt(c, cmd, v.yaw, v.pitch);
}

/** Finds the way to a point again: `s.path`, or `s.escape` for a bot on an island of the graph. */
function findWay(c, point, key) {
  const { me, s, time, brain, mates } = c;
  const nav = brain.nav;
  const o = me.origin;
  if (s.stuckSince !== null && time - s.stuckSince > 1) failedStep(c);
  const to = nearestNode(nav, point, 4, 64);
  // From a floor at the bot's own height: a ledge narrower than the grid has none, and the bot walks straight
  // until it reaches the graph (the floor below a catwalk is not its way).
  const from = nearestNode(nav, o, 3, 48);
  s.path = from < 0 ? null : findPath(nav, from, to, 20000, s.avoid ?? null);
  // No way from the nearest floor (a box top with no way down in the graph): from the nearest one no higher than a step.
  if (!s.path) {
    const low = nearestNode(nav, o, 8, STEP);
    if (low >= 0 && low !== from) s.path = findPath(nav, low, to, 20000, s.avoid ?? null);
  }
  // Still none: the bot stands on an island of the graph. Straight to the nearest floor that has a way to the
  // point, and on by the graph from there. At that floor already, the way starts from it: the floor nearest to
  // the bot can still be one of the island.
  const out = !s.path && from >= 0 && to >= 0 ? escapeNode(c, to) : -1;
  s.escape = null;
  if (out >= 0) {
    const p = nodePoint(nav, out);
    if (hypot(p[0] - o[0], p[1] - o[1]) < 24 && abs(p[2] - o[2]) < 40) s.path = findPath(nav, out, to, 20000, s.avoid ?? null);
    if (!s.path) s.escape = p;
  }
  s.pathKey = key;
  s.pathAt = time;
  s.pathIndex = 0;
  s.pullTo = undefined;
  s.stuckSince = null;
}

/**
 * Stuck on the way with nobody in it: the step of the way that the bot is on is one it cannot take (a jump too high
 * for it, a ladder in a hatch that it does not fit). The next ways leave it out, or the bot tries it again and again.
 */
function failedStep(c) {
  const { me, s, mates, brain } = c;
  const o = me.origin;
  const at = s.path?.[s.pathIndex];
  const before = s.path?.[s.pathIndex - 1];
  if (!at || !before || mates.some((p) => p !== me && p.alive && hypot(p.origin[0] - o[0], p.origin[1] - o[1]) < 64)) return;
  (s.avoid ??= new Set()).add(before.node * brain.nav.count + at.node);
}

/**
 * The nearest floor with a way to `to`, when the bot's own floor is in another part of the graph; else -1. Of the
 * nearest floors of the part of `to`, the first that a straight walk reaches (the nearest of all can lie behind a
 * wall); else the nearest. A drop joins two floors one way only, so each is asked for its way.
 */
function escapeNode(c, to) {
  const { nav, ports } = c.brain;
  const o = c.me.origin;
  const parts = navParts(nav);
  const from = nearestNode(nav, o, 3, 48);
  if (from >= 0 && parts[from] === parts[to]) return -1;
  const near = [];
  for (let i = 0; i < nav.count; i++) {
    if (parts[i] !== parts[to]) continue;
    const dz = nav.xyz[i * 3 + 2] - o[2];
    if (dz > STEP * 3 || dz < -200) continue;
    const d = (nav.xyz[i * 3] - o[0]) ** 2 + (nav.xyz[i * 3 + 1] - o[1]) ** 2 + dz * dz;
    if (d < ESCAPE_REACH ** 2) near.push([d, i]);
  }
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let first = -1;
  for (const [, i] of near.slice(0, ESCAPE_TRIES)) {
    if (!canReach(nav, i, to)) continue;
    if (first < 0) first = i;
    if (ports.traceHull(o, [nav.xyz[i * 3], nav.xyz[i * 3 + 1], max(o[2], nav.xyz[i * 3 + 2])], c.me.ducked) >= 1) return i;
  }
  return first;
}

/** The furthest floor of the next PULL that the bot's box reaches in a straight line on its own level. */
function pullTight(c, path, from) {
  const { me, brain } = c;
  const o = me.origin;
  let best = from;
  for (let i = from + 1; i < min(path.length, from + PULL); i++) {
    const n = path[i];
    if (n.kind !== WALK || abs(n.point[2] - o[2]) > 18) break;
    if (brain.ports.traceHull(o, [n.point[0], n.point[1], o[2]], me.ducked) < 1) continue;
    best = i;
  }
  return best;
}

/** The point of the way LOOK_AHEAD units on from the bot. */
export function lookAhead(path, from, o) {
  if (!path) return null;
  let left = LOOK_AHEAD;
  let at = o;
  for (let i = from; i < path.length; i++) {
    const p = path[i].point;
    const d = hypot(p[0] - at[0], p[1] - at[1]);
    if (d >= left) return [at[0] + ((p[0] - at[0]) * left) / d, at[1] + ((p[1] - at[1]) * left) / d, p[2]];
    left -= d;
    at = p;
  }
  return at;
}

/**
 * True when the box of the bot, lifted a step, is still blocked a little ahead (dx, dy), and lifted a jump is not:
 * a ledge that the movement does not climb by itself.
 */
function ledgeAhead(c, dx, dy) {
  const { me, brain } = c;
  const { ports } = brain;
  const o = me.origin;
  const at = (z) => {
    ports.traceHull(o, [o[0], o[1], o[2] + z], me.ducked, tr);
    if (tr.startSolid || tr.fraction < 1) return false;
    const top = [tr.end[0], tr.end[1], tr.end[2]];
    return ports.traceHull(top, [top[0] + dx * LEDGE_AHEAD, top[1] + dy * LEDGE_AHEAD, top[2]], me.ducked) >= 1;
  };
  return !at(STEP) && at(JUMP_CLEARS);
}

/** Counts the time a bot that wants to move does not, and jumps when it has stood too long. */
function stuckCheck(c, cmd, fresh) {
  const { me, s, time, frame, mates } = c;
  // Held by the freeze time, a bot is not stuck: no jump, no edge marked as failed.
  if (frame.round.phase === 'freeze') {
    s.stuckSince = null;
    s.stuckAt = null;
    s.stuckFor = 0;
    return;
  }
  // Stuck is staying in a small circle, not a low speed of the moment: a bot that shakes against a wall or a
  // teammate moves fast now and then and goes nowhere.
  const o = me.origin;
  if (!s.stuckAt || hypot(o[0] - s.stuckAt[0], o[1] - s.stuckAt[1]) > STUCK_CIRCLE || s.stuckSince === null) {
    s.stuckAt = [o[0], o[1]];
    s.stuckSince = time;
  }
  s.stuckFor = time - s.stuckSince;
  if (s.stuckFor <= STUCK_SECONDS) return;
  // Held up by another player: a step aside, as players do, not a jump onto their head.
  const blocker = mates.find((p) => p !== me && p.alive && hypot(p.origin[0] - o[0], p.origin[1] - o[1]) < 48 && abs(p.origin[2] - o[2]) < 60);
  if (blocker) {
    cmd.side = me.id < blocker.id ? 1 : -1;
    // A teammate that stands in the way hears "make way" (makeWay).
    if (s.stuckFor > WAY_ASK && hypot(blocker.velocity[0], blocker.velocity[1]) < 30 && !(c.team.way.get(blocker.id)?.until > time)) {
      c.team.way.set(blocker.id, { dir: [blocker.origin[0] - o[0], blocker.origin[1] - o[1]], until: time + WAY_SECONDS, to: null });
    }
    // A teammate that stands and does not make way (it holds its own place): the bot waits here a while, where
    // its point is near (walkTo).
    if (s.stuckFor > BLOCKED_SECONDS && hypot(blocker.velocity[0], blocker.velocity[1]) < 30) s.blocked = { key: s.walkFor, until: time + BLOCKED_WAIT };
    return;
  }
  if (fresh && Math.floor(s.stuckFor * 4) % 3 === 0) cmd.jump = true;
}

/**
 * Lets go of a goal that the bot has not come nearer to in GIVE_UP_SECONDS (a ladder it fell off, a point with no
 * way there). A player gives up too; a bot that tried forever stood at a wall for the rest of the round. True when
 * it gave up: the caller forgets what brought the goal.
 */
export function giveUp(c, fighting) {
  const { me, s, time, frame } = c;
  const o = me.origin;
  const wants = s.lastPoint;
  if (fighting || !wants || frame.round.phase === 'freeze') {
    s.goneFrom = null;
    return false;
  }
  // Level only, with a jump's height allowed for: the jumps of a stuck bot must not count as progress.
  if (!s.goneFrom || hypot(o[0] - s.goneFrom[0], o[1] - s.goneFrom[1]) > GIVE_UP_CIRCLE || abs(o[2] - s.goneFrom[2]) > GIVE_UP_RISE) {
    s.goneFrom = [...o];
    s.goneSince = time;
  }
  const far = hypot(wants[0] - o[0], wants[1] - o[1]) > GIVE_UP_GAP || abs(wants[2] - o[2]) > GIVE_UP_CIRCLE;
  if (!far || time - s.goneSince < GIVE_UP_SECONDS) return false;
  // A ladder holds no stuck clock (climb), so a ladder that the bot cannot take shows only here.
  failedStep(c);
  s.path = null;
  s.pathKey = null;
  s.goneFrom = null;
  return true;
}

/** The ladder of the level within 96 units of a point, or null. */
export function ladderNear(map, o) {
  for (const l of map.ladders) {
    const x = max(l.mins[0], min(l.maxs[0], o[0]));
    const y = max(l.mins[1], min(l.maxs[1], o[1]));
    if (hypot(x - o[0], y - o[1]) < 96 && o[2] > l.mins[2] - 60 && o[2] < l.maxs[2] + 80) return l;
  }
  return null;
}

/** True at the foot of a ladder: a bot there stands on the floor. */
function atLadderFoot(map, o) {
  const ladder = ladderNear(map, o);
  return Boolean(ladder) && o[2] < ladder.mins[2] + LADDER_FOOT;
}

/**
 * On or at a ladder toward `target`: faces it and holds forward, the view up to climb and down to descend. False
 * when no ladder is near.
 */
export function climb(c, cmd, target) {
  const { me, s, time, brain } = c;
  const { ports, map } = brain;
  const o = me.origin;
  const ladder = ladderNear(map, o);
  if (!ladder) return false;
  // Up when the floor it goes to lies over the ladder's middle: at the top that floor is level with the bot.
  const up = target[2] > (ladder.mins[2] + ladder.maxs[2]) / 2;
  // On the ladder a step over the floor, with nowhere higher to go or on its way down: below the foot's line the
  // walk keys climb again, above it the climb sends the bot back down. After a moment of that a jump takes it off
  // the ladder.
  const low = me.onLadder && !me.onGround && o[2] < ladder.mins[2] + LADDER_FOOT + FOOT_BAND && (!up || target[2] < o[2] + 32);
  if (!low) s.footSince = null;
  else if ((s.footSince ??= time) < time - FOOT_HANG) {
    cmd.forward = 0;
    cmd.side = 0;
    cmd.jump = true;
    s.footSince = null;
    return true;
  }
  // At the foot or the top already, level with the target: a walk, not a climb.
  const foot = o[2] < ladder.mins[2] + LADDER_FOOT;
  if ((me.onGround || foot) && abs(target[2] - o[2]) < 32) return false;
  s.climbUp = up;
  s.climbTick = c.tick;
  // To the ladder's open face first, then facing it (its normal points out of the face).
  const n = ladder.normal;
  const mid = [(ladder.mins[0] + ladder.maxs[0]) / 2, (ladder.mins[1] + ladder.maxs[1]) / 2];
  let face = [mid[0] + n[0] * 17, mid[1] + n[1] * 17];
  // A ladder in a shaft as wide as a player: from the side the box catches on the shaft's frame. Off its line, the
  // bot first goes out in front of the face, in line with the ladder, then straight in.
  if (!me.onLadder) {
    const along = (o[0] - mid[0]) * -n[1] + (o[1] - mid[1]) * n[0];
    const out = (o[0] - mid[0]) * n[0] + (o[1] - mid[1]) * n[1];
    if (abs(along) > LADDER_LINE && out < LADDER_FRONT) face = [mid[0] + n[0] * LADDER_FRONT, mid[1] + n[1] * LADDER_FRONT];
  }
  // On the ladder, as players climbed in 1.6: up facing the ladder with the view raised, down facing away from it
  // with the view lowered. Off the ladder, to its open face first.
  const away = up ? -1 : 1;
  const yaw = me.onLadder ? (atan2(n[1] * away, n[0] * away) * 180) / PI : (atan2(face[1] - o[1], face[0] - o[0]) * 180) / PI;
  // At the top: toward the floor it climbs to. Out of the ladder's volume the climb's speed carries the feet over
  // the edge and the forward key moves the bot onto the floor.
  const top = up && (o[2] >= target[2] - 24 || o[2] > ladder.maxs[2] - 8);
  // A floor on the open side of the face (a ladder beside its platform): a view turned to it turns the climb into
  // a descent, because the game moves along the view.
  const beside = me.onLadder && top && (target[0] - o[0]) * n[0] + (target[1] - o[1]) * n[1] > 0;
  cmd.yaw = me.onLadder && top && !beside ? (atan2(target[1] - o[1], target[0] - o[0]) * 180) / PI : yaw;
  cmd.pitch = up ? LADDER_UP_PITCH : LADDER_DOWN_PITCH;
  cmd.forward = 1;
  cmd.side = 0;
  // So it climbs on with its face to the ladder until its feet clear that floor, then steps off to the floor's
  // side; a floor straight behind its back takes a jump off the ladder.
  if (beside && o[2] >= target[2] + LADDER_CLEAR) {
    const yr = cmd.yaw * RAD;
    const along = (target[0] - o[0]) * sin(yr) - (target[1] - o[1]) * cos(yr);
    cmd.forward = 0;
    if (abs(along) > LADDER_EDGE) cmd.side = sign(along);
    else cmd.jump = true;
  }
  // Near a side edge of the ladder the box catches on the frame above it: back toward the middle.
  if (me.onLadder && !top) {
    const across = [-n[1], n[0]];
    const offset = (o[0] - mid[0]) * across[0] + (o[1] - mid[1]) * across[1];
    const half = abs((ladder.maxs[0] - ladder.mins[0]) * across[0] + (ladder.maxs[1] - ladder.mins[1]) * across[1]) / 2;
    if (abs(offset) > max(0, half - LADDER_EDGE)) {
      const yr = cmd.yaw * RAD;
      const right = [sin(yr), -cos(yr)];
      cmd.side = sign(-(offset > 0 ? 1 : -1) * (across[0] * right[0] + across[1] * right[1]));
    }
  }
  cmd.duck = false;
  // A vent at the ladder's top: where a standing box does not fit a step on toward the target but a ducked one
  // does, the bot ducks, as players went into the vents of de_nuke.
  if (me.onLadder || me.ducked) {
    const dx = target[0] - o[0];
    const dy = target[1] - o[1];
    const d = hypot(dx, dy) || 1;
    const step = min(24, d);
    const ahead = [o[0] + (dx / d) * step, o[1] + (dy / d) * step, o[2] + (up ? 8 : -8)];
    if (!fits(ports, ahead, false) && fits(ports, [ahead[0], ahead[1], ahead[2] - 18], true)) cmd.duck = true;
    else if (!fits(ports, o, false) && me.ducked) cmd.duck = true;
  }
  s.stuckSince = null;
  return true;
}

/**
 * On a ladder there is no gravity: a bot whose task does not move it (a hold, a fight) would hang there. It
 * finishes the climb the way it last went, onto the floor at that end.
 */
export function leaveLadder(c, cmd) {
  const { me, s, brain } = c;
  if (!me.onLadder || me.onGround || s.climbTick === c.tick || atLadderFoot(brain.map, me.origin)) return;
  const o = me.origin;
  climb(c, cmd, [o[0], o[1], o[2] + (s.climbUp === false ? -LADDER_LEAVE : LADDER_LEAVE)]);
}

/**
 * A teammate that this bot held up asked for the way (stuckCheck). A bot that stands steps out of it: to the side
 * with room, else on ahead of the teammate. Its goal brings it back after WAY_SECONDS. True while it steps.
 */
export function makeWay(c, cmd) {
  const { me, s, time, team, brain } = c;
  const ask = team.way.get(me.id);
  if (!ask || time > ask.until || !me.onGround || me.onLadder) return false;
  const o = me.origin;
  if (!ask.to) {
    const d = hypot(ask.dir[0], ask.dir[1]) || 1;
    const along = [ask.dir[0] / d, ask.dir[1] / d];
    let best = null;
    let room = WAY_ROOM;
    for (const v of [[-along[1], along[0]], [along[1], -along[0]], along]) {
      const far = brain.ports.traceHull(o, [o[0] + v[0] * WAY_STEP, o[1] + v[1] * WAY_STEP, o[2]], me.ducked) * WAY_STEP;
      if (far <= room) continue;
      // No step off a ledge: the floor lies under the end of the step.
      const end = [o[0] + v[0] * far, o[1] + v[1] * far, o[2]];
      if (brain.ports.traceHull(end, [end[0], end[1], end[2] - STEP * 2], me.ducked) >= 1) continue;
      [best, room] = [v, far];
    }
    if (!best) {
      team.way.delete(me.id);
      return false;
    }
    ask.to = [o[0] + best[0] * room, o[1] + best[1] * room];
  }
  const dx = ask.to[0] - o[0];
  const dy = ask.to[1] - o[1];
  // Out of the way it stands, whatever its goal wants of its feet, until the call ends.
  const there = hypot(dx, dy) < 8;
  const rel = ((atan2(dy, dx) * 180) / PI - cmd.yaw) * RAD;
  cmd.forward = there ? 0 : cos(rel);
  cmd.side = there ? 0 : -sin(rel);
  cmd.jump = false;
  // The walk that the call holds up is not stuck: no edge of its way counts as failed.
  s.stuckSince = null;
  s.stuckAt = null;
  s.stuckFor = 0;
  return true;
}

/** A tick with no walk (a stand, a hold, a fight) ends the stuck spell: the next walk starts its own. */
export function restStuck(c) {
  const { s } = c;
  if (s.walked !== undefined && s.walked < c.tick - 1) {
    s.stuckSince = null;
    s.stuckFor = 0;
  }
}
