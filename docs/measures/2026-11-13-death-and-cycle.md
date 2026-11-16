# 2026-11-13: the death of the game and the cycle of a gun, in the game core

Two changes of the game core of csbih-player (branch `igraj-death-throw`) change the rounds that the bots play.
Neither is a change of the brain. This record gives their effect on gate G1.

- `4620b61`: a death is the game's. Killed throws the body, and the body flies and falls. The gun of a dead player
  takes 0.75 of the body's velocity, as the game packs it, so it lies in another place than before.
- `93f9ebf`: a shot that is due is never a tick late. Before, a gun with a cycle of whole ticks fired a tick late
  in about a third of its shots (the M249 and the UMP each 11 ticks for 10, the MAC-10 and the TMP each 8 for 7).

## 1. The runs

fatalbot `8212a30` against the reference bots, on one machine, one after the other:

```sh
CSBIH_PLAYER=<a copy of csbih-player at the commit> node tools/arena.js --a fatal --b ref \
  --maps de_dust2,de_inferno,de_nuke,de_train --rounds 12 --seeds 1,2,3,4,5,6,7,8 --sides both
```

768 rounds a run. G1 is the share of the rounds that fatalbot wins.

| Game core | G1 | de_dust2 | de_inferno | de_nuke | de_train | Rounds with a plant | Stuck, wall |
|-----------|----|----------|------------|---------|----------|---------------------|-------------|
| `1bd4500` (main) | 65.8% | 75.5% | 71.4% | 60.9% | 55.2% | 72.4% | 0.8%, 0.4% |
| `4620b61` (the death) | 62.6% | 69.8% | 69.8% | 55.7% | 55.2% | 70.7% | 1.1%, 0.6% |
| `93f9ebf` (the death and the cycle) | 63.2% | 70.3% | 68.2% | 59.9% | 54.2% | 70.6% | 1.0%, 0.5% |

## 2. What the runs say

- **The death changes the rounds.** No score of a match is the same as before. The cause is the gun of a dead
  player: it flies with the thrown body, and the reference bots walk to a gun on the floor. The deaths themselves
  draw from a random of their own.
- **G1 is 3.2 points lower with the death, and 2.6 with both changes.** One run of 768 rounds has an error of about
  1.7 points, and the difference of two runs about 2.4. So the fall is not shown, and it is not ruled out. A run
  with more seeds can tell.
- **The cycle changes little:** 62.6% to 63.2%.

## 3. This machine against the record of the morning

The record of the same day (`2026-11-13-fight.md`) has G1 at 74.9% for this command line at fatalbot `8212a30`.
On this machine the same commits give 65.8%. The levels of this machine were built on 2026-11-13 from the maps
that `tools/fetch-assets.sh` fetches (`build-levels.js`, `build-hulls.js`, `build-nav.js`).

**The cause (found on 2026-11-14, on the owner's machine):** this machine has no `out/profiles` of csbih-player.
The reference bots take the view field and the grenade lineups of each map from there (`view-<map>.json`,
`throws-<map>.json`, `load.js loadMapData`). Without them the kind `ref` is the kind `ref-bare`.

The same command at fatalbot `8212a30` and csbih-player `1bd4500`, on the owner's machine, with its data changed
one way at a time:

| Data | G1 | de_dust2 | de_inferno | de_nuke | de_train | Rounds with a plant |
|------|----|----------|------------|---------|----------|---------------------|
| All of it | 74.9% | 67.2% | 82.8% | 75.0% | 74.5% | 63.0% |
| No `out/profiles` | 65.8% | 75.5% | 71.4% | 60.9% | 55.2% | 72.4% |
| No 1.6 build of a level (`assets/levels16` away) | 70.4% | 67.2% | 70.8% | 69.3% | 74.5% | 66.1% |

- The row with no `out/profiles` is the first row of section 1 to the last digit: G1, each map and the plants. So
  the levels of the two machines are the same, and the profiles are the whole difference.
- The row with all the data is the 74.9% of the morning. The same seeds give the same rounds on any machine that
  has the same data.
- The reference bots are a harder enemy without their view field and their lineups: 65.8% against 74.9%.
- The third row shows a second thing that moves the number: the 1.6 builds of de_inferno and de_nuke.

What follows:

- The three rows of section 1 are right as runs against `ref-bare`, and they compare with each other.
- A run against `ref` needs `out/profiles` (roadmap, C1: a copy of `out` from the server, or
  `tools/build-profiles.js`). `tools/arena.js` can say at its start which data of a map it did not find.
- The 74.9% itself is the seeds 1 to 8. Over the seeds 1 to 32 the same commits give 71.2%
  (`2026-11-13-feet.md`, section 7), and one set of four seeds moves by 5 points and more. The fall of 3.2 points
  with the death is inside that: it needs 16 seeds or more for each side.
