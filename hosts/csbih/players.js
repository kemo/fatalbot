// The aim of the recorded players, with its spread: what a bot's hand is held against (spec 01, gate G7).
// A "player" here is one player of one demo, by its number in that demo. No name is read.
// The measure of a kill is csbih-player's own (tools/aim-stats.js engagements); tracksOf is ported from its
// demoTracks.

import { kindOf } from '../../src/weapons.js';

// A player counts for the spread from this many kills, and for an aim measure from this many measured kills.
export const MIN_KILLS = 20;
export const MIN_FIGHTS = 15;
// The measures of one kill that the tool reports: [key, title, unit, digits].
export const MEASURES = [
  ['e0', 'Crosshair error at the first sight', 'degrees', 1],
  ['toShot', 'First sight to first shot', 's', 2],
  ['peak', 'Peak turn before the shot', 'degrees a second', 0],
  ['shotErr', 'Crosshair error at the first shot', 'degrees', 1],
  ['low', 'Crosshair under the head at the first shot', 'units', 0],
];

// The shots of a kill: those of the killer in the last seconds before it, within this angle of the victim's head.
const BURST_SECONDS = 2;
const NEAR_AIM = 15;
const MOST_SHOTS = 12;
// The shots of a burst by their number, for the tables: [first, last, title].
export const SHOT_STEPS = [[1, 1, 'Shot 1'], [2, 2, 'Shot 2'], [3, 3, 'Shot 3'], [4, 5, 'Shots 4 and 5'], [6, 8, 'Shots 6 to 8'], [9, MOST_SHOTS, 'Shots 9 to 12']];
const RAD = Math.PI / 180;
const turn = (d) => ((((d + 540) % 360) + 360) % 360) - 180;

const GROUP = { rifle: 'rifle', sniper: 'sniper', pistol: 'pistol' };
// A demo names some guns by the name of their entity.
const NAMES = { mp5navy: 'mp5' };
const gunKind = (weapon) => kindOf(NAMES[weapon] ?? weapon);
/** The group of a weapon for the tables: rifle, sniper, pistol or other. */
export const groupOf = (weapon) => GROUP[gunKind(weapon)] ?? 'other';

// The sight errors that the turn is told apart by: [from, to, title] in degrees.
export const SIGHT_STEPS = [[0, 10, 'Under 10'], [10, 40, '10 to 40'], [40, 181, 'Over 40']];
/**
 * The hand by the size of the turn that a kill needed: for the kills whose crosshair error at the first sight lies
 * in each step of SIGHT_STEPS, {title, n, toShot, peak, shotErr} as spreads. A fast hand shows in the large
 * turns, and a bad crosshair placement in how many of them there are.
 */
export function turnsBySight(fights) {
  return SIGHT_STEPS.map(([from, to, title]) => {
    const own = fights.filter((f) => f.e0 >= from && f.e0 < to);
    return { title, n: own.length, share: fights.length ? own.length / fights.length : NaN, toShot: spread(own.map((f) => f.toShot)), peak: spread(own.map((f) => f.peak)), shotErr: spread(own.map((f) => f.shotErr)) };
  });
}

/** The samples of a timeline as tracks: Map(player -> [[t, {x, y, z, yaw, pitch, dead, duck}]]). */
export function tracksOf(timeline) {
  const fine = (timeline.version ?? 0) >= 8;
  const tracks = new Map();
  for (const row of timeline.samples ?? []) {
    for (let i = 1; i < row.length; i += 6) {
      const f = row[i + 5];
      const bits = fine ? (f >> 4) & 0x7ff : (f >> 3) & 0xff;
      const pitch = !bits ? 0 : fine ? (bits - 900) / 10 : bits - 90;
      let track = tracks.get(row[i]);
      if (!track) tracks.set(row[i], (track = []));
      track.push([row[0], { x: row[i + 1], y: row[i + 2], z: row[i + 3], yaw: fine ? row[i + 4] / 10 : row[i + 4], pitch, dead: (f & 1) !== 0, duck: (f & (fine ? 8 : 2048)) !== 0 }]);
    }
  }
  return tracks;
}

/** The sample of a track at a time: the last one at or before it, or null. */
function sampleAt(track, t) {
  let lo = 0;
  let hi = track.length - 1;
  if (hi < 0 || track[0][0] > t) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return track[lo][1];
}

