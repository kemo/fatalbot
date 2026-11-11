// The plan of a team for a round (spec 01, section 3, the team layer), and its changes on what the team learns.
//
// With the plans of the map (spec 02, map.plans: the strategies that teams played on it, mined from recorded
// matches): the Ts take one of them, stand as that team stood, and go so that the first of them is in the site at
// the plan's second; the CTs take a setup and stand where that team stood. A plan is drawn by how often it was
// played and how often it won.
// Without them: the Ts take one site, wait on their ways to it out of the sight of its posts, and go at a second
// drawn as the players' was; each CT takes a post that watches a way in and that it reaches in time (sites.js).
// In both cases the CTs rotate to a site when the team sees the attack there, and a part of them on its first sign.

import { clamp, exp, flat } from './geometry.js';
import { LADDER, canReach, nearestNode } from './nav.js';
import { choosePost, siteMid, stagePlaces } from './sites.js';

// The sightings of the last seconds count for a rotation; an enemy counts for the site that it is this near.
const ROTATE_SECONDS = 6;
const SITE_NEAR = 1300;
// The CTs rotate when this part of the living Ts is seen at one site, and at least this many.
const ROTATE_SHARE = 0.6;
const ROTATE_MIN = 2;
// A part of an attack: from LEAN_MIN Ts seen at a site, the defenders of the other sites come over, the nearest
// first and one a second, and one of them stays. They go back LEAN_SECONDS after the last T was seen there.
const LEAN_MIN = 1;
const LEAN_SECONDS = 20;
// A plan is drawn by its share of the rounds times this much plus its share of wins.
const WON_BASE = 0.4;
// Two places of a formation lie at least this far apart. A place moves at most SPREAD to a floor that the side can
// walk to, and at most RISE up or down.
const APART = 48;
// The second of a round at which the first T stands in the site, as the players' was: the middle, the spread of
// its logarithm, and the ends of the draw.
const TE_MIDDLE = 34;
const TE_SPREAD = 0.6;
const TE_FIRST = 18;
const TE_LAST = 75;
const SPREAD = 200;
const RISE = 72;

/** Draws one of `plans` by share and success. */
function draw(plans, random) {
  const weight = (p) => p.share * (WON_BASE + p.won);
  let r = random() * plans.reduce((n, p) => n + weight(p), 0);
  for (const p of plans) {
    r -= weight(p);
    if (r <= 0) return p;
  }
  return plans[plans.length - 1];
}

/**
 * The node of the graph where the players of a side start, or -1: of the floors of its spawns, the one with a way to
 * the most floors (a spawn can lie in a pocket of the graph).
 */
function startOf(brain, side) {
  const nav = brain.nav;
  const known = (nav.starts ??= {});
  if (known[side] !== undefined) return known[side];
  let best = -1;
  let most = 0;
  const seen = new Set();
  for (const spawn of brain.map.spawns) {
    if (spawn.team !== side) continue;
    const n = nearestNode(nav, spawn.origin, 3, 48);
    if (n < 0 || seen.has(n)) continue;
    seen.add(n);
    let reach = 0;
    for (let i = 0; i < nav.count; i++) if (canReach(nav, n, i)) reach++;
    if (reach > most) [best, most] = [n, reach];
  }
  return (known[side] = best);
}

/** A floor to stand on has an edge that is no ladder: the end of a ladder with no floor beside it has none. */
function standsAt(nav, i) {
  for (let e = nav.offsets[i]; e < nav.offsets[i + 1]; e++) if (nav.kinds[e] !== LADDER) return true;
  return false;
}

/**
 * The floors of the places of a formation: for each place the nearest floor that the side can walk to from its
 * start, no two nearer than a player is wide. A place on a box that the graph has no way onto gets the floor next
 * to it; a place with no such floor within SPREAD is left out. Found once for each formation.
 */
export function floorsOf(brain, side, points) {
  const nav = brain.nav;
  const known = (nav.planFloors ??= new WeakMap());
  if (known.has(points)) return known.get(points);
  const start = startOf(brain, side);
  const out = [];
  for (const p of points) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < nav.count; i++) {
      const q = [nav.xyz[i * 3], nav.xyz[i * 3 + 1], nav.xyz[i * 3 + 2]];
      const dz = q[2] - p[2];
      if (Math.abs(dz) > RISE || flat(q, p) > SPREAD) continue;
      const d = flat(q, p) + Math.abs(dz) * 2;
      if (d >= bestD || out.some((o) => flat(o, q) < APART)) continue;
      if (!standsAt(nav, i) || (start >= 0 && !canReach(nav, start, i))) continue;
      [best, bestD] = [q, d];
    }
    // The fourth number of a place is the view of the player who stood there (degrees), where the plans have it.
    if (best) out.push(p.length > 3 ? [best[0], best[1], best[2], p[3]] : best);
  }
  known.set(points, out);
  return out;
}

/**
 * Gives each bot one of the places, the nearest way round over all of them: Map(bot id -> place). `at` gives where
 * a bot stands now.
 */
function deal(bots, places, at) {
  const out = new Map();
  if (!bots.length || !places.length) return out;
  let best = null;
  let bestSum = Infinity;
  const pick = (i, used, sum, order) => {
    if (sum >= bestSum) return;
    if (i === bots.length || order.length === places.length) {
      [best, bestSum] = [[...order], sum];
      return;
    }
    const o = at(bots[i]);
    for (let j = 0; j < places.length; j++) {
      if (used & (1 << j)) continue;
      order.push(j);
      pick(i + 1, used | (1 << j), sum + (o ? flat(o, places[j]) : 0), order);
      order.pop();
    }
  };
  pick(0, 0, 0, []);
  best.forEach((j, i) => out.set(bots[i].id, places[j]));
  return out;
}

