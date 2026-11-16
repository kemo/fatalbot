// What a team knows in a round: the facts that its players saw or heard, as a radio that every call reaches at
// once. A fact has a place and a time; an old one counts less. After the game state of the official CS bot
// (cs_gamestate.cpp) and team-knowledge.js of csbih-player. The team also holds the plan of the round (plan.js).

// A sighting older than this is no longer where the enemy is.
export const SIGHTING_SECONDS = 15;
// A place that a teammate stood in and saw no enemy is clear for this long.
const CLEAR_SECONDS = 20;

export class Team {
  /** `random`: the team's own stream, for the draws that a team makes as one (buy.js teamCall). */
  constructor(side, random = null) {
    this.side = side;
    this.random = random;
    this.reset();
  }

  /** A new round: nothing known, no plan. */
  reset() {
    // enemy id -> {place, point, time}: the last sighting of each enemy.
    this.enemies = new Map();
    // place -> time of the last check that saw nobody.
    this.clear = new Map();
    // place -> [times] of the teammates who died there.
    this.deaths = new Map();
    // The bomb as the team knows it: {state, point, site, time}. `point` is null until a player saw or heard it;
    // `site` is the index of the bomb site, or null while the team does not know it.
    this.bomb = null;
    // The sites that a CT checked after a plant and found empty.
    this.noBomb = new Set();
    this.plan = null;
    // The places that the bots of the team took, so that two do not take the same: kind -> Map(bot id -> point).
    this.taken = new Map();
    // The lineups of the map that a bot of the team took this round (grenades.js), by their index.
    this.thrown = new Set();
    // The flashbangs of the team in the air: [{point, until, by}] (grenades.js).
    this.flashes = [];
    // The teammates asked to make way: bot id -> {dir, until, to} (walk.js makeWay).
    this.way = new Map();
    // The call of the round's buy: 'buy', 'force' or 'save' (buy.js teamCall).
    this.buyCall = null;
    // True once an enemy was alive in this round: with none alive after that, the round is the team's.
    this.enemiesLived = false;
    // The team's calls after a plant, by the players alive ("2v4" -> true: it gives the retake up; tactics.js).
    this.saves = new Map();
    // The time of the first kill of the round that the feed showed, or null.
    this.firstKill = null;
  }

  /** A player of the team sees an enemy. */
  saw(id, point, place, time) {
    this.enemies.set(id, { place, point: [...point], time });
  }

  /** An enemy died: no sighting of it counts. */
  lost(id) {
    this.enemies.delete(id);
  }

  /** A teammate stands in a place and sees no enemy: the place is clear now. */
  cleared(place, time) {
    if (place >= 0) this.clear.set(place, time);
  }

  /** A teammate died in a place. */
  died(place, time) {
    const list = this.deaths.get(place);
    if (list) list.push(time);
    else this.deaths.set(place, [time]);
  }

  /** The enemies seen in the last `seconds`, by place: [{place, count, point, time, ids}], the freshest first. */
  enemiesSeen(time, seconds = SIGHTING_SECONDS) {
    const byPlace = new Map();
    for (const [id, s] of this.enemies) {
      if (time - s.time > seconds) continue;
      const g = byPlace.get(s.place) ?? { place: s.place, count: 0, point: s.point, time: s.time, ids: [] };
      g.count++;
      g.ids.push(id);
      if (s.time > g.time) [g.time, g.point] = [s.time, s.point];
      byPlace.set(s.place, g);
    }
    return [...byPlace.values()].sort((a, b) => b.time - a.time || a.place - b.place);
  }

  /** True when the place was checked in the last CLEAR_SECONDS and no enemy was seen there since. */
  isClear(place, time) {
    const at = this.clear.get(place);
    if (at === undefined || time - at > CLEAR_SECONDS) return false;
    for (const s of this.enemies.values()) if (s.place === place && s.time > at) return false;
    return true;
  }

  /** The teammates who died in a place in the last `seconds`. */
  deathsAt(place, time, seconds = SIGHTING_SECONDS) {
    let n = 0;
    for (const t of this.deaths.get(place) ?? []) if (time - t <= seconds) n++;
    return n;
  }

  /** The points that the other bots of the team took for `kind`. */
  takenBy(kind, except) {
    const out = [];
    for (const [id, point] of this.taken.get(kind) ?? []) if (id !== except) out.push(point);
    return out;
  }

  take(kind, id, point) {
    let map = this.taken.get(kind);
    if (!map) this.taken.set(kind, (map = new Map()));
    if (point) map.set(id, point);
    else map.delete(id);
  }

  /** A player of the team died: the places that it took are free for a teammate that chooses later. */
  free(id) {
    for (const map of this.taken.values()) map.delete(id);
  }
}
