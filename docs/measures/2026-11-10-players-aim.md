# The aim of the recorded players, with its spread, and fatalbot against it (2026-11-10)

Code: the commit of this document, against csbih-player at `fe89385`. The owner asked for the statistical errors of
real players before a bot's hand is changed. This is that measure, over every HLTV demo with a built level.

```sh
node tools/players.js            # the tables of section 1 (eight runs with --shard k/8 read the demos faster)
node tools/demo-arena.js --map <map> --count 6 --rounds 10     # fatalbot, measured the same way (section 2)
```

Summary:

- The players make 42.1% of their kills with a gun by a shot to the head, with an error of 0.3 points. The
  players differ widely: one in ten is under 27%, one in ten is over 59%.
- fatalbot makes 41 to 44% of its kills by a shot to the head, once the arena has the hit boxes of the player
  model. The 60% of the earlier measures came from the arena's own head box, which was larger than a head. The
  hand of the bot is not changed.
- The hand of fatalbot is not faster than a player's. For the same size of turn its turn is as fast as the
  players' or slower, at the middle and at p90, and its first shot comes later. It makes more large turns than
  the players, because its crosshair is further from the enemy at the first sight on three maps of four.
- Inside the players' spread (p10 to p90): the share of the head over all guns and with a rifle, the error at the
  first sight and at the first shot, the time to the first shot, the turn. Outside it: the share of the head with
  a pistol (too low) and with a sniper rifle (too high, on few kills).
- What else differs: fatalbot pulls the crosshair down less in a long burst, it starts a burst a little lower,
  and its first shot at an enemy near the crosshair is more exact than the middle player's.

How to read the tables:

- A player is one player of one demo, by its number in that demo. No name is read.
- "All kills" is every kill as one heap. "Its error" is the standard error of that number: the demos are drawn
  again 200 times (100 for an aim measure), each demo whole, and the number is made from each draw.
- "The players" is the spread of the players' own numbers: p50 is the middle player, p10 and p90 hold eight
  players of ten between them. A bot inside p10 to p90 plays as some real players do.
- A kill is measured from the first sight of the victim (a clear line inside the view) to the first shot, as
  `tools/aim-stats.js` of csbih-player does it. "Under the head" is the crosshair's height under the middle of
  the head, in units at the victim's distance; a number under zero is over the head.
- The kills are those of an enemy with a gun: 98,844 of the 112,615 kills of the demos. Left out: 4,687 with no
  killer or of the killer itself, 4,205 of a teammate, 2,737 with the knife, 2,142 with a grenade. Over all
  112,615 kills the share of the head is 39.7%.

## 1. The players

520 demos on 12 maps. A player is one player of one demo.
"All kills" is every kill as one heap, with the error of the number (the demos drawn again, 200 times).
"The players" is the spread of the players' own numbers (20 kills or more for the head share, 15 measured kills or
more for an aim measure).

### All kills with a gun (98844)

| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |
|---------|------|------|------|------|------|------|------|------|
| Kills with a shot to the head | 42.1% | 0.3% | 27.3% | 34.6% | 42.6% | 50.0% | 58.6% | 2221 |
| Crosshair error at the first sight, the middle (degrees) | 4.6 | 0.06 | 2.9 | 3.6 | 4.7 | 6.2 | 7.9 | 2516 |
| First sight to first shot, the middle (s) | 0.38 | 0.004 | 0.29 | 0.32 | 0.38 | 0.43 | 0.50 | 2516 |
| Peak turn before the shot, the middle (degrees a second) | 43 | 0.8 | 22 | 30 | 44 | 58 | 77 | 2516 |
| Crosshair error at the first shot, the middle (degrees) | 2.0 | 0.02 | 1.3 | 1.6 | 2.0 | 2.5 | 3.3 | 2516 |
| Crosshair under the head at the first shot, the middle (units) | 4 | 0.1 | -2 | 1 | 4 | 6 | 9 | 2516 |

