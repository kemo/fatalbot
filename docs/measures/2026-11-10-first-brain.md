# The first brain with a team layer (2026-11-10)

Code: commit `9ea0fa2` of this repository, against csbih-player at `fe89385`. All runs are repeatable: the same
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
| de_dust2 | 38 of 60 | 41 | 31 of 60 | 19 |
| de_inferno | 43 of 60 | 31 | 33 of 60 | 29 |
| de_nuke | 40 of 60 | 33 | 41 of 60 | 27 |
| de_train | 37 of 60 | 26 | 45 of 60 | 34 |
| All | 158 of 240 (65.8%) | 131 (54.6%) | 150 of 240 (62.5%) | 109 (45.4%) |

Read this with care:

- "The players" is what the real players in those places did against the real players of the other side.
- fatalbot does not meet the real players in a fight. It meets their recording until it changes the round, and
  from then on the reference bot with their route and their measured hand. So the table says that fatalbot does
  better against those stand-ins than the players did against each other. It does not say that fatalbot beats those
  players.
- On de_dust2 as T, fatalbot wins fewer rounds than the players did (38 against 41).

## 2. Against the reference bots

```sh
node tools/arena.js --a fatal --b ref --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3
```

36 matches, 432 rounds, both side orders, the same default motor profile on both sides.

| Map | fatalbot as T | fatalbot as CT |
|-----|---------------|----------------|
| de_dust2 | 33 of 36 | 12 of 36 |
| de_inferno | 32 of 36 | 26 of 36 |
| de_nuke | 30 of 36 | 27 of 36 |
| de_train | 11 of 36 | 29 of 36 |
| de_aztec | 27 of 36 | 26 of 36 |
| de_cbble | 28 of 36 | 30 of 36 |
| All | 161 of 216 (74.5%) | 150 of 216 (69.4%) |

| Gate | Measure | fatalbot | reference bots (same matches) | Baseline, reference against itself |
|------|---------|----------|-------------------------------|------------------------------------|
| G1 | Rounds won | 72.0% | 28.0% | |
| G3 | Time at a wall | 0.5% | 0.3% | 1.5% |
| G3 | Time stuck | 1.0% | 0.7% | 1.5% |
| G4 | Rounds with a plant | 62.3% (all rounds) | | 63.9% |
| G4 | Rounds on the clock with no kill | 0 | | 0 |
| G5 | Brain for ten bots a tick | 0.070 ms | 0.208 ms | 0.199 ms |
| G7 | Jumps a minute | 2.0 | 6.2 | |
| G7 | Shots fired on the run | 3.6% | 21.3% | |

Weak spots: fatalbot as CT on de_dust2 (12 of 36) and as T on de_train (11 of 36). A match swings far (12 to 0 one
way, 2 to 10 the other, on one map): the money of a side that wins carries it, so read the sums.

G3: in these matches fatalbot stands at a wall and stays stuck a little more than the reference bots. Both are
under the baseline of the reference bots against themselves.

## 3. fatalbot against itself (gate G2)

```sh
node tools/arena.js --a fatal --b fatal --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2 --sides once
```

144 rounds: the Ts win 30.6% (de_train 5 of 24, de_aztec 10, de_dust2 7, de_inferno 5, de_nuke 5, de_cbble 12).
**Gate G2 fails**: the human matches give 39% to 54%. The CTs have a team layer now and the Ts do not: they still
take one site at once, each on its own way. The Ts' plans are the next work (spec 03, section 6).

## 4. What each change gave

The same 192 rounds against the reference bots (de_dust2, de_inferno, de_train, de_aztec; seeds 1 and 2; both side
orders):

| Change | Rounds won | At a wall | Stuck |
|--------|------------|-----------|-------|
| The ported bot with the strict senses and the stop before the shots | 60.9% | 0.5% | 1.1% |
| + a jump edge priced at 180 | 61.5% | 0.6% | 1.4% |
| + never a ledge jump on a walk edge (went back) | 56.3% | 0.5% | 1.2% |
| + the team layer of the CTs (posts, anchors, rotation) | 75.5% | 0.6% | 0.9% |
| + a ledge jump on a walk edge only when held up | 71.4% | 0.4% | 0.6% |

192 rounds give about 3.5 points of chance each way. Only the team layer is a sure gain in rounds won.

Other finds:

- The cost on de_nuke: 2.1 ms for ten bots a tick, from a way search that two callers each started again every
  tick. Now 0.15 ms there.
- A lone run on de_dust2 from the T spawn to the plant at site A: 27.3 s with the reference bot's jump on the
  stairs of the catwalk (it fell off and came back round), 22.6 s without.
