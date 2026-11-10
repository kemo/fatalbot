# The strategies of the demos, the plans, and the human feel (2026-11-10)

Code: commit `33f6352` of this repository, against csbih-player at `fe89385`. All runs are repeatable: the same
command gives the same rounds. The base for "before" is commit `fd5d860`, run from a clean copy of that commit.

Summary:

- The strategies of every recorded match are mined and drawn (docs/strategies.md): 517 demos, 11,721 rounds, nine
  maps.
- The plain fatalbot wins 78.6% of 192 rounds against the reference bots (74.5% before), and is stuck 0.3% of the
  time (1.2% before). The gain comes from the new rules of the walk.
- The mined plans are built as an option, not as the default. They help the Ts against recorded players on three
  maps of four, and they lose rounds against the plain fatalbot and against the reference bots.
- Gate G7 (human feel) is not met: fatalbot jumps half as often as the players, fires fewer rifle shots on the
  run, and makes 60% of its kills with a shot to the head where the players make 33 to 39%.

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

16 matches, 192 rounds, both side orders, the same default motor profile on both sides. 192 rounds give about 3.5
points of chance each way.

| Kind | Rounds won | At a wall | Stuck | A round lasts |
|------|-----------|-----------|-------|---------------|
| `fatal` at `fd5d860` (before) | 74.5% | 0.5% | 1.2% | 41 s |
| `fatal` (now) | 78.6% | 0.4% | 0.3% | 40 s |
| `fatal-plans` | 71.4% | 0.2% | 0.3% | 47 s |
| The reference bots, in the same matches | | 0.4 to 0.5% | 1.0 to 1.1% | |

Rounds won of 24, by map and side:

| Map | `fatal` as T | `fatal` as CT | `fatal-plans` as T | `fatal-plans` as CT |
|-----|------|------|------|------|
| de_dust2 | 16 | 15 | 15 | 9 |
| de_inferno | 20 | 22 | 22 | 13 |
| de_train | 18 | 20 | 14 | 22 |
| de_aztec | 20 | 20 | 22 | 20 |

The CTs with a mined setup lose de_dust2 and de_inferno to the reference bots: 22 of 48 rounds, where the posts of
the level win 37.

## 3. The plans against the plain fatalbot

```sh
node tools/arena.js --a fatal-plans --b fatal --maps de_dust2,de_inferno,de_train,de_aztec --rounds 12 --seeds 1,2 --sides both
```

192 rounds: the plans win 45.8%, the plain fatalbot 54.2%.

| Map | Plans as T, of 24 | Plain as T, of 24 |
|-----|------|------|
| de_dust2 | 17 | 18 |
| de_inferno | 5 | 15 |
| de_train | 11 | 18 |
| de_aztec | 20 | 10 |

On de_inferno the Ts with a plan lose 19 rounds of 24. A look at the deaths of six such rounds: the five Ts leave
their places at the same second, go by one way, and die there within 2 s of each other at the first crossfire. The
plan gives the formation and the second. It gives no order of the entries, no second way and no grenade: that is
the execute, and it is the next step.

## 4. Each kind against itself (gates G2 and G3)

```sh
node tools/arena.js --a <kind> --b <kind> --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3,4,5,6 --sides once --spells 6
```

36 matches, 432 rounds for each kind.

| Kind | Ts won | Plants | A round lasts | At a wall | Stuck |
|------|--------|--------|---------------|-----------|-------|
| `fatal` | 48.8% | 66.9% | 39 s | 0.3% | 0.2% |
| `fatal-plans` | 49.1% | 61.1% | 53 s | 0.3% | 0.3% |

Rounds that the Ts won of 72, by map:

| Kind | de_dust2 | de_inferno | de_nuke | de_train | de_aztec | de_cbble |
|------|------|------|------|------|------|------|
| `fatal` | 43 | 29 | 36 | 22 | 40 | 41 |
| `fatal-plans` | 35 | 38 | 27 | 48 | 24 | 40 |
| The Ts of the demos | 58% | 50% | 47% | 44% | 38% | 37% |

- Gate G2 (the Ts win 39 to 54% over the maps) holds for both kinds. By map neither kind follows the demos.
- Gate G3 holds for both kinds. The reference bots are at a wall 0.4 to 0.5% and stuck 1.0 to 1.1% of the time.
- Gate G5: 0.077 ms for ten bots a tick without the plans and 0.061 ms with them, measured alone on the
  processor on six maps (the target is 1 ms).
- The longest spell left: on de_nuke (seed 6, round 1) a CT with its knife out runs at a T behind a barrier that
  the eye passes and the body does not, for 59 s. This is a fault of the knife rule, not of the plans. It is open.

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
| de_dust2 | 37 | 52 | 41 | 29 | 33 | 19 |
| de_inferno | 46 | 35 | 31 | 34 | 30 | 29 |
| de_nuke | 34 | 43 | 33 | 42 | 43 | 27 |
| de_train | 28 | 31 | 26 | 40 | 38 | 34 |
| All, of 240 | 145 (60.4%) | 161 (67.1%) | 131 (54.6%) | 145 (60.4%) | 144 (60.0%) | 109 (45.4%) |

