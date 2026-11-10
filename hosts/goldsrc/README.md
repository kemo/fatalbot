# The goldsrc host (not built)

This host joins the brain to a real CS 1.6 server. Nothing here is built: the work machine has no HLSDK header, no
Metamod header, no i386 toolchain and no server, and a fetch needs the owner's word (AGENTS.md).

Every engine name below comes from memory of the public HLSDK and Metamod. Check each against the fetched headers
before you write code.

## What the plugin does

A Metamod plugin is a 32-bit shared library (`.so` for Linux, `.dll` for Windows) that the server loads.

| Job | Engine side (to verify) |
|-----|-------------------------|
| Add and remove a bot | `pfnCreateFakeClient`, then the game's `ClientConnect` and `ClientPutInServer`; a kick removes it |
| Run a bot's command | `pfnRunPlayerMove(edict, viewangles, forwardmove, sidemove, upmove, buttons, impulse, msec)` once a server frame |
| Build the frame | the `entvars_t` of each player edict; the game's messages to a fake client (money, ammo, weapon, bomb, round) through the message hooks |
| Answer the ports | `pfnTraceLine` and `pfnTraceHull` with `ignore_monsters` |
| Buy, switch, drop | client commands of the fake client (`pfnClientCommand` of the game DLL) |
| Hear shots | the hook of `pfnPlaybackEvent` (weapon events) or of `pfnEmitSound` |

Spec 02 lists the source of each field of the frame.

## How the plugin runs the brain: two ways

| | A. An engine inside the plugin | B. A Node process beside the server |
|---|-------------------------------|-------------------------------------|
| What | The plugin embeds a small JavaScript engine (QuickJS is MIT and builds for i386) and loads the files of `src/` | The plugin sends each frame over a local socket and takes the commands back; Node runs `src/` |
| Install | One file, as every other bot | The plugin and a Node service (a container) |
| Speed of the brain | An interpreter: about 20 to 50 times slower than Node. Must be measured against gate G5 | As measured in the arena |
| Traces | The engine's own, called from the brain | The engine's own cost a round trip each. The service needs its own traces through the BSP (`hull.js` of csbih-player does this), and the doors and the breakables as state in the frame |
| A hosted game server (files only, no process) | Works | Does not work |
| A change of the brain | Reload the files | Restart the service |

Recommendation: A for a bot that other people install. B is the faster way to a first test server, and both use the
same contract, so B can come first and A later. This is the owner's decision.

## What the owner has to give or decide

1. A word for the fetch of the HLSDK and Metamod headers from pinned commits into `vendor/` (git-ignored).
2. An i386 Linux build container (an image pull).
3. A test server with the game files. Valve's files never enter this repository.
4. Way A or way B above.

## The nav graph

The csbih host takes the nav graph that `tools/build-nav.js` of csbih-player builds. A real server has the BSP only.
The graph must come from the BSP with the same rules, so that both hosts walk the same floors. To do: a builder
in this repository that reads a BSP v30 (clip hulls, entities) and writes the graph.
