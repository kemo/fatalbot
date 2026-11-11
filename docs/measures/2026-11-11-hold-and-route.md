# The steps of a player that holds a place, and the route of a recorded player (2026-11-11)

Code: commits `662e002` to `009f079`, against csbih-player at `fe89385`. Every number of the bots comes from a clean
copy of one commit (`git archive <commit>`). The base of the first part is the play of `4be84f5` (the buy of a
team, docs/measures/2026-11-11-economy.md).

## 0. In short

| Measure | The recorded matches | Before | After |
|---------|------|------|------|
| Quiet part of a round: the steps of 2 s in which a CT stands | 33% | 90% | 43% |
| The same for a T | 16% | 63% | 22% |
| Gate G2: the Ts win, by match, 36 seeds (the gate: 39 to 54%) | 49.7% | 55.2% (error 1.5) | 51.5% (error 1.5) |
| Gate G1: fatalbot against the reference bots, 384 rounds | | 70.8% | 68.8% |
| Gate G3: fatalbot faces a wall, against the reference bots | | 0.43% (the reference bots 0.41%) | 0.48% (0.39%) |
| Gate G3: fatalbot is stuck | | 0.59% (0.88%) | 0.34% (0.96%) |
| fatalbot in the places of recorded Ts and CTs, 474 rounds each | | 283 and 276 | 282 and 281 |

- **Gate G2 is met for the first time**: the Ts win 51.5% of the rounds over 36 seeds, 3.8 points less than before
  (the error of the difference is 2.1). The pace of the Ts (commit `a7858e1`) is still in.
- **Gate G3 is not held on the wall share**: 0.48% against the reference bots' 0.39%. Before the change it was
  0.43% against 0.41%. Two fixes for it made it worse and went back (section 3).
- A bot that plays on for a recorded player can now keep that player's route (section 4), and csbih-player has a
  switch for fatalbot as a patch (section 5). A review of the patch found two faults before it went anywhere: old
  events piled up in the adapter while no bot played, and the static build of csbih-player failed without the
  copy of fatalbot. Both are fixed and have a test.

## 1. The measure: the bots stood

`tools/rounds.js` has new rows: of the steps of 2 s of a living player, the share in which it moved under 16 units
(a stand) and under 100 units (a small step), from second 16 to the first death of the round, and from the first
death to the plant.

```sh
node tools/rounds.js --kinds fatal --seeds 1,2,3,4,5,6     # six maps; set A. Set B: seeds 7 to 12
```

| Measure | The recorded matches | fatalbot at the base |
|---------|------|------|
| To the first death: a CT stands | 33% (26 to 35% by map) | 90% |
| To the first death: a CT moves under 100 units | 25% | 5% |
| To the first death: a T stands | 16% | 63% |
| To the first death: a T moves under 100 units | 24% | 10% |
| After the first death: a CT stands | 18% | 73% |
| After the first death: a T stands | 10% | 39% |

A count of the session: a stand in one place lasts 2 s in the middle for a recorded player (14 s at the ninth
tenth for a CT), and 12 s for a CT of the bots (44 s at the ninth tenth).

## 2. The change, and its judgment

`57f74c9`, `378aba9`, `2d3c129`: a CT at a post of the level, and a T at its waiting place, stands a drawn time
(1.2 s in the middle) and then walks to another floor about the place. A floor is within 176 units by plain steps
of the graph, at the height of the place, not by a wall or on an edge, with a free straight walk. A floor about a
post sees a way in that the post sees; a floor about a waiting place is as hidden as the place. An enemy seen or
heard in the last 4 s keeps the bot where it is.

The rule, written before the first run. Numbers are chosen on set A. The change stays when on set B (1) the share
of the stands of the CTs, and of the Ts, each falls by a third of its gap to the players or more, and (2) the Ts'
share by match does not rise by more than the error of the difference; and over both sets (3) gate G1 does not
fall by more than 5 points, (4) fatalbot in the places of recorded Ts, and of recorded CTs, does not fall by more
than 10 rounds, and (5) gate G3 and gate G5 hold.

The middle of a stand, chosen on set A: 3 s for a CT and 2 s for a T gave 63% and 28% of the steps as stands;
1.2 s for both gave 44% and 23%.

| Rule | Base | `2d3c129` | Holds |
|------|------|------|------|
| 1. Set B: a CT stands, a T stands | 90% and 62% | 44% and 21% | yes |
| 2. Set B: the Ts win, by match | 50.7% | 53.5% (the error of the difference is 5.3) | yes |
| 3. Gate G1, 384 rounds | 70.8% | 68.8% | yes |
| 4. In the places of recorded Ts and CTs | 283 and 276 of 474 | 282 and 281 | yes |
| 5. Gate G3: stuck | 0.59% (the reference bots 0.88%) | 0.34% (0.96%) | yes |
| 5. Gate G3: faces a wall | 0.43% (0.41%) | 0.48% (0.39%) | **no** |
| 5. Gate G5 | | not read | **not judged** |

- The change stays, with point 5 open. The rise of the wall share is real: the reference bots stayed at 0.39 to
  0.41% in every run.
