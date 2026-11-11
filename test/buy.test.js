// The buy of a round: what the bots of a team take for their money, read from their commands as a host reads them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flatMap, flatPorts, frameAt, player } from './support/flat-host.js';

const KNIFE = { clip: 0, reserve: 0 };
const PISTOL = { T: 'glock18', CT: 'usp' };

/**
 * The buy lists of a team of bots in the freeze time of a round: `bots` are [{money, weapons (names beside the knife
 * and the pistol)}], one for each bot; `people` more teammates that no brain drives. `won`: the team won (true) or
 * lost (false) the round before, by the score of the frames. Returns the lists in the order of `bots`, with the
 * team's call as `call`.
 */
function buysOf(side, bots, { seed = 1, people = 0, lineups = [], won = null } = {}) {
  const brain = createBrain({ map: { ...flatMap({ sites: [{ mins: [-64, 200, 0], maxs: [64, 328, 72] }] }), lineups }, ports: flatPorts(), seed });
  const ids = bots.map((_, i) => i + 1);
  ids.forEach((id) => brain.join(id));
  const other = side === 'T' ? 'CT' : 'T';
  const team = (canBuy) => {
    const players = bots.map((b, i) => {
      const p = player(ids[i], side, [side === 'T' ? -300 : 300, i * 40, 36], { own: true, weapon: PISTOL[side] });
      p.own.money = b.money;
      p.own.canBuy = canBuy;
      p.own.weapons = { knife: { ...KNIFE }, [PISTOL[side]]: { clip: 12, reserve: 24 }, ...Object.fromEntries((b.weapons ?? []).map((w) => [w, { clip: 30, reserve: 90 }])) };
      return p;
    });
    for (let k = 0; k < people; k++) players.push(player(50 + k, side, [side === 'T' ? -300 : 300, -40 * (k + 1), 36], { weapon: PISTOL[side] }));
    players.push(player(99, other, [side === 'T' ? 300 : -300, 0, 36]));
    return players;
  };
  // The round before, as the scoreboard had it at its end.
  if (won !== null) brain.frame(frameAt(0, team(false), { phase: 'over', number: 1, score: { T: 3, CT: 3 } }));
  const score = won === null ? null : { T: 3, CT: 3, ...(won ? { [side]: 4 } : { [other]: 4 }) };
  const lists = new Map();
  for (let tick = 1; tick <= 320; tick++) {
    brain.frame(frameAt(tick, team(true), { phase: 'freeze', number: 2, score }));
    for (const id of ids) {
      const cmd = brain.think(id);
      if (cmd.buy) lists.set(id, cmd.buy);
    }
  }
  const out = ids.map((id) => lists.get(id) ?? null);
  out.call = brain.teams[side].buyCall;
  return out;
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
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

test('a team buys together: with one player short of the money the others buy, and that one takes a lesser gun', () => {
  for (const seed of [1, 2, 3]) {
    const lists = buysOf('CT', [{ money: 5000 }, { money: 4200 }, { money: 6000 }, { money: 3200 }, { money: 4500 }], { seed });
    assert.equal(lists.call, 'buy');
    assert.deepEqual(lists.map(gunOf), ['m4a1', 'm4a1', 'm4a1', 'famas', 'm4a1'], `seed ${seed}`);
    assert.ok(lists[3].includes('vest'), 'the lesser rifle comes with a vest');
    // Less money: a submachine gun with a vest; still less: a vest and a better pistol.
    const poor = buysOf('T', [{ money: 5000 }, { money: 4200 }, { money: 6000 }, { money: 2500 }, { money: 4500 }], { seed })[3];
    assert.deepEqual(poor.slice(0, 3), ['mp5', 'primammo', 'vest']);
    assert.deepEqual(buysOf('T', [{ money: 5000 }, { money: 4200 }, { money: 6000 }, { money: 1400 }, { money: 4500 }], { seed })[3], ['vest', 'deagle', 'secammo']);
  }
});

test('a team short of the money after a lost round saves together, or forces a buy together by chance', () => {
  const calls = new Set();
  for (const seed of SEEDS) {
    const lists = buysOf('CT', [{ money: 5000 }, { money: 4200 }, { money: 2000 }, { money: 3300 }, { money: 2600 }], { seed, won: false });
    calls.add(lists.call);
    if (lists.call === 'save') {
      assert.deepEqual(lists.map(gunOf), [null, null, null, null, null], `seed ${seed}`);
      assert.ok(lists.every((list) => !list.includes('vest') && !list.includes('vesthelm')), 'a save keeps the money');
    } else {
      assert.equal(lists.call, 'force');
      assert.deepEqual(lists.map(gunOf), ['m4a1', 'm4a1', null, 'famas', 'mp5'], `seed ${seed}`);
      assert.deepEqual(lists[2], ['vest', 'deagle', 'secammo']);
    }
  }
  assert.deepEqual([...calls].sort(), ['force', 'save'], 'both calls come over twelve seeds');
});

test('a team that won the last round does not save', () => {
  for (const seed of SEEDS) {
    const lists = buysOf('T', [{ money: 3400 }, { money: 3300 }, { money: 3450 }, { money: 5000 }, { money: 2500 }], { seed, won: true });
    assert.equal(lists.call, 'force', `seed ${seed}`);
    assert.deepEqual(lists.map(gunOf), ['galil', 'galil', 'galil', 'ak47', 'mp5']);
  }
});

test('in a save a bot spends only with a gun to keep or with the money of two buys', () => {
  const seed = SEEDS.find((n) => buysOf('CT', [{ money: 2000 }, { money: 2000 }], { seed: n, won: false }).call === 'save');
  // The money of this buy and of the next one: that player buys.
  assert.deepEqual(buysOf('CT', [{ money: 9000 }, { money: 4200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed, won: false }).map(gunOf), ['m4a1', null, null, null, null]);
  // A player with a rifle from the last round fills it and takes armor; the others save.
  const kept = buysOf('CT', [{ money: 1500, weapons: ['m4a1'] }, { money: 2200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed, won: false });
  assert.equal(kept.call, 'save');
  assert.deepEqual(kept.map(gunOf), [null, null, null, null, null]);
  assert.deepEqual(kept[0].slice(0, 2), ['primammo', 'vesthelm']);
  // A lesser gun from the last round is filled, and no more.
  assert.deepEqual(buysOf('CT', [{ money: 2500, weapons: ['famas'] }, { money: 2200 }, { money: 2000 }, { money: 3000 }, { money: 1500 }], { seed, won: false })[0], ['primammo', 'secammo']);
});

test('players with rifles from the last round count for the call of a buy', () => {
  const lists = buysOf('T', [{ money: 300, weapons: ['ak47'] }, { money: 200, weapons: ['awp'] }, { money: 100, weapons: ['ak47'] }, { money: 3600 }, { money: 1000 }]);
  assert.equal(lists.call, 'buy');
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
  // Short of the money it saves or forces by its own draw; it never waits for the people of its team.
  const calls = new Set(SEEDS.map((seed) => buysOf('CT', [{ money: 3500 }], { people: 4, seed, won: false }).call));
  assert.deepEqual([...calls].sort(), ['force', 'save']);
});
