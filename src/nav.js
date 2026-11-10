// The navigation graph of a level and the way through it: a floor every 32 units, the walks between floors, the
// drops off a ledge, the jumps up onto one and the ladders. Points are player origins (36 over the feet).
// Ported from csbih-player (src/shared/game/nav.js): the search and its tie order are the same, so both walk the
// same ways. The brain keeps its own index and caches; it writes nothing into the host's graph.

import { hypot } from './geometry.js';

export const WALK = 0;
export const DROP = 1;
export const JUMP = 2;
export const LADDER = 3;
const CELL = 32;
// A jump costs as much as this much more walk: a way takes it only to save the way round.
const KIND_COST = [0, 16, 48, 32];

/**
 * The graph of the brain from the arrays of the map (spec 02): {count, xyz, offsets, to, kinds}. The arrays are
 * shared with the host and never written.
 */
export function navOf(raw) {
  const { count, xyz, offsets, to, kinds } = raw;
  const cells = new Map();
  for (let i = 0; i < count; i++) {
    const key = cellKey(xyz[i * 3], xyz[i * 3 + 1]);
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  }
  return { count, xyz, offsets, to, kinds, cells, search: null, floods: null, floodStack: null, parts: null };
}

const cellKey = (x, y) => Math.floor(x / CELL + 0.5) * 65536 + Math.floor(y / CELL + 0.5);
export const nodePoint = (nav, i) => [nav.xyz[i * 3], nav.xyz[i * 3 + 1], nav.xyz[i * 3 + 2]];

/**
 * The node nearest a point: the cells around it, out to `reach` cells; height counts twice, and a node more than
 * `rise` above or below is no floor of that point. -1 when none.
 */
export function nearestNode(nav, p, reach = 4, rise = Infinity) {
  const cx = Math.floor(p[0] / CELL + 0.5);
  const cy = Math.floor(p[1] / CELL + 0.5);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= reach; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const list = nav.cells.get((cx + dx) * 65536 + cy + dy);
        if (!list) continue;
        for (const i of list) {
          const o = i * 3;
          if (Math.abs(nav.xyz[o + 2] - p[2]) > rise) continue;
          const d = (nav.xyz[o] - p[0]) ** 2 + (nav.xyz[o + 1] - p[1]) ** 2 + ((nav.xyz[o + 2] - p[2]) * 2) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    // A node found in this ring is as near as any further out can be, near enough.
    if (best >= 0 && r >= 1) break;
  }
  return best;
}

/** The search arrays of a graph, allocated once: a node's slot counts for a search only while its stamp is that search's number. */
function searchOf(nav) {
  return nav.search ??= {
    gen: 0,
    stamp: new Uint32Array(nav.count),
    closed: new Uint32Array(nav.count),
    g: new Float64Array(nav.count),
    parent: new Int32Array(nav.count),
    kind: new Uint8Array(nav.count),
    prio: new Float64Array(1024),
    node: new Int32Array(1024),
    size: 0,
  };
}

function heapPush(s, value, priority) {
  if (s.size === s.node.length) {
    const prio = new Float64Array(s.size * 2);
    prio.set(s.prio);
    s.prio = prio;
    const node = new Int32Array(s.size * 2);
    node.set(s.node);
    s.node = node;
  }
  const { prio, node } = s;
  let i = s.size++;
  prio[i] = priority;
  node[i] = value;
  while (i > 0) {
    const up = (i - 1) >> 1;
    if (prio[up] <= prio[i]) break;
    const p = prio[up];
    const n = node[up];
    prio[up] = prio[i];
    node[up] = node[i];
    prio[i] = p;
    node[i] = n;
    i = up;
  }
}

function heapPop(s) {
  const { prio, node } = s;
  const top = node[0];
  const last = --s.size;
  if (last > 0) {
    prio[0] = prio[last];
    node[0] = node[last];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < last && prio[l] < prio[m]) m = l;
      if (r < last && prio[r] < prio[m]) m = r;
      if (m === i) break;
      const p = prio[m];
      const n = node[m];
      prio[m] = prio[i];
      node[m] = node[i];
      prio[i] = p;
      node[i] = n;
      i = m;
    }
  }
  return top;
}

// The start nodes whose floods stay cached: a few KB each.
const FLOODS = 2048;

