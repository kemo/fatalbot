# The strategies of the recorded matches

Made by `node tools/strategies.js --report docs/strategies.md` from every HLTV demo of csbih-player on a map with a
built level. The numbers name no player and no team.

A formation is the places of the five players of a side at one second of a round: the Ts at second 20, the CTs at
second 15. Formations that lie within 600 units of each other on average, player for player, are one strategy.
The tool also draws every strategy on the floor of its map: `out/strategies/report.html` (not in the repository).

Tempo: the second that the first T stood in the site. Fast to 25 s, mid to 50 s, late after.

## de_dust2

152 demos, 3426 rounds of five against five. The Ts won 58%. In 30% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| B | 31% | 68% | 76% | 30 s |
| A | 39% | 71% | 62% | 40 s |

Tempo: fast 713 rounds (Ts won 71%); mid 1000 rounds (Ts won 75%); late 696 rounds (Ts won 60%).

Buys, the Ts' against the CTs': full against full 1273 rounds (Ts won 52%); full against force 603 rounds (Ts won 73%); full against pistol 404 rounds (Ts won 97%); pistol against pistol 308 rounds (Ts won 50%); force against full 227 rounds (Ts won 31%); force against pistol 178 rounds (Ts won 93%); force against force 147 rounds (Ts won 59%); pistol against force 146 rounds (Ts won 12%); pistol against full 140 rounds (Ts won 3%).

The Ts at second 20 (all five alive in 59% of the rounds): 131 formations, 22 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 98 | 5% | 61% | B 22%, A 49% | 62 s | 49% |
| 5 between | 84 | 4% | 55% | B 12%, A 55% | 50 s | 49% |
| 5 between | 75 | 4% | 43% | A 67% | 46 s | 51% |
| 5 between | 75 | 4% | 64% | B 17%, A 68% | 54 s | 60% |
| 5 between | 70 | 3% | 51% | B 24%, A 43% | 72 s | 44% |
| 4 at B, 1 between | 67 | 3% | 84% | B 100% | 16 s | 97% |
| 5 between | 63 | 3% | 60% | B 59%, A 24% | 48 s | 57% |
| 5 between | 60 | 3% | 78% | B 20%, A 57% | 54 s | 53% |
| 5 between | 59 | 3% | 47% | B 66%, A 10% | 40 s | 56% |
| 5 between | 55 | 3% | 64% | B 38%, A 33% | 64 s | 60% |
| 5 between | 50 | 2% | 62% | B 24%, A 48% | 44 s | 52% |
| 5 between | 47 | 2% | 51% | B 68% | 40 s | 64% |

The CTs at second 15 (all five alive in 68% of the rounds): 125 formations, 21 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 2 at B, 2 near the CT spawn, 1 at A | 129 | 6% | 52% |
| 2 near the CT spawn, 1 between, 1 at A, 1 at B | 96 | 4% | 51% |
| 2 at B, 1 at A, 1 near the CT spawn, 1 between | 86 | 4% | 49% |
| 2 at B, 2 at A, 1 near the CT spawn | 83 | 4% | 65% |
| 2 near the CT spawn, 1 at B, 1 at A, 1 between | 83 | 4% | 59% |
| 2 at B, 2 between, 1 near the CT spawn | 81 | 3% | 48% |
| 2 near the CT spawn, 2 at A, 1 at B | 78 | 3% | 46% |
| 3 near the CT spawn, 1 at A, 1 at B | 73 | 3% | 48% |
| 2 between, 2 at A, 1 at B | 66 | 3% | 52% |
| 3 at A, 2 at B | 62 | 3% | 56% |

## de_inferno

150 demos, 3426 rounds of five against five. The Ts won 50%. In 31% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| A | 42% | 63% | 61% | 40 s |
| B | 27% | 61% | 74% | 42 s |

Tempo: fast 555 rounds (Ts won 56%); mid 1014 rounds (Ts won 70%); late 800 rounds (Ts won 55%).

Buys, the Ts' against the CTs': full against full 1339 rounds (Ts won 46%); full against force 469 rounds (Ts won 64%); full against pistol 330 rounds (Ts won 95%); force against full 303 rounds (Ts won 29%); pistol against pistol 285 rounds (Ts won 48%); pistol against full 229 rounds (Ts won 1%); force against pistol 167 rounds (Ts won 90%); force against force 160 rounds (Ts won 55%); pistol against force 144 rounds (Ts won 9%).

