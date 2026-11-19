// Meridian Bay — combat: punch, pistol (raycast, 12 rounds, reload), and the
// Harbor Kings gunmen who guard the M5 van and the M6 bank.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function buildGunman(rng) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x3a1c1c }); // dark red Kings
  const skin = new THREE.MeshLambertMaterial({ color: rng ? 0xd9a066 : 0xd9a066 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.34), skin);
  head.position.y = 1.78;
  g.add(head);
  const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0xd43a2e }));
  bandana.position.y = 1.92;
  g.add(bandana);
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
    leg.position.set(sx, 0.4, 0);
    g.add(leg);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.2, 0.3);
  g.add(gun);
  return g;
}

export function createCombat(scene, rng) {
  const raycaster = new THREE.Raycaster();
  const gunmen = [];
  let ammo = CONFIG.pistolAmmo;
  let reloading = false;
  let reloadT = 0;
  let punchT = 0;
  let muzzleT = 0;

  const muzzle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  scene.add(muzzle);

  function spawnGunman(x, z, heading = 0) {
    const mesh = buildGunman(rng);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const g = { mesh, pos: mesh.position, health: 3, shootT: rng.range(0.5, 1.5), alive: true };
    gunmen.push(g);
    return g;
  }

  function clearGunmen() {
    for (const g of gunmen) scene.remove(g.mesh);
    gunmen.length = 0;
  }

  // Punch: short-range arc in front of the player.
  function punch(playerPos, heading, enemies) {
    if (punchT > 0) return false;
    punchT = 0.45;
    let hit = false;
    for (const g of gunmen) {
      if (!g.alive) continue;
      const dx = g.pos.x - playerPos.x;
      const dz = g.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      let dh = ang - heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (d < CONFIG.punchRange && Math.abs(dh) < 0.9) {
        g.health -= 1;
        if (g.health <= 0) {
          g.alive = false;
          g.mesh.rotation.x = -Math.PI / 2;
          g.mesh.position.y = 0.3;
        }
        hit = true;
      }
    }
    return hit;
  }

  // Pistol: raycast from the camera centre; hits gunmen or the world.
  function shoot(camera, playerPos, heading, onHitWorld) {
    if (reloading) return { fired: false, reason: 'RELOADING' };
    if (ammo <= 0) {
      reloading = true;
      reloadT = 1.6;
      return { fired: false, reason: 'RELOAD' };
    }
    ammo -= 1;
    muzzleT = 0.08;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = gunmen.filter((g) => g.alive).map((g) => g.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    let killed = false;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== scene) obj = obj.parent;
      const g = gunmen.find((gg) => gg.mesh === obj);
      if (g) {
        g.health -= 1;
        if (g.health <= 0) {
          g.alive = false;
          g.mesh.rotation.x = -Math.PI / 2;
          g.mesh.position.y = 0.3;
          killed = true;
        }
      }
    } else if (onHitWorld) {
      onHitWorld(hits[0] ? hits[0].point : null);
    }
    if (ammo === 0) {
      reloading = true;
      reloadT = 1.6;
    }
    return { fired: true, killed, ammo };
  }

  function update(dt, playerPos, onPlayerHit) {
    if (punchT > 0) punchT -= dt;
    if (muzzleT > 0) {
      muzzleT -= dt;
      muzzle.material.opacity = Math.max(0, muzzleT / 0.08);
    } else {
      muzzle.material.opacity = 0;
    }
    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloading = false;
        ammo = CONFIG.pistolAmmo;
      }
    }
    // gunmen shoot back (inaccurate, telegraphed)
    for (const g of gunmen) {
      if (!g.alive) continue;
      const d = Math.hypot(g.pos.x - playerPos.x, g.pos.z - playerPos.z);
      if (d < 26) {
        g.mesh.lookAt(playerPos.x, 0, playerPos.z);
        g.shootT -= dt;
        if (g.shootT <= 0) {
          g.shootT = 1.1 + Math.random() * 0.9;
          if (Math.random() < 0.55 && onPlayerHit) onPlayerHit(8);
        }
      }
    }
  }

  return {
    gunmen, spawnGunman, clearGunmen, punch, shoot, update,
    get ammo() { return ammo; },
    get reloading() { return reloading; },
    muzzle,
  };
}
