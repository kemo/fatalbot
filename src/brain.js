// The brain: one for a match, for every bot of both teams that it drives. A host gives it the map once, a frame
// each tick, and takes a command for each bot (spec 02). The order of a tick follows the bot of csbih-player
// (bot.js command): look, decide, fight or look about, walk, the hand's small rules, the bomb.

import { eyeOf, yawTo } from './geometry.js';
import { seeded } from './random.js';
import { navOf } from './nav.js';
import { placesOf } from './places.js';
import { Team } from './team.js';
import { census, listen, look, track } from './senses.js';
import { lookAt } from './aim.js';
import { noiseAim, restLook, viewOpen } from './watch.js';
import { giveUp, leaveLadder, restStuck, walkTo } from './walk.js';
import { fight, startFight } from './fight.js';
import { decide, forgetGoal } from './tactics.js';
import { buyList } from './buy.js';
import { flashToAvoid, lineupThrow } from './grenades.js';
import { planRound, updatePlan } from './plan.js';
import { idleCommand } from './contract.js';
import { WEAPONS, bestGun, isGrenade, isMelee, isPistol } from './weapons.js';

/** A player of no special skill: the motor profile of the reference bots (csbih-player bot.js DEFAULT_PROFILE). */
export const DEFAULT_PROFILE = {
  // Seconds from the first sight of an enemy to the first shot.
  reaction: 0.28,
  // Degrees a second the view turns at most; the spring of looking about.
  turnSpeed: 900,
  lookSpring: 60,
  // The hand in a fight (aim.js hand): its tremor in degrees, and a factor on the time of its moves.
  tremor: 0.15,
  handTime: 1,
  // The part of the recoil that the bot pulls back down, 0 to 1.
  recoilControl: 0.6,
  // The part of the aim that goes to the head and not the chest.
  headAim: 0.3,
  // Degrees each side of the view in which the bot notices an enemy; the distance at which a run at its back turns
  // it at once (four times as far a shot).
  fov: 70,
  hearing: 350,
  // The share of the contacts that the player pushes: 0.2 is a middling player of the demos (tactics.js will).
  aggression: 0.2,
  // Shots in a burst far away and near; the part of the fights fought moving and ducked.
  burstFar: 3,
  burstNear: 8,
  moveInFight: 0.25,
  duckInFight: 0.2,
  // On a way: the part of the time walked (shift), the runs with the knife out, jumps a minute, and the chance
  // that one more bunny hop follows a jump.
  walkShare: 0.2,
  knifeRun: 0.2,
  jumpRate: 6,
  hopChain: 0.5,
};

// How often a team looks at its plan again, in seconds.
const PLAN_EVERY = 1;
// How often a bot looks for enemies, in seconds; how long it remembers one it no longer sees.
const LOOK_EVERY = 0.05;
const MEMORY = 2.5;
// Seconds without an enemy after which a pistol drawn in a fight goes back for the rifle.
const RIFLE_BACK = 2;
// An enemy heard or seen keeps the gun out for this long.
const ALERT_SECONDS = 8;
// The tasks that the round waits for, and the seconds of the round clock under which every run is one.
const HURRY = new Set(['fetch', 'search', 'escape', 'stop-defuse', 'guard', 'lineup']);
const HURRY_CLOCK = 30;
// A bot buys this long after the round's start, as a hand goes through the menu.
const BUY_AFTER = [0.4, 2.5];

function midOf(spawns, team) {
  const own = spawns.filter((s) => s.team === team);
  if (!own.length) return null;
  return [0, 1, 2].map((k) => own.reduce((n, s) => n + s.origin[k], 0) / own.length);
}

/**
 * Makes a brain for a map. `ports` are the host's queries (spec 02); `seed` gives the random of every bot.
 * Use: `join(id)` for each bot, then each tick `frame(f)` once and `think(id)` for each bot.
 */
