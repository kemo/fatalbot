// The plan of a team for a round (spec 01, section 3, the team layer). The first plan is the plain one of the
// reference bots: the Ts take one site together, each CT holds a site. The plans of spec 12 of csbih-player
// (defaults, executes, rotations) come here.

/** Makes the plan of `side` for the round that starts: {site, goAt} for the Ts, {posts} for the CTs. */
export function planRound(brain, side, time) {
  const sites = brain.map.bombSites;
  const random = brain.random;
  if (!sites.length) return null;
  if (side === 'T') return { site: Math.floor(random() * sites.length), goAt: time };
  // The CTs spread over the sites in turn, in the order they joined.
  const posts = new Map();
  let i = 0;
  for (const bot of brain.bots.values()) if (bot.side === 'CT') posts.set(bot.id, i++ % sites.length);
  return { posts };
}
