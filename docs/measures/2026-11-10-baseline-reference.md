# Baseline: the reference bots against themselves (2026-11-10)

The bots of csbih-player (`src/shared/game/bot.js` at commit `fe89385`) with no route and no player's profile, on
both sides. They read the map's view field and lineups. This is the mark that fatalbot must pass (spec 01, section 4).

```sh
node tools/arena.js --a ref --b ref --maps de_dust2,de_inferno,de_nuke,de_train,de_aztec,de_cbble \
  --rounds 12 --seeds 1,2,3 --sides once
```

18 matches, 216 rounds, 43 s a round.

| Map | T rounds of 36 | Plants of 36 |
|-----|----------------|--------------|
| de_dust2 | 28 | 31 |
| de_inferno | 14 | 23 |
| de_nuke | 22 | 22 |
| de_train | 16 | 19 |
| de_aztec | 16 | 19 |
| de_cbble | 18 | 24 |

| Gate | Measure | Value |
|------|---------|-------|
| G2 | Rounds that the Ts win | 52.8% (de_dust2 alone: 78%) |
| G3 | Time facing a wall within 40 units, in spells of 1.5 s or more, out of a fight | 1.5% |
| G3 | Time that a bot wants to move and stays within 16 units, in spells of 1.5 s or more | 1.5% |
| G4 | Rounds with a plant | 63.9% |
| G4 | Round ends | elimination by the Ts 112, by the CTs 65, defuse 34, time 3, bomb 2 |
| G4 | Rounds that end on the clock with no kill | 0 |
| G5 | The bots' part of a tick, ten living bots | 0.199 ms |
| | A whole tick of the world | 0.185 ms (de_nuke 0.34 to 0.52 ms) |
| | Kills that are headshots | 62.3% |

Notes:

- The measures of G3 read the players from outside (`hosts/csbih/arena.js`): the view ray, the last command and the
  place. They are not the numbers of `tools/check-stuck.js` of csbih-player, which reads the goal of a bot.
- A round lasts 43 s: with no place of a player to hold first, the Ts go to the site of the round at once. Only 5
  of 216 rounds reach the clock or the bomb's timer.
- The headshot share is high because the arena gives each player a plain head box (as `check-stuck.js` does).
  It is the same for every kind of bot, so it does not move a comparison.