Over every kill, p10 / p25 / p50 / p75 / p90: crosshair error at the first sight 1.0 / 2.0 / 4.6 / 10.8 / 23.6
degrees; first sight to first shot 0.12 / 0.25 / 0.38 / 0.59 / 0.91 s; peak turn before the shot 3 / 18 / 43 / 96 /
203 degrees a second; crosshair error at the first shot 0.6 / 1.1 / 2.0 / 4.1 / 8.9 degrees; crosshair under the head
at the first shot -19 / -6 / 4 / 13 / 25 units.

### Kills with a rifle (68840)

| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |
|---------|------|------|------|------|------|------|------|------|
| Kills with a shot to the head | 41.7% | 0.3% | 28.6% | 35.0% | 43.5% | 52.2% | 60.0% | 1071 |
| Crosshair error at the first sight, the middle (degrees) | 4.7 | 0.06 | 2.8 | 3.5 | 4.7 | 6.1 | 7.9 | 1382 |
| First sight to first shot, the middle (s) | 0.38 | 0.005 | 0.29 | 0.30 | 0.37 | 0.41 | 0.49 | 1382 |
| Peak turn before the shot, the middle (degrees a second) | 42 | 0.9 | 20 | 28 | 40 | 56 | 74 | 1382 |
| Crosshair error at the first shot, the middle (degrees) | 2.0 | 0.02 | 1.3 | 1.6 | 2.0 | 2.5 | 3.2 | 1382 |
| Crosshair under the head at the first shot, the middle (units) | 4 | 0.1 | -1 | 2 | 5 | 7 | 10 | 1382 |

Over every kill, p10 / p25 / p50 / p75 / p90: crosshair error at the first sight 1.0 / 2.1 / 4.7 / 10.9 / 24.1
degrees; first sight to first shot 0.10 / 0.25 / 0.38 / 0.57 / 0.89 s; peak turn before the shot 2 / 17 / 42 / 95 /
204 degrees a second; crosshair error at the first shot 0.6 / 1.0 / 2.0 / 4.2 / 9.1 degrees; crosshair under the head
at the first shot -16 / -5 / 4 / 13 / 26 units.

### Kills with a pistol (19687)

| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |
|---------|------|------|------|------|------|------|------|------|
| Kills with a shot to the head | 57.3% | 0.4% | 48.0% | 52.4% | 65.2% | 66.7% | 69.6% | 12 |
| Crosshair error at the first sight, the middle (degrees) | 5.6 | 0.07 | 3.8 | 4.5 | 7.7 | 9.8 | 13.6 | 17 |
| First sight to first shot, the middle (s) | 0.38 | 0.004 | 0.29 | 0.35 | 0.42 | 0.45 | 0.49 | 17 |
| Peak turn before the shot, the middle (degrees a second) | 55 | 1.0 | 22 | 47 | 60 | 69 | 90 | 17 |
| Crosshair error at the first shot, the middle (degrees) | 2.4 | 0.03 | 1.3 | 1.9 | 2.3 | 2.6 | 6.5 | 17 |
| Crosshair under the head at the first shot, the middle (units) | 1 | 0.2 | -4 | -2 | 1 | 3 | 7 | 17 |

Over every kill, p10 / p25 / p50 / p75 / p90: crosshair error at the first sight 1.2 / 2.5 / 5.6 / 12.3 / 25.2
degrees; first sight to first shot 0.14 / 0.26 / 0.38 / 0.60 / 0.96 s; peak turn before the shot 7 / 26 / 55 / 114 /
223 degrees a second; crosshair error at the first shot 0.7 / 1.3 / 2.4 / 4.8 / 10.0 degrees; crosshair under the head
at the first shot -22 / -9 / 1 / 9 / 20 units.

### Kills with a sniper (8605)

| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |
|---------|------|------|------|------|------|------|------|------|
| Kills with a shot to the head | 12.2% | 0.3% | 4.5% | 5.0% | 11.1% | 15.4% | 18.8% | 32 |
| Crosshair error at the first sight, the middle (degrees) | 2.0 | 0.04 | 1.5 | 1.9 | 2.7 | 4.4 | 5.1 | 20 |
| First sight to first shot, the middle (s) | 0.45 | 0.013 | 0.35 | 0.40 | 0.50 | 0.65 | 0.80 | 20 |
| Peak turn before the shot, the middle (degrees a second) | 30 | 0.8 | 17 | 22 | 29 | 40 | 57 | 20 |
| Crosshair error at the first shot, the middle (degrees) | 1.3 | 0.01 | 1.2 | 1.3 | 1.4 | 1.5 | 1.7 | 20 |
| Crosshair under the head at the first shot, the middle (units) | -2 | 0.7 | -13 | -8 | -4 | 4 | 8 | 20 |

Over every kill, p10 / p25 / p50 / p75 / p90: crosshair error at the first sight 0.6 / 1.0 / 2.0 / 4.8 / 11.2 degrees;
first sight to first shot 0.20 / 0.30 / 0.45 / 0.70 / 1.00 s; peak turn before the shot 4 / 14 / 30 / 52 / 100 degrees
a second; crosshair error at the first shot 0.4 / 0.8 / 1.3 / 1.9 / 3.2 degrees; crosshair under the head at the first
shot -39 / -22 / -2 / 11 / 20 units.

### The shots of a kill with a rifle, by their number (64214 kills)

The crosshair against the middle of the victim's head at each shot of the killer in the last 2 s before the kill.

| Shot | Shots | Under the head: the middle (units) | its error | p10 | p25 | p75 | p90 | To the side: the middle | p90 | Error: the middle (degrees) | p90 |
|------|------|------|------|------|------|------|------|------|------|------|------|
| Shot 1 | 64214 | 4.5 | 0.14 | -16 | -5 | 14 | 27 | 13.2 | 56 | 2.04 | 8.3 |
| Shot 2 | 54133 | 6.2 | 0.12 | -14 | -3 | 16 | 29 | 11.5 | 49 | 2.02 | 7.4 |
| Shot 3 | 44849 | 9.5 | 0.15 | -12 | -1 | 21 | 34 | 10.7 | 46 | 2.19 | 7.2 |
| Shots 4 and 5 | 65620 | 13.4 | 0.16 | -11 | 2 | 27 | 42 | 10.1 | 42 | 2.46 | 7.1 |
| Shots 6 to 8 | 53011 | 23.0 | 0.25 | -5 | 9 | 38 | 54 | 10.2 | 39 | 3.19 | 7.3 |
| Shots 9 to 12 | 28755 | 33.8 | 0.32 | 7 | 20 | 49 | 66 | 10.8 | 39 | 3.86 | 7.7 |

Shots of a kill: 4 in the middle, 10 at p90.

### The shots of a kill with a pistol, by their number (18144 kills)

The crosshair against the middle of the victim's head at each shot of the killer in the last 2 s before the kill.

| Shot | Shots | Under the head: the middle (units) | its error | p10 | p25 | p75 | p90 | To the side: the middle | p90 | Error: the middle (degrees) | p90 |
|------|------|------|------|------|------|------|------|------|------|------|------|
| Shot 1 | 18144 | 1.2 | 0.15 | -22 | -9 | 9 | 19 | 11.9 | 47 | 2.30 | 8.2 |
| Shot 2 | 14644 | 1.6 | 0.14 | -20 | -8 | 9 | 18 | 8.9 | 37 | 1.97 | 6.9 |
| Shot 3 | 11148 | 2.0 | 0.18 | -20 | -8 | 9 | 19 | 7.7 | 32 | 1.85 | 6.5 |
| Shots 4 and 5 | 13593 | 3.1 | 0.17 | -19 | -7 | 11 | 22 | 6.4 | 26 | 1.77 | 6.2 |
| Shots 6 to 8 | 7790 | 5.6 | 0.21 | -14 | -3 | 14 | 27 | 6.0 | 24 | 1.82 | 6.2 |
| Shots 9 to 12 | 2267 | 7.9 | 0.40 | -8 | 1 | 18 | 30 | 6.3 | 25 | 2.08 | 6.3 |

