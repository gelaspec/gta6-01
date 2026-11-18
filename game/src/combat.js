// Combat: a pistol fired from the camera's crosshair and a melee punch.
// Enemies are Harbor Kings gang members (and, if the player is foolish
// enough, the police answer gunfire with gunfire). Hits are raycasts; the
// muzzle flash, tracer and impact sparks live in effects.js.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { collideCircle } from './city.js';
import { chance, pick, range } from './random.js';

function enemyMesh(random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.gangShirt });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const skin = new THREE.MeshLambertMaterial({ color: pick(random, [0xd8a075, 0xa8764e, 0x8a5a38, 0xe8b890]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.36), new THREE.MeshLambertMaterial({ color: 0x8a1a1a }));
  band.position.y = 1.32;
  group.add(band);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  // Gang colours on the head: a red bandana or a dark cap, never the same twice.
  if (chance(random, 0.4)) {
    const bandana = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x8a1a1a }),
    );
    bandana.position.y = 1.78;
    group.add(bandana);
  } else if (chance(random, 0.4)) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.25, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    cap.position.y = 1.86;
    group.add(cap);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), shirt);
  armR.position.set(0.42, 1.15, 0.2);
  armR.rotation.x = -1.2;
  group.add(armR);
  return { group, legL, legR, armR };
}export function createCombat(scene, city, random, effects, audio, onCrime) {
  const enemies = [];
  const raycaster = new THREE.Raycaster();
  const targets = [];
  let fireCooldown = 0;
  // The pistol carries 12 rounds and loads one back every 2.5 s — the HUD
  // shows AMMO, and an empty gun clicks instead of firing.
  const AMMO_MAX = 12;
  let ammo = AMMO_MAX;
  let regenTimer = 0;

  function setAmmo(value) {
    ammo = Math.max(0, Math.min(AMMO_MAX, value));
  }

  function spawnEnemy(x, z, kind) {
    const { group, legL, legR, armR } = enemyMesh(random);
    group.position.set(x, 0, z);
    scene.add(group);
    const enemy = {
      group, legL, legR, armR,
      x, z, yaw: random() * Math.PI * 2,
      health: 100,
      kind: kind || 'gang',
      shootTimer: range(random, 0.8, 2),
      phase: random() * 10,
      dead: false,
    };
    enemies.push(enemy);
    return enemy;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
  }

  /** Fire the pistol from `camera` toward the crosshair. Returns what was hit. */
  function shoot(camera, playerPos) {
    if (fireCooldown > 0) return null;
    if (ammo <= 0) {
      audio.denied();
      return { type: 'empty' };
    }
    fireCooldown = 0.28;
    ammo -= 1;
    regenTimer = 0;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 120;
    targets.length = 0;
    for (const e of enemies) if (!e.dead) targets.push(e.group);
    const hits = raycaster.intersectObjects(targets, true);
    const origin = camera.position.clone();
    let end = null;
    let hitEnemy = null;
    if (hits.length > 0) {
      end = hits[0].point;
      let obj = hits[0].object;
      while (obj && !hitEnemy) {
        for (const e of enemies) if (e.group === obj) hitEnemy = e;
        obj = obj.parent;
      }
    } else {
      end = origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(120));
    }
    effects.muzzle(origin, raycaster.ray.direction);
    effects.tracer(origin, end);
    if (hitEnemy) {
      hitEnemy.health -= 34;
      effects.sparks(end, 0xffd27a);
      audio.gunshot(true);
      if (hitEnemy.health <= 0) {
        hitEnemy.dead = true;
        hitEnemy.group.rotation.x = -Math.PI / 2;
        hitEnemy.group.position.y = 0.3;
        effects.burst(end, 0xc23b2e, 14, 5);
      }
      return { type: 'enemy', enemy: hitEnemy };
    }
    // A miss still cracks the air: peds flee, the law notices.
    audio.gunshot(false);
    onCrime(1, 'shoot');
    void playerPos;
    return { type: 'miss', point: end };
  }

  /** A punch in front of the player: enemies and peds inside the arc take it. */
  function punch(player, peds) {
    const reach = 2.0;
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    let hit = null;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < reach && dx * fx + dz * fz > 0) {
        e.health -= 25;
        e.x += (dx / (d || 1)) * 1.2;
        e.z += (dz / (d || 1)) * 1.2;
        if (e.health <= 0) {
          e.dead = true;
          e.group.rotation.x = -Math.PI / 2;
          e.group.position.y = 0.3;
        }
        hit = { type: 'enemy', enemy: e };
      }
    }
    if (!hit && peds) {
      const ped = peds.nearest(player.x + fx, player.z + fz, 1.6);
      if (ped) {
        peds.knockDown(ped);
        onCrime(1, 'hitPed');
        hit = { type: 'ped', ped };
      }
    }
    audio.punch();
    return hit;
  }

  function update(dt, playerPos, player) {
    if (fireCooldown > 0) fireCooldown -= dt;
    if (ammo < AMMO_MAX) {
      regenTimer += dt;
      if (regenTimer >= 2.5) {
        ammo += 1;
        regenTimer = 0;
      }
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz);
      // Gang members close in and shoot from 8-25 m; they are bad shots.
      if (d > 8) {
        const want = Math.atan2(dx, dz);
        let dy = want - e.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        e.yaw += dy * Math.min(1, dt * 5);
        e.x += Math.sin(e.yaw) * 3.4 * dt;
        e.z += Math.cos(e.yaw) * 3.4 * dt;
        const fixed = collideCircle(city, e.x, e.z, 0.5);
        e.x = fixed.x;
        e.z = fixed.z;
        e.phase += dt * 8;
        e.legL.rotation.x = Math.sin(e.phase) * 0.6;
        e.legR.rotation.x = -Math.sin(e.phase) * 0.6;
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = range(random, 1.2, 2.4);
          if (Math.random() < 0.45) {
            player.takeDamage(6);
            effects.tracer(
              new THREE.Vector3(e.x, 1.4, e.z),
              new THREE.Vector3(playerPos.x, 1.2, playerPos.z),
            );
            audio.enemyShot();
          }
        }
      }
      e.group.position.set(e.x, 0, e.z);
      e.group.rotation.y = e.yaw;
    }
  }

  return {
    enemies, spawnEnemy, clearEnemies, shoot, punch, update, setAmmo,
    get ammo() {
      return ammo;
    },
    get ammoMax() {
      return AMMO_MAX;
    },
  };
}