/** True when the graph has a way from one node to another. One flood per start node serves every target. */
export function canReach(nav, from, to) {
  const floods = (nav.floods ??= new Map());
  let bits = floods.get(from);
  if (!bits) {
    if (floods.size >= FLOODS) floods.clear();
    bits = new Uint8Array((nav.count >> 3) + 1);
    const stack = (nav.floodStack ??= new Int32Array(nav.count));
    let top = 0;
    stack[top++] = from;
    bits[from >> 3] |= 1 << (from & 7);
    while (top) {
      const at = stack[--top];
      for (let e = nav.offsets[at]; e < nav.offsets[at + 1]; e++) {
        const next = nav.to[e];
        if (bits[next >> 3] & (1 << (next & 7))) continue;
        bits[next >> 3] |= 1 << (next & 7);
        stack[top++] = next;
      }
    }
    floods.set(from, bits);
  }
  return Boolean(bits[to >> 3] & (1 << (to & 7)));
}

/**
 * The shortest way between two nodes (A*): [{point, kind, node}] from the first to the last; null when none.
 * `avoid` holds edges to leave out, as `from * nav.count + to`. `cost(node)` adds to the price of a step onto a
 * node (a place of danger). The order of the heap decides ties: keep it when this changes.
 */
export function findPath(nav, from, to, limit = 20000, avoid = null, cost = null) {
  if (from < 0 || to < 0) return null;
  const { xyz, offsets } = nav;
  const dist = (a, b) => hypot(xyz[a * 3] - xyz[b * 3], xyz[a * 3 + 1] - xyz[b * 3 + 1], xyz[a * 3 + 2] - xyz[b * 3 + 2]);
  const s = searchOf(nav);
  if (++s.gen === 0xffffffff) {
    s.stamp.fill(0);
    s.closed.fill(0);
    s.gen = 1;
  }
  const { gen, stamp, closed, g, parent, kind } = s;
  s.size = 0;
  stamp[from] = gen;
  g[from] = 0;
  parent[from] = -1;
  kind[from] = WALK;
  heapPush(s, from, dist(from, to));
  let done = 0;
  while (s.size && done < limit) {
    const at = heapPop(s);
    if (at === to) {
      const path = [];
      for (let k = at; k !== -1; k = parent[k]) path.push({ point: nodePoint(nav, k), kind: kind[k], node: k });
      return path.reverse();
    }
    if (closed[at] === gen) continue;
    closed[at] = gen;
    done++;
    for (let e = offsets[at]; e < offsets[at + 1]; e++) {
      const next = nav.to[e];
      if (avoid?.has(at * nav.count + next)) continue;
      // A floor with fewer ways out lies by a wall: the way keeps to the middle of a passage.
      const narrow = 8 - (offsets[next + 1] - offsets[next]);
      const step = g[at] + dist(at, next) * (1 + Math.max(0, narrow) * 0.08) + KIND_COST[nav.kinds[e]] + (cost ? cost(next) : 0);
      if (stamp[next] !== gen || step < g[next]) {
        stamp[next] = gen;
        g[next] = step;
        parent[next] = at;
        kind[next] = nav.kinds[e];
        heapPush(s, next, step + dist(next, to));
      }
    }
  }
  return null;
}

/** The length of a way of findPath, in units. */
export function pathLength(path) {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += hypot(path[i].point[0] - path[i - 1].point[0], path[i].point[1] - path[i - 1].point[1], path[i].point[2] - path[i - 1].point[2]);
  return sum;
}

/** The parts of the graph that edges join, either way (cached): Int32Array node -> part id. */
export function navParts(nav) {
  if (nav.parts) return nav.parts;
  const back = Array.from({ length: nav.count }, () => []);
  for (let a = 0; a < nav.count; a++) for (let e = nav.offsets[a]; e < nav.offsets[a + 1]; e++) back[nav.to[e]].push(a);
  const parts = new Int32Array(nav.count).fill(-1);
  for (let s = 0, id = 0; s < nav.count; s++, id++) {
    if (parts[s] >= 0) continue;
    const stack = [s];
    parts[s] = id;
    while (stack.length) {
      const a = stack.pop();
      for (let e = nav.offsets[a]; e < nav.offsets[a + 1]; e++) {
        const b = nav.to[e];
        if (parts[b] < 0) {
          parts[b] = id;
          stack.push(b);
        }
      }
      for (const b of back[a]) {
        if (parts[b] < 0) {
          parts[b] = id;
          stack.push(b);
        }
      }
    }
  }
  nav.parts = parts;
  return parts;
}

/**
 * Whether the graph has a way from a player's floor to a point. Off the graph it cannot tell, and says yes: a bot
 * sent to a box top with no edge up to it walks into the box.
 */
export function reaches(nav, origin, point) {
  if (!nav) return true;
  const from = nearestNode(nav, origin, 3, 48);
  const to = nearestNode(nav, point, 4, 64);
  if (from < 0) return true;
  if (to < 0) return false;
  return canReach(nav, from, to);
}
