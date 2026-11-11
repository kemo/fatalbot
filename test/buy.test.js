// The buy of a round: what the bots of a team take for their money, read from their commands as a host reads them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flatMap, flatPorts, frameAt, player } from './support/flat-host.js';

const KNIFE = { clip: 0, reserve: 0 };
const PISTOL = { T: 'glock18', CT: 'usp' };

/**
 * The buy lists of a team of bots in the freeze time of a round: `bots` are [{money, weapons (names beside the knife
 * and the pistol)}], one for each bot; `people` more teammates that no brain drives. Returns the lists in the order of `bots`.
 */
function buysOf(side, bots, { seed = 1, people = 0, lineups = [] } = {}) {
  const brain = createBrain({ map: { ...flatMap({ sites: [{ mins: [-64, 200, 0], maxs: [64, 328, 72] }] }), lineups }, ports: flatPorts(), seed });
  const ids = bots.map((_, i) => i + 1);
  ids.forEach((id) => brain.join(id));
  const lists = new Map();
  for (let tick = 1; tick <= 320; tick++) {
    const players = bots.map((b, i) => {
      const p = player(ids[i], side, [side === 'T' ? -300 : 300, i * 40, 36], { own: true, weapon: PISTOL[side] });
      p.own.money = b.money;
      p.own.canBuy = true;
      p.own.weapons = { knife: { ...KNIFE }, [PISTOL[side]]: { clip: 12, reserve: 24 }, ...Object.fromEntries((b.weapons ?? []).map((w) => [w, { clip: 30, reserve: 90 }])) };
      return p;
    });
    for (let k = 0; k < people; k++) players.push(player(50 + k, side, [side === 'T' ? -300 : 300, -40 * (k + 1), 36], { weapon: PISTOL[side] }));
    players.push(player(99, side === 'T' ? 'CT' : 'T', [side === 'T' ? 300 : -300, 0, 36]));
    brain.frame(frameAt(tick, players, { phase: 'freeze' }));
    for (const id of ids) {
      const cmd = brain.think(id);
      if (cmd.buy) lists.set(id, cmd.buy);
    }
  }
  return ids.map((id) => lists.get(id) ?? null);
}

test('a bot with the money of a full buy takes the rifle of its side, armor and a kit', () => {
  const [ct] = buysOf('CT', [{ money: 5000 }]);
  assert.deepEqual(ct, ['m4a1', 'primammo', 'vesthelm', 'defuser', 'secammo']);
  const [t] = buysOf('T', [{ money: 5000 }]);
  assert.deepEqual(t.slice(0, 3), ['ak47', 'primammo', 'vesthelm']);
  assert.ok(!t.includes('defuser'));
});

test('a bot that holds a lesser primary changes it for the rifle once it has the money of a full buy', () => {
  for (const seed of [1, 2, 3]) {
    assert.equal(buysOf('CT', [{ money: 5000, weapons: ['famas'] }], { seed })[0][0], 'm4a1');
    assert.equal(buysOf('T', [{ money: 5000, weapons: ['mp5'] }], { seed })[0][0], 'ak47');
    // Under that money it keeps its gun and fills it.
    assert.equal(buysOf('CT', [{ money: 3000, weapons: ['famas'] }], { seed })[0][0], 'primammo');
    // A rifle or a sniper rifle stays, whatever the money: a CT keeps the AK-47 that it picked up.
    assert.equal(buysOf('CT', [{ money: 9000, weapons: ['ak47'] }], { seed })[0][0], 'primammo');
    assert.equal(buysOf('T', [{ money: 9000, weapons: ['awp'] }], { seed })[0][0], 'primammo');
  }
});

