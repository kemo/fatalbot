# fatalbot

fatalbot is a bot for Counter-Strike 1.6. The aim is the best CS 1.6 bot: it plays as a team, it plays like the
players of the time, and it wins fair. One brain plays in two hosts:

| Host | What | State |
|------|------|-------|
| csbih | The game core of csbih-player (`/igraj`), in the browser and in Node | adapter built |
| goldsrc | A real CS 1.6 server (HLDS, ReHLDS) | not built: see "Open decisions" |

The brain is plain JavaScript (ES modules) with no dependency. A host gives it a frame of the game and a few
queries (ports), and takes a command for each bot. The specifications are in [docs/specs/](docs/specs/README.md).

csbih-player is a private repository of the same owner: it is expected beside this one (`../csbih-player`). Without
it the brain and its unit tests run; the arena tools and the tests that need its levels do not.

## Run

Node 22 or newer. No install step: there are no packages.

```sh
npm test                                          # the tests; those that need csbih-player skip without it
node tools/demo-arena.js --map de_dust2 --count 4 # fatalbot in the place of one side of recorded matches
node tools/demo-arena.js --map de_dust2 --count 4 --standins fatal-route   # and as the bot that plays on for a player, on that player's route
node tools/arena.js --maps de_dust2 --rounds 12   # fatalbot against the bots of csbih-player
node tools/arena.js --help
node tools/strategies.js --report docs/strategies.md   # the strategies of every recorded match, by map
node tools/players.js                                  # the aim of the recorded players, with spread and error
node tools/rounds.js --kinds fatal --by-map            # the shape of the rounds and the buys: the recorded matches beside the bots
```

`tools/arena.js` takes a kind of bot for each team (`--a`, `--b`): `ref` (the bots of csbih-player), `fatal`,
`fatal-plans` (with the plans that `tools/strategies.js` mined for the map), `fatal-nades` (with the lineups of the
map) and `fatal-plans-nades`. The plain `fatal` is the default: the plans and the lineups are options until they
win more rounds than they cost (docs/measures/).

The arenas and some tests need a built checkout of csbih-player: the source in `src/shared/game/`, the levels in
`assets/levels/`, and for the demo arena the timelines in `out/`. They look in `../csbih-player`; set
`CSBIH_PLAYER=/path/to/csbih-player` for another place. Nothing of that checkout is copied into this repository.

## The tests, in order

1. **Against recorded matches** (`tools/demo-arena.js`). fatalbot takes the place of one side of a demo round, with
   the weapons and, if you wish, the hands of the players it replaces. The other side plays its recording until the
   round leaves it. The report gives the rounds that fatalbot won beside the rounds that those players won.
2. **Against the reference bots** (`tools/arena.js`): the bots of csbih-player, both side orders, the same hands.
3. **On the CS 1.6 server**: one team of fatalbot against one team of YaPB. Not possible yet: see "Open decisions".

The recorded measures are in [docs/measures/](docs/measures/). The strategies of the recorded matches are in
[docs/strategies.md](docs/strategies.md).

## Watch

```sh
node tools/watch.js --map de_dust2 --side T --rounds 8    # then open the address that it prints
node tools/watch.js --demo <id> --side CT --first 16      # another demo, the other side, from round 16
```

`tools/watch.js` plays the rounds of test 1 and shows them in the TV page of csbih-player, at the speed of the game:
the level in 3D, the radar, the first person, the kill feed and the scoreboard. The bots of fatalbot are named
"FatalBot | 1" to "FatalBot | 5", and the page shows "FatalBot" as the tag of that team. The other team keeps its
names: the players of the demo, who stay on their recording until the round leaves it.

The tool writes one timeline into `out/watch/` (git-ignored) and starts the player's own server on it, on port
3038. csbih-player itself is not changed.

## Layout

```
src/            the brain: pure ES modules, the same files for every host
hosts/csbih/    the adapter for the game core of csbih-player, the Node loader of its levels, the two arenas,
                the recorder that writes played rounds as a timeline of the player, the analysis of the
                strategies of the recorded matches (docs/strategies.md), and the measure of the players' aim
hosts/goldsrc/  the plan of the adapter for a real server
tools/          the command lines: arena.js, demo-arena.js, watch.js, strategies.js, players.js, rounds.js
test/           node --test
docs/specs/     what the code does and why
docs/measures/  the recorded measures, each with its command line
```

