// Combat: fists and the pistol. Raycast shooting against pedestrians,
// police and gang members, ammo with reload, muzzle flash, and the
// enemy health that missions use for holdout objectives.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D } from './random.js';
import { hitPedestrian } from './pedestrians.js';

export function createCombat() {
  return {
    ammo: CONFIG.pistolAmmo,
    reloading: 0,
    shotsFired: 0,
    lastShotAt: -100,
    hits: 0,
    fired: 0,
    enemies: [],
  };
}

export function spawnEnemy(G, x, z, hp) {
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.85, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x6b1f1f }),
  );
  body.position.y = 1.05;
  mesh.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.46, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xc98d5f }),
  );
  head.position.y = 1.72;
  mesh.add(head);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x14161a }),
  );
  gun.position.set(0.3, 1.1, 0.4);
  mesh.add(gun);
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const enemy = { mesh, x, z, hp: hp || 100, alive: true, shootAt: G.time + 1.5 + G.rng.range(0, 1.5), heading: 0 };
  G.combat.enemies.push(enemy);
  return enemy;
}

export function clearEnemies(G) {
  for (const e of G.combat.enemies) G.view.scene.remove(e.mesh);
  G.combat.enemies = [];
}

function rayTargets(G) {
  const list = [];
  for (const ped of G.peds) list.push({ kind: 'ped', obj: ped, x: ped.x, z: ped.z, y: 1.2 });
  for (const c of G.police.cops) list.push({ kind: 'cop', obj: c, x: c.x, z: c.z, y: 1.2 });
  for (const e of G.combat.enemies) {
    if (e.alive) list.push({ kind: 'enemy', obj: e, x: e.x, z: e.z, y: 1.2 });
  }
  return list;
}

export function shoot(G) {
  const c = G.combat;
  const p = G.player;
  if (p.inCar || G.screen !== 'play') return;
  if (c.reloading > 0) return;
  if (c.ammo <= 0) {
    c.reloading = 1.4;
    G.hud.toast('Reloading…');
    G.audio.reload();
    return;
  }
  c.ammo--;
  c.shotsFired++;
  c.fired++;
  c.lastShotAt = G.time;
  G.audio.gunshot();
  G.effects.muzzleFlash(p.x, p.z, p.heading);
  G.rig.shake = Math.max(G.rig.shake, 0.12);

  // Raycast from the camera through the crosshair against people.
  const dir = new THREE.Vector3();
  G.view.camera.getWorldDirection(dir);
  const origin = G.view.camera.position.clone();
  let best = null;
  let bestT = CONFIG.shootRange;
  for (const t of rayTargets(G)) {
    const to = new THREE.Vector3(t.x - origin.x, t.y - origin.y, t.z - origin.z);
    const along = to.dot(dir);
    if (along < 1 || along > bestT) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(along));
    const miss = Math.hypot(closest.x - t.x, closest.y - t.y, closest.z - t.z);
    if (miss < 1.6 && along < bestT) {
      bestT = along;
      best = t;
    }
  }
  if (best) {
    c.hits++;
    G.effects.hitSparks(best.x, best.y, best.z);
    if (best.kind === 'ped') {
      hitPedestrian(G, best.obj);
    } else if (best.kind === 'cop') {
      G.events.push({ type: 'crime', amount: 1, reason: 'shot a cop' });
      G.hud.toast('You shot a cop — the whole MBPD is coming.');
    } else if (best.kind === 'enemy') {
      best.obj.hp -= CONFIG.pistolDamage;
      if (best.obj.hp <= 0 && best.obj.alive) {
        best.obj.alive = false;
        best.obj.mesh.visible = false;
        G.effects.hitSparks(best.x, 1.2, best.z);
        G.events.push({ type: 'enemyDown', enemy: best.obj });
      }
    }
  }
}

export function punch(G) {
  const p = G.player;
  if (p.inCar || G.screen !== 'play' || p.punching > 0) return;
  p.punching = 0.28;
  G.audio.punch();
  const px = p.x + Math.sin(p.heading) * 1.4;
  const pz = p.z + Math.cos(p.heading) * 1.4;
  for (const ped of G.peds) {
    if (dist2D(px, pz, ped.x, ped.z) < 1.8) hitPedestrian(G, ped);
  }
  for (const e of G.combat.enemies) {
    if (e.alive && dist2D(px, pz, e.x, e.z) < 2.0) {
      e.hp -= CONFIG.punchDamage;
      if (e.hp <= 0) {
        e.alive = false;
        e.mesh.visible = false;
        G.events.push({ type: 'enemyDown', enemy: e });
      }
    }
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.reloading > 0) {
    c.reloading -= dt;
    if (c.reloading <= 0) {
      c.ammo = CONFIG.pistolAmmo;
      G.hud.toast('Reloaded — 12 rounds.');
    }
  }
  // Enemies shoot back at the player on a slow timer.
  const p = G.player;
  for (const e of c.enemies) {
    if (!e.alive) continue;
    const d = dist2D(p.x, p.z, e.x, e.z);
    e.heading = Math.atan2(p.x - e.x, p.z - e.z);
    e.mesh.rotation.y = e.heading;
    if (d < 40 && G.time > e.shootAt && G.screen === 'play') {
      e.shootAt = G.time + 2.2 + G.rng.range(0, 1.2);
      G.audio.enemyShot();
      G.effects.muzzleFlash(e.x, e.z, e.heading);
      if (G.rng.chance(0.45)) {
        G.hud.flashDamage();
        p.health = Math.max(0, p.health - 8);
        if (p.health <= 0) G.events.push({ type: 'wasted' });
      }
    }
  }
}
