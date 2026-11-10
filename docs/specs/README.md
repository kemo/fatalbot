# fatalbot: specifications

These specs describe what the code does and why. The code is the authority: when a spec and the code disagree, fix
the spec.

| Spec | Scope |
|------|-------|
| [01 Architecture](01-architecture.md) | The goal, the two hosts, the brain and its layers, the gates of "best", the order of work |
| [02 Host contract](02-host-contract.md) | The map, the frame, the ports and the command, with the source of each field in each host |
| [03 The brain as built](03-brain.md) | What each module does, what came from csbih-player's bot and what is new, and what is missing |

## Words used in all specs

- **Brain:** the code of `src/`. It decides what each bot does. It is the same in every host.
- **Host:** the game that the bots play in. It gives frames and takes commands.
- **Adapter:** the code that joins one host to the brain (`hosts/<name>/`).
- **Frame:** the state of the game at one tick, as the host gives it to the brain.
- **Port:** a question that the brain asks the host inside a tick, such as a line trace through the level.
- **Command:** the keys and the view of one bot for one tick.
- **Percept:** what one bot sees or hears at one tick. The senses make percepts from the frame.
- **Motor profile:** the numbers of a bot's hand and eye: reaction time, aim error, turn speed, recoil control.
- **Reference bots:** the bots of csbih-player (`src/shared/game/bot.js`), with no route of a demo.
- **World units:** GoldSrc units. x and y are the ground plane, z points up. A player's origin is the centre of
  the standing box, 36 units over the feet.
- **Angles:** degrees. Yaw turns counter-clockwise from the x axis. A positive pitch looks down.
