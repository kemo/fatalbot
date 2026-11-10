// A match of bots in the csbih host, with the measures of spec 01, section 4. Five players a side on the spawns of
// the level; each side is driven by a "kind" of bot. The measures read the players from outside (place, view, last
// command, events), never the state of a bot, so they count the same for every kind.

const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** The body of a player for a bullet, as tools/check-stuck.js of csbih-player builds it: a head box and a body box. */
export const body = (p) => ({
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
// A jump counts where the feet leave the floor at this speed or more (a jump starts at 268).
const JUMP_RISE = 200;
// A round that runs this long after its clock is a round that cannot end.
const ROUND_LIMIT = 240;

const now = () => globalThis.performance.now();
const blank = () => ({ alive: 0, wall: 0, stuck: 0, ms: 0, commands: 0, kills: 0, deaths: 0, headshots: 0, jumps: 0, shots: 0, shotsMoving: 0 });

/**
 * The measures of a world by kind of bot. `kindOf(id)` names the kind of a player. Call `events(list)` with the
 * events of each step, `sample(live)` after each step, and `time(player)` once a controller is set.
 */
export function gauge(core, world, kindOf, names) {
  const { HULL_POINT, newTrace, traceBox } = core.hull;
  const tr = newTrace();
  const measure = Object.fromEntries(names.map((n) => [n, blank()]));
  const watch = new Map();
  const of = (id) => {
    let w = watch.get(id);
    if (!w) watch.set(id, (w = { fightAt: -Infinity, wallSince: null, wallGoal: null, stuckSince: null, stuckGoal: null, stuckAt: null, ground: true }));
    return w;
  };
  const timed = new WeakSet();
  let ticks = 0;
  // The spells that counted, for a look at where a kind stands or stares: {kind, type, seconds, at, goal}.
  const spells = [];
  const end = (type, p, since, goal) => {
    if (since === null || since === undefined || world.time - since < SPELL) return;
    spells.push({ kind: kindOf(p.id), type, seconds: world.time - since, at: p.body.origin.map(Math.round), goal, team: p.team });
  };
  return {
    measure,
    spells,
    time(player) {
      const c = player.controller;
      const m = measure[kindOf(player.id)];
      if (!c?.command || !m || timed.has(c)) return;
      timed.add(c);
      const command = c.command.bind(c);
      c.command = (w, me) => {
        const t = now();
        const cmd = command(w, me);
        m.ms += now() - t;
        m.commands++;
        return cmd;
      };
    },
    events(events) {
      for (const e of events) {
        if (e.type === 'shot') {
          of(e.player).fightAt = world.time;
          const p = world.players.get(e.player);
          const m = measure[kindOf(e.player)];
          if (p && m && !e.stab && e.weapon !== 'knife') {
            m.shots++;
            if (Math.hypot(p.body.velocity[0], p.body.velocity[1]) > 140) m.shotsMoving++;
          }
        } else if (e.type === 'hurt') of(e.player).fightAt = world.time;
        else if (e.type === 'kill') {
          const victim = world.players.get(e.victim);
          const killer = world.players.get(e.killer);
          if (victim && measure[kindOf(victim.id)]) measure[kindOf(victim.id)].deaths++;
          if (killer && victim && killer.team !== victim.team && measure[kindOf(killer.id)]) {
            measure[kindOf(killer.id)].kills++;
            if (e.headshot) measure[kindOf(killer.id)].headshots++;
          }
        }
      }
    },
    sample(live) {
      ticks++;
      for (const p of world.players.values()) {
        const m = measure[kindOf(p.id)];
        if (!m || !p.alive) continue;
        const w = of(p.id);
        // A jump: off the floor with the speed of one.
        if (live && w.ground && !p.body.onGround && p.body.velocity[2] > JUMP_RISE) m.jumps++;
        w.ground = Boolean(p.body.onGround);
      }
      if (ticks % SAMPLE_TICKS) return;
      const dt = SAMPLE_TICKS * world.tickSeconds;
      for (const p of world.players.values()) {
        const m = measure[kindOf(p.id)];
        if (!m) continue;
        const w = of(p.id);
        const goal = p.controller?.state?.lastGoal ?? null;
        if (!live || !p.alive || world.time - w.fightAt < FIGHT_MEMORY) {
          end('wall', p, w.wallSince, w.wallGoal);
          end('stuck', p, w.stuckSince, w.stuckGoal);
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
        if (tr.fraction >= 1) {
          end('wall', p, w.wallSince, w.wallGoal);
          w.wallSince = null;
        } else if (w.wallSince === null) [w.wallSince, w.wallGoal] = [world.time, goal];
        if (w.wallSince !== null) m.wall += spell(world.time - w.wallSince, dt);
        const wants = Boolean(p.lastCmd?.forward || p.lastCmd?.side);
        if (!wants || !w.stuckAt || Math.hypot(o[0] - w.stuckAt[0], o[1] - w.stuckAt[1], o[2] - w.stuckAt[2]) > STUCK_CIRCLE) {
          end('stuck', p, w.stuckSince, w.stuckGoal);
          w.stuckAt = [...o];
          w.stuckSince = wants ? world.time : null;
          w.stuckGoal = goal;
        }
        if (w.stuckSince !== null) m.stuck += spell(world.time - w.stuckSince, dt);
      }
    },
  };
}

/** The seconds that a spell adds at one sample: nothing before SPELL, all of it when it reaches SPELL, then the step. */
function spell(length, dt) {
  if (length < SPELL) return 0;
  return length - dt < SPELL ? length : dt;
}

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
 * kind is {name, round(world, player, match), attach?(world, {seed})}.
 */
export function runMatch({ core, level, sides, seed = 1, rounds = 12, options = {} }) {
  const { World } = core.world;
  const { Match } = core.match;
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
  for (const kind of kinds) kind.attach?.(world, { seed });
  const g = gauge(core, world, (pid) => kindOf.get(pid).name, kinds.map((k) => k.name));
  const match = new Match(world, { ...options, last: rounds }, {
    newRound: () => {
      for (const p of world.players.values()) {
        kindOf.get(p.id).round(world, p, match);
        g.time(p);
      }
    },
  });
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
    g.events(events);
    for (const e of events) {
      if (e.type === 'round' && e.phase === 'start') round = { number: e.number, planted: false, kills: { T: 0, CT: 0 } };
      else if (e.type === 'round' && e.phase === 'end') played.push({ number: e.number, winner: e.winner, reason: e.reason, seconds: world.time - match.liveAt, planted: round.planted, kills: round.kills });
      else if (e.type === 'planted') round.planted = true;
      else if (e.type === 'kill') {
        const killer = world.players.get(e.killer);
        const victim = world.players.get(e.victim);
        if (killer && victim && killer.team !== victim.team) round.kills[killer.team]++;
      }
    }
    world.events.length = 0;
    g.sample(match.result === null && world.time >= world.freezeUntil);
    if (match.result === null && world.time - match.liveAt > (match.options.roundTime ?? 105) + ROUND_LIMIT) throw new Error(`Round ${match.number} on ${level.map} (seed ${seed}) does not end.`);
  }
  return { map: level.map, seed, sides: { T: sides.T.name, CT: sides.CT.name }, score: { ...match.score }, rounds: played, measure: g.measure, spells: g.spells, ticks, stepMs };
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
    addMeasures(out.measure, m.measure);
  }
  return out;
}

/** Adds the measures of one run (by kind) into a sum. */
export function addMeasures(sum, measure) {
  for (const [kind, v] of Object.entries(measure)) {
    const s = (sum[kind] ??= blank());
    for (const k of Object.keys(s)) s[k] += v[k];
  }
  return sum;
}

const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '-');

/** One line of the measures of a kind, for a tool's report. */
export function measureLine(kind, m) {
  return `${kind.padEnd(8)} G3 wall ${pct(m.wall, m.alive)}  stuck ${pct(m.stuck, m.alive)}  |  G5 ${((m.ms / Math.max(1, m.commands)) * 10).toFixed(3)} ms for ten bots a tick  |  kills ${m.kills} deaths ${m.deaths} headshots ${pct(m.headshots, m.kills)}  |  jumps a minute ${(m.jumps / Math.max(1, m.alive / 60)).toFixed(1)}  shots on the run ${pct(m.shotsMoving, m.shots)}`;
}
