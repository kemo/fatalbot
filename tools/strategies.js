// The strategies of the recorded matches, for every map that has HLTV demos and a built level (hosts/csbih/
// strategies.js): how the five of each side stood, which site the Ts took and when, and how often each way of
// playing won.
// Usage: node tools/strategies.js [--maps de_dust2,de_nuke] [--min 3] [--report docs/strategies.md] [--fresh]
// It writes, into out/strategies/ (git-ignored): <map>.json with the strategies and the plans for the bots, and
// report.html with every strategy drawn on the floor of its map. The facts of each demo are kept in cache/, so a
// second run reads no demo again; `--fresh` reads them all again. A report names no player and no team.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csbihMissing, csbihRoot, loadCore, loadLevel, loadTimeline, timelineIds } from '../hosts/csbih/load.js';
import { FORM_AT, SAME, plansOf, roundFacts, strategiesOf, zonesOf } from '../hosts/csbih/strategies.js';

const args = { maps: null, min: '3', report: null, fresh: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, '');
  if (key === 'help' || !(key in args)) {
    console.log('node tools/strategies.js [--maps de_dust2,de_nuke] [--min 3] [--report docs/strategies.md] [--fresh]');
    process.exit(key === 'help' ? 0 : 1);
  }
  args[key] = typeof args[key] === 'boolean' ? true : argv[++i];
}
const missing = csbihMissing();
if (missing) {
  console.error(`The analysis needs csbih-player: ${missing}.`);
  process.exit(1);
}
const core = await loadCore();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'strategies');
// The facts in the cache: 5 leaves out the rounds that are not played on the level of their map.
const VERSION = 5;

// Which demo is of which map: the index of the player's server knows without a read of each timeline.
let index = null;
try {
  index = JSON.parse(readFileSync(join(csbihRoot(), 'out', 'index.json'), 'utf8'));
} catch {
  // No index: each timeline says its own map.
}
const byMap = new Map();
for (const id of timelineIds()) {
  let info = index?.[id]?.info ?? null;
  if (!info) {
    try {
      const t = loadTimeline(id);
      info = { map: t.map, kind: t.source?.kind };
    } catch {
      continue;
    }
  }
  if (info.kind === 'pov') continue;
  if (!byMap.has(info.map)) byMap.set(info.map, []);
  byMap.get(info.map).push(id);
}

// The sites that players call A, by a point in each (as csbih-player's places.js has them).
const SITE_A = { de_dust2: [1152, 2464], de_inferno: [2024, 376], de_nuke: [680, -776] };
function siteNames(map, zones) {
  const a = SITE_A[map];
  if (!a || zones.sites.length !== 2) return zones.sites.map((_, k) => `site ${k + 1}`);
  const d = zones.sites.map((s) => Math.hypot(s.mid[0] - a[0], s.mid[1] - a[1]));
  return d[0] <= d[1] ? ['A', 'B'] : ['B', 'A'];
}

const pct = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);
const sec = (v) => (v === null || v === undefined ? '-' : `${Math.round(v)} s`);

