// What a team must know of a bomb site to defend it: the ways that the attackers come in by, and the posts that
// watch those ways from cover. Both come from the nav graph and the level's lines of sight, once a map. After the
// approach areas and the hiding spots of the official CS bot's nav mesh; the mined places of the demos can replace
// the posts later (spec 01, section 6).

import { PI, abs, cos, flat, hypot, sin, yawTo, turn } from './geometry.js';
import { distancesFrom, findPath, nearestNode, nodePoint, pathLength, reaches } from './nav.js';

// A way in is named by the point of the attackers' path this far from the site's middle.
const ENTRY_DISTANCE = 650;
// At most this many ways in; another way counts when its point lies this far from the others, and its path is no
// longer than this many times the shortest.
const MAX_ENTRIES = 3;
const ENTRY_APART = 400;
const ENTRY_DETOUR = 2.2;
// The floors this near a found way in are closed for the next search, so that it finds another way.
const ENTRY_CLOSE = 320;
// A post lies within this of the site's middle; so many floors are tried; so many posts are kept, this far apart.
const POST_REACH = 800;
const POST_TRIES = 220;
const POSTS_KEPT = 14;
const POST_APART = 120;
// The best distance from a post to the way in that it watches, and the rays that measure how open a post stands.
const WATCH_BEST = 700;
const RAYS = 16;
const RAY_REACH = 1200;
const RAY_OPEN = 500;
const EYE = 17;
// A defender must stand at its post this long before the first attacker can see it there (s): the time to stop
// and to aim. A defender that still runs when the attackers come is shot in the open.
const POST_LEAD = 0.5;
// The run of a player with a rifle, units a second (tactics.js RUN_SPEED).
const RUN = 240;
// An attacker counts for a post from this near; every so many floors are asked for a line to a post. A longer
// reach and a longer lead take away the forward posts of a site, and those posts keep the attackers out of it
// (docs/measures/2026-11-11-night.md).
const SIGHT_REACH = 1000;
const SIGHT_STEP = 3;
// A site with fewer posts in time than this takes posts further back too, out to BACK_REACH from its middle.
const POSTS_IN_TIME = 5;
const BACK_REACH = 1600;

const eyeAt = (p) => [p[0], p[1], p[2] + EYE];

/** The middle of a bomb site, at the height of a player on its floor. */
export const siteMid = (site) => [(site.mins[0] + site.maxs[0]) / 2, (site.mins[1] + site.maxs[1]) / 2, site.mins[2] + 36];

/** True when the box of a player at `origin` touches the box of a site. */
export function touches(site, origin) {
  const [x, y, z] = origin;
  return Boolean(site) && x + 16 > site.mins[0] && x - 16 < site.maxs[0] && y + 16 > site.mins[1] && y - 16 < site.maxs[1] && z + 36 > site.mins[2] && z - 36 < site.maxs[2];
}

/** True when the box of a player at `origin` touches a bomb site of the map. */
export const inBombSite = (map, origin) => map.bombSites.some((site) => touches(site, origin));

/** The ways in and the posts of site `k` (cached on the brain): {mid, entries: [point], posts: [{point, sees, score}]}. */
export function siteInfo(brain, k) {
  const cache = (brain.nav.sites ??= []);
  if (cache[k]) return cache[k];
  const site = brain.map.bombSites[k];
  const mid = siteMid(site);
  const entries = entriesOf(brain, mid);
  cache[k] = { mid, entries, posts: postsOf(brain, mid, entries) };
  return cache[k];
}

/** The points where the attackers' shortest ways from their spawn come within ENTRY_DISTANCE of the site. */
function entriesOf(brain, mid) {
  const { nav } = brain;
  const start = brain.spawnMid.T;
  if (!start) return [];
  const from = nearestNode(nav, start, 8, 200);
  const to = nearestNode(nav, mid, 8, 200);
  if (from < 0 || to < 0) return [];
  // A found way in is closed for the next search: with no other way, that search ends without one.
  const closed = new Uint8Array(nav.count);
  const cost = (node) => (closed[node] ? Infinity : 0);
  const found = [];
  let shortest = Infinity;
  for (let tries = 0; tries < MAX_ENTRIES + 2 && found.length < MAX_ENTRIES; tries++) {
    const path = findPath(nav, from, to, nav.count + 1, null, cost);
    if (!path) break;
    const length = pathLength(path);
    shortest = Math.min(shortest, length);
    if (length > shortest * ENTRY_DETOUR) break;
    let entry = null;
    for (let i = path.length - 1; i >= 0 && !entry; i--) if (flat(path[i].point, mid) >= ENTRY_DISTANCE) entry = path[i].point;
    if (!entry) break;
    if (!found.some((e) => flat(e, entry) < ENTRY_APART)) found.push(entry);
    for (let i = 0; i < nav.count; i++) {
      if (hypot(nav.xyz[i * 3] - entry[0], nav.xyz[i * 3 + 1] - entry[1]) < ENTRY_CLOSE && abs(nav.xyz[i * 3 + 2] - entry[2]) < 160) closed[i] = 1;
    }
  }
  return found;
}

