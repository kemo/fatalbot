// Angles and vectors. Every module of the brain takes its trigonometry from here (AGENTS.md): a host that needs
// the same floats on every JavaScript engine replaces these few functions.

export const { sin, cos, atan2, hypot, sqrt, log, log2, exp, abs, min, max, floor, round, sign, PI } = Math;
export const RAD = PI / 180;

/** An angle difference in degrees, wrapped to -180..180. */
export const turn = (d) => ((((d + 540) % 360) + 360) % 360) - 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The level distance between two points. */
export const flat = (a, b) => hypot(a[0] - b[0], a[1] - b[1]);

export const distance = (a, b) => hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The view from one point to another: {yaw, pitch, distance}. A positive pitch looks down. */
export function toward(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return { yaw: (atan2(dy, dx) * 180) / PI, pitch: (-atan2(dz, hypot(dx, dy)) * 180) / PI, distance: hypot(dx, dy, dz) };
}

/** The yaw from one point to another, in degrees. */
export const yawTo = (from, to) => (atan2(to[1] - from[1], to[0] - from[0]) * 180) / PI;

/** The unit vector of a view. */
export function forwardOf(pitch, yaw) {
  const p = pitch * RAD;
  const y = yaw * RAD;
  return [cos(p) * cos(y), cos(p) * sin(y), -sin(p)];
}

/** The eye of a player of a frame. */
export const eyeOf = (p) => [p.origin[0], p.origin[1], p.origin[2] + p.eye];
