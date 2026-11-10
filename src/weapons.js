// The facts of the weapons of CS 1.6 that the brain needs: the kind, the clip, the trigger, the price and the team.
// The names are the game's own (weapon_<name>).

// [kind, clip, automatic trigger, price, team or null]
const TABLE = {
  knife: ['knife', 0, true, 0, null],
  glock18: ['pistol', 20, false, 400, null], usp: ['pistol', 12, false, 500, null], p228: ['pistol', 13, false, 600, null],
  deagle: ['pistol', 7, false, 650, null], elite: ['pistol', 30, false, 800, 'T'], fiveseven: ['pistol', 20, false, 750, 'CT'],
  m3: ['shotgun', 8, true, 1700, null], xm1014: ['shotgun', 7, true, 3000, null],
  mac10: ['smg', 30, true, 1400, 'T'], tmp: ['smg', 30, true, 1250, 'CT'], mp5: ['smg', 30, true, 1500, null],
  ump45: ['smg', 25, true, 1700, null], p90: ['smg', 50, true, 2350, null],
  galil: ['rifle', 35, true, 2000, 'T'], famas: ['rifle', 25, true, 2250, 'CT'], ak47: ['rifle', 30, true, 2500, 'T'],
  m4a1: ['rifle', 30, true, 3100, 'CT'], sg552: ['rifle', 30, true, 3500, 'T'], aug: ['rifle', 30, true, 3500, 'CT'],
  scout: ['sniper', 10, true, 2750, null], awp: ['sniper', 10, true, 4750, null], g3sg1: ['sniper', 20, true, 5000, 'T'],
  sg550: ['sniper', 30, true, 4200, 'CT'], m249: ['mg', 100, true, 5750, null],
  hegrenade: ['grenade', 0, false, 300, null], flashbang: ['grenade', 0, false, 200, null], smokegrenade: ['grenade', 0, false, 300, null],
  c4: ['bomb', 0, true, 0, 'T'],
};

export const WEAPONS = Object.fromEntries(Object.entries(TABLE).map(([name, [kind, clip, auto, price, team]]) => [name, { name, kind, clip, auto, price, team }]));

/** The prices of the equipment of the buy menu. */
export const EQUIPMENT = { vest: 650, vesthelm: 1000, defuser: 200 };

const PRIMARY = new Set(['shotgun', 'smg', 'rifle', 'sniper', 'mg']);
export const kindOf = (name) => WEAPONS[name]?.kind ?? null;
export const isPrimary = (name) => PRIMARY.has(kindOf(name));
export const isPistol = (name) => kindOf(name) === 'pistol';
export const isSniper = (name) => kindOf(name) === 'sniper';
export const isMelee = (name) => kindOf(name) === 'knife';
export const isGrenade = (name) => kindOf(name) === 'grenade';
/** A weapon that fires rounds: a primary or a pistol. */
export const isGun = (name) => isPrimary(name) || isPistol(name);

/**
 * The furthest a player of the time opened a fight with each gun: the distance within which 97 of 100 kills of that
 * gun fell, over 220 demos of csbih-player (2026-11-07). The rarer guns take the figure of their kind.
 */
export const ENGAGE = {
  ak47: 1630, m4a1: 1550, famas: 1590, galil: 1490, aug: 1600, sg552: 1600, awp: 2650, scout: 2400, g3sg1: 2400,
  sg550: 2400, m249: 1500, usp: 1390, glock18: 1190, deagle: 1240, p228: 1200, fiveseven: 1200, elite: 1200,
  mp5: 1480, ump45: 1300, p90: 1300, mac10: 1100, tmp: 1100, m3: 700, xm1014: 700, knife: 1190,
};
export const ENGAGE_DEFAULT = 1500;

/** The speed over which a sniper rifle spreads wide (the game's weapon code): a sniper waits under it to fire. */
export const SNIPER_STILL = { awp: 10, scout: 170, g3sg1: 1, sg550: 1 };

// The highest speed of a player with each weapon in the hand (the game's GetMaxSpeed); the rest run at 250.
const SPEED = {
  scout: 260, p90: 245, xm1014: 240, m3: 230, m4a1: 230, famas: 240, galil: 240, ak47: 221, aug: 240, sg552: 235,
  sg550: 210, g3sg1: 210, awp: 210, m249: 220,
};
export const maxSpeedOf = (name) => SPEED[name] ?? 250;

/**
 * The speed under which a gun fires as well as from a stand (the game's weapon code: a rifle spreads wide over 140,
 * the AWP over 10, the Scout over 170; a submachine gun on the ground does not care). Infinity: no limit.
 */
const STILL = { rifle: 140, mg: 140 };
export const stillSpeedOf = (name) => SNIPER_STILL[name] ?? STILL[kindOf(name)] ?? Infinity;

/** The weapons that a player carries (`own.weapons`), as the fight ranks them. */
export function bestGun(own) {
  let best = 'knife';
  let rank = 0;
  for (const name in own.weapons) {
    const w = own.weapons[name];
    const empty = isGun(name) && w.clip === 0 && (w.reserve ?? 1) === 0;
    const r = empty ? -1 : isPrimary(name) ? 2 : isPistol(name) ? 1 : isMelee(name) ? 0 : -1;
    if (r > rank) {
      rank = r;
      best = name;
    }
  }
  return best;
}

/** The gun of a fight: the best one, or the pistol when the best one's clip ran out (a reload loses a duel). */
export function fightGun(own) {
  const best = bestGun(own);
  if (own.weapons[best]?.clip !== 0 || !isPrimary(best)) return best;
  for (const name in own.weapons) if (isPistol(name) && own.weapons[name].clip > 0) return name;
  return best;
}

export const hasPrimary = (own) => Object.keys(own.weapons).some(isPrimary);
