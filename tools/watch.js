// Watch fatalbot play a recorded match, in the TV page of csbih-player, at the speed of the game.
// fatalbot takes the place of one side of a demo (tools/demo-arena.js); the other side plays its recording until
// the round leaves it, then plays on as the reference bots with those players' routes and profiles. The rounds
// are written as one timeline of the player (hosts/csbih/record.js), and the player's own server shows it.
// On the screen the bots of fatalbot are named "FatalBot | 1" to "FatalBot | 5": the page takes "FatalBot" as the
// tag of that team. The other team keeps the names of its players.
//
// Usage: node tools/watch.js [--demo id] [--map de_dust2] [--side T|CT] [--rounds 6] [--first 1] [--seed 1]
//                            [--hands demo|default] [--plans] [--port 3038] [--no-serve]
// `--plans` gives fatalbot the plans that tools/strategies.js mined for the map.
// The timeline goes to out/watch/ of this repository (git-ignored): it holds the play of real people.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { csbihMissing, csbihRoot, levelFor, loadAnim, loadBody, loadCore, loadMapData, loadPlans, loadProfiles, loadTimeline, timelineIds } from '../hosts/csbih/load.js';
import { playDemoRound } from '../hosts/csbih/demo.js';
import { useBody } from '../hosts/csbih/arena.js';
import { Recorder } from '../hosts/csbih/record.js';

const args = { demo: null, map: 'de_dust2', side: 'T', rounds: '6', first: '1', seed: '1', hands: 'demo', port: '3038', 'no-serve': false, plans: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/watch.js [--demo id] [--map de_dust2] [--side T|CT] [--rounds 6] [--first 1] [--seed 1] [--hands demo|default] [--port 3038] [--no-serve]');
    process.exit(key === 'help' ? 0 : 1);
  }
  args[key] = typeof args[key] === 'boolean' ? true : argv[++i];
}
const missing = csbihMissing();
if (missing) {
  console.error(`The watch needs csbih-player: ${missing}.`);
  process.exit(1);
}
const side = args.side === 'CT' ? 'CT' : 'T';
const seed = Number(args.seed);
const core = await loadCore();
useBody(await loadBody());

// The demo: the one named, else the first HLTV demo of the map in the seed's order (as tools/demo-arena.js).
const hash = (s) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, seed);
let id = args.demo;
let timeline = null;
for (const candidate of id ? [id] : timelineIds().sort((a, b) => hash(a) - hash(b))) {
  let t;
  try {
    t = loadTimeline(candidate);
  } catch {
    continue;
  }
  if (!args.demo && (t.map !== args.map || t.source?.kind === 'pov' || csbihMissing(t.map))) continue;
  [id, timeline] = [candidate, t];
  break;
}
if (!timeline) {
  console.error(args.demo ? `No timeline ${args.demo} in ${csbihRoot()}/out.` : `No HLTV demo of ${args.map} in ${csbihRoot()}/out.`);
  process.exit(1);
}
const { level, v16 } = levelFor(core, timeline);
const all = core.demoRound.demoRounds(timeline).filter((r) => !r.empty && (r.winner === 'T' || r.winner === 'CT'));
const rounds = all.filter((r) => r.number >= Number(args.first)).slice(0, Number(args.rounds));
if (!rounds.length) {
  console.error(`The demo ${id} has no round to play from round ${args.first}.`);
  process.exit(1);
}

const { anim, mdl } = await loadAnim();
const plans = args.plans ? loadPlans(timeline.map) : null;
const record = new Recorder({ map: timeline.map, title: `FatalBot (${side}${plans ? ', with the plans of the map' : ''}) against the demo ${id}`, v16, anim, mdl });
const profiles = loadProfiles(id);
const mapData = loadMapData(timeline.map);
let won = 0;
let theirs = 0;
console.log(`FatalBot plays the ${side}s of ${id} (${timeline.map}), ${rounds.length} rounds, seed ${seed}, hands: ${args.hands}${plans ? ', with the plans of the map' : ''}.`);
for (const round of rounds) {
  const at = record.clock;
  const r = playDemoRound({ core, level, timeline, round, side, seed, profiles, mapData, hands: args.hands, record, tail: 3, gap: 1, plans });
  if (r.winner === side) won++;
  if (round.winner === side) theirs++;
  const m = `${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')}`;
  console.log(`  round ${String(round.number).padStart(2)} at ${m.padStart(5)} (t=${Math.floor(at)})  ${r.winner === side ? 'FatalBot wins' : 'FatalBot loses'}  ${r.reason.padEnd(15)} ${r.seconds.toFixed(0).padStart(3)} s   in the demo the ${round.winner}s won`);
}
console.log(`FatalBot won ${won} of ${rounds.length} rounds; the players in its place won ${theirs}.`);

// The timeline, where the player's server reads timelines from: a folder of this repository.
const HERE = dirname(fileURLToPath(import.meta.url));
const dir = join(HERE, '..', 'out', 'watch');
mkdirSync(dir, { recursive: true });
const name = `fatalbot-${plans ? 'plans-' : ''}${side.toLowerCase()}-${id}`.replace(/[^\w-]/g, '-');
writeFileSync(join(dir, `${name}.json.br`), brotliCompressSync(JSON.stringify(record.timeline())));
// Beside the folder, not in it: the server takes every JSON file of the folder for a timeline.
const channels = join(dir, '..', 'watch-channels.json');
writeFileSync(channels, JSON.stringify({ channels: [{ id: 'fatalbot', title: 'FatalBot against recorded matches', epoch: '2026-11-10T00:00:00Z', items: '*' }] }, null, 1));
// The radar's floor of each map lies beside the player's own timelines.
const maps = join(csbihRoot(), 'out', 'maps');
if (existsSync(maps) && !existsSync(join(dir, 'maps'))) symlinkSync(maps, join(dir, 'maps'));
console.log(`\nWrote out/watch/${name}.json.br`);

const base = `http://localhost:${args.port}/tv?demo=${name}`;
const pages = `  3D, the camera follows the action:  ${base}&pogled=3d\n  The radar and the 3D view together:  ${base}&pogled=all\n  First person:                        ${base}&pogled=fps\n  Add &t=<seconds> to start at a round (the t of the list above). Space pauses.`;
if (args['no-serve']) {
  console.log(`Start the player on this folder, then open:\n  node ${join(csbihRoot(), 'src', 'server.js')} --port ${args.port} --timelines ${dir} --channels ${channels}\n${pages}`);
} else {
  console.log(`\nThe player runs on port ${args.port}. Open one of these, and stop it with Ctrl+C:\n${pages}\n`);
  const server = spawn(process.execPath, [join(csbihRoot(), 'src', 'server.js'), '--port', args.port, '--timelines', dir, '--channels', channels], { stdio: 'inherit' });
  server.on('exit', (code) => process.exit(code ?? 0));
}
