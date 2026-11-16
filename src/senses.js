// What a bot sees and hears. This is the only module that reads the raw state of an enemy from a frame (AGENTS.md,
// "Fair play"): every other module reads the percepts that it leaves in the bot's state, and what the team knows.
// The rules of sight and hearing are ported from csbih-player (bot.js look and hear, senses.js noiseOf): the view
// field, the line to the head or the chest, the smoke, the time to notice, the earshot of each sound.

import { abs, eyeOf, hypot, min, toward, turn } from './geometry.js';
import { ENGAGE, ENGAGE_DEFAULT, bestGun } from './weapons.js';
import { placeAt } from './places.js';

// What each sound carries (units). A step at a full run fades out at about 1250 (YaPB hears 1280); a shot carries
// much further; a silencer and a reload do not.
const STEP_EARSHOT = 1100;
const STEP_SPEED = 150;
const FULL_RUN = 250;
const SHOT_EARSHOT = 2000;
const SILENCED_EARSHOT = 500;
const SHOT_FRESH = 0.5;
const RELOAD_EARSHOT = 500;
const RELOAD_SECONDS = 1.5;
const LADDER_EARSHOT = 900;
const BOMB_EARSHOT = 900;
// The C4 beeps: this near, a CT knows where it is without a look.
const BEEP_EARSHOT = 1000;
// A CT sees a bomb on the floor this far away.
const BOMB_SIGHT = 1500;
// A T hears a defuse this far off (the official CS bot).
export const DEFUSE_HEARD = 2000;
// A CT this near the middle of a site that hears no beep knows that no bomb lies there.
const SITE_CHECK = 400;

// Noticing an enemy in sight: at once within NOTICE_SHARP degrees of the crosshair, then NOTICE_PER_DEGREE more a
// degree, NOTICE_FAR more for each 1000 units past NOTICE_NEAR; each exposure draws its own factor.
const NOTICE_SHARP = 10;
const NOTICE_PER_DEGREE = 0.02;
const NOTICE_NEAR = 800;
const NOTICE_FAR = 0.4;
// How long a sound holds the bot's attention (watch.js noiseAim); the error of where it seems to come from, a part
// of the distance.
const NOISE_KEEP = 1.5;
const NOISE_ERROR = 0.08;
// A shot further away than this is somebody else's fight: it brings the gun out, and no turn of the head.
const NOISE_TURN_SHOT = 1200;
// A line of sight passes a smoke cloud only while less than this part of its radius is in smoke.
const SMOKE_SEE_THROUGH = 0.7;

/** The players of a frame by id and by team: {byId, T: {players, alive}, CT: {players, alive}}. */
export function census(frame) {
  const out = { byId: new Map(), T: { players: [], alive: 0 }, CT: { players: [], alive: 0 } };
  for (const p of frame.players) {
    out.byId.set(p.id, p);
    const side = out[p.team];
    if (!side) continue;
    side.players.push(p);
    if (p.alive) side.alive++;
  }
  return out;
}

/**
 * The sounds of a frame's events that every player in earshot hears, kept on the brain: who fired and who reloads.
 * Also the facts that the game tells a whole team: a kill (the feed), a plant (the call to everybody), the bomb to
 * the Ts (their radar).
 */
export function listen(brain, frame) {
  const { time } = frame;
  const { nav, map, teams } = brain;
  for (const e of frame.events) {
    if (e.type === 'shot') brain.shots.set(e.player, { at: time, silenced: Boolean(e.silenced) });
    else if (e.type === 'reload') brain.reloads.set(e.player, time);
    else if (e.type === 'kill') {
      const victim = brain.census.byId.get(e.victim);
      if (!victim) continue;
      const own = teams[victim.team];
      const other = teams[victim.team === 'T' ? 'CT' : 'T'];
      for (const team of [own, other]) if (team) team.firstKill ??= time;
      own?.died(placeAt(nav, map, victim.origin), time);
      own?.free(e.victim);
      other?.lost(e.victim);
      // The victim saw who killed it, and says so.
      const killer = brain.census.byId.get(e.killer);
      if (killer && killer.alive && killer.team !== victim.team) own?.saw(killer.id, killer.origin, placeAt(nav, map, killer.origin), time);
    } else if (e.type === 'planted') {
      teams.T.bomb = { state: 'planted', point: [...e.at], site: siteOf(map, e.at), time };
      // The CTs hear that it is planted, not where.
      teams.CT.bomb = { state: 'planted', point: null, site: null, time };
      teams.CT.noBomb.clear();
    } else if (e.type === 'dropped') teams.T.bomb = { state: 'dropped', point: [...e.at], site: null, time };
    else if (e.type === 'picked') teams.T.bomb = { state: 'carried', point: null, site: null, time };
  }
}

