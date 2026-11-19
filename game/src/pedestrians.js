// Meridian Bay — pedestrians on the sidewalks. Varied height, build, skin,
// hats and bags; they stroll between waypoints and flee from gunfire or
// from a car that comes too close.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const SHIRTS = [0xff6d5a, 0x4fc3f7, 0xffd54f, 0x81c784, 0xba68c8, 0xf2ede2, 0xff8a65, 0x64b5f6];
const SKINS = [0xd9a066, 0x8a5a34, 0xf2c89b, 0x6b4423, 0xe8b98a];
const PANTS = [0x2e4a6b, 0x3a3a3a, 0x6b4a2e, 0x4a5a3a, 0x5a2e4a];

function buildPed(rng) {
  const g = new THREE.Group();
  const h = rng.range(1.55, 1.95);
  const s = h / 1.8;
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.6 * s, 0.28 * s), shirt);
  torso.position.y = 1.05 * s;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.34 * s, 0.28 * s), skin);
  head.position.y = 1.58 * s;
  g.add(head);
  if (rng.chance(0.3)) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.26 * s, 0.1 * s, 10), new THREE.MeshLambertMaterial({ color: rng.pick([0xffd54f, 0x2e6f5e, 0xd43a2e]) }));
    hat.position.y = 1.78 * s;
    g.add(hat);
  }
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.72 * s, 0.22 * s), pants);
    leg.position.set(sx * s, 0.36 * s, 0);
    g.add(leg);
    legs.push(leg);
  }
  if (rng.chance(0.35)) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.08), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    bag.position.set(0.3 * s, 1.0 * s, -0.18 * s);
    g.add(bag);
  }
  return { group: g, legs, height: h };
}

export function createPedestrians(scene, city, rng, count = 26) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const { group, legs } = buildPed(rng);
    const p = city.sidewalkPoint();
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    const target = city.sidewalkPoint();
    peds.push({
      group, legs,
      pos: group.position,
      target: new THREE.Vector3(target.x, 0, target.z),
      speed: rng.range(1.2, 2.4),
      phase: rng.range(0, Math.PI * 2),
      flee: false,
      fleeFrom: null,
    });
  }

  function update(dt, dangerPos, dangerRadius = 0) {
    for (const p of peds) {
      // flee if danger is close
      if (dangerPos) {
        const d = Math.hypot(p.pos.x - dangerPos.x, p.pos.z - dangerPos.z);
        if (d < dangerRadius) {
          p.flee = true;
          p.fleeFrom = dangerPos;
        }
      }
      let tx;
      let tz;
      let speed = p.speed;
      if (p.flee && p.fleeFrom) {
        const dx = p.pos.x - p.fleeFrom.x;
        const dz = p.pos.z - p.fleeFrom.z;
        const len = Math.hypot(dx, dz) || 1;
        tx = p.pos.x + (dx / len) * 20;
        tz = p.pos.z + (dz / len) * 20;
        speed = 5.5;
        if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 1 || Math.hypot(p.pos.x - p.fleeFrom.x, p.pos.z - p.fleeFrom.z) > 24) {
          p.flee = false;
        }
      } else {
        tx = p.target.x;
        tz = p.target.z;
        const d = Math.hypot(tx - p.pos.x, tz - p.pos.z);
        if (d < 1.5) {
          const np = city.sidewalkPoint();
          p.target.set(np.x, 0, np.z);
        }
      }
      const dx = tx - p.pos.x;
      const dz = tz - p.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      p.pos.x += (dx / len) * speed * dt;
      p.pos.z += (dz / len) * speed * dt;
      p.pos.x = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.beachX + 52, p.pos.x));
      p.pos.z = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.cityHalf + 6, p.pos.z));
      p.group.rotation.y = Math.atan2(dx, dz);
      p.phase += dt * speed * 3;
      const swing = Math.sin(p.phase) * 0.5;
      p.legs[0].rotation.x = swing;
      p.legs[1].rotation.x = -swing;
    }
  }
  return { peds, update };
}
