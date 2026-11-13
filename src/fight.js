// The fight: the gun, the point of the aim, the trigger and the feet, with the reaction, the aim and the recoil
// control of the bot's profile. Ported from csbih-player (bot.js fight); the feet are new (moves.js fightStep).

import { PI, RAD, atan2, cos, eyeOf, forwardOf, hypot, max, min, sin, toward } from './geometry.js';
import { hand, startHand } from './aim.js';
import { approachPoint } from './watch.js';
import { fightStep } from './moves.js';
import { WEAPONS, fightGun, isMelee, isSniper, stillSpeedOf } from './weapons.js';

// At this range and beyond a rifle taps in bursts; nearer it sprays.
const TAP_RANGE = 700;
// The first shot of a fight goes at the end of the flick, before the view settles (the players' first shots missed
// the head by 2 degrees and more); later ones wait for the body.
const FIRST_SHOT_ROOM = 1.5;
// An enemy out of sight: the view leads its last seen run this far, in seconds, then holds there.
const LOST_LEAD = 0.3;
// The aim's point under the middle of the head for a player of no head aim (units), and the spreads of the point.
const AIM_LOW = 10;
const AIM_LOW_SPREAD = 10;
const AIM_SIDE_SPREAD = 4;
// The knife's reach from the eye to the target's middle: the stab and the slash; in stab reach the bot stands.
const KNIFE_STAB = 44;
const KNIFE_SLASH = 60;
const KNIFE_STAND = 36;
// The sight of the enemy this fresh keeps the trigger and the feet with the fight.
const IN_SIGHT = 0.15;
// The part of the strafing fights that a player fires on the run.
const RUN_GUN = 0.35;
// Nearer than this a gun that is not steady yet fires all the same.
const CLOSE_FIRE = 400;
// The bolt of an AWP or a Scout: the game brings the scope back itself after it.
const BOLT = { awp: 1.45, scout: 1.25 };
// The points of a body that a shot can go for: up from the eye and to the side (units). Sight needs one clear line
// (senses.js look), so the drawn point of the aim can lie behind the corner that hides the rest of the body.
const BODY_UP = [4, 0, -7, -17, -29];
const BODY_SIDE = [0, -7, 7];
// Fewer clear points than this: the bot sees a sliver of the enemy and steps WIDE_STEP to the side that shows more,
// for WIDE_SECONDS, as a player widens a peek. Two players that stand at a corner otherwise fire into it.
const WIDE_ENOUGH = 6;
const WIDE_STEP = 32;
const WIDE_SECONDS = 0.4;
// A wall this near the aim point stands behind the enemy, not in front of it.
const WALL_MARGIN = 16;

/** A new enemy in sight: the reaction time starts, and this fight draws how it goes. */
export function startFight(c) {
  const { s, skill, time, random } = c;
  s.reactAt = time + skill.reaction * random(0.8, 1.25);
  startHand(c);
  // The point of this fight: about the head, low or high and to a side as each player's aim went.
  s.aimLow = (1 - skill.headAim) * AIM_LOW + random.gauss() * AIM_LOW_SPREAD;
  s.aimSide = random.gauss() * AIM_SIDE_SPREAD;
  s.burst = 0;
  s.burstShots = 0;
  s.shotGun = null;
  // How this fight goes, as the player's fights went: moving or still, ducked or standing.
  s.strafe = random() < skill.moveInFight;
  // Of the fights on the move, the part fought on the run with no care for the spread. The players of the demos
  // fire about 10 of 100 rifle shots over 140 units a second (docs/measures).
  s.runGun = s.strafe && random() < RUN_GUN;
  s.crouch = random() < skill.duckInFight;
  s.strafeTurn = 0;
  s.aimFix = null;
  s.widen = null;
}

/** The shots of the gun in the hand since the last tick, read off its clip. */
function countShots(c) {
  const { me, own, s, time } = c;
  const clip = own.weapons[me.weapon]?.clip ?? 0;
  if (s.shotGun !== me.weapon) s.shotGun = me.weapon;
  else if (clip < s.shotClip) {
    s.burst += s.shotClip - clip;
    s.burstShots += s.shotClip - clip;
    if (BOLT[me.weapon]) s.boltUntil = time + BOLT[me.weapon];
  }
  s.shotClip = clip;
}

/** True when the shot along the view would meet a teammate before the target. */
function mateInLine(c, cmd, reach) {
  const { me, mates } = c;
  const eye = eyeOf(me);
  const f = forwardOf(cmd.pitch, cmd.yaw);
  for (const p of mates) {
    if (p === me || !p.alive) continue;
    const d = [p.origin[0] - eye[0], p.origin[1] - eye[1], p.origin[2] - eye[2]];
    const along = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (along <= 0 || along >= reach) continue;
    if (hypot(d[0] - f[0] * along, d[1] - f[1] * along) < 20 && Math.abs(d[2] - f[2] * along) < 40) return true;
  }
  return false;
}

