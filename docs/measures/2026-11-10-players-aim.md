# The aim of the recorded players, with its spread, and fatalbot against it (2026-11-10)

Code: the commit of this document, against csbih-player at `fe89385`. The owner asked for the statistical errors of
real players before a bot's hand is changed. This is that measure, over every HLTV demo with a built level.

```sh
node tools/players.js            # the tables of section 1 (eight runs with --shard k/8 read the demos faster)
node tools/demo-arena.js --map <map> --count 6 --rounds 10     # fatalbot, measured the same way (section 2)
```

Summary:

- The players make 42.2% of their kills with a gun by a shot to the head, with an error of 0.3 points. The
  players differ widely: one in ten is under 28%, one in ten is over 59%.
- fatalbot makes 41 to 44% of its kills by a shot to the head, once the arena has the hit boxes of the player
  model. The 60% of the earlier measures came from the arena's own head box, which was larger than a head. The
  hand of the bot is not changed.
- Every aim measure of fatalbot lies inside the players' spread (p10 to p90). It fires its first shot later than
  the middle player, never earlier.
- What still differs: fatalbot pulls the crosshair down less in a long burst, it starts a burst a little lower,
  and its pistol kills go to the head less often than the players'.

How to read the tables:

- A player is one player of one demo, by its number in that demo. No name is read.
- "All kills" is every kill as one heap. "Its error" is the standard error of that number: the demos are drawn
  again 200 times (100 for an aim measure), each demo whole, and the number is made from each draw.
- "The players" is the spread of the players' own numbers: p50 is the middle player, p10 and p90 hold eight
  players of ten between them. A bot inside p10 to p90 plays as some real players do.
- A kill is measured from the first sight of the victim (a clear line inside the view) to the first shot, as
  `tools/aim-stats.js` of csbih-player does it. "Under the head" is the crosshair's height under the middle of
  the head, in units at the victim's distance; a number under zero is over the head.

## 1. The players

520 demos on 12 maps. A player is one player of one demo.
"All kills" is every kill as one heap, with the error of the number (the demos drawn again, 200 times).
"The players" is the spread of the players' own numbers (20 kills or more for the head share, 15 measured kills or
more for an aim measure).

### All kills with a gun (97265)

| Measure | All kills | its error | The players: p10 | p25 | p50 | p75 | p90 | players |
|---------|------|------|------|------|------|------|------|------|
| Kills with a shot to the head | 42.2% | 0.3% | 28.0% | 34.6% | 42.9% | 51.4% | 59.1% | 2155 |
| Crosshair error at the first sight, the middle (degrees) | 4.6 | 0.05 | 2.8 | 3.6 | 4.7 | 6.1 | 7.9 | 2437 |
| First sight to first shot, the middle (s) | 0.38 | 0.005 | 0.29 | 0.32 | 0.38 | 0.43 | 0.50 | 2437 |
| Peak turn before the shot, the middle (degrees a second) | 43 | 0.8 | 22 | 30 | 43 | 58 | 77 | 2437 |
| Crosshair error at the first shot, the middle (degrees) | 2.0 | 0.02 | 1.3 | 1.6 | 2.0 | 2.5 | 3.2 | 2437 |
| Crosshair under the head at the first shot, the middle (units) | 4 | 0.1 | -2 | 1 | 4 | 6 | 9 | 2437 |

Over every kill, p10 / p25 / p50 / p75 / p90: crosshair error at the first sight 1.0 / 2.0 / 4.6 / 10.7 / 23.5
degrees; first sight to first shot 0.12 / 0.25 / 0.38 / 0.59 / 0.91 s; peak turn before the shot 3 / 18 / 43 / 96 /
202 degrees a second; crosshair error at the first shot 0.6 / 1.0 / 2.0 / 4.1 / 8.9 degrees; crosshair under the head
at the first shot -19 / -6 / 4 / 12 / 25 units.

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

### By map (all kills with a gun)

