// Grenades: how one flies, how a bot finds the view that throws one to a place, and the throws of a map that a
// bot repeats (the lineups: where players stood and where their grenade went off, mined from many matches).
// The flight follows the game's own rules, as csbih-player's grenade.js has them from ggrenade.cpp and the
// engine's bounce (SV_Physics_Bounce): the numbers are the game's.
//
// A recorded throw holds the thrower's run in its velocity, and a bot throws from a stand. So a lineup is kept as
// the place where the grenade went off, and the bot works out its own view to that place.

import { PI, RAD, abs, atan2, cos, flat, hypot, sin, turn } from './geometry.js';
import { nearestNode, nodePoint, reaches } from './nav.js';

/** The weapon of each kind of grenade. */
export const WEAPON_OF = { he: 'hegrenade', flash: 'flashbang', smoke: 'smokegrenade' };

const GRAVITY = 800;
// The part of the gravity that each kind falls at, and what a bounce keeps (2 - friction along the normal).
const KINDS = { he: { gravity: 0.55, friction: 0.7 }, flash: { gravity: 0.5, friction: 0.8 }, smoke: { gravity: 0.5, friction: 0.8 } };
// An HE and a flashbang go off 1.6 s or 1.7 s after the throw; a smoke grenade once it lies, at the earliest then.
const FUSE = 1.65;
const SMOKE_FUSE = 1.5;
const THINK = 0.1;
const STEP = 0.01;
const LONGEST = 6;
const GROUND_FRICTION = 0.8;
const SMOKE_GROUND_FRICTION = 0.95;
const BOUNCE_STOP = 10;
// The throw of the game: the grenade starts this far before the eye, the view is bent up, the speed has a cap.
const START_AHEAD = 16;
const SPEED_CAP = 750;
const EYE = 17;

// A lineup is taken from this far, from this many seconds before its time of the round to this many after, when
// its place lies near the bot's own way (the walk by the place is at most DETOUR longer). A bot throws this many
// lineups a round: a round is not a walk from one throw to the next.
const LINEUP_REACH = 700;
const DETOUR = 250;
const LINEUPS_A_ROUND = 1;
// No throw where teammates stand: an HE this near one of them, a flashbang this near (the others turn away).
const HE_NEAR_MATE = 380;
const FLASH_NEAR_MATE = 450;
// A flashbang of the team: who sees its place within this range turns away until it went off.
const FLASH_REACH = 1500;
const LINEUP_EARLY = 8;
const LINEUP_LATE = 4;
// A bot gives a lineup this long, and this long at its place.
const LINEUP_SECONDS = 14;
const AT_PLACE_SECONDS = 4;
// A solved throw may go off this far from the lineup's place, by kind; further, the lineup is no throw from a stand.
const MISS_OK = { he: 130, flash: 170, smoke: 110 };
// At the place (the walk stops within 24 units of it): this near, this slow, and the view this close to the throw's
// (degrees) before the pin comes out. The key goes down once the grenade is drawn (DRAW seconds in the hand), stays
// down for PRESS seconds and comes up: the game throws half a second after the pin, on a tick with the key up.
const AT_PLACE = 26;
const STILL = 12;
const ON_VIEW = 0.6;
const DRAW = 0.8;
const PRESS = 0.15;
// The view turns to the throw at most this fast (degrees a second): a hand that sets an angle, not a flick.
const SET_SPEED = 240;

const hit = { fraction: 1, startSolid: false, end: [0, 0, 0], normal: [0, 0, 0] };

/** The start and the velocity of a throw from an eye with a view, as the game throws it; `run` adds the thrower's own velocity. */
export function throwOf(eye, yaw, pitch, run = null) {
  const bent = pitch < 0 ? -10 + pitch * (80 / 90) : -10 + pitch * (100 / 90);
  const speed = Math.min(SPEED_CAP, (90 - bent) * 6);
  const p = bent * RAD;
  const y = yaw * RAD;
  const f = [cos(p) * cos(y), cos(p) * sin(y), -sin(p)];
  return {
    from: [eye[0] + f[0] * START_AHEAD, eye[1] + f[1] * START_AHEAD, eye[2] + f[2] * START_AHEAD],
    velocity: [f[0] * speed + (run?.[0] ?? 0), f[1] * speed + (run?.[1] ?? 0), f[2] * speed + (run?.[2] ?? 0)],
  };
}

