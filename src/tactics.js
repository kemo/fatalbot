// What a bot does now: the bomb first, then an enemy that it knows of, then its part of the team's plan. A goal is
// {kind: 'goto' | 'hold' | 'plant' | 'defuse', task, point, look, walk, duck, rest, near}. Ported from csbih-player
// (bot.js decide, tactics.js), with the bomb as the senses give it (senses.js bombFor): a CT that does not know
// where the bomb lies looks for it.

import { abs, clamp, distance, exp, eyeOf, flat, hypot, toward } from './geometry.js';
import { bombFor, nearestMate } from './senses.js';
import { findPath, nearestNode, nodePoint, reaches } from './nav.js';
import { approachPoint } from './watch.js';
import { placeAt, placesOf } from './places.js';
import { pointKey } from './walk.js';
import { choosePost, inBombSite, postSpots, siteMid, spotsAbout, stageSpots, touches } from './sites.js';
import { lineupGoal } from './grenades.js';
import { routeGaveUp, routeGoal, routeHere } from './route.js';

// A defuser stops this near the bomb, from its body: the game takes the use key 64 from the player.
const DEFUSE_NEAR = 56;
// A planted bomb's guards stand this far from it.
const GUARD = 320;
// The defuse's seconds with a margin to walk in and start; the way is longer than the straight line by this much.
const DEFUSE_KIT = 5.5;
const DEFUSE_BARE = 10.5;
const PATH_STRETCH = 1.3;
const RUN_SPEED = 240;
// A place of a formation that a teammate stands on: this near it is there.
const NEAR_ENOUGH = 160;
// A T of a plan goes at the latest with this much of the round clock left over its way to the site (the plant and
// the fight for it).
const CLOCK_MARGIN = 30;
// The players of a team leave their places within this many seconds of each other.
const GO_LAG = 2;
// The wait of the Ts ends with the first kill of the round: each goes this many seconds after it.
const KILL_LAG = [2, 8];
// With no defuse a T leaves the blast with this many seconds left, from within this range (YaPB).
const T_LEAVES = 13;
const T_LEAVES_RANGE = 964;
// A place out of the blast is this far from the bomb, or as far as the map allows.
const FLEE_DISTANCE = 1500;
const FLEE_TRIES = 200;
// After a plant: the CT's way in is the point of its path this far from the bomb; a T holds a place between
// POST_NEAR and POST_FAR from the bomb, sees the bomb and that point, and looks at the point.
const ENTRY_DISTANCE = 550;
const POST_NEAR = 200;
const POST_FAR = 800;
const POST_EVERY = 2;
const POST_TRIES = 80;
const EYE = 17;

// A sound or a sight still counts as a contact for this long; a teammate's call within this range and age.
const CONTACT_SECONDS = 6;
const CALL_RANGE = 1500;
const CALL_SECONDS = 5;
const IN_SIGHT = 0.3;
// The share of pushes of a middling player of the demos: it maps to a will of 0.5.
const AGGRESSION_MID = 0.2;
const HURT = 35;
// A chance of a third to wait for the enemy instead of going after it (the official CS bot).
const AMBUSH = 1 / 3;
const NEAR_POINT = 120;
const SNEAK = 700;
const COVER_REACH = 800;
const COVER_NEAR = 96;
const COVER_TRIES = 60;
// With nothing known a bot waits at its place this long before it goes to look; a place is sought for at most SEEK_SECONDS.
// The carrier plants once no enemy was seen or heard within PLANT_RANGE of it for PLANT_QUIET seconds, and at
// once with less than PLANT_CLOCK seconds of the round left.
const PLANT_QUIET = 3;
const PLANT_RANGE = 1000;
const PLANT_CLOCK = 40;
const WAIT_MIN = 10;
const WAIT_MAX = 25;
const SEEK_SECONDS = 25;
const SEEK_NEAR = 128;
const STILL_RANGE = 96;
const SEEK_TRIES = 12;
// A player that holds a place stands this long on one floor of it, then steps to another: the middle (s) by side,
// the spread of its logarithm, and the ends of the draw. In the quiet part of a round the recorded CTs stand in
// 33% of the steps of 2 s and the Ts in 16%; a stand lasts 2 s in the middle and 14 s at the ninth tenth
// (docs/measures/2026-11-11-economy.md).
const STAND_MIDDLE = { CT: 1.2, T: 1.2 };
const STAND_SPREAD = 1.1;
const STAND_ENDS = [0.5, 30];
// With an enemy seen this fresh a player keeps its floor: its feet are the fight's. A shot that it hears does not
// hold it: once a round is hot the recorded players stand less, not more (18% of the steps of 2 s after the first
// death, 33% before it).
const SHIFT_CALM = 1.5;
// A player that waits for an enemy plants its feet when that enemy is about to come: a sign of it (a sight, a
// sound) in the last THREAT_FRESH seconds, within THREAT_NEAR units. With steps at every moment of a wait,
// fatalbot lost 19 of 474 rounds in the places of recorded CTs (docs/measures/2026-11-11-hold-and-route.md).
const THREAT_FRESH = 2;
const THREAT_NEAR = 700;
// Free time: a run to a floor this far off (units), for this long at most (s).
const FREE_REACH = [250, 800];
const FREE_SECONDS = [2, 6];
const FREE_TRIES = 8;

