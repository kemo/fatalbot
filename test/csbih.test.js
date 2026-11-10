// The csbih host against the real game core of csbih-player. Skips when no built checkout is near (README, "Run").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand, checkFrame, checkMap } from '../src/contract.js';
import { csbihMissing, loadCore, loadLevel } from '../hosts/csbih/load.js';
import { mapOf } from '../hosts/csbih/adapter.js';
import { runMatch } from '../hosts/csbih/arena.js';
import { fatalKind } from '../hosts/csbih/kind.js';

const MAP = 'de_dust2';
const skip = csbihMissing(MAP) ?? false;
const core = skip ? null : await loadCore();
const level = skip ? null : loadLevel(core, MAP);

test('the map of a built level holds the contract', { skip }, () => {
  const map = mapOf(core, level);
  assert.deepEqual(checkMap(map), []);
  assert.equal(map.bombSites.length, 2);
  assert.ok(map.spawns.some((s) => s.team === 'T') && map.spawns.some((s) => s.team === 'CT'));
});

/** A kind of fatalbot that checks every frame and every command against the contract. */
function checkedKind() {
  const kind = fatalKind(core, level);
  const bad = new Set();
  const attach = kind.attach;
  kind.attach = (world, options) => {
    attach(world, options);
    const host = kind.host();
    const frame = host.frame.bind(host);
    host.frame = () => {
      const f = frame();
      for (const b of checkFrame(f)) bad.add(b);
      return f;
    };
    const controller = host.controller.bind(host);
    host.controller = (id, options2) => {
      const c = controller(id, options2);
      const command = c.command.bind(c);
      c.command = (w, me) => {
        const cmd = command(w, me);
        for (const b of checkCommand(cmd)) bad.add(b);
        return cmd;
      };
      return c;
    };
  };
  return { kind, bad };
}

test('a match of fatalbot on both sides: the frames and the commands hold the contract, and the rounds end', { skip }, () => {
  const { kind, bad } = checkedKind();
  const m = runMatch({ core, level, sides: { T: kind, CT: kind }, seed: 2, rounds: 3 });
  assert.deepEqual([...bad], []);
  assert.equal(m.rounds.length, 3);
  assert.equal(m.score.T + m.score.CT, 3);
  assert.ok(m.measure.fatal.kills > 0, 'the bots fight');
});

test('the same seed gives the same match', { skip }, () => {
  const play = (seed) => {
    const kind = fatalKind(core, level);
    const m = runMatch({ core, level, sides: { T: kind, CT: kind }, seed, rounds: 2 });
    return { score: m.score, rounds: m.rounds, ticks: m.ticks };
  };
  assert.deepEqual(play(5), play(5));
  assert.notDeepEqual(play(5).rounds, play(6).rounds);
});

// A recorded match: csbih-player's timelines hold the play of real people and are never part of this repository.
const { loadMapData, loadProfiles, loadTimeline, timelineIds } = await import('../hosts/csbih/load.js');
const { playDemoRound } = await import('../hosts/csbih/demo.js');
const demoId = skip ? null : timelineIds().find((id) => id.includes('de-dust2')) ?? null;
const skipDemo = skip || (demoId ? false : 'no built timeline of de_dust2 in csbih-player');

test('fatalbot takes a side of a recorded round: the round ends, and the same seed gives the same round', { skip: skipDemo }, () => {
  const timeline = loadTimeline(demoId);
  const demoLevel = loadLevel(core, timeline.map, { v16: (timeline.source?.netProtocol ?? 0) >= 47 });
  const round = core.demoRound.demoRounds(timeline).find((r) => !r.empty && r.winner);
  const play = (side, seed) => playDemoRound({ core, level: demoLevel, timeline, round, side, seed, profiles: loadProfiles(demoId), mapData: loadMapData(timeline.map) });
  for (const side of ['T', 'CT']) {
    const r = play(side, 3);
    assert.ok(r.winner === 'T' || r.winner === 'CT', `the round ends (${r.reason})`);
    assert.ok(r.measure.fatal.commands > 0 && r.measure.demo.alive > 0);
    const again = play(side, 3);
    assert.deepEqual({ ...again, measure: null }, { ...r, measure: null });
  }
});