function clip(v, n, overbounce) {
  const back = (v[0] * n[0] + v[1] * n[1] + v[2] * n[2]) * overbounce;
  for (let k = 0; k < 3; k++) {
    v[k] -= n[k] * back;
    if (v[k] > -0.1 && v[k] < 0.1) v[k] = 0;
  }
}

/**
 * Where a grenade of `kind` thrown from `from` with `velocity` goes off: {point, time}. The level stops it; players
 * do not (nobody knows where they will stand).
 */
export function flight(ports, kind, from, velocity) {
  const k = KINDS[kind];
  const pos = [...from];
  const vel = [...velocity];
  let ground = false;
  let rest = false;
  let bounces = 0;
  let nextThink = THINK;
  const move = (dx, dy, dz) => {
    const to = [pos[0] + dx, pos[1] + dy, pos[2] + dz];
    const fraction = ports.traceLine(pos, to, hit);
    if (fraction >= 1 && !hit.startSolid) {
      pos[0] = to[0];
      pos[1] = to[1];
      pos[2] = to[2];
      return null;
    }
    pos[0] += dx * fraction;
    pos[1] += dy * fraction;
    pos[2] += dz * fraction;
    // The touch of a bounce: on the ground a part of the speed stays; in the air the bounces count to a stop.
    if (ground) for (let i = 0; i < 3; i++) vel[i] *= GROUND_FRICTION;
    else if (bounces++ >= BOUNCE_STOP) {
      ground = true;
      vel[0] = vel[1] = vel[2] = 0;
    }
    return fraction;
  };
  for (let t = STEP; t <= LONGEST; t += STEP) {
    if (t >= nextThink) {
      nextThink += THINK;
      if (kind === 'smoke') {
        if (ground) for (let i = 0; i < 3; i++) vel[i] *= SMOKE_GROUND_FRICTION;
        if (t >= SMOKE_FUSE + THINK && ground) return { point: pos, time: t };
      }
    }
    if (kind !== 'smoke' && t >= FUSE) return { point: pos, time: t };
    if (rest) continue;
    if (vel[2] > 0) ground = false;
    if (ground && vel[0] === 0 && vel[1] === 0 && vel[2] === 0) {
      rest = true;
      continue;
    }
    vel[2] -= k.gravity * GRAVITY * STEP;
    const fraction = move(vel[0] * STEP, vel[1] * STEP, vel[2] * STEP);
    if (fraction === null) continue;
    if (hit.startSolid) {
      vel[0] = vel[1] = vel[2] = 0;
      continue;
    }
    const n = [hit.normal[0], hit.normal[1], hit.normal[2]];
    clip(vel, n, 2 - k.friction);
    if (n[2] <= 0.7) continue;
    // A floor: the engine takes the speed before it zeroes the upward part.
    const speed2 = vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2;
    if (vel[2] < GRAVITY * STEP) {
      ground = true;
      vel[2] = 0;
    }
    if (speed2 < 900) {
      ground = true;
      rest = true;
      vel[0] = vel[1] = vel[2] = 0;
      continue;
    }
    const left = (1 - fraction) * STEP * 0.9;
    move(vel[0] * left, vel[1] * left, vel[2] * left);
  }
  return { point: pos, time: LONGEST };
}

