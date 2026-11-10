# The strategies of the demos, the plans, and the human feel (2026-11-10)

Code: commit `933884d` of this repository, against csbih-player at `fe89385`. All runs are repeatable: the same
command gives the same rounds. "Before" is commit `fd5d860`, run from a clean copy of that commit. Some rows name
commit `33f6352`: the same code, where every standing bot made way (section 8).

**Corrected later** (docs/measures/2026-11-10-players-aim.md): the share of the kills with a shot to the head
in this document is a fault of the arena. Its head box was larger than a head. With the hit boxes of the player
model fatalbot makes 41 to 44% of its kills by a shot to the head, and the players of all 520 demos make 42.2%.
The rounds won of this document were played with the large head box; the same gates with the hit boxes of the
model are in that document, section 4.

Summary:

- The strategies of every recorded match are mined and drawn (docs/strategies.md): 517 demos, 11,721 rounds, nine
  maps.
- The mined plans are built as an option, not as the default. No measure shows a sure gain or a sure loss of
  rounds from them. On de_inferno the Ts with a plan lose to the plain fatalbot.
- The sure gain of this phase is in gate G3: against the reference bots fatalbot is stuck 0.5% of the time (1.2%
  before).
- Rounds won did not move outside the chance of the runs: 72.4% against the reference bots (74.5% before), and
  159 and 145 of 240 rounds in the places of recorded Ts and CTs (157 and 144 before).
- Gate G7 (human feel) is not met: fatalbot jumps half as often as the players, fires fewer rifle shots on the
  run, and makes 60% of its kills with a shot to the head where the players make 33 to 39%.
- How much two runs differ by chance: two builds that differ in one small rule gave 78.6% and 72.4% of the same 192
  rounds for the plain kind, and 71.4% and 76.6% for the plans. A difference under about 7 points says nothing.

## 1. The strategies of the recorded matches

```sh
node tools/strategies.js --report docs/strategies.md
```

| Map | Demos | Rounds | Ts won | Plans of the Ts | their share of the rounds | Setups of the CTs | their share |
|-----|-------|--------|--------|------|------|------|------|
| de_dust2 | 152 | 3426 | 58% | 21 | 55% | 21 | 59% |
| de_inferno | 150 | 3433 | 50% | 24 | 82% | 22 | 71% |
| de_train | 84 | 2100 | 44% | 23 | 73% | 23 | 80% |
| de_nuke | 84 | 1884 | 47% | 13 | 87% | 14 | 92% |
| de_cbble | 18 | 303 | 37% | 6 | 31% | 16 | 73% |
| de_tuscan | 14 | 362 | 53% | 11 | 70% | 16 | 91% |
| de_aztec | 8 | 97 | 38% | 1 | 24% | 6 | 83% |
| de_prodigy | 4 | 57 | 61% | 2 | 28% | 3 | 92% |
| de_cpl_mill | 3 | 59 | 44% | 3 | 74% | 2 | 84% |

- A plan is a strategy that was played in 5 rounds or more and in 1.5% of the rounds or more. A plan of the Ts
  also needs one site in 40% of its rounds or more.
- Left out: de_mirage (8 demos) and de_clan1_mill (3 demos) have no built level in csbih-player. cs_havana,
  de_forge, de_chateau and de_vegas have one demo each.
- Some places of the CT setups lie on floors that the graph of csbih-player has no way to. The brain moves such a
  place to the nearest floor that a bot can walk to, or leaves it out. Places left out, by map: de_nuke 14 (in 10
  of 14 setups: a platform at about x 1024 to 1088, y -448 to -384, z -52 with no walk edge), de_cbble 9,
  de_aztec 4, de_prodigy 3, de_tuscan 2, de_cpl_mill 2, de_dust2 1. No place of a T plan is lost.

## 2. Against the reference bots

```sh
node tools/arena.js --a <kind> --b ref --maps de_dust2,de_inferno,de_train,de_aztec --rounds 12 --seeds 1,2 --sides both
```

16 matches, 192 rounds, both side orders, the same default motor profile on both sides.

