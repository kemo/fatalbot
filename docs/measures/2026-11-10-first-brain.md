# The first brain with a team layer (2026-11-10)

Code: commit `2001432` of this repository, against csbih-player at `fe89385`. All runs are repeatable: the same
command gives the same rounds.

## 1. Against recorded matches (the owner's first test)

fatalbot takes the place of one side of a demo round, with the weapons and the motor profile of the players it
replaces (`--hands demo`). The other side plays its recording until the round leaves it, then plays on as the
reference bot with that player's route and profile.

```sh
node tools/demo-arena.js --map <map> --count 6 --rounds 10     # for de_dust2, de_inferno, de_nuke, de_train
```

24 demos, 10 rounds each, each round played two times (once in each side's place): 240 rounds for each side.

| Map | In the place of the Ts: fatalbot | the players | In the place of the CTs: fatalbot | the players |
|-----|------|------|------|------|
| de_dust2 | 38 of 60 | 41 | 28 of 60 | 19 |
| de_inferno | 42 of 60 | 31 | 35 of 60 | 29 |
| de_nuke | 42 of 60 | 33 | 47 of 60 | 27 |
| de_train | 32 of 60 | 26 | 39 of 60 | 34 |
| All | 154 of 240 (64.2%) | 131 (54.6%) | 149 of 240 (62.1%) | 109 (45.4%) |

Read this with care:

- "The players" is what the real players in those places did against the real players of the other side.
- fatalbot does not meet the real players in a fight. It meets their recording until it changes the round, and
  from then on the reference bot with their route and their measured hand. So the table says that fatalbot does
  better against those stand-ins than the players did against each other. It does not say that fatalbot beats those
  players.
- On de_dust2 as T, fatalbot wins fewer rounds than the players did (38 against 41).
- fatalbot gets no free first shots at a player who cannot turn. A player left its recording 2,187 times: 50%
  because it heard fatalbot (steps or shots), 23% because it saw fatalbot, 27% because the demo's next event could no
  longer happen, and 8 times (0.4%) because fatalbot hit it first.

## 2. Against the reference bots

```sh
node tools/arena.js --a fatal --b ref --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3
```

36 matches, 432 rounds, both side orders, the same default motor profile on both sides.

| Map | fatalbot as T | fatalbot as CT |
|-----|---------------|----------------|
| de_dust2 | 28 of 36 | 20 of 36 |
| de_inferno | 30 of 36 | 32 of 36 |
| de_nuke | 29 of 36 | 31 of 36 |
| de_train | 19 of 36 | 28 of 36 |
| de_aztec | 28 of 36 | 30 of 36 |
| de_cbble | 29 of 36 | 28 of 36 |
| All | 163 of 216 (75.5%) | 169 of 216 (78.2%) |

| Gate | Measure | fatalbot | reference bots (same matches) | Baseline, reference against itself |
|------|---------|----------|-------------------------------|------------------------------------|
| G1 | Rounds won | 76.9% | 23.1% | |
| G3 | Time at a wall | 0.6% | 0.6% | 1.5% |
| G3 | Time stuck | 1.1% | 1.3% | 1.5% |
| G4 | Rounds with a plant | 60.4% (all rounds) | | 63.9% |
| G4 | Rounds on the clock with no kill | 0 | | 0 |
| G5 | Brain for ten bots a tick | 0.068 ms | 0.207 ms | 0.199 ms |

A match swings far (12 to 0 one way, 2 to 10 the other, on one map): the money of a side that wins carries it, so
read the sums. The weakest spots are de_train as T (19 of 36) and de_dust2 as CT (20 of 36).

## 3. Gate G7, the human feel: not met

**Corrected later:** the column of the players in this section is cut short. A recorded player leaves its
recording at the first contact with fatalbot, so its numbers hold only the time before a fight. The players' own
numbers over whole rounds, and the aim, are in docs/measures/2026-11-10-plans-and-feel.md, section 6: they jump 4.4
to 8.0 times a minute and fire 7 to 13% of their rifle shots on the run.

The players alone, while they are on their own recording (`rails`), against fatalbot in their opponents' places
(`--hands demo`), and the reference bot against fatalbot in the arena:

| Measure | Map | The players | fatalbot | Reference bot |
|---------|-----|-------------|----------|---------------|
| Jumps a minute | de_dust2 | 4.1 | 2.3 | 6.0 |
| | de_inferno | 8.4 | 2.3 | |
| | de_nuke | 2.7 | 2.6 | |
| | de_train | 5.6 | 3.2 | |
| Hops of a chain a minute | de_dust2 | 0.09 | 0.22 | 0.20 |
| | de_inferno | 0.55 | 0.04 | |
| | de_nuke | 0.35 | 0.34 | |
| | de_train | 0.32 | 0.09 | |
| Rifle shots on the run (over 140 units a second) | de_dust2 | 5.2% | 4.5% | 22.1% |
| | de_inferno | 7.9% | 3.2% | |
| | de_nuke | 5.5% | 3.4% | |
| | de_train | 6.6% | 3.0% | |
| All shots on the run | de_dust2 | 7.8% | 9.3% | 21.1% |
| | de_inferno | 19.1% | 8.2% | |
| | de_nuke | 18.2% | 8.2% | |
| | de_train | 14.5% | 6.4% | |

What this says:

- fatalbot is nearer to the players than the reference bot in the shots on the run, and still under them. Before
  the last change it fired 0.1 to 0.3% of its rifle shots on the run: the stop before the shots was too strict.
- fatalbot jumps less than the players on three of the four maps.
- The players of these matches rarely hop in a chain (0.1 to 0.6 times a minute). A bunny hop is a habit of the
  profile here (`jumpRate`, `hopChain`), not a default.
- Not measured yet: the turn rates, the time to the first shot, the crosshair error at the first sight, the
  strafes of a fight, the peeks. `tools/aim-stats.js` and `tools/compare-fights.js` of csbih-player measure the
  first three for its own bots. Until those are measured for fatalbot, the hand is a port that was fitted to the
  players there, and not a measured fact here.

## 4. fatalbot against itself (gate G2)

```sh
node tools/arena.js --a fatal --b fatal --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3,4,5,6 --sides once
```

36 matches, 432 rounds: the Ts win 43.1%. The human matches give 39% to 54%, so the gate holds over the six maps.
It does not hold on each map: de_train 25% (18 of 72), de_inferno 36% (26), de_cbble 42% (30), de_nuke 43% (31),
de_dust2 53% (38), de_aztec 60% (43).

Twelve matches are too few for this gate: one match is one streak. Over 144 rounds the Ts won 44.4% at commit
`888c4ad`, 30.6% at `9ea0fa2` and 47.9% at `2001432`. The Ts have no team plan yet: they take one site at once, each
on its own way (spec 03, section 6).

## 5. What each change gave

The same 192 rounds against the reference bots (de_dust2, de_inferno, de_train, de_aztec; seeds 1 and 2; both side
orders):

| Change | Rounds won | At a wall | Stuck |
|--------|------------|-----------|-------|
| The ported bot with the strict senses and the stop before the shots | 60.9% | 0.5% | 1.1% |
| + a jump edge priced at 180 | 61.5% | 0.6% | 1.4% |
| + never a ledge jump on a walk edge (went back) | 56.3% | 0.5% | 1.2% |
| + the team layer of the CTs (posts, anchors, rotation) | 75.5% | 0.6% | 0.9% |
| + a ledge jump on a walk edge only when held up | 71.4% | 0.4% | 0.6% |
| + fire at once close in, and a hop three times as often on a run that allows one | 71.9% | 0.4% | 1.1% |

192 rounds give about 3.5 points of chance each way. Only the team layer is a sure gain in rounds won.

Other finds:

- The cost on de_nuke: 2.1 ms for ten bots a tick, from a way search that two callers each started again every
  tick. Now 0.15 ms there.
- A lone run on de_dust2 from the T spawn to the plant at site A: 27.3 s with the reference bot's jump on the
  stairs of the catwalk (it fell off and came back round), 22.6 s without.
- The default motor profile reacts in 0.28 s. The profiles of the players in the measured demos have a median of
  0.40 s. Both sides of the arena take the default.
