// The Meridian Bay Police Department: a wanted level from 0 to 5 stars, heat
// that rises with every crime the law sees, interceptors that spawn on the
// roads and chase the player, foot officers when the player is on foot, and
// a bust when a cop catches the player cold. Lay low and the heat fades.
//
// District heat: every crime also heats the district it happens in (0-5).
// At 5 a district is in LOCKDOWN — shops shut, extra cruisers roll in —
// and the heat only cools slowly, so a hot district stays hot.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { districtAt, randomRoadPoint } from './city.js';
import { range } from './random.js';

function copMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x24344e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a075 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.32), navy);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), new THREE.MeshLambertMaterial({ color: 0xf2c94c }));
  badge.position.set(0.16, 1.18, 0.17);
  group.add(badge);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.58;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.1, 10), dark);
  cap.position.y = 1.74;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), dark);
  legL.position.set(-0.15, 0.33, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legR);
  // Arms, swinging with the stride like the pedestrians'.
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.17), navy);
  armL.position.set(-0.38, 1.05, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.38;
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function createPolice(scene, city, vehicles, random) {
  const state = {
    wanted: 0,
    heat: 0,
    quietTimer: 0,
    bustTimer: 0,
    busted: false,
  };
  const cops = [];
  let policeCars = [];
  const districtHeat = new Map();
  let lastPos = null;

  function heatFor(district) {
    return districtHeat.get(district) || 0;
  }

  function setDistrictHeat(district, value) {
    districtHeat.set(district, Math.max(0, Math.min(5, value)));
  }

  function addHeat(amount) {
    if (state.busted) return;
    state.heat = Math.min(5, state.heat + amount);
    state.wanted = Math.ceil(state.heat);
    state.quietTimer = 0;
    if (lastPos) {
      const d = districtAt(lastPos.x, lastPos.z);
      districtHeat.set(d, Math.min(5, heatFor(d) + amount));
    }
  }

  function spawnPoliceCar(playerX, playerZ) {
    // Spawn on a road 90-130 m away so the chase arrives, not teleports in.
    let x = playerX + 100;
    let z = playerZ;
    for (let tries = 0; tries < 12; tries += 1) {
      const p = randomRoadPoint(city, random);
      if (Math.hypot(p.x - playerX, p.z - playerZ) > 90) {
        x = p.x;
        z = p.z;
        break;
      }
    }
    const car = vehicles.addCar(x, z, 0, 0xf2f2f2, 'police');
    car.chaseSpeed = 30 + state.wanted * 2.5 + (heatFor(districtAt(playerX, playerZ)) >= 5 ? 3 : 0);
    policeCars.push(car);
    return car;
  }

  function spawnFootCop(playerX, playerZ) {
    const p = randomRoadPoint(city, random);
    const { group, legL, legR, armL, armR } = copMesh();
    const x = p.x + range(random, -10, 10);
    const z = p.z + range(random, -10, 10);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { group, legL, legR, armL, armR, x, z, yaw: 0, phase: random() * 10 };
    cops.push(cop);
    return cop;
  }

  function removeCop(cop) {
    scene.remove(cop.group);
    const i = cops.indexOf(cop);
    if (i >= 0) cops.splice(i, 1);
  }

  function desiredCars() {
    if (state.wanted <= 0) return 0;
    return Math.min(WANTED.maxPoliceCars, state.wanted);
  }

  function update(dt, player, inCar, playerSpeed) {
    if (state.busted) return;
    lastPos = { x: player.x, z: player.z };
    // District heat cools slowly on its own — a hot district stays hot.
    for (const [d, h] of districtHeat) {
      if (h > 0) districtHeat.set(d, Math.max(0, h - dt * 0.02));
    }
    // Heat fades only while quiet and no cop is close.
    let nearestCop = Infinity;
    for (const car of policeCars) {
      nearestCop = Math.min(nearestCop, Math.hypot(car.x - player.x, car.z - player.z));
    }
    for (const cop of cops) {
      nearestCop = Math.min(nearestCop, Math.hypot(cop.x - player.x, cop.z - player.z));
    }
    if (state.wanted > 0) {
      if (nearestCop > 55) state.quietTimer += dt;
      else state.quietTimer = 0;
      if (state.quietTimer > WANTED.decayDelay) {
        state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
        state.wanted = Math.ceil(state.heat);
      }
    }
    // Interceptors match the wanted level; they despawn when the heat is gone.
    const want = desiredCars();
    while (policeCars.length < want) spawnPoliceCar(player.x, player.z);
    if (state.wanted === 0) {
      for (const car of policeCars) car.dead = true;
      while (cops.length > 0) removeCop(cops[0]);
    }
    for (const car of policeCars) {
      const lead = 0.6;
      car.target = {
        x: player.x + (inCar ? Math.sin(player.yaw || 0) * playerSpeed * lead : 0),
        z: player.z + (inCar ? Math.cos(player.yaw || 0) * playerSpeed * lead : 0),
      };
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      car.chaseSpeed = d > 60 ? 40 : 30 + state.wanted * 2;
      // Bust: a cop car resting on a slow player for a moment.
      if (d < 4.2 && Math.abs(car.speed) < 6 && Math.abs(playerSpeed) < 4) {
        state.bustTimer += dt;
        if (state.bustTimer > 1.6) state.busted = true;
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
    }
    for (let i = policeCars.length - 1; i >= 0; i -= 1) {
      if (policeCars[i].dead) {
        scene.remove(policeCars[i].group);
        policeCars.splice(i, 1);
      }
    }
    // Foot officers: only a threat while the player is on foot.
    const wantCops = !inCar && state.wanted >= 2 ? Math.min(2, state.wanted - 1) : 0;
    while (cops.length < wantCops) spawnFootCop(player.x, player.z);
    while (cops.length > wantCops) removeCop(cops[cops.length - 1]);
    for (const cop of cops) {
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dy = want - cop.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      cop.yaw += dy * Math.min(1, dt * 8);
      cop.x += Math.sin(cop.yaw) * 7.5 * dt;
      cop.z += Math.cos(cop.yaw) * 7.5 * dt;
      cop.phase += dt * 14;
      cop.legL.rotation.x = Math.sin(cop.phase) * 0.7;
      cop.legR.rotation.x = -Math.sin(cop.phase) * 0.7;
      cop.armL.rotation.x = -Math.sin(cop.phase) * 0.55;
      cop.armR.rotation.x = Math.sin(cop.phase) * 0.55;
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.yaw;
      if (d < 1.7) {
        state.bustTimer += dt;
        if (state.bustTimer > 1.0) state.busted = true;
      }
    }
  }

  function reset() {
    state.wanted = 0;
    state.heat = 0;
    state.quietTimer = 0;
    state.bustTimer = 0;
    state.busted = false;
    districtHeat.clear();
    lastPos = null;
    for (const car of policeCars) car.dead = true;
    policeCars = [];
    while (cops.length > 0) removeCop(cops[0]);
  }

  return {
    get wanted() {
      return state.wanted;
    },
    get busted() {
      return state.busted;
    },
    get bustTimer() {
      return state.bustTimer;
    },
    get policeCars() {
      return policeCars;
    },
    get footCops() {
      return cops;
    },
    addHeat,
    heatFor,
    setDistrictHeat,
    update,
    reset,
  };
}