const over = (p) => [p[0], p[1], p[2] + 36];
const eyeAt = (p) => [p[0], p[1], p[2] + EYE];

/** 0 to 1: how much this player goes after a fight. */
export function will(skill) {
  return Math.max(0.1, Math.min(0.95, (skill.aggression / AGGRESSION_MID) * 0.5));
}

/**
 * True when the carrier in the site plants now: no enemy was seen or heard near it for PLANT_QUIET seconds, by
 * itself or by its team. Alone, or with little of the round's clock left, it plants at once. The players of the
 * recorded matches plant about 7 s after their first T stands in the site, with most of the CTs dead
 * (docs/measures/2026-11-11-night.md).
 */
function quietToPlant(c) {
  const { me, s, team, time, frame } = c;
  if (c.mateCount <= 1 || frame.round.timeLeft < PLANT_CLOCK) return true;
  if (time - s.seenAt < PLANT_QUIET || (s.noise && time - s.noise.at < PLANT_QUIET && flat(s.noise.point, me.origin) < PLANT_RANGE)) return false;
  return !team.enemiesSeen(time, PLANT_QUIET).some((g) => flat(g.point, me.origin) < PLANT_RANGE);
}

/**
 * Free time: the round is the team's (no enemy is left alive, or its clock ran out) and nothing waits for this
 * player. It runs about, with the knife out and in hops (brain.js, moves.js hop), as players do: the recorded CTs
 * that are left after the last T died stand in 31% of the steps of 2 s (about the one at the bomb) and run in 36%.
 */
function freeGoal(c) {
  const { me, s, time, random, brain } = c;
  const { nav } = brain;
  const o = me.origin;
  if (!s.free || time >= s.free.until || (s.free.point && flat(s.free.point, o) < 48)) {
    const near = [];
    for (let i = 0; i < nav.count; i++) {
      const d = hypot(nav.xyz[i * 3] - o[0], nav.xyz[i * 3 + 1] - o[1]);
      if (d >= FREE_REACH[0] && d <= FREE_REACH[1] && abs(nav.xyz[i * 3 + 2] - o[2]) < 100) near.push(i);
    }
    let point = null;
    for (let t = 0; t < FREE_TRIES && near.length && !point; t++) {
      const p = nodePoint(nav, near.splice(Math.floor(random() * near.length), 1)[0]);
      if (reaches(nav, o, p)) point = p;
    }
    s.free = { point, until: time + random(FREE_SECONDS[0], FREE_SECONDS[1]) };
  }
  return s.free.point ? { kind: 'goto', task: 'free', point: s.free.point } : { kind: 'hold', task: 'free', point: null };
}

/** True when the round is decided for the bot's team and the bomb asks for nothing: no enemy is left alive, or the clock ran out. */
function roundDone(c, bomb) {
  if (bomb?.state === 'planted') return false;
  return (c.team.enemiesLived && !c.enemyCount) || c.frame.round.phase === 'over';
}

/** What the bot does now. */
export function decide(c) {
  const { me, team, brain } = c;
  const { map } = brain;
  const bomb = bombFor(c);
  c.post = null;
  if (roundDone(c, bomb)) return freeGoal(c);
  // A bot that plays on for a recorded player keeps that player's route while its own round is the recording's
  // (route.js). The bomb comes first, as for every bot.
  const route = routeGoal(c, bomb);
  if (bomb?.state === 'planted') return route ?? (me.team === 'CT' ? retake(c, bomb) : afterPlant(c, bomb));
  // The Ts' plan may hold them at their places until its second: the carrier waits with the team.
  const stage = me.team === 'T' && !route ? stageGoal(c) : null;
  if (route && bomb?.state === 'carried' && bomb.mine) {
    // The player planted where its route holds the C4 in a site.
    return routeHere(c)?.weapon === 'c4' && inBombSite(map, me.origin) ? { kind: 'plant' } : route;
  }
  if (bomb?.state === 'carried' && bomb.mine) {
    // The carrier plants in the site of the team's plan; in another site only when the plan has none.
    const site = team.plan?.site ?? null;
    if (inBombSite(map, me.origin) && (site === null || touches(map.bombSites[site], me.origin))) {
      // The plant comes once the site is quiet: until then the carrier fights for it with its team.
      if (quietToPlant(c)) return { kind: 'plant' };
      return contactTask(c) ?? { kind: 'hold', task: 'carry', point: null };
    }
    if (stage) return stage;
    const at = site !== null ? siteSpot(c, site) : null;
    return { kind: 'goto', task: 'carry', point: at ?? nearestSite(map, me.origin) };
  }
  if (bomb?.state === 'dropped' && me.team === 'T' && nearestMate(c.mates, bomb.point) === me) return { kind: 'goto', task: 'fetch', point: over(bomb.point) };
  if (route) return route;
  c.post = postOf(c);
  // A grenade of the map that is due about now and near: there, and the throw.
  const lineup = lineupGoal(c);
  if (lineup) return lineup;
  // An enemy known: hunt it, wait for it or fall back. Else the place of the plan before its second. Else a look
  // around when nothing happens. Else the plan.
  return contactTask(c) ?? stage ?? seek(c) ?? objective(c);
}

