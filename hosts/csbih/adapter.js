// The csbih host: joins the brain to a World of csbih-player's game core (spec 02). It makes the map from a built
// level, a frame from the world at each tick, answers the ports with the level's traces, and gives each bot a
// controller that the world asks for a command. No Node API: the same file serves the browser. `core` holds the
// modules of the game core ({hull, economy, bomb}); the caller imports them (load.js in Node).

import { createBrain } from '../../src/brain.js';

// The smoke cloud of the game core (grenade.js SMOKE_RADIUS).
const SMOKE_RADIUS = 115;
// The round clock of a world that no match runs.
const NO_CLOCK = 9999;
const TEAM = { 1: 'T', 2: 'CT' };
const EVENTS = new Set(['shot', 'hurt', 'kill', 'reload', 'planted', 'dropped', 'picked', 'defusing', 'defused', 'exploded']);

/** The map of the brain from a built level: {map, nav, rules} (load.js loadLevel, or the page's own load). */
export function mapOf(core, level, { lineups = [], plans = null } = {}) {
  const { rules, nav } = level;
  return {
    // The strategies of the map, mined by tools/strategies.js of this repository (load.js loadPlans).
    ...(plans ? { plans } : {}),
    // The throws that csbih-player mined for the map from all its demos (out/profiles/throws-<map>.json).
    lineups: lineups.map((l) => ({ team: l.side, kind: l.kind, from: [...l.from], velocity: [...l.velocity], at: l.s })),
    name: level.map,
    nav: { count: nav.count, xyz: nav.xyz, offsets: nav.offsets, to: nav.to, kinds: nav.kinds },
    bombSites: core.bomb.bombSites(rules).map((b) => ({ mins: [...b.mins], maxs: [...b.maxs] })),
    buyZones: (rules.buyZones ?? []).map((z) => ({ mins: [...z.mins], maxs: [...z.maxs], team: TEAM[z.team] ?? null })),
    spawns: (rules.spawns ?? []).filter((s) => s.side === 'T' || s.side === 'CT').map((s) => ({ team: s.side, origin: [...s.origin], yaw: s.yaw ?? 0 })),
    ladders: (rules.ladders ?? []).map((l) => ({ mins: [...l.mins], maxs: [...l.maxs], normal: [...(l.normal ?? [0, 0, 0])] })),
  };
}

/**
 * The host of one world. `level` is {map, nav, rules}; `seed` gives the brain's random; `lineups` are the map's
 * throws (load.js loadMapData).
 * Use: `host.controller(id)` as the controller of each bot's player. The host reads the world's events by itself.
 * A match tells the clock with `host.clock = () => secondsLeft` and its end with `host.over = () => boolean`, and
 * sets `host.round` at each round's start.
 */
