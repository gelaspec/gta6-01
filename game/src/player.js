// Cassian Rowe on foot: WASD movement relative to the camera, run,
// jump, punch, and entering cars. The character is a simple
// articulated figure built from boxes so it reads at any distance.
// v4 gives Cassian a bright jacket so the hero pops against the
// lighter roads.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, wrapAngle, angleLerp } from './random.js';
import { pointBlocked } from './city.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0xff2e88, 0x2ec5ff, 0x7dff5e, 0xffd60a, 0x2f6fb2, 0xa55cff];

export function buildFigure(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin ?? rng.pick(SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: opts.shirt ?? rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? 0x2a2f38 });
  const hair = new THREE.MeshLambertMaterial({ color: opts.hair ?? 0x1c1712 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.42), skin);
  head.position.y = 1.72;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.46), hair);
  hairM.position.y = 1.98;
  g.add(hairM);
  if (opts.hat) {
    const hatMat = new THREE.MeshLambertMaterial({ color: opts.hat });
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.16, 10), hatMat);
    hat.position.y = 2.08;
    g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 10), hatMat);
    brim.position.y = 2.0;
    g.add(brim);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.3), pants);
  legL.position.set(-0.18, 0.31, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  g.add(armR);
  if (opts.bag) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.12), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
    bag.position.set(0, 1.1, -0.28);
    g.add(bag);
  }
  g.userData.parts = { torso, head, legL, legR, armL, armR };
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
  const rig = G.rig;
  if (p.inCar) return;
  if (G.screen !== 'play') return;

  // Camera orbit from mouse drag.
  rig.yaw -= input.dragX * 0.005;
  rig.pitch = clamp(rig.pitch + input.dragY * 0.003, 0.08, 0.9);

  let fx = 0;
  let fz = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) fz += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) fz -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) fx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) fx += 1;
  const moving = fx !== 0 || fz !== 0;
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;

  if (moving) {
    const len = Math.hypot(fx, fz);
    fx /= len;
    fz /= len;
    const sin = Math.sin(rig.yaw);
    const cos = Math.cos(rig.yaw);
    const wx = fx * cos - fz * sin;
    const wz = fx * sin + fz * cos;
    const targetHeading = Math.atan2(wx, wz);
    p.heading = angleLerp(p.heading, targetHeading, Math.min(1, dt * 12));
    const nx = p.x + wx * speed * dt;
    const nz = p.z + wz * speed * dt;
    if (!pointBlocked(G.city.colliders, nx, p.z, 0.5)) p.x = nx;
    if (!pointBlocked(G.city.colliders, p.x, nz, 0.5)) p.z = nz;
    p.speed = speed;
    p.walkPhase += dt * speed * 1.6;
  } else {
    p.speed = 0;
  }

  // Jump and gravity.
  if (input.keys.has('Space') && p.grounded) {
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

  // Walk swing + punch swing on the figure.
  const parts = p.mesh.userData.parts;
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8;
  parts.armR.rotation.x = swing * 0.8;
  if (p.punching > 0) {
    p.punching -= dt;
    parts.armR.rotation.x = -1.6 * Math.max(0, p.punching / 0.28);
  }

  // Keep inside the map.
  if (p.x < -150) p.x = -150;
  if (p.x > 205) p.x = 205;
  if (p.z < -150) p.z = -150;
  if (p.z > 150) p.z = 150;

  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  rig.mode = 'follow';
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (G.screen !== 'play' || p.health <= 0) return;
  p.health = Math.max(0, p.health - amount);
  G.hud.flashDamage();
  if (p.health <= 0) G.events.push({ type: 'wasted' });
}
