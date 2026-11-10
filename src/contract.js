// The host contract (spec 02): the shapes of the map, the frame and the command, and checks that a host adapter
// can run in its tests. The checks are for tests and bring-up; the brain does not call them in play.

/**
 * @typedef {number[]} Vec3 [x, y, z] in world units.
 *
 * @typedef {Object} BotMap The level, given once.
 * @property {string} name
 * @property {{count: number, xyz: Float32Array, offsets: Int32Array, to: Int32Array, kinds: Uint8Array}} nav
 *   Node i is at xyz[3i..3i+2] (a player origin). Its edges are to[offsets[i]..offsets[i+1]), kinds[] in step:
 *   0 walk, 1 drop, 2 jump, 3 ladder.
 * @property {{mins: Vec3, maxs: Vec3}[]} bombSites
 * @property {{mins: Vec3, maxs: Vec3, team: 'T'|'CT'|null}[]} buyZones
 * @property {{team: 'T'|'CT', origin: Vec3, yaw: number}[]} spawns
 * @property {{mins: Vec3, maxs: Vec3, normal: Vec3}[]} ladders The normal points out of the face that is climbed.
 * @property {{team: 'T'|'CT', kind: 'he'|'flash'|'smoke', from: Vec3, velocity: Vec3, at: number}[]} [lineups]
 *   Throws of grenades that players of this map made: where the grenade started, its velocity, and the second of
 *   the round. Optional; without them a bot throws no lineup.
 * @property {{T: {points: number[][], site: number, te: number, share: number, won: number}[], CT: {points: number[][], share: number, won: number}[]}} [plans]
 *   Strategies that teams played on this map: where the five stood (the Ts at second 20 of a round, the CTs at
 *   second 15), for the Ts the site that they took and the second that the first of them stood in it, and the
 *   share of the rounds and of the wins. A place is [x, y, z] or [x, y, z, yaw]: the yaw is the view of the player
 *   who stood there. Optional; without them a team plans by the level alone.
 *
 * @typedef {Object} Ports Queries into the level, inside a tick. Players are never in a trace.
 * @property {(from: Vec3, to: Vec3, out?: {fraction: number, startSolid: boolean, end: Vec3, normal: Vec3}) => number} traceLine
 *   The part of the line that is free, 0 to 1; 1 is clear. `out` takes the hit, with the normal of its surface.
 * @property {(from: Vec3, to: Vec3, ducked: boolean, out?: {fraction: number, startSolid: boolean, end: Vec3}) => number} traceHull
 *   The same for the box of a player (standing or ducked), its centre on the line. A start inside the level is 0.
 *
 * @typedef {Object} Own What a player knows of itself. Null for a player that the brain does not drive.
 * @property {number} money
 * @property {number} armor
 * @property {boolean} helmet
 * @property {boolean} kit The defuse kit.
 * @property {Object<string, {clip: number, reserve: number, count?: number}>} weapons Every weapon carried, by name.
 * @property {number[]} punch The recoil on the view, [pitch, yaw] in degrees.
 * @property {number} zoom The level of the scope, 0 without.
 * @property {number} blindUntil The time until which a flashbang leaves the player blind; 0 for never.
 * @property {number} stamina Over 0 while the last jump still slows the next one.
 * @property {boolean} reloading
 * @property {{at: number, by: (number|string|null)}|null} hurt The last hit taken.
 * @property {boolean} canBuy In a buy zone, in the buy time.
 *
 * @typedef {Object} Player
 * @property {number|string} id
 * @property {'T'|'CT'} team
 * @property {boolean} alive
 * @property {Vec3} origin The centre of the standing box (36 over the feet; 18 when ducked).
 * @property {Vec3} velocity
 * @property {number} yaw
 * @property {number} pitch
 * @property {number} eye The height of the eye over the origin.
 * @property {boolean} ducked
 * @property {boolean} onGround
 * @property {boolean} onLadder
 * @property {number} health
 * @property {string} weapon The weapon in the hand.
 * @property {boolean} silenced The weapon in the hand has its silencer on.
 * @property {Own|null} own
 *
 * @typedef {Object} Frame The game at one tick.
 * @property {number} time Seconds; never goes back in a match.
 * @property {number} dt Seconds since the frame before.
 * @property {{number: number, phase: 'freeze'|'live'|'over', timeLeft: number, c4Timer: number, knives: boolean}} round
 * @property {Player[]} players
 * @property {{state: 'carried'|'dropped'|'planted'|'defused'|'exploded', carrier: (number|string|null), origin: (Vec3|null), explodeAt: (number|null), defuser: (number|string|null), arming: (number|string|null)}|null} bomb
 *   `defuser` and `arming` name the player who defuses or arms the bomb now.
 * @property {{origin: Vec3, radius: number}[]} smokes The smoke clouds that stand now.
 * @property {Object[]} events What happened since the frame before: {type: 'shot', player, weapon, silenced},
 *   {type: 'hurt', player, by}, {type: 'kill', killer, victim}, {type: 'reload', player},
 *   {type: 'planted', player, at}, {type: 'dropped', at}, {type: 'picked', player}, {type: 'defusing', player},
 *   {type: 'defused'}, {type: 'exploded'}.
 *
 * @typedef {Object} Command The keys and the view of one bot for one tick.
 * @property {number} yaw
 * @property {number} pitch
 * @property {number} forward -1 to 1 of the forward key.
 * @property {number} side -1 to 1; positive is to the right.
 * @property {boolean} jump
 * @property {boolean} duck
 * @property {boolean} walk
 * @property {boolean} attack
 * @property {boolean} attack2
 * @property {boolean} use
 * @property {boolean} reload
 * @property {boolean} drop
 * @property {string} [weapon] The weapon to take into the hand.
 * @property {string[]} [buy] Items of the buy menu by name, in order; 'primammo' and 'secammo' fill the ammo.
 */