/** True when the line of the shot (the view and its punch) meets the level within `reach` less WALL_MARGIN. */
function wallInLine(c, eye, cmd, reach) {
  const f = forwardOf(cmd.pitch + c.own.punch[0], cmd.yaw + c.own.punch[1]);
  const d = max(0, reach - WALL_MARGIN);
  return c.brain.ports.traceLine(eye, [eye[0] + f[0] * d, eye[1] + f[1] * d, eye[2] + f[2] * d]) < 1;
}

/**
 * One tick of the fight with `s.target`. Writes the view, the trigger and, once the bot has reacted and while it
 * sees the enemy, the feet. Returns true when the feet are the fight's: the walk does not take the keys back.
 */
export function fight(c, cmd) {
  const { me, own, s, skill, time, random } = c;
  const target = s.target;
  const gun = fightGun(own);
  if (me.weapon !== gun) cmd.weapon = gun;
  countShots(c);
  const eye = eyeOf(me);
  // Out of sight (the last look did not see it) the bot aims where the enemy was, carried on its way for at most
  // LOST_LEAD seconds: it knows no more, and a wall does not show where the enemy went.
  const lost = time - s.seenAt > c.lookEvery * 1.5 && s.lastSeen;
  const lead = lost ? min(LOST_LEAD, time - s.seenAt) : 0;
  const o = lost ? [s.lastSeen[0] + (s.lastSeenVel?.[0] ?? 0) * lead, s.lastSeen[1] + (s.lastSeenVel?.[1] ?? 0) * lead, s.lastSeen[2]] : target.origin;
  // Behind a wall now: the view holds the place where the enemy comes into sight, not the enemy through the wall.
  const peek = lost ? approachPoint(c, eye, o) : null;
  const headZ = o[2] + (lost ? s.lastSeenEye ?? target.eye : target.eye) + 4;
  const side = atan2(o[1] - eye[1], o[0] - eye[0]) + PI / 2;
  const drawn = [o[0] + cos(side) * s.aimSide, o[1] + sin(side) * s.aimSide, headZ - s.aimLow];
  // At each look the aim goes to a point of the body that the eye sees; the feet widen a narrow view.
  if (!lost && s.seenAt === time) exposure(c, eye, o, drawn, side);
  const fix = lost ? null : s.aimFix;
  const point = peek ?? (fix ? [o[0] + cos(side) * fix[1], o[1] + sin(side) * fix[1], o[2] + target.eye + fix[0]] : drawn);
  const want = toward(eye, point);
  // The recoil it pulls down by its control.
  const off = hand(c, cmd, want.yaw - own.punch[1] * skill.recoilControl, want.pitch - own.punch[0] * skill.recoilControl, want.distance);
  if (time < s.reactAt || time - s.seenAt > IN_SIGHT) return false;
  if (isMelee(gun)) return knifeFight(c, cmd, gun, want, off);
  // The body's half width at that distance, in degrees: aim inside it and fire.
  const room = atan2(14, want.distance) / RAD + 0.5;
  const sniper = isSniper(me.weapon);
  // A sniper looks through the scope far away and fires only through it; near it fights without.
  const wantZoom = sniper && want.distance > 400 ? 1 : 0;
  const bolt = time < (s.boltUntil ?? 0);
  if (sniper && !bolt && own.zoom !== wantZoom && !(wantZoom && own.zoom > 0)) cmd.attack2 = true;
  const scoped = !(sniper && wantZoom && own.zoom === 0);
  // A burst of the player's own length, near and far, then a rest while the accuracy comes back.
  const far = want.distance > TAP_RANGE;
  const w = WEAPONS[me.weapon];
  let resting = time < (s.restUntil ?? 0);
  if (!resting && w?.auto && !sniper && s.burstShots >= max(1, Math.round(far ? skill.burstFar : skill.burstNear))) {
    s.restUntil = time + (far ? random(0.3, 0.5) : random(0.15, 0.3));
    s.burstShots = 0;
    resting = true;
  }
  const onAim = off <= room * (s.burst === 0 ? FIRST_SHOT_ROOM : 1);
  // No point of the body in sight: no shot into the wall.
  const ready = me.weapon === gun && scoped && onAim && !resting && s.aimFix !== false;
  // The feet: from side to side as the player strafed, else still; a sniper stands. Slow enough for the gun, or no shot.
  if (sniper) s.strafe = false;
  const steady = !sniper && time < (s.widen?.until ?? 0) ? widenStep(c, cmd, ready) : fightStep(c, cmd, ready);
  // A ducked fight holds the key from the reaction on: the game takes 0.4 s to duck, longer than a short burst.
  if (s.crouch) cmd.duck = true;
  // Close in, a player fires at once and stops while the shots go: the first ones leave on the run. The players of
  // the demos fire 5 to 8 of 100 rifle shots over 140 units a second (docs/measures).
  if (!ready || (!steady && want.distance > CLOSE_FIRE)) return true;
  // A teammate in the line of the shot: no shot, as a player holds fire.
  if (mateInLine(c, cmd, want.distance)) return true;
  // The view, with its recoil, meets a wall before the enemy: no shot. A player sees the corner in front of the sight.
  if (wallInLine(c, eye, cmd, want.distance)) return true;
  cmd.attack = w?.auto ? true : c.tick % 2 === 0;
  return true;
}

