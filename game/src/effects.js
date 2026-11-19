// Meridian Bay — particles and one-shot effects: impact bursts, tyre smoke,
// muzzle flash light, pickup sparkles. One pooled Points cloud, no per-frame
// allocation.
import * as THREE from 'three';

export function createEffects(scene) {
  const MAX = 400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1 });
  let cursor = 0;
  const tmpColor = new THREE.Color();

  function spawn(x, y, z, hex, count, speed = 6, up = 4, life = 0.7) {
    tmpColor.setHex(hex);
    for (let n = 0; n < count; n++) {
      const p = parts[cursor];
      cursor = (cursor + 1) % MAX;
      p.alive = true;
      p.x = x; p.y = y; p.z = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = up * (0.4 + Math.random() * 0.9);
      p.max = life * (0.6 + Math.random() * 0.7);
      p.life = p.max;
      p.r = tmpColor.r; p.g = tmpColor.g; p.b = tmpColor.b;
    }
  }

  function update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (!p.alive) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const f = p.life / p.max;
      colors[i * 3] = p.r * f;
      colors[i * 3 + 1] = p.g * f;
      colors[i * 3 + 2] = p.b * f;
    }
    if (any) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  }

  const flashLight = new THREE.PointLight(0xffe9a8, 0, 14, 1.8);
  scene.add(flashLight);
  let flashT = 0;
  function muzzleFlash(pos) {
    flashLight.position.set(pos.x, pos.y + 1.4, pos.z);
    flashLight.intensity = 6;
    flashT = 0.07;
    spawn(pos.x, pos.y + 1.3, pos.z, 0xffe9a8, 8, 3, 1, 0.3);
  }
  function impact(pos) { spawn(pos.x, pos.y + 0.5, pos.z, 0xffd54f, 14, 7, 5, 0.6); }
  function smoke(pos) { spawn(pos.x, pos.y + 0.3, pos.z, 0x9aa4ae, 3, 1.2, 1.6, 0.9); }
  function sparkle(pos) { spawn(pos.x, pos.y + 0.6, pos.z, 0x39d353, 16, 3, 4, 0.9); }

  function updateFlash(dt) {
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0) flashLight.intensity = 0;
    }
  }

  return { update, muzzleFlash, impact, smoke, sparkle, updateFlash };
}
