// The team layer on the flat test map: the ways into a site, the posts, the anchors and the rotation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flat } from '../src/geometry.js';
import { choosePost, postSpots, siteInfo, stagePlaces, stageSpots } from '../src/sites.js';
import { flatMap, flatPorts, frameAt, player } from './support/flat-host.js';

// A wide floor with no wall in it: the Ts spawn in the west, two sites lie in the east.
const SITES = [{ mins: [450, 350, 0], maxs: [550, 450, 72] }, { mins: [450, -450, 0], maxs: [550, -350, 72] }];
const map = () => flatMap({ sites: SITES, size: 56, spawns: [-800, 600] });
const open = () => flatPorts({ half: -1 });
const fresh = (ids) => {
  const brain = createBrain({ map: map(), ports: open(), seed: 11 });
  for (const id of ids) brain.join(id);
  return brain;
};

test('a site has a way in from the attackers and posts that watch it', () => {
  const brain = fresh([]);
  const info = siteInfo(brain, 0);
  assert.ok(info.entries.length >= 1, 'a way in');
  for (const e of info.entries) assert.ok(flat(e, info.mid) >= 600 && flat(e, info.mid) < 800, 'the way in is named at its distance from the site');
  assert.ok(info.posts.length >= 3, 'some posts');
  for (const p of info.posts) assert.ok(p.sees.some(Boolean) && flat(p.point, info.mid) <= 800);
});

test('the defenders of a site take posts apart from each other', () => {
  const brain = fresh([]);
  const taken = [];
  for (let i = 0; i < 3; i++) {
    const post = choosePost(brain, 0, taken, 0);
    assert.ok(post?.point && post.watch, 'a post with a way in to watch');
    for (const t of taken) assert.ok(flat(t, post.point) >= 120, 'not on a teammate');
    taken.push(post.point);
  }
});

const cts = () => [player(1, 'CT', [600, 100, 36], { own: true }), player(2, 'CT', [600, -100, 36], { own: true })];

test('each CT gets a post of its site, and holds it', () => {
  const brain = fresh([1, 2]);
  brain.frame(frameAt(1, [...cts(), player(9, 'T', [-800, 0, 36])]));
  const plan = brain.teams.CT.plan;
  assert.deepEqual([plan.posts.get(1).site, plan.posts.get(2).site], [0, 1]);
  brain.think(1);
  assert.equal(brain.debug(1).goal, 'site');
  assert.deepEqual(brain.debug(1).point, plan.posts.get(1).point);
});

test('a CT that hears steps far off keeps its post', () => {
  const brain = fresh([1, 2]);
  const runner = (tick) => {
    const e = player(9, 'T', [-300 + tick, 200, 36]);
    e.velocity = [250, 0, 0];
    return e;
  };
  let post = null;
  // The CT stands on its post and looks away; the T runs 800 units off, in the open, behind its back.
  for (let tick = 1; tick <= 200; tick++) {
    if (tick === 1) {
      brain.frame(frameAt(1, [...cts(), runner(1)]));
      post = brain.teams.CT.plan.posts.get(1).point;
    }
    const me = player(1, 'CT', post, { own: true, yaw: 0 });
    brain.frame(frameAt(tick + 1, [me, cts()[1], runner(tick)]));
    brain.think(1);
  }
  const d = brain.debug(1);
  assert.ok(d.goal === 'ambush' || d.goal === 'site', `it holds (${d.goal})`);
  // The post, or one of the floors about it that it steps between (within 176 units).
  assert.ok(d.point === null || flat(d.point, post) <= 176, 'at its post, not on a run at the enemy');
});

test('the CTs rotate to the site where the team sees the attack', () => {
  const brain = fresh([1, 2]);
  // Three Ts stand before site 0, in the view of the CT there.
  const ts = () => [player(7, 'T', [200, 380, 36]), player(8, 'T', [200, 420, 36]), player(9, 'T', [200, 460, 36])];
  for (let tick = 1; tick <= 300; tick++) {
    const a = player(1, 'CT', [500, 400, 36], { own: true, yaw: 180 });
    const b = player(2, 'CT', [500, -400, 36], { own: true, yaw: 180 });
    brain.frame(frameAt(tick, [a, b, ...ts()]));
    brain.think(1);
    brain.think(2);
  }
  assert.equal(brain.teams.CT.plan.rotate?.site, 0);
  // The CT of the other site goes to a post of the attacked one (on the call it watches the enemy on its way).
  const d = brain.debug(2);
  assert.ok(d.goal === 'rotate' || d.goal === 'ambush', d.goal);
  assert.ok(flat(d.point, siteInfo(brain, 0).mid) <= 800, 'to a post of the attacked site');
  assert.ok(flat(d.point, siteInfo(brain, 1).mid) > 400, 'away from its own site');
});

