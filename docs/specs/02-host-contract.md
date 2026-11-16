# 02 Host contract

Status: built for the csbih host (2026-11-10). The goldsrc column is the plan; check each engine name against the
fetched headers before you write the plugin (spec 01, section 5).

The types are in `src/contract.js`, with `checkMap`, `checkFrame` and `checkCommand` for the tests of an adapter.

## 1. The calls

```js
const brain = createBrain({ map, ports, seed });   // once a level
brain.join(id, { profile, route });                // a bot takes a player; `route` is optional
// each tick:
brain.frame(frame);                                // once, before any think
const command = brain.think(id);                   // once for each bot
// at any time:
brain.leave(id);                                   // the bot gives the player up
brain.debug(id);                                   // for a tool or a log: {goal, point, target, stuckFor, path, escape, route}
```

`route(seconds)` is for a replay: the route of the recorded player that the bot plays on for, on the clock of the
frames, as `{x, y, z, yaw, pitch, duck, weapon, bomb}`, and null where the recording of that player ends. It holds
for the round of the join. The bot keeps the route until its own round leaves the recording (spec 03, section
6.3). The csbih host takes it from the track of the demo round; a real server has none.


- The brain copies what it keeps. A host can give the same arrays in every frame.
- A frame holds every player, also the enemies. Only `src/senses.js` reads them (spec 01, gate G6).
- The same frames and the same seed give the same commands.

## 2. Units

- World units of GoldSrc: x and y on the ground, z up. Seconds. Degrees.
- A player's origin is the centre of the standing box, 36 over the feet (18 when ducked).
- Yaw turns counter-clockwise from the x axis. A positive pitch looks down. A positive `side` goes right.

## 3. The map (once a level)

| Field | Meaning | csbih | goldsrc |
|-------|---------|-------|---------|
| `name` | The map's name | the level's name | `STRING(gpGlobals->mapname)` |
| `nav` | The graph: `count`, `xyz`, `offsets`, `to`, `kinds` (0 walk, 1 drop, 2 jump, 3 ladder) | `nav.bin` of `tools/build-nav.js` | to build from the BSP with the same rules |
| `bombSites` | Boxes | `bomb.js bombSites(rules)` | `func_bomb_target` brushes; `info_bomb_target` points as boxes |
| `buyZones` | Boxes with a team or null | `rules.buyZones` | `func_buyzone` brushes |
| `spawns` | Team, origin, yaw | `rules.spawns` | `info_player_deathmatch` (T), `info_player_start` (CT) |
| `ladders` | Boxes with the normal of the climbed face | `rules.ladders` | `func_ladder` brushes |
| `lineups` (optional) | Throws of grenades that players made on this map: team, kind, start point, velocity, second of the round | `out/profiles/throws-<map>.json` of csbih-player | the same file: its points are world coordinates of the map |
| `plans` (optional) | Strategies that teams played on this map, for each side: the places of the five (the Ts at second 20, the CTs at second 15), each with the view of its player, the share of the rounds and of the wins; for the Ts also the site and the second of the first T in it | `out/strategies/<map>.json` of `tools/strategies.js` | the same file |

The optional fields hold what recorded matches teach about a map. They name no player. Without them the brain
plays by the level alone: no lineup is thrown, the Ts take a site at once, and each CT takes a post of the level.
A place of a plan can lie where the graph has no way to (a box that players jump onto). The brain moves such a
place to the nearest floor that its side can walk to, or leaves it out (`plan.js floorsOf`).

## 4. The ports (inside a tick)

Players are never in a trace: the level and its solid brush models only.

| Port | Returns | csbih | goldsrc |
|------|---------|-------|---------|
| `traceLine(from, to, out?)` | The free part of the line, 0 to 1; `out` takes `fraction`, `startSolid`, `end` and the `normal` of the surface that it hit (the flight of a grenade needs it) | `traceBox` with `HULL_POINT` | `TRACE_LINE` with `ignore_monsters`; `vecPlaneNormal` of the result |
| `traceHull(from, to, ducked, out?)` | The same for a player's box; `out` takes `fraction`, `startSolid`, `end` | `traceBox` with `HULL_STAND` or `HULL_DUCK`, the other players taken out | `TRACE_HULL` with `human_hull` or `head_hull` and `ignore_monsters` |

## 5. The frame (each tick)

