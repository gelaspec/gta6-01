// Effects: small pooled particle bursts — sparks for gunfire and
// impacts, tyre smoke for hard driving, muzzle flashes for shots.
// One shared pool per colour family, recycled in place, so the
// effect never allocates during play.

import * as THREE from 'three';

function makePool(scene, count, color, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { points, pos, vel, life, count, cursor: 0 };
}

function spawn(pool, x, y, z, spread, up, life) {
  for (let n = 0; n < 6; n++) {
    const i = pool.cursor;
    pool.cursor = (pool.cursor + 1) % pool.count;
    pool.pos[i * 3] = x;
    pool.pos[i * 3 + 1] = y;
    pool.pos[i * 3 + 2] = z;
    pool.vel[i * 3] = (Math.random() - 0.5) * spread;
    pool.vel[i * 3 + 1] = Math.random() * up;
    pool.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    pool.life[i] = life * (0.6 + Math.random() * 0.6);
  }
  pool.points.geometry.attributes.position.needsUpdate = true;
}

function tickPool(pool, dt) {
  let alive = false;
  for (let i = 0; i < pool.count; i++) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      pool.pos[i * 3 + 1] = -100;
      continue;
    }
    alive = true;
    pool.pos[i * 3] += pool.vel[i * 3] * dt;
    pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
    pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
    pool.vel[i * 3 + 1] -= 4 * dt;
  }
  if (alive) pool.points.geometry.attributes.position.needsUpdate = true;
}

export function createEffects(scene) {
  return {
    sparks: makePool(scene, 240, 0xffd34d, 0.35),
    smoke: makePool(scene, 240, 0x9aa2b0, 0.9),
    blood: makePool(scene, 120, 0xff5d47, 0.3),
  };
}

export function updateEffects(pool, dt) {
  tickPool(pool.sparks, dt);
  tickPool(pool.smoke, dt);
  tickPool(pool.blood, dt);
}

export function makeEffectsApi(pool) {
  return {
    burst(x, y, z) {
      spawn(pool.sparks, x, y, z, 6, 4, 0.5);
    },
    smoke(x, y, z) {
      spawn(pool.smoke, x, y, z, 1.5, 2.5, 1.1);
    },
    muzzle(x, y, z) {
      spawn(pool.sparks, x, y, z, 3, 2, 0.18);
    },
    hit(x, y, z) {
      spawn(pool.blood, x, y, z, 4, 3, 0.6);
    },
  };
}