/** The index of the bomb site that holds a point, else of the nearest one; null on a map with none. */
export function siteOf(map, point) {
  let best = null;
  let bestD = Infinity;
  map.bombSites.forEach((s, k) => {
    const d = hypot((s.mins[0] + s.maxs[0]) / 2 - point[0], (s.mins[1] + s.maxs[1]) / 2 - point[1]);
    if (d < bestD) [best, bestD] = [k, d];
  });
  return best;
}

/** The loudest sound that a player makes now: {radius, kind}, or null. */
function noiseOf(c, other) {
  const { time, brain, frame } = c;
  const v = other.velocity;
  let radius = 0;
  let kind = null;
  const louder = (r, k) => {
    if (r > radius) [radius, kind] = [r, k];
  };
  const speed = hypot(v[0], v[1]);
  if (other.onGround && !other.ducked && speed > STEP_SPEED) louder(STEP_EARSHOT * min(1, speed / FULL_RUN), 'step');
  if (other.onLadder && abs(v[2]) > 50) louder(LADDER_EARSHOT, 'step');
  const shot = brain.shots.get(other.id);
  if (shot && time - shot.at < SHOT_FRESH) louder(shot.silenced ? SILENCED_EARSHOT : SHOT_EARSHOT, 'shot');
  const reload = brain.reloads.get(other.id);
  if (reload !== undefined && time - reload < RELOAD_SECONDS) louder(RELOAD_EARSHOT, 'reload');
  if (frame.bomb && (frame.bomb.defuser === other.id || frame.bomb.arming === other.id)) louder(BOMB_EARSHOT, 'bomb');
  return kind ? { radius, kind } : null;
}

/** True when smoke stands between two points: the lengths of the line inside the clouds add up to too much. */
function smoked(smokes, a, b) {
  if (!smokes.length) return false;
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length = hypot(ab[0], ab[1], ab[2]);
  if (length === 0) return false;
  const dir = [ab[0] / length, ab[1] / length, ab[2] / length];
  const dist = (p, q) => hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  let sum = 0;
  let limit = Infinity;
  for (const { origin: o, radius } of smokes) {
    const r2 = radius * radius;
    limit = min(limit, radius * SMOKE_SEE_THROUGH);
    const along = (o[0] - a[0]) * dir[0] + (o[1] - a[1]) * dir[1] + (o[2] - a[2]) * dir[2];
    const close = along < 0 ? a : along >= length ? b : [a[0] + dir[0] * along, a[1] + dir[1] * along, a[2] + dir[2] * along];
    const near2 = dist(close, o) ** 2;
    if (near2 >= r2) continue;
    const half = Math.sqrt(r2 - near2);
    const fromIn = dist(a, o) ** 2 < r2;
    const toIn = dist(b, o) ** 2 < r2;
    if (fromIn && toIn) sum += length;
    else if (fromIn) sum += along > 0 ? half + dist(close, a) : half - dist(close, a);
    else if (toIn) {
      const out = (b[0] - o[0]) * dir[0] + (b[1] - o[1]) * dir[1] + (b[2] - o[2]) * dir[2];
      sum += out > 0 ? half + dist(close, b) : half - dist(close, b);
    } else sum += 2 * half;
  }
  return sum > limit;
}

/** The seconds a bot takes to notice an enemy that came into sight `off` degrees from its crosshair. */
function noticeDelay(off, distance, drawn, random) {
  if (drawn) return 0;
  const base = Math.max(0, off - NOTICE_SHARP) * NOTICE_PER_DEGREE + (Math.max(0, distance - NOTICE_NEAR) / 1000) * NOTICE_FAR;
  return base * random(0.6, 1.4);
}

/** An enemy within earshot: the nearest one holds the bot's attention (`s.noise`). */
function hear(c, other, sound, distance) {
  const { s, skill, time, random } = c;
  s.alertAt = time;
  const n = s.noise;
  const live = n && time - n.at < NOISE_KEEP;
  if (live && n.id !== other.id && n.distance < distance) return;
  const same = live && n.id === other.id;
  // The further off, the likelier it goes past (the official bot's chance); a shot far off never turns the head.
  const attends = sound.kind === 'shot' ? distance < NOISE_TURN_SHOT : random() < 1.25 - distance / sound.radius;
  const spread = distance * NOISE_ERROR;
  const off = same ? n.off : [random.gauss() * spread, random.gauss() * spread];
  const o = other.origin;
  s.noise = {
    id: other.id, at: time, distance, off, point: [o[0] + off[0], o[1] + off[1], o[2]], kind: sound.kind,
    reactAt: same ? n.reactAt : time + skill.reaction * random(0.7, 1.3),
    attends: same ? n.attends || attends : attends,
  };
}

