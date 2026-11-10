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
