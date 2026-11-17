// Particles and tracers: one pooled THREE.Points cloud for smoke, sparks and
// bursts, plus short-lived line tracers for gunfire. Nothing here allocates
// per frame after boot — dead particles are recycled into the pool.

import * as THREE from 'three';

const MAX = 320;

export function createEffects(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const grav = new Float32Array(MAX);
  let cursor = 0;

  const color = new THREE.Color();

  function spawn(x, y, z, hex, count, speed, lifetime, gravity) {
    color.setHex(hex);
    for (let i = 0; i < count; i += 1) {
      const idx = cursor;
      cursor = (cursor + 1) % MAX;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      vel[idx * 3] = Math.cos(a) * Math.cos(b) * s;
      vel[idx * 3 + 1] = Math.abs(Math.sin(b)) * s * 0.7 + speed * 0.2;
      vel[idx * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;
      life[idx] = lifetime * (0.6 + Math.random() * 0.7);
      maxLife[idx] = life[idx];
      grav[idx] = gravity;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  function tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(g, tracerMat.clone());
    line.userData.life = 0.09;
    scene.add(line);
    tracers.push(line);
  }

  // Muzzle flash: a quick yellow burst at the barrel, toward `dir`.
  function muzzle(origin, dir) {
    const p = origin.clone().add(dir.clone().multiplyScalar(1.2));
    p.y -= 0.25;
    spawn(p.x, p.y, p.z, 0xffd27a, 10, 6, 0.18, 0);
  }

  function update(dt) {
    for (let i = 0; i < MAX; i += 1) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      vel[i * 3 + 1] -= grav[i] * dt;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const fade = life[i] / maxLife[i];
      colors[i * 3] *= 0.985 + fade * 0.01;
      colors[i * 3 + 1] *= 0.985 + fade * 0.01;
      colors[i * 3 + 2] *= 0.985 + fade * 0.01;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const line = tracers[i];
      line.userData.life -= dt;
      line.material.opacity = Math.max(0, line.userData.life / 0.09) * 0.9;
      if (line.userData.life <= 0) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        tracers.splice(i, 1);
      }
    }
  }

  return {
    burst: (pos, hex, count, speed) => spawn(pos.x, pos.y, pos.z, hex, count, speed, 0.7, 6),
    sparks: (pos, hex) => spawn(pos.x, pos.y, pos.z, hex, 8, 7, 0.35, 9),
    smoke: (pos) => spawn(pos.x, pos.y + 0.3, pos.z, 0x9a9a9a, 2, 1.2, 1.1, -1.5),
    muzzle,
    tracer,
    update,
  };
}
