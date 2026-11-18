// Particles: tire smoke, crash sparks, muzzle flashes and hit bursts.
// One pooled THREE.Points cloud per effect type, recycled every frame,
// so effects never allocate during play.

import * as THREE from 'three';

function makePool(scene, count, color, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }
  return { geo, points, parts, next: 0 };
}

function spawn(pool, x, y, z, spread, up, life) {
  const p = pool.parts[pool.next];
  pool.next = (pool.next + 1) % pool.parts.length;
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = (Math.random() - 0.5) * spread;
  p.vy = Math.random() * up;
  p.vz = (Math.random() - 0.5) * spread;
  p.life = life;
  p.max = life;
}

function tickPool(pool, dt) {
  const pos = pool.geo.attributes.position.array;
  for (let i = 0; i < pool.parts.length; i++) {
    const p = pool.parts[i];
    if (p.life > 0) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 2 * dt;
      if (p.life <= 0) p.y = -100;
    }
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
  }
  pool.geo.attributes.position.needsUpdate = true;
}

export function createEffects(scene) {
  return {
    smoke: makePool(scene, 120, 0xb9bfc9, 1.6),
    sparks: makePool(scene, 80, 0xffc46b, 0.7),
    flash: makePool(scene, 40, 0xfff2b0, 1.1),
  };
}

export function updateEffects(effects, dt) {
  tickPool(effects.smoke, dt);
  tickPool(effects.sparks, dt);
  tickPool(effects.flash, dt);
}

export function makeEffectsApi(effects) {
  return {
    tireSmoke(x, z) {
      for (let i = 0; i < 4; i++) spawn(effects.smoke, x, 0.4, z, 2, 1.6, 0.9);
    },
    crashSparks(x, z) {
      for (let i = 0; i < 10; i++) spawn(effects.sparks, x, 1, z, 7, 4, 0.6);
    },
    hitSparks(x, y, z) {
      for (let i = 0; i < 8; i++) spawn(effects.sparks, x, y, z, 6, 3, 0.5);
    },
    muzzleFlash(x, z, heading) {
      const fx = x + Math.sin(heading) * 1.2;
      const fz = z + Math.cos(heading) * 1.2;
      for (let i = 0; i < 5; i++) spawn(effects.flash, fx, 1.3, fz, 2, 1, 0.16);
    },
  };
}
