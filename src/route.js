// The route of a recorded player, for a bot that plays on for that player in a replay (spec 02, join). The bot
// walks where the player walked, at the player's pace, and looks where the player looked, until its own round
// leaves the recording: it fights, it is hit, it hears an enemy near, the route ends, or the bomb is not the
// route's. Each bot leaves its route by what it meets itself; no count of the dead and no event of a teammate
// ends a route. Ported from csbih-player (bot.js follow, steer, rejoinPoint), with the leave rules made each bot's own.

import { RAD, abs, atan2, cos, flat, hypot, sin } from './geometry.js';
import { nearestNode, nodePoint, reaches } from './nav.js';
import { climb } from './walk.js';

// The route is read in steps of this many seconds; a point this near is passed.
const STEP = 0.05;
const REACHED = 24;
// The bot steers to the first point of the route this far from it, at most LEAD * 2 seconds ahead.
const STEER_REACH = 24;
const LEAD = 0.25;
// A route slower than this stands, and a bot this near its point stands too; under WALK_PACE it walks, unless it
// is more than CATCH_UP units or BEHIND seconds behind.
const STAND_PACE = 5;
const STAND_NEAR = 12;
const WALK_PACE = 135;
const CATCH_UP = 96;
const BEHIND = 0.3;
// On a ladder the bot climbs toward the route's place this far ahead in time.
const LADDER_AHEAD = 2;
// The track rises this fast where the player jumped (units a second), and slows by this much in a tenth of a second.
const JUMP_RISE = 150;
const JUMP_SLOWS = 5;
// A bot this far from its route, or with no progress on it for STALL seconds, walks back to it by the graph: to
// the first point from AHEAD seconds on, within LOOK seconds, that the graph reaches. Within REJOINED it is back.
const OFF_ROUTE = 300;
const STALL = 2;
const AHEAD = 1;
const LOOK = 12;
const REJOINED = 48;
// So many walks back that failed end the route.
const REJOIN_TRIES = 3;
// The bot's own contacts that end its route: an enemy in its sight that it reacted to, a hit in the last HIT
// seconds, an enemy heard this near in the last HEARD seconds.
const IN_SIGHT = 0.3;
const HIT = 0.5;
const HEARD = 1;
const NOISE_NEAR = 900;
// After a plant a T keeps its route only while the route is this near the bomb: else the route is of another round.
const SAME_PLANT = 1500;

const pointOf = (p) => [p.x, p.y, p.z];

/** The route of the bot in this round, or null: the function of its join, while the bot has not left it. */
function routeOf(c) {
  const { bot, s, frame } = c;
  if (!bot.route || s.routeOff) return null;
  // A route belongs to the round of its join: a new round needs a new join.
  bot.routeRound ??= frame.round.number;
  return bot.routeRound === frame.round.number ? bot.route : null;
}

/** The bot leaves its route for the rest of the round, for the reason `why` (a tool can read it). */
export function leaveRoute(c, why) {
  if (c.bot.route && !c.s.routeOff) c.s.routeOff = why;
}

/** True while the bot is on the route of its player. */
export const onRoute = (c) => Boolean(routeOf(c));

/**
 * The place of the route that the bot is at now: {x, y, z, yaw, pitch, duck, weapon, bomb}, or null when the bot has
 * no route (any more). A point of the route is passed when the bot stands at it, or when the next one is no
 * further away; the progress never runs ahead of the round's clock.
 */
export function routeHere(c) {
  const route = routeOf(c);
  if (!route) return null;
  const { me, s, time } = c;
  const o = me.origin;
  const r = (s.route ??= { progress: time, since: time, at: time, rejoin: null, tries: 0 });
  const away = (t) => {
    const p = route(t);
    return p ? hypot(p.x - o[0], p.y - o[1]) + abs(p.z - o[2]) * 0.5 : Infinity;
  };
  let t = r.progress;
  while (t + STEP <= time && (away(t) < REACHED || away(t + STEP) <= away(t) + 1)) t += STEP;
  if (t !== r.progress || c.frame.round.phase === 'freeze') r.at = time;
  r.progress = t;
  const here = route(t);
  if (!here) leaveRoute(c, 'route-end');
  return here;
}

/** The first place of the route ahead that the graph reaches from the bot: {point, t}, or null. */
function rejoinPoint(c, route, r) {
  const { me, time, brain } = c;
  const { nav } = brain;
  for (let t = r.progress + AHEAD; t <= Math.max(time, r.progress) + LOOK; t += 0.5) {
    const p = route(t);
    if (!p) break;
    const n = nearestNode(nav, pointOf(p), 2, 40);
    if (n < 0 || abs(nodePoint(nav, n)[2] - p.z) > 24) continue;
    if (reaches(nav, me.origin, nodePoint(nav, n))) return { point: nodePoint(nav, n), t };
  }
  return null;
}

/**
 * The goal of a bot on its route: {kind: 'route', here, look, duck, weapon}, or a walk back to the route by the
 * graph ({kind: 'goto', task: 'route', point}). Null when the bot has no route, or leaves it now by a contact of
 * its own. `bomb` is the bomb as the bot knows it (senses.js bombFor).
 */