Shots of a kill: 3 in the middle, 7 at p90.

### The shots of a kill with a sniper, by their number (7174 kills)

The crosshair against the middle of the victim's head at each shot of the killer in the last 2 s before the kill.

| Shot | Shots | Under the head: the middle (units) | its error | p10 | p25 | p75 | p90 | To the side: the middle | p90 | Error: the middle (degrees) | p90 |
|------|------|------|------|------|------|------|------|------|------|------|------|
| Shot 1 | 7174 | -1.9 | 0.66 | -39 | -22 | 11 | 20 | 8.6 | 33 | 1.27 | 3.2 |
| Shot 2 | 392 | 1.7 | 1.58 | -26 | -14 | 12 | 22 | 8.3 | 31 | 1.19 | 3.7 |
| Shot 3 | 45 | 10.5 | 3.48 | -15 | -0 | 19 | 30 | 10.2 | 48 | 1.45 | 5.7 |
| Shots 4 and 5 | 42 | 8.4 | 2.28 | -20 | -3 | 13 | 26 | 11.2 | 75 | 1.54 | 5.3 |
| Shots 6 to 8 | 25 | 1.9 | 6.89 | -36 | -7 | 11 | 24 | 12.6 | 75 | 1.49 | 5.0 |
| Shots 9 to 12 | 1 | -7.7 | 0.00 | -8 | -8 | -8 | -8 | 16.0 | 16 | 1.05 | 1.1 |

Shots of a kill: 1 in the middle, 1 at p90.

### The hand by the crosshair error at the first sight (80023 kills)

| Error at the first sight (degrees) | Kills | Share | First sight to first shot: p10 | p50 | p90 (s) | Peak turn: p50 | p90 (degrees a second) | Error at the first shot: p10 | p50 | p90 (degrees) |
|------|------|------|------|------|------|------|------|------|------|------|
| Under 10 | 58431 | 73.0% | 0.10 | 0.35 | 0.80 | 32 | 101 | 0.5 | 1.7 | 5.9 |
| 10 to 40 | 18102 | 22.6% | 0.17 | 0.47 | 1.06 | 115 | 307 | 0.8 | 3.4 | 18.2 |
| Over 40 | 3490 | 4.4% | 0.21 | 0.69 | 1.25 | 302 | 630 | 0.8 | 4.0 | 45.8 |

### By map (all kills with a gun)

| Map | Demos | Kills | To the head | its error | Crosshair error at the first sight | First sight to first shot | Peak turn before the shot | Crosshair error at the first shot | Crosshair under the head at the first shot |
|-----|------|------|------|------|------|------|------|------|------|
| de_dust2 | 152 | 30085 | 42.4% | 0.5% | 4.5 (0.08) | 0.39 (0.005) | 43 (1.5) | 1.9 (0.03) | 3 (0.2) |
| de_inferno | 150 | 29166 | 43.8% | 0.5% | 4.4 (0.09) | 0.36 (0.007) | 42 (1.2) | 2.0 (0.04) | 4 (0.2) |
| de_train | 84 | 17281 | 38.5% | 0.5% | 4.7 (0.08) | 0.40 (0.005) | 40 (1.8) | 1.8 (0.02) | 3 (0.2) |
| de_nuke | 84 | 15027 | 42.6% | 0.7% | 5.8 (0.13) | 0.38 (0.006) | 51 (1.6) | 2.2 (0.05) | 4 (0.2) |
| de_cbble | 18 | 2259 | 37.0% | 1.2% | 5.0 (0.15) | 0.40 (0.011) | 43 (2.9) | 2.2 (0.10) | 3 (0.5) |
| de_tuscan | 14 | 3182 | 46.4% | 1.8% | 3.9 (0.22) | 0.33 (0.019) | 44 (4.4) | 1.8 (0.04) | 4 (0.5) |
| de_aztec | 8 | 790 | 38.0% | 5.7% | 4.6 (0.43) | 0.40 (0.033) | 38 (4.0) | 1.8 (0.18) | 2 (0.9) |
| de_prodigy | 4 | 408 | 31.9% | 2.7% | 6.2 (6.94) | 0.37 (0.052) | 43 (6.8) | 2.9 (2.64) | 4 (1.5) |
| de_cpl_mill | 3 | 567 | 44.8% | 4.0% | 5.1 (0.16) | 0.36 (0.011) | 42 (1.2) | 2.3 (0.17) | 4 (0.4) |
| cs_havana | 1 | 47 | 51.1% | 0.0% | 12.4 (0.00) | 0.51 (0.000) | 76 (0.0) | 3.3 (0.00) | 4 (0.0) |
| de_chateau | 1 | 32 | 43.8% | 0.0% | 5.6 (0.00) | 0.49 (0.000) | 44 (0.0) | 2.6 (0.00) | 1 (0.0) |
| de_vegas | 1 | 0 | - | - | - (-) | - (-) | - (-) | - (-) | - (-) |