/** A formation in words: how many of the five stand at each site, at a spawn, and between. */
function inWords(points, zones, names) {
  const count = {};
  for (const p of points) {
    let where = 'between';
    let best = 750;
    zones.sites.forEach((s, k) => {
      const d = Math.hypot(p[0] - s.mid[0], p[1] - s.mid[1]);
      if (d < best && Math.abs(p[2] - s.mid[2]) < 300) [where, best] = [`at ${names[k]}`, d];
    });
    if (where === 'between') {
      for (const [side, at] of Object.entries(zones.spawn)) if (at && Math.hypot(p[0] - at[0], p[1] - at[1]) < 800) where = `near the ${side} spawn`;
    }
    count[where] = (count[where] ?? 0) + 1;
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ');
}

// The picture: the floor of a map from its nav graph, the sites, and the five places of a strategy.
const SIZE = 230;
function frameOf(nav) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nav.count; i++) {
    x0 = Math.min(x0, nav.xyz[i * 3]);
    x1 = Math.max(x1, nav.xyz[i * 3]);
    y0 = Math.min(y0, nav.xyz[i * 3 + 1]);
    y1 = Math.max(y1, nav.xyz[i * 3 + 1]);
  }
  const k = (SIZE - 12) / Math.max(x1 - x0, y1 - y0);
  const to = (p) => [6 + (p[0] - x0) * k, 6 + (y1 - p[1]) * k];
  return { to, k, w: 12 + (x1 - x0) * k, h: 12 + (y1 - y0) * k };
}
function floorPath(nav, frame) {
  const step = nav.count > 20000 ? 3 : 2;
  const size = Math.max(0.9, 32 * frame.k * 1.1);
  let d = '';
  for (let i = 0; i < nav.count; i += step) {
    const [x, y] = frame.to([nav.xyz[i * 3], nav.xyz[i * 3 + 1]]);
    d += `M${x.toFixed(1)} ${y.toFixed(1)}h${size.toFixed(1)}v${size.toFixed(1)}h-${size.toFixed(1)}z`;
  }
  return d;
}
function panel(map, frame, zones, names, s, side, caption) {
  const sites = zones.sites.map((z, k) => {
    const [x0, y0] = frame.to([z.mins[0], z.maxs[1]]);
    const [x1, y1] = frame.to([z.maxs[0], z.mins[1]]);
    return `<rect class="site" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}"/><text class="sitename" x="${((x0 + x1) / 2).toFixed(1)}" y="${(y0 - 3).toFixed(1)}">${names[k]}</text>`;
  }).join('');
  // A dot where a player stood, and a short line the way it looked.
  const dots = s.points.map((p) => {
    const [x, y] = frame.to(p);
    const a = ((p[3] ?? 0) * Math.PI) / 180;
    return `<line class="${side}view" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * 13).toFixed(1)}" y2="${(y - Math.sin(a) * 13).toFixed(1)}"/><circle class="${side}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"/>`;
  }).join('');
  return `<figure><svg viewBox="0 0 ${frame.w.toFixed(0)} ${frame.h.toFixed(0)}" width="${frame.w.toFixed(0)}" height="${frame.h.toFixed(0)}"><use href="#floor-${map}"/>${sites}${dots}</svg><figcaption>${caption}</figcaption></figure>`;
}

const wanted = args.maps ? args.maps.split(',') : [...byMap.keys()].sort((a, b) => byMap.get(b).length - byMap.get(a).length);
const md = ['# The strategies of the recorded matches', '',
  'Made by `node tools/strategies.js --report docs/strategies.md` from every HLTV demo of csbih-player on a map with a',
  'built level. The numbers name no player and no team.', '',
  `A formation is the places of the five players of a side at one second of a round: the Ts at second ${FORM_AT.T}, the CTs at`,
  `second ${FORM_AT.CT}. Formations that lie within ${SAME} units of each other on average, player for player, are one strategy.`,
  'The tool also draws every strategy on the floor of its map: `out/strategies/report.html` (not in the repository).', '',
  'Tempo: the second that the first T stood in the site. Fast to 25 s, mid to 50 s, late after.', ''];
