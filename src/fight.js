// The fight: the gun, the point of the aim, the trigger and the feet, with the reaction, the aim and the recoil
// control of the bot's profile. Ported from csbih-player (bot.js fight); the feet are new (moves.js fightStep).

import { PI, RAD, atan2, cos, eyeOf, forwardOf, hypot, max, min, sin, toward } from './geometry.js';
import { hand, startHand } from './aim.js';
import { approachPoint } from './watch.js';
import { fightStep } from './moves.js';
import { WEAPONS, fightGun, isMelee, isSniper } from './weapons.js';

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
// The bolt of an AWP or a Scout: the game brings the scope back itself after it.
const BOLT = { awp: 1.45, scout: 1.25 };

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
  s.crouch = random() < skill.duckInFight;
  s.strafeTurn = 0;
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
  const point = peek ?? [o[0] + cos(side) * s.aimSide, o[1] + sin(side) * s.aimSide, headZ - s.aimLow];
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
  const ready = me.weapon === gun && scoped && onAim && !resting;
  // The feet: from side to side as the player strafed, else still; a sniper stands. Slow enough for the gun, or no shot.
  if (sniper) s.strafe = false;
  const steady = fightStep(c, cmd, ready);
  if (!ready || !steady) return true;
  // A teammate in the line of the shot: no shot, as a player holds fire.
  if (mateInLine(c, cmd, want.distance)) return true;
  cmd.attack = w?.auto ? true : c.tick % 2 === 0;
  if (s.crouch) cmd.duck = true;
  return true;
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