/**
 * The stand of a player who holds the place `base`: {at (the floor that it stands on now: `base` or one of
 * `spots` about it), settled (it stood at the place once)}. It stands a drawn time, then takes another floor that
 * no teammate stands on. An enemy in its sight keeps it where it is, and so does `steady`.
 */
function restless(c, base, spots, steady = false) {
  const { me, s, time, random } = c;
  // Each place has its own stand: a T that waits for an enemy still has its place of the plan, and both ask.
  const key = pointKey(base);
  const shifts = (s.shifts ??= new Map());
  let shift = shifts.get(key);
  if (!shift) shifts.set(key, (shift = { at: base, until: null, settled: false }));
  if (!spots.length) return shift;
  const free = (p) => !c.mates.some((m) => m.id !== me.id && m.alive && flat(m.origin, p) < 40);
  const there = flat(shift.at, me.origin) < 24;
  // From its first stand on, the bot walks between the floors; the run to the place is a run.
  if (there) shift.settled = true;
  if (there) shift.until ??= time + clamp(STAND_MIDDLE[me.team] * exp(random.gauss() * STAND_SPREAD), STAND_ENDS[0], STAND_ENDS[1]);
  const calm = !steady && time - s.seenAt > SHIFT_CALM;
  if ((there && calm && time >= shift.until) || (!there && !free(shift.at))) {
    const others = [base, ...spots].filter((p) => flat(p, shift.at) > 8 && free(p));
    if (others.length) {
      shift.at = others[Math.floor(random() * others.length)];
      shift.until = null;
    }
  }
  return shift;
}

/**
 * A hold that steps: the goal of a player that holds `base` with the view `look` (or none), on the floor of its
 * stand of this moment. `spots` are the floors about the place that serve it as well. Once it stood there it
 * walks between them; the way to the place is a run.
 */
function steppingHold(c, task, base, spots, look, { steady = false, ...extra } = {}) {
  const stand = restless(c, base, spots, steady);
  const there = flat(stand.at, c.me.origin) < 40;
  const settled = there || stand.settled;
  return { kind: 'hold', task, point: stand.at, look: settled ? look : null, rest: there && !look, walk: settled && !there, ...extra };
}

function nearestSite(map, o) {
  let best = null;
  for (const site of map.bombSites) {
    const m = siteMid(site);
    if (!best || flat(m, o) < flat(best, o)) best = m;
  }
  return best ?? [...o];
}

/**
 * The post of a defender now: its own of the plan, or one at the site that the team rotates to. Null for an attacker
 * and for a map with no post.
 */
function postOf(c) {
  const { me, bot, s, team, random, brain } = c;
  const plan = team.plan;
  if (me.team !== 'CT' || !plan?.posts) return null;
  let own = plan.posts.get(bot.id) ?? null;
  // A bot that came into the round after its start (it took over for a player) has no post of the plan. It takes
  // one now, at the site nearer to it.
  if (!own && brain.map.bombSites.length) {
    let site = 0;
    brain.map.bombSites.forEach((b, k) => {
      if (flat(siteMid(b), me.origin) < flat(siteMid(brain.map.bombSites[site]), me.origin)) site = k;
    });
    own = choosePost(brain, site, team.takenBy('post', bot.id), random()) ?? { point: null, watch: null, site };
    plan.posts.set(bot.id, own);
    if (own.point) team.take('post', bot.id, own.point);
  }
  // The whole team rotates, or this bot goes over on the first sign of an attack (plan.js lean).
  const to = plan.rotate ?? plan.leans?.get(bot.id) ?? null;
  if (!to || !own || own.site === to.site) {
    if (s.rotate && own?.point) team.take('post', bot.id, own.point);
    s.rotate = null;
    return own;
  }
  if (s.rotate?.at !== to.at || s.rotate.site !== to.site) {
    const post = choosePost(brain, to.site, team.takenBy('post', bot.id), random());
    s.rotate = { at: to.at, site: to.site, post };
    team.take('post', bot.id, post?.point ?? null);
  }
  return s.rotate.post ?? own;
}

