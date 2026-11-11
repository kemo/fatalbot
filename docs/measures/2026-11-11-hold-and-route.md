# The steps of a player that holds a place, and the route of a recorded player (2026-11-11)

Code: commits `662e002` to `009f079`, against csbih-player at `fe89385`. Every number of the bots comes from a clean
copy of one commit (`git archive <commit>`). The base of the first part is the play of `4be84f5` (the buy of a
team, docs/measures/2026-11-11-economy.md).

## 0. In short

| Measure | The recorded matches | Before | The steps before a contact (`2d3c129`) | The head (`362beb4`) |
|---------|------|------|------|------|
| To the first death of a round: the steps of 2 s in which a CT stands, a T stands | 33%, 16% | 90%, 63% | 43%, 22% | 35%, 17% |
| From the first death to the plant: a CT stands, a T stands | 18%, 10% | 73%, 39% | not run | 35%, 18% |
| Gate G2: the Ts win, by match, 36 seeds (the gate: 39 to 54%) | 49.7% | 55.2% (error 1.5) | 51.5% (error 1.5) | 53.2% (error 1.6) |
| Gate G1: fatalbot against the reference bots, 384 rounds | | 70.8% | 68.8% | 72.7% |
| Gate G3: fatalbot faces a wall (the reference bots in the same run) | | 0.43% (0.41%) | 0.48% (0.39%) | 0.47% (0.46%) |
| Gate G3: fatalbot is stuck | | 0.59% (0.88%) | 0.34% (0.96%) | 0.46% (1.10%) |
| fatalbot in the places of recorded Ts and CTs, 474 rounds each | | 283 and 276 | 282 and 281 | 282 and 274 |

- **The bots do not stand as they did.** Before a contact they move as the recorded players do. After the first
  death they stand in about a third of the steps of 2 s, half as often as before, and still twice as often as the
  players (sections 2 and 7).
- **Gate G2 is met**: the Ts win 53.2% of the rounds over 36 seeds (55.2% before this work). The pace of the Ts
  (commit `a7858e1`) is still in. The share is near the upper end of the gate: with its error it reaches 54.8%.
- **Gate G3**: the wall share is at the level of the reference bots (0.47% against 0.46%), and fatalbot is stuck
  less than half as often as they are. On the way there the wall share was not held, and two fixes for it made it
  worse and went back (section 3).
- A bot that plays on for a recorded player can now keep that player's route (section 4), and csbih-player has a
  switch for fatalbot as a patch (section 5). A review of the patch found two faults before it went anywhere: old
  events piled up in the adapter while no bot played, and the static build of csbih-player failed without the
  copy of fatalbot. Both are fixed and have a test.
- After a round is decided the bots run about and hop (section 7.1).

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
- `web/play.js`: fatalbot plays the bots; `?bot=bot.js` in the address gives the bots of `bot.js`. In a build
  with the stand-in alone the bots of `bot.js` play as before. The page says which bots play (`data-bots` on the
  document, and "fatalbot" in the map label).
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
- The play page of the copy with `?bot=fatal` (de_dust2, nine bots): the page says "fatalbot" (`data-bots`, and
  the map label "de_dust2 · 9 botova · fatalbot"), the 21 files of the copy load, and the console has no message.
  The page sets that name only when the host was made, so the brain was made in the browser on the level of the
  page. Without the option the page says "bot.js" and none of the copy loads.

- **A replay match of real demos, in Node, through the match code of csbih-player** (`DemoMatch` with the rails
  and the host of fatalbot, as the play page makes it): a member that stands at its start and fires, so that the
  recorded players leave their recordings. de_dust2 (12 rounds), de_inferno, de_nuke and de_train (6 rounds
  each): no error in 30 rounds. Each player that left its recording was played on by fatalbot with its route;
  the brain held no bot of the round before at a round's start. The longest step, with the run alone on the
  processor: 7.2 ms on de_dust2 and 5.9 ms on de_inferno (the bots of `bot.js`: 6.2 ms on de_dust2).
- **The owner's steps, on a clean export of the committed tree** (`git archive HEAD`, with links to
  `node_modules`, `assets` and `out`): the patch applies; with the stand-in alone two of the six new tests pass
  and four skip; the script copies fatalbot in; then 627 of 635 tests pass and seven skip. The one that fails
  (`test/import.test.js`, "the import never builds a demo of skips.json") fails on such an export without the
  patch too, and passes in csbih-player itself.
- The owner played free play on the page of the copy with fatalbot and reported how the bots behave (section 7).

The choice of the bots is one word of `web/play.js`: `const BOTS = 'fatal'`. It is the owner's decision of
2026-11-11 ("we're going with fatal bots right away"): fatalbot plays for every member. `?bot=bot.js` in the
address brings the bots of `bot.js` back for that page, and `?bot=fatal` asks for fatalbot in a build whose word
is `'bot.js'`.

What was not checked:

- A replay on the page in a browser (`/igraj?demo=`). The same code ran in Node, above.
- The deploy itself (`deploy/deploy.sh`): it works on the live server, and this repository changes nothing
  outside itself.
- A full static build with the levels, the models and the timelines, and a page served from one. The patch
  changes code only, and the build of the code was run (above). The checkout of
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

## 7. Free time, and the wait for a known enemy (the owner's reports of 2026-11-11)

