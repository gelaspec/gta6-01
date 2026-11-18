// Pedestrians: they stroll the sidewalks, chat in place, and flee from
// gunfire, crashes and speeding cars. Each one is a small articulated
// figure with its own colours, height and accessories.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2D } from './random.js';
import { buildFigure } from './player.js';
import { pointBlocked } from './city.js';

const LINES = [
  'I saw nothing! Nothing!',
  'Did you see that car?!',
  'The Bay never sleeps.',
  'Inez runs this town, kid.',
  'Nice wheels. Borrowed?',
  'Watch the road!',
  'Sunset over the pier again…',
];

export function createPedestrians(scene, rng, city) {
  const peds = [];
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const x = rng.range(-135, 135);
    const z = rng.range(-135, 135);
    if (pointBlocked(city.colliders, x, z, 1)) continue;
    const scale = rng.range(0.88, 1.12);
    const mesh = buildFigure(rng, {
      hat: rng.chance(0.32) ? rng.pick([0x8a2f2f, 0x2f4a6b, 0xd8c98a]) : null,
      bag: rng.chance(0.25),
    });
    mesh.scale.setScalar(scale);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      speed: CONFIG.pedSpeed * rng.range(0.7, 1.3),
      phase: rng.range(0, Math.PI * 2),
      fleeing: 0,
      fleeX: 0,
      fleeZ: 0,
      line: rng.pick(LINES),
      lineAt: 0,
      idle: rng.chance(0.2) ? rng.range(2, 6) : 0,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const player = G.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  const danger = G.combat.shotsFired > 0 && G.time - G.combat.lastShotAt < 2.5;
  for (const ped of G.peds) {
    const d = dist2D(ped.x, ped.z, px, pz);
    const carClose = G.player.inCar && Math.abs(G.player.inCar.speed) > 14 && d < 12;
    if ((danger && d < 26) || carClose) {
      ped.fleeing = 2.5;
      ped.fleeX = ped.x - px;
      ped.fleeZ = ped.z - pz;
      const len = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
      ped.fleeX /= len;
      ped.fleeZ /= len;
    }
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const nx = ped.x + ped.fleeX * CONFIG.pedFleeSpeed * dt;
      const nz = ped.z + ped.fleeZ * CONFIG.pedFleeSpeed * dt;
      if (!pointBlocked(G.city.colliders, nx, nz, 0.5)) {
        ped.x = nx;
        ped.z = nz;
      }
      ped.heading = Math.atan2(ped.fleeX, ped.fleeZ);
      ped.phase += dt * 14;
    } else if (ped.idle > 0) {
      ped.idle -= dt;
      ped.phase += dt * 1.5;
    } else {
      // Wander along the street grid: pick a new heading at intersections.
      if (Math.abs(ped.x % 40) < 1.2 || Math.abs(ped.z % 40) < 1.2) {
        if (G.rng.chance(0.02)) ped.heading += (G.rng.chance(0.5) ? 1 : -1) * (Math.PI / 2);
      }
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      if (pointBlocked(G.city.colliders, nx, nz, 0.5) || Math.abs(nx) > 140 || Math.abs(nz) > 140) {
        ped.heading += Math.PI / 2;
      } else {
        ped.x = nx;
        ped.z = nz;
      }
      ped.phase += dt * ped.speed * 2.4;
    }
    const parts = ped.mesh.userData.parts;
    const swing = Math.sin(ped.phase) * 0.5;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8;
    parts.armR.rotation.x = swing * 0.8;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // Speech bubble line when the player passes close.
    if (d < 7 && G.time - ped.lineAt > 14) {
      ped.lineAt = G.time;
      G.hud.toast(`Pedestrian: "${ped.line}"`);
    }
  }
}

// A pedestrian hit by the player's car or fist: they fall and the
// wanted level notices.
export function hitPedestrian(G, ped) {
  ped.fleeing = 3;
  ped.fleeX = ped.x - G.player.x;
  ped.fleeZ = ped.z - G.player.z;
  const len = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
  ped.fleeX /= len;
  ped.fleeZ /= len;
  G.events.push({ type: 'crime', amount: 1, reason: 'pedestrian down' });
  G.hud.toast('Pedestrian down — the MBPD saw that.');
}