export const TEAMS = ['T', 'CT'];
export const PHASES = ['freeze', 'live', 'over'];
export const BOMB_STATES = ['carried', 'dropped', 'planted', 'defused', 'exploded'];
export const EVENT_TYPES = ['shot', 'hurt', 'kill', 'reload', 'planted', 'dropped', 'picked', 'defusing', 'defused', 'exploded'];

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(num);
const bool = (v) => typeof v === 'boolean';
const box = (b) => b && vec(b.mins) && vec(b.maxs);

/** The problems of a map, as texts; empty when it is good. */
export function checkMap(map) {
  const bad = [];
  if (typeof map?.name !== 'string') bad.push('map.name');
  const n = map?.nav;
  if (!n || !num(n.count)) bad.push('map.nav.count');
  else {
    if (!(n.xyz instanceof Float32Array) || n.xyz.length !== n.count * 3) bad.push('map.nav.xyz');
    if (!(n.offsets instanceof Int32Array) || n.offsets.length !== n.count + 1) bad.push('map.nav.offsets');
    if (!(n.to instanceof Int32Array) || n.to.length !== n.offsets?.[n.count]) bad.push('map.nav.to');
    if (!(n.kinds instanceof Uint8Array) || n.kinds.length !== n.to?.length) bad.push('map.nav.kinds');
  }
  for (const key of ['bombSites', 'buyZones', 'ladders']) {
    if (!Array.isArray(map?.[key]) || !map[key].every(box)) bad.push(`map.${key}`);
  }
  if (map?.buyZones?.some?.((z) => z.team !== null && !TEAMS.includes(z.team))) bad.push('map.buyZones.team');
  if (map?.ladders?.some?.((l) => !vec(l.normal))) bad.push('map.ladders.normal');
  if (!Array.isArray(map?.spawns) || !map.spawns.every((s) => TEAMS.includes(s.team) && vec(s.origin) && num(s.yaw))) bad.push('map.spawns');
  if (map?.lineups !== undefined && !(Array.isArray(map.lineups) && map.lineups.every((l) => TEAMS.includes(l.team) && ['he', 'flash', 'smoke'].includes(l.kind) && vec(l.from) && vec(l.velocity) && num(l.at)))) bad.push('map.lineups');
  if (map?.plans !== undefined) {
    const place = (p) => Array.isArray(p) && (p.length === 3 || p.length === 4) && p.every(num);
    const plan = (p) => Array.isArray(p?.points) && p.points.every(place) && num(p.share) && num(p.won);
    const ok = Array.isArray(map.plans?.T) && Array.isArray(map.plans?.CT) && map.plans.CT.every(plan) && map.plans.T.every((p) => plan(p) && Number.isInteger(p.site) && num(p.te));
    if (!ok) bad.push('map.plans');
  }
  return bad;
}

