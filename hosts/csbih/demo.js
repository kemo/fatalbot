// A round of a recorded match with fatalbot in the place of one side (the owner's first test of 2026-11-10: "against
// pro players recordings"). The other side plays its recording on the rails of csbih-player (rails.js): each of its
// players is where the demo had it, until it sees, hears or is hit by a player that the demo did not have there.
// From then on it plays as the reference bot with that player's own route and profile, as on the /igraj page.
// fatalbot starts where the demo's players started, with their weapons; there is no buy.

import { csbihHost } from './adapter.js';
import { body, gauge } from './arena.js';

// A round goes on this long past its clock (a planted bomb), then counts as not ended.
const PAST_CLOCK = 60;

/**
 * Plays `round` (one of demoRounds(timeline)) with fatalbot as `side`. `profiles` are the demo's players by entity
 * (load.js loadProfiles); `mapData` is {views, lineups} for the route bots. `hands: 'demo'` gives each fatalbot the
 * motor profile of the player it replaces; `'default'` the default one. With no `side` nobody is replaced: the
 * round is the demo, and the measures are the players' own. `record` (record.js Recorder) takes the round
 * for the player's TV page: the round then runs `tail` seconds past its end, and `gap` seconds pass before the next.
 */
export function playDemoRound({ core, level, timeline, round, side, seed = 1, profiles = {}, mapData = {}, hands = 'demo', record = null, tail = 0, gap = 0, aimStats = null, nades = false, plans = null, standins = 'ref' }) {
  const { World } = core.world;
  const { Rails, railsFor } = core.rails;
  const scenario = core.demoRound.demoRound(timeline, round, { spawns: level.rules.spawns ?? null });
  const world = new World(level.hulls, { nav: level.nav, rules: level.rules, seed });
  world.plan = core.match.planFor(world, scenario.plantedAt);
  world.knifeRound = scenario.knives;
  world.bodyOf = body;
  // fatalbot takes the map's grenade lineups only with `nades` (they cost rounds until a team plan times them).
  const host = csbihHost(core, world, level, { seed, lineups: nades ? mapData.lineups ?? [] : [], plans });
  host.clock = () => round.seconds - world.time;
  const story = core.demoMatch.demoStory(scenario);
  const routeBots = new Map();
  // The bot that plays on for a player who left its recording: the reference bot with that player's route, as the
  // replay page of csbih-player has it, or fatalbot with that player's hand (`standins: 'fatal'`).
  const handoff = (me) => (standins === 'fatal' ? host.controller(me.id, { profile: hands === 'demo' && profiles[me.id]?.profile ? motorOf(profiles[me.id].profile) : {}, person: true }) : routeBots.get(me.id)(world.time));
  const rails = new Rails(world, { timeline, scenario, handoff });
  world.rails = rails;
  const kind = new Map();
  for (const p of scenario.players) {
    const own = profiles[p.id];
    if (p.team === side) {
      kind.set(p.id, 'fatal');
      // The motor numbers only: the places and the guns of a profile belong to the route bots.
      const profile = hands === 'demo' && own?.profile ? motorOf(own.profile) : {};
      world.addPlayer({ ...p, controller: host.controller(p.id, { profile, person: true }) });
      continue;
    }
    kind.set(p.id, 'demo');
    const track = scenario.track(p.id);
    const route = (s) => {
      const at = track(s);
      return at && !at.dead ? at : null;
    };
    const make = (start) => core.bot.botController({ route, start, profile: own?.profile, spots: own?.spots ?? [], throws: scenario.throws(p.id), views: mapData.views ?? null, lineups: mapData.lineups ?? [], story });
    routeBots.set(p.id, make);
    const bot = make(0);
    world.addPlayer({ ...p, controller: railsFor(timeline, p) ? rails.controller(p, bot.skill) : bot });
  }
  if (!world.bomb && scenario.bombAt) world.bomb = { state: 'dropped', carrier: null, busy: null, origin: [...scenario.bombAt] };
  if (record) {
    // On the screen the bots of fatalbot carry its name, in the order of the demo's players; the others their own.
    const names = new Map();
    let n = 0;
    for (const p of scenario.players) names.set(p.id, p.team === side ? `FatalBot | ${++n}` : p.name);
    record.begin(world, { seconds: round.seconds, names, note: `Round ${round.number} of the demo: FatalBot plays the ${side}s. In the demo the ${round.winner}s won it.` });
  }
  // The other side counts apart while it is its recording ('rails': the players themselves) and once it plays on
  // as the reference bot ('standin').
  const kindNow = (id) => (kind.get(id) === 'fatal' ? 'fatal' : world.players.get(id)?.controller?.rails ? 'rails' : 'standin');
  const g = gauge(core, world, kindNow, ['fatal', 'rails', 'standin'], aimStats);
  for (const p of world.players.values()) g.time(p);
  const timed = new Set([...world.players.values()].map((p) => p.controller));
  let result = null;
  let planted = false;
  const limit = (round.seconds + PAST_CLOCK) / world.tickSeconds;
  for (let i = 0; i < limit && !result; i++) {
    const from = world.events.length;
    world.step();
    const events = world.events.slice(from);
    g.events(events);
    record?.step(world, events);
    if (events.some((e) => e.type === 'planted')) planted = true;
    world.events.length = 0;
    // A player that left the rails has another controller: its time counts too.
    for (const p of world.players.values()) {
      if (!timed.has(p.controller)) {
        timed.add(p.controller);
        g.time(p);
      }
    }
    g.sample(true);
    result = core.round.roundResult(world, round.seconds);
  }
  const alive = (team) => [...world.players.values()].filter((p) => p.team === team && p.alive).length;
  const ended = { seconds: world.time, T: alive('T'), CT: alive('CT') };
  if (record) {
    record.end(world, result);
    for (let i = 0; i < tail / world.tickSeconds; i++) {
      const from = world.events.length;
      world.step();
      record.step(world, world.events.slice(from));
      world.events.length = 0;
    }
    record.close(world, gap);
  }
  return {
    number: round.number, side, winner: result?.winner ?? null, reason: result?.reason ?? 'no end', seconds: ended.seconds, planted,
    demo: { winner: round.winner, reason: round.reason, seconds: round.end - round.t0 },
    alive: { T: ended.T, CT: ended.CT }, derails: rails.derails.length, firstDerail: rails.derails[0]?.t ?? null, why: whyOf(rails.derails), measure: g.measure, aim: g.engagements(), bursts: g.bursts(),
  };
}

/** Why the players left their recording, counted by the reason of rails.js. */
function whyOf(derails) {
  const out = {};
  for (const d of derails) out[d.why] = (out[d.why] ?? 0) + 1;
  return out;
}

// The numbers of a hand and an eye that both bots read under the same names.
const MOTOR = ['reaction', 'turnSpeed', 'lookSpring', 'tremor', 'handTime', 'recoilControl', 'headAim', 'fov', 'hearing', 'aggression', 'burstFar', 'burstNear', 'moveInFight', 'duckInFight', 'walkShare', 'knifeRun', 'jumpRate'];

function motorOf(profile) {
  const out = {};
  for (const key of MOTOR) if (typeof profile[key] === 'number') out[key] = profile[key];
  return out;
}
