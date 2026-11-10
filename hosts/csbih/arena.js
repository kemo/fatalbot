// A match of bots in the csbih host, with the measures of spec 01, section 4. Five players a side on the spawns of
// the level; each side is driven by a "kind" of bot. The measures read the players from outside (place, view, last
// command, events), never the state of a bot, so they count the same for every kind.

const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// The body of a player for a bullet, as tools/check-stuck.js of csbih-player builds it: a head box and a body box.
const body = (p) => ({
  x: p.body.origin[0], y: p.body.origin[1], z: p.body.origin[2], yaw: p.yaw, matrices: [ID],
  boxes: [
    { bone: 0, group: 1, min: [-6, -6, p.body.ducked ? 6 : 16], max: [6, 6, p.body.ducked ? 18 : 30] },
    { bone: 0, group: 2, min: [-14, -14, -36], max: [14, 14, p.body.ducked ? 6 : 16] },
  ],
});

// G3 (spec 01): sampled this often; a spell counts from this length; a fight is a shot or a hurt this fresh.
const SAMPLE_TICKS = 10;
const SPELL = 1.5;
const FIGHT_MEMORY = 2.5;
const WALL_GAP = 40;
const STUCK_CIRCLE = 16;
// A round that runs this long after its clock is a round that cannot end.
const ROUND_LIMIT = 240;

const now = () => globalThis.performance.now();

/**
 * The reference bots: the bots of csbih-player with no route and no player's profile. `views` and `lineups` are the
 * map's data of all demos (load.js loadMapData), or null and [].
 */
export function referenceKind(core, { views = null, lineups = [] } = {}) {
  return {
    name: 'ref',
    round(world, player) {
      player.controller = core.bot.botController({ profile: {}, spots: [], views, lineups });
      core.economy.botBuy(world, player, { guns: [] });
    },
  };
}

/**
 * Plays one match and returns its rounds and measures. `sides` gives the kind of each side: {T: kind, CT: kind}; a
 * kind is {name, round(world, player), attach?(world), afterStep?(world, events)}.
 */