| Kind | Rounds won | At a wall | Stuck | A round lasts |
|------|-----------|-----------|-------|---------------|
| `fatal` at `fd5d860` (before) | 74.5% | 0.5% | 1.2% | 41 s |
| `fatal` at `33f6352` | 78.6% | 0.4% | 0.3% | 40 s |
| `fatal` (now) | 72.4% | 0.3% | 0.5% | 40 s |
| `fatal-plans` at `33f6352` | 71.4% | 0.2% | 0.3% | 47 s |
| `fatal-plans` (now) | 76.6% | 0.3% | 0.4% | 48 s |
| The reference bots, in the same matches | | 0.4% | 1.0 to 1.2% | |

Rounds won of 24, by map and side (now):

| Map | `fatal` as T | `fatal` as CT | `fatal-plans` as T | `fatal-plans` as CT |
|-----|------|------|------|------|
| de_dust2 | 20 | 9 | 23 | 7 |
| de_inferno | 15 | 22 | 24 | 13 |
| de_train | 12 | 22 | 18 | 20 |
| de_aztec | 20 | 19 | 22 | 20 |
| All, of 96 | 67 | 72 | 87 | 60 |

- Against the reference bots the Ts with a plan win more (87 of 96 against 67). At `33f6352` the same two kinds
  won 73 and 74, so this is no sure gain.
- The CTs with a mined setup win fewer rounds on de_dust2 and de_inferno in both builds (20 of 48 now, where the
  posts of the level win 31; 22 and 37 at `33f6352`). This is the steadiest result of the table.

## 3. The plans against the plain fatalbot

```sh
node tools/arena.js --a fatal-plans --b fatal --maps de_dust2,de_inferno,de_train,de_aztec --rounds 12 --seeds 1,2 --sides both
```

192 rounds: the plans win 48.4%, the plain fatalbot 51.6% (45.8% and 54.2% at `33f6352`).

| Map | Plans as T, of 24 | Plain as T, of 24 |
|-----|------|------|
| de_dust2 | 19 | 19 |
| de_inferno | 9 | 15 |
| de_train | 10 | 13 |
| de_aztec | 13 | 7 |

On de_inferno the Ts with a plan win 9 rounds of 24 (5 at `33f6352`). A look at the deaths of six such rounds:
the five Ts leave their places at the same second, go by one way, and die there within 2 s of each other at the
first crossfire. The plan gives the formation and the second. It gives no order of the entries, no second way
and no grenade: that is the execute, and it is the next step.

## 4. Each kind against itself (gates G2 and G3)

```sh
node tools/arena.js --a <kind> --b <kind> --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3,4,5,6 --sides once --spells 6
```

36 matches, 432 rounds for each kind.

| Kind | Ts won | Plants | A round lasts | At a wall | Stuck |
|------|--------|--------|---------------|-----------|-------|
| `fatal` | 41.7% | 57.9% | 39 s | 0.5% | 0.8% |
| `fatal-plans` | 42.8% | 57.6% | 53 s | 0.4% | 0.5% |

Rounds that the Ts won of 72, by map:

| Kind | de_dust2 | de_inferno | de_nuke | de_train | de_aztec | de_cbble |
|------|------|------|------|------|------|------|
| `fatal` | 36 | 22 | 27 | 26 | 39 | 30 |
| `fatal-plans` | 31 | 44 | 26 | 32 | 21 | 31 |
| The Ts of the demos | 58% | 50% | 47% | 44% | 38% | 37% |

- Gate G2 (the Ts win 39 to 54% over the maps) holds for both kinds. By map neither kind follows the demos.
- Gate G3 holds for both kinds: the reference bots are at a wall 0.4% and stuck 1.0 to 1.2% of the time.
- Gate G5: 0.074 ms for ten bots a tick without the plans and 0.061 ms with them, measured alone on the
  processor on six maps (the target is 1 ms).
- The longest spells left. Without plans: a T on de_cbble at (-1088, 2128, -50) faces a wall for 46 s (seed 1;
  the same place at `fd5d860`). With plans: a T on de_inferno hangs for 21 s at the top of a ladder under its
  place of the formation, a roof that the ladder does not reach (seed 4); a CT on de_train stands 22 s short of its
  post (seed 3). At `33f6352` a CT on de_nuke stood for 59 s inside a solid of the level by a trace of it, most
  likely a door (seed 6, round 1). The cause is open.

## 5. Against recorded matches (the owner's first test)

