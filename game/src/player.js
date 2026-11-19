// Cassian Rowe on foot: WASD movement relative to the camera, run, jump,
// entering and leaving cars. The mesh is a simple low-poly figure whose
// legs swing while he walks.

import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angleDelta } from './random.js';
import { makePersonMesh } from './render.js';

export function createPlayer(THREE, city) {
  const mesh = makePersonMesh(0x2e6fd8, 0x2a2e38, 0xe8b88a, 0xff2e88);
  mesh.visible = true;
  const state = {
    mesh,
    pos: new THREE.Vector3(-180, 0, 36),
    velY: 0,
    heading: 0,
    onFoot: true,
    car: null,
    hp: 100,
    grounded: true,
    walkPhase: 0,
    speed: 0,
  };

  function place(x, z, heading = 0) {
    state.pos.set(x, 0, z);
    state.heading = heading;
    state.velY = 0;
    state.onFoot = true;
    state.car = null;
    mesh.visible = true;
    syncMesh();
  }

  function syncMesh() {
    mesh.position.copy(state.pos);
    mesh.rotation.y = state.heading;
    const swing = state.onFoot && state.speed > 0.5 ? Math.sin(state.walkPhase) * 0.5 : 0;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
  }

  function update(dt, input, camYaw) {
    if (!state.onFoot) {
      // Riding: the mesh hides inside the car; position follows the car.
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const ax = input.axis();
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const top = run ? CFG.tuning.runSpeed : CFG.tuning.walkSpeed;
    // Movement is camera-relative: W runs away from the camera.
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = -fz;
    const rz = fx;
    let mx = fx * ax.y + rx * ax.x;
    let mz = fz * ax.y + rz * ax.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      state.heading += angleDelta(state.heading, targetHeading) * Math.min(1, dt * 12);
      const nx = state.pos.x + mx * top * dt;
      const nz = state.pos.z + mz * top * dt;
      if (!city.collides(nx, state.pos.z, 0.7)) state.pos.x = nx;
      if (!city.collides(state.pos.x, nz, 0.7)) state.pos.z = nz;
      state.speed = top;
      state.walkPhase += dt * top * 1.6;
    } else {
      state.speed = 0;
    }
    if (input.wasPressed('Space') && state.grounded) {
      state.velY = CFG.tuning.jumpSpeed;
      state.grounded = false;
    }
    if (!state.grounded) {
      state.velY -= CFG.tuning.gravity * dt;
      state.pos.y += state.velY * dt;
      if (state.pos.y <= 0) {
        state.pos.y = 0;
        state.velY = 0;
        state.grounded = true;
      }
    }
    city.pushOut(state.pos, 0.7);
    state.pos.x = clamp(state.pos.x, -258, 400);
    state.pos.z = clamp(state.pos.z, -258, 258);
    syncMesh();
  }

  function enterCar(car) {
    state.car = car;
    state.onFoot = false;
    mesh.visible = false;
  }

  function exitCar() {
    if (!state.car) return null;
    const car = state.car;
    state.car = null;
    state.onFoot = true;
    // Step out to the driver's side.
    const sx = Math.cos(car.heading) * 2.2;
    const sz = -Math.sin(car.heading) * 2.2;
    state.pos.set(car.pos.x + sx, 0, car.pos.z + sz);
    state.heading = car.heading;
    mesh.visible = true;
    syncMesh();
    return car;
  }

  // Return the state object itself (methods attached), NOT a spread copy:
  // a spread would freeze the primitives (onFoot, car, heading, speed, hp)
  // at their initial values, so the rest of the game would never see the
  // player enter a car or take damage.
  Object.assign(state, { place, update, enterCar, exitCar, syncMesh });
  return state;
}