/**
 * The runs of both teams from their spawns, for the posts' timing: {T, CT (prices to every floor), order (the
 * floors from the nearest to the T spawn on, every SIGHT_STEP-th)}. Null when a spawn is off the graph.
 */
function runsOf(brain) {
  const { nav } = brain;
  if (nav.runs !== undefined) return nav.runs;
  const t = brain.spawnMid.T ? nearestNode(nav, brain.spawnMid.T, 8, 200) : -1;
  const ct = brain.spawnMid.CT ? nearestNode(nav, brain.spawnMid.CT, 8, 200) : -1;
  nav.runs = null;
  if (t < 0 || ct < 0) return null;
  const T = distancesFrom(nav, t);
  const order = [];
  for (let i = 0; i < nav.count; i += SIGHT_STEP) if (T[i] < Infinity) order.push(i);
  order.sort((a, b) => T[a] - T[b] || a - b);
  nav.runs = { T, CT: distancesFrom(nav, ct), order };
  return nav.runs;
}

/**
 * True when a defender stands at the floor `node` POST_LEAD seconds before the first attacker can see it there:
 * both run from their spawns, the attacker to the first floor with a line to the post. `step` asks only every
 * so many of the attackers' floors.
 */
function inTime(brain, runs, node, step = 1) {
  const { nav, ports } = brain;
  const p = nodePoint(nav, node);
  const eye = eyeAt(p);
  // The attackers must not see the post before this price of their run.
  const safe = runs.CT[node] + POST_LEAD * RUN;
  for (let k = 0; k < runs.order.length; k += step) {
    const i = runs.order[k];
    if (runs.T[i] >= safe) return true;
    const o = i * 3;
    if (hypot(nav.xyz[o] - p[0], nav.xyz[o + 1] - p[1]) > SIGHT_REACH) continue;
    if (ports.traceLine([nav.xyz[o], nav.xyz[o + 1], nav.xyz[o + 2] + EYE], eye) >= 1) return false;
  }
  return true;
}

/**
 * The floors near the site that watch a way in from cover, the best first. Each says whether a defender is there
 * in time (`late`); where few are, floors further back on the defenders' side follow, which are.
 */
