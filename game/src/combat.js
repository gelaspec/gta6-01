// Combat: fists (F) and a pistol (click to shoot, 12 rounds, auto
// reload) against Harbor Kings gunmen. Enemies spawn during the bank
// job, take cover in the open and shoot back — a hit is a crime in
// front of the police, so a firefight always raises the heat.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2D } from './random.js';
import { buildFigure, damagePlayer } from './player.js';

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
  const mesh = buildFigure(G.rng, { shirt: 0x14161a, skin: 0x8a5a3b, hair: 0x14161a });
  // A red bandana marks the Harbor Kings.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.12, 0.46),
    new THREE.MeshLambertMaterial({ color: 0xff2a2a }),
  );
  band.position.y = 2.02;
  mesh.add(band);
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const enemy = { mesh, x, z, hp: hp || 60, heading: 0, shootAt: G.time + G.rng.range(1, 2.5), dead: false };
  G.combat.enemies.push(enemy);
  return enemy;
}

export function clearEnemies(G) {
  for (const e of G.combat.enemies) G.view.scene.remove(e.mesh);
  G.combat.enemies = [];
}

function rayTargets(G) {
  const out = [];
  for (const e of G.combat.enemies) {
    if (!e.dead) out.push({ kind: 'enemy', obj: e, x: e.x, z: e.z, y: 1.4, r: 1.1 });
  }
  for (const ped of G.peds) {
    out.push({ kind: 'ped', obj: ped, x: ped.x, z: ped.z, y: 1.2, r: 1.0 });
  }
  return out;
}

export function shoot(G) {
  const c = G.combat;
  const p = G.player;
  if (p.inCar || c.reloading > 0) return;
  if (c.ammo <= 0) {
    c.reloading = 1.6;
    G.hud.toast('Reloading…');
    return;
  }
  c.ammo--;
  c.fired++;
  c.shotsFired++;
  c.lastShotAt = G.time;
  G.audio.shot();
  const mx = p.x + Math.sin(p.heading) * 1.2;
  const mz = p.z + Math.cos(p.heading) * 1.2;
  G.effects.muzzle(mx, 1.4, mz);

  // A hitscan ray along the player's facing, up to 70 m.
  let best = null;
  let bestD = CONFIG.shootRange;
  for (const t of rayTargets(G)) {
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const along = dx * Math.sin(p.heading) + dz * Math.cos(p.heading);
    if (along < 1 || along > bestD) continue;
    const side = Math.abs(dx * Math.cos(p.heading) - dz * Math.sin(p.heading));
    if (side > t.r) continue;
    best = t;
    bestD = along;
  }
  if (best) {
    c.hits++;
    const hx = p.x + Math.sin(p.heading) * bestD;
    const hz = p.z + Math.cos(p.heading) * bestD;
    G.effects.hit(hx, best.y, hz);
    if (best.kind === 'enemy') {
      best.obj.hp -= CONFIG.pistolDamage;
      if (best.obj.hp <= 0 && !best.obj.dead) {
        best.obj.dead = true;
        G.view.scene.remove(best.obj.mesh);
        G.money += 50;
        G.rep += 15;
        G.hud.toast('Gunman down. +$50');
      }
    } else {
      hitPedestrianSafe(G, best.obj);
    }
    if (G.police.wanted < 5) G.events.push({ type: 'crime', amount: 1, reason: 'Shots fired' });
  }
  if (c.ammo <= 0) c.reloading = 1.6;
}

function hitPedestrianSafe(G, ped) {
  ped.fleeing = true;
  ped.fleeT = 5;
  G.events.push({ type: 'crime', amount: 1, reason: 'Hit a pedestrian' });
  G.effects.hit(ped.x, 1.2, ped.z);
}

export function punch(G) {
  const p = G.player;
  if (p.inCar) return;
  p.punching = 0.35;
  G.audio.punch();
  let best = null;
  let bestD = CONFIG.punchRange;
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const d = dist2D(p.x, p.z, e.x, e.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) {
    best.hp -= CONFIG.punchDamage;
    G.effects.hit(best.x, 1.3, best.z);
    if (best.hp <= 0 && !best.dead) {
      best.dead = true;
      G.view.scene.remove(best.mesh);
      G.money += 50;
      G.rep += 15;
      G.hud.toast('Gunman down. +$50');
    }
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  const p = G.player;
  if (c.reloading > 0) {
    c.reloading -= dt;
    if (c.reloading <= 0) {
      c.ammo = CONFIG.pistolAmmo;
      G.hud.toast('Reloaded — 12 rounds.');
    }
  }
  // Enemies close in and shoot back.
  for (const e of c.enemies) {
    if (e.dead) continue;
    const d = dist2D(e.x, e.z, p.x, p.z);
    const want = Math.atan2(p.x - e.x, p.z - e.z);
    e.heading = want;
    if (d > 14) {
      e.x += Math.sin(want) * 4.5 * dt;
      e.z += Math.cos(want) * 4.5 * dt;
    } else if (d < 6) {
      e.x -= Math.sin(want) * 2 * dt;
      e.z -= Math.cos(want) * 2 * dt;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
    const swing = Math.sin(G.time * 8 + e.x) * 0.6;
    const armR = e.mesh.getObjectByName('armR');
    if (armR) armR.rotation.x = swing;
    if (G.time >= e.shootAt && d < 40 && !p.inCar) {
      e.shootAt = G.time + G.rng.range(1.2, 2.6);
      G.audio.shot();
      G.effects.muzzle(e.x, 1.4, e.z);
      if (G.rng.chance(0.45)) {
        damagePlayer(G, 8);
        G.effects.hit(p.x, 1.4, p.z);
      }
    }
  }
  // Prune the dead so the array stays short.
  if (c.enemies.some((e) => e.dead)) {
    c.enemies = c.enemies.filter((e) => !e.dead);
  }
}