export function createBrain({ map, ports, seed = 1 }) {
  const nav = navOf(map.nav);
  const brain = {
    map, ports, nav, seed,
    random: seeded(seed),
    teams: { T: new Team('T'), CT: new Team('CT') },
    bots: new Map(),
    joined: 0,
    tick: 0,
    round: null,
    now: null,
    census: null,
    // Who fired and who reloads, by player: what every player in earshot hears (senses.js listen).
    shots: new Map(),
    reloads: new Map(),
    spawnMid: { T: midOf(map.spawns, 'T'), CT: midOf(map.spawns, 'CT') },

    /** A bot takes the player `id`. `profile` overrides DEFAULT_PROFILE. */
    join(id, { profile = {} } = {}) {
      const index = brain.joined++;
      const bot = { id, index, side: null, skill: { ...DEFAULT_PROFILE, ...profile }, random: seeded(seed).fork(index + 1), s: newState(), c: null };
      bot.c = { brain, bot, skill: bot.skill, random: bot.random, every: (seconds) => (brain.tick + index) % Math.max(1, Math.round(seconds / brain.now.dt)) === 0 };
      brain.bots.set(id, bot);
      return bot;
    },

    leave(id) {
      brain.bots.delete(id);
    },

    /** The frame of this tick, before any think: the round, the sounds and what the game tells a whole team. */
    frame(frame) {
      brain.tick++;
      brain.now = frame;
      brain.census = census(frame);
      for (const bot of brain.bots.values()) bot.side = brain.census.byId.get(bot.id)?.team ?? bot.side;
      if (frame.round.number !== brain.round) {
        brain.round = frame.round.number;
        brain.shots.clear();
        brain.reloads.clear();
        for (const side of ['T', 'CT']) {
          brain.teams[side].reset();
          brain.teams[side].plan = planRound(brain, side, frame.time);
        }
        for (const bot of brain.bots.values()) {
          bot.s = newState();
          bot.s.buyAt = frame.time + bot.random(BUY_AFTER[0], BUY_AFTER[1]);
        }
      }
      listen(brain, frame);
      if (brain.tick % Math.max(1, Math.round(PLAN_EVERY / frame.dt)) === 0) updatePlan(brain, frame.time);
    },

    /** The command of the bot `id` for this tick. */
    think(id) {
      const bot = brain.bots.get(id);
      const frame = brain.now;
      const me = brain.census?.byId.get(id);
      if (!bot || !me || !me.alive || !me.own || !brain.teams[me.team]) return idleCommand(me?.yaw ?? 0, me?.pitch ?? 0);
      const c = bot.c;
      const other = me.team === 'T' ? 'CT' : 'T';
      c.frame = frame;
      c.time = frame.time;
      c.dt = frame.dt;
      c.tick = brain.tick;
      c.me = me;
      c.own = me.own;
      c.s = bot.s;
      c.team = brain.teams[me.team];
      c.mates = brain.census[me.team].players;
      c.mateCount = brain.census[me.team].alive;
      c.enemyCount = brain.census[other].alive;
      c.lookEvery = Math.max(1, Math.round(LOOK_EVERY / frame.dt)) * frame.dt;
      return command(c);
    },

    /** What a bot is doing, for a tool or a log: {goal, point, target, path}. */
    debug(id) {
      const s = brain.bots.get(id)?.s;
      return s ? { goal: s.lastGoal ?? null, point: s.lastPoint ?? null, target: s.target?.id ?? null, stuckFor: s.stuckFor ?? 0 } : null;
    },
  };
  // The places are cut once a map, not in a tick of a round.
  placesOf(nav, map);
  return brain;
}

function newState() {
  return { target: null, seenAt: -Infinity, lastSeen: null, reactAt: Infinity, burst: 0, burstShots: 0, restUntil: 0, path: null, pathKey: null, pathAt: -Infinity, pathIndex: 0, stuckSince: null, stuckFor: 0, bought: false };
}