export function routeGoal(c, bomb) {
  if (!onRoute(c)) return null;
  const { me, own, s, time } = c;
  // The bot's own contacts: from here on its round is not the recording's.
  if (s.target && time - s.seenAt < IN_SIGHT && time >= s.reactAt) leaveRoute(c, 'fight');
  else if (own.hurt && time - own.hurt.at < HIT) leaveRoute(c, 'hit');
  else if (s.noise?.attends && time - s.noise.at < HEARD && flat(s.noise.point, me.origin) < NOISE_NEAR) leaveRoute(c, 'heard');
  const here = routeHere(c);
  if (!here) return null;
  const route = routeOf(c);
  const r = s.route;
  const o = me.origin;
  if (bomb?.state === 'planted') {
    // A CT goes for the bomb by its own way. A T keeps the route that stays about the bomb.
    if (me.team === 'CT' || !bomb.point || hypot(here.x - bomb.point[0], here.y - bomb.point[1]) > SAME_PLANT) {
      leaveRoute(c, 'bomb');
      return null;
    }
  } else if (bomb?.state === 'carried' && bomb.mine && !here.bomb && here.weapon !== 'c4') {
    // A bomb that the player did not carry now: the route has no plant in it.
    leaveRoute(c, 'bomb');
    return null;
  }
  // Off the route (a block, a push), or no progress on it: back to it by the graph, then on along it.
  const off = hypot(here.x - o[0], here.y - o[1]) > OFF_ROUTE;
  const stalled = time - r.at > STALL && time - r.progress > STALL;
  if (!r.rejoin && (off || stalled)) {
    r.rejoin = r.tries < REJOIN_TRIES ? rejoinPoint(c, route, r) : null;
    r.tries++;
    if (!r.rejoin) {
      leaveRoute(c, 'lost');
      return null;
    }
  }
  if (r.rejoin) {
    const p = r.rejoin.point;
    if (flat(p, o) >= REJOINED || abs(p[2] - o[2]) >= 40) return { kind: 'goto', task: 'route', point: p };
    r.progress = Math.max(r.progress, Math.min(time, r.rejoin.t));
    r.at = time;
    r.rejoin = null;
  }
  // The view of the player at this place, and the gun in its hand.
  return { kind: 'route', task: 'route', here, look: { yaw: here.yaw ?? me.yaw, pitch: here.pitch ?? 0 }, duck: Boolean(here.duck), weapon: here.weapon ?? null };
}

/** A walk back to the route that the bot gave up: the next one starts further along the route. */
export function routeGaveUp(c) {
  const r = c.s.route;
  if (!r) return;
  r.progress += AHEAD;
  r.rejoin = null;
}

/**
 * The feet of a bot on its route: toward the place of the route a moment ahead, at the route's pace. It runs when
 * it is behind, walks where the player walked, stands where the player stood, jumps where the player jumped.
 */
export function steerRoute(c, cmd) {
  const route = routeOf(c);
  const r = c.s.route;
  if (!route || !r) return;
  const { me, own, time } = c;
  const here = route(r.progress);
  if (!here) return;
  const o = me.origin;
  let ahead = here;
  for (let t = r.progress; t <= r.progress + LEAD * 2; t += STEP) {
    const p = route(t);
    if (!p) break;
    ahead = p;
    if (hypot(p.x - o[0], p.y - o[1]) >= STEER_REACH) break;
  }
  // On a ladder the route goes up or down, not across: toward where it leaves the ladder.
  if (me.onLadder && !me.onGround) {
    const away = route(r.progress + LADDER_AHEAD) ?? ahead;
    if (climb(c, cmd, pointOf(away))) return;
  }
  const dx = ahead.x - o[0];
  const dy = ahead.y - o[1];
  const distance = hypot(dx, dy);
  const kept = r.progress >= time - STEP;
  if (distance < 2 && kept) return;
  const next = route(r.progress + LEAD) ?? here;
  const pace = hypot(next.x - here.x, next.y - here.y) / LEAD;
  // Where the player stood nearer to a wall than the bot's box gets: this near is there.
  if (pace < STAND_PACE && distance < STAND_NEAR && kept) return;
  const rel = atan2(dy, dx) - cmd.yaw * RAD;
  cmd.forward = cos(rel);
  cmd.side = -sin(rel);
  if (pace < WALK_PACE && r.progress > time - BEHIND && distance < CATCH_UP) cmd.walk = true;
  if (!me.onGround) {
    // In the air toward a higher place: the legs come up, as players cleared a crate.
    const top = route(r.progress + 0.3);
    if (top && top.z > o[2] + 10) cmd.duck = true;
    return;
  }
  // The player's own jump: where the track rises as a jump rises (fast, and slower a tenth of a second later), the
  // bot near that point jumps too.
  const up = route(r.progress + 0.1);
  const top = route(r.progress + 0.2);
  const rise = up ? up.z - here.z : 0;
  const slows = top && up ? rise - (top.z - up.z) : 0;
  if (rise / 0.1 > JUMP_RISE && slows > JUMP_SLOWS && hypot(here.x - o[0], here.y - o[1]) < 40 && abs(here.z - o[2]) < 24 && own.stamina <= 0) cmd.jump = true;
}