/**
 * A T of a mined plan before its second: its place of the formation, held. The bot goes when its way to the site
 * takes as long as is left to the plan's second (so the team comes into the site together, from where each stood),
 * or when the round clock leaves no more time. Null once it goes, and for a plan with no places.
 */
function stageGoal(c) {
  const { me, bot, s, team, time, brain, frame } = c;
  const plan = team.plan;
  const spot = plan?.spots?.get(bot.id);
  if (!spot || plan.te === null || s.go || s.liveAt === undefined) return null;
  if (s.eta === undefined) {
    const { nav } = brain;
    const a = nearestNode(nav, spot, 3, 64);
    const b = nearestNode(nav, siteMid(brain.map.bombSites[plan.site]), 6, 200);
    const path = a >= 0 && b >= 0 ? findPath(nav, a, b, 60000) : null;
    let length = flat(spot, siteMid(brain.map.bombSites[plan.site])) * PATH_STRETCH;
    if (path) {
      length = 0;
      for (let i = 1; i < path.length; i++) length += distance(path[i].point, path[i - 1].point);
    }
    s.eta = length / RUN_SPEED;
  }
  // A team does not go in on one tick: each player a moment after the call, the first at once.
  s.goLag ??= c.random(0, GO_LAG);
  s.killLag ??= c.random(KILL_LAG[0], KILL_LAG[1]);
  const fought = team.firstKill !== null && time >= team.firstKill + s.killLag;
  if (fought || time - s.liveAt >= plan.te - s.eta + s.goLag || frame.round.timeLeft < s.eta + CLOCK_MARGIN) {
    s.go = true;
    return null;
  }
  // A place of the level has floors about it that are as hidden: the bot steps between them while it waits.
  const spots = stageSpots(brain, plan.site, spot);
  if (spots.length) {
    const stand = restless(c, spot, spots);
    const there = flat(stand.at, me.origin) < 40;
    return { kind: 'hold', task: 'stage', point: stand.at, look: null, rest: there, walk: !there && stand.settled };
  }
  // A teammate on the bot's place: near enough is there.
  const taken = flat(spot, me.origin) < NEAR_ENOUGH && c.mates.some((p) => p.id !== me.id && p.alive && flat(p.origin, spot) < 48);
  // At its place a T looks where the player of the formation looked (the fourth number of the place).
  const there = taken || flat(spot, me.origin) < 40;
  return { kind: 'hold', task: 'stage', point: taken ? null : spot, look: there && spot.length > 3 ? { yaw: spot[3], pitch: 0 } : null, rest: there };
}

/** The bot's part of the team's plan when nothing else asks for it: its place, held. */
function objective(c) {
  const { me, team, time } = c;
  const plan = team.plan;
  if (!plan) return { kind: 'hold', point: null };
  if (me.team === 'CT') {
    const post = c.post;
    if (!post?.point) return { kind: 'hold', point: null };
    // A post of the level has floors about it that watch the same way in: the bot steps between them.
    const stand = restless(c, post.point, postSpots(c.brain, post.site, post.point));
    const at = stand.at;
    const there = flat(at, me.origin) < 40;
    // Once at the post the view stays on the way in that it watches, also on a step to the next floor; the run
    // to the post looks along its own way. A post of a mined setup has the view of the player who stood there.
    const settled = there || stand.settled;
    const look = !settled ? null : post.yaw !== null && post.yaw !== undefined ? { yaw: post.yaw, pitch: 0 } : post.watch ? toward(eyeOf(me), eyeAt(post.watch)) : null;
    return { kind: 'hold', task: plan.posts.get(c.bot.id)?.site !== post.site ? 'rotate' : 'site', point: at, look, rest: there, walk: settled && !there };
  }
  const at = time >= plan.goAt ? siteSpot(c, plan.site) : null;
  if (at) return { kind: 'hold', task: 'site', point: at, look: null };
  return { kind: 'hold', point: null };
}

