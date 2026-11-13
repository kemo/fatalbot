// fatalbot against recorded matches (hosts/csbih/demo.js): in each round of a demo, fatalbot takes the place of one
// side, and the other side plays its recording until the round leaves it.
// Usage: node tools/demo-arena.js [--demos id,id] [--map de_dust2] [--count 4] [--rounds 10] [--sides both|T|CT|none]
//                                 [--seed 1] [--hands demo|default] [--nades] [--plans] [--json file]
// `--standins fatal` lets fatalbot play on for a player who left its recording, in the place of the reference bot:
// the bots of a replay of csbih-player. `--standins fatal-route` gives each of them the route of its player too.
// `--nades` gives fatalbot the map's grenade lineups. `--plans` gives it the plans that tools/strategies.js mined
// for the map (they come from the same recorded matches).
// Without --demos it takes `count` HLTV demos of `map`, the same ones for the same seed. A report names no player.

import { writeFileSync } from 'node:fs';
import { csbihMissing, levelFor, loadAimStats, loadBody, loadCore, loadMapData, loadPlans, loadProfiles, loadTimeline, timelineIds } from '../hosts/csbih/load.js';
import { addMeasures, aimLine, burstLines, feetLine, measureLine, styleLine, turnLines, useBody } from '../hosts/csbih/arena.js';
import { playDemoRound } from '../hosts/csbih/demo.js';
import { fitRounds } from '../hosts/csbih/strategies.js';

