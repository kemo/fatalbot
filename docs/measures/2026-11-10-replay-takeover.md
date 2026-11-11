# fatalbot as the bot of a replay: the takeover in the middle of a round (2026-11-10)

Code: the commit of this document, against csbih-player at `fe89385`. The bullets meet the hit boxes of the
player model.

In a replay of csbih-player (`src/shared/game/demo-match.js`) every player follows its recording until the round
leaves it. From that moment a bot plays on for that player. Today that bot is the reference bot, with the route,
the grenades and the motor profile of the player. This document measures fatalbot in that place.

```sh
node tools/demo-arena.js --map <map> --count 6 --rounds 10                    # the reference bot takes over
node tools/demo-arena.js --map <map> --count 6 --rounds 10 --standins fatal   # fatalbot takes over
```

24 demos on de_dust2, de_inferno, de_nuke and de_train, 10 rounds each, each round once for each side: 480
rounds. One side is a team of fatalbot from the round's start, the same in both runs. It stands in for a strong
team of people, because no person can play 480 rounds here two times. The other side is the recording, and the
bot that takes over.

| Map | The side of the takeover bots wins, of 120: the reference bot | fatalbot |
|-----|------|------|
| de_dust2 | 55 | 55 |
| de_inferno | 42 | 62 |
| de_nuke | 42 | 44 |
| de_train | 51 | 63 |
| All, of 480 | 190 (39.6%) | 224 (46.7%) |

The takeover bots themselves, by map (de_dust2, de_inferno, de_nuke, de_train):

| Measure | The reference bot | fatalbot | The players |
|---------|------|------|------|
| Stuck (share of the time) | 0.9%, 1.7%, 4.1%, 6.7% | 0.1%, 0.2%, 2.5%, 6.2% | |
| At a wall | 0.3%, 0.3%, 2.1%, 1.0% | 0.1%, 0.1%, 1.1%, 0.6% | |
| Rifle shots on the run | 18.3%, 17.1%, 18.3%, 16.0% | 4.5%, 5.7%, 5.9%, 4.8% | 7 to 13% |
| Jumps a minute | 5.7, 7.8, 6.2, 7.5 | 2.3, 2.3, 1.9, 3.7 | 4.4 to 8.0 |
| Kills with a shot to the head | 45.5%, 39.1%, 43.5%, 42.3% | 45.7%, 41.1%, 40.8%, 44.3% | 42.1% |
| Cost for ten bots a tick | 0.30 to 1.38 ms | 0.06 to 0.20 ms | |

What this says:

- As the bot of a replay fatalbot is the harder opponent: its side wins 7 points more of the same rounds. Two
  runs of 480 rounds differ by about 3 points by chance. On de_dust2 and de_nuke the two bots do the same.
- This is a measure against a team of bots. No measure against a person exists. A person is not the stand-in of
  this test, so the number says which bot is harder for the same opponent, not how often a person wins.
- fatalbot does not know of an enemy behind a wall, and it does not read the bomb's place from the world. The
  reference bot does both (spec 03, section 2).
- fatalbot does not follow the route of the player, and it throws none of that player's grenades. From the
  takeover it plays its own round. The reference bot goes on as the player went.
- Both bots are stuck often after a takeover on de_train and de_nuke. A player stands where the graph has no
  floor (a wagon, a box, a roof), and the bot starts there. This is open for both.
  **Correction of 2026-11-11:** this cause was a guess, and it was wrong. A log of the stuck spells showed three
  other causes (a ladder beside its floor on de_train, a platform with no way in the graph and a hatch on
  de_nuke), and fatalbot is stuck 0.7% of the time after a takeover now
  (docs/measures/2026-11-11-night.md, section 2).

What the takeover needed in the brain: a CT that comes into a round after its start has no post of the round's
plan, and stood still. Now it takes a post at the site nearer to it (`tactics.js postOf`).