test('one T seen at a site brings a defender of the other site over, one stays, and it goes back when the site is quiet', () => {
  const brain = fresh([1, 2, 3]);
  const at = { 1: [500, 400, 36], 2: [500, -400, 36], 3: [560, 330, 36] };
  const frame = (tick, extra = []) => {
    brain.frame(frameAt(tick, [...[1, 2, 3].map((id) => player(id, 'CT', at[id], { own: true, yaw: 180 })), ...extra]));
    for (const id of [1, 2, 3]) brain.think(id);
  };
  frame(1);
  const plan = brain.teams.CT.plan;
  const home = (id) => plan.posts.get(id).site;
  const two = [1, 2, 3].filter((id) => home(id) === home(1));
  assert.equal(two.length, 2, 'two defenders at one site, one at the other');
  const other = 1 - home(1);
  const mid = siteInfo(brain, other).mid;
  // One T stands before the other site, in the view of the CTs.
  for (let tick = 2; tick <= 400; tick++) frame(tick, [player(7, 'T', [mid[0] - 300, mid[1], 36])]);
  assert.equal(plan.rotate, null, 'one T is no attack of the team');
  const gone = two.filter((id) => plan.leans.get(id)?.site === other);
  assert.equal(gone.length, 1, 'one of the two goes over, one stays');
  const d = brain.debug(gone[0]);
  assert.ok(d.goal === 'rotate' || d.goal === 'ambush', d.goal);
  assert.ok(flat(d.point, mid) <= 800, 'to a post of the site with the T');
  // The T is out of sight, behind their backs: LEAN_SECONDS later the defender has its own post again.
  for (let tick = 401; tick <= 400 + 30 * 100; tick++) frame(tick, [player(7, 'T', [1400, 0, 36])]);
  assert.equal(plan.leans.size, 0);
  assert.equal(brain.debug(gone[0]).goal, 'site');
  assert.ok(flat(brain.debug(gone[0]).point, siteInfo(brain, home(1)).mid) <= 800, 'back at its own site');
});

test('a CT that comes into a round after its start takes a post at the site nearer to it', () => {
  // The bot of a replay: it takes over for a player in the middle of a round, with no post of the round's plan.
  const brain = createBrain({ map: map(), ports: flatPorts({ half: -1 }), seed: 5 });
  brain.join(1);
  const frame = (tick, list) => brain.frame(frameAt(tick, list));
  const first = player(1, 'CT', [600, 0, 36], { own: true });
  frame(1, [first, player(2, 'CT', [500, -300, 36]), player(9, 'T', [-800, 0, 36])]);
  brain.think(1);
  assert.equal(brain.teams.CT.plan.posts.has(2), false, 'the plan of the round knows only the bots of its start');
  brain.join(2);
  frame(300, [first, player(2, 'CT', [500, -300, 36], { own: true }), player(9, 'T', [-800, 0, 36])]);
  brain.think(2);
  const post = brain.teams.CT.plan.posts.get(2);
  assert.ok(post?.point, 'it has a post now');
  assert.equal(post.site, 1, 'at the site nearer to it');
  assert.equal(brain.debug(2).goal, 'site');
});

test('where the attackers come to a site first, the defenders take posts that they reach unseen', () => {
  // The site lies in the open, near the end of the wall (x = 320, y from -200 to 200). The CTs spawn behind the wall.
  const sites = [{ mins: [220, 410, 0], maxs: [300, 510, 72] }];
  const ports = flatPorts();
  const brain = createBrain({ map: flatMap({ sites, size: 40, spawns: [-600, 420] }), ports, seed: 3 });
  const info = siteInfo(brain, 0);
  const seenFromSpawn = (p) => ports.traceLine([-600, 0, 53], [p[0], p[1], p[2] + 17]) >= 1;
  const late = info.posts.filter((p) => p.late);
  const inTime = info.posts.filter((p) => !p.late);
  assert.ok(late.length >= 3 && late.every((p) => seenFromSpawn(p.point)), 'a post in the open is late: an attacker sees it from the spawn');
  assert.ok(inTime.length >= 2, 'posts in time');
  for (const p of inTime) {
    assert.ok(!seenFromSpawn(p.point), 'a post in time lies behind the wall');
    assert.ok(ports.traceLine([p.point[0], p.point[1], 53], [info.mid[0], info.mid[1], 53]) >= 1 || p.sees.some(Boolean), 'and sees the site or a way in');
  }
  const taken = [];
  for (let i = 0; i < 2; i++) {
    const post = choosePost(brain, 0, taken, 0.5, true);
    assert.ok(!seenFromSpawn(post.point) && post.watch, 'from their spawn the defenders take the posts in time');
    taken.push(post.point);
  }
  // Later in a round (a rotation, a bot that takes over) the race from the spawns is over: a post near the site.
  assert.ok(flat(choosePost(brain, 0, [], 0.5).point, info.mid) <= 800);
});

