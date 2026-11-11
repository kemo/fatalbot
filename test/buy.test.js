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
  assert.deepEqual(ct.slice(0, 4), ['m4a1', 'primammo', 'vesthelm', 'defuser']);
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
