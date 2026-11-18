// Pedestrians: people strolling the sidewalks on fixed walking
// lines, who flee when a shot is fired or a car clips them. A few
// wear hats or carry bags so the crowd is not one repeated figure.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2D } from './random.js';
import { buildFigure } from './player.js';
import { clampToCity } from './city.js';

const LINES = [
  { x: -120, z0: -120, z1: 120, vertical: true },
  { x: 120, z0: -120, z1: 120, vertical: true },
  { x: 0, z0: -120, z1: 120, vertical: true },
  { x: -80, z0: -120, z1: 120, vertical: true },
  { x: 80, z0: -120, z1: 120, vertical: true },
  { z: -80, x0: -120, x1: 120, vertical: false },
  { z: 80, x0: -120, x1: 120, vertical: false },
  { z: 0, x0: -120, x1: 120, vertical: false },
  { z: 40, x0: -120, x1: 120, vertical: false },
];

export function createPedestrians(scene, rng, city) {
  const peds = [];
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const line = rng.pick(LINES);
    const t = rng.next();
    const x = line.vertical ? line.x + rng.sign() * 7.5 : line.x0 + (line.x1 - line.x0) * t;
    const z = line.vertical ? line.z0 + (line.z1 - line.z0) * t : line.z + rng.sign() * 7.5;
    const mesh = buildFigure(rng, {});
    // Hats on about a third, bags on about a quarter.
    if (rng.chance(0.32)) {
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.12, 10),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xffd60a, 0x2ec5ff, 0xf2f2f2, 0xff3b30]) }),
      );
      hat.position.y = 2.2;
      mesh.add(hat);
    }
    if (rng.chance(0.25)) {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.16),
        new THREE.MeshLambertMaterial({ color: rng.pick([0x8a5a3b, 0x232a38, 0xa55cff]) }),
      );
      bag.position.set(0.5, 1.1, -0.1);
      mesh.add(bag);
    }
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      speed: CONFIG.pedSpeed * rng.range(0.8, 1.3),
      line,
      dir: rng.sign(),
      fleeing: false,
      fleeT: 0,
      idle: 0,
      shoutAt: -100,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const player = G.player;
  for (const ped of G.peds) {
    // A gunshot or a near miss nearby sends the crowd running.
    if (!ped.fleeing) {
      const nearPlayer = dist2D(ped.x, ped.z, player.x, player.z);
      if (nearPlayer < 6 && G.combat && G.combat.lastShotAt > G.time - 0.4) {
        ped.fleeing = true;
        ped.fleeT = 3;
      }
    }
    if (ped.fleeing) {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.x - player.x, ped.z - player.z);
      ped.heading = away;
      ped.x += Math.sin(away) * CONFIG.pedFleeSpeed * dt;
      ped.z += Math.cos(away) * CONFIG.pedFleeSpeed * dt;
      if (ped.fleeT <= 0) ped.fleeing = false;
    } else if (ped.idle > 0) {
      ped.idle -= dt;
    } else {
      // Stroll along the sidewalk line, turning at the ends.
      const step = ped.speed * ped.dir * dt;
      if (ped.line.vertical) {
        ped.z += step;
        if (ped.z > ped.line.z1 - 5 || ped.z < ped.line.z0 + 5) ped.dir *= -1;
        ped.heading = ped.dir > 0 ? 0 : Math.PI;
      } else {
        ped.x += step;
        if (ped.x > ped.line.x1 - 5 || ped.x < ped.line.x0 + 5) ped.dir *= -1;
        ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (G.rng.chance(0.001)) ped.idle = 2;
    }
    const pos = clampToCity(ped.x, ped.z);
    ped.x = pos.x;
    ped.z = pos.z;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // Fleeing pedestrians pump their arms; strollers swing gently.
    const swing = Math.sin(G.time * (ped.fleeing ? 14 : 5) + ped.x) * (ped.fleeing ? 0.9 : 0.4);
    const armL = ped.mesh.getObjectByName('armL');
    const armR = ped.mesh.getObjectByName('armR');
    if (armL) armL.rotation.x = swing;
    if (armR) armR.rotation.x = -swing;
  }
}

export function hitPedestrian(G, ped) {
  ped.fleeing = true;
  ped.fleeT = 5;
  G.events.push({ type: 'crime', amount: 1, reason: 'Hit a pedestrian' });
  G.effects.hit(ped.x, 1.2, ped.z);
  G.audio.crash();
}
