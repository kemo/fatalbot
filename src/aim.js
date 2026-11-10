// The view of a bot, turned as a hand on a mouse turns it. Two models, ported from csbih-player (bot.js aimAt and
// hand), where they were fitted to the aim of the players of the demos (tools/aim-stats.js):
//   lookAt: looking about. A critically damped spring that holds an aim until the wanted one is far or old.
//   hand:   a fight. A flick of bell-shaped speed (minimum jerk) that lands a little short or long, a pause, a
//           smaller move again, then pursuit with a tremor. The time of a move follows Fitts' law.

import { PI, RAD, atan2, clamp, cos, hypot, log2, max, min, sin, sqrt, turn } from './geometry.js';

// The part of the reaction before the hand moves; a move covers GAIN of the way (spread GAIN_SPREAD), turned off its
// line by DIRECTION_SPREAD (radians) and bulging BULGE of its length to a side; its time is
// FITTS_A + FITTS_B x log2(1 + D / W) seconds; a PAUSE_MIN to PAUSE_MAX wait before a correcting move; ON_TARGET
// head widths count as on the point.
export const ONSET = 0.45;
const GAIN = 0.97;
const GAIN_SPREAD = 0.12;
const DIRECTION_SPREAD = 0.09;
const BULGE = 0.2;
const FITTS_A = 0.06;
const FITTS_B = 0.045;
const PAUSE_MIN = 0.04;
const PAUSE_MAX = 0.1;
const ON_TARGET = 0.4;
const ON_TARGET_MIN = 0.5;
const HEAD_HALF = 6;
// On the point the view follows it this far behind (s); the tremor's time and its width on the move.
const PURSUIT = 0.08;
const TREMOR_TIME = 0.4;
const TREMOR_MOVING = 2.5;
// Looking about, the hand holds an aim until the wanted one is this far away (degrees) or this old (s).
const HOLD_ANGLE = 15;
const HOLD_SECONDS = 0.5;

const minJerk = (u) => u * u * u * (10 - 15 * u + 6 * u * u);

/**
 * Turns the view toward (yaw, pitch) as a hand looks about: quick to start, slow to stop, never past `turnSpeed`
 * degrees a second. Writes cmd.yaw and cmd.pitch and returns how far the view still is off.
 */
export function lookAt(c, cmd, yaw, pitch) {
  const { me, s, skill, dt } = c;
  s.holdT = (s.holdT ?? 1) + dt;
  const far = s.holdYaw === undefined || Math.abs(turn(yaw - s.holdYaw)) > HOLD_ANGLE || Math.abs(pitch - s.holdPitch) > HOLD_ANGLE;
  if (far || s.holdT > HOLD_SECONDS) {
    s.holdYaw = yaw;
    s.holdPitch = pitch;
    s.holdT = 0;
  }
  yaw = s.holdYaw;
  pitch = s.holdPitch;
  const k = skill.lookSpring;
  const damp = 2 * sqrt(k);
  const ey = turn(yaw - me.yaw);
  const ep = pitch - me.pitch;
  const cap = skill.turnSpeed;
  s.wy = clamp((s.wy ?? 0) + (k * ey - damp * (s.wy ?? 0)) * dt, -cap, cap);
  s.wp = clamp((s.wp ?? 0) + (k * ep - damp * (s.wp ?? 0)) * dt, -cap, cap);
  cmd.yaw = turn(me.yaw + s.wy * dt);
  cmd.pitch = clamp(me.pitch + s.wp * dt, -89, 89);
  return hypot(turn(yaw - cmd.yaw), pitch - cmd.pitch);
}

/** A new fight: the hand starts after the eye has seen, from rest. */
export function startHand(c) {
  const { s, skill, time, random } = c;
  s.moveAt = time + skill.reaction * ONSET * random(0.8, 1.25);
  s.move = null;
}

/**
 * The view in a fight, toward (yaw, pitch) at `distance`. Writes cmd.yaw and cmd.pitch and returns how far the view
 * is off the wanted direction.
 */
