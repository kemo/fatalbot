// Where a bot looks when it does not see an enemy: the place where an enemy comes into sight (the approach points of
// the official CS bot), never a wall. The crosshair waits where the fight starts.

import { PI, cos, eyeOf, hypot, sin, toward, turn } from './geometry.js';
import { findPath, nearestNode, searchFree } from './nav.js';
import { SIGHTING_SECONDS } from './team.js';

// How long a sound holds the bot's attention.
const NOISE_KEEP = 1.5;

// Looked for again when the point moved this far or the bot stepped this far, and at the latest after this long.
// The search of the way is the dear part of a bot's tick on a large level.
const APPROACH_EVERY = 1.5;
const APPROACH_MOVED = 64;
const APPROACH_STEPPED = 48;
const APPROACH_KEPT = 4;
const APPROACH_NODES = 60;
// A point nearer than this is the wall at the bot's own shoulder, no place to watch.
const APPROACH_NEAR = 96;
const STANDING_EYE = 17;
// A view ray shorter than this looks at a wall or the floor at the bot's feet.
const VIEW_OPEN = 100;
// The directions that the open lines try and how far each looks.
const OPEN_TURNS = 16;
const OPEN_REACH = 1500;
// At rest a player looks from one angle to the next this often; the drift of a hand at rest, degrees.
const REST_MIN = 1.5;
const REST_MAX = 4;
const REST_DRIFT = 1;
const REST_MOVED = 64;
// The angles kept for a place, and how far apart they lie.
const KEPT = 3;
const APART = 25;

/**
 * Where an enemy at `point`, out of sight, comes into the bot's view: the furthest point of the way between them
 * that the bot's eye sees. The eye sees the point itself: that point. Null when the graph gives no way.
 */
export function approachPoint(c, eye, point) {
  const { s, time, me, brain } = c;
  const { nav, ports } = brain;
  // The answer holds while neither end moved: a bot that waits at an angle does not search its way again. One
  // answer for each point watched: the noise and the task of one tick ask for two points.
  const key = (Math.round(point[0] / APPROACH_MOVED) * 73856093) ^ (Math.round(point[1] / APPROACH_MOVED) * 19349663) ^ (Math.round(point[2] / APPROACH_MOVED) * 83492791);
  const answers = (s.approach ??= new Map());
  const cached = answers.get(key);
  if (cached && time < cached.until && hypot(cached.from[0] - me.origin[0], cached.from[1] - me.origin[1], cached.from[2] - me.origin[2]) < APPROACH_STEPPED) return cached.aim;
  const at = [point[0], point[1], point[2] + STANDING_EYE];
  const open = ports.traceLine(eye, at) >= 1;
  // After another search of this command: the old answer or the point itself for a tick, and nothing kept.
  if (!open && nav && !searchFree(c)) return cached?.aim ?? at;
  if (answers.size >= APPROACH_KEPT) answers.clear();
  let aim = null;
  if (open) aim = at;
  else if (nav) {
    const from = nearestNode(nav, me.origin, 3, 48);
    const to = nearestNode(nav, point, 4, 96);
    const path = from >= 0 && to >= 0 ? findPath(nav, from, to, 8000) : null;
    if (path) {
      for (let i = Math.min(path.length, APPROACH_NODES) - 1; i >= 0 && !aim; i--) {
        const p = path[i].point;
        if (hypot(p[0] - eye[0], p[1] - eye[1]) < APPROACH_NEAR) continue;
        const q = [p[0], p[1], p[2] + STANDING_EYE];
        if (ports.traceLine(eye, q) >= 1) aim = q;
      }
    }
  }
  answers.set(key, { from: [...me.origin], until: time + APPROACH_EVERY, aim });
  return aim;
}

/** The view toward an enemy heard and not seen, once the bot reacted, or null. */
export function noiseAim(c) {
  const { me, s, time } = c;
  const n = s.noise;
  if (!n || !n.attends || time < n.reactAt || time - n.at > NOISE_KEEP) return null;
  const eye = eyeOf(me);
  return toward(eye, approachPoint(c, eye, n.point) ?? [n.point[0], n.point[1], eye[2]]);
}

