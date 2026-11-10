# fatalbot

fatalbot is a bot for Counter-Strike 1.6. The aim is the best CS 1.6 bot: it plays as a team, it plays like the
players of the time, and it wins fair. One brain plays in two hosts:

| Host | What | State |
|------|------|-------|
| csbih | The game core of [csbih-player](../csbih-player) (`/igraj`), in the browser and in Node | adapter built |
| goldsrc | A real CS 1.6 server (HLDS, ReHLDS) | not built: see "Open decisions" |

The brain is plain JavaScript (ES modules) with no dependency. A host gives it a frame of the game and a few
queries (ports), and takes a command for each bot. The specifications are in [docs/specs/](docs/specs/README.md).

## Run

Node 22 or newer. No install step: there are no packages.

```sh
npm test                                        # the tests; those that need levels skip without them
node tools/arena.js --maps de_dust2 --rounds 12 # fatalbot against the bots of csbih-player
node tools/arena.js --help
```

The arena and some tests need a built checkout of csbih-player: the levels in `assets/levels/` and the source in
`src/shared/game/`. They look in `../csbih-player`; set `CSBIH_PLAYER=/path/to/csbih-player` for another place.
Nothing of that checkout is copied into this repository.

## Layout

```
src/            the brain: pure ES modules, the same files for every host
hosts/csbih/    the adapter for the game core of csbih-player, and the Node loader of its levels
hosts/goldsrc/  the plan of the adapter for a real server
tools/arena.js  matches of bots against bots, with the measures
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

## Open decisions (for the owner)

1. **The GoldSrc host.** A real server loads a 32-bit Metamod plugin. To build and test one, this project needs:
   the HLSDK and Metamod headers (a fetch from pinned commits, never committed), an i386 Linux build container, and
   a test server with the game files. It also needs a choice of how the plugin runs the brain: an embedded
   JavaScript engine inside the plugin, or a Node process beside the server. `hosts/goldsrc/README.md` compares
   them. Nothing of this is fetched or built yet.
2. **The licence** of this repository. None is set.
3. **How csbih-player takes the brain**: a copy at a pinned commit, a git submodule, or a path. Its own `bot.js`
   stays the bot of `/igraj` until the owner decides.