export function csbihHost(core, world, level, { seed = 1, lineups = [], plans = null } = {}) {
  const { HULL_POINT, HULL_STAND, HULL_DUCK, newTrace, traceBox } = core.hull;
  const hulls = world.level;
  const tr = newTrace();
  const ports = {
    traceLine(from, to, out) {
      traceBox(hulls, HULL_POINT, from, to, tr);
      const fraction = tr.startSolid ? 0 : tr.fraction;
      if (out) {
        out.fraction = fraction;
        out.startSolid = tr.startSolid;
        for (let k = 0; k < 3; k++) {
          out.end[k] = tr.end[k];
          out.normal[k] = tr.normal[k];
        }
      }
      return fraction;
    },
    traceHull(from, to, ducked, out) {
      // The players stand in a box trace of the game core; the contract's trace is the level alone.
      const movers = hulls.movers;
      hulls.movers = null;
      traceBox(hulls, ducked ? HULL_DUCK : HULL_STAND, from, to, tr);
      hulls.movers = movers;
      const fraction = tr.startSolid ? 0 : tr.fraction;
      if (out) {
        out.fraction = fraction;
        out.startSolid = tr.startSolid;
        out.end[0] = tr.end[0];
        out.end[1] = tr.end[1];
        out.end[2] = tr.end[2];
      }
      return fraction;
    },
  };
  const brain = createBrain({ map: mapOf(core, level, { lineups, plans }), ports, seed });
  const mine = new Set();
  let pending = [];
  let built = -1;

  const host = {
    brain,
    ports,
    round: 1,
    clock: null,
    over: null,

    /** The frame of the world now (spec 02). */
    frame() {
      const time = world.time;
      const players = [];
      for (const p of world.players.values()) {
        if (p.team !== 'T' && p.team !== 'CT') continue;
        const body = p.body;
        const gun = p.guns.get(p.weapon);
        players.push({
          id: p.id, team: p.team, alive: Boolean(p.alive), origin: body.origin, velocity: body.velocity, yaw: p.yaw, pitch: p.pitch,
          eye: body.eye, ducked: Boolean(body.ducked), onGround: Boolean(body.onGround), onLadder: Boolean(body.onLadder), health: p.health,
          weapon: p.weapon, silenced: Boolean(gun?.silenced), own: mine.has(p.id) ? ownOf(p, gun) : null,
        });
      }
      const b = world.bomb;
      const smokes = [];
      for (const g of world.grenades) if (g.kind === 'smoke' && g.burst !== null && !g.done) smokes.push({ origin: g.cloud ?? g.pos, radius: SMOKE_RADIUS });
      const events = pending;
      pending = [];
      const left = host.clock ? host.clock() : NO_CLOCK;
      return {
        time,
        dt: world.tickSeconds,
        round: { number: host.round, phase: time < world.freezeUntil ? 'freeze' : left <= 0 || host.over?.() ? 'over' : 'live', timeLeft: Math.max(0, left), c4Timer: world.c4Timer ?? core.bomb.C4_SECONDS, knives: Boolean(world.knifeRound) },
        players,
        bomb: b ? {
          state: b.state, carrier: b.carrier ?? null, origin: b.origin ?? null, explodeAt: b.explodeAt ?? null,
          defuser: b.busy?.kind === 'defuse' ? b.busy.player : null, arming: b.busy?.kind === 'arm' ? b.busy.player : null,
        } : null,
        smokes,
        events,
      };
    },

    /**
     * The controller of the bot that plays `id`. `profile` overrides the brain's default profile. `person: true`
     * leaves out the `bot` mark, so the route bots of a demo round answer this player as they answer a member.
     */
    controller(id, { profile = {}, person = false } = {}) {
      mine.add(id);
      const bot = brain.join(id, { profile });
      return {
        bot: !person,
        fatal: true,
        skill: bot.skill,
        // What the tools of csbih-player read from a bot's controller.
        get state() {
          const s = brain.bots.get(id).s;
          return { lastGoal: s.lastGoal ?? null, target: s.target ? world.players.get(s.target.id) ?? null : null, seenAt: s.seenAt, firstSeen: s.firstSeen, stuckFor: s.stuckFor };
        },
        command(w, me) {
          if (built !== w.tick) {
            built = w.tick;
            brain.frame(host.frame());
          }
          const cmd = brain.think(id);
          if (cmd.buy) {
            for (const key of cmd.buy) {
              if (key === 'primammo') core.economy.buyAmmo(w, me, 1, true);
              else if (key === 'secammo') core.economy.buyAmmo(w, me, 2, true);
              else core.economy.buy(w, me, key);
            }
          }
          return cmd;
        },
      };
    },

    /** Takes the events of a step (the host wraps world.step for this; a caller that steps by itself can call it). */
    heard(events) {
      for (const e of events) {
        if (EVENTS.has(e.type)) pending.push(e);
      }
    },
  };

  function ownOf(p, gun) {
    const weapons = {};
    for (const [key, g] of p.guns) weapons[key] = { clip: g.clip ?? 0, reserve: g.reserve ?? 0, count: g.count };
    return {
      money: p.money ?? 0, armor: p.armor ?? 0, helmet: Boolean(p.helmet), kit: Boolean(p.kit), weapons,
      punch: p.punch, zoom: p.zoom ?? 0, blindUntil: p.blind?.blindUntil ?? 0, stamina: p.body.stamina ?? 0,
      reloading: gun?.reloadEnd !== null && gun?.reloadEnd !== undefined,
      hurt: p.lastHurt ? { at: p.lastHurt.at, by: p.lastHurt.by ?? null } : null,
      canBuy: core.economy.cannotBuy(world, p) === null,
    };
  }

  // The events of each step: the world keeps them only until its caller clears them.
  const step = world.step.bind(world);
  world.step = () => {
    const from = world.events.length;
    step();
    host.heard(world.events.slice(from));
  };
  return host;
}
