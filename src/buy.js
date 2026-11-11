// What a bot buys at the start of a round, as the players of the time bought: the side's rifle, armor and grenades
// with the money for it, a pistol round of armor or a better pistol, and a save below that. A team buys together,
// forces a buy together or saves together (teamCall). The host sells; this only makes the list (the order of
// csbih-player's economy.js botBuy). 'primammo' and 'secammo' fill the ammo.

import { EQUIPMENT, WEAPONS, isPrimary } from './weapons.js';
import { grenadesOf } from './grenades.js';

const RIFLE = { T: 'ak47', CT: 'm4a1' };
const LESSER = { T: 'galil', CT: 'famas' };
const SMG = 'mp5';
const FULL_BUY = { T: 2500 + 1000, CT: 3100 + 1000 };
// The guns that a player keeps: with a lesser primary and the money of a full buy, a bot takes the side's rifle.
const KEPT = new Set(['ak47', 'm4a1', 'aug', 'sg552', 'awp', 'g3sg1', 'sg550', 'm249']);
// A grenade kind's most in the pocket.
const CARRY = { flashbang: 2, hegrenade: 1, smokegrenade: 1 };
// What a fill of the ammo of a gun costs at most, for the count of the money.
const AMMO_FILL = 240;
// A team that is short of the money after a lost round forces a buy with this chance, else it saves. The recorded
// teams have a force buy in 16 to 23% of their rounds (docs/measures/2026-11-11-economy.md).
const FORCE = 0.4;

/** The money for a gun with its ammo and a vest. */
const kit = (key) => WEAPONS[key].price + AMMO_FILL + EQUIPMENT.vest;

/**
 * The call of a team for the buy of this round, made by its first bot that buys from what the bots of the team
 * have. 'buy': all of them but one at most hold a gun to keep or have the money of a full buy. Else 'force' (each
 * takes the best that its money gives) after a round that the team won, and by chance after one that it lost;
 * else 'save'. The bots say what they have, as players do before a round. A teammate that no brain drives says
 * nothing and counts for nothing: a bot alone among people buys by its own money.
 */
function teamCall(c) {
  const { me, team, brain } = c;
  if (team.buyCall) return team.buyCall;
  const bots = c.mates.filter((p) => p.alive && p.own);
  const ready = bots.filter((p) => p.own.money >= FULL_BUY[me.team] || Object.keys(p.own.weapons).some((key) => KEPT.has(key))).length;
  if (ready >= Math.max(1, bots.length - 1)) team.buyCall = 'buy';
  else if (brain.lastWinner === me.team || (team.random ?? c.random)() < FORCE) team.buyCall = 'force';
  else team.buyCall = 'save';
  return team.buyCall;
}

/** The items that the bot buys now, in order. */
export function buyList(c) {
  const { me, own, random, brain } = c;
  const side = me.team;
  let money = own.money;
  let armor = own.armor;
  let helmet = own.helmet;
  const pocket = {};
  const list = [];
  // A grenade is bought for a throw: a bot takes only the kinds that its side has a lineup for on this map.
  const throws = grenadesOf(brain, side);
  const price = (key) => {
    if (key === 'vest') return armor >= 100 ? null : EQUIPMENT.vest;
    if (key === 'vesthelm') return armor >= 100 ? (helmet ? null : 350) : helmet ? EQUIPMENT.vest : EQUIPMENT.vesthelm;
    if (key === 'defuser') return own.kit || side !== 'CT' || !brain.map.bombSites.length ? null : EQUIPMENT.defuser;
    const w = WEAPONS[key];
    if (!w || (w.team && w.team !== side)) return null;
    if (CARRY[key]) return (own.weapons[key]?.count ?? (own.weapons[key] ? 1 : 0)) + (pocket[key] ?? 0) >= CARRY[key] ? null : w.price;
    return own.weapons[key] ? null : w.price;
  };
  const buy = (key) => {
    const p = price(key);
    if (p === null || money < p) return false;
    money -= p;
    list.push(key);
    if (key === 'vest' || key === 'vesthelm') armor = 100;
    if (key === 'vesthelm') helmet = true;
    if (CARRY[key]) pocket[key] = (pocket[key] ?? 0) + 1;
    return true;
  };
  const held = Object.keys(own.weapons).filter(isPrimary);
  const keeps = held.some((key) => KEPT.has(key));
  let armed = held.length > 0;
  // In a save a bot spends when it holds a gun to keep, or has the money of this buy and of the next one.
  const spends = teamCall(c) !== 'save' || keeps || money >= FULL_BUY[side] * 2;
  if (spends && !keeps) {
    if (money >= FULL_BUY[side]) armed = buy(RIFLE[side]) || armed;
    // Short of that money: the lesser rifle, or a submachine gun, each with a vest.
    else if (!armed && money >= kit(LESSER[side])) armed = buy(LESSER[side]);
    else if (!armed && money >= kit(SMG)) armed = buy(SMG);
  }
  if (armed) {
    list.push('primammo');
    money -= Math.min(money, AMMO_FILL);
    if (spends) {
      if (money >= 1000) buy('vesthelm');
      else buy('vest');
      buy('defuser');
      for (const nade of ['flashbang', 'hegrenade', 'smokegrenade', 'flashbang']) if (throws.has(nade)) buy(nade);
    }
    list.push('secammo');
    return list;
  }
  // No gun. With the money for both in a round that is no save: a vest and a better pistol.
  if (spends && money >= EQUIPMENT.vest + WEAPONS.deagle.price) {
    buy('vest');
    buy('deagle');
  } else if (money >= 650 && money < 1500) {
    // A pistol round or a save: armor, or a better pistol and a flash, as the money gives.
    const pick = random();
    if (pick < 0.5 || (pick >= 0.8 && !throws.has('hegrenade'))) buy('vest');
    else if (pick < 0.8) {
      buy('deagle');
      if (throws.has('flashbang')) buy('flashbang');
    } else {
      buy('hegrenade');
      if (throws.has('flashbang')) buy('flashbang');
    }
  }
  list.push('secammo');
  return list;
}
