// fatalbot as a kind of bots for the arena (arena.js): one host and one brain for a world, a controller for each
// of its players, kept through the rounds of a match.

import { csbihHost } from './adapter.js';

/** `profile` overrides the default motor profile of every bot of this kind; `lineups` and `plans` are the map's data. */
export function fatalKind(core, level, { profile = {}, name = 'fatal', lineups = [], plans = null } = {}) {
  let host = null;
  const controllers = new Map();
  return {
    name,
    attach(world, { seed = 1 } = {}) {
      host = csbihHost(core, world, level, { seed, lineups, plans });
    },
    round(world, player, match) {
      if (match && !host.clock) {
        host.clock = () => match.clock();
        host.over = () => match.result !== null;
      }
      if (match) host.round = match.number;
      if (!controllers.has(player.id)) controllers.set(player.id, host.controller(player.id, { profile }));
      player.controller = controllers.get(player.id);
    },
    host: () => host,
  };
}
