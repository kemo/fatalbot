// What a team must know of a bomb site to defend it: the ways that the attackers come in by, and the posts that
// watch those ways from cover. Both come from the nav graph and the level's lines of sight, once a map. After the
// approach areas and the hiding spots of the official CS bot's nav mesh; the mined places of the demos can replace
// the posts later (spec 01, section 6).

import { PI, abs, cos, flat, hypot, sin, yawTo, turn } from './geometry.js';
import { findPath, nearestNode, nodePoint, pathLength, reaches } from './nav.js';

// A way in is named by the point of the attackers' path this far from the site's middle.
const ENTRY_DISTANCE = 650;
// At most this many ways in; another way counts when its point lies this far from the others, and its path is no
// longer than this many times the shortest.
const MAX_ENTRIES = 3;
const ENTRY_APART = 400;
const ENTRY_DETOUR = 2.2;
// The floors this near a found way in are closed for the next search, so that it finds another way.
const ENTRY_CLOSE = 320;
const CLOSED = 4000;
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
  const cache = (brain.sites ??= []);
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
  const closed = new Float32Array(nav.count);
  const cost = (node) => closed[node];
  const found = [];
  let shortest = Infinity;
  for (let tries = 0; tries < MAX_ENTRIES + 2 && found.length < MAX_ENTRIES; tries++) {
    const path = findPath(nav, from, to, 80000, null, cost);
    if (!path) break;
    const length = pathLength(path);
    shortest = Math.min(shortest, length);
    if (length > shortest * ENTRY_DETOUR) break;
    let entry = null;
    for (let i = path.length - 1; i >= 0 && !entry; i--) if (flat(path[i].point, mid) >= ENTRY_DISTANCE) entry = path[i].point;
    if (!entry) break;
    if (!found.some((e) => flat(e, entry) < ENTRY_APART)) found.push(entry);
    for (let i = 0; i < nav.count; i++) {
      if (hypot(nav.xyz[i * 3] - entry[0], nav.xyz[i * 3 + 1] - entry[1]) < ENTRY_CLOSE && abs(nav.xyz[i * 3 + 2] - entry[2]) < 160) closed[i] = CLOSED;
    }
  }
  return found;
}

/** The floors near the site that watch a way in from cover, the best first. */
function postsOf(brain, mid, entries) {
  const { nav, ports } = brain;
  if (!entries.length) return [];
  const home = brain.spawnMid.CT ?? mid;
  const near = [];
  for (let i = 0; i < nav.count; i++) {
    if (hypot(nav.xyz[i * 3] - mid[0], nav.xyz[i * 3 + 1] - mid[1]) <= POST_REACH && abs(nav.xyz[i * 3 + 2] - mid[2]) < 220) near.push(i);
  }
  const step = Math.max(1, Math.floor(near.length / POST_TRIES));
  const scored = [];
  for (let k = 0; k < near.length; k += step) {
    const p = nodePoint(nav, near[k]);
    // A floor by a wall or on an edge is no place to stand a round.
    if (nav.offsets[near[k] + 1] - nav.offsets[near[k]] < 5) continue;
    const eye = eyeAt(p);
    const sees = entries.map((e) => ports.traceLine(eye, eyeAt(e)) >= 1);
    if (!sees.some(Boolean)) continue;
    let watch = 0;
    sees.forEach((yes, i) => {
      if (yes) watch = Math.max(watch, 1 - Math.min(1, abs(flat(p, entries[i]) - WATCH_BEST) / WATCH_BEST));
    });
    // On the attackers' side of a way in, the post is in their path, not behind cover.
    if (entries.some((e) => flat(p, e) < 250)) continue;
    let open = 0;
    for (let r = 0; r < RAYS; r++) {
      const a = (r / RAYS) * PI * 2;
      if (ports.traceLine(eye, [eye[0] + cos(a) * RAY_REACH, eye[1] + sin(a) * RAY_REACH, eye[2]]) * RAY_REACH > RAY_OPEN) open++;
    }
    if (!reaches(nav, home, p)) continue;
    scored.push({ point: p, sees, score: sees.filter(Boolean).length * 0.5 + watch + (1 - open / RAYS) * 1.2 });
  }
  scored.sort((a, b) => b.score - a.score || a.point[0] - b.point[0] || a.point[1] - b.point[1]);
  const kept = [];
  for (const s of scored) {
    if (kept.length === POSTS_KEPT) break;
    if (!kept.some((q) => flat(q.point, s.point) < POST_APART)) kept.push(s);
  }
  return kept;
}

/**
 * A post of site `k` for a defender: the best one that no teammate holds (`taken`: points), by the ways in that are
 * not watched yet and by the angle to the teammates that watch the same way (a crossfire). `pick` is a number in
 * [0, 1) that chooses among the best few, so a team does not stand the same every round. Null when the site has none.
 */
export function choosePost(brain, k, taken, pick) {
  const info = siteInfo(brain, k);
  const mates = taken.map((t) => info.posts.find((p) => flat(p.point, t) < 8)).filter(Boolean);
  const rated = [];
  for (const post of info.posts) {
    if (taken.some((t) => flat(t, post.point) < POST_APART * 1.5)) continue;
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
  return { point: chosen.point, watch, site: k };
}
