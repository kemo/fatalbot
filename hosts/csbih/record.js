// A recorder that turns rounds played in a World into a timeline of csbih-player (its spec 02, version 8), so that
// the TV page of the player shows them as it shows a demo: the radar, the level in 3D, the first person, the kill
// feed and the scoreboard. tools/watch.js uses it for the owner's wish of 2026-11-10: to watch fatalbot play a
// recorded match, with the fatalbot team named. No Node API: the caller gives the player's animation helpers and a
// parsed player model (load.js loadAnim), which name the sequences of a body.

// A row of samples this often: 20 a second, as a good HLTV demo.
const SAMPLE_TICKS = 5;
// The weapon names of the game's events, where they differ from the game core's keys.
const EVENT_NAME = { mp5: 'mp5n' };
// A step of a run: its sounds, how often it falls and above which speed (pm_shared PM_UpdateStepSound).
const STEPS = ['player/pl_step1.wav', 'player/pl_step2.wav', 'player/pl_step3.wav', 'player/pl_step4.wav'];
const STEP_SECONDS = 0.3;
const STEP_SPEED = 150;
const round2 = (v) => Math.round(v * 100) / 100;

export class Recorder {
  /**
   * `anim` is the module web/player-anim.js of csbih-player and `mdl` a parsed player model (web/mdl.js readMdl).
   * `v16` says which build of the level the rounds ran on, so the page loads the same one.
   */
  constructor({ map, title, v16 = false, anim, mdl }) {
    this.anim = anim;
    this.mdl = mdl;
    this.clock = 0;
    this.offset = 0;
    this.score = { T: 0, CT: 0 };
    this.frags = new Map();
    this.name = new Map();
    this.side = new Map();
    this.t = {
      version: 8,
      source: { file: 'fatalbot', bytes: 0, sha256: '', netProtocol: v16 ? 48 : 46, kind: 'hltv' },
      map, server: title, duration: 0, recorder: null, players: [],
      samples: [], kills: [], rounds: [], bombs: [], scores: [], cues: [], views: [], sprays: [], corpses: [], chat: [], board: [], pings: [],
      sides: [], names: [], attribs: [], loadouts: [], kits: [], decals: [], purchases: [], grenades: [], bombSpots: [], ground: [], skins: [],
      anims: [], soundNames: [...STEPS], sounds: [], shots: [], radio: [], effects: [],
    };
  }

  /**
   * A round starts in `world` (its time is the round's own, from 0). `seconds` is the round's clock; `names` gives
   * the name of each player on the screen; `note` is a chat line that says who plays what.
   */
  begin(world, { seconds, names, note = null }) {
    const t = round2(this.clock);
    this.offset = this.clock;
    this.round = { body: new Map(), weapon: new Map(), attrib: new Map(), anim: new Map(), stepAt: new Map(), grenades: new Set(), spots: [], ticks: 0 };
    this.t.rounds.push({ t, kind: 'start', seconds });
    for (const team of ['T', 'CT']) this.t.scores.push({ t, team, score: this.score[team] });
    let speaker = null;
    for (const p of world.players.values()) {
      if (p.team !== 'T' && p.team !== 'CT') continue;
      const name = names.get(p.id) ?? p.name ?? `#${p.id}`;
      if (this.name.get(p.id) !== name) {
        this.name.set(p.id, name);
        this.t.names.push([t, p.id, name]);
      }
      if (this.side.get(p.id) !== p.team) {
        this.side.set(p.id, p.team);
        this.t.sides.push([t, p.id, p.team]);
      }
      if (p.team === 'CT') this.t.kits.push([t, p.id, p.kit ? 1 : 0]);
      speaker ??= p;
    }
    if (note && speaker) this.t.chat.push({ t, entity: speaker.id, team: speaker.team, name: 'fatalbot', text: note, dead: false, spectator: true, teamOnly: false });
    this.sample(world);
  }

  /** After each step of the world, with the events of that step. */
  step(world, events) {
    const t = round2(this.offset + world.time);
    const { anim, mdl, round } = this;
    const bodyOf = (id) => round.body.get(id) ?? round.body.set(id, anim.newBodyAnim()).get(id);
    for (const e of events) {
      const p = world.players.get(e.player);
      if (e.type === 'shot' && p) {
        const key = EVENT_NAME[e.weapon] ?? e.weapon;
        this.t.shots.push([t, e.player, key, e.silenced ? 1 : 0, null, null, 0, 0]);
        anim.startAction(bodyOf(e.player), p, 'shoot', world.time, e.weapon);
      } else if (e.type === 'reload' && p) anim.startAction(bodyOf(e.player), p, 'reload', world.time, e.weapon);
      else if (e.type === 'throw' && p) anim.startAction(bodyOf(e.player), p, 'shoot', world.time, 'hegrenade');
      else if (e.type === 'kill') this.kill(world, e, t);
      else if (e.type === 'planted') {
        this.t.bombs.push({ t, kind: 'planted' });
        this.spot('planted', t, e.at);
      } else if (e.type === 'defused' || e.type === 'exploded') {
        this.t.bombs.push({ t, kind: e.type });
        this.closeSpots(t);
      } else if (e.type === 'dropped') this.spot('dropped', t, e.at);
      else if (e.type === 'picked') this.closeSpots(t);
    }
    for (const g of world.grenades) round.grenades.add(g);
    if (++round.ticks % SAMPLE_TICKS === 0) this.sample(world);
    this.clock = this.offset + world.time;
  }

