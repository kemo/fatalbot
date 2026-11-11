// What a bot buys at the start of a round, as the players of the time bought: the side's rifle, armor and grenades
// with the money for it, a pistol round of armor or a better pistol, and a save below that. The host sells; this
// only makes the list (the order of csbih-player's economy.js botBuy). 'primammo' and 'secammo' fill the ammo.

import { EQUIPMENT, WEAPONS, isPrimary } from './weapons.js';

const RIFLE = { T: 'ak47', CT: 'm4a1' };
const FULL_BUY = { T: 2500 + 1000, CT: 3100 + 1000 };
// The guns that a player keeps: with a lesser primary and the money of a full buy, a bot takes the side's rifle.
const KEPT = new Set(['ak47', 'm4a1', 'aug', 'sg552', 'awp', 'g3sg1', 'sg550', 'm249']);
// A grenade kind's most in the pocket.
const CARRY = { flashbang: 2, hegrenade: 1, smokegrenade: 1 };
// What a fill of the ammo of a gun costs at most, for the count of the money.
const AMMO_FILL = 240;

/** The items that the bot buys now, in order. */
export function buyList(c) {
  const { me, own, random, brain } = c;
  const side = me.team;
  let money = own.money;
  let armor = own.armor;
  let helmet = own.helmet;
  const pocket = {};
  const list = [];
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
  let armed = held.length > 0;
  if (!held.some((key) => KEPT.has(key)) && money >= FULL_BUY[side]) armed = buy(RIFLE[side]) || armed;
  else if (!armed && side === 'T' && money >= 2000 + 650 && random() < 0.5) armed = buy('galil');
  else if (!armed && side === 'CT' && money >= 2250 + 650 && random() < 0.5) armed = buy('famas');
  if (armed) {
    list.push('primammo');
    money -= Math.min(money, AMMO_FILL);
    if (money >= 1000) buy('vesthelm');
    else buy('vest');
    buy('defuser');
    for (const nade of ['flashbang', 'hegrenade', 'smokegrenade', 'flashbang']) buy(nade);
    list.push('secammo');
    return list;
  }
  // A pistol round or a save: armor, or a better pistol and a flash, as the money gives.
  if (money >= 650 && money < 1500) {
    const pick = random();
    if (pick < 0.5) buy('vest');
    else if (pick < 0.8) {
      buy('deagle');
      buy('flashbang');
    } else {
      buy('hegrenade');
      buy('flashbang');
    }
  }
  list.push('secammo');
  return list;
}
