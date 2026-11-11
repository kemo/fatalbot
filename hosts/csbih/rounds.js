// The shape of a round: who dies first, whether and when the bomb is planted, how many players each side has at
// that moment, and when the Ts come into a site. The same measures for the recorded matches and for a kind of bots
// show where the bots' rounds go another way than the players' (spec 01, gates G2 and G4).
// A round is a round of strategies.js roundFacts: the place of every player each STEP seconds, null once dead.

import { STEP, attackOf } from './strategies.js';

// A player stands in a site this near its middle (strategies.js).
const SITE_NEAR = 520;
const SITE_HIGH = 250;
// The fight for a site is read again this long after the first T stood in it.
const LATER = 10;
// Where the CTs stand is read at this second: a CT further than OUT from the middle of every site is out of the sites.
const OUT_AT = 16;
const OUT = 800;
// A side is ahead with this many more players alive; the state is read from this second on, before a plant.
const AHEAD = 2;
const AHEAD_FROM = 20;
// How much a player moves in the quiet part of a round (from second OUT_AT to the first death or the plant): a
// step of STEP seconds under STAND units is a stand, one under SHIFT a small step.
const STAND = 16;
const SHIFT = 100;

const near = (p, site) => Math.hypot(p[0] - site.mid[0], p[1] - site.mid[1]) < SITE_NEAR && Math.abs(p[2] - site.mid[2]) < SITE_HIGH;
const share = (n, of) => (of ? n / of : NaN);

/**
 * The shape of one round: {winner, seconds, buy, first: {side, t} (the first death; 'both' when two sides lost a
 * player in one step), plant: {t, T, CT (alive)}, site, te, entry and later: {T, CT (alive), tAtSite, ctAtSite},
 * ctOut (the share of the living CTs out of the sites at second OUT_AT; null for a round that ends before it),
 * ahead ('CT', 'T' or null: the side that was first AHEAD players ahead from second AHEAD_FROM on, before a plant,
 * with both sides alive), quiet and loud ({T, CT}: [steps, stands, small steps] of the living players of a side
 * from second OUT_AT to the first death, and from the first death to the plant)}.
 * `zones` are the sites of the level (strategies.js zonesOf).
 */
export function shapeOf(zones, round) {
  const steps = Math.max(...round.T.map((l) => l.length), ...round.CT.map((l) => l.length));
  const alive = (side, i) => round[side].filter((l) => i < l.length && l[i]).length;
  const at = (t) => Math.max(0, Math.min(steps - 1, Math.round(t / STEP)));
  let first = null;
  for (let i = 1; i < steps && !first; i++) {
    const t = alive('T', i) < alive('T', i - 1);
    const ct = alive('CT', i) < alive('CT', i - 1);
    if (t || ct) first = { side: t && ct ? 'both' : t ? 'T' : 'CT', t: i * STEP };
  }
  const { site, te } = attackOf(zones, round);
  const count = (i) => ({
    T: alive('T', i), CT: alive('CT', i),
    tAtSite: round.T.filter((l) => l[i] && near(l[i], zones.sites[site])).length,
    ctAtSite: round.CT.filter((l) => l[i] && near(l[i], zones.sites[site])).length,
  });
  const seen = site !== null && te !== null;
  const cts = OUT_AT / STEP < steps ? round.CT.map((l) => l[OUT_AT / STEP]).filter(Boolean) : [];
  const ctOut = cts.length ? share(cts.filter((p) => zones.sites.every((s) => Math.hypot(p[0] - s.mid[0], p[1] - s.mid[1]) > OUT)).length, cts.length) : null;
  let ahead = null;
  const until = round.plant ? Math.min(steps, Math.floor(round.plant.t / STEP)) : steps;
  for (let i = AHEAD_FROM / STEP; i < until && !ahead; i++) {
    const t = alive('T', i);
    const ct = alive('CT', i);
    if (t && ct && Math.abs(ct - t) >= AHEAD) ahead = ct > t ? 'CT' : 'T';
  }
  const quiet = { T: [0, 0, 0], CT: [0, 0, 0] };
  const loud = { T: [0, 0, 0], CT: [0, 0, 0] };
  const quietEnd = Math.min(until, first ? first.t / STEP : steps);
  for (const side of ['T', 'CT']) {
    for (const lane of round[side]) {
      for (let i = OUT_AT / STEP + 1; i <= until && lane[i] && lane[i - 1]; i++) {
        const d = Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]);
        const cell = (i <= quietEnd ? quiet : loud)[side];
        cell[0]++;
        if (d < STAND) cell[1]++;
        else if (d < SHIFT) cell[2]++;
      }
    }
  }
  return {
    winner: round.winner, seconds: round.seconds, buy: round.buy, first, ctOut, ahead, quiet, loud,
    plant: round.plant ? { t: round.plant.t, T: alive('T', at(round.plant.t)), CT: alive('CT', at(round.plant.t)) } : null,
    site, te, entry: seen ? count(at(te)) : null, later: seen ? count(at(te + LATER)) : null,
  };
}

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN);
const middle = (list) => {
  const v = [...list].sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : NaN;
};