test('the carrier in the site plants once the site is quiet, and at once when it is alone or the clock is short', () => {
  // The site lies west of the wall (x = 320, y from -200 to 200). The carrier stands in it; a teammate stands
  // past the wall's end and sees the CT east of the wall. The carrier does not see that CT.
  const sites = [{ mins: [200, -50, 0], maxs: [300, 50, 72] }];
  const bomb = { state: 'carried', carrier: 1, origin: null, explodeAt: null, defuser: null, arming: null };
  const play = ({ enemy, mate = true, timeLeft = 100 }) => {
    const brain = createBrain({ map: flatMap({ sites, size: 40, spawns: [-600, 500] }), ports: flatPorts(), seed: 5 });
    brain.join(1);
    brain.join(2);
    for (let tick = 1; tick <= 300; tick++) {
      const list = [player(1, 'T', [250, 0, 36], { own: true, yaw: 90 }), player(9, 'CT', enemy)];
      if (mate) list.push(player(2, 'T', [250, 300, 36], { own: true, yaw: -30 }));
      const frame = frameAt(tick, list, { bomb });
      frame.round.timeLeft = timeLeft;
      brain.frame(frame);
      brain.think(1);
      if (mate) brain.think(2);
    }
    return brain.debug(1).goal;
  };
  const seenByMate = [500, 150, 36];
  const farAway = [500, -600, 36];
  assert.notEqual(play({ enemy: seenByMate }), 'plant', 'a teammate sees an enemy near the site: no plant yet');
  assert.equal(play({ enemy: farAway }), 'plant', 'nobody sees an enemy: the plant');
  assert.equal(play({ enemy: seenByMate, timeLeft: 30 }), 'plant', 'the clock is short: the plant');
  assert.equal(play({ enemy: seenByMate, mate: false }), 'plant', 'alone it plants: it does not see that enemy');
});

test('the Ts wait out of the sight of the posts on their way, and go at a second of the round', () => {
  // The site lies far east of the wall (x = 320, y from -600 to 600); the Ts come from the west, round its end.
  const sites = [{ mins: [1200, -50, 0], maxs: [1300, 50, 72] }];
  const ports = flatPorts({ half: 600 });
  const make = (seed) => {
    const brain = createBrain({ map: flatMap({ sites, size: 96, spawns: [-1200, 1400], wall: 600 }), ports, seed });
    brain.join(1);
    brain.join(2);
    return brain;
  };
  const brain = make(4);
  const info = siteInfo(brain, 0);
  const places = stagePlaces(brain, 0);
  const sees = (a, b) => ports.traceLine([a[0], a[1], 53], [b[0], b[1], 53]) >= 1;
  assert.ok(places.length >= 2, 'places to wait at');
  for (const p of places) {
    assert.ok(!sees(p, info.mid), 'a place does not see the site');
    assert.ok(info.posts.every((post) => !sees(post.point, p)), 'and no post sees it');
  }
  // Both Ts get a place, and the plan a second of the players' range.
  const ts = (at) => [player(1, 'T', at[0], { own: true }), player(2, 'T', at[1], { own: true }), player(9, 'CT', [1400, 0, 36])];
  brain.frame(frameAt(1, ts([[-1200, 0, 36], [-1200, 64, 36]])));
  const plan = brain.teams.T.plan;
  assert.ok(plan.te >= 18 && plan.te <= 75, `the second of the plan (${plan.te})`);
  assert.ok(plan.spots.get(1) && plan.spots.get(2));
  // At its place before the second, a T waits; after the second it goes to the site.
  const goalAt = (seconds) => {
    const b = make(4);
    let goal = null;
    for (let tick = 1; tick <= seconds * 100; tick += 10) {
      b.frame(frameAt(tick, ts([b.teams.T.plan?.spots.get(1) ?? [-1200, 0, 36], b.teams.T.plan?.spots.get(2) ?? [-1200, 64, 36]])));
      b.think(1);
      goal = b.debug(1).goal;
    }
    return goal;
  };
  assert.equal(goalAt(10), 'stage');
  assert.notEqual(goalAt(80), 'stage');
  // The first kill of the round ends the wait: a T goes within 8 s of it, long before the plan's second.
  const afterKill = (seconds) => {
    const b = make(4);
    let goal = null;
    for (let tick = 1; tick <= seconds * 100; tick += 10) {
      const events = tick === 501 ? [{ type: 'kill', victim: 8, killer: 2 }] : [];
      const players = [...ts([b.teams.T.plan?.spots.get(1) ?? [-1200, 0, 36], b.teams.T.plan?.spots.get(2) ?? [-1200, 64, 36]]), player(8, 'CT', [1400, 200, 36], { alive: tick < 501 })];
      b.frame(frameAt(tick, players, { events }));
      b.think(1);
      goal = b.debug(1).goal;
    }
    return goal;
  };
  assert.equal(afterKill(6), 'stage', 'it waits right after the kill');
  assert.notEqual(afterKill(14), 'stage', 'and goes within 8 s of it');
});