function postsOf(brain, mid, entries) {
  const { nav, ports } = brain;
  if (!entries.length) return [];
  const home = brain.spawnMid.CT ?? mid;
  /** The value of a floor as a post, or null: {node, point, sees, score}. `back`: a floor that sees the site counts too. */
  const rate = (node, back) => {
    const p = nodePoint(nav, node);
    // A floor by a wall or on an edge is no place to stand a round.
    if (nav.offsets[node + 1] - nav.offsets[node] < 5) return null;
    const eye = eyeAt(p);
    const sees = entries.map((e) => ports.traceLine(eye, eyeAt(e)) >= 1);
    if (!sees.some(Boolean) && !(back && ports.traceLine(eye, eyeAt(mid)) >= 1)) return null;
    let watch = 0;
    sees.forEach((yes, i) => {
      if (yes) watch = Math.max(watch, 1 - Math.min(1, abs(flat(p, entries[i]) - WATCH_BEST) / WATCH_BEST));
    });
    // On the attackers' side of a way in, the post is in their path, not behind cover.
    if (entries.some((e) => flat(p, e) < 250)) return null;
    let open = 0;
    for (let r = 0; r < RAYS; r++) {
      const a = (r / RAYS) * PI * 2;
      if (ports.traceLine(eye, [eye[0] + cos(a) * RAY_REACH, eye[1] + sin(a) * RAY_REACH, eye[2]]) * RAY_REACH > RAY_OPEN) open++;
    }
    if (!reaches(nav, home, p)) return null;
    return { node, point: p, sees, score: sees.filter(Boolean).length * 0.5 + watch + (1 - open / RAYS) * 1.2 };
  };
  const byScore = (a, b) => b.score - a.score || a.point[0] - b.point[0] || a.point[1] - b.point[1];
  const near = [];
  for (let i = 0; i < nav.count; i++) {
    if (hypot(nav.xyz[i * 3] - mid[0], nav.xyz[i * 3 + 1] - mid[1]) <= POST_REACH && abs(nav.xyz[i * 3 + 2] - mid[2]) < 220) near.push(i);
  }
  const step = Math.max(1, Math.floor(near.length / POST_TRIES));
  const scored = [];
  for (let k = 0; k < near.length; k += step) {
    const post = rate(near[k], false);
    if (post) scored.push(post);
  }
  scored.sort(byScore);
  const kept = [];
  for (const s of scored) {
    if (kept.length === POSTS_KEPT) break;
    if (!kept.some((q) => flat(q.point, s.point) < POST_APART)) kept.push(s);
  }
  const runs = runsOf(brain);
  if (!runs) return kept;
  for (const post of kept) post.late = !inTime(brain, runs, post.node);
  let found = kept.filter((p) => !p.late).length;
  if (found >= POSTS_IN_TIME) return kept;
  // Too few in time: the floors out to BACK_REACH that are no further from the defenders' spawn than the site is,
  // and that see a way in or the site itself. Of those in time, the nearer to the site is the better.
  const midNode = nearestNode(nav, mid, 8, 200);
  const back = [];
  for (let i = 0; i < nav.count; i++) {
    if (hypot(nav.xyz[i * 3] - mid[0], nav.xyz[i * 3 + 1] - mid[1]) <= BACK_REACH && abs(nav.xyz[i * 3 + 2] - mid[2]) < 300 && (midNode < 0 || runs.CT[i] <= runs.CT[midNode])) back.push(i);
  }
  const more = [];
  for (const node of back) {
    // An attacker that stands on a floor sees it: where the attackers are first, no line needs a trace.
    // A coarse look first: most floors fail it, and each look costs many traces.
    if (runs.T[node] < runs.CT[node] + POST_LEAD * RUN || !inTime(brain, runs, node, 4)) continue;
    const post = rate(node, true);
    if (!post || !inTime(brain, runs, node)) continue;
    post.score += 1 - flat(post.point, mid) / BACK_REACH;
    post.late = false;
    post.back = true;
    more.push(post);
  }
  more.sort(byScore);
  for (const s of more) {
    if (found >= POSTS_IN_TIME) break;
    // As far apart as two defenders stand (choosePost), so that each of these posts can hold one.
    if (kept.some((q) => !q.late && flat(q.point, s.point) < POST_APART * 1.5)) continue;
    kept.push(s);
    found++;
  }
  return kept;
}

/**
 * A post of site `k` for a defender: the best one that no teammate holds (`taken`: points), by the ways in that are
 * not watched yet and by the angle to the teammates that watch the same way (a crossfire). `pick` is a number in
 * [0, 1) that chooses among the best few, so a team does not stand the same every round. Null when the site has none.
 * `fromSpawn`: the defender runs there from its spawn at the round's start, so the post must be one in time.
 */
export function choosePost(brain, k, taken, pick, fromSpawn = false) {
  const info = siteInfo(brain, k);
  const mates = taken.map((t) => info.posts.find((p) => flat(p.point, t) < 8)).filter(Boolean);
  // The posts further back are for the round's start only: later in a round nobody races for a post.
  const free = info.posts.filter((post) => (fromSpawn || !post.back) && !taken.some((t) => flat(t, post.point) < POST_APART * 1.5));
  // A post that the attackers see before a defender gets there is taken only when no other is left.
  const inTime = fromSpawn ? free.filter((post) => !post.late) : [];
  const rated = [];
  for (const post of inTime.length ? inTime : free) {
    let bonus = 0;
    post.sees.forEach((yes, i) => {
      if (!yes) return;
      const others = mates.filter((m) => m.sees[i]);
      // A way in that nobody watches yet counts most; one watched from another side counts as a crossfire.
      if (!others.length) bonus += 1;
      else if (others.every((m) => abs(turn(yawTo(info.entries[i], m.point) - yawTo(info.entries[i], post.point))) > 35)) bonus += 0.5;
    });
    rated.push({ post, value: post.score + bonus });
  }
  if (!rated.length) return null;
  rated.sort((a, b) => b.value - a.value);
  const best = rated.slice(0, 3);
  const chosen = best[Math.min(best.length - 1, Math.floor(pick * best.length))].post;
  // It watches the way in that it sees and the fewest teammates watch.
  let watch = null;
  let fewest = Infinity;
  chosen.sees.forEach((yes, i) => {
    const n = mates.filter((m) => m.sees[i]).length;
    if (yes && n < fewest) [watch, fewest] = [info.entries[i], n];
  });
  // A post further back that sees no way in watches the site itself.
  return { point: chosen.point, watch: watch ?? info.mid, site: k };
}
