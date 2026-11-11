// The shape of the rounds (hosts/csbih/rounds.js): the recorded matches beside a kind of bots that plays itself.
// Usage: node tools/rounds.js [--kinds fatal,fatal-plans] [--maps de_dust2,de_inferno] [--seeds 1,2,3,4,5,6]
//                             [--rounds 12] [--by-map] [--json file]
// The recorded matches come from the cache of tools/strategies.js (out/strategies/cache/): run that tool first.
// `--kinds none` prints the recorded matches alone. A table names no player and no team.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csbihMissing, loadBody, loadCore, loadLevel, loadMapData, loadPlans } from '../hosts/csbih/load.js';
import { runMatch, useBody } from '../hosts/csbih/arena.js';
import { fatalKind } from '../hosts/csbih/kind.js';
import { shapeOf, shapeTable } from '../hosts/csbih/rounds.js';
import { zonesOf } from '../hosts/csbih/strategies.js';

const args = { kinds: 'fatal', maps: 'de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble', seeds: '1,2,3,4,5,6', rounds: '12', 'by-map': false, json: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/rounds.js [--kinds fatal,fatal-plans|none] [--maps de_dust2,de_inferno] [--seeds 1,2,3] [--rounds 12] [--by-map] [--json file]');
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
useBody(await loadBody());
const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'strategies', 'cache');
const kinds = args.kinds === 'none' ? [] : args.kinds.split(',');
const columns = ['The recorded matches', ...kinds];
// By column, then by map: the shapes of the rounds.
const shapes = columns.map(() => ({}));
for (const map of args.maps.split(',')) {
  if (csbihMissing(map)) {
    console.error(`Skipped ${map}: ${csbihMissing(map)}.`);
    continue;
  }
  const level = loadLevel(core, map);
  const zones = zonesOf(core, level);
  const dir = join(CACHE, map);
  const recorded = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).rounds) : [];
  if (!recorded.length) console.error(`${map}: no recorded rounds in ${dir}. Run tools/strategies.js first.`);
  shapes[0][map] = recorded.map((r) => shapeOf(zones, r));
  kinds.forEach((name, k) => {
    if (!/^fatal(-plans)?(-nades)?$/.test(name)) throw new Error(`Unknown kind of bots: ${name}.`);
    const rounds = [];
    for (const seed of args.seeds.split(',').map(Number)) {
      const kind = fatalKind(core, level, { name, lineups: name.includes('-nades') ? loadMapData(map).lineups : [], plans: name.includes('-plans') ? loadPlans(map) : null });
      rounds.push(...runMatch({ core, level, sides: { T: kind, CT: kind }, seed, rounds: Number(args.rounds), facts: true }).facts);
    }
    shapes[k + 1][map] = rounds.map((r) => shapeOf(zones, r));
  });
  console.error(`${map}: ${recorded.length} recorded rounds${kinds.map((name, k) => `, ${shapes[k + 1][map].length} of ${name}`).join('')}`);
}

const show = (v, unit) => (!Number.isFinite(v) ? '-' : unit === '%' ? `${(v * 100).toFixed(0)}%` : unit === 's' ? `${v.toFixed(0)} s` : Number.isInteger(v) ? String(v) : v.toFixed(2));
function print(title, pick) {
  const tables = shapes.map((byMap) => shapeTable(Object.entries(byMap).flatMap(([map, list]) => list.filter((r) => pick(map, r)))));
  console.log(`\n### ${title}\n`);
  console.log(`| Measure | ${columns.join(' | ')} |`);
  console.log(`|---------|${columns.map(() => '------').join('|')}|`);
  tables[0].forEach(([name, , unit], i) => console.log(`| ${name} | ${tables.map((t) => show(t[i][1], unit)).join(' | ')} |`));
}
print('All rounds', () => true);
print('Rounds with a full buy of both sides', (map, r) => r.buy?.T === 'full' && r.buy?.CT === 'full');
if (args['by-map']) for (const map of Object.keys(shapes[0])) print(map, (m) => m === map);
// The site that the Ts went for, by map: how often, and how often they won.
console.log('\n### By map and by the site of the attack: rounds, the Ts win, rounds with a plant\n');
console.log(`| Map | Site | ${columns.join(' | ')} |`);
console.log(`|-----|------|${columns.map(() => '------').join('|')}|`);
for (const map of Object.keys(shapes[0])) {
  for (const site of [0, 1, null]) {
    const cells = shapes.map((byMap) => {
      const list = (byMap[map] ?? []).filter((r) => r.site === site);
      return list.length ? `${list.length}, ${show(list.filter((r) => r.winner === 'T').length / list.length, '%')}, ${show(list.filter((r) => r.plant).length / list.length, '%')}` : '-';
    });
    console.log(`| ${map} | ${site === null ? 'none' : site} | ${cells.join(' | ')} |`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify({ args, columns, shapes }, null, 1));