```sh
node tools/demo-arena.js --map <map> --count 6 --rounds 10            # for de_dust2, de_inferno, de_nuke, de_train
node tools/demo-arena.js --map <map> --count 6 --rounds 10 --plans
```

24 demos, 10 rounds each, each round played once in each side's place: 240 rounds for each side. fatalbot has the
weapons and the motor profile of the players that it replaces. The other side plays its recording until the round
leaves it, then plays on as the reference bot with that player's route and profile.

| Map | As T: plain | with plans | the players | As CT: plain | with plans | the players |
|-----|------|------|------|------|------|------|
| de_dust2 | 39 | 54 | 41 | 29 | 31 | 19 |
| de_inferno | 49 | 37 | 31 | 34 | 29 | 29 |
| de_nuke | 38 | 41 | 33 | 41 | 44 | 27 |
| de_train | 33 | 32 | 26 | 41 | 36 | 34 |
| All, of 240 | 159 (66.3%) | 164 (68.3%) | 131 (54.6%) | 145 (60.4%) | 140 (58.3%) | 109 (45.4%) |
| Before (`fd5d860`) | 157 (65.4%) | | | 144 (60.0%) | | |

Read this with care:

- fatalbot does not meet the real players in a fight (docs/measures/2026-11-10-first-brain.md, section 1). It
  meets their recording, and after the first contact the reference bot with their route and their hand.
- Two runs of 240 rounds differ by about 4.5 points by chance. Over the four maps the plans change nothing that
  is sure, on either side.
- By map the plans move the Ts far: 15 rounds up on de_dust2, 12 down on de_inferno (as in section 3).
- The gain on de_dust2 is in part a fault of this test. With a plan the Ts wait, and the recorded CTs stay on
  their recording longer: the first of them leaves it at second 14.8 (median) with the plans and at second 6.7
  without (measured at `33f6352`). After that a CT follows the route of a round that was played against other Ts.
  A team that waits and then takes the other site gains from that. Against the CTs of the arena the plans gain
  nothing on de_dust2 (19 and 19 in section 3).
- The plans come from the same recorded matches, these 24 demos among them.

## 6. Gate G7, the human feel: not met