/** The measures of many shapes, as rows of a table: [[title, value, unit]] with unit '%', 's' or ''. */
export function shapeTable(shapes) {
  const won = (list) => share(list.filter((r) => r.winner === 'T').length, list.length);
  const firsts = shapes.filter((r) => r.first && r.first.side !== 'both');
  const planted = shapes.filter((r) => r.plant);
  const entered = shapes.filter((r) => r.entry);
  const rows = [
    ['Rounds', shapes.length, ''],
    ['The Ts win', won(shapes), '%'],
    ['The first death is a CT', share(firsts.filter((r) => r.first.side === 'CT').length, firsts.length), '%'],
    ['The Ts win after a CT died first', won(firsts.filter((r) => r.first.side === 'CT')), '%'],
    ['The Ts win after a T died first', won(firsts.filter((r) => r.first.side === 'T')), '%'],
    ['Rounds with a plant', share(planted.length, shapes.length), '%'],
    ['The second of the plant, the middle', middle(planted.map((r) => r.plant.t)), 's'],
    ['The Ts win with a plant', won(planted), '%'],
    ['The Ts win with no plant', won(shapes.filter((r) => !r.plant)), '%'],
    ['Alive at the plant: Ts', mean(planted.map((r) => r.plant.T)), ''],
    ['Alive at the plant: CTs', mean(planted.map((r) => r.plant.CT)), ''],
  ];
  for (const [title, test] of [['two or more Ts ahead', (d) => d >= 2], ['one T ahead', (d) => d === 1], ['the sides level', (d) => d === 0], ['the CTs ahead', (d) => d < 0]]) {
    const group = planted.filter((r) => test(r.plant.T - r.plant.CT));
    rows.push([`Plants with ${title}`, share(group.length, planted.length), '%'], [`The Ts win a plant with ${title}`, won(group), '%']);
  }
  rows.push(
    ['Rounds in which no T stood in a site', share(shapes.length - entered.length, shapes.length), '%'],
    ['The Ts win those rounds', won(shapes.filter((r) => !r.entry)), '%'],
    ['The second of the first T in the site, the middle', middle(entered.map((r) => r.te)), 's'],
    ['At that second: CTs in the site', mean(entered.map((r) => r.entry.ctAtSite)), ''],
    [`${LATER} s later: Ts alive`, mean(entered.map((r) => r.later.T)), ''],
    [`${LATER} s later: CTs alive`, mean(entered.map((r) => r.later.CT)), ''],
    ['A round lasts, the middle', middle(shapes.map((r) => r.seconds)), 's'],
    ...['CT', 'T'].flatMap((side) => {
      const group = shapes.filter((r) => r.ahead === side);
      const name = `the ${side}s were first ${AHEAD} players ahead before a plant`;
      return [[`Rounds in which ${name}`, share(group.length, shapes.length), '%'], [`A plant follows when ${name}`, share(group.filter((r) => r.plant).length, group.length), '%'], [`The Ts win when ${name}`, won(group), '%']];
    }),
    ...[['quiet', `From second ${OUT_AT} to the first death`], ['loud', 'From the first death to the plant']].flatMap(([part, title]) => ['CT', 'T'].flatMap((side) => {
      const sum = (k) => shapes.reduce((n, r) => n + (r[part]?.[side][k] ?? 0), 0);
      const name = `${title}: the steps of ${STEP} s in which a ${side}`;
      return [[`${name} stands (under ${STAND} units)`, share(sum(1), sum(0)), '%'], [`${name} moves under ${SHIFT} units`, share(sum(2), sum(0)), '%']];
    })),
    [`At second ${OUT_AT}: the CTs further than ${OUT} units from every site`, mean(shapes.filter((r) => r.ctOut !== null && r.ctOut !== undefined).map((r) => r.ctOut)), '%'],
  );
  return rows;
}

const BUYS = ['full', 'force', 'pistol'];