/** The points of the body at `o` (offsets of BODY_UP and BODY_SIDE) with a clear line from `eye`. */
function clearPoints(c, eye, o, eyeZ, side) {
  const out = [];
  for (const up of BODY_UP) {
    for (const by of BODY_SIDE) {
      const q = [o[0] + cos(side) * by, o[1] + sin(side) * by, o[2] + eyeZ + up];
      if (c.brain.ports.traceLine(eye, q) >= 1) out.push([up, by, q]);
    }
  }
  return out;
}

/**
 * One look at the target's body. Sets `s.aimFix`: null when the drawn point is in sight, else the offsets [up, side]
 * of the nearest point in sight, or false when no point is. Sets `s.widen` when the view is narrow and a step to
 * a side shows more of the body.
 */
function exposure(c, eye, o, drawn, side) {
  const { me, s, time } = c;
  const eyeZ = s.target.eye;
  const seen = clearPoints(c, eye, o, eyeZ, side);
  if (c.brain.ports.traceLine(eye, drawn) >= 1) s.aimFix = null;
  else if (!seen.length) s.aimFix = false;
  else {
    let best = seen[0];
    for (const p of seen) if (hypot(p[2][0] - drawn[0], p[2][1] - drawn[1], p[2][2] - drawn[2]) < hypot(best[2][0] - drawn[0], best[2][1] - drawn[1], best[2][2] - drawn[2])) best = p;
    s.aimFix = [best[0], best[1]];
  }
  if (seen.length >= WIDE_ENOUGH) {
    s.widen = null;
    return;
  }
  if (time < (s.widen?.until ?? 0)) return;
  // The right of a view toward the enemy: a side key of +1 moves that way.
  const yaw = atan2(o[1] - eye[1], o[0] - eye[0]);
  const right = [sin(yaw), -cos(yaw)];
  let best = null;
  let most = seen.length;
  for (const k of [1, -1]) {
    const to = [me.origin[0] + right[0] * k * WIDE_STEP, me.origin[1] + right[1] * k * WIDE_STEP, me.origin[2]];
    if (c.brain.ports.traceHull(me.origin, to, me.ducked) < 1) continue;
    const n = clearPoints(c, [to[0], to[1], eye[2]], o, eyeZ, side).length;
    if (n > most) [best, most] = [k, n];
  }
  s.widen = best ? { side: best, until: time + WIDE_SECONDS } : null;
}

/** The feet of a widened peek (`s.widen`): a side step, at a walk while the shots go. True when the gun is steady. */
function widenStep(c, cmd, firing) {
  const { me, s } = c;
  const limit = stillSpeedOf(cmd.weapon ?? me.weapon);
  cmd.forward = 0;
  cmd.side = s.widen.side;
  if (firing && limit < Infinity) cmd.walk = true;
  return hypot(me.velocity[0], me.velocity[1]) <= limit;
}

/** With the knife a player runs at the enemy, from side to side, and strikes in reach: the stab close, the slash a little further. */
function knifeFight(c, cmd, gun, want, off) {
  const { me, s, time, random } = c;
  // Run in; in stab reach stand and strike. Pushing on against the other's box, both slid round each other.
  cmd.forward = want.distance < KNIFE_STAND ? 0 : 1;
  cmd.side = 0;
  if (s.strafe) {
    if (time >= (s.strafeTurn ?? 0)) {
      s.strafeSide = s.strafeSide === 1 ? -1 : 1;
      s.strafeTurn = time + random(0.3, 0.6);
    }
    cmd.side = want.distance > 120 ? s.strafeSide : 0;
  }
  // Close, the body is wide in the view: a blow inside its half width hits.
  const wide = max(25, (atan2(16, want.distance) / RAD) * 1.3);
  if (me.weapon === gun && off < wide) {
    if (want.distance < KNIFE_STAB) cmd.attack2 = true;
    else if (want.distance < KNIFE_SLASH) cmd.attack = true;
  }
  return true;
}
