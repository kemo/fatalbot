# 03 The brain as built

Status: built on 2026-11-10 and measured (docs/measures/2026-11-10-first-brain.md and
docs/measures/2026-11-10-plans-and-feel.md). This spec says what each module does, what came from
csbih-player's bot and what is new. The numbers are in the code, each with its source in a comment.

## 1. One tick of one bot (`brain.js command`)

1. Look, 20 times a second (`senses.js look`). Each tick the target of a fight follows the enemy while the last
   look saw it (`track`).
2. Buy, once a round, a moment after the round's start (`buy.js`, section 6.2).
3. Decide the goal (`tactics.js decide`): the bomb first, then a known enemy, then the team's plan.
4. Give up a goal that the bot did not come nearer to in 5 s (`walk.js giveUp`).
5. Fight an enemy seen in the last 2.5 s (`fight.js`), else look where the goal or a sound asks (`aim.js`, `watch.js`).
6. Walk to the goal's point unless the fight holds the feet (`walk.js`, `moves.js`). A bot that holds a place
   and stands jumps now and then (`moves.js idleJump`).
7. The small rules of the hand: no knife in danger, a reload in a quiet moment, the plant and the defuse.

## 2. Senses (`senses.js`)

Ported from `bot.js look` and `hear`, with these rules made strict:

- A bot sees an enemy in its view field (70 degrees each side) with a clear line to the head or the chest, no
  smoke between, within the reach of its gun. A sound near its back turns it at once.
- Seen is not noticed: an enemy at the edge of the view or far away takes longer, as in csbih-player.
- **New:** an enemy that the bot cannot see or hear changes no command. The reference bot draws its gun for an
  enemy within 2000 units inside the view cone, through walls. Test: gate G6 in `test/brain.test.js`.
- A hit whose shot the bot did not hear turns its eyes to the side of the hit, as the HUD shows it: the bearing
  with an error of 15 degrees, at a guessed 600 units. A grenade's hit tells no side.
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
  next jump comes on the landing, now and then a tick or two late. `hopChain` is the part of a player's flat jumps
  that follow another in a chain (the middle player: 0.17). A bot with that number has 16% to 19% of its flat
  jumps in a chain (docs/measures/2026-11-13-feet.md).
- **New:** the tap of the duck (`duckTap`), the duck on the mouse wheel: the duck key down for one tick on a calm
  run or wait, at the profile's `duckTaps` a minute, in rolls of one tap or a few. The game lifts the player 18
  units and they fall back; the run keeps its speed. Never near a sign of an enemy, in a hop or on a walk.
- **New:** `jumpRate` is the real jumps a minute of the live play, and `strafeBeat` sets how long a step of a fight
  lasts.
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
- **New:** at the top of a ladder with its floor on the open side of the ladder's face (a ladder beside its
  platform), a bot keeps its face to the ladder, climbs until its feet clear the floor, then steps off sideways.
  A floor straight behind it takes a jump off the ladder. A view turned to such a floor turns the climb into a
  descent, because the game moves a player on a ladder along the view.
- **New:** an island of the graph is a floor that no way leaves. A bot on one walks straight to the nearest joined
  floor that a straight walk reaches, and starts its way from that floor. It counts as able to reach the level
  (`nav.js reaches`), so it gets a goal there. It asks the 32 nearest joined floors first, then every joined
  floor within 640 units, then the island's own floors (nearest first by the island's ways) for one with a
  straight walk out, and goes there by the island's ways. One search against the ways tells the floors with a
  way to the goal (`nav.js waysTo`). The search of an island takes up to 24 ms in one command, once for an island
  (docs/measures/2026-11-12-night.md, section 5).
- **New:** a give-up marks the step of the way that the bot stood before as failed, as a stuck walk does. A climb
  holds no stuck clock, so a ladder that the bot cannot take shows only at the give-up.
- **New:** a bot that waits at its place jumps now and then (`moves.js idleJump`): by chance at the rate of its
  profile, with no sign of an enemy for 5 s, and never over its count. About half of the players' jumps on the
  flat start from a stand. A rule that lets the bot catch up with its count puts the jumps of a team into the
  seconds when the enemies arrive, and loses the first fight.
- Gate G7, the jumps (docs/measures/2026-11-11-night.md, section 5): fatalbot jumps 2.9 to 6.3 times a minute
  with the players' profiles, the players 4.3 to 7.9. It does not jump in a fight (the players: about once a
  minute), and it fires fewer rifle shots on the run at a distance.