The owner played with the bots and reported two things: "they just stand there after win (while teammate is
defusing), they should bunny hop around", and "standing is what makes them look like bots: at the start of the
round I killed an enemy and 3 of my guys just stood there until the next event".

### 7.1 Free time (`466c83f`, `fe98812`)

After the last enemy died, with the bomb still down, the recorded CTs that are left stand in 31% of the steps of
2 s (about the one at the bomb) and run in 36%, at 95 units a second in the middle. The bots stood in 43% of the
steps and moved at 38 units a second (four maps, seeds 7 to 12; a count of the session).

Now a round is the team's when no enemy is left alive after one lived, or when its clock ran out with no bomb
down. Then a player runs to floors about it, with the knife out, and a run that can hop, hops. With the bomb down
and no T alive, the CTs go for the bomb as before, and once a teammate is at it the others are free.

The rule, written before the run: on set B the CTs' stands in that time fall; the rounds that the CTs win after
a plant do not fall by more than 2 points of all rounds, and the Ts' share by match does not rise by more than
the error; gate G1 does not fall by more than 5 points; stuck and wall rise by no more than 0.1 point each.

| Measure | Before | `466c83f` | `fe98812` (kept) |
|---------|------|------|------|
| Set B: the CTs that are left stand, and their speed in the middle | 43%, 38 | 31%, 95 | 32%, 96 |
| The CTs win after a plant, of all rounds: set A, set B | 18%, 19% | 14%, 16% | 18%, 15% |
| The same over 36 seeds | 19% | | 17% |
| The Ts win, by match, 36 seeds | 51.5% (error 1.5) | | 50.9% (error 1.6) |
| Gate G1, 384 rounds | 68.8% | 69.8% | 71.6% |

- `466c83f` also sent only the nearest CT to a bomb with nobody at it, and left the others free. The CTs then won
  fewer rounds after a plant on both sets. That part went out in `fe98812`.
- For `fe98812` the row of the CTs' wins after a plant fell by 4 points on set B and by nothing on set A, so 24
  more seeds were played: over 36 seeds it is 2 points lower, the CTs win 2 points more rounds with no plant, and
  the Ts' share is the same (0.5 points less, error 2.2). The free time costs no rounds, and it stays.

### 7.2 The wait for a known enemy (`f48a2ce`, `362beb4`)

From the first death of a round to the plant the bots stood in 50% (CTs) and 29% (Ts) of the steps of 2 s; the
recorded players in 18% and 10%. A bot that knows of an enemy and waits for it stood on one floor for 3 to 12 s,
and the steps of a bot at its place stopped for 4 s after each shot that it heard.

Now a bot that waits for an enemy (at its post, where the contact found it, or in cover), and a T at its post
after the plant, steps between the floors about its place, with its view where the enemy comes into sight. Only an
enemy in its sight in the last 1.5 s stops the steps; and a bot that waits plants its feet when a sign of that
enemy is under 2 s old and within 700 units.

A fault found by the new test: a T that waited for an enemy never took a step. It still had its waiting place of
the plan, and both holds used one stand; the two reset each other's time in every tick. Each place has its own
stand now.

The rule, written before the run: on set B the stands after the first death fall by a third of the gap to the
players or more for the CTs and for the Ts (to 39% and 22% or under), and the Ts' share by match does not rise by
more than the error; over both sets gate G1 does not fall by more than 5 points, fatalbot in the places of
recorded Ts and CTs does not fall by more than 10 rounds each, and stuck and wall rise by no more than 0.1 point.

| Measure | Before (`fe98812`) | Steps at every moment (`f48a2ce`) | With the feet planted for a near enemy (`362beb4`, kept) |
|---------|------|------|------|
| Set B, after the first death: a CT stands, a T stands | 50%, 29% | 31%, 17% | 36%, 20% |
| Set B, before the first death: a CT stands, a T stands | 44%, 19% | 36%, 17% | 35%, 17% |
| Set B: the Ts win, by match | 57.6% | 48.8% | 50.5% |
| Gate G1, 384 rounds | 71.6% | 71.4% | 72.7% |
| In the places of recorded Ts and CTs, of 474 | 282 and 281 | 280 and 262 | 282 and 274 |
| Stuck (the reference bots) | 0.41% (1.14%) | 0.28% (1.07%) | 0.46% (1.10%) |
| Faces a wall (the reference bots) | 0.54% (0.45%) | 0.53% (0.43%) | 0.47% (0.46%) |

- With steps at every moment of a wait fatalbot won 19 rounds fewer in the places of recorded CTs: a bot is caught
  in a step when the enemy comes. With the feet planted for a near and fresh enemy it is 7 fewer, inside the rule,
  and every point of the rule holds.
- The bots still stand more than the players after the first death (36% and 20%; the players 18% and 10%).
- The wall share is now at the level of the reference bots (0.47% against 0.46%).

## 8. Next

1. The cause of the wall share with the steps (section 3), and gate G5 with the floors made at the brain's start.
2. The rest of the standing after the first death (36% and 20% of the steps; the players 18% and 10%), and the
   jumps of a player that steps.
3. The bomb play of section 6, the CTs' save first.
4. On the owner's word: the patch of section 5 into csbih-player, and the replay page tried with it.