/**
 * The buys of each side through its matches: [{side, when, rounds, full, force, pistol}], the last three as
 * shares. `when` is 'all', 'after a win', or the losses in a row before the round ('after 1 loss' to 'after 3
 * losses or more'). `matches` are lists of shapes in the order of play. A round with both sides on pistols after
 * a round with a gun starts a half: it counts for 'all' only, and the count of losses starts again.
 */
export function buyTable(matches) {
  const WHEN = ['all', 'after a win', 'after 1 loss', 'after 2 losses', 'after 3 losses or more'];
  const out = [];
  for (const side of ['T', 'CT']) {
    const cells = new Map(WHEN.map((when) => [when, { full: 0, force: 0, pistol: 0 }]));
    for (const rounds of matches) {
      let lost = 0;
      rounds.forEach((r, i) => {
        if (!r.buy) return;
        cells.get('all')[r.buy[side]]++;
        const last = rounds[i - 1];
        if (!last?.buy) return;
        const pistols = (x) => x.buy.T === 'pistol' && x.buy.CT === 'pistol';
        if (pistols(r) && !pistols(last)) {
          lost = 0;
          return;
        }
        lost = last.winner === side ? 0 : lost + 1;
        cells.get(WHEN[Math.min(lost, 3) + 1])[r.buy[side]]++;
      });
    }
    for (const [when, cell] of cells) {
      const rounds = cell.full + cell.force + cell.pistol;
      out.push({ side, when, rounds, ...Object.fromEntries(BUYS.map((k) => [k, share(cell[k], rounds)])) });
    }
  }
  return out;
}

const PRIMARY = new Set(['ak47', 'm4a1', 'galil', 'famas', 'aug', 'sg552', 'awp', 'scout', 'g3sg1', 'sg550', 'm249', 'mp5navy', 'mp5', 'p90', 'ump45', 'mac10', 'tmp', 'm3', 'xm1014']);
const RIFLE = new Set(['ak47', 'm4a1', 'aug', 'sg552', 'awp', 'g3sg1', 'sg550', 'm249']);

/** The buy of a side of a world from what its players carry, by the rule of strategies.js. */
function buyOf(world, team) {
  const players = [...world.players.values()].filter((p) => p.team === team);
  const primaries = players.filter((p) => [...p.guns.keys()].some((w) => PRIMARY.has(w))).length;
  const rifles = players.filter((p) => [...p.guns.keys()].some((w) => RIFLE.has(w))).length;
  return primaries <= 1 ? 'pistol' : rifles >= 4 ? 'full' : 'force';
}

/**
 * Takes the rounds of a match of bots as the facts of strategies.js. Call `events(list)` with the events of each
 * step and `sample(live)` after each step (`live`: the round runs, out of the freeze time); `rounds` fills.
 */
export function roundSampler(world) {
  const rounds = [];
  const every = Math.round(STEP / world.tickSeconds);
  let cur = null;
  return {
    rounds,
    events(events) {
      for (const e of events) {
        if (e.type === 'round' && e.phase === 'start') cur = { seconds: 0, winner: null, plant: null, buy: null, T: [], CT: [], ids: null, liveAt: null, ticks: 0 };
        else if (!cur) continue;
        else if (e.type === 'planted' && cur.liveAt !== null) cur.plant = { t: Math.round((world.time - cur.liveAt) * 10) / 10, at: world.bomb.origin.map(Math.round) };
        else if (e.type === 'round' && e.phase === 'end') {
          if (cur.liveAt !== null && (e.winner === 'T' || e.winner === 'CT')) {
            const { ids, liveAt, ticks, ...facts } = cur;
            rounds.push({ ...facts, winner: e.winner, seconds: Math.round(world.time - liveAt) });
          }
          cur = null;
        }
      }
    },
    sample(live) {
      if (!cur || !live) return;
      if (cur.liveAt === null) {
        cur.liveAt = world.time;
        cur.ids = { T: [], CT: [] };
        for (const p of world.players.values()) {
          if (!cur.ids[p.team]) continue;
          cur.ids[p.team].push(p.id);
          cur[p.team].push([]);
        }
        cur.buy = { T: buyOf(world, 'T'), CT: buyOf(world, 'CT') };
      }
      if (cur.ticks++ % every) return;
      for (const team of ['T', 'CT']) {
        cur.ids[team].forEach((id, k) => {
          const p = world.players.get(id);
          cur[team][k].push(p?.alive ? [...p.body.origin.map(Math.round), Math.round(p.yaw)] : null);
        });
      }
    },
  };
}