- To come: the peek at a corner, the jiggle at an angle, the jump onto a box with the legs up as a habit, the
  duck into a hatch.

## 5. Tactics (`tactics.js`, `watch.js`)

Ported from `bot.js decide` and `tactics.js`: the plant, the defuse with its count of the seconds, the guard of a
defuser, the posts of the Ts after the plant (a floor 300 to 1,200 units from the bomb that sees it), the escape
from the blast, the hunt, the ambush and the cover.

- **New:** at rest a bot looks at the point where an enemy comes into sight on its way from the enemy's side
  (`watch.js restLook`), then at the long lines of the place. The reference bot takes the angles of the demos,
  which this brain does not read yet.

## 6. The team (`plan.js`, `sites.js`, `team.js`)

New. The reference bots have no team plan.

- `sites.js` finds the ways into each bomb site and the posts that watch them from cover, from the graph and the
  level's lines of sight, once a map, when the brain is made (25 ms, and up to 270 ms on de_nuke, where the timing
  of the posts asks many floors).
- Each CT takes a post of its site: first a way in that nobody watches, then a crossfire on one.
- A post says whether a defender is there in time: half a second before the first attacker within 1000 units has
  a line to it, both from their spawns by the graph at 240 units a second. A CT that runs from its spawn takes a
  post in time. A site with fewer than five such posts gets floors further back on the CTs' side, out to 1600
  units, that see the site or a way in. On two sites of the measured maps (A of de_aztec, the upper site of
  de_nuke) the Ts are at the way in before the CTs are at their posts. A longer lead or a longer reach takes the
  forward posts of other sites away and gives the Ts more rounds (docs/measures/2026-11-11-night.md, section 4).
- A CT with a post holds it on a contact, and watches where the enemy comes into sight.
- The CTs rotate to a site when the team saw 60% of the living Ts near it within 6 s.
- Before that, a part of the team goes: the first T that the team sees at a site (or the killer of a teammate
  there) brings the defenders of the other site over, the nearest first and one a second, and one of them stays.
  They go back when no T was seen at that site for 20 s, or when the team sees an attack at another site
  (`plan.js lean`). The recorded CTs travel after the first death of a round; the bots held their posts
  (docs/measures/2026-11-12-night.md).
- After a plant the CTs give the retake up by the count of players, as a call of the team: with a chance of 8%
  with the Ts one ahead and 22% with two or more ahead, drawn once for each count of the round. A CT within 500
  units of the bomb plays on, and a teammate at the bomb ends the call. A CT that saves leaves the blast and
  holds a place with its view to the bomb (`tactics.js saves`). The recorded CTs are alive at the blast in 16% of
  the plants.
- A CT that comes into a round after its start (the bot of a replay takes over for a player) takes a post at the
  site nearer to it.
- The Ts take one site together, chosen at the round's start. Each T first waits on a way to that site, short of
  the way in, at a place that no post of the site sees and that does not see the site (`sites.js stagePlaces`).
  The plan draws the second at which the first T stands in the site, with a middle of 34 s and between 18 and
  75 s, as the players' first T did. A T leaves its place when its way to the site takes as long as is left to
  that second, and up to 2 s later: a team that leaves on one tick comes round a corner together and wins the
  first fight too often. A site with no such place is run at once. The first kill of the round that the feed
  shows ends the wait: each T goes 2 to 8 s after it.
- The carrier in the site plants once no enemy was seen or heard within 1000 units of it for 3 s, by itself or by
  its team. Alone, or with under 40 s of the round left, it plants at once. Until then it fights for the site
  (`tactics.js quietToPlant`). The players plant with most of the CTs dead, and win many rounds with no plant.

### 6.1 The plans of a map (an option)

`tools/strategies.js` mines the strategies that teams played on a map (docs/strategies.md), and a host can give
them to the brain as `map.plans` (spec 02). With them:

- At the round's start each team draws one plan, by its share of the rounds times the sum of 0.4 and the part of
  its rounds that it won (`plan.js WON_BASE`).
- Each T goes to a place of the formation and looks as its player looked. It leaves when its way to the site
  takes the time that is left until the plan's second of the first T in the site, and up to 2 s later (the lag of
  section 6: with it the Ts of the mined plans win 56.9% of 864 rounds of self-play, without it 61.0%). The bomb
  carrier waits too. A known enemy comes first, as always. With 30 s on the clock plus the way, every T goes.
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
  grenades at its second), fakes, the retake together, the save of the guns at the end of a lost round.