test('a bot buys a grenade only for a throw that its side has on the map', () => {
  const GRENADES = ['flashbang', 'hegrenade', 'smokegrenade'];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    // No lineup: no grenade, with the money of a full buy and in a pistol round.
    for (const money of [800, 6000]) assert.ok(!buysOf('CT', [{ money }], { seed })[0].some((key) => GRENADES.includes(key)), `seed ${seed}, ${money}`);
  }
  // A flashbang of the CTs and a smoke of the Ts: each side takes its own kind only.
  const lineups = [{ team: 'CT', kind: 'flash', from: [300, 0, 100], velocity: [-600, 0, 100], at: 10 }, { team: 'T', kind: 'smoke', from: [-300, 0, 100], velocity: [600, 0, 100], at: 10 }];
  const ct = buysOf('CT', [{ money: 6000 }], { lineups })[0];
  assert.deepEqual(ct.filter((key) => GRENADES.includes(key)), ['flashbang', 'flashbang']);
  assert.deepEqual(buysOf('T', [{ money: 6000 }], { lineups })[0].filter((key) => GRENADES.includes(key)), ['smokegrenade']);
});

const GUNS = ['m4a1', 'famas', 'ak47', 'galil', 'awp', 'mp5'];
const gunOf = (list) => list.find((key) => GUNS.includes(key)) ?? null;

test('a team buys together: with one player short of the money the others buy, and that one takes the lesser rifle', () => {
  for (const seed of [1, 2, 3]) {
    const lists = buysOf('CT', [{ money: 5000 }, { money: 4200 }, { money: 6000 }, { money: 3200 }, { money: 4500 }], { seed });
    assert.deepEqual(lists.map(gunOf), ['m4a1', 'm4a1', 'm4a1', 'famas', 'm4a1'], `seed ${seed}`);
    assert.ok(lists[3].includes('vest'), 'the lesser rifle comes with a vest');
    // Too poor for the lesser rifle with a vest: no gun.
    assert.equal(gunOf(buysOf('T', [{ money: 5000 }, { money: 4200 }, { money: 6000 }, { money: 2000 }, { money: 4500 }], { seed })[3]), null);
  }
});

test('a team saves together: with two players short of the money nobody buys a gun', () => {
  for (const seed of [1, 2, 3]) {
    const lists = buysOf('CT', [{ money: 5000 }, { money: 4200 }, { money: 2000 }, { money: 3000 }, { money: 4500 }], { seed });
    assert.deepEqual(lists.map(gunOf), [null, null, null, null, null], `seed ${seed}`);
    assert.ok(lists.every((list) => !list.includes('vest') && !list.includes('vesthelm')), 'a save keeps the money');
    // The money of this buy and of the next one: that player buys in a save.
    assert.deepEqual(buysOf('CT', [{ money: 9000 }, { money: 4200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed }).map(gunOf), ['m4a1', null, null, null, null]);
    // A player with a rifle from the last round fills it and takes armor; the team still saves.
    const kept = buysOf('CT', [{ money: 1500, weapons: ['m4a1'] }, { money: 2200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed });
    assert.deepEqual(kept.map(gunOf), [null, null, null, null, null]);
    assert.deepEqual(kept[0].slice(0, 2), ['primammo', 'vesthelm']);
    // A lesser gun from the last round is filled, and no more.
    assert.deepEqual(buysOf('CT', [{ money: 2500, weapons: ['famas'] }, { money: 2200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed })[0], ['primammo', 'secammo']);
  }
});

test('players with rifles from the last round count for the call of a buy', () => {
  const lists = buysOf('T', [{ money: 300, weapons: ['ak47'] }, { money: 200, weapons: ['awp'] }, { money: 100, weapons: ['ak47'] }, { money: 3600 }, { money: 1000 }]);
  assert.deepEqual(lists.map(gunOf), [null, null, null, 'ak47', null]);
});

test('a pistol round: armor or a better pistol, and no gun', () => {
  for (const seed of [1, 2, 3, 4]) {
    for (const list of buysOf('T', [{ money: 800 }, { money: 800 }, { money: 800 }, { money: 800 }, { money: 800 }], { seed })) {
      assert.equal(gunOf(list), null);
      assert.ok(list.includes('vest') || list.includes('deagle'), `seed ${seed}: ${list}`);
    }
  }
});

test('a bot alone among people buys by its own money', () => {
  assert.equal(gunOf(buysOf('CT', [{ money: 5000 }], { people: 4 })[0]), 'm4a1');
  assert.equal(gunOf(buysOf('CT', [{ money: 3500 }], { people: 4 })[0]), null);
});
