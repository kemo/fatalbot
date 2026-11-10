// Matches of bots in the csbih host, with the measures of the gates (spec 01, section 4).
// Usage: node tools/arena.js [--a fatal] [--b ref] [--maps de_dust2,de_inferno] [--rounds 12] [--seeds 1,2,3]
//                            [--sides both] [--json file]
// Team A plays T then CT on each map and seed (`--sides both`), so a side's bias and a team's strength come apart.
// Kinds: `ref` (the bots of csbih-player, with the map's view field and lineups; `ref-bare` without them) and
// `fatal` (this repository's brain).

import { writeFileSync } from 'node:fs';
import { csbihMissing, loadCore, loadLevel, loadMapData } from '../hosts/csbih/load.js';
import { measureLine, referenceKind, runMatch, summarize } from '../hosts/csbih/arena.js';

const args = { a: 'fatal', b: 'ref', maps: 'de_dust2', rounds: '12', seeds: '1', sides: 'both', json: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/arena.js [--a fatal] [--b ref] [--maps de_dust2,de_inferno] [--rounds 12] [--seeds 1,2,3] [--sides both|once] [--json file]');
    process.exit(key === 'help' ? 0 : 1);
  }
  args[key] = argv[++i];
}

const missing = csbihMissing();
if (missing) {
  console.error(`The arena needs csbih-player: ${missing}.`);
  process.exit(1);
}
const core = await loadCore();

/** The kind of bots named `name` for a level; each match gets its own. */
async function kindFor(name, level) {
  if (name === 'ref') return referenceKind(core, loadMapData(level.map));
  if (name === 'ref-bare') return { ...referenceKind(core), name: 'ref-bare' };
  if (name === 'fatal') {
    const { fatalKind } = await import('../hosts/csbih/kind.js');
    return fatalKind(core, level);
  }
  throw new Error(`Unknown kind of bots: ${name}.`);
}

const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '-');
const matches = [];
for (const map of args.maps.split(',')) {
  const gone = csbihMissing(map);
  if (gone) {
    console.error(`Skipped ${map}: ${gone}.`);
    continue;
  }
  const level = loadLevel(core, map);
  for (const seed of args.seeds.split(',').map(Number)) {
    for (const order of args.sides === 'both' ? [['a', 'b'], ['b', 'a']] : [['a', 'b']]) {
      const sides = { T: await kindFor(args[order[0]], level), CT: await kindFor(args[order[1]], level) };
      // One kind against itself: both sides share one name, and one set of measures.
      if (sides.T.name === sides.CT.name) sides.CT = sides.T;
      const m = runMatch({ core, level, sides, seed, rounds: Number(args.rounds) });
      matches.push(m);
      console.log(`${map.padEnd(12)} seed ${String(seed).padStart(2)}  T ${m.sides.T.padEnd(8)} ${String(m.score.T).padStart(2)} : ${String(m.score.CT).padEnd(2)} ${m.sides.CT.padEnd(8)} CT  plants ${m.rounds.filter((r) => r.planted).length}  ${(m.stepMs / m.ticks).toFixed(3)} ms a tick`);
    }
  }
}
if (!matches.length) process.exit(1);

const s = summarize(matches);
console.log(`\n${s.matches} matches, ${s.rounds} rounds, ${(s.seconds / s.rounds).toFixed(0)} s a round, ${(s.stepMs / s.ticks).toFixed(3)} ms a tick`);
console.log(`G2 sides: T ${pct(s.bySide.T, s.rounds)}  CT ${pct(s.bySide.CT, s.rounds)}`);
if (Object.keys(s.byKind).length > 1 || args.a !== args.b) console.log(`G1 kinds: ${Object.entries(s.byKind).map(([k, n]) => `${k} ${pct(n, s.rounds)}`).join('  ')}`);
console.log(`G4 rounds: plants ${pct(s.plants, s.rounds)}; ${Object.entries(s.reasons).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ')}; on the clock with no kill ${s.noKillTimeouts}`);
for (const [kind, m] of Object.entries(s.measure)) console.log(measureLine(kind, m));
if (args.json) writeFileSync(args.json, JSON.stringify({ args, summary: s, matches }, null, 1));
