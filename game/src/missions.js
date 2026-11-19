// Meridian Bay — the six story missions, taxi fares and the 10 hidden
// packages. Each mission: brief, objective, waypoint, timer, reward.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const MISSION_SPOTS = {
  M1: { x: -110, z: 88, label: 'Dockside Garage' }, // garage
  M2: { x: 88, z: -66, label: 'Marina Motel' },
  M3: { x: -22, z: -88, label: 'Calle Verde drops' },
  M4: { x: 0, z: 0, label: 'Survive the heat' },
  M5: { x: 178, z: 22, label: 'Pier 40 van' },
  M6: { x: -44, z: -22, label: 'Meridian Bank' },
};

export function createMissions(scene, rng, state) {
  const marker = new THREE.Group();
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 30;
  marker.add(beacon);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe600 }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 7;
  marker.add(arrow);
  marker.visible = false;
  scene.add(marker);

  // hidden packages: glowing green boxes on rooftops/sidewalks
  const packages = [];
  const pkgMat = new THREE.MeshLambertMaterial({ color: 0x39d353, emissive: 0x1d7a2e, emissiveIntensity: 0.6 });
  for (let i = 0; i < 10; i++) {
    const p = rng.chance(0.5) ? { x: -110 + (i % 5) * 55, z: -110 + Math.floor(i / 5) * 55 } : { x: 22 + (i % 4) * 40, z: -132 + Math.floor(i / 4) * 66 };
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), pkgMat);
    m.position.set(p.x, 0.6, p.z);
    scene.add(m);
    packages.push({ mesh: m, pos: m.position, taken: false });
  }

  let current = 0; // mission index 0..5
  let stage = 0; // stages inside a mission (e.g. M6: 0 approach, 1 hold, 2 escape)
  let timer = 0;
  let dropsCollected = 0;
  let started = false;

  function def() { return CONFIG.missions[current]; }
  function spot() { return MISSION_SPOTS[def().id]; }

  // Force a mission into a given stage (used by the deterministic shot stager).
  function stageForShot(stageNum, timerSeconds) {
    stage = stageNum;
    timer = timerSeconds;
    if (def().id === 'M6' && stageNum === 2) {
      marker.position.set(198, 0, 22); // escape to the pier boat
    } else {
      const s = spot();
      marker.position.set(s.x, 0, s.z);
    }
  }

  function startMission(i) {
    current = i;
    stage = 0;
    timer = def().time;
    dropsCollected = 0;
    started = true;
    marker.visible = true;
    const s = spot();
    marker.position.set(s.x, 0, s.z);
    return def();
  }

  function completeMission() {
    const d = def();
    state.money += d.reward;
    state.rep += 240;
    state.missionsDone += 1;
    started = false;
    marker.visible = false;
    if (current < CONFIG.missions.length - 1) {
      return { reward: d.reward, next: CONFIG.missions[current + 1] };
    }
    return { reward: d.reward, next: null, storyDone: true };
  }

  // returns an event string when something happens, else null
  function update(dt, playerPos, inCar, wanted) {
    // package pickup
    for (const p of packages) {
      if (p.taken) continue;
      if (Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z) < 2.2) {
        p.taken = true;
        p.mesh.visible = false;
        state.money += CONFIG.packageValue;
        state.packages += 1;
        return 'PACKAGE';
      }
    }
    if (!started) return null;
    const s = spot();
    const d = Math.hypot(s.x - playerPos.x, s.z - playerPos.z);
    const m = def();
    // per-mission logic
    if (m.id === 'M1') {
      if (inCar && d < 12) return 'COMPLETE';
    } else if (m.id === 'M2') {
      timer -= dt;
      if (timer <= 0) return 'FAILED';
      if (d < 10) return 'COMPLETE';
    } else if (m.id === 'M3') {
      // drops are the three staged points around Calle Verde
      if (d < 10 && stage < 3) {
        stage += 1;
        dropsCollected += 1;
        if (stage >= 3) return 'COMPLETE';
        const next = [{ x: -66, z: -44 }, { x: 22, z: -88 }, { x: -22, z: -132 }][stage];
        marker.position.set(next.x, 0, next.z);
        return 'DROP';
      }
    } else if (m.id === 'M4') {
      timer -= dt;
      if (timer <= 0) return 'COMPLETE';
      if (wanted < 3 && timer < def().time - 2) return 'FAILED'; // 2s grace at start
    } else if (m.id === 'M5') {
      if (inCar && d < 14) return 'COMPLETE';
    } else if (m.id === 'M6') {
      if (stage === 0) {
        if (d < 12) { stage = 1; timer = m.time; return 'HOLD'; }
      } else if (stage === 1) {
        timer -= dt;
        if (d > 16) return 'FAILED';
        if (timer <= 0) {
          stage = 2;
          marker.position.set(198, 0, 22); // escape to the pier boat
          return 'ESCAPE';
        }
      } else if (stage === 2) {
        const pierD = Math.hypot(198 - playerPos.x, 22 - playerPos.z);
        if (pierD < 14) return 'COMPLETE';
      }
    }
    return null;
  }

  function stageText() {
    const m = def();
    if (m.id === 'M3') return `${dropsCollected}/3 drops`;
    if (m.id === 'M6') return stage === 0 ? 'Reach the bank' : stage === 1 ? `Hold — ${Math.ceil(timer)}s` : 'Escape to Pier 40';
    if (m.time > 0 && started) return `${Math.ceil(timer)}s left`;
    return started ? 'In progress' : 'Not started';
  }

  return {
    marker, packages,
    get current() { return current; },
    get stage() { return stage; },
    get timer() { return timer; },
    get started() { return started; },
    get dropsCollected() { return dropsCollected; },
    def, spot, startMission, stageForShot, completeMission, update, stageText,
  };
}