## 2. fatalbot against the players

fatalbot in the places of recorded players, with their weapons and their motor profiles, on the four maps of
docs/measures/2026-11-10-plans-and-feel.md, section 5 (1,440 measured kills). The bullets meet the hit boxes of
the player model.

| Measure | The players: all kills | their spread, p10 to p90 | fatalbot: de_dust2 | de_inferno | de_nuke | de_train |
|---------|------|------|------|------|------|------|
| Kills with a shot to the head | 42.1% | 27 to 59% | 41.2% | 40.9% | 43.9% | 42.5% |
| the same with a rifle | 41.7% | 29 to 60% | 47.6% | 46.2% | 45.3% | 47.3% |
| the same with a pistol | 57.3% | 48 to 70% | 38.9% | 34.8% | 46.9% | 34.5% |
| the same with a sniper rifle | 12.2% | 5 to 19% | 19.1% | 16.1% | too few | 25.0% |
| Crosshair error at the first sight (degrees) | 4.6 | 2.8 to 7.9 | 6.7 | 3.8 | 5.3 | 6.5 |
| First sight to first shot (s) | 0.38 | 0.29 to 0.50 | 0.50 | 0.43 | 0.45 | 0.48 |
| Peak turn before the shot (degrees a second) | 43 | 22 to 77 | 64 | 46 | 59 | 71 |
| Crosshair error at the first shot (degrees) | 2.0 | 1.3 to 3.2 | 1.6 | 1.4 | 1.7 | 1.9 |
| Under the head at shot 1 of a rifle (units) | 4.5 | -1 to 10 | 9.6 | 7.7 | 7.1 | 9.6 |
| at shot 3 | 9.5 | | 13.5 | 12.7 | 12.2 | 12.4 |
| at shots 4 and 5 | 13.4 | | 14.9 | 14.9 | 13.0 | 14.9 |
| at shots 6 to 8 | 23.0 | | 18.6 | 14.4 | 18.8 | 20.5 |
| at shots 9 to 12 | 33.8 | | 19.5 | 13.5 | 20.2 | 21.6 |

The numbers of fatalbot are the middle of its kills on each map. The spread of the players is that of the players'
own middles, so a map of fatalbot is held against it as one player. The pistol kills of fatalbot are 58 to 113 on
a map, its sniper kills 31 to 47.