| Map | Demos | Kills | To the head | its error | Crosshair error at the first sight | First sight to first shot | Peak turn before the shot | Crosshair error at the first shot | Crosshair under the head at the first shot |
|-----|------|------|------|------|------|------|------|------|------|
| de_dust2 | 152 | 29607 | 42.6% | 0.5% | 4.4 (0.08) | 0.39 (0.005) | 42 (1.5) | 1.9 (0.03) | 3 (0.2) |
| de_inferno | 150 | 28591 | 44.0% | 0.5% | 4.3 (0.09) | 0.36 (0.007) | 41 (1.2) | 2.0 (0.04) | 4 (0.2) |
| de_train | 84 | 17147 | 38.6% | 0.5% | 4.7 (0.08) | 0.40 (0.005) | 40 (1.8) | 1.8 (0.02) | 3 (0.2) |
| de_nuke | 84 | 14793 | 42.6% | 0.7% | 5.8 (0.12) | 0.38 (0.006) | 51 (1.6) | 2.2 (0.05) | 4 (0.2) |
| de_cbble | 18 | 2181 | 37.1% | 1.2% | 5.0 (0.15) | 0.40 (0.010) | 43 (2.9) | 2.2 (0.11) | 3 (0.5) |
| de_tuscan | 14 | 3181 | 46.4% | 1.8% | 3.9 (0.22) | 0.33 (0.019) | 44 (4.4) | 1.8 (0.04) | 4 (0.5) |
| de_aztec | 8 | 761 | 38.2% | 5.8% | 4.5 (0.46) | 0.40 (0.032) | 38 (4.1) | 1.8 (0.17) | 2 (0.9) |
| de_prodigy | 4 | 371 | 31.5% | 2.7% | 6.1 (6.95) | 0.38 (0.051) | 42 (7.0) | 2.8 (2.65) | 4 (1.5) |
| de_cpl_mill | 3 | 554 | 45.1% | 4.3% | 5.1 (0.22) | 0.35 (0.012) | 42 (0.3) | 2.2 (0.18) | 4 (0.4) |
| cs_havana | 1 | 47 | 51.1% | 0.0% | 12.4 (0.00) | 0.51 (0.000) | 76 (0.0) | 3.3 (0.00) | 4 (0.0) |
| de_chateau | 1 | 32 | 43.8% | 0.0% | 5.6 (0.00) | 0.49 (0.000) | 44 (0.0) | 2.6 (0.00) | 1 (0.0) |
| de_vegas | 1 | 0 | - | - | - (-) | - (-) | - (-) | - (-) | - (-) |


## 2. fatalbot against the players

fatalbot in the places of recorded players, with their weapons and their motor profiles, on the four maps of
docs/measures/2026-11-10-plans-and-feel.md, section 5 (1,440 kills). The bullets meet the hit boxes of the player
model.

| Measure | The players: all kills | their spread, p10 to p90 | fatalbot: de_dust2 | de_inferno | de_nuke | de_train |
|---------|------|------|------|------|------|------|
| Kills with a shot to the head | 42.2% | 28 to 59% | 41.2% | 40.9% | 43.9% | 42.5% |
| the same with a rifle | 41.7% | 29 to 60% | 47.6% | 46.2% | 45.3% | 47.3% |
| the same with a pistol | 57.3% | 48 to 70% | 38.9% | 34.8% | 46.9% | 34.5% |
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
own middles, so a map of fatalbot is held against it as one player.

What this says:

- **No measure says "aimbot".** The share of the head, the error at the first sight, the turn and the error at
  the first shot are all inside the spread of the players. The first shot comes 0.05 to 0.12 s later than the
  middle player's.
- **The burst.** A player pulls the crosshair down as the burst goes on: 4 units under the head at the first
  shot, 23 at shots 6 to 8, 34 at shots 9 to 12. fatalbot starts lower (7 to 10) and stops near 20. The players
  hold more of the recoil than the bot's profile does.
- **Pistols.** The players make 57% of their pistol kills by a shot to the head, fatalbot 35 to 47%.
- **Rifles.** fatalbot is 4 to 6 points over the players' share of the head, inside their spread.

## 3. The head box of the arena

Until this commit the arenas gave a bullet two boxes for a player, as the test tools of csbih-player do: a head box
of 12 by 12 by 14 units and a body box. The head of the player model is 12 by 7 by 12 units in the aim pose, and it
lies 9 units before the middle of the body. With the two boxes fatalbot made 59 to 63% of its kills by a shot to
the head, and the reference bots 58 to 71%. Now the arenas load the hit boxes of the player model of csbih-player
(`load.js loadBody`): the head, the chest, the stomach, the arms and the legs, in the aim pose of a rifle, standing
and ducked. The real game poses the boxes by the animation of the moment; the arenas do not.

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
  (the gate is 39 to 54%; the Ts of the demos win 37 to 58% by map). With the large head box a CT at its post
  won the first fight more often. With the head of the model a fight lasts longer, and the side that comes in
  numbers wins it. The CT side needs more than a post: a crossfire, a fall back, a retake together.
- The CTs of fatalbot lose rounds in the places of recorded CTs too: 133 of 240, where the two boxes gave 145.
- Rounds won against the reference bots stay inside the chance of the runs.

## 5. Next

1. The CT side with the hit boxes of the model (gate G2).
2. The burst: the pull of the crosshair down as the players pull it, from the recoil control of each profile.
3. Pistols: the aim point of a pistol nearer the head, as the players aim it.
4. The measures that are not taken yet, with the same spread and error: the strafes of a fight, the peeks, the
   hold of an angle, the jumps and the shots on the run of each player.
