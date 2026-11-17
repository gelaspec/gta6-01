// Cassian Rowe on foot: a low-poly figure with a walk/run cycle, jump and
// punch, moved by the camera-relative WASD input and kept out of buildings
// by the city's collision boxes. Health, damage and the "busted" state live
// here; money and missions live in the game state.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clampToCity, collideCircle } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e8f86 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3440 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a075 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a2018 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairTop.position.y = 1.72;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.08, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  scene.add(group);

  const state = {
    group,
    x: 8,
    z: 128,
    y: 0,
    vy: 0,
    yaw: Math.PI,
    health: PLAYER.health,
    onGround: true,
    moving: false,
    speed: 0,
    punchTimer: 0,
    invulnerable: 0,
  };

  let walkPhase = 0;

  function update(dt, move, camYaw, city) {
    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.punchTimer > 0) state.punchTimer -= dt;
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Camera-relative movement: forward is where the camera looks.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const mx = sin * move.z + cos * move.x;
    const mz = cos * move.z - sin * move.x;
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.01;
    if (state.moving) {
      const tx = mx / len;
      const tz = mz / len;
      state.x += tx * speed * dt;
      state.z += tz * speed * dt;
      const targetYaw = Math.atan2(tx, tz);
      let dy = targetYaw - state.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      state.yaw += dy * Math.min(1, dt * 12);
      state.speed = speed;
      walkPhase += dt * speed * 1.6;
    } else {
      state.speed = 0;
      walkPhase += dt * 1.2;
    }
    // Jump and gravity.
    if (move.jump && state.onGround) {
      state.vy = PLAYER.jumpSpeed;
      state.onGround = false;
    }
    if (!state.onGround) {
      state.vy -= PLAYER.gravity * dt;
      state.y += state.vy * dt;
      if (state.y <= 0) {
        state.y = 0;
        state.vy = 0;
        state.onGround = true;
      }
    }
    // Collisions and bounds.
    const fixed = collideCircle(city, state.x, state.z, PLAYER.radius);
    state.x = fixed.x;
    state.z = fixed.z;
    const clamped = clampToCity(state.x, state.z);
    state.x = clamped.x;
    state.z = clamped.z;

    // Pose: legs swing with the stride, arms counter-swing, punch extends one arm.
    const swing = state.moving ? Math.sin(walkPhase) * 0.7 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    if (state.punchTimer > 0) {
      armR.rotation.x = -1.5;
      armL.rotation.x = 0.4;
    } else {
      armR.rotation.x = -swing * 0.8;
      armL.rotation.x = swing * 0.8;
    }
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.yaw;
    group.visible = true;
  }

  function takeDamage(amount) {
    if (state.invulnerable > 0) return false;
    state.health = Math.max(0, state.health - amount);
    state.invulnerable = 0.6;
    return true;
  }

  function heal(amount) {
    state.health = Math.min(PLAYER.health, state.health + amount);
  }

  function punch() {
    state.punchTimer = 0.35;
  }

  function teleport(x, z, yaw) {
    state.x = x;
    state.z = z;
    state.y = 0;
    state.vy = 0;
    if (yaw !== undefined) state.yaw = yaw;
    group.position.set(x, 0, z);
    group.rotation.y = state.yaw;
  }

  // Return the live state object itself (not a spread copy): the game reads
  // player.x / player.yaw / player.health from outside, so those must stay
  // the same fields update() and teleport() write.
  return Object.assign(state, { update, takeDamage, heal, punch, teleport });
}
