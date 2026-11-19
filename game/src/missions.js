// The six story missions, the ten hidden packages and the taxi fares.
// A small stage machine drives each mission: go to a point, collect drops,
// survive the heat, ram the van, escape to the boat. Payouts, REP and the
// save file all update here.

import * as THREE from 'three';
import { CFG } from './config.js';
import { FIXER_LINES } from './dialog.js';
import { dist2d } from './random.js';
import { makeBeaconMesh, makePersonMesh } from './render.js';

const PACKAGE_SPOTS = [
  { x: -200, z: -160 }, { x: -150, z: 120 }, { x: -60, z: -200 },
  { x: 60, z: 200 }, { x: 150, z: -140 }, { x: 220, z: 100 },
  { x: -20, z: 40 }, { x: 90, z: -80 }, { x: -230, z: 30 }, { x: 300, z: 8 },
];

export function createMissions(THREE, scene, city, ctx) {
  const { dialog, hud, audio, police } = ctx;
  const beacon = makeBeaconMesh(0xffd21e);
  beacon.visible = false;
  scene.add(beacon);

  // Hidden packages: small glowing crates.
  const packageMeshes = PACKAGE_SPOTS.map((p) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd21e }),
    );
    m.position.set(p.x, 1.2, p.z);
    scene.add(m);
    return { ...p, mesh: m, found: false };
  });

  // Taxi passenger.
  const passenger = makePersonMesh(0xffc81e, 0x2a2e38, 0xe8b88a, 0xffc81e);
  passenger.visible = false;
  scene.add(passenger);

  const state = {
    index: 0,
    stageIdx: 0,
    stages: [],
    stageT: 0,
    stageTarget: null,
    money: 250,
    rep: 0,
    done: [],
    packagesFound: [],
    taxi: { active: false, waiting: false, pos: null, dest: null, fare: 0, timer: 0 },
    banner: null,
    bannerT: 0,
    started: false,
  };

  function currentMission() {
    return CFG.missions[state.index];
  }

  function buildStages(m) {
    switch (m.kind) {
      case 'steal':
        return [
          { type: 'steal', label: 'Steal a car (press E near one)' },
          { type: 'goto', point: { x: 200, z: -36 }, radius: 10, label: 'Drive to the Marina marker' },
        ];
      case 'deliver':
        return [
          { type: 'goto', point: { x: -180, z: -108 }, radius: 8, label: 'Drop 1/3 — Old Port' },
          { type: 'goto', point: { x: 108, z: 180 }, radius: 8, label: 'Drop 2/3 — Calle Verde' },
          { type: 'goto', point: { x: 36, z: -180 }, radius: 8, label: 'Drop 3/3 — The Palms' },
        ];
      case 'collect':
        return [
          { type: 'collect', points: [{ x: -60, z: 150 }, { x: -108, z: 200 }, { x: -20, z: 120 }], radius: 6, label: 'Collect the drops in Calle Verde (0/3)' },
        ];
      case 'survive':
        return [
          { type: 'survive', seconds: 45, wanted: 3, label: 'Lose the 3-star tail — stay clean' },
        ];
      case 'ram':
        return [
          { type: 'ram', hits: 3, label: 'Ram the security van on the pier' },
          { type: 'goto', point: { x: 200, z: -36 }, radius: 10, label: 'Take the case to the Marina' },
        ];
      case 'escape':
        return [
          { type: 'goto', point: { x: 36, z: 108 }, radius: 10, label: 'Break through the Downtown cordon' },
          { type: 'goto', point: { x: 180, z: 36 }, radius: 10, label: 'Coast road — keep moving' },
          { type: 'goto', point: { x: 240, z: -36 }, radius: 10, label: 'Almost there — the Marina' },
          { type: 'goto', point: { x: 390, z: 0 }, radius: 10, label: 'Escape to the Marina boat' },
        ];
      default:
        return [{ type: 'goto', point: { x: 0, z: 0 }, radius: 10, label: 'Reach the marker' }];
    }
  }

  function startMission(i, silent = false) {
    state.index = Math.min(i, CFG.missions.length - 1);
    state.stageIdx = 0;
    state.stages = buildStages(currentMission());
    state.stageT = 0;
    state.stageTarget = null;
    state.started = true;
    const m = currentMission();
    if (m.kind === 'survive') police.setWanted(3);
    if (m.kind === 'escape') police.setWanted(4);
    if (!silent) {
      dialog.sayFixer(`${m.id.toLowerCase()}_brief`);
      hud.setMission(m, state.stages[0]);
    }
    placeBeacon();
  }

  function placeBeacon() {
    const s = state.stages[state.stageIdx];
    if (!s) {
      beacon.visible = false;
      return;
    }
    if (s.type === 'goto') {
      beacon.visible = true;
      beacon.position.set(s.point.x, 0, s.point.z);
      state.stageTarget = s.point;
    } else if (s.type === 'collect') {
      const remaining = s.points.filter((_, i) => !(s.got && s.got[i]));
      if (remaining.length > 0) {
        beacon.visible = true;
        beacon.position.set(remaining[0].x, 0, remaining[0].z);
        state.stageTarget = remaining[0];
      } else {
        beacon.visible = false;
      }
    } else if (s.type === 'ram') {
      beacon.visible = false;
      state.stageTarget = null;
    } else {
      beacon.visible = false;
      state.stageTarget = null;
    }
  }

  function stageLabel() {
    const s = state.stages[state.stageIdx];
    if (!s) return '';
    if (s.type === 'collect') {
      const got = (s.got || []).filter(Boolean).length;
      return s.label.replace('(0/3)', `(${got}/3)`);
    }
    return s.label;
  }

  function advanceStage(world) {
    state.stageIdx++;
    state.stageT = 0;
    if (state.stageIdx >= state.stages.length) {
      completeMission(world);
      return;
    }
    placeBeacon();
    hud.setMission(currentMission(), state.stages[state.stageIdx]);
  }

  function completeMission(world) {
    const m = currentMission();
    state.money += m.payout;
    state.rep = Math.min(100, state.rep + CFG.tuning.repPerMission);
    state.done.push(m.id);
    state.banner = `CHAPTER ${m.chapter} — ${m.name} PASSED`;
    state.bannerT = 5;
    hud.showPassed(state.banner, m.payout);
    dialog.sayFixer(`${m.id.toLowerCase()}_done`);
    audio.blip(880, 0.3, 0.25);
    audio.blip(1320, 0.4, 0.2);
    if (ctx.onSave) ctx.onSave();
    if (state.index < CFG.missions.length - 1) {
      setTimeout(() => startMission(state.index + 1), 5200);
    } else {
      setTimeout(() => { if (ctx.onComplete) ctx.onComplete(); }, 5200);
    }
  }

  function failMission(world) {
    state.money = Math.max(0, state.money - 200);
    police.setWanted(0);
    hud.showBusted();
    if (ctx.onBusted) ctx.onBusted();
  }

  function update(dt, world) {
    const { player, heroCar } = world;
    if (state.bannerT > 0) state.bannerT -= dt;
    if (!state.started) return;
    const s = state.stages[state.stageIdx];
    if (!s) return;
    const px = player.pos.x;
    const pz = player.pos.z;
    const inCar = !player.onFoot && heroCar;

    if (s.type === 'steal') {
      if (!player.onFoot) advanceStage(world);
    } else if (s.type === 'goto') {
      state.stageT += dt;
      if (dist2d(px, pz, s.point.x, s.point.z) < s.radius) advanceStage(world);
    } else if (s.type === 'collect') {
      s.got = s.got || s.points.map(() => false);
      let changed = false;
      s.points.forEach((p, i) => {
        if (!s.got[i] && dist2d(px, pz, p.x, p.z) < s.radius) {
          s.got[i] = true;
          changed = true;
          audio.blip(1040, 0.15, 0.22);
          if (ctx.effects) ctx.effects.burst(new THREE.Vector3(p.x, 1.5, p.z), 0xffd21e, 12, 6);
        }
      });
      if (changed) {
        placeBeacon();
        hud.setMission(currentMission(), state.stages[state.stageIdx]);
      }
      if (s.got.every(Boolean)) advanceStage(world);
    } else if (s.type === 'survive') {
      state.stageT += dt;
      if (police.wanted >= 2) s.progress = (s.progress || 0) + dt;
      else s.progress = Math.max(0, (s.progress || 0) - dt * 0.5);
      if ((s.progress || 0) >= s.seconds) advanceStage(world);
    } else if (s.type === 'ram') {
      const van = world.van;
      if (van) {
        beacon.visible = true;
        beacon.position.set(van.pos.x, 0, van.pos.z);
        state.stageTarget = { x: van.pos.x, z: van.pos.z };
        const d = dist2d(px, pz, van.pos.x, van.pos.z);
        const speed = inCar ? Math.abs(heroCar.speed) : 0;
        if ((!s.cool || s.cool <= 0) && d < 5.5 && speed > 9) {
          s.hitsLeft = (s.hitsLeft ?? s.hits) - 1;
          if (ctx.effects) {
            ctx.effects.burst(new THREE.Vector3(van.pos.x, 1.5, van.pos.z), 0xff5a3c, 20, 10);
            ctx.effects.shake(0.7);
          }
          audio.crash();
          van.condition = Math.max(0, van.condition - 34);
          van.pos.x += Math.sin(heroCar.heading) * 3;
          van.pos.z += Math.cos(heroCar.heading) * 3;
          if (s.hitsLeft <= 0) advanceStage(world);
          else s.cool = 1.2;
        }
        if (s.cool > 0) s.cool -= dt;
      }
    } else if (s.type === 'escape') {
      if (dist2d(px, pz, s.point.x, s.point.z) < s.radius) advanceStage(world);
    }

    // Hidden packages: walk or drive over one to collect it.
    for (const p of packageMeshes) {
      if (!p.found && dist2d(px, pz, p.x, p.z) < 3) {
        p.found = true;
        p.mesh.visible = false;
        state.packagesFound.push(`${p.x},${p.z}`);
        state.money += CFG.tuning.packageValue;
        audio.blip(1240, 0.2, 0.22);
        if (ctx.effects) ctx.effects.burst(new THREE.Vector3(p.x, 1.5, p.z), 0xffd21e, 14, 7);
      }
    }
    packageMeshes.forEach((p) => {
      if (!p.found) {
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.position.y = 1.2 + Math.sin(performance.now() * 0.002 + p.x) * 0.25;
      }
    });

    // Taxi: wait for a fare, pick the passenger up with T, drop them off.
    const t = state.taxi;
    t.timer -= dt;
    if (!t.active && !t.waiting && t.timer <= 0 && inCar) {
      const spot = city.randomRoadPoint(city.rng);
      t.waiting = true;
      t.pos = spot;
      passenger.visible = true;
      passenger.position.set(spot.x, 0, spot.z);
      t.dest = city.randomRoadPoint(city.rng);
    }
    if (t.waiting && inCar && dist2d(px, pz, t.pos.x, t.pos.z) < 6) {
      // Boarding happens on T — handled by main.js calling boardTaxi().
    }
    if (t.active && t.dest && dist2d(px, pz, t.dest.x, t.dest.z) < 9) {
      state.money += t.fare;
      audio.blip(990, 0.2, 0.22);
      hud.showToast(`TAXI FARE +$${t.fare}`);
      t.active = false;
      t.dest = null;
      t.timer = 14;
    }
  }

  function boardTaxi(world) {
    const t = state.taxi;
    if (!t.waiting) return false;
    if (dist2d(world.player.pos.x, world.player.pos.z, t.pos.x, t.pos.z) > 7) return false;
    t.waiting = false;
    t.active = true;
    t.fare = CFG.tuning.taxiFare;
    passenger.visible = false;
    beacon.visible = true;
    beacon.position.set(t.dest.x, 0, t.dest.z);
    dialog.show('TAXI RIDER', 'FARE', '#ffc81e', 'Downtown, please — and step on it.', 4);
    return true;
  }

  function markPackagesFound(found) {
    for (const p of packageMeshes) {
      if (found.includes(`${p.x},${p.z}`)) {
        p.found = true;
        p.mesh.visible = false;
      }
    }
    state.packagesFound = found.slice();
  }

  return {
    state,
    beacon,
    packageMeshes,
    currentMission,
    startMission,
    update,
    boardTaxi,
    markPackagesFound,
    stageLabel,
    get money() { return state.money; },
    set money(v) { state.money = v; },
    get rep() { return state.rep; },
    set rep(v) { state.rep = v; },
  };
}
