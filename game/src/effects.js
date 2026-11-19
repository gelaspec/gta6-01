// Effects: a small pooled particle system (sparks, smoke, muzzle flash)
// plus the camera shake value the render loop reads. Everything is reused
// — nothing is allocated per frame while playing.

import * as THREE from 'three';

export function createEffects(THREE, scene) {
  const COUNT = 160;
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pool = [];
  for (let i = 0; i < COUNT; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, grav: 0 });
  }
  let cursor = 0;
  let shakeAmt = 0;

  const flashMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  flashMesh.visible = false;
  scene.add(flashMesh);
  let flashT = 0;

  function spawn(pos, color, n, speed, life, grav, up) {
    for (let k = 0; k < n; k++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % COUNT;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      p.vel.set(Math.cos(a) * Math.cos(b), Math.abs(Math.sin(b)) * 0.8 + (up || 0.3), Math.sin(a) * Math.cos(b)).multiplyScalar(speed * (0.5 + Math.random()));
      p.life = life * (0.6 + Math.random() * 0.7);
      p.max = p.life;
      p.grav = grav;
    }
  }

  function burst(pos, color, n = 12, speed = 8) {
    spawn(pos, color, n, speed, 0.55, 14, 0.5);
  }

  function smoke(pos, n = 6) {
    spawn(pos, 0x9aa0aa, n, 2.2, 1.1, -1.5, 0.9);
  }

  function flash(pos) {
    flashMesh.position.copy(pos);
    flashMesh.visible = true;
    flashMesh.material.opacity = 0.95;
    flashT = 0.07;
  }

  function shake(amt) {
    shakeAmt = Math.min(1.2, shakeAmt + amt);
  }

  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = p.mesh.scale.x * (p.life / p.max);
      p.mesh.scale.setScalar(Math.max(0.05, s));
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 8;
    }
    if (flashT > 0) {
      flashT -= dt;
      flashMesh.material.opacity = Math.max(0, flashT / 0.07) * 0.95;
      if (flashT <= 0) flashMesh.visible = false;
    }
    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
  }

  // Called after the camera is placed each frame, so the shake lands last.
  function applyShake(camera) {
    if (!camera || shakeAmt <= 0.005) return;
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.35;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.25;
    flashMesh.lookAt(camera.position);
  }

  return { burst, smoke, flash, shake, update, applyShake, get shakeAmt() { return shakeAmt; } };
}