The Ts at second 20 (all five alive in 65% of the rounds): 69 formations, 24 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 222 | 10% | 55% | A 66%, B 16% | 48 s | 50% |
| 5 between | 160 | 7% | 59% | A 54%, B 26% | 60 s | 51% |
| 5 between | 149 | 7% | 62% | A 53%, B 28% | 44 s | 60% |
| 5 between | 132 | 6% | 43% | A 50%, B 25% | 58 s | 43% |
| 5 between | 108 | 5% | 46% | A 71% | 36 s | 50% |
| 5 between | 89 | 4% | 65% | A 20%, B 63% | 48 s | 62% |
| 5 between | 89 | 4% | 51% | A 60%, B 10% | 52 s | 45% |
| 5 between | 77 | 3% | 58% | A 77% | 24 s | 58% |
| 4 between, 1 near the T spawn | 76 | 3% | 50% | A 37%, B 32% | 64 s | 49% |
| 5 between | 70 | 3% | 39% | A 54%, B 10% | 48 s | 39% |
| 5 between | 67 | 3% | 69% | A 46%, B 36% | 58 s | 60% |
| 5 between | 65 | 3% | 71% | A 57%, B 20% | 30 s | 51% |

The CTs at second 15 (all five alive in 82% of the rounds): 83 formations, 22 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 2 between, 2 at A, 1 at B | 209 | 7% | 54% |
| 2 at B, 2 between, 1 at A | 164 | 6% | 57% |
| 2 at A, 2 at B, 1 between | 159 | 6% | 57% |
| 3 at A, 2 at B | 154 | 5% | 60% |
| 2 at A, 2 between, 1 at B | 152 | 5% | 60% |
| 3 at A, 1 at B, 1 between | 88 | 3% | 57% |
| 3 at A, 1 between, 1 at B | 86 | 3% | 58% |
| 2 at A, 2 between, 1 at B | 83 | 3% | 71% |
| 2 at A, 2 between, 1 at B | 83 | 3% | 57% |
| 3 at A, 1 between, 1 at B | 82 | 3% | 59% |

## de_train

84 demos, 2069 rounds of five against five. The Ts won 44%. In 41% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 32% | 69% | 64% | 34 s |
| site 2 | 27% | 57% | 75% | 34 s |

Tempo: fast 307 rounds (Ts won 59%); mid 601 rounds (Ts won 69%); late 315 rounds (Ts won 57%).

Buys, the Ts' against the CTs': full against full 836 rounds (Ts won 40%); full against force 256 rounds (Ts won 61%); full against pistol 216 rounds (Ts won 99%); pistol against full 183 rounds (Ts won 2%); pistol against pistol 176 rounds (Ts won 44%); force against full 160 rounds (Ts won 24%); pistol against force 110 rounds (Ts won 1%); force against pistol 68 rounds (Ts won 96%); force against force 64 rounds (Ts won 44%).

The Ts at second 20 (all five alive in 54% of the rounds): 59 formations, 25 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 105 | 9% | 48% | site 2 64% | 36 s | 54% |
| 5 between | 92 | 8% | 55% | site 1 23%, site 2 52% | 46 s | 55% |
| 5 between | 76 | 7% | 41% | site 1 37%, site 2 18% | 66 s | 39% |
| 5 between | 52 | 5% | 44% | site 1 48% | 54 s | 40% |
| 5 between | 51 | 5% | 45% | site 2 80% | 26 s | 55% |
| 5 between | 42 | 4% | 83% | site 1 83% | 26 s | 67% |
| 5 between | 42 | 4% | 64% | site 1 24%, site 2 43% | 54 s | 60% |
| 5 between | 41 | 4% | 49% | site 1 22%, site 2 54% | 40 s | 61% |
| 5 between | 39 | 4% | 49% | site 1 23%, site 2 36% | 76 s | 36% |
| 5 between | 37 | 3% | 51% | site 1 27%, site 2 43% | 58 s | 54% |
| 5 between | 33 | 3% | 61% | site 1 64% | 38 s | 45% |
| 5 between | 32 | 3% | 84% | site 1 66% | 26 s | 53% |

The CTs at second 15 (all five alive in 75% of the rounds): 73 formations, 23 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 3 between, 1 at site 2, 1 at site 1 | 94 | 6% | 67% |
| 3 between, 1 at site 2, 1 at site 1 | 90 | 6% | 60% |
| 2 at site 1, 2 between, 1 at site 2 | 74 | 5% | 70% |
| 3 between, 1 at site 1, 1 at site 2 | 69 | 4% | 59% |
| 2 at site 1, 2 between, 1 at site 2 | 63 | 4% | 65% |
| 3 at site 1, 1 between, 1 at site 2 | 62 | 4% | 66% |
| 2 at site 2, 2 at site 1, 1 between | 60 | 4% | 67% |
| 4 between, 1 at site 2 | 60 | 4% | 67% |
| 5 between | 58 | 4% | 57% |
| 3 between, 2 at site 1 | 54 | 3% | 67% |