/** A CT after the plant: to the bomb and defuse it, guard the defuser, look for the bomb, or run when it is too late. */
function retake(c, bomb) {
  const { me, own, time, brain } = c;
  const o = me.origin;
  const left = (bomb.explodeAt ?? Infinity) - time;
  // With no T left alive and a teammate at the bomb, the others have nobody to guard it from: their time is free.
  const alone = c.team.enemiesLived && !c.enemyCount;
  if (alone && bomb.defuser !== null && bomb.defuser !== me.id) return freeGoal(c);
  if (!bomb.point) {
    // Not seen yet: to the site that the team knows, else the nearest one that nobody found empty.
    const open = brain.map.bombSites.map((site, k) => ({ k, mid: siteMid(site) })).filter(({ k }) => !c.team.noBomb.has(k));
    const pick = bomb.site !== null ? open.find((x) => x.k === bomb.site) : open.sort((a, b) => flat(a.mid, o) - flat(b.mid, o) || a.k - b.k)[0];
    // To a floor inside the site: its middle can lie in a crate.
    const at = pick ? siteSpot(c, pick.k) ?? pick.mid : null;
    return at ? { kind: 'goto', task: 'search', point: at } : { kind: 'hold', point: null };
  }
  const toBomb = flat(o, bomb.point);
  const mine = bomb.defuser === me.id;
  const need = (own.kit ? DEFUSE_KIT : DEFUSE_BARE) + (mine ? -Infinity : (toBomb * PATH_STRETCH) / RUN_SPEED);
  if (!mine && left < need) return { kind: 'goto', task: 'escape', point: fleeSpot(c, bomb) };
  if (bomb.defuser !== null && !mine && toBomb < GUARD * 2) {
    const at = guardSpot(c, bomb.point);
    return { kind: 'hold', task: 'guard', point: at, look: flat(at, o) < 32 ? { yaw: me.yaw, pitch: 0 } : null, rest: true };
  }
  const near = distance(o, bomb.point) <= DEFUSE_NEAR;
  return { kind: 'defuse', point: near ? null : over(bomb.point), near, look: near ? toward(eyeOf(me), bomb.point) : null };
}

/** A T after the plant: to a CT that defuses, away from the blast at the end, else a post that sees the bomb. */
function afterPlant(c, bomb) {
  const { me, s, time } = c;
  const o = me.origin;
  const left = (bomb.explodeAt ?? Infinity) - time;
  const toBomb = flat(o, bomb.point);
  // A CT at the bomb is the round: every T goes there.
  if (bomb.defuseHeard) return { kind: 'goto', task: 'stop-defuse', point: over(bomb.point) };
  // Once on the run from this bomb, a T stays on it: out of the range it took a post again and walked back in.
  if (left < T_LEAVES && (toBomb < T_LEAVES_RANGE || s.flee?.key === pointKey(bomb.point))) return { kind: 'goto', task: 'escape', point: fleeSpot(c, bomb) };
  // No CT is left to defuse it: the round is the Ts'.
  if (c.team.enemiesLived && !c.enemyCount) return freeGoal(c);
  const post = postPlant(c, bomb);
  // The floors about the post that see the bomb too: a T that guards its bomb does not stand on one floor.
  if (post.spots === undefined) {
    const { ports } = c.brain;
    const at = [bomb.point[0], bomb.point[1], bomb.point[2] + 8];
    post.spots = spotsAbout(c.brain, post.spot, (p) => ports.traceLine(eyeAt(p), at) >= 1 && flat(p, bomb.point) >= POST_NEAR);
  }
  const on = flat(post.spot, o) < 200 && post.spots.length > 0;
  if (on) return steppingHold(c, 'post', post.spot, post.spots, post.look);
  const there = flat(post.spot, o) < 32;
  return { kind: 'hold', task: 'post', point: post.spot, look: there ? post.look : null, rest: there };
}

/** The nearest floor out of the blast that the graph reaches; chosen once a bomb. */
function fleeSpot(c, bomb) {
  const { me, s, brain } = c;
  const key = pointKey(bomb.point);
  if (s.flee?.key === key) return s.flee.at;
  const { nav } = brain;
  const o = me.origin;
  let best = null;
  let bestD = Infinity;
  const step = Math.max(1, Math.floor(nav.count / FLEE_TRIES));
  for (let i = 0; i < nav.count; i += step) {
    const p = nodePoint(nav, i);
    if (flat(p, bomb.point) < FLEE_DISTANCE) continue;
    const d = flat(p, o);
    if (d < bestD && reaches(nav, o, p)) {
      bestD = d;
      best = p;
    }
  }
  const away = flat(o, bomb.point) || 1;
  const at = best ?? [o[0] + ((o[0] - bomb.point[0]) / away) * FLEE_DISTANCE, o[1] + ((o[1] - bomb.point[1]) / away) * FLEE_DISTANCE, o[2]];
  s.flee = { key, at };
  return at;
}