  /** The round is over; `result` is {winner, reason}. */
  end(world, result) {
    const t = round2(this.offset + world.time);
    if (result?.winner) this.score[result.winner]++;
    this.t.rounds.push({ t, kind: 'end', reason: result?.reason ?? 'Round_Draw', winner: result?.winner ?? null });
    for (const team of ['T', 'CT']) this.t.scores.push({ t, team, score: this.score[team] });
  }

  /** Closes the round's open rows; `gap` seconds pass before the next round. */
  close(world, gap = 0) {
    const t = round2(this.offset + world.time);
    this.closeSpots(t);
    for (const g of this.round.grenades) {
      if (g.burst === null && !g.rest) continue;
      const at = (s) => round2(this.offset + s);
      const end = g.until ?? g.burst ?? world.time;
      this.t.grenades.push({
        kind: g.kind, owner: g.owner, t0: at(g.t0), burst: at(g.burst ?? end), t1: at(Math.min(end, world.time)),
        x: Math.round(g.pos[0]), y: Math.round(g.pos[1]), z: Math.round(g.pos[2]), path: g.path.map(([s, x, y, z]) => [at(s), Math.round(x), Math.round(y), Math.round(z)]),
      });
    }
    this.clock = this.offset + world.time + gap;
  }

  /** The timeline of every round so far. */
  timeline() {
    this.t.duration = round2(this.clock);
    this.t.players = [...this.name].map(([entity, name]) => ({ entity, name }));
    this.t.grenades.sort((a, b) => a.t0 - b.t0);
    return this.t;
  }

  kill(world, e, t) {
    const killer = world.players.get(e.killer);
    const victim = world.players.get(e.victim);
    this.t.kills.push({
      t, killer: e.killer ?? 0, victim: e.victim, headshot: Boolean(e.headshot), weapon: e.weapon, killerTeam: killer?.team ?? null, victimTeam: victim?.team ?? null,
      killerName: killer ? this.name.get(killer.id) ?? '' : '', victimName: victim ? this.name.get(victim.id) ?? '' : '',
    });
    const add = (id, k, d) => {
      const f = this.frags.get(id) ?? [0, 0];
      this.frags.set(id, [f[0] + k, f[1] + d]);
      this.t.board.push([t, id, f[0] + k, f[1] + d]);
    };
    if (killer && victim && killer.id !== victim.id) add(killer.id, killer.team === victim.team ? -1 : 1, 0);
    if (victim) {
      add(victim.id, 0, 1);
      // The fall of the body: the death that the game picks for the hit.
      const name = this.anim.deathSequenceName({ group: e.headshot ? 1 : 0, weapon: e.weapon, ducked: victim.body.ducked, dice: (victim.id * 7 + Math.round(t * 100)) % 9 });
      const sequence = this.anim.sequenceOf(this.mdl, name);
      if (sequence >= 0) {
        this.t.anims.push([t, victim.id, sequence, 0]);
        this.round.anim.set(victim.id, `${sequence},0`);
      }
    }
  }

  spot(kind, t, at) {
    this.closeSpots(t);
    this.round.spots.push({ kind, t0: t, t1: null, x: Math.round(at[0]), y: Math.round(at[1]), z: Math.round(at[2]) });
  }

  closeSpots(t) {
    for (const s of this.round.spots) {
      s.t1 = t;
      this.t.bombSpots.push(s);
    }
    this.round.spots = [];
  }

  sample(world) {
    const t = round2(this.offset + world.time);
    const { anim, mdl, round } = this;
    const row = [t];
    for (const p of world.players.values()) {
      if (p.team !== 'T' && p.team !== 'CT') continue;
      const o = p.body.origin;
      const carrier = world.bomb?.state === 'carried' && world.bomb.carrier === p.id;
      const pitch = Math.max(-900, Math.min(900, Math.round(p.pitch * 10)));
      const flags = (p.alive ? 0 : 1) | (carrier ? 2 : 0) | (p.team === 'CT' ? 4 : 0) | (p.body.ducked ? 8 : 0) | ((pitch + 900) << 4);
      row.push(p.id, Math.round(o[0]), Math.round(o[1]), Math.round(o[2]), ((Math.round(p.yaw * 10) % 3600) + 3600) % 3600, flags);
      const attrib = (p.alive ? 0 : 1) | (carrier ? 2 : 0);
      if (round.attrib.get(p.id) !== attrib) {
        round.attrib.set(p.id, attrib);
        this.t.attribs.push([t, p.id, attrib]);
      }
      if (!p.alive) continue;
      if (round.weapon.get(p.id) !== p.weapon) {
        round.weapon.set(p.id, p.weapon);
        this.t.loadouts.push([t, p.id, p.weapon]);
      }
      const state = round.body.get(p.id) ?? round.body.set(p.id, anim.newBodyAnim()).get(p.id);
      const now = anim.animOfPlayer(mdl, p, state, world.time).anim;
      const key = `${now[0]},${now[1]}`;
      if (round.anim.get(p.id) !== key) {
        round.anim.set(p.id, key);
        this.t.anims.push([t, p.id, now[0], now[1]]);
      }
      // The steps of a run, as the server sends them to the other players.
      const speed = Math.hypot(p.body.velocity[0], p.body.velocity[1]);
      if (p.body.onGround && !p.body.ducked && speed > STEP_SPEED && world.time - (round.stepAt.get(p.id) ?? -1) >= STEP_SECONDS) {
        round.stepAt.set(p.id, world.time);
        this.t.sounds.push([t, (p.id + Math.round(world.time / STEP_SECONDS)) % STEPS.length, p.id, Math.round(o[0]), Math.round(o[1]), Math.round(o[2]), 127, 80, 4]);
      }
    }
    this.t.samples.push(row);
  }
}