- Gate G5 was not read. The floors about a post are found when a bot first asks for them, inside a tick; they
  belong with the brain's start.
- Over all 36 seeds the Ts win 51.5% (error 1.5); at the base 55.2% (error 1.5). Sets A and B alone moved by
  -4.4 and +2.8 points, which is inside their error of 5.
- The first death of a round is a CT in 49% of the rounds (55% at the base, the players 48%).
- The jumps fell: 3.4 to 3.1 a minute against the reference bots. A bot that steps does not make its jump of a
  stand (`moves.js idleJump` asks for no move key).
- After the first death the bots still stand far more than the players. The rows of that part are in the tool
  from `44b9ea4` on; the kept build was not run with them.

## 3. Tried and taken back: two fixes for the wall share

A log of the wall spells of fatalbot named these causes, and each fix went in and came out again:

| Commit | What it did | Faces a wall (the reference bots) | Other |
|--------|------|------|------|
| `2d3c129` (kept) | | 0.48% (0.39%) | |
| `6cbf05e` (reverted by `6091393`) | An anchor keeps the floor that it stands on; a floor sees every way in that its post sees; the walk and the locked view only within 240 units of the place; a bot that waits with no view of its own looks along open lines; the floors are made with the brain | 0.55% (0.38%) | Set B: the Ts win 5.1 points more (error 4.9) |
| `7afd85d` (reverted by `71b45e5`) | "On its floor" and "near its place" also by the height; a view at rest runs 100 units or more | 0.65% (0.37%) | In the places of recorded CTs 262 of 474 rounds (276); over 36 seeds the Ts win 51.3% |

The causes were real in the logs (a bot one level under its post walked into the wall under it with a locked
view; a bot at rest took a corner 38 units away as its main view), and the fixes still raised the wall share. So
the cause of the rise is not found. The spells by goal, in seconds over 384 rounds, at the base and at the kept
build: a T at its post after the plant 159 and 144 (the largest, and older than this work), a CT at its site 37
and 74, a CT that waits for a known enemy 17 and 44, a T at its waiting place 7 and 27.

## 4. The route of a recorded player