const gap = (a, b) => hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The view of a throw from a stand at `eye` that goes off nearest `target`: {yaw, pitch, miss}. `yaw` is the way to
 * try first (a bank off a wall keeps the thrower's own line). A coarse search of the pitch, then a fine one of
 * both angles: about 40 flights.
 */
export function solveThrow(ports, kind, eye, target, yaw) {
  const miss = (y, p) => {
    const t = throwOf(eye, y, p);
    return gap(flight(ports, kind, t.from, t.velocity).point, target);
  };
  let best = { yaw, pitch: 0, miss: Infinity };
  const tryAt = (y, p) => {
    const m = miss(y, p);
    if (m < best.miss) best = { yaw: y, pitch: p, miss: m };
  };
  for (let p = -75; p <= 30; p += 5) tryAt(yaw, p);
  const coarse = best.pitch;
  for (const dp of [-3, -1.5, 1.5, 3]) tryAt(yaw, coarse + dp);
  const pitch = best.pitch;
  for (const dy of [-6, -3, -1.5, 1.5, 3, 6]) tryAt(yaw + dy, pitch);
  const fine = best;
  for (const dp of [-1, 1]) tryAt(fine.yaw, fine.pitch + dp);
  return { yaw: turn(best.yaw), pitch: best.pitch, miss: best.miss };
}

/**
 * What the graph keeps for the lineups of a brain: {throws, grenades}. Brains of one level share the graph
 * (nav.js navOf) and can have different lineups, so the key is the content of the brain's own list.
 */
export function lineupCache(brain) {
  if (brain.lineupCache) return brain.lineupCache;
  const lists = (brain.nav.lineups ??= new Map());
  const key = JSON.stringify(brain.map.lineups ?? []);
  if (!lists.has(key)) lists.set(key, { throws: new Map(), grenades: {} });
  return (brain.lineupCache = lists.get(key));
}

/**
 * A lineup of the map as a throw of this brain (worked out once, see lineupCache): {stand, yaw, pitch, target}
 * or null when a stand at its place cannot throw there.
 */
function throwOfLineup(brain, index) {
  const cache = lineupCache(brain).throws;
  if (cache.has(index)) return cache.get(index);
  const { nav, ports } = brain;
  const l = brain.map.lineups[index];
  let solved = null;
  // The recorded grenade started 16 units before the thrower's eye, along its way.
  const speed = hypot(l.velocity[0], l.velocity[1], l.velocity[2]) || 1;
  const eye = [l.from[0] - (l.velocity[0] / speed) * START_AHEAD, l.from[1] - (l.velocity[1] / speed) * START_AHEAD, l.from[2] - (l.velocity[2] / speed) * START_AHEAD];
  // The thrower stood on a floor of the graph (a throw out of a jump has none under it).
  const node = nearestNode(nav, [eye[0], eye[1], eye[2] - EYE], 2, 40);
  if (node >= 0) {
    const stand = nodePoint(nav, node);
    const target = flight(ports, l.kind, l.from, l.velocity).point;
    const from = [stand[0], stand[1], stand[2] + EYE];
    const view = solveThrow(ports, l.kind, from, target, (atan2(l.velocity[1], l.velocity[0]) * 180) / PI);
    if (view.miss <= MISS_OK[l.kind]) solved = { stand, yaw: view.yaw, pitch: view.pitch, target: [...target], miss: view.miss };
  }
  cache.set(index, solved);
  return solved;
}

/** The grenades that a side has a throw for on this map, as weapon names (found once). */
export function grenadesOf(brain, side) {
  const known = lineupCache(brain).grenades;
  return (known[side] ??= new Set((brain.map.lineups ?? []).filter((l) => l.team === side).map((l) => WEAPON_OF[l.kind])));
}

/**
 * The lineup that this bot goes to throw now, as a goal: {kind: 'goto', task: 'lineup', point, lineup}, or null.
 * It keeps the one it is on while it still carries the grenade. Else it takes the nearest lineup of its side for a
 * grenade it carries, due about now, that nobody of the team took this round.
 */
export function lineupGoal(c) {
  const { me, own, s, team, time, brain, bot } = c;
  const list = brain.map.lineups;
  if (!list?.length || s.liveAt === undefined) return null;
  let on = s.lineup;
  if (on) {
    const count = own.weapons[WEAPON_OF[on.kind]]?.count ?? (own.weapons[WEAPON_OF[on.kind]] ? 1 : 0);
    // Thrown (one fewer in the pocket): the team hears where a flashbang goes off and when. Or out of time: done.
    const thrown = count < on.count;
    if (thrown && on.kind === 'flash') team.flashes.push({ point: on.target, until: time + FUSE + 0.2, by: bot.id });
    if (thrown) s.lineups = (s.lineups ?? 0) + 1;
    if (thrown || time - on.since > LINEUP_SECONDS || (on.atPlace !== null && time - on.atPlace > AT_PLACE_SECONDS)) {
      s.lineup = null;
      on = null;
    }
  }
  if (!on) {
    if ((s.lineups ?? 0) >= LINEUPS_A_ROUND || !c.every(0.3)) return null;
    const round = time - s.liveAt;
    // Where the bot was going when it last had another goal: a lineup must lie near that way.
    const going = s.goingTo ?? null;
    let best = -1;
    let bestD = LINEUP_REACH;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (l.team !== me.team || !own.weapons[WEAPON_OF[l.kind]] || round < l.at - LINEUP_EARLY || round > l.at + LINEUP_LATE || team.thrown.has(i)) continue;
      const d = flat(l.from, me.origin);
      if (d >= bestD) continue;
      if (going && d + flat(l.from, going) - flat(me.origin, going) > DETOUR) continue;
      [best, bestD] = [i, d];
    }
    if (best < 0) return null;
    // Taken now, thrown or not: one bot of a team for one lineup of a round.
    team.thrown.add(best);
    const t = throwOfLineup(brain, best);
    if (!t || !reaches(brain.nav, me.origin, t.stand)) return null;
    const key = WEAPON_OF[list[best].kind];
    on = s.lineup = { kind: list[best].kind, key, ...t, since: time, atPlace: null, inHand: null, pressAt: null, count: own.weapons[key].count ?? 1, by: bot.id };
  }
  return { kind: 'goto', task: 'lineup', point: on.stand, lineup: on };
}

