// The strategies of the recorded matches (the owner's order of 2026-11-10: "analyse all the different strategies on
// all maps we have demos for"). After csbih-player spec 12, section 6: the places of the five players of a side at
// a fixed second of a round are a formation; formations that lie near each other, player for player, are one
// strategy. For each: how often the teams played it, how often it won, which site it led to, and when.
// The result holds places and numbers only: no player, no team, no demo's name.

import { csbihHost } from './adapter.js';
import { siteInfo } from '../../src/sites.js';

// A sample of every player this often (s). The facts of a round keep the places, so an analysis can change without
// reading the demos again.
export const STEP = 2;
// The second of a round at which a side's formation is read: the CTs once they stand, the Ts once their lanes show.
export const FORM_AT = { T: 20, CT: 15 };
// Two formations are one strategy when their players, paired the nearest way, lie this near on average (units).
// At 300 nearly every round of de_dust2 was a strategy of its own (865 of them); at 600 the 21 largest hold 58% of
// the rounds.
export const SAME = 600;
// A T stands in a site this near its middle; the tempo of an attack by the second of the first T there.
const SITE_NEAR = 520;
const SITE_HIGH = 250;
const FAST = 25;
const LATE = 50;
// A strategy goes into a bot's plans with this many rounds and this share of its side's formations.
const MIN_ROUNDS = 5;
const MIN_SHARE = 0.015;
// The medoid of a strategy is looked for among this many of its formations.
const MEDOID_SAMPLE = 60;

