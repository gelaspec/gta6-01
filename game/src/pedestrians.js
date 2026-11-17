// Meridian Bay's people: walkers on the sidewalks who amble between
// intersections, cross at corners, and run when a gun goes off, a car bears
// down on them or a punch lands. They are the city's life — and what makes
// a hit-and-run a crime the police answer.

import * as THREE from 'three';
import { CITY, PED_COUNT } from './config.js';
import { clampToCity, nearestRoad } from './city.js';
import { chance, pick, range } from './random.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad88a, 0xd8c84a, 0xd84ab8, 0x8a6ad8, 0xe8e8e8, 0x3a3a3a];

function pedMesh(shirtColor, pantsColor, random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: pick(random, [0xd8a075, 0xa8764e, 0x8a5a38, 0xe8b890]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
  torso.position.y = 1.02;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
  legL.position.set(-0.14, 0.31, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.17), shirt);
  armL.position.set(-0.36, 1.02, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.36;
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function createPedestrians(scene, city, random) {
  const peds = [];

  function sidewalkPoint() {
    const road = pick(random, city.roads);
    const along = range(random, -city.half + 20, city.half - 20);
    const side = chance(random, 0.5) ? 1 : -1;
    if (chance(random, 0.5)) return { x: road + side * (CITY.roadWidth / 2 + 2.5), z: along };
    return { x: along, z: road + side * (CITY.roadWidth / 2 + 2.5) };
  }

  function spawnOne(x, z) {
    const p = x === undefined ? sidewalkPoint() : { x, z };
    const { group, legL, legR, armL, armR } = pedMesh(
      pick(random, SHIRTS),
      pick(random, [0x2a3440, 0x4a3a2a, 0x5a5a5a, 0x2a4a5a]),
      random,
    );
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    const ped = {
      group, legL, legR, armL, armR,
      x: p.x, z: p.z, yaw: random() * Math.PI * 2,
      speed: range(random, 1.1, 2.0),
      target: null,
      fleeTimer: 0,
      fleeX: 0,
      fleeZ: 0,
      phase: random() * 10,
      dead: false,
      hitTimer: 0,
    };
    pickTarget(ped);
    peds.push(ped);
    return ped;
  }

  function pickTarget(ped) {
    const road = nearestRoad(city, ped.x, ped.z);
    const along = road.axis === 'x' ? ped.z : ped.x;
    const next = along + (chance(random, 0.5) ? 80 : -80);
    const clamped = Math.max(-city.half + 10, Math.min(city.half - 10, next));
    const side = chance(random, 0.5) ? 1 : -1;
    ped.target = road.axis === 'x'
      ? { x: road.value + side * (CITY.roadWidth / 2 + 2.5), z: clamped }
      : { x: clamped, z: road.value + side * (CITY.roadWidth / 2 + 2.5) };
  }

  function flee(ped, fromX, fromZ) {
    const dx = ped.x - fromX;
    const dz = ped.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    ped.fleeX = ped.x + (dx / d) * 40;
    ped.fleeZ = ped.z + (dz / d) * 40;
    ped.fleeTimer = 3;
  }

  function scareAll(x, z, radius) {
    for (const ped of peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) flee(ped, x, z);
    }
  }

  function update(dt, danger) {
    for (const ped of peds) {
      if (ped.dead) continue;
      if (ped.hitTimer > 0) ped.hitTimer -= dt;
      let tx;
      let tz;
      let speed = ped.speed;
      if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        tx = ped.fleeX;
        tz = ped.fleeZ;
        speed = 5.2;
      } else {
        // A fast car closing in on the sidewalk sends them running.
        if (danger) {
          const d = Math.hypot(ped.x - danger.x, ped.z - danger.z);
          if (d < 7 && danger.speed > 8) flee(ped, danger.x, danger.z);
        }
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 3) pickTarget(ped);
        tx = ped.target.x;
        tz = ped.target.z;
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const want = Math.atan2(dx, dz);
        let dy = want - ped.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        ped.yaw += dy * Math.min(1, dt * 6);
        ped.x += Math.sin(ped.yaw) * speed * dt;
        ped.z += Math.cos(ped.yaw) * speed * dt;
        ped.phase += dt * speed * 2.4;
      }
      const clamped = clampToCity(ped.x, ped.z);
      ped.x = clamped.x;
      ped.z = clamped.z;
      const swing = Math.sin(ped.phase) * 0.55;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
      ped.armL.rotation.x = -swing * 0.7;
      ped.armR.rotation.x = swing * 0.7;
      ped.group.position.set(ped.x, 0, ped.z);
      ped.group.rotation.y = ped.yaw;
    }
  }

  function nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function knockDown(ped) {
    ped.dead = true;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
  }

  for (let i = 0; i < PED_COUNT; i += 1) spawnOne();

  return { peds, spawnOne, update, nearest, knockDown, scareAll, flee };
}
