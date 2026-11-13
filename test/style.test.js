// The measures of the style of the feet (hosts/csbih/arena.js gauge): a tap of the duck is told from a jump and from
// a stand out of a duck, for a body that the game moves and for the same body played back from a recording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gauge } from '../hosts/csbih/arena.js';
import { csbihMissing, loadCore, loadLevel } from '../hosts/csbih/load.js';

const skip = csbihMissing('de_dust2') ?? false;
const core = skip ? null : await loadCore();
const level = skip ? null : loadLevel(core, 'de_dust2');

// What the hands do, by tick: a tap of the duck from a stand, a run with a tap in it, two full ducks with the
// stand after each, and two jumps.
const SCRIPT = (tick) => ({
  forward: tick >= 200 && tick < 330 ? 1 : 0,
  duck: tick === 100 || tick === 260 || (tick >= 400 && tick < 480) || (tick >= 520 && tick < 600),
  jump: tick === 700 || tick === 850,
});
const TICKS = 1000;

function worldOf(controller) {
  const world = new core.world.World(level.hulls, { nav: level.nav, rules: level.rules });
  const spawn = level.rules.spawns.find((s) => s.side === 'T');
  // The run of the script needs free floor: the way out of the spawn with the most of it.
  const { HULL_STAND, newTrace, traceBox } = core.hull;
  const tr = newTrace();
  const free = (yaw) => {
    const to = [spawn.origin[0] + Math.cos((yaw * Math.PI) / 180) * 600, spawn.origin[1] + Math.sin((yaw * Math.PI) / 180) * 600, spawn.origin[2]];
    traceBox(world.level, HULL_STAND, spawn.origin, to, tr);
    return tr.fraction;
  };
  const yaw = [0, 45, 90, 135, 180, 225, 270, 315].sort((a, b) => free(b) - free(a))[0];
  world.addPlayer({ id: 1, team: 'T', origin: spawn.origin, yaw, controller });
  world.freezeUntil = 0;
  return { world, yaw };
}

/** Runs the world with a gauge on it; `each(world, player, tick)` after each tick. Returns the measures. */
function measured(world, each = () => {}) {
  const g = gauge(core, world, () => 'x', ['x']);
  for (let tick = 0; tick < TICKS; tick++) {
    world.tick = tick;
    world.step();
    g.events(world.events);
    world.events.length = 0;
    g.sample(true);
    each(world, world.players.get(1), tick);
  }
  return g.measure.x;
}

test('a tap of the duck is no jump and a stand out of a duck is no tap: in the game, and from a recording of 17 frames a second', { skip }, () => {
  let tick = 0;
  const live = worldOf({ command: (world, me) => ({ ...SCRIPT(tick++), side: 0, yaw: me.yaw, pitch: 0 }) });
  const track = [];
  const m = measured(live.world, (world, p, t) => track.push({ t, x: p.body.origin[0], y: p.body.origin[1], z: p.body.origin[2], duck: Boolean(p.body.ducked) }));
  assert.deepEqual({ taps: m.taps, run: m.tapsRun, stand: m.tapsStand, fight: m.tapsFight, jumps: m.jumps, flat: m.jumpsFlat }, { taps: 2, run: 1, stand: 1, fight: 0, jumps: 2, flat: 2 });

  // The same feet as a demo holds them: every sixth tick, and a straight line between two of them (rails.js pose).
  const { HULL_STAND, HULL_DUCK, newTrace, traceBox } = core.hull;
  const tr = newTrace();
  for (const every of [6, 3]) {
    const frames = track.filter((f) => f.t % every === 0);
    let now = 0;
    let prev = null;
    const replay = worldOf({
      place: (world, me) => {
        const i = Math.min(frames.length - 2, Math.floor(now / every));
        const a = frames[i];
        const b = frames[i + 1];
        const k = Math.min(1, (now - a.t) / every);
        const at = [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k];
        const dt = world.tickSeconds;
        me.body.velocity = prev ? [(at[0] - prev[0]) / dt, (at[1] - prev[1]) / dt, (at[2] - prev[2]) / dt] : [0, 0, 0];
        prev = at;
        me.body.origin = at;
        me.body.ducked = me.ducked = a.duck;
        traceBox(world.level, a.duck ? HULL_DUCK : HULL_STAND, at, [at[0], at[1], at[2] - 4], tr);
        me.body.onGround = tr.startSolid || tr.fraction < 1;
        now++;
      },
    });
    const r = measured(replay.world);
    assert.deepEqual({ taps: r.taps, run: r.tapsRun, stand: r.tapsStand, jumps: r.jumps, flat: r.jumpsFlat }, { taps: 2, run: 1, stand: 1, jumps: 2, flat: 2 }, `a frame each ${every} ticks`);
  }
});