/** The place of a guard of a planted bomb: GUARD units from it toward the bot, where the graph has a floor. */
function guardSpot(c, bomb) {
  const { me, brain } = c;
  const o = me.origin;
  const d = flat(o, bomb) || 1;
  const k = Math.min(1, GUARD / d);
  const want = [bomb[0] + (o[0] - bomb[0]) * k, bomb[1] + (o[1] - bomb[1]) * k, bomb[2] + 36];
  const n = nearestNode(brain.nav, want, 6);
  return n >= 0 ? nodePoint(brain.nav, n) : want;
}

/**
 * The way a CT comes to the bomb: from where the team last saw a CT, else from the CTs' spawn, the point of its
 * path ENTRY_DISTANCE from the bomb.
 */
function ctEntry(c, bomb) {
  const { team, time, brain } = c;
  const { nav } = brain;
  const from = team.enemiesSeen(time, 20)[0]?.point ?? brain.spawnMid.CT;
  if (!from) return null;
  const a = nearestNode(nav, from, 4, 96);
  const b = nearestNode(nav, bomb, 4, 96);
  const path = a >= 0 && b >= 0 ? findPath(nav, a, b, 20000) : null;
  if (!path) return from;
  for (let i = path.length - 1; i >= 0; i--) if (flat(path[i].point, bomb) >= ENTRY_DISTANCE) return path[i].point;
  return from;
}

/**
 * A T's place after the plant: a floor of the graph near the bomb that sees the bomb (a defuser) and the CT's way in,
 * not on top of the bomb and not where a teammate stands, the nearest such first; the view on the way in.
 */
function postPlant(c, bomb) {
  const { me, bot, s, time, team, brain } = c;
  const { nav, ports } = brain;
  const key = pointKey(bomb.point);
  if (s.post && time < s.post.until && s.post.key === key) return s.post;
  const entry = ctEntry(c, bomb.point);
  const o = me.origin;
  const keep = s.post?.key === key ? s.post.spot : null;
  const taken = team.takenBy('post', bot.id);
  const sees = (a, b) => ports.traceLine(a, b) >= 1;
  const score = (n) => {
    if (!sees(eyeAt(n), [bomb.point[0], bomb.point[1], bomb.point[2] + 8])) return -Infinity;
    let v = -abs(flat(n, bomb.point) - (POST_NEAR + POST_FAR) / 2) / 400;
    if (entry) {
      if (sees(eyeAt(n), eyeAt(entry))) v += 2;
      if (flat(n, entry) < 300) v -= 2;
    }
    for (const t of taken) if (flat(n, t) < 250) v -= 2;
    return v - flat(n, o) / 2000;
  };
  let best = keep ? { spot: keep, score: score(keep) } : null;
  const near = [];
  for (let i = 0; i < nav.count; i++) {
    const d = hypot(nav.xyz[i * 3] - bomb.point[0], nav.xyz[i * 3 + 1] - bomb.point[1]);
    if (d >= POST_NEAR && d <= POST_FAR && abs(nav.xyz[i * 3 + 2] - bomb.point[2]) < 160) near.push(i);
  }
  // An even spread of the candidates, the same on every machine.
  const step = Math.max(1, Math.floor(near.length / POST_TRIES));
  for (let k = 0; k < near.length; k += step) {
    const n = nodePoint(nav, near[k]);
    if (!reaches(nav, o, n)) continue;
    const v = score(n);
    // A new place must be clearly better than the one the bot holds, or it would run between two.
    if (!best || v > best.score + (best.spot === keep ? 0.5 : 0)) best = { spot: n, score: v };
  }
  const spot = best?.spot ?? guardSpot(c, bomb.point);
  team.take('post', bot.id, spot);
  s.post = { key, spot, look: toward(eyeAt(spot), eyeAt(entry ?? bomb.point)), until: time + POST_EVERY };
  return s.post;
}

/** A place of the graph inside a site, one per bot and round, so the team spreads over it. */
export function siteSpot(c, k) {
  const { me, s, brain, frame, random } = c;
  const { nav, map } = brain;
  const site = map.bombSites[k];
  if (!site) return null;
  const key = k * 1000 + frame.round.number;
  if (s.siteSpot?.key === key) return s.siteSpot.at;
  const inside = [];
  for (let i = 0; i < nav.count; i++) {
    const x = nav.xyz[i * 3];
    const y = nav.xyz[i * 3 + 1];
    const z = nav.xyz[i * 3 + 2];
    if (x > site.mins[0] && x < site.maxs[0] && y > site.mins[1] && y < site.maxs[1] && z > site.mins[2] - 36 && z < site.maxs[2] + 72) inside.push(i);
  }
  // One the graph reaches from the bot: a box top in a site can be a floor with no way up to it.
  let at = inside.length ? null : siteMid(site);
  for (let tries = 0; tries < 8 && inside.length && !at; tries++) {
    const pick = nodePoint(nav, inside.splice(Math.floor(random() * inside.length), 1)[0]);
    if (reaches(nav, me.origin, pick)) at = pick;
  }
  s.siteSpot = { key, at };
  return at;
}

