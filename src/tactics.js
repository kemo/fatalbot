// What a bot does now: the bomb first, then an enemy that it knows of, then its part of the team's plan. A goal is
// {kind: 'goto' | 'hold' | 'plant' | 'defuse', task, point, look, walk, duck, rest, near}. Ported from csbih-player
// (bot.js decide, tactics.js), with the bomb as the senses give it (senses.js bombFor): a CT that does not know
// where the bomb lies looks for it.

import { abs, distance, eyeOf, flat, hypot, toward } from './geometry.js';
import { bombFor, nearestMate } from './senses.js';
import { findPath, nearestNode, nodePoint, reaches } from './nav.js';
import { approachPoint } from './watch.js';
import { placeAt, placesOf } from './places.js';
import { pointKey } from './walk.js';
import { choosePost, inBombSite, siteMid, touches } from './sites.js';

// A defuser stops this near the bomb, from its body: the game takes the use key 64 from the player.
const DEFUSE_NEAR = 56;
// A planted bomb's guards stand this far from it.
const GUARD = 320;
// The defuse's seconds with a margin to walk in and start; the way is longer than the straight line by this much.
const DEFUSE_KIT = 5.5;
const DEFUSE_BARE = 10.5;
const PATH_STRETCH = 1.3;
const RUN_SPEED = 240;
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
const WAIT_MIN = 10;
const WAIT_MAX = 25;
const SEEK_SECONDS = 25;
const SEEK_NEAR = 128;
const STILL_RANGE = 96;
const SEEK_TRIES = 12;

const over = (p) => [p[0], p[1], p[2] + 36];
const eyeAt = (p) => [p[0], p[1], p[2] + EYE];

/** 0 to 1: how much this player goes after a fight. */
export function will(skill) {
  return Math.max(0.1, Math.min(0.95, (skill.aggression / AGGRESSION_MID) * 0.5));
}

/** What the bot does now. */
export function decide(c) {
  const { me, team, brain } = c;
  const { map } = brain;
  const bomb = bombFor(c);
  c.post = null;
  if (bomb?.state === 'planted') return me.team === 'CT' ? retake(c, bomb) : afterPlant(c, bomb);
  if (bomb?.state === 'carried' && bomb.mine) {
    // The carrier plants in the site of the team's plan; in another site only when the plan has none.
    const site = team.plan?.site ?? null;
    if (inBombSite(map, me.origin) && (site === null || touches(map.bombSites[site], me.origin))) return { kind: 'plant' };
    const at = site !== null ? siteSpot(c, site) : null;
    return { kind: 'goto', task: 'carry', point: at ?? nearestSite(map, me.origin) };
  }
  if (bomb?.state === 'dropped' && me.team === 'T' && nearestMate(c.mates, bomb.point) === me) return { kind: 'goto', task: 'fetch', point: over(bomb.point) };
  c.post = postOf(c);
  // An enemy known: hunt it, wait for it or fall back. Else a look around when nothing happens. Else the plan.
  return contactTask(c) ?? seek(c) ?? objective(c);
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
  const own = plan.posts.get(bot.id) ?? null;
  if (!plan.rotate || !own || own.site === plan.rotate.site) return own;
  if (s.rotate?.at !== plan.rotate.at) {
    const post = choosePost(brain, plan.rotate.site, team.takenBy('post', bot.id), random());
    s.rotate = { at: plan.rotate.at, post };
    team.take('post', bot.id, post?.point ?? null);
  }
  return s.rotate.post ?? own;
}

/** The bot's part of the team's plan when nothing else asks for it: its place, held. */
function objective(c) {
  const { me, team, time } = c;
  const plan = team.plan;
  if (!plan) return { kind: 'hold', point: null };
  if (me.team === 'CT') {
    const post = c.post;
    if (!post?.point) return { kind: 'hold', point: null };
    // At the post the view rests on the way in that it watches; the walk there looks along its own way.
    const there = flat(post.point, me.origin) < 40;
    const look = there && post.watch ? toward(eyeAt(post.point), eyeAt(post.watch)) : null;
    return { kind: 'hold', task: plan.rotate && post.site === plan.rotate.site && plan.posts.get(c.bot.id)?.site !== post.site ? 'rotate' : 'site', point: post.point, look, rest: there };
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
  const post = postPlant(c, bomb);
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
  // An anchor waits at its post of this moment: a rotation moves it while it watches.
  if (task.kind === 'ambush') return { kind: 'hold', task: 'ambush', point: task.anchor ? c.post?.point ?? null : null, look };
  if (task.kind === 'cover') return { kind: 'hold', task: 'cover', point: task.point, look: flat(task.point, o) < 32 ? look : null };
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
export function forgetGoal(c) {
  const { s, team, bot } = c;
  s.lastSeen = null;
  s.siteSpot = null;
  s.task = null;
  s.seek = null;
  s.post = null;
  s.flee = null;
  team.take('post', bot.id, null);
}
