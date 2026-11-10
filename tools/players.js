// The aim of the recorded players, with its spread and its error (hosts/csbih/players.js): the share of the kills
// with a shot to the head, and for each kill the crosshair error at the first sight, the time to the first shot,
// the peak turn, the error at the first shot and how far under the head the crosshair was. A bot's hand is held
// against these numbers (spec 01, gate G7).
// Usage: node tools/players.js [--maps de_dust2,de_nuke] [--shard 0/8] [--fresh] [--json file]
// The facts of each demo are kept in out/players/cache/ (git-ignored), so a second run reads no demo again.
// `--shard k/n` reads only each n-th demo and prints nothing: run n of them at the same time, then one run with no
// shard for the tables. A table names no player and no team.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csbihMissing, csbihRoot, loadAimStats, loadCore, loadLevel, loadTimeline, timelineIds } from '../hosts/csbih/load.js';
import { MEASURES, MIN_FIGHTS, MIN_KILLS, aimOf, burstSteps, playerFacts, turnsBySight } from '../hosts/csbih/players.js';
import { seeded } from '../src/random.js';

const args = { maps: null, shard: null, fresh: false, json: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/players.js [--maps de_dust2,de_nuke] [--shard 0/8] [--fresh] [--json file]');
    process.exit(key === 'help' ? 0 : 1);
  }
  args[key] = typeof args[key] === 'boolean' ? true : argv[++i];
}
const missing = csbihMissing();
if (missing) {
  console.error(`The measure needs csbih-player: ${missing}.`);
  process.exit(1);
}
const core = await loadCore();
const aimStats = await loadAimStats();
const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'players', 'cache');
mkdirSync(CACHE, { recursive: true });
const VERSION = 3;

// Which demo is of which map: the index of the player's server knows without a read of each timeline.
let index = null;
try {
  index = JSON.parse(readFileSync(join(csbihRoot(), 'out', 'index.json'), 'utf8'));
} catch {
  // No index: each timeline says its own map.
}
const wanted = args.maps ? new Set(args.maps.split(',')) : null;
const [shard, shards] = args.shard ? args.shard.split('/').map(Number) : [0, 1];
const levels = new Map();
const byMap = new Map();
let read = 0;
timelineIds().forEach((id, n) => {
  if (n % shards !== shard) return;
  const file = join(CACHE, `${id.replace(/[^\w-]/g, '-')}.json`);
  let facts = null;
  if (!args.fresh && existsSync(file)) {
    try {
      facts = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      facts = null;
    }
    if (facts?.version !== VERSION) facts = null;
  }
  if (!facts) {
    const known = index?.[id]?.info ?? null;
    if (known && (known.kind === 'pov' || csbihMissing(known.map) || (wanted && !wanted.has(known.map)))) return;
    let timeline;
    try {
      timeline = loadTimeline(id);
    } catch {
      return;
    }
    const v16 = (timeline.source?.netProtocol ?? 0) >= 47;
    // An old timeline has no fine view angles, and a POV demo has the view of one player only.
    const usable = timeline.source?.kind !== 'pov' && (timeline.version ?? 0) >= 8 && !csbihMissing(timeline.map);
    facts = { version: VERSION, map: timeline.map, players: null };
    if (usable) {
      const key = `${timeline.map}:${v16}`;
      if (!levels.has(key)) levels.set(key, loadLevel(core, timeline.map, { v16 }));
      facts.players = playerFacts(aimStats, levels.get(key).hulls, timeline);
    }
    writeFileSync(file, JSON.stringify(facts));
    read++;
  }
  if (!facts.players || (wanted && !wanted.has(facts.map))) return;
  if (!byMap.has(facts.map)) byMap.set(facts.map, []);
  byMap.get(facts.map).push(facts.players);
});
if (args.shard) {
  console.log(`Shard ${shard} of ${shards}: ${read} demos read.`);
  process.exit(0);
}