## de_nuke

84 demos, 1856 rounds of five against five. The Ts won 46%. In 15% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| A | 53% | 37% | 15% | 18 s |
| B | 32% | 74% | 92% | 42 s |

Tempo: fast 768 rounds (Ts won 38%); mid 518 rounds (Ts won 64%); late 289 rounds (Ts won 62%).

Buys, the Ts' against the CTs': full against full 747 rounds (Ts won 43%); full against force 250 rounds (Ts won 58%); full against pistol 183 rounds (Ts won 98%); pistol against pistol 164 rounds (Ts won 45%); pistol against full 142 rounds (Ts won 1%); force against full 134 rounds (Ts won 29%); pistol against force 109 rounds (Ts won 9%); force against pistol 74 rounds (Ts won 92%); force against force 53 rounds (Ts won 43%).

The Ts at second 20 (all five alive in 61% of the rounds): 30 formations, 14 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 3 at A, 2 between | 224 | 20% | 50% | A 60%, B 33% | 18 s | 41% |
| 3 between, 2 at A | 160 | 14% | 54% | A 53%, B 40% | 20 s | 46% |
| 5 between | 107 | 9% | 42% | A 59%, B 31% | 30 s | 39% |
| 4 between, 1 at A | 100 | 9% | 64% | A 50%, B 36% | 20 s | 43% |
| 4 at A, 1 between | 92 | 8% | 74% | A 29%, B 71% | 24 s | 85% |
| 4 between, 1 at A | 82 | 7% | 51% | A 61%, B 27% | 24 s | 30% |
| 5 between | 53 | 5% | 45% | A 47%, B 40% | 36 s | 45% |
| 3 between, 2 at A | 47 | 4% | 77% | A 45%, B 49% | 36 s | 55% |
| 5 between | 44 | 4% | 59% | A 61%, B 34% | 30 s | 41% |
| 5 between | 37 | 3% | 35% | A 30%, B 27% | 34 s | 27% |
| 5 between | 32 | 3% | 53% | A 50%, B 22% | 30 s | 22% |
| 5 between | 26 | 2% | 50% | A 73%, B 23% | 16 s | 35% |

The CTs at second 15 (all five alive in 85% of the rounds): 29 formations, 14 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 3 between, 2 at A | 239 | 15% | 72% |
| 4 between, 1 at A | 208 | 13% | 61% |
| 3 between, 2 at A | 203 | 13% | 57% |
| 4 between, 1 at A | 172 | 11% | 64% |
| 3 between, 2 at A | 125 | 8% | 58% |
| 4 between, 1 at A | 105 | 7% | 46% |
| 4 between, 1 at A | 98 | 6% | 59% |
| 4 between, 1 at A | 69 | 4% | 58% |
| 4 at A, 1 between | 54 | 3% | 50% |
| 4 between, 1 at A | 53 | 3% | 34% |

## de_cbble

18 demos, 303 rounds of five against five. The Ts won 37%. In 56% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 20% | 70% | 80% | 66 s |
| site 2 | 24% | 72% | 72% | 38 s |

Tempo: fast 13 rounds (Ts won 46%); mid 54 rounds (Ts won 80%); late 65 rounds (Ts won 69%).

Buys, the Ts' against the CTs': full against full 113 rounds (Ts won 33%); force against full 48 rounds (Ts won 27%); full against force 33 rounds (Ts won 82%); pistol against full 29 rounds (Ts won 0%); pistol against pistol 26 rounds (Ts won 35%); pistol against force 17 rounds (Ts won 6%); force against force 15 rounds (Ts won 53%); force against pistol 12 rounds (Ts won 83%); full against pistol 10 rounds (Ts won 70%).

