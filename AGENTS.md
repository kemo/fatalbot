# AGENTS.md

fatalbot is a bot for Counter-Strike 1.6. One brain plays in two hosts:

- **csbih**: the game core of `../csbih-player` (`src/shared/game/`), in the browser and in Node.
- **goldsrc**: a real CS 1.6 server (HLDS or ReHLDS). Not built yet. See `hosts/goldsrc/README.md`.

The specifications are in [docs/specs/](docs/specs/README.md). The code is the authority: when a spec and the code
disagree, fix the spec.

## Rules of the brain (`src/`)

- The brain is plain ES modules. It imports nothing from outside `src/`.
- The brain uses no Node API, no DOM API, no clock and no `Math.random`. Time comes from the frame. Random numbers
  come from the seeded random of the brain (`src/random.js`).
- The brain never receives the world of a host. It receives a frame, and it asks the host through the ports
  (spec 02). A new need of the brain is a new field or a new port, with its GoldSrc source written in spec 02.
- Trigonometry goes through `src/geometry.js`. A host that needs the same floats on every engine replaces one file.
- The same frames and the same seed give the same commands. A test holds this.

## Fair play

- A bot knows what a player in its place can know: what it sees, what it hears, what its team calls, and what the
  game shows to every player (the score, the clock, the radar of its own team).
- `src/senses.js` is the only module that reads the raw state of an enemy from a frame. All other modules read
  percepts and memory. A test holds this.
- Do not count a win that comes from a faster hand or from hidden knowledge. Compare bots with the same motor
  profile.

## Measure each change

- A change of behaviour is measured before and after with `tools/arena.js`, on the same maps, sides and seeds.
- A change that does not move a gate of spec 01 toward its target goes back.
- Write the measures with their command line and their date in `docs/measures/`.

## Sources and licences

- Read ReGameDLL_CS (`dlls/bot/` carries a GPL header), PODBot MM (GPL) and YaPB for behaviour and constants only.
  Copy no code from them. Name the source of a constant in a comment.
- Port code from `../csbih-player` freely: it has the same owner. Name the file it came from in the commit message.
- Valve's files never enter this repository: no map, model, sound, SDK header or game binary.
- Nothing from `../csbih-player/assets`, `out` or `demos` enters this repository. The demos hold the play of real
  people: commit no nickname, no Steam id and no derived profile of a named player.

## Boundaries

- Change files only inside this repository. `../csbih-player` and `../csbih` are read-only from here.
- Make no network request without the owner's word. The GoldSrc host needs fetched headers: that is an open owner
  decision (README, "Open decisions").

## Workflow

- One change in one commit, with a message that names the change. Run `npm test` before each commit.
- A feature has a test that uses it as a host uses it. A test that needs the levels of csbih-player skips when they
  are absent.
- Write all developer text in ASD-STE100 Simplified Technical English. Use no em-dash and no en-dash.
- Add no Claude attribution to a commit.