export function hand(c, cmd, yaw, pitch, distance) {
  const { me, s, skill, time, dt, random } = c;
  // The tremor: a slow random wander of the hand (Ornstein-Uhlenbeck), wider on the move.
  const still = me.onGround && hypot(me.velocity[0], me.velocity[1]) < 60;
  const sigma = skill.tremor * (still ? 1 : TREMOR_MOVING);
  const tremor = (s.tremor ??= [0, 0]);
  for (let k = 0; k < 2; k++) tremor[k] += -tremor[k] * (dt / TREMOR_TIME) + sigma * sqrt((2 * dt) / TREMOR_TIME) * random.gauss();
  const ey = turn(yaw - me.yaw);
  const ep = pitch - me.pitch;
  const size = hypot(ey, ep);
  // The width of a head at that distance, in degrees: the tolerance of a move and its target size (Fitts).
  const width = max(0.6, (2 * atan2(HEAD_HALF, max(1, distance))) / RAD);
  let viewYaw = me.yaw;
  let viewPitch = me.pitch;
  const m = s.move;
  if (time < (s.moveAt ?? 0)) {
    // Before the onset the view holds.
  } else if (m && time < m.t0 + m.T) {
    const u = min(1, (time - m.t0) / m.T);
    const e = minJerk(u);
    // The target moved since the move began: the move takes that along (the eye guides it on the way).
    const driftYaw = turn(yaw - m.aimYaw);
    const driftPitch = pitch - m.aimPitch;
    const bulge = sin(PI * u);
    viewYaw = m.from[0] + m.delta[0] * e + m.bulge[0] * bulge + driftYaw * e;
    viewPitch = m.from[1] + m.delta[1] * e + m.bulge[1] * bulge + driftPitch * e;
  } else if (size > max(ON_TARGET_MIN, width * ON_TARGET)) {
    // Off the point: the next move, once the eye has seen where the last one landed.
    if (!m || time >= m.t0 + m.T + m.pause) {
      const gain = clamp(GAIN + random.gauss() * GAIN_SPREAD, 0.7, 1.15);
      const turnBy = random.gauss() * DIRECTION_SPREAD;
      const co = cos(turnBy);
      const si = sin(turnBy);
      const delta = [(ey * co - ep * si) * gain, (ey * si + ep * co) * gain];
      const along = hypot(delta[0], delta[1]) || 1;
      const bulge = random.gauss() * BULGE * along;
      let T = (FITTS_A + FITTS_B * log2(1 + size / width)) * skill.handTime;
      T = max(T, (1.875 * along) / skill.turnSpeed);
      s.move = {
        from: [me.yaw, me.pitch], delta, bulge: [(-delta[1] / along) * bulge, (delta[0] / along) * bulge], t0: time, T,
        pause: random(PAUSE_MIN, PAUSE_MAX), aimYaw: yaw, aimPitch: pitch,
      };
    }
  } else {
    // On the point: the view follows it a moment behind.
    const k = min(1, dt / PURSUIT);
    viewYaw = me.yaw + ey * k;
    viewPitch = me.pitch + ep * k;
  }
  // The tremor rides on what the hand does; the turn of one tick stays under the player's turn speed.
  const cap = skill.turnSpeed * dt;
  const shown = (s.tremorShown ??= [0, 0]);
  const ty = turn(viewYaw + (tremor[0] - shown[0]) - me.yaw);
  const tp = viewPitch + (tremor[1] - shown[1]) - me.pitch;
  shown[0] = tremor[0];
  shown[1] = tremor[1];
  cmd.yaw = turn(me.yaw + clamp(ty, -cap, cap));
  cmd.pitch = clamp(me.pitch + clamp(tp, -cap, cap), -89, 89);
  // The spring of the look about starts from rest after the fight.
  s.wy = 0;
  s.wp = 0;
  return hypot(turn(yaw - cmd.yaw), pitch - cmd.pitch);
}