const html = [];
const defs = [];
const skipped = [];
for (const map of wanted) {
  const ids = byMap.get(map) ?? [];
  if (ids.length < Number(args.min)) {
    if (ids.length) skipped.push(`${map}: ${ids.length} demos, too few`);
    continue;
  }
  if (csbihMissing(map)) {
    skipped.push(`${map}: ${ids.length} demos, but csbih-player has no built level of it`);
    continue;
  }
  const level = loadLevel(core, map);
  const zones = zonesOf(core, level);
  // The level of a demo by its protocol: a round that is not played on it is left out (strategies.js fitRounds).
  const levels = new Map();
  if (!zones.sites.length) {
    skipped.push(`${map}: ${ids.length} demos, no bomb site`);
    continue;
  }
  const cache = join(OUT, 'cache', map);
  mkdirSync(cache, { recursive: true });
  const rounds = [];
  let read = 0;
  for (let n = 0; n < ids.length; n++) {
    // The cache names a demo by its place in the sorted list, not by its name.
    const file = join(cache, `${String(n).padStart(4, '0')}.json`);
    let facts = null;
    if (!args.fresh && existsSync(file)) {
      const kept = JSON.parse(readFileSync(file, 'utf8'));
      if (kept.id === ids[n] && kept.version === VERSION) facts = kept.rounds;
    }
    if (!facts) {
      try {
        const timeline = loadTimeline(ids[n]);
        const v16 = (timeline.source?.netProtocol ?? 0) >= 47;
        if (!levels.has(v16)) levels.set(v16, loadLevel(core, map, { v16 }));
        facts = roundFacts(core, timeline, levels.get(v16));
      } catch (e) {
        facts = [];
        console.error(`  ${map}: demo ${n} gave no rounds (${e.message})`);
      }
      writeFileSync(file, JSON.stringify({ id: ids[n], version: VERSION, rounds: facts }));
      read++;
    }
    rounds.push(...facts);
  }
  if (rounds.length < 30) {
    skipped.push(`${map}: ${ids.length} demos, only ${rounds.length} rounds of five against five`);
    continue;
  }
  const found = strategiesOf(zones, rounds);
  const plans = plansOf(found);
  writeFileSync(join(OUT, `${map}.json`), JSON.stringify({ map, demos: ids.length, zones, found, plans }));
  const names = siteNames(map, zones);
  const big = (list) => list.filter((s) => s.rounds >= 5 && s.share >= 0.015);
  console.log(`${map.padEnd(12)} ${String(ids.length).padStart(4)} demos (${read} read), ${String(found.rounds).padStart(5)} rounds, the Ts won ${pct(found.tWon)}; strategies of the Ts ${found.T.length} (${plans.T.length} into the plans, ${pct(big(found.T).reduce((n, s) => n + s.share, 0))} of the rounds), of the CTs ${found.CT.length} (${plans.CT.length}, ${pct(big(found.CT).reduce((n, s) => n + s.share, 0))})`);

  md.push(`## ${map}`, '', `${ids.length} demos, ${found.rounds} rounds of five against five. The Ts won ${pct(found.tWon)}. In ${pct(found.noAttack)} of the rounds the Ts reached no site.`, '');
  md.push('| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |', '|------|------|------|------|------|');
  zones.sites.forEach((_, k) => md.push(`| ${names[k]} | ${pct(found.sites[k].share)} | ${pct(found.sites[k].won)} | ${pct(found.sites[k].planted)} | ${sec(found.sites[k].te)} |`));
  md.push('', `Tempo: ${Object.entries(found.tempo).map(([k, t]) => `${k} ${t.rounds} rounds (Ts won ${pct(t.tWon)})`).join('; ')}.`, '');
  md.push(`Buys, the Ts' against the CTs': ${found.buys.filter((b) => b.rounds >= 5).map((b) => `${b.name} ${b.rounds} rounds (Ts won ${pct(b.tWon)})`).join('; ')}.`, '');
  md.push(`The Ts at second ${FORM_AT.T} (all five alive in ${pct(found.Twhole)} of the rounds): ${found.T.length} formations, ${big(found.T).length} of them played in 1.5% of the rounds or more.`, '',
    '| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |', '|------|------|------|------|------|------|------|');
  for (const s of big(found.T).slice(0, 12)) {
    const went = s.sites.map((v, k) => (v >= 0.1 ? `${names[k]} ${pct(v)}` : null)).filter(Boolean).join(', ') || 'no site';
    md.push(`| ${inWords(s.points, zones, names)} | ${s.rounds} | ${pct(s.share)} | ${pct(s.won)} | ${went} | ${sec(s.te)} | ${pct(s.planted)} |`);
  }
  md.push('', `The CTs at second ${FORM_AT.CT} (all five alive in ${pct(found.CTwhole)} of the rounds): ${found.CT.length} formations, ${big(found.CT).length} of them played in 1.5% of the rounds or more.`, '',
    '| Where the five stand | Rounds | Share | CTs won |', '|------|------|------|------|');
  for (const s of big(found.CT).slice(0, 10)) md.push(`| ${inWords(s.points, zones, names)} | ${s.rounds} | ${pct(s.share)} | ${pct(s.won)} |`);
  md.push('');

  const frame = frameOf(level.nav);
  defs.push(`<path id="floor-${map}" class="floor" d="${floorPath(level.nav, frame)}"/>`);
  html.push(`<section><h2>${map}</h2><p>${ids.length} demos, ${found.rounds} rounds. The Ts won ${pct(found.tWon)}. ${zones.sites.map((_, k) => `${names[k]}: ${pct(found.sites[k].share)} of the rounds, Ts won ${pct(found.sites[k].won)}, first T in the site at ${sec(found.sites[k].te)}`).join('. ')}.</p>`);
  html.push(`<h3>The Ts at second ${FORM_AT.T}</h3><div class="grid">`);
  for (const s of big(found.T).slice(0, 12)) {
    const went = s.sites.map((v, k) => (v >= 0.1 ? `${names[k]} ${pct(v)}` : null)).filter(Boolean).join(', ') || 'no site';
    html.push(panel(map, frame, zones, names, s, 't', `<b>${pct(s.share)}</b> of the rounds (${s.rounds}). Ts won <b>${pct(s.won)}</b>. Went to ${went}. First T in the site at ${sec(s.te)}. Planted ${pct(s.planted)}.`));
  }
  html.push(`</div><h3>The CTs at second ${FORM_AT.CT}</h3><div class="grid">`);
  for (const s of big(found.CT).slice(0, 12)) html.push(panel(map, frame, zones, names, s, 'ct', `<b>${pct(s.share)}</b> of the rounds (${s.rounds}). CTs won <b>${pct(s.won)}</b>.`));
  html.push('</div></section>');
}
if (skipped.length) {
  console.log(`Left out: ${skipped.join('; ')}.`);
  md.push('## Maps left out', '', ...skipped.map((s) => `- ${s}`), '');
}
mkdirSync(OUT, { recursive: true });
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Match strategies</title><style>
:root{--bg:#f6f4ef;--ink:#1d1c1a;--dim:#6b665e;--floor:#d9d4c8;--site:#8a6d1c;--t:#c2410c;--ct:#1d4ed8;--card:#fffdf8;--line:#e3ded2}
@media (prefers-color-scheme:dark){:root{--bg:#15151a;--ink:#ecebe6;--dim:#9a968c;--floor:#34343c;--site:#d9b648;--t:#fb923c;--ct:#60a5fa;--card:#1c1c22;--line:#2b2b33}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:21px;margin:40px 0 4px;border-top:1px solid var(--line);padding-top:24px}h3{font-size:15px;margin:22px 0 10px;color:var(--dim);font-weight:600}
p{margin:6px 0;max-width:80ch}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}figcaption{font-size:13px;color:var(--dim);margin-top:6px}figcaption b{color:var(--ink)}
svg{display:block;max-width:100%;height:auto}.floor{fill:var(--floor)}.site{fill:none;stroke:var(--site);stroke-width:1.5}.sitename{fill:var(--site);font:600 11px system-ui,sans-serif;text-anchor:middle}
.t{fill:var(--t);stroke:var(--card);stroke-width:1.2}.ct{fill:var(--ct);stroke:var(--card);stroke-width:1.2}.tview{stroke:var(--t);stroke-width:1.6}.ctview{stroke:var(--ct);stroke-width:1.6}
</style></head><body><main><h1>The strategies of the recorded matches</h1>
<p>Each picture is one strategy: the places of the five players of a side at one second of a round (the Ts at second ${FORM_AT.T}, the CTs at second ${FORM_AT.CT}), as the teams of the demos stood again and again; the short line shows where each player looked. The grey floor is the map; the boxes are the bomb sites. The numbers name no player and no team.</p>
<svg width="0" height="0" style="position:absolute"><defs>${defs.join('')}</defs></svg>
${html.join('\n')}</main></body></html>`;
writeFileSync(join(OUT, 'report.html'), page);
console.log(`Wrote ${join(OUT, 'report.html')}`);
if (args.report) {
  writeFileSync(args.report, `${md.join('\n')}\n`);
  console.log(`Wrote ${args.report}`);
}