const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '-');
const num = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const all = [...byMap.values()].flat();
const out = { demos: all.length, groups: {}, maps: {} };
const lines = [];
lines.push(`${all.length} demos on ${byMap.size} maps (${read} read now). A player is one player of one demo.`);
lines.push('"All kills" is every kill as one heap, with the error of the number (the demos drawn again, 200 times).');
lines.push(`"The players" is the spread of the players' own numbers (${MIN_KILLS} kills or more for the head share, ${MIN_FIGHTS} measured kills or more for an aim measure).`);
for (const group of [null, 'rifle', 'pistol', 'sniper']) {
  const a = aimOf(all, seeded(1), group);
  out.groups[group ?? 'all'] = a;
  lines.push('', `### ${group ? `Kills with a ${group}` : 'All kills with a gun'} (${a.kills})`, '');
  lines.push('| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |');
  lines.push('|---------|------|------|------|------|------|------|------|------|');
  const h = a.head;
  lines.push(`| Kills with a shot to the head | ${pct(h.all)} | ${pct(h.error)} | ${pct(h.players.p10)} | ${pct(h.players.p25)} | ${pct(h.players.p50)} | ${pct(h.players.p75)} | ${pct(h.players.p90)} | ${h.players.n} |`);
  for (const [key, title, unit, d] of MEASURES) {
    const m = a.measures[key];
    lines.push(`| ${title}, the middle (${unit}) | ${num(m.all.p50, d)} | ${num(m.error, d + 1)} | ${num(m.players.p10, d)} | ${num(m.players.p25, d)} | ${num(m.players.p50, d)} | ${num(m.players.p75, d)} | ${num(m.players.p90, d)} | ${m.players.n} |`);
  }
  lines.push('', `Over every kill, p10 / p25 / p50 / p75 / p90: ${MEASURES.map(([key, title, unit, d]) => `${title.toLowerCase()} ${['p10', 'p25', 'p50', 'p75', 'p90'].map((p) => num(a.measures[key].all[p], d)).join(' / ')} ${unit}`).join('; ')}.`);
}
// The shots of a kill by their number: where the crosshair is while a burst goes on.
const stepRows = (steps) => steps.map((b) => `| ${b.title} | ${b.n} | ${num(b.low.p50, 1)} | ${num(b.lowError, 2)} | ${num(b.low.p10, 0)} | ${num(b.low.p25, 0)} | ${num(b.low.p75, 0)} | ${num(b.low.p90, 0)} | ${num(b.side.p50, 1)} | ${num(b.side.p90, 0)} | ${num(b.error.p50, 2)} | ${num(b.error.p90, 1)} |`);
for (const group of ['rifle', 'pistol', 'sniper']) {
  const demos = all.map((demo) => demo.flatMap((p) => p.bursts.filter((b) => b.group === group)));
  const kills = demos.flat();
  const steps = burstSteps(demos, seeded(1));
  out.groups[group].bursts = steps;
  out.groups[group].burstLength = (() => {
    const s = kills.map((b) => b.shots.length).sort((a, b) => a - b);
    return { n: s.length, p50: s[Math.floor(s.length * 0.5)], p90: s[Math.floor(s.length * 0.9)], headOfLast: kills.length ? kills.filter((b) => b.head).length / kills.length : NaN };
  })();
  lines.push('', `### The shots of a kill with a ${group}, by their number (${kills.length} kills)`, '');
  lines.push('The crosshair against the middle of the victim\'s head at each shot of the killer in the last 2 s before the kill.', '');
  lines.push('| Shot | Shots | Under the head: the middle (units) | its error | p10 | p25 | p75 | p90 | To the side: the middle | p90 | Error: the middle (degrees) | p90 |');
  lines.push('|------|------|------|------|------|------|------|------|------|------|------|------|');
  lines.push(...stepRows(steps));
  lines.push('', `Shots of a kill: ${out.groups[group].burstLength.p50} in the middle, ${out.groups[group].burstLength.p90} at p90.`);
}
// The hand by the size of the turn: the tails of the time and of the turn show a hand that is too fast.
const fights = all.flat().flatMap((p) => p.fights);
out.turns = turnsBySight(fights);
lines.push('', `### The hand by the crosshair error at the first sight (${fights.length} kills)`, '');
lines.push('| Error at the first sight (degrees) | Kills | Share | First sight to first shot: p10 | p50 | p90 (s) | Peak turn: p50 | p90 (degrees a second) | Error at the first shot: p10 | p50 | p90 (degrees) |');
lines.push('|------|------|------|------|------|------|------|------|------|------|------|');
for (const b of out.turns) lines.push(`| ${b.title} | ${b.n} | ${pct(b.share)} | ${num(b.toShot.p10, 2)} | ${num(b.toShot.p50, 2)} | ${num(b.toShot.p90, 2)} | ${num(b.peak.p50, 0)} | ${num(b.peak.p90, 0)} | ${num(b.shotErr.p10, 1)} | ${num(b.shotErr.p50, 1)} | ${num(b.shotErr.p90, 1)} |`);
lines.push('', '### By map (all kills with a gun)', '');
lines.push(`| Map | Demos | Kills | To the head | its error | ${MEASURES.map(([, title]) => title).join(' | ')} |`);
lines.push(`|-----|------|------|------|------|${MEASURES.map(() => '------').join('|')}|`);
for (const [map, demos] of [...byMap].sort((x, y) => y[1].length - x[1].length)) {
  const a = aimOf(demos, seeded(1));
  out.maps[map] = a;
  lines.push(`| ${map} | ${demos.length} | ${a.kills} | ${pct(a.head.all)} | ${pct(a.head.error)} | ${MEASURES.map(([key, , , d]) => `${num(a.measures[key].all.p50, d)} (${num(a.measures[key].error, d + 1)})`).join(' | ')} |`);
}
console.log(lines.join('\n'));
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
