# 2026-11-15: a bot with an empty clip reloads

The owner reported a fault of the bots in the play page of csbih-player: "these 2 guys got stuck trying to kill each
other with empty guns instead of pulling knives out and slaughtering each other OR running to the live teammate who
has bullets". It was the first round of a demo match (de_dust2, pistols).

## 1. The cause

The guns were not out of rounds. In a fight the bot pulled the trigger at each second tick, also with an empty clip.
The game starts its own reload only with no button down and 0.2 s after the last pull (weapons.cpp ItemPostFrame;
the dry fire of each gun sets the next attack 0.2 s on). A pull at each 20 ms never lets that time pass, so the bot
did not reload while it saw the enemy. The brain pressed the reload key only out of a fight (`brain.js`: a clip
under half, 1.5 s after the last sight of an enemy).

That round, run again in the game core of csbih-player (the member stands at the spawn, the ten players are bots
after their recording): 8 of 9 bots held a gun with an empty clip for more than 2.5 s. The longest was 70 s, a
Glock with 120 rounds in the pocket. The round ended on the clock at 115 s.

A bot with no round left at all was right before: `bestGun` gives the knife, and the knife fight goes at the enemy.
`test/fight.test.js` now holds that too.

## 2. The change

`d98e081`: in a fight, a bot whose gun in the hand has an empty clip presses the reload key once (with rounds in the
pocket) and holds fire until the clip is full. Its feet go on as the fight has them.

The same round after it: no bot holds an empty gun longer than its reload (2.9 s for the USP), and the round ends
by kills at 89 s.

## 3. The gates

Each run from `git archive` of the commit (before: `a7d6aba`), with `CSBIH_PLAYER` at the checkout of csbih-player
(main `6a5238a`).

`node tools/arena.js --a fatal --b ref --maps de_dust2,de_inferno --rounds 12 --seeds 1,...,32 --sides both`
(1584 rounds):

| | before | after |
|---|---|---|
| G1 fatalbot wins | 73.1% | 72.7% |
| kills : deaths | 6701 : 4226 | 6719 : 4208 |
| headshots | 42.9% | 43.7% |
| G4 plants | 72.7% | 73.9% |
| rounds that the clock ended (Target_Saved) | 4 | 1 |
| G3 wall, stuck | 0.3%, 0.3% | 0.3%, 0.4% |

`node tools/arena.js --a fatal --b fatal --maps de_dust2,de_inferno --rounds 12 --seeds 1,...,8 --sides both`
(384 rounds).

Correction (2026-11-16): these are 192 different rounds, each counted two times. Until that day `--sides both`
played a second order for one kind against itself, with the same kinds and the same seed: the same match again.
The shares stay. A share of 192 rounds has an error of about 3.6 points, and a difference of two such shares
about 5.1: the fall of G2 below is 1.7 errors, not a result yet.

| | before | after |
|---|---|---|
| G2 the Ts win | 52.1% | 43.2% |
| G4 plants | 57.8% | 54.7% |
| rounds that the clock ended (Target_Saved) | 4 | 2 |
| seconds a round | 51 | 51 |

- G1 does not move: 0.4 points over 1584 rounds is inside the noise of the arena.
- G2 stays inside its band of 39% to 54% and goes toward its middle. Eight seeds are few for this gate: read the 9
  points as a direction, not as a size.
- No gate goes away from its target. The measure that the change is for is the time with an empty gun in a fight
  (section 2), which the arena does not print.
