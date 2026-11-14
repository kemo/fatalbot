# Roadmap: bots that play and look like a team of players

Date: 2026-11-13. State: a proposal for the owner. An item that was built since has the mark **Done** with its
date; the rest is not built. Section 1a gives what changed on 2026-11-13 and 2026-11-14 after the reviews.

The owner's aim (2026-11-13): the bots must play as real teams played CS 1.6 in 5 on 5 matches. They trade
kills. They do not stand in the open in the middle of the map. They hear a call ("one died at A") and they
rotate. They duck and tap the duck key on the run as players did. A player cannot walk through another player.

This document gives the work in order. It covers two repositories:

- **fatalbot** (this repository): the brain.
- **csbih-player** (`../csbih-player`): the game core (`src/shared/game/`), the demo match and the page `/igraj`.

## 1. How this was made

Five reviews read the code and the documents of both repositories on 2026-11-13:

1. the game core against CS 1.6 (movement, players as solid bodies, combat, grenades, rules, sound);
2. the demo match (the rails), the handover to a bot, and the page `/igraj`;
3. the brain of fatalbot, module by module;
4. all records in `docs/measures/` and the specs;
5. the demo data and the mining tools of csbih-player.

Each fact below has one of these marks:

- **(run)**: a simulation showed it on 2026-11-13.
- **(read)**: the code says it, at the file and line that is given.
- **(docs)**: a record in `docs/measures/` gives the number. "x against y" is the bots against the recorded players.

**Limit.** The work machine of 2026-11-13 has no `out/`, no `demos/` and no `assets/levels/` in csbih-player.
No arena and no mining tool ran for this document. Section 6.1 tells how to get the data.

## 1a. What changed after the reviews (2026-11-13 and 2026-11-14)

The reviews read fatalbot at `8212a30` and csbih-player at `1bd4500`. Since then:

- **The tap of the duck is built** (fatalbot `7581a76`, csbih-player PR #21): `duckTap` in `moves.js`, at the
  `duckTaps` a minute of the profile. The record is `docs/measures/2026-11-13-feet.md`. Items E3 (item 1), C3 (the
  taps) and C4 (the jump count) below have their new state.
- **A profile has the real jumps.** The old `jumpRate` counted each fast rise as a jump: a tap of the duck, a stand
  out of a duck, and the freeze time too. The middle player has 2.9 jumps a minute, not 9. A profile also has
  `hopChain`, `duckTaps` and `strafeBeat` now, from `profile.js feetOf`.
- **G1 over 32 seeds, and a smaller run of G2**, are in section 2.1.
- **A shared match** is in csbih-player main (its spec 13): a room server runs the game core and fatalbot, and the
  page of each member predicts its own player with the same movement code against the other players as they were
  40 ms before. So the room is a third place where the brain runs, and stage A changes code that the page predicts
  with. A1 to A3 need a test in a room: a solid player that the page sees late gives a correction of the place.
- **The death and the bursts of H1** are in csbih-player main (PRs #18 and #20). The same merge made the person
  solid to a recorded teammate (`hull.js`, `selfHuman`): see A3.

## 2. The state today

### 2.1 What is good (docs)

- G1: fatalbot wins 71.2% of 3,072 rounds against the reference bots, with the same motor profile (seeds 1 to
  32, feet record, section 7). The 74.9% of the fight record is the seeds 1 to 8 of that run. With the tap of the
  duck and the players' jumps it is 69.6%, a difference of 1.6 points with an error of 1.6.
- G2: the Ts win 50.1% of 2,592 rounds of fatalbot against fatalbot (36 seeds, night of 2026-11-12, at `4cea0ab`
  before the fight changes). A run of 4 seeds at `8212a30` gave 38.0% of 384 rounds, and 42.2% with the tap of
  the duck and the players' jumps (feet record, section 7). Four seeds do not replace 36: G2 after the fight
  changes needs a run of the first size.
- The share of kills with a shot to the head, the time to the first shot, the turn and the crosshair errors lie
  inside the spread of the players.
- The first T stands in a site at second 34 (the players: 34). A round takes 57 s (59).
- The fight: the aim at the part of the body in sight, the step between bursts, the duck of a ducked fight.

### 2.2 What breaks the picture, most visible first

| No | Fault | Mark | Where |
|----|-------|------|-------|
| 1 | Two players that move toward each other pass through each other. | run | csbih-player `hull.js:270`, `world.js:91-94` |
| 2 | In a demo match every recorded teammate is a ghost, and a recorded player goes through walls and bodies. | read | csbih-player `hull.js:223`, `world.js:102` |
| 3 | No trade. A bot with a post only watches when a teammate dies; half of the others ignore the call. | read | `tactics.js:594-606` |
| 4 | The CTs rotate late and never go back. A teammate's death at a site is not an input. | read | `plan.js:16-23`, `plan.js:190-212` |
| 5 | The CTs stand too near the enemy and do not move: under 500 units from an enemy 57% against 19%. | docs | night of 2026-11-12, section 1 |
| 6 | The view on a way looks 480 units along the path, level. No corner is checked. | read | `walk.js:162-164` |
| 7 | No peek. A bot runs round a corner on the shortest path. | read | spec 03, section 4 |
| 8 | Ten bots are one player: one profile, no role, no AWP, no radio, no drop of a gun. | read | `hosts/csbih/kind.js:22`, `buy.js` |
| 9 | No grenade in a default match, and none at all on the page. | read | csbih-player `fatal.js:25-28` |
| 10 | Time ducked: 1.0% and 1.7% against 9.3% and 12.7%. The duck tap on the run: **Done** 2026-11-13 (1.35 a minute; the middle player 1.3). | docs | night of 2026-11-12, section 8; feet record |
| 11 | A blind bot walks on, and it is deaf too. An enemy flashbang is not in the frame. | read | `senses.js:188` |
| 12 | A recorded enemy near the human does not see the human, and its shots do no damage. | read | csbih-player `rails.js:333-349`, `rails.js:466-471` |

## 3. The order

The rule of the order: first the faults that a test proves with no measure, then the measures, then the team,
then the body. Stage E can run beside stage D: the two touch different modules.

| No | Item | Repository | Size |
|----|------|------------|------|
| A1 | Moving players do not pass through each other | csbih-player | small |
| A2 | The places that do not see players: stand up, spawn, handover | csbih-player | small |
| A3 | A recorded player is solid | csbih-player | middle |
| A4 | The brain walks round bodies | fatalbot | middle |
| B1 | A recorded enemy sees and hurts the human | csbih-player | middle |
| B2 | The handover: memory, pop, the killer that fires at nobody | both | middle |
| B3 | The small faults of the page | csbih-player | small |
| C1 | The data on the work machine | owner | small |
| C2 | The measures of a team | fatalbot tools | middle |
| C3 | The measures of a body | fatalbot tools | middle |
| C4 | Two new gates, and a log of fatalbot on the page | both | small |
| D1 | Pairs and trades | fatalbot | middle |
| D2 | Calls: what a team knows, and when | fatalbot | middle |
| D3 | The rotation on calls | fatalbot | middle |
| D4 | Posts: where a CT stands and how it holds | both | large |
| D5 | Roles, and five different players | both | large |
| D6 | The Ts' round: default, execute, after the plant | fatalbot | large |
| D7 | The retake together, and the save | fatalbot | middle |
| D8 | The economy of a team: drops, the AWP, grenades | both | middle |
| D9 | The radio: bots speak, and bots obey the human | both | middle |
| E1 | The view on a way | fatalbot | middle |
| E2 | The peek | fatalbot | large |
| E3 | The duck: the tap on the run, the duck at a post | fatalbot | middle |
| E4 | Sound: the ears and the quiet feet | both | middle |
| E5 | The hands: reload, knife, scope, freeze time | fatalbot | small |
| E6 | Flashbang, smoke, and a blind bot | both | middle |
| E7 | Grenades with a purpose | both | large |
| E8 | The aim: what is left | fatalbot | middle |
| E9 | The spread of skill, and a difficulty | both | small |
| F | The game core: what is left | csbih-player | each small |
| G | The goldsrc host | owner decision | large |
| H | The same as 1.6: what a player sees and hears | csbih-player | each small or middle |

Each item below has four parts: **Today**, **Do**, **Measure**, **Risk**.

## 4. Stage A: a solid world

### A1. Moving players do not pass through each other

**Today (run).** On a flat level, two players that run or walk toward each other cross and go on. The result is
the same for enemies and for teammates. A runner behind a slower walker does not pass. A runner into a player
that stands stops at 32 units, and this is the only case with a test (`test/game-world.test.js:54`).

**Cause (read).** `sweepBox` returns no hit when the box starts inside the other box (`hull.js:270`,
`enter < 0`), so that "two players never lock". The players of a tick move one after another
(`world.js:91-108`). Two players that move toward each other end one tick with their boxes about 2 units
inside each other. From that tick on, no trace sees the other box.

**Do.**

1. A box that starts inside another box can move only if the move makes the distance between the centres larger.
2. Each mover gives its position of now, not of the start of the tick.
3. Tests: head on at a run, at a walk and ducked; a runner into the side of a runner; two players in a door.

**Measure.** The tests. Then G3 of both bots with solid bodies: the stuck share will grow, and A4 must bring it
back.

**Risk.** Bots that could cross now block each other in doors, on ladders and at the spawn. Do A4 in the same
change of the copy in csbih-player.

### A2. The places that do not see players

**Today.**

- A ducked player under a player on its head can stand up: both end in one place (run; `fits`, `hull.js:278`).
- `freePlace` sees walls only. A spawn and a handover use it (read; `demo-match.js:118`, `rails.js:523`).
- More players than spawns share one spawn (read; `match.js:72`).

**Do.** `fits` and `freePlace` take the boxes of the players. A spawn that is taken gives the nearest free floor.

**Measure.** Tests.

### A3. A recorded player is solid

**Today (read).**

- A recorded player is placed at its coordinates each tick. Nothing stops it: no wall, no door, no player
  (`world.js:102-105`).
- Its box is a ghost for its own team: `ghostTo` (`world.js:93`, `hull.js:223-224`). In a demo match every bot
  starts on the rails (`web/play.js:1153`), so the human walked through all its teammates. Since csbih-player PR
  #20 (2026-11-13) the person is solid to a recorded teammate and walks out of one that ran into it (`hull.js`,
  `selfHuman`); a recorded player is still a ghost for the bots of its team.
- An enemy that stands in the path of a recorded player takes it off the rails ("blocked", `rails.js:493-497`).
  A teammate does not.

**Do.** A recorded player gets a state between "on the recording" and "a bot plays on":

| State | When | What the player does |
|-------|------|----------------------|
| 1. On the recording | nothing is in its way | It is placed at the demo's coordinates, as today. |
| 2. A detour | a body stands in its path that the demo did not have there | Its body is real: the game's movement moves it, it is solid, it walks round the body, and it runs to catch its place on the recording. The view, the gun in the hand and the shots stay the demo's. Within a few units of its recording it is in state 1 again. |
| 3. A bot plays on | the story changed: it was hit, it saw a player where the demo has none, its victim is dead, or it cannot catch its recording (it stands for 1 s, or it is 300 units off) | The brain takes over, as today. |

- All players are solid, and a demo match does not break because the person stood in a spawn rush. Real
  teammates do the same: they walk round and go on.
- State 2 is not new code: `src/route.js` walks the path of a recorded player at its pace and with its view, and
  it goes back to the path when it is off. Today it runs after the takeover only.
- A kill of the demo counts in state 2 only while the player is within about 48 units of its recorded place.
  Further off, the player goes to state 3.
- Two recorded players stay as the demo had them (a boost, a knife fight).

**Measure.** The count of players that leave the rails in a round, by cause, before and after
(`tools/replay-play.js`, `tools/check-play.js` of csbih-player). The seconds that a player is in state 2.

**Risk.** A shot of the demo in state 2 starts from a place that is a little off the demo's.

### A4. The brain walks round bodies

**Today (read).**

- "Players are never in a trace" (`contract.js:25`).
- A bot looks for a blocker among its teammates only, after 0.25 s of no move, and steps to a side by the order
  of the ids. An enemy's box makes it jump (`walk.js:397-409`).
- Only a T at a stage place and a CT at a post make way (`brain.js:299`). To let every bot that stands make way
  lost 12 of 240 rounds (docs: plans and feel, section 8).
- No queue at a ladder or a door.

**Do.**

1. Before the bodies touch: a body within 96 units on the next part of the path moves the walk line to the free
   side.
2. One player at a time through a door and on a ladder. The others wait out of the way, not in the door.
3. No post, no stage place and no wait on a floor that is the only way of a teammate's path.
4. The same rules for the human's body. A bot does not stand in a door that the human runs at.

**Measure.** G3 with solid bodies, not over the value of today (0.28% stuck). A new count of the arena: the
seconds that two boxes overlap, which must be 0.

## 5. Stage B: an honest demo match

### B1. A recorded enemy sees and hurts the human

**Today (read).**

- The shots of a recorded player are a sound and a tracer. They hit nobody (`rails.js:333-349`). A kill of the
  demo happens at its second, with any wall or player between.
- A human within 150 units of the demo place of its player, with no shot for 0.5 s, does not count as a change.
  Recorded enemies do not see and do not hear it (`rails.js:466-471`).
- A recorded player takes no damage from the demo's grenades. The human does (`grenade.js:291`, `grenade.js:330`).

**Do.** A recorded enemy that has a clear line to the human, with the human not where the demo had its player,
leaves its recording as "saw" after its reaction time. Decide with the owner whether the 150 units stay.

**Measure.** In the play records of the page: the seconds that the human stands in the sight of a recorded enemy
with no reaction.

### B2. The handover

**Today (read).**

- A bot that takes over has an empty memory. The events of the steps before it joined are lost
  (`hosts/csbih/adapter.js:218-221`). It must see the enemy again and wait its reaction time.
- The position can jump by 32 units to a side and 18 up (`rails.js:524`).
- A recorded enemy that the human kills with one shot keeps its place in the story: its demo killer stays on the
  rails and fires at nobody (`rails.js:180-182`).
- A whole team leaves the rails in one tick on "mate-died" (`rails.js:310-320`).
- A fatalbot stand-in on a route leaves it only by its own contact (`src/route.js:1-5`). After a death that the
  demo did not have, it replays the walk and the view of the demo.

**Do.**

1. The adapter keeps the events of the last 6 s, and gives them to a brain that joins.
2. The new brain starts with the enemies that the recorded player had in its sight at that tick.
3. The killer of a victim that is dead leaves the rails at the death.
4. The players of a team leave at their own reaction times, not in one tick.
5. A route ends on a call that concerns the bot (D2): a teammate died near it, or the bomb is seen.

**Measure.** The time from a handover to the first shot at an enemy in sight, against the player's reaction time.

### B3. The small faults of the page

- A player that the demo loses stands, and after 3 s it is dead with no kill notice (`rails.js:192-196`).
- The scoreboard shows "BOT" as the latency of every other player (`web/play.js:1416`). Owner decision.
- The bot log has no rows of fatalbot (only `bot.js` writes it). See C4.
- `docs/specs/11-play.md` lines 83, 110 and 190 are stale.

## 6. Stage C: the measures first

AGENTS.md: "A change that does not move a gate of spec 01 toward its target goes back." No gate measures a
trade, a rotation, the view on a way or the duck on the run. So each of them needs a measure before its change.

### 6.1 C1. The data on the work machine

State on 2026-11-13: the levels are on the work machine (`tools/fetch-assets.sh`, then `build-levels.js`,
`build-hulls.js`, `build-nav.js`, `build-materials.js`), and `tools/arena.js` runs there. The timelines and the
profiles are not.

The arenas need three things of csbih-player:

| Thing | Files | Where it comes from |
|-------|-------|---------------------|
| The levels | `assets/levels/<map>.hull.bin`, `.nav.bin`, `.play.json` | built from the BSPs: `tools/fetch-assets.sh`, then `build-hulls.js`, `build-nav.js` |
| The timelines | `out/<id>.json.br` | built from the archived demos: `tools/import-demos.js <folder>` |
| The profiles | `out/profiles/` | `tools/build-profiles.js` |

The fast way: the built data is on the server of player.gamerz.ba, in `/var/gamerz-player/out` and
`/var/gamerz-player/assets` (csbih-player README, "Deploy"). One copy of those two folders gives all three. No
demo file is necessary for it.

`tools/arena.js` against the reference bots needs the levels only. The demo arena and all mining need the
timelines.

### C2. The measures of a team

New rows of `tools/rounds.js`, for the recorded players and for the bots:

| Row | From |
|-----|------|
| Share of the deaths that are traded in 5 s, and the delay | kills. csbih-player `src/shared/roster.js:279` marks them already |
| Distance to the nearest teammate at the first contact | kills and samples |
| Seconds from the first death at a site to the first CT of the other site within 800 units | kills and samples |
| CTs within 800 units of the attacked site 5, 10 and 15 s after the first contact there | samples |
| CTs that go back after a fake | samples |
| Share of 10 s windows with a travel of 200 units and more | a session count of 2026-11-12, not a tool yet |
| Share of the time under 500 units from an enemy | the same |
| Survivors of a lost round, and where they went | kills and samples |
| Radio and chat lines a round, by code | `radio` and `chat` of a timeline |
| Ts at the other site before the plant | measured by hand on 2026-11-11 (0% against 13%) |

### C3. The measures of a body

| Row | From | Limit |
|-----|------|-------|
| The view against the heading on a run | samples | none |
| The angle from the view to the nearest point where enemies appear | `view-<map>.json` of `build-profiles.js` | none |
| Speed bands in the 5 s before the first sight | samples | none |
| Time ducked on the move | the duck flag and the speed | the flag is the full duck only |
| Duck taps a minute. **Done** 2026-11-13: `arena.js gauge` and csbih-player `profile.js feetOf` | a lift of 10 to 27 units from a stand that lands on its level within 0.5 s, with the floors of the level | held by a test at 17 samples a second; in demos under 12 a second the same players have 25% more taps, cause not found |
| Seconds from a kill to the reload | reload animations | the clip is an estimate |
| Knife or pistol in the hand on a run | loadouts | none |
| The turn of the view before a flashbang bursts | grenades and samples | none |
| The speed and the width of a peek at the first sight | samples | 20 samples a second and more |
| Shots with no enemy in sight | csbih-player `tools/cheat/deep.js:357` | no impact points |

A demo has no key presses. A counter-strafe tap and a turn under 0.1 s cannot be read.

### C4. Two new gates, and a log

- **G8 Team**: the rows of C2, inside the spread of the players.
- **G9 Body**: the rows of C3, inside the spread of the players.
- The jump count of the arena did not compare with the recorded players (night of 2026-11-12, section 8).
  **Done** 2026-11-13: the gauge sorts each time in the air by its lift, for the bots and for a recording. The
  old count took a tap of the duck and a stand out of a duck for a jump, and missed a jump that starts between two
  frames. The players jump 3.3 times a minute, not 5.6.
- fatalbot writes its goals and its tasks into the bot log of the page (`brain.debug`, `brain.js:172-177`). Then
  a play record of the page shows why a bot stood.
- A result under 7 points of 192 rounds says nothing (plans and feel, section 9). Use paired rounds or more seeds.
  One set of 384 rounds moved from 68.5% to 77.6% with the seeds alone (feet record, section 7): a difference of G1
  under 5 points needs 16 seeds or more for each side.

## 7. Stage D: the team brain

### D1. Pairs and trades

**Today (read).**

- A kill gives the victim's team the exact place of the killer, at once, at any distance (`senses.js:78-80`).
- Then: a CT with a post watches from its post. Of the others, half ignore a call, a third wait, and the rest
  hunt (`tactics.js:594-606`).
- `Team.deathsAt` has no caller (`team.js:95`).
- No bot follows another. The mined plans lost because "five leave in one second by one way" (plans and feel).

**Do.**

1. **Pairs.** The plan of a round gives each bot a partner. The second player keeps a distance behind the first
   (150 to 400 units as a start; C2 gives the players' number), on a floor that sees the first player's front.
2. **The trade.** A teammate dies in the bot's sight, or within about 800 units of path: the task is "trade". It
   stands over "pass", "ambush" and "cover", but not for a bot under 35 of health. The view goes to the place
   where the killer comes into sight (`watch.js approachPoint`). The bot swings out in the players' delay.
3. **The entry order.** Through one way the players go one after another, 0.3 to 0.8 s apart, and the second
   looks at the other side.
4. Later, with E7: the second player's flashbang before the first enters.

**Measure.** G8: the traded share and the delay; the distance to the nearest teammate at the first contact. G1.

**Risk.** A trade into a waiting AWP loses two players. The swing needs E2 for a known angle.

### D2. Calls: what a team knows, and when

**Today (read).** A sighting is exact, and all teammates have it at once (`team.js:52`). A bot takes a call as a
contact within 1,500 units and 5 s (`tactics.js:54-56`). A death is put in `Team.deaths` and not used. A real
team knows less, and later.

**Do.**

1. A call is a record: the kind (enemy seen, teammate died, bomb seen, place clear, sound), the place (a place
   of `places.js`, not a coordinate), the count, the time, who gave it.
2. A call reaches the team 0.5 to 1.5 s after its cause. A player that dies gives one call: the place of its
   killer.
3. Exact coordinates come only from a bot's own eyes and ears.
4. Each site has a pressure: the sum of the fresh calls there. A death of a teammate and the bomb count most.
   The pressure falls with time.

**Measure.** G6 holds. G1 with the calls against G1 with the exact knowledge.

**Risk.** The bots know less, so G1 can fall while the play is more fair. Owner decision (section 8, question 3).

### D3. The rotation on calls

**Today (read).**

- The whole team rotates when it sees at least 2 Ts, and at least 60% of the living Ts, within 1,300 units of
  one site in 6 s (`plan.js:16-20`). Then `plan.rotate` is set and never cleared (`plan.js:193`).
- Before that, one defender of the other site comes over at each T seen, while two stay (`lean`, `plan.js:218`).
- A death of a teammate at a site is no input.
- (docs) CTs within 800 units of the bomb 20 s after a plant: 82% against 49%. Plants: 56% of the rounds
  against 44%.

**Do.** Each CT decides by its role and by the pressure of D2:

| Role | At the first death or 2 enemies at the other site | At the bomb seen, 3 enemies, or a second death |
|------|------|------|
| Anchor of the attacked site | holds, or falls back to a place that keeps it alive for the retake | the same |
| Rotator (the nearest of the other site, or the middle) | goes at once, by a way that does not cross the fight | is there |
| Anchor of the other site | goes to a place between the sites | goes |

- A pressure that moves to the other site sends the players back: a fake costs time, not the round.
- The second of each step comes from the players' numbers (C2).

**Measure.** G8: the seconds to the first rotator, the CTs at the attacked site after 10 s, the players that go
back. G4: the plants must fall toward 44%.

### D4. Posts: where a CT stands and how it holds

**Today.**

- (read) A post is a floor near a site that sees a way in, with walls round it (`sites.js:157-177`). The CTs take
  the sites in turn (`plan.js:177`): no post in the middle, none forward.
- (read) A bot at a post stands upright, and it moves between at most 4 floors within 176 units. A kill changes
  nothing. It falls back only after it lost the enemy from sight, and only when hurt or outnumbered.
- (docs) CTs over 800 units from every site at second 16: 13% against 46%. The players' CTs kill Ts far from the
  sites.
- (docs) A CT stands under 500 units from an enemy 57% of the time against 19%. Travel of 200 units in 10 s: 23%
  of the windows against 72%.
- (docs) The mined CT setups lost: 20 of 48 rounds against 31. The setup alone gave places with no fall back.
- (read) csbih-player measures the places where each player stood for 1.5 s and more, with the view, the weight
  and the duck (`profile.js:162-177`). fatalbot drops them (`fatal.js:12`).

**Do.**

1. **A list of posts for each map and side, from the demos.** Sum the measured places of all players into one
   map file, with no name. A post has: the place, the view, the duck, how often, and the next place of the
   player after a contact (its fall back).
2. **A setup is five posts with roles**, from the mined formations at second 15: two sites, and the middle.
3. **A filter against the open.** No post on a floor that two ways in see, or that has no cover to one side.
4. **The hold.** After a kill, or after it was seen and lives, the bot takes another post of the list. When more
   enemies come than it can fight, it falls back to the next post: it does not stand.
5. **Two posts that see one way in from two sides** count more than two posts side by side.

**Measure.** G8: the two rows of travel and of the distance to an enemy; the CTs out of the sites at second 16.
G1 in the places of the recorded CTs (`tools/demo-arena.js`). The first death is a CT in 49 to 51% of the rounds
(the players 48%): this must hold.

### D5. Roles, and five different players

**Today (read).** All bots of the arena have one profile (`hosts/csbih/kind.js:22`). On the page and in a room a
bot takes 20 motor numbers of a demo player (the jumps, the taps of the duck, the chains of hops and the steps of
a fight among them since 2026-11-13); the places, the guns and the aim error are dropped. Tremor, hand time, view
field and hearing have no measure: all bots share them. No bot buys an AWP.

**Do.**

1. Roles for a side: entry, support, AWP, lurker, anchor. A role sets the place in the pair (D1), the post (D4),
   the buy (D8) and the will to push.
2. Role profiles from the demos, with no name: who makes the first contact, who holds the AWP, who is far from
   the middle of the team.
3. The AWP: the buy, long posts, the scope before the peek, one shot and back.

**Measure.** The share of the kills with the AWP against the players' (`demo-stats.js` counts them). The share
of the first contacts by role.

### D6. The Ts' round

**Today (read).** One site for the round, set at its start. The Ts wait hidden, and they leave so that the first
stands in the site at about second 34. Then each stands on a random floor of the site, and the carrier plants
after 3 s of quiet. No fake, no split, no change of the site.

**What was tried (docs).** The mined plans as formations: 48.4% against the plain bot; on de_inferno 9 of 24
rounds against 15. The text names the cause: no execute. Ts at the other site before the plant: 0% against 13%.

**Do, in this order.**

1. The default: the five take their places of second 20 in pairs (D1), for the control of the map and for
   knowledge.
2. The site by what the default learned (where a CT was seen, where a teammate died), not at second 0. A change
   of the site in the round.
3. The execute: two ways in, an entry order, the trade distance, the flashbang on the run (E7). One player stays
   at the other site or in the middle.
4. In the site: the view goes to the posts of the CT list (D4). The plant is at a place with cover, and a
   teammate guards it.
5. After the plant: pairs that see the bomb from two sides.
6. Then the plans become the default, when they win.

**Measure.** G1 with `--plans` over G1 without. G2 by map against the players (de_dust2 71% against 58%, de_nuke
35% against 46%). The two rows of the bomb play.

### D7. The retake together, and the save

**Today (read).** After a plant every CT runs to the bomb. The first defuses, and the others guard at 320 units.
The team gives the retake up with a chance of 0, 8 or 22% by the count of players (`tactics.js:41`).

**Do.**

1. The CTs meet out of the site and go in within 1 s of each other, with a flashbang.
2. The clock decides: 35 s of the bomb, 10 or 5 s of the defuse, the run to the site.
3. One defuses with a teammate that guards. A short start of the defuse draws the Ts out.
4. The save by the players' numbers (C2): away from the Ts, with the gun.
5. The Ts save too, in a round that is lost.

**Measure.** CTs within 800 units 20 s after the plant (82% against 49%). CTs alive at the blast stays near 16%.
The retakes won by the count of players, against the players'.

### D8. The economy of a team

**Today (read).** `cmd.drop` is never set. A frame has no gun on the floor, so fatalbot takes none (the
reference bot does). Grenades are bought only with lineups. (docs) CTs' full buy after a win: 56% against 77%.
Force buy after one loss: 8% and 19% against 20% and 24%.

**Do.** `frame.items` (spec 02, section 7). A bot takes a better gun, and it guards a dropped bomb. A rich player
drops a gun for a poor one in the freeze time. The AWP by role. Grenades by the plan.

**Measure.** The buy rows of `tools/rounds.js`.

### D9. The radio

**Today (read).** A command has no channel for speech (`contract.js:76-91`). The page has the radio menus of the
game for the human, and no bot speaks or answers (csbih-player spec 11, line 256). The demos hold the radio and
the chat of the players.

**Do.**

1. `cmd.radio` and `cmd.say` in the contract. A bot speaks the calls of D2, as often as the players did (C2).
2. A bot obeys the human's radio: "Follow me", "Hold this position", "Need backup", "Fall back", "Go go go".
3. The human's "Enemy spotted" makes a call at the place that the human looks at.

**Open.** The places of `places.js` have no names ("p12"). CS 1.6 has no place names of its own. A small table
for each map is an owner decision.

## 8. Stage E: the body

### E1. The view on a way

**Today.** (read) The view looks 480 units along the path, and the pitch is 0 (`walk.js:162-164`). (docs) In the
second before the first sight, the view lies within 15 degrees of the enemy in 28% of the cases against 62%. The
bot shoots first in 29% against 45%. Kills that start over 40 degrees off: 8 to 9% against 4%.

**Data that waits (read).** csbih-player builds, for each map, the mean view of the players by floor and
heading, and the points where enemies came into sight (`profile.js:441`, `profile.js:502`). fatalbot reads
neither (spec 01, section 6).

**Do.** On a way the view goes to the nearest point that the next second of the path opens, at the height of a
head. Then it goes to the next one. The pitch follows stairs and ramps. Now and then a look at a teammate or back.

**Measure.** The three numbers above. G1 will grow: the bot shoots first more often.

### E2. The peek

**Today (read).** None. On a sliver of an enemy the bot steps 32 units wider (`fight.js:199-215`).

**Do.**

| Case | The peek |
|------|----------|
| A corner with no knowledge | a slow cut at a walk, the view on the edge |
| A called enemy | a wide swing with a first burst at the called place, or with the partner |
| A known AWP | a short step out and back, to draw the shot |
| After a miss | not the same peek again: another side, or a wait |

**Measure.** C3: the speed and the width of the peek at the first sight.

### E3. The duck

**Today.** (docs) Ducked 1.0% and 1.7% of the living time against 9.3% and 12.7%. Jumps in the freeze time: 0 a
minute against 3.6. (docs) A duck in a wait was tried and taken back: it lost 14 of 96 rounds as CTs. "What the
players do with a duck is not found yet." (read) The game core has the pop of a fast duck: the duck key down for
one tick lifts the player 18 units (`pmove.js`, `unduck`). The reference bot uses it in the freeze time
(`antics.js`). (docs, 2026-11-13) The players tap 1.3 times a minute out of a fight in the live play (p10 0.08, p90
4.47), and the same player taps as often in other demos (0.81 between two halves of its demos). Three of four
rolls of the wheel are one tap, and a tap has one more in 34% of the cases.

**Do.**

1. **The tap on the run** (scroll and Ctrl): a habit of the profile, as `jumpRate` is. **Done** 2026-11-13 for the
   live play: one tap or a few on a calm run or wait, never within 3 s of a sign of an enemy. Not chains of 2 to 6:
   the demos have 1.5 taps for a roll. Open: the taps in the freeze time and after a won round.
2. **The duck at a post** only where the players ducked (the duck of a place, D4), behind cover that hides a
   ducked body. This is the probable reason of the lost rounds: a duck in the open is a slow target.
3. **The duck on the move** under a window or behind a low wall, where an enemy's way in sees a standing head.
4. **A jump away after a burst or a kill**: 0.0 to 0.3 a minute against 0.7 to 1.5.

**Measure.** G9: time ducked, time ducked on the move, taps a minute. G1 not under its value before.

### E4. Sound

**Today (read).** A bot hears steps over 150 units a second, a ladder, a shot, a reload, a plant and a defuse.
It does not hear a landing, a grenade's bounce, a door, a change of weapon or a scope. The core makes no event
for a step or a landing: the page makes those sounds itself. A blind bot hears nothing (`senses.js:188`). A bot
walks the last 500 units of 40% of its ways, and runs the rest. (docs) In a wait near an enemy the players creep
27% of the time against 11%.

**Do.** Fix the blind bot's ears. The core gives the events of a landing, a bounce and a door, and the frame
carries them. A bot walks where an enemy can hear it, and runs when shots cover its steps or the clock is short.
At a narrow place a bot stops for a second and listens.

**Measure.** G9: the speed bands before the first sight.

### E5. The hands

**Today (read).** A reload: the clip under half, 1.5 s after the last sight, anywhere (`brain.js:267`). The
knife in the hand: 5% of the time against 18% (docs). No scope before a peek. Nothing in the freeze time.

**Do.** After a kill: one step out of the line, then the reload. No reload with an enemy heard near. The knife
or the pistol on a long safe run. The fast change of weapon after an AWP shot. The habits of the freeze time for
fatalbot: the duck taps, the change of weapon, a spray.

**Measure.** G9: the reload after a kill, the knife share.

### E6. Flashbang, smoke, and a blind bot

**Today (read).** Teammates turn away from a flashbang of their own team. An enemy's grenade is not in the
frame. A blind bot walks on. Smoke blocks the sight, and no path goes round it.

**Do.** `frame.grenades` (spec 02, section 7). A bot turns away from a flashbang that it sees in the air. A
blind bot stops, or goes back to cover; by habit it fires at the place where it saw the enemy last. Smoke costs
a path more, and a bot waits at its edge or fires through it at a known place.

**Measure.** G9: the turn before a burst. The shots with no enemy in sight, against the players'.

### E7. Grenades with a purpose

**Today.** (read) Only the mined lineups, off by default: one a bot a round, from a stand, with 0.8 s to draw.
The page gives no lineups, so no bot throws there (`fatal.js:25-28`). (docs) With the lineups G1 fell from 74.5%
to 59.4%: "the stop for the throw costs more than the grenade gives". The players throw 9.5 grenades a round on
de_dust2.

**Do.**

1. The throw on the run and with a jump: no stop.
2. Throws that answer the round: a flashbang for the partner's entry (D1), an HE at a called place (D2), a smoke
   to cross a way or to cut a site off.
3. The lineups at the second of the plan, and the page gives them.

**Measure.** Grenades a round against the players'. The share of entries with a flashbang in the 2 s before.
G1 with the grenades not under G1 without.

### E8. The aim: what is left (docs, the players' aim of 2026-11-10)

- Pistol: 35 to 47% of the kills by a shot to the head against 57.3%.
- Sniper: 16 to 25% against 12.2%. The bot is too good.
- Shots 9 to 12 of a burst: 13.5 to 21.6 units under the head against 33.8. The bot holds a long spray too well.
- The view that follows an enemy behind a corner ("the aimbot is obvious", owner, 2026-11-13) is not changed and
  has no measure.

### E9. The spread of skill, and a difficulty

Tremor, hand time, view field and hearing get a spread, or a measure. A difficulty is a part of the players'
spread (the lower third, the middle, the upper third). It is never a hand faster than a player's.

## 9. Stage F: the game core, what is left

Each is small. All are (read), in csbih-player.

- An HE grenade and the bomb hurt teammates with `mp_friendlyfire 0` (`grenade.js`, `bomb.js`).
- No step, landing or jump event from the core (E4 needs them).
- No half time and no change of sides in `match.js`.
- Hostages: none. On a cs_ map the end of the clock is a CT win (`round.js:24`).
- No water, no moving brush but doors, no hurt, push or teleport trigger.
- A rotating door stops and does not push. The money of a round is paid at its end, not at the next start.
- No shield. The night vision is a paid flag only.
- The first slash of the knife: check 15 against the game's value.
- For the human, smoke is a drawn cloud. For a bot it is a hard ball.

## 10. Stage G: the goldsrc host

Not started. The open owner decisions are in the README and in spec 01, section 5. All of stages D and E run in
the brain, so they carry over to a real server with no change. Stage A does not apply there: the engine has
solid players.

## 10a. Stage H: the same as 1.6, what a player sees and hears

The owner (2026-11-13): the shots, the deaths, the grenades, the bomb and all other animations must be identical
to CS 1.6. Two reviews compared the page with the game on 2026-11-13. The server side was then read in the
source of ReGameDLL_CS (`player.cpp`, `ggrenade.cpp`, `combat.cpp`, `pm_shared.cpp`); the client of CS is not
public, so a rule of the client has the mark "check" until somebody compares it with the game.

### H1. Done on 2026-11-13 (csbih-player main, PRs #18 and #20)

- **A death.** The sequence by the hit group and the weights of the model, the throw of the body, the flight
  and the fall of the body, the turn of a bot against its flight.
- **The cycle of a gun.** A cycle of whole ticks was a tick late in a third of the shots (M249 and UMP 11 ticks
  for 10, MAC-10 and TMP 8 for 7). Now each gun fires at its cycle.
- **An HE.** Two fireballs as the game sends them, the smoke after, no shake of the picture.
- **A flashbang.** No flare and no light, the bang at the game's loudness.
- **A smoke grenade.** The cloud stays its 30 s (it left at 22 s), with a black puff each second.
- **The bomb.** The beeps each 1.44 s with the game's steps of the sound, the light each 2.04 s, the blast with
  its four sprites, its smoke, its sound from the bomb's place and the shake of the picture.

The rules of the core for the HE's damage, the flashbang and the smoke were read against the source and are the
game's. Nothing was to change there.

The measure of the two changes of the core is in `docs/measures/2026-11-13-death-and-cycle.md`.

### H2. Open, the most visible first

| No | What is not the game's | Mark |
|----|------------------------|------|
| 1 | The crosshair has one gap for all guns. The game has a base and a step for each gun. | check: client |
| 2 | The fire of other players is silent over 1,000 units. No change of pitch from shot to shot. | check: client |
| 3 | A player that runs always aims. The game plays the run of the full body after 4 s with no shot, and a flinch at a hit. | source: SetAnimation |
| 4 | The gun in the hand stays on the crosshair in a spray. In the game it sinks. | check: client |
| 5 | The view at a death falls to the floor and rolls. CS goes to a camera that looks at the body. | source: Killed |
| 6 | Blood shows at a hit on a vest or a helmet. No sparks at a wall, no smoke at the muzzle. | check: client |
| 7 | A shell does not bounce and has no sound. No shell of a shotgun, none of other players. | check: client |
| 8 | The bang of an HE is the page's sound. The game's is the engine's own for an explosion. | check: engine |
| 9 | Steps are silent over 625 units. The game's carry 1,250. | check: client |
| 10 | A window and a crate break with no pieces. | source: func_breakable |
| 11 | The knife slashes in the freeze time. The first slash does 15; check 20. | source: wpn_knife |
| 12 | A dead body is not tilted by a third of the view's pitch. The gun of a dead player leaves at the death, not 0.1 s on. | source: Killed |
| 13 | No punch of the view at a landing. `cl_bob` is 0 by default. | check: client |
| 14 | The sparks of a burst do not fly. No light as the engine makes it. | check: engine |
| 15 | The TV page still shakes the picture for an HE and draws a flare for a flashbang. | source: ggrenade |

## 11. What was tried and taken back: do not repeat it the same way

| Tried | Result | What it needs first |
|-------|--------|---------------------|
| Mined plans as formations | 48.4% against plain; inferno 9 of 24 | D1, D6 |
| Grenade lineups from a stand | G1 74.5% to 59.4% | E7, item 1 |
| CTs hunt when two ahead | Ts +5.6 points | D1, E2 |
| A duck and a creep in a near wait | duck: 14 of 96 rounds lost | E3, item 2 |
| Every standing bot makes way | 12 of 240 rounds lost | A4 |
| 0.6 of the moving fights on the full run | G1 down 6.8 points | the range of the players' run shots |
| A jump at a post to catch up the count | the first death a CT in 68% | none: stays out |
| Mined CT setups | 20 of 48 against 31 | D4, items 3 and 4 |

## 12. Small faults that can go at any time

- A blind bot is deaf (`senses.js:188`).
- `Team.deaths` and `deathsAt` have no reader (`team.js:95`).
- `plan.rotate` never clears (`plan.js:193`).
- The walk pitch is 0 on a ramp (`walk.js:164`).
- `duckShare` of a profile has no reader.
- The page gives fatalbot no lineups and no plans (`fatal.js:25-28`).
- The events before a bot joins are lost (`hosts/csbih/adapter.js:218-221`).

## 13. Questions for the owner

1. **A3.** A recorded player in a detour fires the demo's shots from a place that is a little off. Is 48 units
   the right limit for a kill of the demo?
2. **Look with no gain.** The duck tap, the habits of the hands and the radio move no gate of strength. Do they
   stay on the owner's word, as the step between bursts did, or only with G9? Answered for the duck tap on
   2026-11-13: the owner asked for it and merged it, and G1 did not move over 32 seeds.
3. **D2.** Calls with a delay and a place make the bots more fair and maybe weaker against the reference bots.
   Is a lower G1 right for that?
4. **D9.** Who writes the names of the places of each map?
5. **B3.** The scoreboard's "BOT": does it stay?
6. **C1.** The data on this machine: a copy from the server, or a new build from the demos?