/** The freshest enemy that the bot knows of and does not see: {point, at, kind}, or null. */
function contactOf(c) {
  const { me, s, time, team } = c;
  let best = null;
  const n = s.noise;
  if (n?.attends && time - n.at < CONTACT_SECONDS) best = { point: n.point, at: n.at, kind: 'noise' };
  // In sight now it is a fight, no task.
  if (time - s.seenAt < IN_SIGHT) return null;
  if (s.lastSeen && time - s.seenAt < CONTACT_SECONDS && (!best || s.seenAt >= best.at)) best = { point: s.lastSeen, at: s.seenAt, kind: 'seen' };
  if (!best) {
    for (const g of team.enemiesSeen(time, CALL_SECONDS)) {
      if (flat(g.point, me.origin) < CALL_RANGE) {
        best = { point: g.point, at: g.time, kind: 'call' };
        break;
      }
    }
  }
  return best;
}

/** A floor near the bot that the enemy at `threat` does not see, nearer to the bot than to the enemy; or null. */
function coverFrom(c, threat) {
  const { me, brain } = c;
  const { nav, ports } = brain;
  const o = me.origin;
  const from = eyeAt(threat);
  const near = [];
  for (let i = 0; i < nav.count; i++) {
    const dx = nav.xyz[i * 3] - o[0];
    const dy = nav.xyz[i * 3 + 1] - o[1];
    const d = dx * dx + dy * dy;
    if (d >= COVER_NEAR * COVER_NEAR && d <= COVER_REACH * COVER_REACH && abs(nav.xyz[i * 3 + 2] - o[2]) < 96) near.push([d, i]);
  }
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const step = Math.max(1, Math.floor(near.length / COVER_TRIES));
  for (let k = 0; k < near.length; k += step) {
    const p = nodePoint(nav, near[k][1]);
    if (flat(p, threat) < Math.sqrt(near[k][0])) continue;
    if (ports.traceLine(from, eyeAt(p)) >= 1) continue;
    if (reaches(nav, o, p)) return p;
  }
  return null;
}

function chooseTask(c, contact) {
  const { me, s, skill, time, random, brain } = c;
  const o = me.origin;
  const courage = will(skill);
  const friends = c.mateCount - 1;
  const outnumbered = friends < c.enemyCount - 1;
  if (me.health < HURT || (outnumbered && random() > courage)) {
    const spot = coverFrom(c, contact.point);
    if (spot) return { kind: 'cover', point: spot, watch: contact.point, until: time + random(3, 8) };
  }
  // A defender with a post holds it: the enemy comes to the site, and a lone run at it gives the site away. The
  // call of the contact is the team's (plan.js rotates on it).
  if (c.post?.point) return { kind: 'ambush', point: null, anchor: true, watch: contact.point, until: time + random(3, 6) };
  // A call from afar is somebody else's fight as often as not.
  if (contact.kind === 'call' && random() > 0.5) return { kind: 'pass', point: null, until: time + random(2, 5) };
  if (random() < AMBUSH) return { kind: 'ambush', point: null, watch: contact.point, until: time + random(3, 3 + 9 * (1 - courage)) };
  // A place with no way to it: the bot waits for the enemy to come.
  if (!reaches(brain.nav, o, contact.point)) return { kind: 'ambush', point: null, watch: contact.point, until: time + random(3, 8) };
  return { kind: 'hunt', point: [...contact.point], watch: contact.point, walk: flat(contact.point, o) < SNEAK || friends <= 1, until: time + random(8, 14) };
}

/**
 * A contact (an enemy seen, heard or called) starts a task that holds until it ends: hunt it, wait for it at an
 * angle, or fall back to cover. A goal, or null when no contact asks for anything.
 */