/** The shots of each player in the order of their time: Map(player -> [t]) from [[t, player]]. */
export function shotsBy(shots) {
  const out = new Map();
  for (const [t, player] of shots) {
    let list = out.get(player);
    if (!list) out.set(player, (list = []));
    list.push(t);
  }
  for (const list of out.values()) list.sort((a, b) => a - b);
  return out;
}

/**
 * The shots of a kill, in their order: for each shot of the killer in the last BURST_SECONDS before the kill that
 * went the victim's way, [the crosshair error in degrees, how far under the middle of the head the crosshair was
 * in units at the victim's distance (+ lower), how far to the side]. The same for a player and for a bot.
 */
export function shotsOfKill(tracks, byPlayer, kill) {
  const a = tracks.get(kill.killer);
  const b = tracks.get(kill.victim);
  const out = [];
  if (!a || !b) return out;
  for (const t of byPlayer.get(kill.killer) ?? []) {
    if (t < kill.t - BURST_SECONDS) continue;
    if (t > kill.t + 0.011 || out.length >= MOST_SHOTS) break;
    const p = sampleAt(a, t);
    const q = sampleAt(b, t);
    if (!p || !q || p.dead) continue;
    const eye = [p.x, p.y, p.z + (p.duck ? 12 : 17)];
    const head = [q.x, q.y, q.z + (q.duck ? 16 : 22)];
    const flatTo = Math.hypot(head[0] - eye[0], head[1] - eye[1]);
    const far = Math.hypot(flatTo, head[2] - eye[2]);
    const ey = turn(Math.atan2(head[1] - eye[1], head[0] - eye[0]) / RAD - p.yaw);
    const ep = -Math.atan2(head[2] - eye[2], flatTo) / RAD - p.pitch;
    const error = Math.hypot(ey, ep);
    if (error > NEAR_AIM) continue;
    out.push([Math.round(error * 100) / 100, Math.round(Math.tan(-ep * RAD) * far * 10) / 10, Math.round(Math.abs(Math.tan(ey * RAD)) * far * 10) / 10]);
  }
  return out;
}

/**
 * The facts of the players of one demo: [{kills, heads, groups: {group: [kills, heads]}, fights: [{e0, toShot,
 * peak, shotErr, low, group}], bursts: [{group, head, shots: shotsOfKill}]}], one for each player with a kill of
 * an enemy. `hulls` is the level of the demo. `skip` holds spans of the demo's time ([from, to]) whose kills are
 * left out: the rounds that are not played on the level (strategies.js fitRounds).
 */
export function playerFacts(aimStats, hulls, timeline, skip = []) {
  const tracks = tracksOf(timeline);
  const shots = (timeline.shots ?? []).map((s) => [s[0], s[1]]);
  const byPlayer = shotsBy(shots);
  const byKiller = new Map();
  for (const k of timeline.kills ?? []) {
    if (!k.killer || k.killer === k.victim || k.killerTeam === k.victimTeam) continue;
    if (skip.some(([from, to]) => k.t >= from && k.t <= to)) continue;
    if (gunKind(k.weapon) === 'grenade' || gunKind(k.weapon) === 'knife' || !gunKind(k.weapon)) continue;
    let list = byKiller.get(k.killer);
    if (!list) byKiller.set(k.killer, (list = []));
    list.push(k);
  }
  const out = [];
  for (const kills of byKiller.values()) {
    const groups = {};
    const fights = [];
    const bursts = [];
    for (const k of kills) {
      const group = groupOf(k.weapon);
      const g = (groups[group] ??= [0, 0]);
      g[0]++;
      if (k.headshot) g[1]++;
      // One kill at a time, so that the measure keeps the weapon of its kill.
      for (const e of aimStats.engagements(hulls, tracks, shots, [k])) fights.push({ e0: e.e0, toShot: e.toShot, peak: e.peak, shotErr: e.shotErr, low: e.low, group });
      const burst = shotsOfKill(tracks, byPlayer, k);
      if (burst.length) bursts.push({ group, head: Boolean(k.headshot), shots: burst });
    }
    out.push({ kills: kills.length, heads: kills.filter((k) => k.headshot).length, groups, fights, bursts });
  }
  return out;
}

/** The value at part `p` of a sorted list. */
const at = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : NaN);
const sortedOf = (values) => values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
/** The middle value of a list. */
export const median = (values) => at(sortedOf(values), 0.5);