/**
 * One look: the enemies in sight and in earshot, into the bot's state and the team's knowledge.
 * Leaves `s.target` (a copy of the nearest noticed enemy: {id, origin, velocity, eye, ducked}), `s.seenAt`,
 * `s.lastSeen`, `s.noise`, `s.alertAt`, and `s.fresh` when the target is new.
 */
export function look(c) {
  const { me, own, s, skill, time, frame, brain, team, random } = c;
  const { ports, nav, map } = brain;
  // A flashbang's white-out: a blind bot sees nobody.
  if (own.blindUntil > time) return;
  const eye = eyeOf(me);
  const clear = (a, b) => ports.traceLine(a, b) >= 1;
  const reach = ENGAGE[bestGun(own)] ?? ENGAGE_DEFAULT;
  const exposed = (s.exposed ??= new Map());
  const visible = (s.visible ??= new Set());
  visible.clear();
  let best = null;
  let bestD = Infinity;
  for (const other of frame.players) {
    if (!other.alive || other.team === me.team || !brain.teams[other.team]) continue;
    const chest = [other.origin[0], other.origin[1], other.origin[2] + (other.ducked ? 4 : 10)];
    const dir = toward(eye, chest);
    const sound = noiseOf(c, other);
    if (sound && dir.distance <= sound.radius) hear(c, other, sound, dir.distance);
    // A sound this near turns the eyes at once, as a player turns to steps at its back.
    const shot = sound?.kind === 'shot';
    const heard = sound && (sound.kind === 'step' || shot) && dir.distance <= skill.hearing * (shot && sound.radius === SHOT_EARSHOT ? 4 : 1);
    if (abs(turn(dir.yaw - me.yaw)) > skill.fov && !heard) continue;
    // Beyond the reach of its gun a player opens no fight, unless that enemy hit it a moment ago.
    const hitBy = own.hurt?.by === other.id && time - own.hurt.at < 3;
    if (dir.distance > reach && !hitBy) continue;
    if (!clear(eye, eyeOf(other)) && !clear(eye, chest)) continue;
    if (smoked(frame.smokes, eye, chest)) continue;
    visible.add(other.id);
    s.alertAt = time;
    // Seen is not noticed: an enemy near the crosshair at once, one at the edge of the view later.
    let seen = exposed.get(other.id);
    if (!seen) {
      const off = hypot(turn(dir.yaw - me.yaw), dir.pitch - me.pitch);
      const drawn = heard || hitBy || (s.target?.id === other.id && time - s.seenAt < 1);
      seen = { since: time, need: noticeDelay(off, dir.distance, drawn, random) };
      exposed.set(other.id, seen);
    }
    if (time - seen.since < seen.need) continue;
    team.saw(other.id, other.origin, placeAt(nav, map, other.origin), time);
    (s.firstSeen ??= new Map()).has(other.id) || s.firstSeen.set(other.id, time);
    if (dir.distance < bestD) [best, bestD] = [other, dir.distance];
  }
  for (const id of exposed.keys()) if (!visible.has(id)) exposed.delete(id);
  // Hit by an enemy it does not see: the eyes go that way at once.
  const hurt = own.hurt && time - own.hurt.at < 0.5 ? brain.census.byId.get(own.hurt.by) : null;
  if (hurt && hurt.team !== me.team && !visible.has(hurt.id) && (s.noise?.id !== hurt.id || time - s.noise.at > 0.5)) {
    s.noise = { id: hurt.id, at: time, distance: toward(eye, hurt.origin).distance, off: [0, 0], point: [...hurt.origin], kind: 'hit', reactAt: time + skill.reaction * 0.5, attends: true };
    s.alertAt = time;
  }
  if (me.team === 'CT') bombLook(c, eye, clear);
  if (!best) {
    // A look with nobody in it: the bot's place is clear for the team.
    if (c.every(0.5)) team.cleared(placeAt(nav, map, me.origin), time);
    return;
  }
  s.fresh = s.target?.id !== best.id || time - s.seenAt > 1;
  s.target = { id: best.id, origin: [...best.origin], velocity: [...best.velocity], eye: best.eye, ducked: best.ducked };
  s.seenAt = time;
  s.lastSeen = [...best.origin];
  s.lastSeenVel = [...best.velocity];
  s.lastSeenEye = best.eye;
}