For a replay of csbih-player (the owner's order of 2026-11-11: fatalbot in the place of the current bots, "with
retained paths from original players", and "each bot individually should exit route, not all because of a single
event").

`fab151a`, `009f079`, `f76c639`: `brain.join` takes an optional `route(seconds)`. On it the bot walks at the
player's pace, with the player's view and gun; off it by 300 units, or with no progress for 1 s, it walks back by
the graph. A bot leaves its route for the rest of the round only by what it meets itself: it reacted to an enemy
in its sight, it was hit, it heard an enemy within the hearing distance of its profile (350 units), the recording
of its player ended, or the bomb is not the route's. The reference bot leaves its route when the count of the
living differs from the recording by three, so every bot at once; fatalbot has no such rule.

```sh
node tools/demo-arena.js --map <map> --count 6 --rounds 10 --seed 1 --standins fatal         # no route
node tools/demo-arena.js --map <map> --count 6 --rounds 10 --seed 1 --standins fatal-route   # with the route
```

Four maps, seeds 1 and 2 (948 rounds). The rule, written before the first run: the route following stays as the
stand-in of a replay when the stand-ins with a route are stuck, and face a wall, no more than 1.5 times as often
as without one, and fewer than 5% of them leave the route as lost. The owner asked for the route: the measure says
what it costs.

| Measure | No route | A wait of 2 s, heard within 900 units | A wait of 1 s, heard within 900 | A wait of 1 s, heard within 350 (kept) |
|---------|------|------|------|------|
| The stand-ins are stuck | 0.91% | 1.63% | 1.22% | 1.61% |
| The stand-ins face a wall | 0.68% | 1.25% | 1.06% | 1.55% |
| The time alive on the route | | 21% | 20% | 31% |
| Left the route: heard an enemy | | 50% | 50% | 13% |
| Left: a fight, a hit | | 12%, 2% | 13%, 2% | 32%, 7% |
| Left: the recording ended, the bomb, lost | | 23%, 11%, 1% | 23%, 11%, 1% | 31%, 14%, 3% |
| Of the bots that left before their recording ended: within 1 s of a teammate that left its own | | not counted | 52% | 44% |
| The side of the stand-ins wins, of 948 rounds | 415 | 423 | 430 | 426 |

- **With a reach of 900 units one shot took every bot about it off its route**: half of the leaves were "heard",
  and 52% of the bots left within 1 s of a teammate. That is what the owner's rule is against. With the hearing
  distance of the profile the bots keep their route for 31% of their time alive, and "heard" is 13% of the leaves.
- **44% still leave within 1 s of a teammate.** No rule makes them: teammates that walk together, as their
  players did, see the same enemy at the same moment. What this share is for the recorded players themselves is
  not measured.
- **The rule of this record does not hold for the kept build**: the stand-ins are stuck 1.8 times as often as
  without a route and face a wall 2.3 times as often. The more of its time a bot is on a route, the higher both
  are. On a route the view is the player's own, and the bot presses its keys for each small step of the player:
  the gauge may count a player's shuffle in one place as stuck. This is a guess, not a measure. The measure that
  would tell is how far a bot falls behind its route.
- The side of the stand-ins wins as often with a route as without one (426, 430 and 415 of 948 rounds).
- Not built: the grenades of the player at their seconds.

## 5. The switch for csbih-player (a patch, not applied)

csbih-player is read-only from this repository. The switch is a patch in `out/csbih-player/fatal-switch.patch`
(git-ignored), made and tried in a copy of csbih-player made of links.

- `src/shared/game/fatal.js` (new): the host of fatalbot for a world, loaded only when it is asked for.
- `src/shared/fatalbot/hosts/csbih/adapter.js` (new): a stand-in in the adapter's place, so that every build has
  a file there. It says how to get the copy.
- `tools/vendor-fatalbot.js` (new): copies the brain and the adapter of one commit of fatalbot into
  `src/shared/fatalbot/`, over the stand-in.
- `demo-match.js`: with a host, fatalbot plays the bots of a replay, each with the hand and the route of its
  player. A recorded player joins the brain when it leaves its recording, and every bot leaves the brain at a
  round's start.
- `match.js botRound`: with a host on the world, fatalbot plays and buys for the bots of a match.
- `web/play.js`: `?bot=fatal` on the play page. Without it, and in a build with the stand-in alone, the bots of
  `bot.js` play as before. The page says which bots play (`data-bots` on the document, and "fatalbot" in the map
  label).
- `test/game-fatal.test.js` (new): six tests; four of them skip without the copy.

Two faults that a review found before the patch went anywhere, both now fixed and under a test:

1. **Old events as of now** (in this repository, `b41141b`). The adapter made a frame only when a bot of the
   brain was asked for a command, and a frame holds the events since the frame before it. In a replay no bot
   plays until the first recorded player leaves its recording, so the first frame held every shot and kill since
   the round's start, and the brain takes the events of a frame as of now. The arena did not show it: one side of
   it always plays. Now the events of a step that no frame took are gone, but for the last one that tells where
   the bomb is. The test fails on the adapter as it was (300 old shots in the first frame).
2. **A build that fails without the copy** (in the patch). The static build of csbih-player throws when a module
   imports a file that is absent. With the first form of the patch and no copy of fatalbot the build failed:
   "/shared/game/fatal.js imports ../fatalbot/hosts/csbih/adapter.js, which is not a static file". The stand-in
   is the fix.

What was checked, in the copy of links:

- `git apply --check` passes against csbih-player at `fe89385`, and csbih-player is unchanged.
- The six new tests: with the copy five pass and one skips; with the stand-in alone two pass and four skip. One
  of them plays two rounds on one host: the second round starts on the recordings again, with no bot of the
  first round left in the brain.
- Of the 635 tests of the copy, 632 pass and two skip. The one that fails is a test of Warcraft III maps, which
  uses none of the patched files; the cause in the copy was not looked for. In csbih-player itself all 629 tests
  pass without the patch. The patched tests were not run in csbih-player itself.
- The static build, for the code alone (`build()` of `tools/build-static.js` with the files of `web/` and
  `src/shared/` of the copy, into a scratch folder): it fails with the first form of the patch, passes with the
  stand-in (103 files), and passes with the copy (123 files, 22 of them fatalbot's). In the built `fatal.js` the
  import names the hashed adapter. The build throws on an import cycle: the brain has none.
- The play page of the copy opens with `?bot=fatal` (de_dust2, nine bots): the 21 files of the copy load and the
  console has no message. Without the option none of the copy loads.

What was not checked:

- That the bots of the page move by fatalbot. This was checked before the page had its label; the test of
  `botRound` covers the wiring.
- A replay on the page (`/igraj?demo=`).
- A full static build with the levels, the models and the timelines, and a page served from one. The checkout of
  csbih-player has a static build, so its own `/igraj` answers 403 without a pass of gamerz.ba; the copy had no
  static build and opened without one.

One thing seen on the page and not from this patch: dark pointed shapes fill the right of the first view on
de_dust2, with the option and without it.

## 6. The bomb play, measured (no change yet)

Counts of the session, on de_dust2, de_inferno and de_train (the recorded matches: 4,070 plants):

| Measure | The recorded matches | fatalbot |
|---------|------|------|
| Before the plant, two Ts or more stood at the other site | 13% of the plants | 0% |
| At the plant, the living Ts inside the site | 55% | 79% |
| After the plant the round lasts, the middle | 21 s | 16 s |
| 20 s after the plant, the living CTs within 800 units of the site | 49% | 82% |

After a plant the same side wins as often with the same numbers alive (docs/measures/2026-11-11-night.md, section
3). What is missing: the CTs' save when a retake has no chance, the Ts' spread after the plant, a change of site
before the plant, and a choice of the site by the map.

## 7. Next

1. The cause of the wall share with the steps (section 3), and gate G5 with the floors made at the brain's start.
2. The hold after a contact: the bots stand in 73% of the steps after the first death (the players 18%).
3. The bomb play of section 6, the CTs' save first.
4. On the owner's word: the patch of section 5 into csbih-player, and the replay page tried with it.