const median = (list) => {
  const v = list.filter((x) => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : null;
};

/** The sites of a level as the brain reads them, and the spawns: {sites: [{mid, mins, maxs}], spawn: {T, CT}}. */
export function zonesOf(core, level) {
  const world = new core.world.World(level.hulls, { seed: 1, nav: level.nav, rules: level.rules });
  const brain = csbihHost(core, world, level).brain;
  return {
    sites: brain.map.bombSites.map((box, k) => ({ mid: siteInfo(brain, k).mid.map(Math.round), mins: box.mins, maxs: box.maxs })),
    spawn: { T: brain.spawnMid.T?.map(Math.round) ?? null, CT: brain.spawnMid.CT?.map(Math.round) ?? null },
  };
}

const PRIMARY = new Set(['ak47', 'm4a1', 'galil', 'famas', 'aug', 'sg552', 'awp', 'scout', 'g3sg1', 'sg550', 'm249', 'mp5', 'p90', 'ump45', 'mac10', 'tmp', 'm3', 'xm1014']);
const RIFLE = new Set(['ak47', 'm4a1', 'aug', 'sg552', 'awp', 'g3sg1', 'sg550', 'm249']);

/** The buy of a side from what its players carry: 'pistol' (one primary at most), 'full' (four rifles or more), else 'force'. */
function buyOf(players) {
  const primaries = players.filter((p) => p.weapons.some((w) => PRIMARY.has(w))).length;
  const rifles = players.filter((p) => p.weapons.some((w) => RIFLE.has(w))).length;
  return primaries <= 1 ? 'pistol' : rifles >= 4 ? 'full' : 'force';
}

/**
 * The share of the players of a round that start in free space of the level. A recording that goes on into another
 * map keeps the name of its first one: the players of those rounds start inside the walls of this level. No bot
 * can play such a round, and its places say nothing of this map.
 */
export function demoFits(core, level, timeline, round) {
  const { HULL_STAND, newTrace, traceBox } = core.hull;
  const tr = newTrace();
  const scenario = core.demoRound.demoRound(timeline, round, { spawns: level.rules.spawns ?? null });
  let free = 0;
  for (const p of scenario.players) {
    traceBox(level.hulls, HULL_STAND, p.origin, p.origin, tr);
    if (!tr.startSolid) free++;
  }
  return scenario.players.length ? free / scenario.players.length : 0;
}

/**
 * The facts of the rounds of one timeline: for each round of five against five the winner, the plant, the buys,
 * and each player's place and view ([x, y, z, yaw]) every STEP seconds (null once dead). No name and no entity
 * number goes in. With `level`, a round that does not fit it (demoFits) is left out.
 */
export function roundFacts(core, timeline, level = null) {
  const out = [];
  for (const round of core.demoRound.demoRounds(timeline)) {
    if (round.empty || (round.winner !== 'T' && round.winner !== 'CT')) continue;
    if (level && demoFits(core, level, timeline, round) < 0.5) continue;
    const scenario = core.demoRound.demoRound(timeline, round);
    const sides = { T: scenario.players.filter((p) => p.team === 'T'), CT: scenario.players.filter((p) => p.team === 'CT') };
    if (scenario.knives || sides.T.length !== 5 || sides.CT.length !== 5) continue;
    const length = round.end - round.t0;
    const lanes = { T: [], CT: [] };
    for (const side of ['T', 'CT']) {
      for (const p of sides[side]) {
        const track = scenario.track(p.id);
        const lane = [];
        for (let s = 0; s <= length; s += STEP) {
          const a = track(s);
          lane.push(!a || a.dead ? null : [Math.round(a.x), Math.round(a.y), Math.round(a.z), Math.round(a.yaw)]);
        }
        lanes[side].push(lane);
      }
    }
    let plant = null;
    if (scenario.plantedAt) {
      const spot = (timeline.bombSpots ?? []).find((b) => b.kind === 'planted' && b.t0 >= round.t0 && b.t0 <= round.end);
      plant = { t: Math.round((spot.t0 - round.t0) * 10) / 10, at: scenario.plantedAt.map(Math.round) };
    }
    out.push({ seconds: Math.round(length), winner: round.winner, plant, buy: { T: buyOf(sides.T), CT: buyOf(sides.CT) }, T: lanes.T, CT: lanes.CT });
  }
  return out;
}

const near = (p, site) => Math.hypot(p[0] - site.mid[0], p[1] - site.mid[1]) < SITE_NEAR && Math.abs(p[2] - site.mid[2]) < SITE_HIGH;

/** The site that the Ts of a round took and the second that the first of them stood in it: {site, te}; site null for none. */
export function attackOf(zones, round) {
  let site = null;
  if (round.plant) {
    site = 0;
    zones.sites.forEach((s, k) => {
      if (Math.hypot(s.mid[0] - round.plant.at[0], s.mid[1] - round.plant.at[1]) < Math.hypot(zones.sites[site].mid[0] - round.plant.at[0], zones.sites[site].mid[1] - round.plant.at[1])) site = k;
    });
  } else {
    // No plant: the site that the Ts stood in the most.
    const stood = zones.sites.map((s) => round.T.reduce((n, lane) => n + lane.filter((p) => p && near(p, s)).length, 0));
    const most = Math.max(0, ...stood);
    if (most >= 2) site = stood.indexOf(most);
  }
  if (site === null) return { site: null, te: null };
  const steps = Math.max(...round.T.map((l) => l.length));
  for (let i = 0; i < steps; i++) if (round.T.some((l) => l[i] && near(l[i], zones.sites[site]))) return { site, te: i * STEP };
  return { site, te: round.plant?.t ?? null };
}

// The 120 ways to pair five with five.
const PAIRINGS = (() => {
  const out = [];
  const go = (rest, done) => {
    if (!rest.length) out.push(done);
    for (let i = 0; i < rest.length; i++) go([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, rest[i]]);
  };
  go([0, 1, 2, 3, 4], []);
  return out;
})();

/** How far two formations of five lie apart: the mean distance of their players, paired the nearest way. */
export function formationGap(a, b) {
  const d = [];
  for (let i = 0; i < 5; i++) {
    d.push([]);
    for (let j = 0; j < 5; j++) d[i].push(Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1], a[i][2] - b[j][2]));
  }
  let best = Infinity;
  for (const p of PAIRINGS) {
    const sum = d[0][p[0]] + d[1][p[1]] + d[2][p[2]] + d[3][p[3]] + d[4][p[4]];
    if (sum < best) best = sum;
  }
  return best / 5;
}

/**
 * Groups formations: each goes to the nearest group within SAME, else starts one; then each group takes as its face
 * the formation nearest all its others (the medoid), and the formations are dealt once more to the nearest face.
 * Returns [{points, members: [index]}], the largest first. The order of the formations decides ties.
 */
export function groupFormations(forms) {
  let faces = [];
  const deal = () => {
    const groups = faces.map(() => []);
    forms.forEach((f, n) => {
      let best = -1;
      let bestD = SAME;
      faces.forEach((face, k) => {
        const d = formationGap(f, face);
        if (d < bestD) [best, bestD] = [k, d];
      });
      if (best < 0) {
        faces.push(f);
        groups.push([n]);
      } else groups[best].push(n);
    });
    return groups;
  };
  let groups = deal();
  faces = groups.map((members) => {
    const step = Math.max(1, Math.floor(members.length / MEDOID_SAMPLE));
    const sample = members.filter((_, i) => i % step === 0);
    let best = sample[0];
    let bestSum = Infinity;
    for (const a of sample) {
      let sum = 0;
      for (const b of sample) sum += formationGap(forms[a], forms[b]);
      if (sum < bestSum) [best, bestSum] = [a, sum];
    }
    return forms[best];
  });
  groups = deal();
  return groups.map((members, k) => ({ points: faces[k], members })).filter((g) => g.members.length).sort((a, b) => b.members.length - a.members.length);
}