/** The spread of a list: {n, p10, p25, p50, p75, p90}. */
export function spread(values) {
  const s = sortedOf(values);
  return { n: s.length, p10: at(s, 0.1), p25: at(s, 0.25), p50: at(s, 0.5), p75: at(s, 0.75), p90: at(s, 0.9) };
}

/**
 * The error of a number that is made from many demos: the demos are drawn again `times` times, each time as many
 * as there are and any demo as often as it comes, and the number is made from each draw. The spread of those
 * numbers (their standard deviation) is the error. A demo is drawn whole, because the kills of one match are not
 * independent of each other.
 */
export function errorOf(demos, stat, random, times = 200) {
  const values = [];
  for (let k = 0; k < times; k++) {
    const draw = [];
    for (let i = 0; i < demos.length; i++) draw.push(demos[Math.floor(random() * demos.length)]);
    const v = stat(draw);
    if (Number.isFinite(v)) values.push(v);
  }
  if (values.length < 2) return NaN;
  const mean = values.reduce((n, v) => n + v, 0) / values.length;
  return Math.sqrt(values.reduce((n, v) => n + (v - mean) ** 2, 0) / (values.length - 1));
}

/**
 * The aim of the players of many demos. `demos` is [[player facts]] (playerFacts of each demo); `group` keeps the
 * kills of one weapon group, or all when null. Gives:
 * - head: the share of the kills with a shot to the head: {all, error, players: spread of the players' own shares};
 * - for each measure of MEASURES: {all: spread over every kill, error of its middle, players: spread of the
 *   players' own middles}.
 */
export function aimOf(demos, random, group = null) {
  const killsOf = (p) => (group ? p.groups[group] ?? [0, 0] : [p.kills, p.heads]);
  const fightsOf = (p) => (group ? p.fights.filter((f) => f.group === group) : p.fights);
  const headShare = (list) => {
    let kills = 0;
    let heads = 0;
    for (const demo of list) for (const p of demo) [kills, heads] = [kills + killsOf(p)[0], heads + killsOf(p)[1]];
    return kills ? heads / kills : NaN;
  };
  const players = demos.flat();
  const out = {
    demos: demos.length,
    kills: players.reduce((n, p) => n + killsOf(p)[0], 0),
    head: {
      all: headShare(demos),
      error: errorOf(demos, headShare, random),
      players: spread(players.filter((p) => killsOf(p)[0] >= MIN_KILLS).map((p) => killsOf(p)[1] / killsOf(p)[0])),
    },
    measures: {},
  };
  for (const [key] of MEASURES) {
    const valuesOf = (list) => list.flatMap((demo) => demo.flatMap((p) => fightsOf(p).map((f) => f[key])));
    out.measures[key] = {
      all: spread(valuesOf(demos)),
      error: errorOf(demos, (list) => median(valuesOf(list)), random, 100),
      players: spread(players.filter((p) => fightsOf(p).length >= MIN_FIGHTS).map((p) => median(fightsOf(p).map((f) => f[key])))),
    };
  }
  return out;
}

/**
 * The shots of the kills by their number in the burst (SHOT_STEPS). `bursts` is [{shots}] of one kind, or of many
 * demos as [[{shots}]] with `random` for the error of each middle. For each step: {title, n, low: spread of the
 * units under the head, lowError, side: spread, error: spread of the degrees, length: shots of a kill (spread)}.
 */
export function burstSteps(demos, random = null) {
  const grouped = Array.isArray(demos[0]) ? demos : [demos];
  const valuesOf = (list, first, last, k) => {
    const out = [];
    for (const demo of list) for (const b of demo) for (let i = first - 1; i < Math.min(last, b.shots.length); i++) out.push(b.shots[i][k]);
    return out;
  };
  return SHOT_STEPS.map(([first, last, title]) => ({
    title,
    n: valuesOf(grouped, first, last, 1).length,
    low: spread(valuesOf(grouped, first, last, 1)),
    lowError: random && grouped.length > 1 ? errorOf(grouped, (list) => median(valuesOf(list, first, last, 1)), random, 60) : NaN,
    side: spread(valuesOf(grouped, first, last, 2)),
    error: spread(valuesOf(grouped, first, last, 0)),
  }));
}