The players alone come from `--sides none`: nobody is replaced, and every round is the demo (239 of 240 rounds end
with the demo's winner). This corrects section 3 of docs/measures/2026-11-10-first-brain.md: its numbers of the
players were cut short at the first contact with fatalbot.

```sh
node tools/demo-arena.js --map <map> --count 6 --rounds 10 --sides none
```

| Measure | Who | de_dust2 | de_inferno | de_nuke | de_train |
|---------|-----|------|------|------|------|
| Jumps a minute | the players | 4.7 | 8.0 | 4.4 | 7.2 |
| | fatalbot | 2.3 | 2.5 | 2.6 | 3.9 |
| Hops of a chain a minute | the players | 0.11 | 0.55 | 0.41 | 0.38 |
| | fatalbot | 0.16 | 0.04 | 0.39 | 0.08 |
| Rifle shots on the run | the players | 12.8% | 10.7% | 10.2% | 7.4% |
| | fatalbot | 7.9% | 6.1% | 5.8% | 5.4% |
| All shots on the run | the players | 15.2% | 16.8% | 13.6% | 10.5% |
| | fatalbot | 12.3% | 9.0% | 9.7% | 7.4% |
| Kills with a shot to the head | the players | 33.2% | 35.6% | 37.8% | 38.8% |
| | fatalbot | 63.2% | 63.4% | 59.3% | 58.6% |
| Crosshair error at the first sight, p50 / p90 (degrees) | the players | 5.5 / 21.0 | 4.8 / 28.7 | 6.9 / 28.2 | 5.0 / 31.2 |
| | fatalbot | 7.3 / 39.9 | 3.4 / 16.8 | 5.0 / 28.8 | 5.5 / 32.0 |
| First sight to first shot, p50 / p90 (s) | the players | 0.40 / 0.85 | 0.38 / 0.84 | 0.40 / 1.05 | 0.44 / 1.04 |
| | fatalbot | 0.55 / 1.01 | 0.42 / 0.78 | 0.46 / 0.97 | 0.47 / 0.95 |
| Peak turn before the kill, p50 / p90 (degrees a second) | the players | 48 / 192 | 44 / 197 | 55 / 207 | 43 / 217 |
| | fatalbot | 64 / 273 | 44 / 141 | 59 / 252 | 65 / 252 |
| Crosshair error at the first shot, p50 / p90 (degrees) | the players | 2.1 / 8.5 | 2.5 / 11.9 | 2.2 / 11.8 | 1.6 / 7.3 |
| | fatalbot | 1.5 / 6.5 | 1.4 / 3.8 | 1.4 / 6.7 | 1.7 / 6.0 |

The aim numbers are for each kill: 1,068 kills of the players, 1,531 of fatalbot (the plain kind, in the places of
both sides, section 5).

What this says:

- **Kills with a shot to the head: 60% against 33 to 39%.** This is the largest gap, and it was not looked at
  before. Each of the 24 demos lies between 28% and 45%, by the kills of its recording. The reference bots are at
  58 to 71%. A player's shots land lower and wider than the hand model aims.
- **Jumps:** half of the players'. A probe showed that 42% of a bot's walk is a run that the round waits for,
  where the bot does not hop.
- **Rifle shots on the run:** 5 to 8% against 7 to 13%. Nearer than before (3 to 4.5%), still under.
- **The first shot:** fatalbot fires 0.03 to 0.15 s later than the players, and its crosshair is nearer the
  enemy when it fires. The time and the error are near the players'; the spread of the players (p90) is wider at
  the first shot.
- **The view at the first sight:** near the players' on three maps. The angles where enemies appear in the demos
  are not used yet (csbih-player spec 12).
- Not measured yet: the strafes of a fight, the peeks, the hold of an angle.

## 7. Grenades

Measured at commit `fd5d860` (its message holds the details). The same 192 rounds against the reference bots:
74.5% without the lineups, 59.4% with them; with the throws of the Ts alone 65.1%, with those of the CTs alone
68.8%. Of the 300 lineups of de_dust2, 158 have a throw from a stand, and it goes off 47 units (p50) from the
recorded one. The lineups stay an option (`fatal-nades`, `--nades`) until a plan times them.

## 8. The rules of the walk, one by one

The plans needed three rules of the walk, and the rules are on for every kind. At `33f6352` every standing bot
made way for a teammate that it held up. In the places of recorded Ts that cost rounds on each map. The plain
fatalbot as T, the 240 rounds of section 5, with one rule off at a time:

| Build | de_dust2 | de_inferno | de_nuke | de_train | All, of 240 |
|-------|------|------|------|------|------|
| `fd5d860`, before the rules | 39 | 49 | 39 | 30 | 157 |
| `33f6352`, all rules | 37 | 46 | 34 | 28 | 145 |
| without "stand where no nearer" | 37 | 49 | 38 | 27 | 151 |
| without "wait behind a teammate" | 37 | 46 | 37 | 28 | 148 |
| without "make way" | 39 | 49 | 39 | 33 | 160 |
| `933884d`, only a bot that waits makes way | 39 | 49 | 38 | 33 | 159 |

A bot at a post of a fight (after the plant, in an ambush, at a cover) stepped out of its cover when a teammate
pushed. Now only a bot that waits makes way: a T at its place of the formation, a CT at its post with no enemy in
sight. Against the reference bots the wide rule gave more rounds (78.6% against 72.4%), inside the chance of the
runs. The test against recorded matches is the owner's first, and its answer was the same on every map.

Faults of the plans that were found and corrected:

- A place on a floor with no way to it (a box, a roof): a bot ran at the wall under it for the round. Now the
  place moves to a floor that the side can walk to.
- A place at the bare end of a ladder (de_nuke): a bot hung on the ladder. Now such a floor is no place.
- A bot that held its place in a narrow way blocked its team for the round. Now it makes way.
- A bomb carrier that gave up a place over a ladder hung at the ladder's foot for 68 s (de_inferno). Now it
  jumps off, and it takes the place of a teammate.

## 9. Next

1. The execute of the Ts after the formation: two ways into the site, the order of the entries, the trade, and
   the grenades at the plan's second. de_inferno is the test: 9 of 24 rounds against the plain fatalbot now.
2. The CT setups against a fast attack (de_dust2 and de_inferno against the reference bots).
3. The human feel: where the shots land (the head share), the jumps, the angles of the demos for the first sight.
4. A test with less chance in it: more seeds for each measure, or the same rounds paired.
5. The open spells of section 4.
