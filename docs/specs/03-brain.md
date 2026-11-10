# 03 The brain as built

Status: built on 2026-11-10 and measured (docs/measures). This spec says what each module does, what came from
csbih-player's bot and what is new. The numbers are in the code, each with its source in a comment.

## 1. One tick of one bot (`brain.js command`)

1. Look, 20 times a second (`senses.js look`). Each tick the target of a fight follows the enemy while the last
   look saw it (`track`).
2. Buy, once a round, a moment after the round's start (`buy.js`).
3. Decide the goal (`tactics.js decide`): the bomb first, then a known enemy, then the team's plan.
4. Give up a goal that the bot did not come nearer to in 5 s (`walk.js giveUp`).
5. Fight an enemy seen in the last 2.5 s (`fight.js`), else look where the goal or a sound asks (`aim.js`, `watch.js`).
6. Walk to the goal's point unless the fight holds the feet (`walk.js`, `moves.js`).
7. The small rules of the hand: no knife in danger, a reload in a quiet moment, the plant and the defuse.

## 2. Senses (`senses.js`)

Ported from `bot.js look` and `hear`, with these rules made strict:

- A bot sees an enemy in its view field (70 degrees each side) with a clear line to the head or the chest, no
  smoke between, within the reach of its gun. A sound near its back turns it at once.
- Seen is not noticed: an enemy at the edge of the view or far away takes longer, as in csbih-player.
- **New:** an enemy behind a wall changes nothing. The reference bot draws its gun for an enemy within 2000 units
  inside the view cone, through walls. Test: gate G6 in `test/brain.test.js`.
- **New:** a CT learns where the planted bomb lies by a look at it, by the beep within 1000 units, or by standing in
  a site that has none. The reference bot reads the bomb's place from the world.
- A T knows its team's bomb, as the radar shows it. Every player counts the bomb's seconds from the call.
- What a team's players see goes to the team at once (`team.js`): the sightings by place and time, the deaths,
  the places found empty.

## 3. The hand (`aim.js`, `fight.js`)

Ported from `bot.js aimAt`, `hand` and `fight`, where the numbers were fitted to the players of the demos:

- A flick of bell-shaped speed that lands a little short or long, a pause, a correcting move, then pursuit with a
  tremor. The time of a move follows Fitts' law.
- The reaction time before the first shot; the first shot before the view settles; bursts by range; the recoil
  pulled down by the profile's control; the scope of a sniper rifle; the knife.
- **New:** the shots of a burst are counted from the clip, so the brain needs no weapon state of the host.
- **New:** no shot while the gun spreads wide from the run (`moves.js fightStep`): a stand is reached with the keys
  against the run (the counter-strafe), and a strafing bot walks while it fires a rifle. Measured: 4% of
  fatalbot's shots fall on the run, 22% of the reference bot's.

## 4. The feet (`walk.js`, `moves.js`)

Ported from `bot.js walkTo`, `climb`, `stuckCheck` and `giveUp`: the way pulled tight, the ladders, the side step
round a teammate, the jump of a stuck bot, the island of the graph.

- **New:** a jump is dear. The game slows the run for 1.3 s after it. The search prices a jump edge at 180 units,
  and on a walk edge the bot jumps at a ledge only once the ledge holds it up. The reference bot jumps on stairs.
- **New:** the bunny hop (`hop`): by the profile's habit (`jumpRate`, `hopChain`), on a straight open run, never in
  a hurry. In the air the forward key is up, a strafe key is down and the view swings 8 degrees across the way. The
  next jump comes on the landing, now and then a tick or two late.
- To come: the peek at a corner, the jiggle at an angle, the jump onto a box with the legs up as a habit.

## 5. Tactics (`tactics.js`, `watch.js`)

Ported from `bot.js decide` and `tactics.js`: the plant, the defuse with its count of the seconds, the guard of a
defuser, the posts of the Ts after the plant, the escape from the blast, the hunt, the ambush and the cover.

- **New:** at rest a bot looks at the point where an enemy comes into sight on its way from the enemy's side
  (`watch.js restLook`), then at the long lines of the place. The reference bot takes the angles of the demos,
  which this brain does not read yet.

## 6. The team (`plan.js`, `sites.js`, `team.js`)

New. The reference bots have no team plan.

- `sites.js` finds the ways into each bomb site and the posts that watch them from cover, from the graph and the
  level's lines of sight, once a map (14 to 40 ms).
- Each CT takes a post of its site: first a way in that nobody watches, then a crossfire on one.
- A CT with a post holds it on a contact, and watches where the enemy comes into sight.
- The CTs rotate to a site when the team saw 60% of the living Ts near it within 6 s.
- The Ts take one site together, chosen at the round's start.
- To come (csbih-player spec 12): the Ts' defaults and executes, fakes, trades, the retake together, the save, the
  buy of the team, and the plans mined from the demos.

## 7. What the brain does not do yet

- Grenades: it buys them and does not throw them. The reference bot throws the lineups of the demos.
- It does not shoot a vent or a window open on its way, and it does not pick up a gun from the floor.
- Maps with no bomb: the bots hold and look about.
