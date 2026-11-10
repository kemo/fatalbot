// The plan of a team for a round (spec 01, section 3, the team layer), and its changes on what the team learns.
// The Ts take one site together. The CTs spread over the sites, each at a post that watches a way in (sites.js),
// and rotate to a site when the team sees the attack there. The plans of spec 12 of csbih-player (defaults,
// executes, fakes, saves) come here.

import { flat } from './geometry.js';
import { choosePost, siteMid } from './sites.js';

// The sightings of the last seconds count for a rotation; an enemy counts for the site that it is this near.
const ROTATE_SECONDS = 6;
const SITE_NEAR = 1300;
// The CTs rotate when this part of the living Ts is seen at one site, and at least this many.
const ROTATE_SHARE = 0.6;
const ROTATE_MIN = 2;

/** Makes the plan of `side` for the round that starts: {site, goAt} for the Ts, {posts, rotate} for the CTs. */
export function planRound(brain, side, time) {
  const sites = brain.map.bombSites;
  const random = brain.random;
  if (!sites.length) return null;
  if (side === 'T') return { site: Math.floor(random() * sites.length), goAt: time };
  // The CTs spread over the sites in turn, in the order they joined; each takes a post that no teammate holds.
  const team = brain.teams.CT;
  const posts = new Map();
  const taken = sites.map(() => []);
  let i = 0;
  for (const bot of brain.bots.values()) {
    if (bot.side !== 'CT') continue;
    const k = i++ % sites.length;
    const post = choosePost(brain, k, taken[k], random()) ?? { point: null, watch: null, site: k };
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
}