const args = { demos: null, map: 'de_dust2', count: '4', rounds: '10', sides: 'both', seed: '1', hands: 'demo', json: null, nades: false, plans: false, standins: 'ref' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/demo-arena.js [--demos id,id] [--map de_dust2] [--count 4] [--rounds 10] [--sides both|T|CT|none] [--seed 1] [--hands demo|default] [--nades] [--plans] [--standins ref|fatal|fatal-route] [--json file]');
    process.exit(key === 'help' ? 0 : 1);
  }
  args[key] = typeof args[key] === 'boolean' ? true : argv[++i];
}
const missing = csbihMissing();
if (missing) {
  console.error(`The demo arena needs csbih-player: ${missing}.`);
  process.exit(1);
}
const core = await loadCore();
const aimStats = await loadAimStats();
// The bullets meet the hit boxes of the player model, as in the real game.
useBody(await loadBody());
const seed = Number(args.seed);
// A stable shuffle of the demos by the seed, so a second run with a change plays the same matches.
const hash = (s) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, seed);
const wanted = args.demos ? args.demos.split(',') : timelineIds().sort((a, b) => hash(a) - hash(b));
// `--sides none` replaces nobody: every round is the demo, and the measures are the players' own.
const sides = args.sides === 'both' ? ['T', 'CT'] : args.sides === 'none' ? [null] : [args.sides];
const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(0)}%` : '-');

const total = { T: { n: 0, fatal: 0, demo: 0 }, CT: { n: 0, fatal: 0, demo: 0 }, null: { n: 0, fatal: 0, demo: 0 } };
const aim = {};
const bursts = {};
const measure = {};
const why = {};
// `together`: the bots that left their route within TOGETHER seconds of a teammate that left its own.
const TOGETHER = 1;
const routed = { seconds: 0, on: 0, why: {}, gone: 0, together: 0 };
const report = [];
let used = 0;
for (const id of wanted) {
  if (used >= Number(args.count) && !args.demos) break;
  let timeline;
  try {
    timeline = loadTimeline(id);
  } catch {
    continue;
  }
  if (!args.demos && (timeline.map !== args.map || timeline.source?.kind === 'pov')) continue;
  if (csbihMissing(timeline.map)) continue;
  const { level } = levelFor(core, timeline);
  if (!level.rules.bombTargets?.length && !level.rules.bombPoints?.length) continue;
  // A recording that goes on into another map keeps the name of its first one: those rounds are left out.
  const whole = core.demoRound.demoRounds(timeline).filter((r) => !r.empty && (r.winner === 'T' || r.winner === 'CT'));
  const rounds = fitRounds(core, level, timeline, whole).slice(0, Number(args.rounds));
  if (rounds.length < 3) continue;
  used++;
  const profiles = loadProfiles(id);
  const mapData = loadMapData(timeline.map);
  const plans = args.plans ? loadPlans(timeline.map) : null;
  const row = { demo: used, map: timeline.map, rounds: [] };
  const line = { T: { n: 0, fatal: 0, demo: 0 }, CT: { n: 0, fatal: 0, demo: 0 }, null: { n: 0, fatal: 0, demo: 0 } };
  for (const round of rounds) {
    for (const side of sides) {
      const r = playDemoRound({ core, level, timeline, round, side, seed, profiles, mapData, hands: args.hands, aimStats, nades: args.nades, plans, standins: args.standins });
      for (const [kind, list] of Object.entries(r.aim)) (aim[kind] ??= []).push(...list);
      for (const [kind, list] of Object.entries(r.bursts)) (bursts[kind] ??= []).push(...list);
      row.rounds.push({ number: r.number, side, winner: r.winner, reason: r.reason, seconds: r.seconds, planted: r.planted, demo: r.demo, derails: r.derails, firstDerail: r.firstDerail });
      addMeasures(measure, r.measure);
      for (const [k, n] of Object.entries(r.why)) why[k] = (why[k] ?? 0) + n;
      routed.seconds += r.routed.seconds;
      routed.on += r.routed.on;
      for (const [k, n] of Object.entries(r.routed.why)) routed.why[k] = (routed.why[k] ?? 0) + n;
      // A route that ends with its recording is no leave by an event of the round.
      const events = r.routed.left.filter((x) => x.why !== 'route-end');
      routed.gone += events.length;
      routed.together += events.filter((x) => events.some((y) => y !== x && y.team === x.team && Math.abs(y.t - x.t) <= TOGETHER)).length;
      for (const sum of [line[side], total[side]]) {
        sum.n++;
        if (r.winner === (side ?? round.winner)) sum.fatal++;
        if (round.winner === side) sum.demo++;
      }
    }
  }
  report.push(row);
  console.log(`demo ${String(used).padStart(2)} ${timeline.map.padEnd(11)} ${String(rounds.length).padStart(2)} rounds  ${sides.map((s) => (s ? `as ${s.padEnd(2)}: fatalbot won ${String(line[s].fatal).padStart(2)}, the players won ${String(line[s].demo).padStart(2)}` : `on the rails: ${line[s].fatal} rounds end as in the demo`)).join('   ')}`);
}
if (!used) {
  console.error('No demo to play: csbih-player needs built timelines (out/*.json.br) of a bomb map with a built level.');
  process.exit(1);
}
console.log(`\n${used} demos, seed ${seed}, hands: ${args.hands}`);
for (const side of sides) {
  const t = total[side];
  if (!side) {
    console.log(`Nobody replaced: ${t.fatal} of ${t.n} rounds end with the demo's winner.`);
    continue;
  }
  console.log(`In the place of the ${side}s: fatalbot won ${t.fatal} of ${t.n} rounds (${pct(t.fatal, t.n)}); the players in those places won ${t.demo} (${pct(t.demo, t.n)}).`);
}
// How a player left the recording: 'hit' is a player that fatalbot hit before it saw or heard fatalbot.
const left = Object.values(why).reduce((n, v) => n + v, 0);
console.log(`The players left their recording ${left} times: ${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} (${pct(n, left)})`).join(', ')}.`);
console.log(`Kinds: fatal; rails (the players' own recording); standin (${args.standins === 'ref' ? 'the reference bot' : args.standins === 'fatal-route' ? 'fatalbot with the route of its player' : 'fatalbot'} that plays on for a player).`);
if (routed.seconds > 0) {
  const gone = Object.values(routed.why).reduce((n, v) => n + v, 0);
  console.log(`The stand-ins with a route were on it for ${pct(routed.on, routed.seconds)} of their ${Math.round(routed.seconds)} s alive. They left it ${gone} times: ${Object.entries(routed.why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} (${pct(n, gone)})`).join(', ')}.`);
  console.log(`Of the ${routed.gone} bots that left a route before its recording ended, ${routed.together} (${pct(routed.together, routed.gone)}) left within ${TOGETHER} s of a teammate that left its own.`);
}
for (const [kind, m] of Object.entries(measure)) if (m.alive > 0) console.log(measureLine(kind, m));
for (const [kind, m] of Object.entries(measure)) if (m.alive > 0) console.log(feetLine(kind, m));
for (const [kind, m] of Object.entries(measure)) if (m.alive > 0) console.log(styleLine(kind, m));
for (const [kind, list] of Object.entries(aim)) console.log(aimLine(kind, list));
for (const [kind, list] of Object.entries(aim)) console.log(turnLines(kind, list));
for (const [kind, list] of Object.entries(bursts)) for (const group of ['rifle', 'pistol', 'sniper']) console.log(burstLines(kind, list, group));
if (args.json) writeFileSync(args.json, JSON.stringify({ args, total, measure, why, routed, report }, null, 1));