## What "best" means

A claim that a bot is better needs a number. Spec 01 holds the gates. In short:

1. fatalbot wins a match against the reference bots with the same motor profile, on both sides.
2. The Ts win a share of the rounds in the range of the human matches (39% to 54% on the measured maps).
3. A bot stands at a wall or stays stuck no more often than the reference bots.
4. No win comes from a faster hand or from knowledge that a player in its place does not have.
5. The feet and the hand are a player's: the jumps, the strafes, the stop before a shot, the flick of the aim.

## Open decisions (for the owner)

1. **The GoldSrc host.** The test on the CS 1.6 server of gamerz.ba (fatalbot against YaPB) needs it. A real
   server loads a 32-bit Metamod plugin. To build and test one, this project needs:
   the HLSDK and Metamod headers (a fetch from pinned commits, never committed), an i386 Linux build container, and
   a test server with the game files. It also needs a choice of how the plugin runs the brain: an embedded
   JavaScript engine inside the plugin, or a Node process beside the server. `hosts/goldsrc/README.md` compares
   them. Nothing of this is fetched or built yet.
2. **The licence** of this repository. None is set.
3. **How csbih-player takes the brain**: a copy at a pinned commit, a git submodule, or a path. The owner decided on
   2026-11-11: fatalbot plays the bots of csbih-player at once, from a copy of the brain that a script makes. The
   owner made the switch on 2026-11-11 (csbih-player commit `af5d038`, live on player.gamerz.ba); `?bot=bot.js` on
   the play page gives the old bots (docs/measures/2026-11-11-hold-and-route.md, section 5). A newer fatalbot gets
   there when the owner runs `node tools/vendor-fatalbot.js` in csbih-player, commits and deploys. fatalbot is
   measured as the bot that takes over in a replay (docs/measures/2026-11-10-replay-takeover.md). The change itself
   is in `demo-match.js` and `match.js` of csbih-player, which is read-only from here. A bot of fatalbot can keep the route of the player that it plays on
   for, and leaves it by what it meets itself (spec 03, section 6.3). It does not throw that player's grenades.
4. **The pace of the Ts** (commit `a7858e1`): the Ts wait out of sight and go at a second drawn as the players'
   was. A round then has the players' pace, and the Ts win 54.4% of the rounds of fatalbot against itself (the
   gate is 39 to 54%; 51.5% without the pace). With the buy of a team they won 55.2%, and with the steps of a bot that
   holds a place they win 53.2%: inside the gate, with the pace in. After the team rules of 2026-11-12 (a part of
   a rotation, the Ts' go after the first kill, the CTs' save, the Ts' place after a plant) they win 50.1%
   (error 1.4). `git revert a7858e1` takes the pace away
   (docs/measures/2026-11-11-night.md, sections 6 and 8; 2026-11-11-economy.md; 2026-11-11-hold-and-route.md;
   2026-11-12-night.md).
5. **The data of the maps.** The plans and the lineups come from the recorded matches. They name no player, and
   they are places on Valve's maps. They are made into `out/` and are not committed. A host on a real server needs
   them as files: the owner decides if they enter this repository.
6. **The graph of csbih-player** has floors with no way to them (a platform on de_nuke, box tops, a roof on
   de_inferno). Players of the demos stand there. fatalbot leaves such a floor by a straight walk (spec 03,
   section 4). A fix belongs in `tools/build-nav.js` of csbih-player, which is read-only from here. One
   recording is named after the map that its server changed to at the end; the patch that cuts it is in
   `out/csbih-player/` (docs/measures/2026-11-11-night.md, section 7). Its
   `doors.js` takes the place where the last world left a door as the door's closed place; fatalbot's host puts
   the doors back before each world (adapter.js `restLevel`). By that graph
   the CTs need 16 s to the upper site of de_nuke, which is as long as the Ts need
   (docs/measures/2026-11-11-night.md, section 4).