/** A CT learns of the bomb by its eyes and ears: where it lies, or that a site holds none. */
function bombLook(c, eye, clear) {
  const { me, skill, frame, team, time, brain } = c;
  const bomb = frame.bomb;
  if (!bomb || (bomb.state !== 'planted' && bomb.state !== 'dropped')) return;
  if (team.bomb?.state === bomb.state && team.bomb.point) return;
  const to = toward(eye, bomb.origin);
  const sees = to.distance < BOMB_SIGHT && abs(turn(to.yaw - me.yaw)) <= skill.fov && clear(eye, [bomb.origin[0], bomb.origin[1], bomb.origin[2] + 4]);
  const hears = bomb.state === 'planted' && to.distance < BEEP_EARSHOT;
  if (sees || hears) {
    team.bomb = { state: bomb.state, point: [...bomb.origin], site: bomb.state === 'planted' ? siteOf(brain.map, bomb.origin) : null, time };
    return;
  }
  if (bomb.state !== 'planted' || team.bomb?.state !== 'planted') return;
  // In a site with no bomb in sight or earshot: not this one (the beep carries over a whole site). With one site
  // left, it is that one.
  brain.map.bombSites.forEach((site, k) => {
    const mid = [(site.mins[0] + site.maxs[0]) / 2, (site.mins[1] + site.maxs[1]) / 2, site.mins[2] + 36];
    if (hypot(mid[0] - me.origin[0], mid[1] - me.origin[1]) < SITE_CHECK && abs(mid[2] - me.origin[2]) < 200) team.noBomb.add(k);
  });
  const open = brain.map.bombSites.map((_, k) => k).filter((k) => !team.noBomb.has(k));
  if (open.length === 1) team.bomb.site = open[0];
}

/**
 * Each tick: the target of the fight follows the enemy while the last look saw it, and ends with its death (the
 * kill feed shows it to every player).
 */
export function track(c) {
  const { s, time, brain } = c;
  if (!s.target) return;
  const p = brain.census.byId.get(s.target.id);
  if (!p || !p.alive) {
    s.target = null;
    s.lastSeen = null;
    return;
  }
  if (time - s.seenAt > c.lookEvery * 1.5) return;
  const t = s.target;
  t.origin[0] = p.origin[0];
  t.origin[1] = p.origin[1];
  t.origin[2] = p.origin[2];
  t.velocity[0] = p.velocity[0];
  t.velocity[1] = p.velocity[1];
  t.velocity[2] = p.velocity[2];
  t.eye = p.eye;
  t.ducked = p.ducked;
}

/**
 * What this bot knows of the bomb: {state, point, site, mine, carrier, explodeAt, defuser, defuseHeard}, or null.
 * A T knows its team's bomb (the radar shows it). A CT knows a plant from the call, and the place only once the
 * team saw or heard it. Every player can count the bomb's seconds from the call.
 */
export function bombFor(c) {
  const { me, frame, team } = c;
  const bomb = frame.bomb;
  if (!bomb) return null;
  if (me.team === 'T') {
    if (bomb.state !== 'carried' && bomb.state !== 'dropped' && bomb.state !== 'planted') return null;
    const near = bomb.origin ? hypot(bomb.origin[0] - me.origin[0], bomb.origin[1] - me.origin[1]) : Infinity;
    return {
      state: bomb.state, point: bomb.origin, site: bomb.state === 'planted' ? team.bomb?.site ?? null : null, mine: bomb.carrier === me.id,
      carrier: bomb.carrier, explodeAt: bomb.explodeAt ?? null, defuser: null, defuseHeard: bomb.defuser !== null && bomb.defuser !== undefined && near < DEFUSE_HEARD,
    };
  }
  const known = team.bomb;
  if (!known || known.state !== bomb.state) return null;
  return {
    state: known.state, point: known.point, site: known.site, mine: false, carrier: null,
    explodeAt: bomb.state === 'planted' ? bomb.explodeAt : null, defuser: bomb.defuser ?? null, defuseHeard: false,
  };
}

/**
 * The bot of this brain that is nearest a point (the Ts see each other and their bomb on the radar). A teammate
 * that the brain does not drive (a person) may never go there, so it does not count.
 */
export function nearestMate(mates, point) {
  let best = null;
  let bestD = Infinity;
  for (const p of mates) {
    if (!p.alive || !p.own) continue;
    const d = hypot(p.origin[0] - point[0], p.origin[1] - point[1]);
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best;
}