function contactTask(c) {
  const { me, s, time } = c;
  const o = me.origin;
  let task = s.task;
  if (task?.kind === 'hunt' && flat(task.point, o) < NEAR_POINT) {
    // Nobody there: this contact is spent.
    s.lastSeen = null;
    s.noise = null;
    task = null;
  }
  if (task && time >= task.until) task = null;
  if (!task) {
    const contact = contactOf(c);
    if (contact) task = chooseTask(c, contact);
  }
  s.task = task ?? null;
  if (!task || task.kind === 'pass') return null;
  const eye = eyeOf(me);
  const aim = approachPoint(c, eye, task.watch);
  const look = aim ? toward(eye, aim) : null;
  // A player that waits for an enemy does not stand on one floor: it steps between the floors about its place,
  // with its view where the enemy comes into sight. With the enemy about to come, it plants its feet.
  const sign = Math.max(s.seenAt, s.noise?.at ?? -Infinity);
  const steady = time - sign < THREAT_FRESH && flat(task.watch, o) < THREAT_NEAR;
  if (task.kind === 'ambush') {
    // An anchor waits at its post of this moment: a rotation moves it while it watches.
    const post = task.anchor ? c.post?.point ?? null : null;
    if (post) return steppingHold(c, 'ambush', post, postSpots(c.brain, c.post.site, post), look, { steady });
    // With no post: about the place where the contact found it.
    task.at ??= [...o];
    task.spots ??= spotsAbout(c.brain, task.at);
    if (flat(task.at, o) < 240) return steppingHold(c, 'ambush', task.at, task.spots, look, { steady });
    return { kind: 'hold', task: 'ambush', point: null, look };
  }
  if (task.kind === 'cover') {
    // About its cover: the floors that the enemy's place does not see.
    if (task.spots === undefined) {
      const { ports } = c.brain;
      const from = eyeAt(task.watch);
      task.spots = spotsAbout(c.brain, task.point, (p) => ports.traceLine(from, eyeAt(p)) < 1);
    }
    if (flat(task.point, o) < 200 && task.spots.length) return steppingHold(c, 'cover', task.point, task.spots, look, { steady });
    return { kind: 'hold', task: 'cover', point: task.point, look: flat(task.point, o) < 32 ? look : null };
  }
  return { kind: 'goto', task: 'hunt', point: task.point, look: look && flat(aim, o) > 96 ? look : null, walk: task.walk };
}

/** The nearest places that nobody of the team has checked lately, the nearest more often: a floor in one, or null. */
function placeToCheck(c) {
  const { me, team, time, random, brain } = c;
  const { nav, map } = brain;
  const { regions } = placesOf(nav, map);
  const here = placeAt(nav, map, me.origin);
  const o = me.origin;
  const open = regions.filter((r) => r.id !== here && !team.isClear(r.id, time)).map((r) => ({ id: r.id, at: r.center, d: flat(r.center, o) })).sort((a, b) => a.d - b.d || a.id - b.id);
  for (let t = 0; t < SEEK_TRIES && open.length; t++) {
    const pick = open.splice(Math.floor(random() ** 2 * Math.min(open.length, 6)), 1)[0];
    const n = nearestNode(nav, pick.at, 8, 200);
    if (n < 0) continue;
    const p = nodePoint(nav, n);
    if (reaches(nav, o, p)) return p;
  }
  return null;
}

/**
 * A bot with nothing to do does not stand for the rest of the round: after a wait it goes to a place of the map that
 * its team has not checked (the official bot's hunt). The Ts must make something happen, the last of a side and the
 * brave ones too; a CT is content to hold while the clock runs for it. A goal, or null.
 */
function seek(c) {
  const { me, s, skill, time, random } = c;
  const o = me.origin;
  if (s.seek && (time >= s.seek.until || flat(s.seek.point, o) < SEEK_NEAR)) s.seek = null;
  if (s.seek) return { kind: 'goto', task: 'seek', point: s.seek.point };
  const friends = c.mateCount - 1;
  if (!c.enemyCount || !(me.team === 'T' || friends === 0 || will(skill) > 0.6)) return null;
  const w = s.waiting;
  if (!w || flat(w.at, o) > STILL_RANGE) {
    s.waiting = { at: [...o], until: time + random(WAIT_MIN, WAIT_MAX) };
    return null;
  }
  if (time < w.until) return null;
  s.waiting = null;
  const point = placeToCheck(c);
  if (!point) return null;
  s.seek = { point, until: time + SEEK_SECONDS };
  return { kind: 'goto', task: 'seek', point };
}

/** What a give-up forgets: every choice that would bring the same goal back. */
export function forgetGoal(c, goal = null) {
  const { s, team, bot, me } = c;
  if (goal?.task === 'route') routeGaveUp(c);
  // A place of the formation that the bot did not get to: it takes the place of the nearest teammate elsewhere.
  const spots = team.plan?.spots;
  const spot = goal?.task === 'stage' ? spots?.get(bot.id) : null;
  if (spot) {
    let next = null;
    for (const p of new Set(spots.values())) if (flat(p, spot) > NEAR_ENOUGH && (!next || flat(p, me.origin) < flat(next, me.origin))) next = p;
    if (next) spots.set(bot.id, next);
    else spots.delete(bot.id);
    s.eta = undefined;
  }
  s.lastSeen = null;
  s.siteSpot = null;
  s.shifts = null;
  s.task = null;
  s.seek = null;
  s.post = null;
  s.flee = null;
  team.take('post', bot.id, null);
}
