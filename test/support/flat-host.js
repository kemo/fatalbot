// A host of the tests with no game behind it: a flat floor of nav nodes, one wall, and frames made by hand.
// The wall is the plane x = WALL_X for y from -WALL_HALF to WALL_HALF: a line that crosses it is blocked.

export const WALL_X = 320;
export const WALL_HALF = 200;
const STEP = 32;

/**
 * A flat map: `size` x `size` floors, STEP apart, around the origin, each joined to its eight neighbours. `spawns`
 * gives the x of the T and the CT spawn.
 */
export function flatMap({ sites = [], size: SIZE = 24, spawns = [-300, 300] } = {}) {
  const count = SIZE * SIZE;
  const xyz = new Float32Array(count * 3);
  const edges = [];
  const at = (i, j) => i * SIZE + j;
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const n = at(i, j);
      xyz[n * 3] = (i - SIZE / 2) * STEP;
      xyz[n * 3 + 1] = (j - SIZE / 2) * STEP;
      xyz[n * 3 + 2] = 36;
      const list = [];
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if ((di || dj) && i + di >= 0 && i + di < SIZE && j + dj >= 0 && j + dj < SIZE) list.push(at(i + di, j + dj));
        }
      }
      edges.push(list);
    }
  }
  const offsets = new Int32Array(count + 1);
  for (let n = 0; n < count; n++) offsets[n + 1] = offsets[n] + edges[n].length;
  const to = new Int32Array(edges.flat());
  return {
    name: 'flat',
    nav: { count, xyz, offsets, to, kinds: new Uint8Array(to.length) },
    bombSites: sites,
    buyZones: [],
    spawns: [{ team: 'T', origin: [spawns[0], 0, 36], yaw: 0 }, { team: 'CT', origin: [spawns[1], 0, 36], yaw: 180 }],
    ladders: [],
  };
}

/** The ports of the flat map: the wall stops a line and a box; nothing else does. `half` is half the wall's length. */
export function flatPorts({ half = WALL_HALF } = {}) {
  const blocked = (a, b) => {
    if ((a[0] - WALL_X) * (b[0] - WALL_X) >= 0) return false;
    const t = (WALL_X - a[0]) / (b[0] - a[0]);
    return Math.abs(a[1] + (b[1] - a[1]) * t) <= half;
  };
  return {
    traceLine: (a, b) => (blocked(a, b) ? 0.5 : 1),
    traceHull(a, b, ducked, out) {
      const fraction = blocked(a, b) ? 0.5 : 1;
      if (out) {
        out.fraction = fraction;
        out.startSolid = false;
        for (let k = 0; k < 3; k++) out.end[k] = a[k] + (b[k] - a[k]) * fraction;
      }
      return fraction;
    },
  };
}

const OWN = () => ({
  money: 800, armor: 0, helmet: false, kit: false, weapons: { knife: { clip: 0, reserve: 0 }, ak47: { clip: 30, reserve: 90 } }, punch: [0, 0], zoom: 0,
  blindUntil: 0, stamina: 0, reloading: false, hurt: null, canBuy: false,
});

/** A player of a frame; `own: true` for a player that the brain drives. */
export function player(id, team, origin, { yaw = 0, own = false, ...rest } = {}) {
  return {
    id, team, alive: true, origin: [...origin], velocity: [0, 0, 0], yaw, pitch: 0, eye: 17, ducked: false, onGround: true, onLadder: false, health: 100,
    weapon: 'ak47', silenced: false, own: own ? OWN() : null, ...rest,
  };
}

/** A frame at `tick` of a 10 ms clock. */
export function frameAt(tick, players, { bomb = null, events = [], phase = 'live' } = {}) {
  return { time: tick * 0.01, dt: 0.01, round: { number: 1, phase, timeLeft: 100, c4Timer: 35, knives: false }, players, bomb, smokes: [], events };
}

/**
 * Runs the bot `id` for `ticks` against frames of standing players and applies only its view: enough to see what
 * it decides. `players(tick)` gives the players of a tick; the bot's own yaw and pitch follow its commands.
 */
export function run(brain, id, ticks, players, extra = () => ({})) {
  const commands = [];
  let yaw = null;
  let pitch = 0;
  for (let tick = 1; tick <= ticks; tick++) {
    const list = players(tick);
    const me = list.find((p) => p.id === id);
    if (yaw !== null) {
      me.yaw = yaw;
      me.pitch = pitch;
    }
    brain.frame(frameAt(tick, list, extra(tick)));
    const cmd = brain.think(id);
    yaw = cmd.yaw;
    pitch = cmd.pitch;
    commands.push(cmd);
  }
  return commands;
}