| Field | Meaning | csbih | goldsrc |
|-------|---------|-------|---------|
| `time`, `dt` | The clock of the match and the step | `world.time`, `world.tickSeconds` | `gpGlobals->time`, `gpGlobals->frametime` |
| `round.number` | Counts the rounds; a change starts a new round in the brain | `match.number` | the `HLTV` or `RoundTime` message at a round start, counted |
| `round.phase` | `freeze`, `live` or `over` | `world.freezeUntil`, `match.result` | `mp_freezetime` from the round start; the `SendAudio` round end calls |
| `round.timeLeft` | Seconds on the round clock | `match.clock()` | the `RoundTime` message and the time since it |
| `round.c4Timer` | Seconds from the plant to the blast | `world.c4Timer` | `mp_c4timer` |
| `round.knives` | A knife round | `world.knifeRound` | false |
| `round.score` | The rounds that each side won: `{T, CT}`, or null when the host has none | `match.score` | the `TeamScore` message (the scoreboard) |
| `players[]` | Every player of a side | `world.players` | the edicts 1 to `maxClients` |
| `.id`, `.team`, `.alive` | | the player | the edict index; the `TeamInfo` message; `pev->deadflag` |
| `.origin`, `.velocity` | | `body.origin`, `body.velocity` | `pev->origin`, `pev->velocity` |
| `.yaw`, `.pitch` | The view | `yaw`, `pitch` | `pev->v_angle` |
| `.eye` | The eye over the origin | `body.eye` | `pev->view_ofs.z` |
| `.ducked`, `.onGround`, `.onLadder` | | `body` | `pev->flags` (`FL_DUCKING`, `FL_ONGROUND`), `pev->movetype == MOVETYPE_FLY` |
| `.health` | | `health` | `pev->health` |
| `.weapon`, `.silenced` | The weapon in the hand | `weapon`, its gun | the `CurWeapon` message; the weapon's state |
| `.own` | Null for a player that the brain does not drive | | |
| `.own.money`, `.armor`, `.helmet`, `.kit` | | the player | the `Money`, `Battery`, `ArmorType` and `StatusIcon` messages to the fake client |
| `.own.weapons` | Clip and reserve of each weapon carried | `guns` | `pev->weapons` with the `CurWeapon` and `AmmoX` messages |
| `.own.punch`, `.zoom` | Recoil on the view; the scope level | `punch`, `zoom` | `pev->punchangle`; `pev->fov` |
| `.own.blindUntil` | The end of a flashbang's white-out | `blind.blindUntil` | the `ScreenFade` message |
| `.own.stamina` | Over 0 while a jump still slows the next | `body.stamina` | `pev->fuser2` |
| `.own.reloading` | | the gun's `reloadEnd` | the weapon's reload state |
| `.own.hurt` | The last hit taken: `{at, by}` | `lastHurt` | the `Damage` message and `pev->dmg_inflictor` |
| `.own.canBuy` | In a buy zone, in the buy time | `economy.js cannotBuy` | the `StatusIcon` "buyzone" and the buy time |
| `bomb.state` | `carried`, `dropped`, `planted`, `defused`, `exploded` | `world.bomb` | the `weapon_c4` and `grenade` (C4) entities; the bomb messages |
| `bomb.carrier`, `.origin`, `.explodeAt` | | `world.bomb` | the owner of `weapon_c4`; the entity's origin; the plant time and `mp_c4timer` |
| `bomb.defuser`, `.arming` | The player who defuses or arms it now | `bomb.busy` | the `BarTime` message of a player at the bomb |
| `smokes[]` | The clouds that stand: origin and radius | the burst smoke grenades, radius 115 | the smoke grenade entities after their burst |
| `events[]` | Since the frame before: `shot`, `hurt`, `kill`, `reload`, `planted`, `dropped`, `picked`, `defusing`, `defused`, `exploded` | `world.events` | the hook of `PlaybackEvent` (shots); the `DeathMsg` and bomb messages; the game log lines |
| `hurt.weapon` | The weapon of a hit (`hegrenade` for a grenade's blast) | the event's `weapon` | the damage bits of the `Damage` message to the fake client (`DMG_BLAST`) |

What stays in the csbih adapter, because a real server has no such thing: the routes of a demo, the rails, the
story of a demo round, the bot log, and the throw of a grenade with a recorded velocity.

## 6. The command (each bot, each tick)

| Field | Meaning | csbih | goldsrc |
|-------|---------|-------|---------|
| `yaw`, `pitch` | The view after this tick | `cmd.yaw`, `cmd.pitch` | the `viewangles` of `RunPlayerMove`, and `pev->v_angle` |
| `forward`, `side` | -1 to 1 of the key speed | the same | `forwardmove`, `sidemove` times the player's speed |
| `jump`, `duck`, `walk`, `attack`, `attack2`, `use`, `reload` | Keys | the same | `IN_JUMP`, `IN_DUCK`, `IN_RUN`, `IN_ATTACK`, `IN_ATTACK2`, `IN_USE`, `IN_RELOAD` |
| `weapon` | The weapon to take into the hand | `cmd.weapon` | the client command `weapon_<name>` |
| `drop` | Drops the weapon in the hand | `cmd.drop` | the client command `drop` |
| `buy` | Items of the buy menu by name, in order; `primammo` and `secammo` fill the ammo | `economy.js buy` and `buyAmmo` | the client commands of the buy aliases |

## 7. To come

- `frame.breakables`: the vents and windows that a bot shoots open on its way (the reference bots do this).
- `frame.grenades`: the grenades in flight, to turn away from a flashbang and to leave an HE grenade.
- `frame.items`: the guns on the floor, to pick up a better gun.
- A throw of a grenade by the view and the key alone, so that a lineup works in both hosts.
