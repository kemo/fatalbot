// The csbih host against the real game core of csbih-player. Skips when no built checkout is near (README, "Run").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand, checkFrame, checkMap } from '../src/contract.js';
import { csbihMissing, loadCore, loadLevel } from '../hosts/csbih/load.js';
import { mapOf, restLevel } from '../hosts/csbih/adapter.js';
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

test('a match gives the places of its players in each round, as a recorded match gives them', { skip }, () => {
  const kind = fatalKind(core, level);
  const m = runMatch({ core, level, sides: { T: kind, CT: kind }, seed: 2, rounds: 2, facts: true });
  assert.equal(m.facts.length, 2);
  for (const r of m.facts) {
    assert.ok(r.winner === 'T' || r.winner === 'CT');
    assert.deepEqual([r.T.length, r.CT.length], [5, 5]);
    // A place every 2 s of the round, and every player alive at its start.
    assert.ok(Math.abs(r.T[0].length - r.seconds / 2) <= 1, `${r.T[0].length} places in ${r.seconds} s`);
    assert.ok([...r.T, ...r.CT].every((lane) => lane[0]?.length === 4));
    assert.ok(['pistol', 'force', 'full'].includes(r.buy.T) && ['pistol', 'force', 'full'].includes(r.buy.CT));
  }
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
    assert.ok(r.measure.fatal.commands > 0 && r.measure.rails.alive + r.measure.standin.alive > 0);
    const again = play(side, 3);
    assert.deepEqual({ ...again, measure: null }, { ...r, measure: null });
  }
});

// The recorder: a played round as a timeline that the player's own server and TV page read (tools/watch.js).
const { loadAnim, csbihRoot } = await import('../hosts/csbih/load.js');
const { Recorder } = await import('../hosts/csbih/record.js');

test('a recorded round is a timeline of the player, with the fatalbot team named', { skip: skipDemo }, async () => {
  const timeline = loadTimeline(demoId);
  const v16 = (timeline.source?.netProtocol ?? 0) >= 47;
  const demoLevel = loadLevel(core, timeline.map, { v16 });
  const rounds = core.demoRound.demoRounds(timeline).filter((r) => !r.empty && r.winner).slice(0, 2);
  const { anim, mdl } = await loadAnim();
  const record = new Recorder({ map: timeline.map, title: 'test', v16, anim, mdl });
  const played = rounds.map((round) => playDemoRound({ core, level: demoLevel, timeline, round, side: 'T', seed: 3, profiles: loadProfiles(demoId), mapData: loadMapData(timeline.map), record, tail: 2, gap: 1 }));
  const t = JSON.parse(JSON.stringify(record.timeline()));
  assert.equal(t.version, 8);
  assert.equal(t.map, timeline.map);
  assert.deepEqual(t.rounds.map((r) => r.kind), ['start', 'end', 'start', 'end']);
  assert.deepEqual(t.rounds.filter((r) => r.kind === 'end').map((r) => r.winner), played.map((r) => r.winner));
  // Twenty rows a second, each with every player: [t, (entity, x, y, z, yaw, flags) ...].
  assert.ok(t.samples.length > t.duration * 15);
  for (const row of t.samples) assert.equal((row.length - 1) % 6, 0);
  assert.ok(t.samples.every((row, i) => i === 0 || row[0] >= t.samples[i - 1][0]), 'the rows go on in time');
  const fatal = t.players.filter((p) => p.name.startsWith('FatalBot | '));
  assert.equal(fatal.length, 5);
  assert.ok(t.anims.length > 20 && t.anims.every((a) => a[2] >= 0 && a[2] < mdl.sequences.length && a[3] >= 0 && a[3] < mdl.sequences.length));
  assert.ok(t.shots.length > 0 && t.loadouts.length >= 10 && t.sounds.length > 0);
  assert.ok(t.kills.every((k) => k.t <= t.duration && k.victim));
  // The player's own server reads it, and takes "FatalBot" as the tag of that team.
  const { indexEntry } = await import(`${csbihRoot()}/src/server.js`);
  const entry = indexEntry('fatalbot-test', t);
  assert.equal(entry.info.kind, 'hltv');
  assert.equal(entry.summary.rounds, 2);
  assert.ok(entry.summary.teams.some((team) => team.tag === 'FatalBot' && team.players.length === 5));
});

test('the doors of a level go back to the places of its file before a new world', () => {
  // A level of two hull models: the second is a door that a world slid and turned.
  const level = { hulls: { models: [{ origin: [0, 0, 0] }, { origin: [10, 20, 30] }, { origin: [5, 5, 5], rot: 0 }] } };
  restLevel(level);
  level.hulls.models[1].origin[0] = 74;
  level.hulls.models[1].rot = 90;
  level.hulls.models[2].rot = -45;
  restLevel(level);
  assert.deepEqual(level.hulls.models[1], { origin: [10, 20, 30] }, 'the slide and the turn are gone');
  assert.deepEqual(level.hulls.models[2], { origin: [5, 5, 5], rot: 0 });
});

test('the level of a recording is a build of its map, and most of its rounds start at that build\'s spawns', { skip: skipDemo }, async () => {
  const { levelFor } = await import('../hosts/csbih/load.js');
  const { fitRounds } = await import('../hosts/csbih/strategies.js');
  const timeline = loadTimeline(demoId);
  const { level, v16 } = levelFor(core, timeline);
  assert.equal(level.map, timeline.map);
  assert.equal(typeof v16, 'boolean');
  const rounds = core.demoRound.demoRounds(timeline).filter((r) => !r.empty && (r.winner === 'T' || r.winner === 'CT'));
  assert.ok(fitRounds(core, level, timeline, rounds).length * 2 > rounds.length);
});
