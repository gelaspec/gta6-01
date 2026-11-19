// Combat: fists up close, pistol at range. Hits are resolved with a
// raycaster against police and pedestrians; a hit flashes the target,
// throws a burst of sparks and, for a cop, puts him down for a while.
// Shooting in front of the law raises the wanted level.

import * as THREE from 'three';
import { dist2d } from './random.js';

export function createCombat(THREE, scene) {
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function shoot(from, heading, pitch, targets, effects, onCrime) {
    origin.copy(from);
    origin.y += 1.4;
    dir.set(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), Math.cos(heading) * Math.cos(pitch));
    ray.set(origin, dir);
    ray.far = 90;
    const meshes = [];
    for (const t of targets) {
      if (t.mesh) meshes.push(t.mesh);
    }
    const hits = ray.intersectObjects(meshes, true);
    let hitPoint = null;
    let hitTarget = null;
    if (hits.length > 0) {
      hitPoint = hits[0].point;
      let o = hits[0].object;
      while (o.parent && o.parent !== scene) o = o.parent;
      hitTarget = targets.find((t) => t.mesh === o) || null;
    } else {
      hitPoint = origin.clone().addScaledVector(dir, 60);
    }
    effects.flash(hitPoint);
    effects.burst(hitPoint, 0xffd21e, 10, 7);
    if (hitTarget) {
      hitTarget.hp = (hitTarget.hp ?? 100) - 34;
      effects.burst(hitPoint, 0xff5a3c, 14, 9);
      if (hitTarget.kind === 'cop') {
        hitTarget.down = true;
        hitTarget.downT = 6;
        hitTarget.mesh.rotation.x = -Math.PI / 2;
        hitTarget.mesh.position.y = 0.4;
      } else if (hitTarget.kind === 'ped') {
        hitTarget.flee = 5;
      } else if (hitTarget.kind === 'car') {
        hitTarget.condition = Math.max(0, (hitTarget.condition ?? 100) - 12);
      }
      if (onCrime) onCrime(1);
      return { hit: true, target: hitTarget, point: hitPoint };
    }
    return { hit: false, target: null, point: hitPoint };
  }

  function punch(playerPos, heading, targets, effects, onCrime) {
    const reach = 2.4;
    let best = null;
    let bestD = reach;
    for (const t of targets) {
      const d = dist2d(playerPos.x, playerPos.z, t.pos.x, t.pos.z);
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (!best) return { hit: false };
    effects.burst(new THREE.Vector3(best.pos.x, 1.2, best.pos.z), 0xffe9a8, 8, 5);
    best.hp = (best.hp ?? 100) - 20;
    if (best.kind === 'cop') {
      best.down = true;
      best.downT = 4;
      best.mesh.rotation.x = -Math.PI / 2;
      best.mesh.position.y = 0.4;
    } else if (best.kind === 'ped') {
      best.flee = 5;
    }
    if (onCrime) onCrime(1);
    return { hit: true, target: best };
  }

  // Put a downed cop back on his feet (mesh rotation restored).
  function revive(target) {
    if (!target || !target.mesh) return;
    target.mesh.rotation.x = 0;
    target.mesh.position.y = 0;
  }

  return { shoot, punch, revive };
}
