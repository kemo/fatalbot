# 01 Architecture

Status: decided on 2026-11-10. The brain and the csbih host play whole matches. The goldsrc host is not started.

## 1. Goal

The best bot for Counter-Strike 1.6, in two games:

- the real game: a CS 1.6 server (HLDS or ReHLDS) that anybody runs;
- our own game: the game core of csbih-player, which plays archived matches in the browser (`/igraj`).

"Best" has three parts, in this order:

1. **It plays as a team.** A plan for the round, roles, calls, trades, rotations, a retake together. The known
   bots (the official CS bot, PODBot, YaPB) have no team plan: each bot rolls its own chances.
2. **It plays like the players of the time.** csbih-player holds about 530 HLTV demos of 5 on 5. The places, the
   angles, the grenades and the pace of the bots come from that play.
3. **It moves and aims like a player** (owner, 2026-11-10: "they must really feel like real players, both their
   movement and aim"). The hand flicks, overshoots and corrects. The feet strafe in a fight, stop before the shots,
   jump and bunny hop by habit.
4. **It wins fair.** A bot knows what a player in its place can know, and its hand is a human hand.

## 2. One brain, two hosts

```
            map (once a level)      frame (each tick)
  host  ───────────────────────────────────────────────►  brain
        ◄───────────────────────────────────────────────
            ports (queries inside a tick)   command (each bot, each tick)
```

The brain never touches a host. An adapter makes the map and the frames from the host's state, answers the ports,
and applies the commands (spec 02).

| | csbih | goldsrc |
|---|-------|---------|
| The game | `../csbih-player/src/shared/game/` | HLDS or ReHLDS with Metamod |
| The tick | 10 ms, fixed | the server's frame time |
| A bot is | a controller of a player of the `World` | a fake client (`CreateFakeClient`, `RunPlayerMove`) |
| Traces | `hull.js traceBox` | the engine's `TraceLine` and `TraceHull` |
| The nav graph | built by `tools/build-nav.js` of csbih-player | built by the same rules from the BSP (to do) |
| State | adapter built | open owner decision |

### 2.1 Why the brain is JavaScript

Decision of 2026-11-10. The alternatives, and why each lost:

| Way | For | Against |
|-----|-----|---------|
| **Plain ES modules (chosen)** | Runs in csbih-player as it is: no build, no new file type. The demo tools of csbih-player (Node) can measure it. It can be tested today. | A real server needs a JavaScript engine: inside the plugin, or in a process beside it. |
| C++ core, compiled natively and to WebAssembly | The usual form of a server plugin; fast. | csbih-player would ship a built binary. No WebAssembly compiler and no SDK on the work machine: nothing of it can be built or tested now. The 2,400 lines of working bot code of csbih-player are JavaScript. |
| Two brains, one per host | Each fits its host. | Two brains drift apart. Each change is made and measured two times. |

The cost of the choice lies in the goldsrc host: section 5.

### 2.2 Rules that keep the brain portable

- No import from outside `src/`. No Node API, no DOM API.
- No clock: the time is `frame.time`. No `Math.random`: the brain has its own seeded random.
- All trigonometry goes through `src/geometry.js`.
- The brain keeps its own state. It writes nothing into a frame, and it keeps no reference to one after the tick.

## 3. The layers of the brain

After spec 12 of csbih-player (the official CS bot's states, a commander as in Killzone 2, utility scores).

| Layer | Rate | Decides | Module |
|-------|------|---------|--------|
| Senses | 20 a second | what each bot sees and hears | `senses.js` |
| Team | 1 a second, and on an event | the plan of the round, the roles, what the team knows | `team.js` |
| Tactics | 10 a second | the task of the bot, its place, where it looks | `tactics.js`, `objective.js` |
| Motor | each tick | the walk, the aim, the trigger | `walk.js`, `aim.js`, `fight.js` |

- The senses are the only reader of the raw state of an enemy (AGENTS.md, "Fair play").
- The team layer holds one copy of what its bots saw and heard, as a radio that every call reaches.
- A task holds until it ends or an event ends it. A bot does not change its mind each tick.

## 4. Gates: what a change must show

`tools/arena.js` plays matches of bots in the csbih host and prints these measures. Every gate is measured on the
same maps, side orders and seeds before and after a change.

| Gate | Measure | Target |
|------|---------|--------|
| G1 Strength | Share of the rounds that fatalbot wins against the reference bots, both side orders, the same motor profile | over 50%, and growing |
| G2 Balance | Share of the rounds that the Ts win when fatalbot plays fatalbot | 39% to 54% (the human matches of the measured maps) |
| G3 No wall, no stuck | Share of the time a bot faces a wall within 40 units for 1.5 s out of a fight; share of the time it wants to move and stays within 16 units | not over the reference bots |
| G4 Rounds end as rounds | Share of the rounds with a plant; rounds that end on the clock with nobody dead | near the human matches; none of the second kind |
| G5 Cost | Milliseconds of the brain for one tick of ten bots | under 1 ms in Node |
| G6 Fair | The blindfold test: an enemy that a bot cannot see or hear changes no command | holds always |

| G7 Human feel | Jumps a minute; share of the shots fired on the run (over 140 units a second); share of the kills with a shot to the head; crosshair error at the first sight and at the first shot; time to the first shot; peak turn; the crosshair under the head at each shot of a burst | inside the spread of the players of the demos, p10 to p90 (`tools/players.js`), measured with the hit boxes of the player model |

G1 alone is easy to cheat: a faster hand wins. So both sides take the same motor profile (the `DEFAULT_PROFILE`
numbers of csbih-player), and G6 must hold.

The state of the gates on 2026-11-12 (docs/measures/2026-11-12-night.md, and the records of 2026-11-11): G1 and
G6 are met: fatalbot wins 71.1% of 384 rounds against the reference bots. G2 is met in its middle: the Ts win
50.1% of 2,592 rounds by match (error 1.4). G3: fatalbot is stuck 0.28% of the time (the reference bots 1.00%)
and faces a wall 0.35% (0.29%; on 2026-11-11 it was 0.47% against 0.46%). G4 is not met, and nearer: fatalbot plants in 56% of its rounds and the players
in 44% (`tools/rounds.js` measures the shape of a round for both). G5 is met: 0.055 ms for ten bots a tick on
de_dust2 and 0.141 ms on de_nuke, read alone on the processor; the longest command took 6.7 ms. G7 is met for
the kills with a shot to the head, the buys of a team, the steps of a player that holds a place before the first
contact, and the CTs alive at the blast (14% of the plants; the players 16%). After the first death the bots
stand in 28% (CTs) and 17% (Ts) of the steps of 2 s, the players in 18% and 10%. The jumps are not compared any
more: the arenas count a recorded player's jumps wrong (docs/measures/2026-11-12-night.md, section 8); counted
the same way the players jump 3.5 times a minute and the bots 2.9, with fewer chains of hops, and the players are
ducked 9 to 13% of a round against the bots' 1 to 2%.

To come for G7, with the demo data (section 6): the likeness to the players as `tools/compare-fights.js` and
`tools/aim-stats.js` of csbih-player measure it.

### 4.1 The tests, in the owner's order (2026-11-10)

1. **Against recorded matches, in the player.** `tools/demo-arena.js`: fatalbot takes the place of one side of a
   demo round. The other side plays its recording on the rails of csbih-player until the round leaves the demo, then
   plays on as the reference bot with that player's route and profile. The measure: the rounds that fatalbot wins
   beside the rounds that the players in those places won.
2. **Against the reference bots.** `tools/arena.js`: the gates of the table above.
3. **On the CS 1.6 server.** One team of fatalbot against one team of the server's current bots (YaPB). This needs
   the goldsrc host (section 5).

## 5. The goldsrc host (open)

A CS 1.6 server loads a Metamod plugin: a 32-bit shared library. The plugin makes the fake clients, builds the
frames, answers the ports with the engine's traces, and applies the commands (`hosts/goldsrc/README.md`).

The first target is the server of gamerz.ba (`cs.gamerz.ba:27015`): HLDS or ReHLDS with ReGameDLL, Metamod-r and
AMX Mod X, and YaPB as its bots (`../csbih/deploy/site/README.md`, and the CS 1.6 night spec of `../csbih`). Its
admin runs it; no repository configures it. The test there is one team of fatalbot against one team of YaPB.

It needs, and the owner has to decide:

- the HLSDK and the Metamod headers, fetched from pinned commits and never committed;
- an i386 Linux build container, and a Windows build later;
- a test server with the game files;
- the way the plugin runs the brain: an embedded JavaScript engine (one file to install, slower code) or a Node
  process beside the server (fast code, two things to run).

The nav graph of a level must come from the BSP alone, with the rules of `tools/build-nav.js` of csbih-player, so
that both hosts walk the same graph.

## 6. Data

The brain takes data as plain objects. The tools that mine the demos stay in csbih-player; their output for a map
(not for a named player) can become a data file of fatalbot later.

| Data | From | State |
|------|------|-------|
| Nav graph, bomb sites, buy zones, spawns, ladders | the level (BSP) | given by the csbih adapter |
| Places of a map, hiding spots, approach points | the nav graph | to do, in the brain |
| Lineups of grenades, the view field, the angles where enemies appear | the demos, per map | in csbih-player; not read yet |
| Plans of a team per map and side | the demos, per map | mined by `tools/strategies.js` (docs/strategies.md), after csbih-player spec 12, section 6 |

## 7. Order of work

1. Built: the contract, the csbih adapter, the arena, the baseline of the reference bots.
2. Built: the motor, ported from `bot.js` of csbih-player behind the ports (the walk with its stuck and ladder
   rules, the hand, the fight), the senses, the team's knowledge, and the bomb (plant, defuse, guard, posts, escape).
3. Built: the demo arena (section 4.1, test 1), and the watch of its rounds in the player (`tools/watch.js`).
4. Built: the feet (moves.js): the stop before the shots, the hops. To come: the peek, the jiggle at an angle.
5. Built: the first team layer for the CTs: posts, anchors, a rotation (spec 03, section 6). Built as an option:
   the plans mined from the demos, as formations and their timing (spec 03, section 6.1). To come: the execute
   after the formation, trades, a retake together, saves. Built: the buy of a team (spec 03, section 6.2).
6. Built as an option: the grenades with the lineups of the demos (spec 03, section 7). To come: the throw at the
   plan's second, the view field and the angles where enemies appear.
7. The goldsrc host, when the owner has decided section 5.

## 8. Sources

- **csbih-player** spec 11 and spec 12, and its `src/shared/game/`: the game core and the reference bots.
- **ReGameDLL_CS** `dlls/bot/` (the official CS bot of Condition Zero), **YaPB**, **PODBot MM**: behaviour and
  constants only, no code (AGENTS.md).
- **Killzone 2** (Guerrilla, "A hierarchically-layered multiplayer bot system"): commander, squad, bot.
- **Utility AI** (Mark and Dill, GDC 2010): scores, and a bonus for the current choice.
