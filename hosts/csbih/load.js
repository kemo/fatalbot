// The Node loader of the csbih host: finds a checkout of csbih-player, imports its game core and reads its built
// levels. Node only; the adapter (adapter.js) has no Node API and runs in the browser too. Nothing is copied.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// The 1.6 build of a level first, then the 1.5 one (csbih-player keeps both).
const LEVEL_DIRS = ['assets/levels16', 'assets/levels'];

function levelDir(root, map) {
  return LEVEL_DIRS.map((d) => join(root, d)).find((d) => ['hull.bin', 'nav.bin', 'play.json'].every((f) => existsSync(join(d, `${map}.${f}`)))) ?? null;
}

const CORE = ['world', 'match', 'hull', 'nav', 'bot', 'economy', 'bomb', 'grenade', 'weapons', 'items', 'combat', 'round'];

/** The modules of the game core, by file name: {world, match, hull, nav, bot, economy, bomb, grenade, ...}. */
export async function loadCore() {
  const dir = join(csbihRoot(), 'src', 'shared', 'game');
  const core = {};
  for (const name of CORE) core[name] = await import(pathToFileURL(join(dir, `${name}.js`)).href);
  // The classes of the weapons (pistol, rifle, ...) live one directory up.
  core.catalog = await import(pathToFileURL(join(csbihRoot(), 'src', 'shared', 'weapons.js')).href);
  return core;
}

const buffer = (file) => {
  const b = readFileSync(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};

/** A built level: {map, hulls, nav, rules}, ready for `new World(hulls, {nav, rules})`. */
export function loadLevel(core, map) {
  const dir = levelDir(csbihRoot(), map);
  if (!dir) throw new Error(`No built level ${map} in ${csbihRoot()}/assets.`);
  const rules = JSON.parse(readFileSync(join(dir, `${map}.play.json`), 'utf8'));
  rules.map ??= map;
  return { map, hulls: core.hull.readHulls(buffer(join(dir, `${map}.hull.bin`))), nav: core.nav.readNav(buffer(join(dir, `${map}.nav.bin`))), rules };
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
