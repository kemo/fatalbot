// The team layer on the flat test map: the ways into a site, the posts, the anchors and the rotation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';
import { flat } from '../src/geometry.js';
import { choosePost, siteInfo } from '../src/sites.js';
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
  assert.ok(d.point === null || flat(d.point, post) < 1, 'at its post, not on a run at the enemy');
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
