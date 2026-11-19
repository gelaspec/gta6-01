// Pedestrians: people walking the sidewalks who run away from gunfire,
// crashes and police chases. They make the city feel alive in every shot.

import * as THREE from 'three';
import { mulberry32, rngRange, rngPick, rngChance, dist2d } from './random.js';
import { makePersonMesh } from './render.js';

const SHIRTS = [0xe84e6a, 0x4e8ae8, 0x4ee88a, 0xe8c84e, 0xb46ae8, 0xe88a4e, 0x6ad8e8, 0xe8e8e8];
const PANTS = [0x2a2e38, 0x4a3a2e, 0x2e4a3a, 0x3a3a4a];

export function createPedestrians(THREE, city, seed, count) {
  const rng = mulberry32(seed);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint(rng);
    const shirt = rngPick(rng, SHIRTS);
    const pants = rngPick(rng, PANTS);
    const mesh = makePersonMesh(shirt, pants, rngPick(rng, [0xe8b88a, 0xc89066, 0x8a5a3a, 0xf0c8a0]), rngChance(rng, 0.4) ? rngPick(rng, SHIRTS) : null);
    mesh.position.set(p.x + rngRange(rng, -6, 6), 0, p.z + rngRange(rng, -6, 6));
    peds.push({
      mesh,
      pos: mesh.position,
      heading: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 1.2, 2.4),
      phase: rngRange(rng, 0, 6),
      flee: 0,
      target: null,
    });
  }

  function update(dt, danger) {
    for (const p of peds) {
      let fleeing = false;
      if (danger) {
        const d = dist2d(p.pos.x, p.pos.z, danger.x, danger.z);
        if (d < 16) {
          p.flee = 2.5;
          const away = Math.atan2(p.pos.x - danger.x, p.pos.z - danger.z);
          p.heading = away;
          fleeing = true;
        }
      }
      if (p.flee > 0) p.flee -= dt;
      const speed = p.flee > 0 ? 6.5 : p.speed;
      if (!p.target || dist2d(p.pos.x, p.pos.z, p.target.x, p.target.z) < 3) {
        const np = city.randomRoadPoint(mulberry32((Math.random() * 1e9) | 0));
        p.target = np;
      }
      if (!fleeing && p.target) {
        const want = Math.atan2(p.target.x - p.pos.x, p.target.z - p.pos.z);
        let dh = want - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        p.heading += dh * Math.min(1, dt * 3);
      }
      const nx = p.pos.x + Math.sin(p.heading) * speed * dt;
      const nz = p.pos.z + Math.cos(p.heading) * speed * dt;
      if (!city.collides(nx, p.pos.z, 0.6)) p.pos.x = nx;
      if (!city.collides(p.pos.x, nz, 0.6)) p.pos.z = nz;
      p.pos.x = Math.max(-256, Math.min(258, p.pos.x));
      p.pos.z = Math.max(-256, Math.min(256, p.pos.z));
      p.phase += dt * speed * 2.2;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * (p.flee > 0 ? 0.7 : 0.4);
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
    }
  }

  return { peds, update };
}
