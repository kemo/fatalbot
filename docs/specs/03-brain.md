# 03 The brain as built

Status: built on 2026-11-10 and measured (docs/measures/2026-11-10-first-brain.md and
docs/measures/2026-11-10-plans-and-feel.md). This spec says what each module does, what came from
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
- **New:** past 400 units, no shot while the gun spreads wide from the run (`moves.js fightStep`): a stand is
  reached with the keys against the run (the counter-strafe), and a strafing bot walks while it fires a rifle.
  Nearer, the gun fires at once and the stop comes while the shots go.
- **New:** one strafing fight in three is fought on the run (`fight.js RUN_GUN`). The players of the demos fire 7
  to 13% of their rifle shots on the run, the reference bot 22%.
- **Measured against the players of 520 demos** (`tools/players.js`, docs/measures/2026-11-10-players-aim.md):
  the share of the kills with a shot to the head (41 to 44%, the players 42.1%), the crosshair error at the first
  sight and at the first shot, the time to the first shot and the turn before it lie inside the spread of the
  players. For the same size of turn the hand is not faster than the players', and the first shot comes later.
  Outside the spread: the share of the head with a pistol (too low) and with a sniper rifle (too high). In a long
  burst the players pull the crosshair further down than the hand does. The bot makes more large turns than the
  players: its crosshair lies further from the enemy at the first sight.

## 4. The feet (`walk.js`, `moves.js`)

Ported from `bot.js walkTo`, `climb`, `stuckCheck` and `giveUp`: the way pulled tight, the ladders, the side step
round a teammate, the jump of a stuck bot, the island of the graph.

- **New:** a jump is dear. The game slows the run for 1.3 s after it. The search prices a jump edge at 180 units,
  and on a walk edge the bot jumps at a ledge only once the ledge holds it up. The reference bot jumps on stairs.
- **New:** the bunny hop (`hop`): by the profile's habit (`jumpRate`, `hopChain`), on a straight open run, never in
  a hurry. In the air the forward key is up, a strafe key is down and the view swings 8 degrees across the way. The
  next jump comes on the landing, now and then a tick or two late. The players of the measured demos rarely hop in
  a chain (0.1 to 0.6 times a minute), and fatalbot with their profiles does the same; a profile with a high
  `hopChain` hops more.
- **New:** the bot counts its own jumps of the round, and the hop comes more often while the count is under the
  profile's `jumpRate` and less often over it.
- **New:** where a bot comes no nearer to its point for 0.5 s, within 64 units of it, it stands. The point can lie
  between two floors, or a teammate can stand on it.
- **New:** a bot that a standing teammate holds up for 0.4 s asks for the way (`team.way`, a call on the radio).
  The teammate steps 72 units aside where it has room and a floor under the step, else on ahead, and stays out of
  the way for 2.5 s (`makeWay`). Only a bot that waits makes way: a T at its place of the formation, a CT at its
  post with no enemy in sight. At a post of a fight (after the plant, an ambush, a cover) a bot keeps its cover:
  the step out of it cost the Ts rounds. Near its own point the held-up bot waits 4 s instead of pushing.
- **New:** at the foot of a ladder on its way down, a bot that hangs there jumps off, also when its point lies
  higher than the foot. The ported rule let it hang there.
- Gate G7 is not met yet: fatalbot jumps half as often as the players
  (docs/measures/2026-11-10-plans-and-feel.md, section 6).
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

### 6.1 The plans of a map (an option)

`tools/strategies.js` mines the strategies that teams played on a map (docs/strategies.md), and a host can give
them to the brain as `map.plans` (spec 02). With them:

- At the round's start each team draws one plan, by its share of the rounds times 0.4 plus its share of wins.
- Each T goes to a place of the formation and looks as its player looked. It leaves when its way to the site
  takes the time that is left until the plan's second of the first T in the site. The bomb carrier waits too. A
  known enemy comes first, as always. With 30 s on the clock plus the way, every T goes.
- Each CT takes a place of the setup as its post, with the view of its player. The rotation is the same.
- A place moves to the nearest floor, within 200 units and 72 of height, that its side can walk to from its start
  and that is no bare end of a ladder. A place with no such floor is left out: its CT takes a post of the level,
  its T the place of a teammate. On de_nuke 14 places of the CT setups lie on a platform that the graph of
  csbih-player has no walk edges on.
- A T that comes no nearer to its place for 5 s gives it up and takes the place of the nearest teammate.
- Measured (docs/measures/2026-11-10-plans-and-feel.md): over all tests the plans give no sure gain and no sure
  loss of rounds. On de_inferno the Ts with a plan lose to the plain fatalbot: the five arrive at the same second
  by one way. The CT setups win fewer rounds than the posts of the level on de_dust2 and de_inferno. So the plans
  are an option of the hosts (`fatal-plans`, `--plans`), not the default.
- To come (csbih-player spec 12): the execute after the formation (the order of the entries, the trades, the
  grenades at its second), fakes, the retake together, the save, the buy of the team.

## 7. Grenades (`grenades.js`), an option

- The throw of the game: the view bent 10 degrees up, a speed of (90 - pitch) x 6 up to 750, plus the thrower's
  own speed (`throwOf`). The flight goes through `traceLine`, with the bounce off the normal of each hit.
- `solveThrow` finds the yaw and the pitch of a standing throw that lands at a point.
- A lineup of a map (`map.lineups`, spec 02) gives where a grenade of a player went off. The recorded velocity is
  no help: most throws were made on the run or in a jump. The bot solves its own standing throw from the recorded
  start to the same end, once a map. About half of the lineups have such a throw.
- A bot takes one lineup a round, within 700 units of its way, and not at a place where teammates stand near the
  end of the flight. Teammates turn their view away from a flashbang of the team in the air (`flashToAvoid`).
- Measured: with the lineups fatalbot wins fewer rounds against the reference bots. The stop for the throw costs
  more than the grenade gives while no plan times it. So the lineups are an option of the hosts (`fatal-nades`,
  `--nades`), not the default.
- To come: the throw at the second of the team's plan, the throw on the run, and the turn away from an enemy's
  flashbang (`frame.grenades`).

## 8. What the brain does not do yet

- It does not shoot a vent or a window open on its way, and it does not pick up a gun from the floor.
- Maps with no bomb: the bots hold and look about.
