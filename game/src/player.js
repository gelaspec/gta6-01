// Player: Cassian Rowe on foot. A low-poly figure built from boxes
// (vest, belt, shoes, hair), WASD movement with a run and a jump,
// simple collision against building colliders, and damage handling.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { isDown } from './input.js';
import { pointBlocked, clampToCity } from './city.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0xff2e88, 0x2ec5ff, 0x7dff5e, 0xffd60a, 0x2f6fb2, 0xa55cff];

export function buildFigure(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin ?? rng.pick(SKINS);
  const shirt = opts.shirt ?? rng.pick(SHIRTS);
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x232a38 });
  const hairMat = new THREE.MeshLambertMaterial({ color: opts.hair ?? 0x1c1712 });

  // Torso with a vest stripe, belt and shoes so the figure reads
  // as a person even at a distance.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirtMat);
  torso.position.y = 1.15;
  g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.5, 0.44), new THREE.MeshLambertMaterial({ color: 0x1c2330 }));
  vest.position.y = 1.2;
  g.add(vest);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.42), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
  belt.position.y = 0.78;
  g.add(belt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.85;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), hairMat);
  hair.position.y = 2.1;
  g.add(hair);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), skinMat);
  armL.position.set(-0.48, 1.15, 0);
  armL.name = 'armL';
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), skinMat);
  armR.position.set(0.48, 1.15, 0);
  armR.name = 'armR';
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), pantsMat);
  legL.position.set(-0.18, 0.35, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), pantsMat);
  legR.position.set(0.18, 0.35, 0);
  legR.name = 'legR';
  g.add(legR);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  shoeL.position.set(-0.18, 0.06, 0.06);
  g.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.18;
  g.add(shoeR);
  return g;
}

export function createPlayer(scene, rng, x, z) {
  const mesh = buildFigure(rng, { shirt: 0xff2e88, skin: 0xe8b98a, hair: 0x1c1712 });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    y: 0,
    vy: 0,
    heading: Math.PI,
    speed: 0,
    health: CONFIG.playerHealth,
    grounded: true,
    walkPhase: 0,
    inCar: null,
    punching: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.inCar) {
    p.x = p.inCar.x;
    p.z = p.inCar.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.visible = false;
    return;
  }
  p.mesh.visible = true;

  // Camera-relative movement: forward follows the rig yaw.
  const yaw = G.rig.yaw;
  let mx = 0;
  let mz = 0;
  if (isDown(input, 'KeyW', 'ArrowUp')) {
    mx += Math.sin(yaw);
    mz += Math.cos(yaw);
  }
  if (isDown(input, 'KeyS', 'ArrowDown')) {
    mx -= Math.sin(yaw);
    mz -= Math.cos(yaw);
  }
  if (isDown(input, 'KeyA', 'ArrowLeft')) {
    mx += Math.cos(yaw);
    mz -= Math.sin(yaw);
  }
  if (isDown(input, 'KeyD', 'ArrowRight')) {
    mx -= Math.cos(yaw);
    mz += Math.sin(yaw);
  }
  const len = Math.hypot(mx, mz);
  const running = isDown(input, 'ShiftLeft', 'ShiftRight');
  const speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (!pointBlocked(G.city.colliders, nx, p.z, 0.6)) p.x = nx;
    if (!pointBlocked(G.city.colliders, p.x, nz, 0.6)) p.z = nz;
    const target = Math.atan2(mx, mz);
    p.heading = wrapAngle(p.heading + wrapAngle(target - p.heading) * Math.min(1, dt * 12));
    p.speed = speed;
    p.walkPhase += dt * speed * 1.6;
  } else {
    p.speed = 0;
  }

  // Jump + gravity.
  if (isDown(input, 'Space') && p.grounded) {
    p.vy = CONFIG.jumpSpeed;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= CONFIG.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }

  const pos = clampToCity(p.x, p.z);
  p.x = pos.x;
  p.z = pos.z;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;

  // Walk-cycle swing on the limbs.
  const swing = p.speed > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  const armL = p.mesh.getObjectByName('armL');
  const armR = p.mesh.getObjectByName('armR');
  const legL = p.mesh.getObjectByName('legL');
  const legR = p.mesh.getObjectByName('legR');
  if (armL) armL.rotation.x = swing;
  if (armR) armR.rotation.x = -swing;
  if (legL) legL.rotation.x = -swing;
  if (legR) legR.rotation.x = swing;

  if (p.punching > 0) {
    p.punching -= dt;
    if (armR) armR.rotation.x = -1.4;
  }

  // Mouse drag orbits the camera around the player.
  if (input.dragX !== 0) {
    G.rig.yaw -= input.dragX * 0.005;
    G.rig.pitch = clamp(G.rig.pitch + input.dragY * 0.003, 0.1, 0.9);
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  p.health = Math.max(0, p.health - amount);
  G.rig.shake = Math.min(1.2, (G.rig.shake || 0) + 0.4);
  if (p.health <= 0) {
    G.events.push({ type: 'wasted' });
  }
}