function checkOwn(o, at, bad) {
  for (const key of ['money', 'armor', 'zoom', 'blindUntil', 'stamina']) if (!num(o[key])) bad.push(`${at}.${key}`);
  for (const key of ['helmet', 'kit', 'reloading', 'canBuy']) if (!bool(o[key])) bad.push(`${at}.${key}`);
  if (!Array.isArray(o.punch) || o.punch.length !== 2 || !o.punch.every(num)) bad.push(`${at}.punch`);
  if (o.hurt !== null && !(o.hurt && num(o.hurt.at))) bad.push(`${at}.hurt`);
  if (!o.weapons || typeof o.weapons !== 'object') bad.push(`${at}.weapons`);
  else for (const [name, w] of Object.entries(o.weapons)) if (!num(w?.clip) || !num(w?.reserve)) bad.push(`${at}.weapons.${name}`);
}

/** The problems of a frame, as texts; empty when it is good. */
export function checkFrame(frame) {
  const bad = [];
  if (!num(frame?.time)) bad.push('frame.time');
  if (!num(frame?.dt) || frame.dt <= 0) bad.push('frame.dt');
  const r = frame?.round;
  if (!r || !num(r.number) || !PHASES.includes(r.phase) || !num(r.timeLeft) || !num(r.c4Timer) || !bool(r.knives)) bad.push('frame.round');
  if (!Array.isArray(frame?.players)) bad.push('frame.players');
  else {
    frame.players.forEach((p, i) => {
      const at = `frame.players[${i}]`;
      if (p.id === undefined || p.id === null) bad.push(`${at}.id`);
      if (!TEAMS.includes(p.team)) bad.push(`${at}.team`);
      for (const key of ['alive', 'ducked', 'onGround', 'onLadder', 'silenced']) if (!bool(p[key])) bad.push(`${at}.${key}`);
      for (const key of ['origin', 'velocity']) if (!vec(p[key])) bad.push(`${at}.${key}`);
      for (const key of ['yaw', 'pitch', 'eye', 'health']) if (!num(p[key])) bad.push(`${at}.${key}`);
      if (typeof p.weapon !== 'string') bad.push(`${at}.weapon`);
      if (p.own !== null && p.own !== undefined) checkOwn(p.own, `${at}.own`, bad);
    });
  }
  const b = frame?.bomb;
  if (b !== null && b !== undefined) {
    if (!BOMB_STATES.includes(b.state)) bad.push('frame.bomb.state');
    if (b.state !== 'carried' && !vec(b.origin)) bad.push('frame.bomb.origin');
    if (b.state === 'planted' && !num(b.explodeAt)) bad.push('frame.bomb.explodeAt');
  }
  if (!Array.isArray(frame?.smokes) || !frame.smokes.every((s) => vec(s.origin) && num(s.radius))) bad.push('frame.smokes');
  if (!Array.isArray(frame?.events) || !frame.events.every((e) => EVENT_TYPES.includes(e.type))) bad.push('frame.events');
  return bad;
}

/** The problems of a command, as texts; empty when it is good. */
export function checkCommand(cmd) {
  const bad = [];
  for (const key of ['yaw', 'pitch', 'forward', 'side']) if (!num(cmd?.[key])) bad.push(`cmd.${key}`);
  for (const key of ['forward', 'side']) if (num(cmd?.[key]) && Math.abs(cmd[key]) > 1.0001) bad.push(`cmd.${key} out of -1..1`);
  if (num(cmd?.pitch) && Math.abs(cmd.pitch) > 89.0001) bad.push('cmd.pitch out of -89..89');
  for (const key of ['jump', 'duck', 'walk', 'attack', 'attack2', 'use', 'reload', 'drop']) if (!bool(cmd?.[key])) bad.push(`cmd.${key}`);
  if (cmd?.weapon !== undefined && typeof cmd.weapon !== 'string') bad.push('cmd.weapon');
  if (cmd?.buy !== undefined && !(Array.isArray(cmd.buy) && cmd.buy.every((k) => typeof k === 'string'))) bad.push('cmd.buy');
  return bad;
}

/** A command that does nothing, with the view as it is. */
export function idleCommand(yaw = 0, pitch = 0) {
  return { yaw, pitch, forward: 0, side: 0, jump: false, duck: false, walk: false, attack: false, attack2: false, use: false, reload: false, drop: false };
}
