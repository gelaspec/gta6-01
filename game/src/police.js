// The MBPD: wanted level 0-5, patrol cars that chase and ram, foot cops,
// and the helicopter with its spotlight from 3 stars up. HEAT is the
// all-out response; LOCKDOWN is 5 stars. Wanted cools off when the player
// breaks line of sight and distance for long enough.

import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angleDelta, dist2d } from './random.js';
import { makeCarMesh, makeHeliMesh, makePersonMesh } from './render.js';

const WANTED_CARS = [0, 2, 3, 4, 5, 6];
const WANTED_COPS = [0, 0, 1, 2, 3, 4];

export function createPolice(THREE, city, scene) {
  const state = {
    wanted: 0,
    heat: false,
    lockdown: false,
    units: [],
    cops: [],
    heli: null,
    quietT: 0,
    flashT: 0,
    nextId: 0,
  };

  const heliMesh = makeHeliMesh();
  heliMesh.visible = false;
  scene.add(heliMesh);
  state.heli = { mesh: heliMesh, pos: new THREE.Vector3(0, 46, 0), active: false };

  function spawnCar() {
    const spec = { name: 'MBPD CRUISER', color: 0x1c1e26, top: 185, accel: 30, grip: 0.95, police: true };
    const mesh = makeCarMesh(0x1c1e26, { police: true });
    // White doors: a pale box over the middle so the cruiser reads as a
    // black-and-white from any angle.
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.5, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    doors.position.set(0, 0.66, 0.1);
    mesh.add(doors);
    scene.add(mesh);
    const name = CFG.police.unitNames[state.nextId % CFG.police.unitNames.length];
    state.nextId++;
    const unit = {
      name,
      mesh,
      pos: new THREE.Vector3(0, 0, 0),
      heading: 0,
      speed: 0,
      status: 'PURSUIT',
    };
    state.units.push(unit);
    return unit;
  }

  function spawnCop(x, z) {
    const mesh = makePersonMesh(0x1c1e26, 0x1c1e26, 0xe8b88a, 0x1c1e26);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = { mesh, pos: mesh.position, heading: 0, speed: 5.5, down: false, downT: 0 };
    state.cops.push(cop);
    return cop;
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    state.units.splice(state.units.indexOf(unit), 1);
  }

  function removeCop(cop) {
    scene.remove(cop.mesh);
    state.cops.splice(state.cops.indexOf(cop), 1);
  }

  function syncFleet(aroundPos) {
    while (state.units.length < WANTED_CARS[state.wanted]) {
      const u = spawnCar();
      if (aroundPos) {
        const a = Math.random() * Math.PI * 2;
        u.pos.set(aroundPos.x + Math.sin(a) * 70, 0, aroundPos.z + Math.cos(a) * 70);
        u.heading = Math.atan2(aroundPos.x - u.pos.x, aroundPos.z - u.pos.z);
      }
    }
    while (state.units.length > WANTED_CARS[state.wanted]) removeUnit(state.units[state.units.length - 1]);
    while (state.cops.length < WANTED_COPS[state.wanted]) {
      const base = aroundPos || { x: 0, z: 0 };
      spawnCop(base.x + (Math.random() - 0.5) * 40, base.z + (Math.random() - 0.5) * 40);
    }
    while (state.cops.length > WANTED_COPS[state.wanted]) removeCop(state.cops[state.cops.length - 1]);
    state.heli.active = state.wanted >= 3;
  }

  function setWanted(n) {
    state.wanted = clamp(Math.round(n), 0, 5);
    state.heat = state.wanted >= 3;
    state.lockdown = state.wanted >= 5;
    state.quietT = 0;
    // Spawn the fleet now (at the origin — the caller places them, or the
    // update loop repositions new units around the player). Shots read the
    // units immediately after setting wanted, so this cannot wait for the
    // next frame.
    syncFleet(null);
  }

  function addCrime(n) {
    setWanted(state.wanted + n);
  }

  function unitInfo(playerPos) {
    return state.units.map((u) => {
      const d = Math.round(dist2d(u.pos.x, u.pos.z, playerPos.x, playerPos.z));
      return { name: u.name, dist: d, status: u.status };
    });
  }

  function update(dt, player, heroCar) {
    const px = player.pos.x;
    const pz = player.pos.z;
    state.flashT += dt;

    // Match the fleet to the wanted level (new units spawn around the player).
    syncFleet(player.pos);

    // Patrol cars: steer at the player, ram when close, flash light bars.
    for (const u of state.units) {
      const d = dist2d(u.pos.x, u.pos.z, px, pz);
      const wantHeading = Math.atan2(px - u.pos.x, pz - u.pos.z);
      u.heading += angleDelta(u.heading, wantHeading) * Math.min(1, dt * 2.2);
      const target = d > 12 ? CFG.tuning.policeChaseSpeed : CFG.tuning.policeChaseSpeed * 0.55;
      u.speed += (target - u.speed) * Math.min(1, dt * 1.2);
      const nx = u.pos.x + Math.sin(u.heading) * u.speed * dt;
      const nz = u.pos.z + Math.cos(u.heading) * u.speed * dt;
      if (!city.collides(nx, u.pos.z, 1.6)) u.pos.x = nx;
      if (!city.collides(u.pos.x, nz, 1.6)) u.pos.z = nz;
      city.pushOut(u.pos, 1.6);
      u.status = d < 10 ? 'RAMMING' : d < 45 ? 'PURSUIT' : 'CLOSING IN';
      u.mesh.position.copy(u.pos);
      u.mesh.rotation.y = u.heading;
      const bar = u.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(state.flashT * 6) % 2 === 0;
        bar.userData.red.material.color.setHex(on ? 0xff2020 : 0x881010);
        bar.userData.blue.material.color.setHex(on ? 0x102080 : 0x2040ff);
      }
      // Ramming the hero car damages it and shoves it.
      if (heroCar && d < 4.5) {
        heroCar.condition = Math.max(0, heroCar.condition - dt * 6);
        heroCar.speed *= 0.985;
      }
    }

    // Foot cops run at the player on foot.
    for (const cop of state.cops) {
      if (cop.down) {
        cop.downT -= dt;
        if (cop.downT <= 0) {
          cop.down = false;
          cop.mesh.rotation.x = 0;
          cop.mesh.position.y = 0;
        }
        continue;
      }
      const d = dist2d(cop.pos.x, cop.pos.z, px, pz);
      const wantHeading = Math.atan2(px - cop.pos.x, pz - cop.pos.z);
      cop.heading += angleDelta(cop.heading, wantHeading) * Math.min(1, dt * 4);
      const nx = cop.pos.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.pos.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!city.collides(nx, cop.pos.z, 0.6)) cop.pos.x = nx;
      if (!city.collides(cop.pos.x, nz, 0.6)) cop.pos.z = nz;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.heading;
      const swing = Math.sin(state.flashT * 9 + cop.heading) * 0.5;
      cop.mesh.userData.legL.rotation.x = swing;
      cop.mesh.userData.legR.rotation.x = -swing;
      if (d < 2.2 && player.onFoot) {
        player.hp = Math.max(0, player.hp - dt * 14);
      }
    }

    // Helicopter: hovers above the player, spotlight cone on them.
    const h = state.heli;
    h.mesh.visible = h.active;
    if (h.active) {
      h.pos.x += (px + 8 - h.pos.x) * Math.min(1, dt * 1.4);
      h.pos.z += (pz - 6 - h.pos.z) * Math.min(1, dt * 1.4);
      h.pos.y = 46 + Math.sin(state.flashT * 1.3) * 2;
      h.mesh.position.copy(h.pos);
      h.mesh.rotation.y += dt * 0.4;
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.spot.lookAt(px, 0, pz);
    }

    // Cool-off: far away and quiet for a while, wanted drops a star.
    const nearest = state.units.reduce((m, u) => Math.min(m, dist2d(u.pos.x, u.pos.z, px, pz)), 1e9);
    if (state.wanted > 0 && nearest > CFG.tuning.wantedDecayDist) {
      state.quietT += dt;
      if (state.quietT > CFG.tuning.wantedDecayTime) setWanted(state.wanted - 1);
    } else {
      state.quietT = 0;
    }
  }

  // Return the state object itself (methods attached), NOT a spread copy:
  // a spread would freeze the primitives (wanted, heat, lockdown) at their
  // initial values, so the HUD would show 0 stars forever.
  Object.assign(state, { setWanted, addCrime, unitInfo, update });
  return state;
}