/**
 * The strategies of a map from the facts of its rounds: {rounds, tWon, sites, buys, T: [strategy], CT: [strategy]}.
 * A strategy: {points (five places, each [x, y, z, yaw]: where a player stood and looked), rounds, share, won (by its own side), sites (the share of its rounds that went
 * to each site), none, te, plantAt, planted}.
 */
export function strategiesOf(zones, rounds) {
  const attacks = rounds.map((r) => attackOf(zones, r));
  const found = { rounds: rounds.length, tWon: rounds.filter((r) => r.winner === 'T').length / Math.max(1, rounds.length) };
  found.sites = zones.sites.map((_, k) => {
    const mine = rounds.map((_r, i) => i).filter((i) => attacks[i].site === k);
    return {
      rounds: mine.length, share: mine.length / Math.max(1, rounds.length), won: mine.length ? mine.filter((i) => rounds[i].winner === 'T').length / mine.length : null,
      planted: mine.length ? mine.filter((i) => rounds[i].plant).length / mine.length : null, te: median(mine.map((i) => attacks[i].te)),
    };
  });
  found.noAttack = attacks.filter((a) => a.site === null).length / Math.max(1, rounds.length);
  const tempo = { fast: [0, 0], mid: [0, 0], late: [0, 0] };
  rounds.forEach((r, i) => {
    const te = attacks[i].te;
    if (te === null) return;
    const t = tempo[te <= FAST ? 'fast' : te <= LATE ? 'mid' : 'late'];
    t[0]++;
    if (r.winner === 'T') t[1]++;
  });
  found.tempo = Object.fromEntries(Object.entries(tempo).map(([k, [n, w]]) => [k, { rounds: n, tWon: n ? w / n : null }]));
  const buys = {};
  for (const r of rounds) {
    const b = (buys[`${r.buy.T} against ${r.buy.CT}`] ??= { rounds: 0, tWon: 0 });
    b.rounds++;
    if (r.winner === 'T') b.tWon++;
  }
  found.buys = Object.entries(buys).sort((a, b) => b[1].rounds - a[1].rounds).map(([name, b]) => ({ name, rounds: b.rounds, tWon: b.tWon / b.rounds }));
  for (const side of ['T', 'CT']) {
    const at = Math.round(FORM_AT[side] / STEP);
    const forms = [];
    const from = [];
    rounds.forEach((r, i) => {
      const f = r[side].map((lane) => lane[at] ?? null);
      if (f.every(Boolean)) {
        forms.push(f);
        from.push(i);
      }
    });
    found[`${side}whole`] = forms.length / Math.max(1, rounds.length);
    found[side] = groupFormations(forms).map((g) => {
      const mine = g.members.map((n) => from[n]);
      const wins = mine.filter((i) => rounds[i].winner === side).length;
      const sites = zones.sites.map((_, k) => mine.filter((i) => attacks[i].site === k).length / mine.length);
      const main = sites.indexOf(Math.max(...sites));
      const toMain = mine.filter((i) => attacks[i].site === main);
      return {
        points: g.points, rounds: mine.length, share: mine.length / Math.max(1, forms.length), won: wins / mine.length, sites,
        none: mine.filter((i) => attacks[i].site === null).length / mine.length,
        te: median(toMain.map((i) => attacks[i].te)), plantAt: median(toMain.map((i) => rounds[i].plant?.t ?? null)),
        planted: mine.filter((i) => rounds[i].plant).length / mine.length,
      };
    });
  }
  return found;
}

/**
 * The plans of a map for the brain (spec 02, map.plans): the strategies that the teams of the demos played often
 * enough. {T: [{points, site, te, share, won}], CT: [{points, share, won}]}. A plan of the Ts names the site that
 * most of its rounds went to, and the second that the first T stood in it.
 */
export function plansOf(found) {
  const keep = (s) => s.rounds >= MIN_ROUNDS && s.share >= MIN_SHARE;
  const T = found.T.filter(keep).filter((s) => Math.max(...s.sites) >= 0.4 && s.te !== null).map((s) => ({ points: s.points, site: s.sites.indexOf(Math.max(...s.sites)), te: s.te, share: s.share, won: s.won }));
  const CT = found.CT.filter(keep).map((s) => ({ points: s.points, share: s.share, won: s.won }));
  return { T, CT };
}