The hand by the size of the turn. A hand that is too fast shows in the tails, so the kills are told apart by the
crosshair error at the first sight (the players' rows are those of section 1):

| Error at the first sight | Who | Share of the kills | First sight to first shot: p10 / p50 / p90 (s) | Peak turn: p50 / p90 (degrees a second) | Error at the first shot: p10 / p50 / p90 (degrees) |
|------|------|------|------|------|------|
| Under 10 degrees | the players | 73% | 0.10 / 0.35 / 0.80 | 32 / 101 | 0.5 / 1.7 / 5.9 |
| | fatalbot, de_dust2 | 60% | 0.22 / 0.44 / 0.82 | 37 / 91 | 0.4 / 1.2 / 4.1 |
| | de_inferno | 75% | 0.25 / 0.40 / 0.60 | 35 / 77 | 0.5 / 1.3 / 3.4 |
| | de_nuke | 62% | 0.20 / 0.40 / 0.70 | 31 / 102 | 0.3 / 1.1 / 4.2 |
| | de_train | 61% | 0.11 / 0.40 / 0.65 | 44 / 105 | 0.5 / 1.4 / 4.3 |
| 10 to 40 degrees | the players | 23% | 0.17 / 0.47 / 1.06 | 115 / 307 | 0.8 / 3.4 / 18.2 |
| | fatalbot, de_dust2 | 32% | 0.34 / 0.64 / 1.01 | 134 / 262 | 0.8 / 2.6 / 10.9 |
| | de_inferno | 21% | 0.30 / 0.57 / 1.14 | 124 / 251 | 0.5 / 2.3 / 13.2 |
| | de_nuke | 29% | 0.32 / 0.68 / 1.07 | 144 / 262 | 1.1 / 2.8 / 14.5 |
| | de_train | 31% | 0.33 / 0.69 / 1.18 | 137 / 309 | 0.8 / 3.1 / 10.5 |
| Over 40 degrees | the players | 4% | 0.21 / 0.69 / 1.25 | 302 / 630 | 0.8 / 4.0 / 45.8 |
| | fatalbot, de_dust2 | 9% | 0.12 / 0.98 / 1.38 | 277 / 489 | 1.1 / 3.5 / 12.0 |
| | de_inferno | 4% | 0.13 / 0.65 / 1.34 | 324 / 505 | 1.1 / 6.7 / 59.5 |
| | de_nuke | 9% | 0.20 / 0.65 / 1.26 | 364 / 561 | 1.5 / 4.9 / 55.5 |
| | de_train | 8% | 0.35 / 0.72 / 1.45 | 328 / 444 | 1.2 / 4.9 / 30.3 |

What this says:

- **The turn.** For the same size of turn the peak turn of fatalbot is near the players' at the middle and at or
  under theirs at p90. Its peak turn over all kills is higher at p90 (239 to 274 degrees a second on three maps,
  where the players have 202) because it makes more large turns: 8 to 9% of its kills start over 40 degrees off
  on three maps, the players' 4%. That is crosshair placement, not the speed of the hand. The angles where
  enemies appear in the demos are not used yet.
- **The first shot.** It comes later than the players' at the middle of every step. Its fastest tenth is not
  faster than the players' fastest tenth at a small error (0.11 to 0.25 s against 0.10 s). The rows over 40
  degrees have 15 to 33 kills a map: too few for a p10.
- **The exactness of the first shot.** At an enemy near the crosshair fatalbot fires 1.1 to 1.4 degrees off, the
  middle player 1.7; its p90 is 3.4 to 4.3, the players' 5.9. The bot waits for a better aim than a player does.
  This is the one place where its hand is better than the middle player, and it is inside the spread of the
  players (1.3 to 3.2 over all kills).
- **The burst.** A player pulls the crosshair down as the burst goes on: 4 units under the head at the first
  shot, 23 at shots 6 to 8, 34 at shots 9 to 12. fatalbot starts lower (7 to 10) and stops near 20. The measure
  was checked: the players alone through the gauge of the arena give 5.6, 13.7 and 31.4 on de_dust2 (217 kills).
- **Pistols and sniper rifles.** The players make 57% of their pistol kills by a shot to the head, fatalbot 35 to
  47%: under the players' p10. With a sniper rifle fatalbot is over the players' p90 on two maps of three, on few
  kills.
- **Rifles.** fatalbot is 4 to 6 points over the players' share of the head, inside their spread.

## 3. The head box of the arena, and the two numbers of the players

Until commit `9c1d449` the arenas gave a bullet two boxes for a player, as the test tools of csbih-player do: a
head box of 12 by 12 by 14 units and a body box. The head of the player model is 12 by 7 by 12 units in the aim
pose, and it lies 9 units before the middle of the body. With the two boxes fatalbot made 59 to 63% of its kills by
a shot to the head, and the reference bots 58 to 71%. Now the arenas load the hit boxes of the player model of
csbih-player (`load.js loadBody`): the head, the chest, the stomach, the arms and the legs, in the aim pose of a
rifle, standing and ducked. The real game poses the boxes by the animation of the moment; the arenas do not.

The earlier document gave 33 to 39% for the players, and this one gives 42.1%. Both are right for what they
count. The earlier number was over all kills of 24 demos (knife, grenade and teammates too): 37.4% over those
demos together. The kills of an enemy with a gun in the same 24 demos give 39.9%, and in all 520 demos 42.1%.
fatalbot ran with the profiles of those 24 demos, so like for like it is 41 to 44% against 39.9%.

A first trial moved the aim point of fatalbot down until the share fell to 35 to 40% with the two boxes. That
change is not made: it tuned the hand to a fault of the arena.

All rounds won of the earlier documents were played with the two boxes. Section 4 has the gates with the hit
boxes of the model.

## 4. The gates with the hit boxes of the model

The commands are those of docs/measures/2026-11-10-plans-and-feel.md. "Two boxes" is commit `933884d`.

| Measure | Two boxes | The hit boxes of the model |
|---------|-----------|----------------------------|
| `fatal` against the reference bots, 192 rounds | 72.4% | 69.3% |
| `fatal-plans` against the reference bots, 192 rounds | 76.6% | 71.9% |
| `fatal-plans` against `fatal`, 192 rounds | 48.4% | 50.5% |
| `fatal` against itself, 432 rounds: the Ts win | 41.7% | 58.6% |
| `fatal-plans` against itself, 432 rounds: the Ts win | 42.8% | 60.6% |
| A round of `fatal` against itself lasts | 39 s | 45 s |
| `fatal` in the places of recorded Ts, 240 rounds | 159 | 157 |
| `fatal` in the places of recorded CTs, 240 rounds | 145 | 133 |
| `fatal-plans` in the places of recorded Ts, 240 rounds | 164 | 158 |
| `fatal-plans` in the places of recorded CTs, 240 rounds | 140 | 124 |
| `fatal` at a wall and stuck, against the reference bots | 0.3% and 0.5% | 0.6% and 0.5% |
| Kills with a shot to the head, against the reference bots: `fatal` and the reference bots | 60.2% and 66.9% | 43.6% and 41.0% |

- **Gate G2 is not met with the hit boxes of the model.** Against itself the Ts of fatalbot win 59% of the rounds
  (the gate is 39 to 54%; the Ts of the demos win 37 to 58% by map). The cause is not measured. A guess: with the
  large head box a CT at its post won the first fight more often, and with the head of the model a fight lasts
  longer (a round lasts 45 s, 39 s before), so the side that comes in numbers wins it. The first test of the
  guess: the share of the first fights that a CT at its post wins, with each body.
- The CTs of fatalbot lose rounds in the places of recorded CTs too: 133 of 240, where the two boxes gave 145.
- Rounds won against the reference bots stay inside the chance of the runs.

## 5. Next

1. The CT side with the hit boxes of the model (gate G2): first the cause, then the change.
2. Crosshair placement: the angles where enemies appear in the demos, to make fewer large turns.
3. The burst: the pull of the crosshair down as the players pull it, from the recoil control of each profile.
4. Pistols and sniper rifles: the aim point of each as the players aim it. The first shot: fired as early, and
   as far off, as the players fire it.
5. The measures that are not taken yet, with the same spread and error: the strafes of a fight, the peeks, the
   hold of an angle, the jumps and the shots on the run of each player.