### 6.1b The steps of a player that holds a place (`tactics.js restless`, `sites.js postSpots`)

- A CT at a post of the level, and a T at its waiting place, stands a drawn time on one floor (1.2 s in the
  middle, between 0.5 and 30 s) and then walks to another floor about the place.
- A floor about a place is within 176 units by plain steps of the graph, at the height of the place, not by a
  wall or on an edge, with a free straight walk from the place. About a post it sees a way in that the post sees;
  about a waiting place it is as hidden as the place.
- The run to the place is a run. The steps between the floors are a walk, and a CT keeps its view on the way in.
- An enemy in its sight in the last 1.5 s keeps the bot where it is. A shot that it hears does not.
- A bot that waits for a known enemy (at its post, where the contact found it, or in cover) and a T at its post
  after the plant step in the same way, with the view where the enemy comes into sight. A bot that waits plants
  its feet when a sign of that enemy is under 2 s old and within 700 units. The floors about a cover are out of the
  enemy's sight; the floors about a post after the plant see the bomb.
- Each place has its own stand: a T that waits for an enemy still has its waiting place of the plan.
- **Free time** (`tactics.js freeGoal`): a round is the team's when no enemy is left alive after one lived, or
  when its clock ran out with no bomb down. Then a player runs to floors about it, with the knife out, and a run
  that can hop, hops. With the bomb down and no T alive, the CTs go for the bomb as before; once a teammate is at
  it, the others are free.
- Measured (docs/measures/2026-11-11-hold-and-route.md): before the first death of a round a CT stands in 35% of
  the steps of 2 s (90% before, the players 33%) and a T in 17% (63%, 16%); after it in 36% and 20% (50% and 29%
  before, the players 18% and 10%). Open: the floors are found inside a tick.

### 6.2 The buy of a team (`buy.js`)

- The first bot of a team that buys makes the call of the round from what the bots of the team have, as players
  say it before a round (`teamCall`). A teammate that no brain drives counts for nothing.
- A buy: all the bots but one at most hold a gun to keep (a rifle, a sniper rifle that is no Scout, the M249) or
  have the money of a full buy (the side's rifle and 1000).
- Else a force buy: always after a round that the team won (the frame's `round.score` tells it), and with a
  chance of 0.4 after one that it lost. The draw is the team's own stream.
- Else a save.
- In a buy or a force buy each bot takes the best that its money gives: the rifle of its side, the lesser rifle,
  a submachine gun (each with its ammo and a vest), or a vest and a better pistol. A bot with a lesser primary
  changes it for the rifle.
- In a save a bot spends only when it holds a gun to keep, or has the money of two buys.
- A bot buys a grenade only of a kind that its side has a lineup for on the map (section 7): it throws no other.
- Measured (docs/measures/2026-11-11-economy.md): the buys of a team by the result of the round before lie 11
  points from the recorded teams' (28 points before, for the CTs). Not built: the hand-over of a gun to a
  teammate, and the pick-up of a gun from the floor.

### 6.3 The route of a recorded player (`route.js`)

For a replay: a bot that plays on for a recorded player can get that player's route at its join (spec 02).

- On the route the bot walks to the place of the route a moment ahead, at the route's pace: it runs when it is
  behind, walks where the player walked, stands where the player stood, and jumps where the track rises as a
  jump. Its view is the player's view, and it holds the gun that the player held. Where the player stood at a
  place that the bot's box does not reach, the bot stands after 0.4 s with no step nearer.
- Off the route by 300 units, or with no progress for 1 s, it walks back by the graph to the first place of the
  route ahead that the graph reaches. A walk back that finds no such place ends the route, and so does the fourth
  walk back of the round.
- **Each bot leaves its route by what it meets itself**, for the rest of the round: it reacted to an enemy in its
  sight, it was hit, it heard an enemy within the hearing distance of its profile (350 units), the recording of its
  player ended, it carries a bomb
  that its player did not carry, or (after a plant) it is a CT, or a T whose route is over 1500 units from the
  bomb. No count of the dead and no event of a teammate ends a route (the owner's rule of 2026-11-11).
- With the C4 in the hand of the route, in a site, the carrier plants.
- Not built: the grenades of the player at their seconds.

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