export function runMatch({ core, level, sides, seed = 1, rounds = 12, options = {} }) {
  const { World } = core.world;
  const { Match } = core.match;
  const { HULL_POINT, newTrace, traceBox } = core.hull;
  const world = new World(level.hulls, { seed, nav: level.nav, rules: level.rules });
  world.bodyOf = body;
  const kindOf = new Map();
  let id = 0;
  for (const side of ['T', 'CT']) {
    const spawns = level.rules.spawns.filter((s) => s.side === side);
    if (spawns.length < 5) throw new Error(`${level.map} has ${spawns.length} spawns for ${side}.`);
    for (let i = 0; i < 5; i++) {
      id++;
      world.addPlayer({ id, name: `${side}${i + 1}`, team: side, origin: spawns[i].origin, yaw: spawns[i].yaw ?? 0 });
      kindOf.set(id, sides[side]);
    }
  }
  const kinds = [...new Set(Object.values(sides))];
  for (const kind of kinds) kind.attach?.(world);

  const measure = Object.fromEntries(kinds.map((k) => [k.name, { alive: 0, wall: 0, stuck: 0, ms: 0, commands: 0, kills: 0, deaths: 0, headshots: 0 }]));
  const timed = new WeakSet();
  const time = (player) => {
    const c = player.controller;
    if (!c?.command || timed.has(c)) return;
    timed.add(c);
    const m = measure[kindOf.get(player.id).name];
    const command = c.command.bind(c);
    c.command = (w, me) => {
      const t = now();
      const cmd = command(w, me);
      m.ms += now() - t;
      m.commands++;
      return cmd;
    };
  };
  const match = new Match(world, { ...options, last: rounds }, {
    newRound: () => {
      for (const p of world.players.values()) {
        kindOf.get(p.id).round(world, p);
        time(p);
      }
    },
  });

  const tr = newTrace();
  const watch = new Map([...world.players.keys()].map((k) => [k, { fightAt: -Infinity, wallSince: null, stuckSince: null, stuckAt: null }]));
  const played = [];
  let round = null;
  let ticks = 0;
  let stepMs = 0;
  while (!match.over) {
    const from = world.events.length;
    const t = now();
    world.step();
    match.tick();
    stepMs += now() - t;
    ticks++;
    const events = world.events.slice(from);
    for (const kind of kinds) kind.afterStep?.(world, events);
    for (const e of events) {
      if (e.type === 'round' && e.phase === 'start') round = { number: e.number, startAt: world.time, planted: false, kills: { T: 0, CT: 0 } };
      else if (e.type === 'round' && e.phase === 'end') played.push({ number: e.number, winner: e.winner, reason: e.reason, seconds: world.time - match.liveAt, planted: round.planted, kills: round.kills });
      else if (e.type === 'planted') round.planted = true;
      else if (e.type === 'shot') watch.get(e.player).fightAt = world.time;
      else if (e.type === 'hurt') watch.get(e.player).fightAt = world.time;
      else if (e.type === 'kill') {
        const victim = world.players.get(e.victim);
        const killer = world.players.get(e.killer);
        measure[kindOf.get(victim.id).name].deaths++;
        if (killer && killer.team !== victim.team) {
          const m = measure[kindOf.get(killer.id).name];
          m.kills++;
          if (e.headshot) m.headshots++;
          round.kills[killer.team]++;
        }
      }
    }
    world.events.length = 0;
    const live = match.result === null && world.time >= world.freezeUntil;
    if (ticks % SAMPLE_TICKS === 0) {
      const dt = (SAMPLE_TICKS * world.tickSeconds);
      for (const p of world.players.values()) {
        const w = watch.get(p.id);
        const m = measure[kindOf.get(p.id).name];
        if (!live || !p.alive || world.time - w.fightAt < FIGHT_MEMORY) {
          w.wallSince = null;
          w.stuckSince = null;
          if (live && p.alive) m.alive += dt;
          continue;
        }
        m.alive += dt;
        const o = p.body.origin;
        const eye = [o[0], o[1], o[2] + p.body.eye];
        const a = (p.yaw * Math.PI) / 180;
        traceBox(world.level, HULL_POINT, eye, [eye[0] + Math.cos(a) * WALL_GAP, eye[1] + Math.sin(a) * WALL_GAP, eye[2]], tr);
        w.wallSince = tr.fraction < 1 ? w.wallSince ?? world.time : null;
        if (w.wallSince !== null) m.wall += spell(world.time - w.wallSince, dt);
        const wants = Boolean(p.lastCmd?.forward || p.lastCmd?.side);
        if (!wants || !w.stuckAt || Math.hypot(o[0] - w.stuckAt[0], o[1] - w.stuckAt[1], o[2] - w.stuckAt[2]) > STUCK_CIRCLE) {
          w.stuckAt = [...o];
          w.stuckSince = wants ? world.time : null;
        }
        if (w.stuckSince !== null) m.stuck += spell(world.time - w.stuckSince, dt);
      }
    }
    if (match.result === null && world.time - match.liveAt > (match.options.roundTime ?? 105) + ROUND_LIMIT) throw new Error(`Round ${match.number} on ${level.map} (seed ${seed}) does not end.`);
  }
  return { map: level.map, seed, sides: { T: sides.T.name, CT: sides.CT.name }, score: { ...match.score }, rounds: played, measure, ticks, stepMs };
}

/** The seconds that a spell adds at one sample: nothing before SPELL, all of it when it reaches SPELL, then the step. */
function spell(length, dt) {
  if (length < SPELL) return 0;
  return length - dt < SPELL ? length : dt;
}

/** Sums matches into one table: rounds, wins by side and by kind, the reasons, and the measures by kind. */
export function summarize(matches) {
  const out = { matches: matches.length, rounds: 0, bySide: { T: 0, CT: 0 }, byKind: {}, reasons: {}, plants: 0, seconds: 0, noKillTimeouts: 0, measure: {}, ticks: 0, stepMs: 0 };
  for (const m of matches) {
    out.ticks += m.ticks;
    out.stepMs += m.stepMs;
    for (const r of m.rounds) {
      out.rounds++;
      out.seconds += r.seconds;
      if (r.planted) out.plants++;
      out.reasons[r.reason] = (out.reasons[r.reason] ?? 0) + 1;
      if (r.reason === 'Target_Saved' && r.kills.T + r.kills.CT === 0) out.noKillTimeouts++;
      if (!r.winner) continue;
      out.bySide[r.winner]++;
      const kind = m.sides[r.winner];
      out.byKind[kind] = (out.byKind[kind] ?? 0) + 1;
    }
    for (const [kind, v] of Object.entries(m.measure)) {
      const sum = (out.measure[kind] ??= { alive: 0, wall: 0, stuck: 0, ms: 0, commands: 0, kills: 0, deaths: 0, headshots: 0 });
      for (const k of Object.keys(sum)) sum[k] += v[k];
    }
  }
  return out;
}