/** One tick of one bot. */
function command(c) {
  const { me, own, s, time, frame } = c;
  restStuck(c);
  if (c.every(LOOK_EVERY)) look(c);
  track(c);
  if (s.fresh) {
    s.fresh = false;
    if (s.target) startFight(c);
  }
  // The bot's own jumps of the round, from the round's live start: the hop keeps its count to the profile's.
  if (frame.round.phase !== 'freeze') s.liveAt ??= time;
  if (s.onGround && !me.onGround && !me.onLadder && me.velocity[2] > 200) s.jumps = (s.jumps ?? 0) + 1;
  s.onGround = me.onGround;
  const cmd = idleCommand(me.yaw, me.pitch);
  if (!s.bought && own.canBuy && time >= (s.buyAt ?? 0)) {
    s.bought = true;
    cmd.buy = buyList(c);
  }
  const goal = decide(c);
  s.lastGoal = goal.task ?? goal.kind;
  s.lastPoint = goal.point ?? null;
  // Where the bot goes when no grenade asks for a step aside (grenades.js lineupGoal).
  if (goal.task !== 'lineup' && goal.point) s.goingTo = goal.point;
  const fighting = Boolean(s.target) && time - s.seenAt < MEMORY;
  if (giveUp(c, fighting)) {
    forgetGoal(c);
    s.lastPoint = null;
  }
  let feet = false;
  let heard = null;
  if (fighting) feet = fight(c, cmd);
  else {
    s.target = null;
    // An enemy heard and not seen: the eyes go where it will come from, whatever the goal wants of them.
    heard = goal.kind === 'plant' || (goal.kind === 'defuse' && goal.near) ? null : noiseAim(c);
    if (heard) lookAt(c, cmd, heard.yaw, heard.pitch);
    else if (goal.look) {
      // The view of a defuser stays on the bomb at its feet; any other view that ends in a wall is replaced.
      const rest = goal.rest || (goal.kind !== 'defuse' && !viewOpen(c, eyeOf(me), goal.look.yaw, goal.look.pitch));
      const view = rest ? restLook(c, goal.look) : goal.look;
      lookAt(c, cmd, view.yaw, view.pitch);
    } else if (!goal.point && goal.kind === 'hold') {
      const view = restLook(c);
      lookAt(c, cmd, view.yaw, view.pitch);
    }
    if (me.weapon === 'c4' && goal.kind !== 'plant') cmd.weapon = bestGun(own);
    // The pistol of a fight goes back for the rifle once it is quiet.
    else if (isPistol(me.weapon) && bestGun(own) !== me.weapon && time - s.seenAt > RIFLE_BACK) cmd.weapon = bestGun(own);
  }
  // No hop on a run that the round waits for (moves.js hop).
  c.hurry = HURRY.has(goal.task) || goal.kind === 'defuse' || c.team.bomb?.state === 'planted' || frame.round.timeLeft < HURRY_CLOCK;
  if (!feet && goal.point) {
    walkTo(c, cmd, goal.point, !fighting && !goal.look && !heard);
    if (goal.walk && !fighting) cmd.walk = true;
  }
  if (goal.duck) cmd.duck = true;
  // Danger near (an enemy heard or seen, a hit taken): no knife in the hand.
  const alert = time - (s.alertAt ?? -Infinity) < ALERT_SECONDS || (own.hurt !== null && time - own.hurt.at < ALERT_SECONDS);
  const knives = frame.round.knives;
  if (!fighting && !knives && goal.kind !== 'plant' && isMelee(cmd.weapon ?? me.weapon) && bestGun(own) !== 'knife' && (alert || !(s.knifeOut && goal.point))) cmd.weapon = bestGun(own);
  // A quiet moment: a clip under half is filled again, as players did between fights.
  const gun = own.weapons[me.weapon];
  const full = WEAPONS[me.weapon]?.clip ?? 0;
  if (!fighting && full && gun && gun.clip < full / 2 && gun.reserve > 0 && !own.reloading && time - s.seenAt > 1.5) cmd.reload = true;
  // The bomb: armed with the C4 out and the attack held, defused with use held, both standing still.
  if (goal.kind === 'plant' && !fighting) {
    cmd.weapon = 'c4';
    if (me.weapon === 'c4') {
      cmd.weapon = undefined;
      cmd.attack = true;
      cmd.forward = 0;
      cmd.side = 0;
      cmd.jump = false;
    }
  }
  if (goal.kind === 'defuse' && goal.near && !fighting) {
    cmd.use = true;
    cmd.attack = false;
    cmd.forward = 0;
    cmd.side = 0;
    cmd.jump = false;
  }
  // At the place of a lineup the throw takes the keys and the view.
  const throwing = goal.task === 'lineup' && !fighting && lineupThrow(c, cmd);
  // A grenade in the hand with no throw to make: back to the gun.
  if (!throwing && !fighting && goal.kind !== 'plant' && isGrenade(cmd.weapon ?? me.weapon)) cmd.weapon = bestGun(own);
  // A flashbang of the team is in the air and the eye sees where it goes off: the view turns away from it, as a
  // player turns on the call. A fight goes on: there the enemy is the nearer danger.
  if (!throwing && !fighting) {
    const eye = eyeOf(me);
    const flash = flashToAvoid(c, eye);
    if (flash) lookAt(c, cmd, yawTo(flash, eye), 0);
  }
  leaveLadder(c, cmd);
  if (cmd.weapon === undefined) delete cmd.weapon;
  return cmd;
}