The Ts at second 20 (all five alive in 66% of the rounds): 33 formations, 12 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 22 | 11% | 41% | site 1 32% | 70 s | 32% |
| 5 between | 19 | 10% | 32% | site 2 32% | 56 s | 26% |
| 5 between | 18 | 9% | 44% | site 1 33%, site 2 17% | 78 s | 39% |
| 5 between | 17 | 9% | 35% | site 1 35%, site 2 12% | 92 s | 35% |
| 5 between | 16 | 8% | 56% | site 1 50%, site 2 19% | 68 s | 50% |
| 5 between | 11 | 6% | 45% | site 1 55% | 62 s | 55% |
| 5 between | 10 | 5% | 40% | site 1 50%, site 2 10% | 82 s | 50% |
| 5 between | 10 | 5% | 40% | site 2 40% | 28 s | 30% |
| 5 between | 8 | 4% | 63% | site 1 38%, site 2 38% | 68 s | 63% |
| 5 between | 7 | 4% | 29% | site 1 14% | 50 s | 14% |
| 5 between | 7 | 4% | 14% | site 1 43% | 28 s | 29% |
| 5 between | 7 | 4% | 71% | site 2 71% | 28 s | 57% |

The CTs at second 15 (all five alive in 88% of the rounds): 45 formations, 16 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 4 between, 1 at site 2 | 26 | 10% | 77% |
| 4 between, 1 near the CT spawn | 23 | 9% | 57% |
| 3 between, 1 near the CT spawn, 1 at site 2 | 20 | 8% | 75% |
| 4 between, 1 at site 2 | 16 | 6% | 69% |
| 3 between, 2 at site 2 | 16 | 6% | 63% |
| 4 between, 1 at site 2 | 14 | 5% | 57% |
| 4 between, 1 at site 2 | 13 | 5% | 100% |
| 5 between | 12 | 5% | 75% |
| 4 between, 1 at site 2 | 10 | 4% | 80% |
| 3 between, 1 near the CT spawn, 1 at site 2 | 8 | 3% | 75% |

## de_tuscan

14 demos, 362 rounds of five against five. The Ts won 53%. In 32% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 44% | 69% | 0% | 30 s |
| site 2 | 24% | 52% | 2% | 32 s |

Tempo: fast 92 rounds (Ts won 63%); mid 111 rounds (Ts won 61%); late 43 rounds (Ts won 67%).

Buys, the Ts' against the CTs': full against full 145 rounds (Ts won 46%); full against pistol 62 rounds (Ts won 98%); full against force 45 rounds (Ts won 67%); pistol against pistol 31 rounds (Ts won 42%); force against full 31 rounds (Ts won 29%); pistol against force 16 rounds (Ts won 19%); pistol against full 14 rounds (Ts won 0%); force against force 13 rounds (Ts won 38%); force against pistol 5 rounds (Ts won 80%).

The Ts at second 20 (all five alive in 47% of the rounds): 28 formations, 12 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 22 | 13% | 64% | site 1 41%, site 2 27% | 56 s | 0% |
| 5 between | 20 | 12% | 70% | site 1 75%, site 2 10% | 34 s | 0% |
| 5 between | 17 | 10% | 76% | site 1 53%, site 2 35% | 32 s | 0% |
| 5 between | 11 | 6% | 64% | site 1 36% | 64 s | 0% |
| 5 between | 10 | 6% | 80% | site 1 100% | 40 s | 0% |
| 5 between | 9 | 5% | 56% | site 1 11%, site 2 78% | 36 s | 0% |
| 4 between, 1 near the T spawn | 9 | 5% | 56% | site 1 33%, site 2 67% | 56 s | 11% |
| 3 between, 2 at site 1 | 8 | 5% | 88% | site 1 88% | 20 s | 0% |
| 3 between, 2 at site 1 | 7 | 4% | 86% | site 1 100% | 20 s | 0% |
| 4 between, 1 at site 1 | 6 | 4% | 33% | site 1 67% | 30 s | 0% |
| 3 at site 2, 2 between | 6 | 4% | 67% | site 2 100% | 18 s | 0% |
| 3 between, 2 at site 1 | 5 | 3% | 100% | site 1 100% | 32 s | 0% |

The CTs at second 15 (all five alive in 64% of the rounds): 27 formations, 16 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 3 at site 1, 1 between, 1 at site 2 | 53 | 23% | 43% |
| 3 between, 2 at site 1 | 22 | 9% | 59% |
| 3 at site 1, 1 between, 1 at site 2 | 15 | 6% | 40% |
| 2 at site 2, 1 between, 1 near the CT spawn, 1 at site 1 | 15 | 6% | 60% |
| 5 between | 12 | 5% | 42% |
| 3 between, 2 at site 1 | 12 | 5% | 67% |
| 3 at site 1, 1 at site 2, 1 between | 12 | 5% | 33% |
| 3 between, 2 at site 1 | 11 | 5% | 73% |
| 4 between, 1 at site 2 | 10 | 4% | 70% |
| 4 between, 1 at site 2 | 9 | 4% | 44% |

## de_aztec