/** True when the view (yaw, pitch) runs at least VIEW_OPEN units from the eye. */
export function viewOpen(c, eye, yaw, pitch) {
  const a = (yaw * PI) / 180;
  const e = (pitch * PI) / 180;
  return c.brain.ports.traceLine(eye, [eye[0] + cos(a) * cos(e) * VIEW_OPEN, eye[1] + sin(a) * cos(e) * VIEW_OPEN, eye[2] - sin(e) * VIEW_OPEN]) >= 1;
}

/** The yaws of the longest level lines from the eye, the longest first: [{yaw, pitch, w}], each apart from the others. */
function openLines(c, eye) {
  const lines = [];
  for (let k = 0; k < OPEN_TURNS; k++) {
    const a = (k / OPEN_TURNS) * PI * 2;
    const f = c.brain.ports.traceLine(eye, [eye[0] + cos(a) * OPEN_REACH, eye[1] + sin(a) * OPEN_REACH, eye[2]]);
    lines.push({ yaw: turn((a * 180) / PI), pitch: 0, w: f });
  }
  lines.sort((x, y) => y.w - x.w || x.yaw - y.yaw);
  const kept = [];
  for (const l of lines) {
    if (kept.length === KEPT) break;
    if (kept.some((k) => Math.abs(turn(k.yaw - l.yaw)) < APART)) continue;
    kept.push(l);
  }
  return kept;
}

/**
 * Where the enemy is expected from: the freshest sighting of the team, else the bomb that the enemy must come to,
 * else the middle of the enemy's spawns.
 */
export function threatPoint(c) {
  const { team, time, brain, me } = c;
  const seen = team.enemiesSeen(time, SIGHTING_SECONDS)[0];
  if (seen) return seen.point;
  if (team.bomb?.state === 'planted' && team.bomb.point && me.team === 'CT') return team.bomb.point;
  return brain.spawnMid[me.team === 'T' ? 'CT' : 'T'];
}

/**
 * Where a bot at rest looks: the place where an enemy comes into sight most of the time, the long lines of the
 * place for a moment, never a wall. `base` is a view that the task itself wants (a post's angle); it comes first.
 */
export function restLook(c, base = null) {
  const { s, time, me, random } = c;
  const o = me.origin;
  const r = s.rest;
  if (!r || time >= r.until || hypot(r.at[0] - o[0], r.at[1] - o[1]) > REST_MOVED) {
    const eye = eyeOf(me);
    const list = [];
    if (base && viewOpen(c, eye, base.yaw, base.pitch)) list.push({ yaw: base.yaw, pitch: base.pitch, w: 0, main: true });
    const threat = threatPoint(c);
    const aim = threat ? approachPoint(c, eye, threat) : null;
    if (aim) {
      const v = toward(eye, aim);
      if (!list.some((a) => Math.abs(turn(a.yaw - v.yaw)) < APART)) list.push({ yaw: v.yaw, pitch: v.pitch, w: 0, main: !list.length });
    }
    for (const l of openLines(c, eye)) if (!list.some((a) => Math.abs(turn(a.yaw - l.yaw)) < APART)) list.push(l);
    // The main view takes twice the time of all the others together.
    const others = list.reduce((n, a) => n + (a.main ? 0 : a.w), 0);
    for (const a of list) if (a.main) a.w = Math.max(1, others * 2);
    let view = list[0] ?? { yaw: me.yaw, pitch: 0 };
    let pick = random(0, list.reduce((n, a) => n + a.w, 0));
    for (const a of list) {
      pick -= a.w;
      if (pick <= 0) {
        view = a;
        break;
      }
    }
    s.rest = { until: time + random(REST_MIN, REST_MAX), at: [...o], view };
  }
  const phase = c.bot.index * 37;
  const v = s.rest.view;
  return { yaw: v.yaw + REST_DRIFT * sin(time * 1.3 + phase), pitch: v.pitch + REST_DRIFT * 0.5 * sin(time * 0.9 + phase * 2) };
}