/** Makes the plan of `side` for the round that starts: {site, goAt, te, spots} for the Ts, {posts, rotate} for the CTs. */
export function planRound(brain, side, time) {
  const { map, nav, random } = brain;
  const sites = map.bombSites;
  if (!sites.length) return null;
  const bots = [...brain.bots.values()].filter((b) => b.side === side);
  const at = (bot) => brain.census.byId.get(bot.id)?.origin ?? null;
  if (side === 'T') {
    const mined = map.plans?.T?.length ? draw(map.plans.T, random) : null;
    const site = mined ? mined.site : Math.floor(random() * sites.length);
    // Without a mined plan: the Ts wait on their ways to the site, out of the sight of its posts, and the first
    // of them is in the site at a second drawn as the players' first T was (docs/measures/2026-11-11-night.md).
    const te = mined ? mined.te : clamp(TE_MIDDLE * exp(random.gauss() * TE_SPREAD), TE_FIRST, TE_LAST);
    const places = mined ? floorsOf(brain, 'T', mined.points) : stagePlaces(brain, site);
    if (!places.length) return { site, goAt: time, te: null, spots: null };
    const spots = deal(bots, places, at);
    // A formation with fewer places than the team has bots: the others wait at the place nearest them, so that
    // no T goes to the site alone.
    for (const bot of bots) {
      const o = at(bot);
      if (spots.has(bot.id) || !o || !places.length) continue;
      spots.set(bot.id, places.reduce((a, b) => (flat(b, o) < flat(a, o) ? b : a)));
    }
    return { site, goAt: time, te, spots };
  }
  const team = brain.teams.CT;
  const posts = new Map();
  const mined = map.plans?.CT?.length ? draw(map.plans.CT, random) : null;
  if (mined) {
    // Each CT stands where a player of that setup stood; its site is the nearer one, for the rotation.
    for (const [id, point] of deal(bots, floorsOf(brain, 'CT', mined.points), at)) {
      let site = 0;
      sites.forEach((s, k) => {
        if (flat(siteMid(s), point) < flat(siteMid(sites[site]), point)) site = k;
      });
      posts.set(id, { point: [point[0], point[1], point[2]], watch: null, yaw: point[3] ?? null, site });
      team.take('post', id, point);
    }
  }
  // Without a setup (or for a bot that it gave no floor): the sites in turn, each at a post that no teammate holds.
  const taken = sites.map(() => []);
  let i = 0;
  for (const bot of bots) {
    if (posts.has(bot.id)) continue;
    const k = i++ % sites.length;
    const post = choosePost(brain, k, taken[k], random(), true) ?? { point: null, watch: null, site: k };
    if (post.point) {
      taken[k].push(post.point);
      team.take('post', bot.id, post.point);
    }
    posts.set(bot.id, post);
  }
  return { posts, rotate: null };
}

/** Once a second: what the team learned changes its plan. */
export function updatePlan(brain, time) {
  const team = brain.teams.CT;
  const plan = team.plan;
  if (!plan?.posts || plan.rotate || team.bomb?.state === 'planted') return;
  const sites = brain.map.bombSites;
  const counts = sites.map(() => 0);
  for (const sight of team.enemies.values()) {
    if (time - sight.time > ROTATE_SECONDS) continue;
    let best = -1;
    let bestD = SITE_NEAR;
    sites.forEach((site, k) => {
      const d = flat(siteMid(site), sight.point);
      if (d < bestD) [best, bestD] = [k, d];
    });
    if (best >= 0) counts[best]++;
  }
  const need = Math.max(ROTATE_MIN, Math.ceil(brain.census.T.alive * ROTATE_SHARE));
  counts.forEach((n, k) => {
    if (!plan.rotate && n >= need) plan.rotate = { site: k, at: time };
  });
  if (!plan.rotate) lean(brain, plan, counts, time);
}

/**
 * The part of a rotation that comes before the whole team goes (plan.leans: bot id -> {site, at}): the players
 * leave a site that nobody attacks, one by one, on the first Ts that the team sees at the other.
 */
function lean(brain, plan, counts, time) {
  const sites = brain.map.bombSites;
  const leans = (plan.leans ??= new Map());
  const seenAt = (plan.seenAt ??= sites.map(() => -Infinity));
  counts.forEach((n, k) => {
    if (n) seenAt[k] = time;
  });
  const top = counts.indexOf(Math.max(...counts));
  const attacked = counts[top] >= LEAN_MIN && counts.every((n, k) => k === top || n < counts[top]);
  // A site that is quiet again, or an attack seen at another site, sends the defenders back.
  for (const [id, to] of leans) if (time - seenAt[to.site] > LEAN_SECONDS || (attacked && to.site !== top)) leans.delete(id);
  if (!attacked) return;
  const alive = brain.census.CT.players.filter((p) => p.alive && plan.posts.has(p.id));
  const siteOf = (p) => leans.get(p.id)?.site ?? plan.posts.get(p.id).site;
  const away = alive.filter((p) => siteOf(p) !== top);
  if (away.length < 2) return;
  const mid = siteMid(sites[top]);
  away.sort((a, b) => flat(a.origin, mid) - flat(b.origin, mid) || a.id - b.id);
  leans.set(away[0].id, { site: top, at: time });
}