test('a CT that holds its post steps between the floors about it', () => {
  // A CT at its post for 60 s, with no enemy alive to see. Each frame puts it on the floor that it wants to stand on.
  const brain = fresh([1, 2]);
  const floors = [];
  let post = null;
  for (let tick = 1; tick <= 6000; tick++) {
    const at = brain.debug(1)?.point ?? [600, 100, 36];
    brain.frame(frameAt(tick, [player(1, 'CT', at, { own: true, yaw: 180 }), cts()[1], player(9, 'T', [-800, 0, 36], { alive: false })]));
    post ??= brain.teams.CT.plan.posts.get(1);
    brain.think(1);
    const point = brain.debug(1).point;
    if (tick > 300 && point && !floors.some((f) => flat(f, point) < 8)) floors.push(point);
  }
  const spots = postSpots(fresh([]), post.site, post.point);
  assert.ok(spots.length >= 2, 'floors about the post');
  assert.ok(floors.length >= 3, `it stood on ${floors.length} floors in 60 s`);
  for (const f of floors) assert.ok(flat(f, post.point) < 8 || spots.some((p) => flat(p, f) < 8), 'each is the post or a floor about it');
  for (const p of spots) assert.ok(flat(p, post.point) >= 48 && flat(p, post.point) <= 176);
});

test('the floors about a waiting place of the Ts are as hidden as the place', () => {
  const sites = [{ mins: [1200, -50, 0], maxs: [1300, 50, 72] }];
  const ports = flatPorts({ half: 600 });
  const brain = createBrain({ map: flatMap({ sites, size: 96, spawns: [-1200, 1400], wall: 600 }), ports, seed: 4 });
  const info = siteInfo(brain, 0);
  const sees = (a, b) => ports.traceLine([a[0], a[1], 53], [b[0], b[1], 53]) >= 1;
  let all = 0;
  for (const place of stagePlaces(brain, 0)) {
    for (const p of stageSpots(brain, 0, place)) {
      all++;
      assert.ok(!sees(p, info.mid) && info.posts.every((post) => !sees(post.point, p)), 'no post and no site sees the floor');
      assert.ok(flat(p, place) <= 176);
    }
  }
  assert.ok(all >= 2, 'some floors');
  assert.deepEqual(stageSpots(brain, 0, [0, 0, 36]), [], 'a place that is none of the level has none');
});

