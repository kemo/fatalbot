// The places of a map: the floors of the nav graph cut into areas that a team can name in a call and that a plan
// can name in a step. A place is the part of a square cell of PLACE_CELL units that the graph joins at one height;
// the floors of a bomb site are one place, and so are the floors of each side's buy zone. A tiny piece joins the
// neighbour that it shares the most edges with. The cut uses integers and the graph's own order, so it is the same
// on every machine. Ported from csbih-player (src/shared/game/places.js).

import { hypot } from './geometry.js';
import { nearestNode } from './nav.js';

// The side of a cell, in units: about the room that one player holds or clears.
export const PLACE_CELL = 384;
// A piece with fewer floors than this joins a neighbour.
const MIN_FLOORS = 12;
// The floors this far around a site's box belong to the site.
const SITE_MARGIN = 48;

/** The places of a graph (cached on it): {regions, of: Int32Array node -> place id, edges, siteIds}. */
export function placesOf(nav, map) {
  return (nav.places ??= cut(nav, map));
}

/** The place of a point (a player's origin), or -1 off the graph. */
export function placeAt(nav, map, point) {
  const n = nearestNode(nav, point, 3, 64);
  return n < 0 ? -1 : placesOf(nav, map).of[n];
}

function inBox(x, y, z, box, margin) {
  return x >= box.mins[0] - margin && x <= box.maxs[0] + margin && y >= box.mins[1] - margin && y <= box.maxs[1] + margin
    && z >= box.mins[2] - 72 && z <= box.maxs[2] + 72;
}

function cut(nav, map) {
  const { count, xyz, offsets, to } = nav;
  const cellOf = (i) => `${Math.floor(xyz[i * 3] / PLACE_CELL)},${Math.floor(xyz[i * 3 + 1] / PLACE_CELL)}`;
  // The fixed groups first: each site, then each side's buy zone.
  const group = new Array(count).fill(null);
  const sites = map.bombSites ?? [];
  sites.forEach((box, k) => {
    for (let i = 0; i < count; i++) if (group[i] === null && inBox(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], box, SITE_MARGIN)) group[i] = `site:${k}`;
  });
  for (const zone of map.buyZones ?? []) {
    if (!zone.team) continue;
    for (let i = 0; i < count; i++) if (group[i] === null && inBox(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], zone, 0)) group[i] = `spawn:${zone.team}`;
  }
  // The rest: the pieces that the graph joins inside each cell (an edge either way joins two floors).
  const back = Array.from({ length: count }, () => []);
  for (let a = 0; a < count; a++) for (let e = offsets[a]; e < offsets[a + 1]; e++) back[to[e]].push(a);
  const of = new Int32Array(count).fill(-1);
  const regions = [];
  const keyOf = (i) => group[i] ?? `cell:${cellOf(i)}`;
  // A site or a spawn is one place, joined by the graph or not.
  const fixed = new Map();
  for (let s = 0; s < count; s++) {
    if (of[s] >= 0) continue;
    const key = keyOf(s);
    if (group[s] !== null && fixed.has(key)) {
      const r = regions[fixed.get(key)];
      of[s] = r.id;
      r.floors++;
      r.sum[0] += xyz[s * 3];
      r.sum[1] += xyz[s * 3 + 1];
      r.sum[2] += xyz[s * 3 + 2];
      continue;
    }
    const id = regions.length;
    if (group[s] !== null) fixed.set(key, id);
    const stack = [s];
    of[s] = id;
    let n = 0;
    const sum = [0, 0, 0];
    while (stack.length) {
      const a = stack.pop();
      n++;
      sum[0] += xyz[a * 3];
      sum[1] += xyz[a * 3 + 1];
      sum[2] += xyz[a * 3 + 2];
      const join = (b) => {
        if (of[b] < 0 && keyOf(b) === key) {
          of[b] = id;
          stack.push(b);
        }
      };
      for (let e = offsets[a]; e < offsets[a + 1]; e++) join(to[e]);
      for (const b of back[a]) join(b);
    }
    regions.push({ id, key, floors: n, sum });
  }
  for (const r of regions) r.center = r.sum.map((v) => Math.round(v / r.floors));
  // The tiny pieces join the neighbour they share the most edges with (never a site or a spawn into a cell).
  const neighbours = (id) => {
    const counts = new Map();
    for (let a = 0; a < count; a++) {
      if (of[a] !== id) continue;
      for (let e = offsets[a]; e < offsets[a + 1]; e++) if (of[to[e]] !== id) counts.set(of[to[e]], (counts.get(of[to[e]]) ?? 0) + 1);
      for (const b of back[a]) if (of[b] !== id) counts.set(of[b], (counts.get(of[b]) ?? 0) + 1);
    }
    return counts;
  };
  for (const r of regions) {
    if (r.floors >= MIN_FLOORS || !r.key.startsWith('cell:')) continue;
    let best = -1;
    let most = 0;
    for (const [id, c] of neighbours(r.id)) if (regions[id].floors > 0 && c > most) [best, most] = [id, c];
    // A piece that no edge joins (a loose floor of the build): the nearest large place at about its height.
    if (best < 0) {
      let near = Infinity;
      for (const o of regions) {
        if (o === r || o.floors < MIN_FLOORS || Math.abs(o.center[2] - r.center[2]) > 96) continue;
        const d = hypot(o.center[0] - r.center[0], o.center[1] - r.center[1]);
        if (d < near) [best, near] = [o.id, d];
      }
    }
    if (best < 0) continue;
    for (let a = 0; a < count; a++) if (of[a] === r.id) of[a] = best;
    regions[best].floors += r.floors;
    r.floors = 0;
  }
  // Number the places that remain, and name them.
  const kept = regions.filter((r) => r.floors > 0);
  const renumber = new Map(kept.map((r, i) => [r.id, i]));
  for (let a = 0; a < count; a++) of[a] = renumber.get(of[a]);
  const out = kept.map((r, i) => {
    const [kind, value] = r.key.split(':');
    const site = kind === 'site' ? Number(value) : null;
    return { id: i, center: r.center, floors: r.floors, site, spawn: kind === 'spawn' ? value : null, name: site !== null ? `site ${site + 1}` : kind === 'spawn' ? `${value} spawn` : `p${i}` };
  });
  // Which places touch: an edge between their floors.
  const edges = out.map(() => new Set());
  for (let a = 0; a < count; a++) for (let e = offsets[a]; e < offsets[a + 1]; e++) if (of[a] !== of[to[e]]) edges[of[a]].add(of[to[e]]);
  return { regions: out, of, edges: edges.map((s) => [...s].sort((x, y) => x - y)), siteIds: sites.map((_, k) => out.findIndex((r) => r.site === k)) };
}