8 demos, 78 rounds of five against five. The Ts won 36%. In 62% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 27% | 57% | 52% | 28 s |
| site 2 | 12% | 44% | 89% | 42 s |

Tempo: fast 10 rounds (Ts won 60%); mid 13 rounds (Ts won 38%); late 7 rounds (Ts won 71%).

Buys, the Ts' against the CTs': full against full 36 rounds (Ts won 31%); pistol against full 9 rounds (Ts won 0%); full against force 9 rounds (Ts won 56%); force against full 7 rounds (Ts won 29%); full against pistol 7 rounds (Ts won 71%); pistol against pistol 5 rounds (Ts won 40%).

The Ts at second 20 (all five alive in 47% of the rounds): 8 formations, 3 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 11 | 30% | 55% | site 1 45% | 24 s | 27% |
| 3 near the T spawn, 2 between | 9 | 24% | 44% | site 1 22%, site 2 11% | 86 s | 33% |
| 4 between, 1 near the T spawn | 8 | 22% | 50% | site 2 25% | 118 s | 25% |

The CTs at second 15 (all five alive in 74% of the rounds): 11 formations, 4 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 3 between, 2 at site 1 | 21 | 36% | 86% |
| 5 between | 14 | 24% | 64% |
| 3 between, 1 at site 2, 1 at site 1 | 6 | 10% | 67% |
| 4 between, 1 at site 1 | 5 | 9% | 60% |

## de_prodigy

4 demos, 54 rounds of five against five. The Ts won 65%. In 26% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 15% | 63% | 100% | 76 s |
| site 2 | 48% | 81% | 73% | 46 s |
| site 3 | 0% | - | - | - |
| site 4 | 11% | 50% | 0% | 42 s |

Tempo: fast 6 rounds (Ts won 33%); mid 18 rounds (Ts won 94%); late 16 rounds (Ts won 63%).

Buys, the Ts' against the CTs': full against full 21 rounds (Ts won 57%); full against force 14 rounds (Ts won 79%); force against force 7 rounds (Ts won 100%).

The Ts at second 20 (all five alive in 81% of the rounds): 14 formations, 3 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 9 | 20% | 67% | site 1 33%, site 2 22% | 108 s | 44% |
| 5 between | 8 | 18% | 88% | site 1 13%, site 2 75%, site 4 13% | 62 s | 75% |
| 5 between | 5 | 11% | 80% | site 1 20%, site 2 80% | 48 s | 80% |

The CTs at second 15 (all five alive in 63% of the rounds): 4 formations, 3 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 5 at site 2 | 16 | 47% | 38% |
| 3 between, 2 at site 4 | 10 | 29% | 30% |
| 3 between, 2 at site 2 | 6 | 18% | 67% |

## de_cpl_mill

3 demos, 58 rounds of five against five. The Ts won 45%. In 31% of the rounds the Ts reached no site.

| Site | Share of the rounds | Ts won | Planted | First T in the site (median) |
|------|------|------|------|------|
| site 1 | 52% | 50% | 33% | 32 s |
| site 2 | 17% | 50% | 80% | 54 s |

Tempo: fast 13 rounds (Ts won 46%); mid 13 rounds (Ts won 54%); late 14 rounds (Ts won 50%).

Buys, the Ts' against the CTs': full against full 22 rounds (Ts won 41%); full against pistol 8 rounds (Ts won 100%); pistol against force 7 rounds (Ts won 0%); pistol against full 6 rounds (Ts won 0%); pistol against pistol 5 rounds (Ts won 40%).

The Ts at second 20 (all five alive in 60% of the rounds): 8 formations, 3 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | Ts won | Went to | First T in the site | Planted |
|------|------|------|------|------|------|------|
| 5 between | 12 | 34% | 42% | site 1 50%, site 2 25% | 62 s | 42% |
| 5 between | 9 | 26% | 22% | site 1 78%, site 2 11% | 34 s | 22% |
| 5 between | 5 | 14% | 60% | site 1 20%, site 2 60% | 30 s | 40% |

The CTs at second 15 (all five alive in 72% of the rounds): 7 formations, 1 of them played in 1.5% of the rounds or more.

| Where the five stand | Rounds | Share | CTs won |
|------|------|------|------|
| 3 at site 1, 1 between, 1 at site 2 | 32 | 76% | 72% |

## Maps left out

- de_mirage: 8 demos, but csbih-player has no built level of it
- de_clan1_mill: 3 demos, but csbih-player has no built level of it
- cs_havana: 1 demos, too few
- de_forge: 1 demos, too few
- de_chateau: 1 demos, too few
- de_vegas: 1 demos, too few