test('with no enemy left and a teammate at the bomb, a CT has free time: it runs about with the knife out', () => {
  const bombAt = [500, 400, 36];
  /** Runs 4 s; from second 1 on the T is dead and the bomb is down, with `defuser` at it. Returns the last command and goal of CT 1. */
  const play = (defuser, { tDies = true } = {}) => {
    const brain = fresh([1, 2]);
    let cmd = null;
    for (let tick = 1; tick <= 400; tick++) {
      const late = tick > 100;
      const players = [
        player(1, 'CT', [600, 100, 36], { own: true, yaw: 180 }), player(2, 'CT', [520, 400, 36], { own: true }),
        // The T stands behind the CTs' backs, far off, and then dies.
        player(9, 'T', [850, -800, 36], { alive: !(late && tDies) }),
      ];
      const bomb = late ? { state: 'planted', carrier: null, origin: bombAt, explodeAt: 40, defuser, arming: null } : null;
      brain.frame(frameAt(tick, players, { bomb, events: tick === 101 ? [{ type: 'planted', at: bombAt }] : [] }));
      cmd = brain.think(1);
      brain.think(2);
    }
    return { cmd, goal: brain.debug(1).goal, point: brain.debug(1).point };
  };
  const free = play(2);
  assert.equal(free.goal, 'free');
  assert.ok(free.point && flat(free.point, [600, 100, 36]) >= 250, 'a floor to run to');
  assert.ok(Math.hypot(free.cmd.forward, free.cmd.side) > 0.9, 'it runs');
  assert.equal(free.cmd.weapon, 'knife');
  // With the T alive the CT has no free time.
  assert.notEqual(play(2, { tDies: false }).goal, 'free');
  // The CT at the bomb goes on with it.
  assert.notEqual(play(1).goal, 'free');
});

test('a round that is over is free time, and a round with no enemy from its start is not', () => {
  const brain = fresh([1, 2]);
  const at = (tick, phase) => brain.frame(frameAt(tick, [...cts(), player(9, 'T', [850, -800, 36])], { phase }));
  for (let tick = 1; tick <= 50; tick++) { at(tick, 'live'); brain.think(1); }
  assert.notEqual(brain.debug(1).goal, 'free');
  for (let tick = 51; tick <= 100; tick++) { at(tick, 'over'); brain.think(1); }
  assert.equal(brain.debug(1).goal, 'free');
  // No enemy was ever alive (a level with nobody on the other side): the CT holds its post.
  const alone = fresh([1, 2]);
  for (let tick = 1; tick <= 50; tick++) {
    alone.frame(frameAt(tick, [...cts(), player(9, 'T', [-800, 0, 36], { alive: false })]));
    alone.think(1);
  }
  assert.equal(alone.debug(1).goal, 'site');
});

test('a player that waits for a known enemy steps between floors, and plants its feet when that enemy is close', () => {
  // A T with no post hears an enemy run behind the wall (x = 320, y from -600 to 600), and waits for it or goes
  // for it. `x`: where the enemy runs. Returns the floors of the first seed that draws a long wait.
  const sites = [{ mins: [1200, -50, 0], maxs: [1300, 50, 72] }];
  const ports = flatPorts({ half: 600 });
  const wait = (x) => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const brain = createBrain({ map: flatMap({ sites, size: 96, spawns: [-1200, 1400], wall: 600 }), ports, seed });
      brain.join(1);
      const floors = [];
      let waited = 0;
      for (let tick = 1; tick <= 1200; tick++) {
        const at = brain.debug(1)?.goal === 'ambush' && brain.debug(1).point ? brain.debug(1).point : [0, 0, 36];
        const runner = player(9, 'CT', [x, -200 + (tick % 400), 36]);
        runner.velocity = [0, 250, 0];
        brain.frame(frameAt(tick, [player(1, 'T', at, { own: true, yaw: 0 }), runner]));
        brain.think(1);
        const d = brain.debug(1);
        if (d.goal !== 'ambush') continue;
        waited++;
        if (d.point && !floors.some((f) => flat(f, d.point) < 8)) floors.push(d.point);
      }
      if (waited > 400) return floors;
    }
    return null;
  };
  // The enemy runs 900 units off: the bot steps between the floors about the place where it heard it.
  const far = wait(900);
  assert.ok(far, 'a seed drew a wait for the far enemy');
  assert.ok(far.length >= 2, `it stood on ${far.length} floors`);
  // Each floor is a step from one that it stood on (a new wait starts where the bot is), and none is a run at the enemy.
  far.forEach((f, i) => assert.ok(i === 0 || far.slice(0, i).some((g) => flat(f, g) <= 240), 'a step from a floor that it stood on'));
  for (const f of far) assert.ok(f[0] < 300, 'not on a run at the enemy');
  // The enemy runs 500 units off, heard all the time: the feet stay where they are.
  const near = wait(500);
  assert.ok(near, 'a seed drew a wait for the near enemy');
  assert.equal(near.length, 1);
});