/**
 * At the lineup's place: the grenade comes out, the view is set, the pin is pulled and let go. The game throws on
 * the first tick with the key up, half a second after the pin. True while the throw holds the bot's keys.
 */
export function lineupThrow(c, cmd) {
  const { me, s, time, dt } = c;
  const on = s.lineup;
  if (!on) return false;
  if (flat(on.stand, me.origin) > AT_PLACE || abs(on.stand[2] - me.origin[2]) > 40) return false;
  on.atPlace ??= time;
  cmd.forward = 0;
  cmd.side = 0;
  cmd.jump = false;
  cmd.walk = false;
  if (me.weapon !== on.key) cmd.weapon = on.key;
  // The view goes to the throw's own, a set angle held to the end: the game throws along the view of that tick.
  const dy = turn(on.yaw - me.yaw);
  const dp = on.pitch - me.pitch;
  const off = hypot(dy, dp);
  const most = SET_SPEED * dt;
  const k = off > most ? most / off : 1;
  cmd.yaw = turn(me.yaw + dy * k);
  cmd.pitch = me.pitch + dp * k;
  // No throw onto the own team: the lineup is given up (the players threw it for a team that stood elsewhere).
  if (on.pressAt === null && on.kind !== 'smoke') {
    const near = on.kind === 'he' ? HE_NEAR_MATE : FLASH_NEAR_MATE;
    if (c.mates.some((p) => p.alive && p.id !== me.id && hypot(p.origin[0] - on.target[0], p.origin[1] - on.target[1], p.origin[2] - on.target[2]) < near)) {
      s.lineup = null;
      return false;
    }
  }
  if (me.weapon !== on.key) {
    on.inHand = null;
    return true;
  }
  on.inHand ??= time;
  const still = hypot(me.velocity[0], me.velocity[1]) < STILL;
  if (on.pressAt === null && still && off < ON_VIEW && time - on.inHand >= DRAW) on.pressAt = time;
  if (on.pressAt !== null && time - on.pressAt < PRESS) cmd.attack = true;
  return true;
}

/** The share of a list of lineups that this brain can throw from a stand, for a tool or a test: {all, solved, miss}. */
export function lineupsSolved(brain) {
  const list = brain.map.lineups ?? [];
  const misses = [];
  for (let i = 0; i < list.length; i++) {
    const t = throwOfLineup(brain, i);
    if (t) misses.push(t.miss);
  }
  misses.sort((a, b) => a - b);
  return { all: list.length, solved: misses.length, miss: misses.length ? misses[misses.length >> 1] : null };
}

/**
 * The flashbang of the team that this bot must not look at: its place, when the bot's eye sees that place within
 * FLASH_REACH and it has not gone off yet; else null. A team calls its flashbangs.
 */
export function flashToAvoid(c, eye) {
  const { team, time, brain } = c;
  const list = team.flashes;
  if (!list.length) return null;
  for (let i = list.length - 1; i >= 0; i--) if (time > list[i].until) list.splice(i, 1);
  for (const f of list) {
    if (hypot(f.point[0] - eye[0], f.point[1] - eye[1], f.point[2] - eye[2]) > FLASH_REACH) continue;
    if (brain.ports.traceLine(eye, f.point) >= 1) return f.point;
  }
  return null;
}
