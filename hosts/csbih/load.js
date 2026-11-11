// The Node loader of the csbih host: finds a checkout of csbih-player, imports its game core and reads its built
// levels. Node only; the adapter (adapter.js) has no Node API and runs in the browser too. Nothing is copied.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { restLevel } from './adapter.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The checkout of csbih-player: CSBIH_PLAYER, else the sibling directory. */
export function csbihRoot() {
  return resolve(process.env.CSBIH_PLAYER ?? join(HERE, '..', '..', '..', 'csbih-player'));
}

/** Why the csbih host cannot run here, or null: the tests skip with this text. */
export function csbihMissing(map = null) {
  const root = csbihRoot();
  if (!existsSync(join(root, 'src', 'shared', 'game', 'world.js'))) return `no csbih-player at ${root}`;
  if (map && !levelDir(root, map)) return `no built level ${map} in ${root}/assets`;
  return null;
}

// csbih-player keeps the 1.6 build of a level beside the 1.5 one where the two differ. The 1.6 one first, unless
// the caller plays a demo of 1.5 (`v16: false`).
function levelDir(root, map, v16 = true) {
  const dirs = v16 ? ['assets/levels16', 'assets/levels'] : ['assets/levels'];
  return dirs.map((d) => join(root, d)).find((d) => ['hull.bin', 'nav.bin', 'play.json'].every((f) => existsSync(join(d, `${map}.${f}`)))) ?? null;
}

const CORE = { world: 'world', match: 'match', hull: 'hull', nav: 'nav', bot: 'bot', economy: 'economy', bomb: 'bomb', round: 'round', demoRound: 'demo-round', demoMatch: 'demo-match', rails: 'rails' };

/** The modules of the game core: {world, match, hull, nav, bot, economy, bomb, round, demoRound, demoMatch, rails}. */
export async function loadCore() {
  const dir = join(csbihRoot(), 'src', 'shared', 'game');
  const core = {};
  for (const [key, name] of Object.entries(CORE)) core[key] = await import(pathToFileURL(join(dir, `${name}.js`)).href);
  return core;
}

const buffer = (file) => {
  const b = readFileSync(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};

/** A built level: {map, hulls, nav, rules}, ready for `new World(hulls, {nav, rules})`. `v16: false` takes the 1.5 build. */
export function loadLevel(core, map, { v16 = true } = {}) {
  const dir = levelDir(csbihRoot(), map, v16);
  if (!dir) throw new Error(`No built level ${map} in ${csbihRoot()}/assets.`);
  const rules = JSON.parse(readFileSync(join(dir, `${map}.play.json`), 'utf8'));
  rules.map ??= map;
  // restLevel keeps the places of the doors as the file has them.
  return restLevel({ map, hulls: core.hull.readHulls(buffer(join(dir, `${map}.hull.bin`))), nav: core.nav.readNav(buffer(join(dir, `${map}.nav.bin`))), rules });
}

/**
 * The data that csbih-player mined for a map from all its demos (no named player): {views, lineups}, each null or
 * empty when not built. The reference bots read them.
 */
export function loadMapData(map) {
  const read = (name, none) => {
    try {
      return JSON.parse(readFileSync(join(csbihRoot(), 'out', 'profiles', `${name}-${map}.json`), 'utf8'));
    } catch {
      return none;
    }
  };
  return { views: read('view', null), lineups: read('throws', []) };
}

/** The ids of the demo timelines that csbih-player built (out/<id>.json.br), sorted. */
export function timelineIds() {
  const dir = join(csbihRoot(), 'out');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => f.match(/^(.+)\.json\.br$/)?.[1]).filter(Boolean).sort();
}

/** The timeline of a demo. It holds the play of real people: read it, never copy it into this repository. */
export function loadTimeline(id) {
  return JSON.parse(brotliDecompressSync(readFileSync(join(csbihRoot(), 'out', `${id}.json.br`))).toString('utf8'));
}

/** The profiles of the players of a demo, by entity: {profile, spots}; {} when not built. */
export function loadProfiles(id) {
  try {
    return JSON.parse(readFileSync(join(csbihRoot(), 'out', 'profiles', `${id}.json`), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * What the recorder needs to name the sequences of a body (record.js): the player's animation helpers and one
 * parsed player model. Every player model of the game has the same sequences.
 */
export async function loadAnim() {
  const root = csbihRoot();
  const anim = await import(pathToFileURL(join(root, 'web', 'player-anim.js')).href);
  const { readMdl } = await import(pathToFileURL(join(root, 'web', 'mdl.js')).href);
  const file = ['assets/models/player/leet/leet.mdl', 'assets/models16/player/leet/leet.mdl'].map((f) => join(root, f)).find((f) => existsSync(f));
  if (!file) throw new Error(`No player model in ${root}/assets: run tools/fetch-assets.sh of csbih-player.`);
  return { anim, mdl: readMdl(buffer(file)) };
}

/**
 * The body of a player for a bullet, with the hit boxes of the player model of csbih-player (hitboxes.js): the
 * head, the chest, the stomach, the arms and the legs, in the aim pose of a rifle, standing and ducked. The real
 * game poses the boxes by the animation of the moment. Gives `bodyOf(player)` for `world.bodyOf`.
 */
export async function loadBody() {
  const root = csbihRoot();
  const { mdl } = await loadAnim();
  const { poseBlend, sequenceIndex } = await import(pathToFileURL(join(root, 'web', 'mdl.js')).href);
  const { boneMatrices, readHitboxes } = await import(pathToFileURL(join(root, 'src', 'shared', 'game', 'hitboxes.js')).href);
  const boxes = readHitboxes(mdl.buffer);
  const parents = mdl.bones.map((b) => b.parent);
  const pose = (name) => boneMatrices(parents, poseBlend(mdl, Math.max(0, sequenceIndex(mdl, name)), 0));
  const stand = pose('ref_aim_rifle');
  const duck = pose('crouch_aim_rifle');
  // The model's own origin is the middle of the player's box, standing and ducked.
  return (p) => ({ x: p.body.origin[0], y: p.body.origin[1], z: p.body.origin[2], yaw: p.yaw, matrices: p.body.ducked ? duck : stand, boxes });
}

/**
 * The aim measure of csbih-player (tools/aim-stats.js): `engagements(level, tracks, shots, kills)` gives, for each
 * kill, the crosshair error at the killer's first sight of the victim, the time to the first shot and the turn of
 * the view between them. The arenas use it so that a bot and a player are measured the same way.
 */
export async function loadAimStats() {
  // The tool moves the process into its own folder when it loads: back out again.
  const cwd = process.cwd();
  const stats = await import(pathToFileURL(join(csbihRoot(), 'tools', 'aim-stats.js')).href);
  process.chdir(cwd);
  return stats;
}

/**
 * The plans of a map that tools/strategies.js of this repository mined from the demos (out/strategies/<map>.json):
 * {T, CT}, or null when the analysis has not run for the map.
 */
export function loadPlans(map) {
  try {
    return JSON.parse(readFileSync(join(HERE, '..', '..', 'out', 'strategies', `${map}.json`), 'utf8')).plans ?? null;
  } catch {
    return null;
  }
}