Read this with care:

- fatalbot does not meet the real players in a fight (docs/measures/2026-11-10-first-brain.md, section 1). It
  meets their recording, and after the first contact the reference bot with their route and their hand.
- The plans come from the same recorded matches, these 24 demos among them.
- With the plans the Ts win 16 rounds more: 6.7 points, where two runs of 240 rounds differ by about 4.5 points by
  chance. So it is no sure gain. It is on de_dust2 and de_nuke. On de_inferno the plans lose 11 rounds, as in
  section 3.
- The plain fatalbot won 154 and 149 of these rounds at commit `2001432`. The 145 and 145 of now lie inside the
  chance of 240 rounds. The changes of the feet since then gave no rounds here.

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
| | fatalbot | 2.3 | 2.6 | 2.6 | 3.9 |
| Hops of a chain a minute | the players | 0.11 | 0.55 | 0.41 | 0.38 |
| | fatalbot | 0.16 | 0.04 | 0.39 | 0.09 |
| Rifle shots on the run | the players | 12.8% | 10.7% | 10.2% | 7.4% |
| | fatalbot | 7.9% | 6.2% | 5.9% | 5.7% |
| All shots on the run | the players | 15.2% | 16.8% | 13.6% | 10.5% |
| | fatalbot | 12.3% | 9.3% | 9.3% | 7.5% |
| Kills with a shot to the head | the players | 33.2% | 35.6% | 37.8% | 38.8% |
| | fatalbot | 63.1% | 60.9% | 59.8% | 59.2% |
| Crosshair error at the first sight, p50 / p90 (degrees) | the players | 5.5 / 21.0 | 4.8 / 28.7 | 6.9 / 28.2 | 5.0 / 31.2 |
| | fatalbot | 8.2 / 38.5 | 3.1 / 16.5 | 5.6 / 31.2 | 5.4 / 32.0 |
| First sight to first shot, p50 / p90 (s) | the players | 0.40 / 0.85 | 0.38 / 0.84 | 0.40 / 1.05 | 0.44 / 1.04 |
| | fatalbot | 0.53 / 1.01 | 0.42 / 0.72 | 0.46 / 0.99 | 0.49 / 0.98 |
| Peak turn before the kill, p50 / p90 (degrees a second) | the players | 48 / 192 | 44 / 197 | 55 / 207 | 43 / 217 |
| | fatalbot | 66 / 293 | 43 / 143 | 65 / 252 | 68 / 235 |
| Crosshair error at the first shot, p50 / p90 (degrees) | the players | 2.1 / 8.5 | 2.5 / 11.9 | 2.2 / 11.8 | 1.6 / 7.3 |
| | fatalbot | 1.7 / 7.5 | 1.4 / 3.8 | 1.5 / 6.2 | 1.7 / 6.1 |

The aim numbers are for each kill: 1,068 kills of the players, 1,525 of fatalbot (the plain kind, in the places of
both sides, section 5).

What this says:

- **Kills with a shot to the head: 60% against 33 to 39%.** This is the largest gap, and it was not looked at
  before. The reference bots are at 58 to 71%. A player's shots land lower and wider than the hand model aims.
- **Jumps:** half of the players'. A probe showed that 42% of a bot's walk is a run that the round waits for,
  where the bot does not hop.
- **Rifle shots on the run:** 6 to 8% against 7 to 13%. Nearer than before (3 to 4.5%), still under.
- **The first shot:** fatalbot fires 0.04 to 0.13 s later than the players, and its crosshair is nearer the
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

## 8. What each change gave

| Change | Measure | Before | After |
|--------|---------|--------|-------|
| The rules of the walk (stand where no nearer, make way, wait behind a teammate, the foot of a ladder) | `fatal` against the reference bots, 192 rounds | 74.5% | 78.6% |
| | stuck, in the same rounds | 1.2% | 0.3% |
| The plans of a map | against the reference bots, 192 rounds | 78.6% | 71.4% |
| | against the plain fatalbot, 192 rounds | 50% (the same kind on both sides) | 45.8% |
| | in the places of recorded Ts, 240 rounds | 60.4% | 67.1% |
| | in the places of recorded CTs, 240 rounds | 60.4% | 60.0% |

Faults of the plans that were found and corrected before these numbers:

- A place on a floor with no way to it (a box, a roof): a bot ran at the wall under it for the round. Now the
  place moves to a floor that the side can walk to.
- A place at the bare end of a ladder (de_nuke): a bot hung on the ladder. Now such a floor is no place.
- A bot that held its place in a narrow way blocked its team for the round. Now it makes way.
- A bomb carrier that gave up a place over a ladder hung at the ladder's foot for 68 s (de_inferno). Now it
  jumps off, and it takes the place of a teammate.

## 9. Next

1. The execute of the Ts after the formation: two ways into the site, the order of the entries, the trade, and
   the grenades at the plan's second. de_inferno is the test: 5 of 24 rounds now.
2. The CT setups against a fast attack (de_dust2, de_inferno against the reference bots).
3. The human feel: where the shots land (the head share), the jumps, the angles of the demos for the first sight.
4. The knife rule at a barrier (section 4).
