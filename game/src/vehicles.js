// Vehicles: stealable cars with arcade driving, traffic AI that
// follows the road grid and brakes for the car ahead, and the police
// cruiser look (light bar, black-and-white paint). The Comet GT is
// the hot-pink sports car on the cover.

import * as THREE from 'three';
import { CONFIG, PALETTE, CAR_MODELS } from './config.js';
import { clamp, wrapAngle, angleLerp, dist2D } from './random.js';
import { isDown } from './input.js';
import { pointBlocked, clampToCity } from './city.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x22405e });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd83232 });
const RED_BAR = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const BLUE_BAR = new THREE.MeshBasicMaterial({ color: 0x2a6bff });

export function buildCarMesh(rng, model, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const isVan = model.kind === 'van';
  const isTaxi = model.kind === 'taxi';
  const isPolice = model.kind === 'police';
  const bodyLen = isVan ? 5.2 : 4.4;
  const bodyH = isVan ? 1.5 : 0.85;
  const bodyY = isVan ? 1.15 : 0.62;

  // Body + cabin + glass.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyLen), paint);
  body.position.y = bodyY;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, isVan ? 0.9 : 0.62, isVan ? 2.4 : 2.1),
    isVan ? paint : GLASS_MAT,
  );
  cabin.position.set(0, bodyY + bodyH / 2 + 0.3, isVan ? -0.6 : -0.2);
  g.add(cabin);
  if (!isVan) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.1), paint);
    roof.position.set(0, bodyY + bodyH / 2 + 0.62, -0.2);
    g.add(roof);
  }
  // Sports cars get a spoiler; taxis a roof sign; cruisers a light bar.
  if (model.kind === 'sports') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x14161a }));
    wing.position.set(0, 1.35, -2.1);
    g.add(wing);
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.4), new THREE.MeshLambertMaterial({ color: 0x14161a }));
    finL.position.set(-0.85, 1.2, -2.1);
    g.add(finL);
    const finR = finL.clone();
    finR.position.x = 0.85;
    g.add(finR);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.55, -0.2);
    g.add(sign);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), RED_BAR);
    bar.position.set(-0.35, 1.55, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), BLUE_BAR);
    bar2.position.set(0.35, 1.55, -0.2);
    g.add(bar2);
    // Black-and-white doors: a dark band over the white body.
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.5, 2.4), new THREE.MeshLambertMaterial({ color: 0x232a38 }));
    band.position.set(0, 0.75, 0.2);
    g.add(band);
  }
  // Headlights, tail lights, bumpers, wheels.
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), LIGHT_MAT);
    hl.position.set(sx, 0.7, bodyLen / 2);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), TAIL_MAT);
    tl.position.set(sx, 0.7, -bodyLen / 2);
    g.add(tl);
  }
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 0.25), new THREE.MeshLambertMaterial({ color: 0x9aa2b0 }));
  bumperF.position.set(0, 0.3, bodyLen / 2 + 0.05);
  g.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -bodyLen / 2 - 0.05;
  g.add(bumperR);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.name = 'wheel';
    g.add(wheel);
  }
  g.userData.paint = paint;
  return g;
}

function roadPoint(rng, lines) {
  const vertical = rng.chance(0.5);
  const at = rng.pick(lines);
  const along = rng.range(-120, 120);
  return {
    x: vertical ? at : along,
    z: vertical ? along : at,
    heading: vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
  };
}

export function createVehicles(scene, rng, city) {
  const cars = [];
  const addCar = (model, color, x, z, heading, traffic) => {
    const mesh = buildCarMesh(rng, model, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, model, color, x, z, heading,
      speed: 0, steer: 0, condition: 100,
      traffic: !!traffic,
      target: null,
      honk: 0,
      stuck: 0,
    };
    cars.push(car);
    return car;
  };

  // Parked cars along the streets.
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const p = roadPoint(rng, city.roadLines);
    const side = rng.sign() * 7.5;
    const vertical = Math.abs(Math.sin(p.heading)) < 0.1;
    const x = vertical ? p.x + side : p.x;
    const z = vertical ? p.z : p.z + side;
    const model = rng.pick(CAR_MODELS.filter((m) => m.kind !== 'police'));
    addCar(model, rng.pick(PALETTE.carColors), x, z, p.heading + (rng.chance(0.5) ? 0 : Math.PI), false);
  }
  // Moving traffic.
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const p = roadPoint(rng, city.roadLines);
    const model = rng.pick(CAR_MODELS.filter((m) => m.kind !== 'police'));
    const car = addCar(model, rng.pick(PALETTE.carColors), p.x, p.z, p.heading, true);
    car.speed = CONFIG.trafficSpeed * rng.range(0.8, 1.15);
    car.target = pickNextTarget(rng, city, car);
  }
  // One guaranteed hot-pink Comet GT near the spawn, for the cover.
  addCar(CAR_MODELS[0], 0xff2e88, 8, 40, Math.PI / 2, false);
  return cars;
}

function pickNextTarget(rng, city, car) {
  const lines = city.roadLines;
  const vertical = rng.chance(0.5);
  const at = rng.pick(lines);
  return {
    x: vertical ? at + rng.sign() * 3 : rng.range(-120, 120),
    z: vertical ? rng.range(-120, 120) : at + rng.sign() * 3,
  };
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.model.kind === 'police') continue;
    const d = dist2D(x, z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function stealCar(G, car) {
  const p = G.player;
  p.inCar = car;
  car.traffic = false;
  p.mesh.visible = false;
  G.rig.mode = 'chase';
  G.rig.yaw = car.heading;
  G.events.push({ type: 'crime', amount: 1, reason: 'Grand theft auto' });
  G.missions.stats.carsStolen++;
  G.hud.hint(`Stole a ${car.model.name} — the MBPD noticed.`);
  G.audio.sirenBurst();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  car.speed = 0;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  G.rig.mode = 'follow';
  G.rig.yaw = car.heading;
}

function drivePlayerCar(G, car, dt) {
  const input = G.input;
  const model = car.model;
  const forward = isDown(input, 'KeyW', 'ArrowUp') ? 1 : 0;
  const back = isDown(input, 'KeyS', 'ArrowDown') ? 1 : 0;
  const steerIn = (isDown(input, 'KeyA', 'ArrowLeft') ? 1 : 0) - (isDown(input, 'KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = isDown(input, 'Space');

  if (forward) car.speed += model.accel * dt;
  else if (back) car.speed -= (car.speed > 0 ? CONFIG.carBrake : model.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * 8 * dt;
  const top = model.top;
  car.speed = clamp(car.speed, -CONFIG.carReverseMax, top);
  if (Math.abs(car.speed) < 0.2 && !forward && !back) car.speed = 0;

  const grip = handbrake ? CONFIG.handbrakeGrip : CONFIG.carGrip;
  const steerTarget = steerIn * CONFIG.carSteer * clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.steer = angleLerp(car.steer, steerTarget, clamp(dt * grip, 0, 1));
  car.heading += car.steer * dt * clamp(Math.abs(car.speed) / 8, 0, 1.4);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!pointBlocked(G.city.colliders, nx, car.z, 1.4)) car.x = nx;
  else {
    car.speed *= -0.3;
    car.condition = Math.max(0, car.condition - 4);
    G.audio.crash();
    G.effects.burst(car.x, 1, car.z);
  }
  if (!pointBlocked(G.city.colliders, car.x, nz, 1.4)) car.z = nz;
  else {
    car.speed *= -0.3;
    car.condition = Math.max(0, car.condition - 4);
    G.audio.crash();
  }
  const pos = clampToCity(car.x, car.z);
  car.x = pos.x;
  car.z = pos.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * 0.04;

  // Tyre smoke on a hard handbrake turn.
  if (handbrake && Math.abs(car.speed) > 12 && Math.random() < 0.5) {
    G.effects.smoke(car.x - Math.sin(car.heading) * 1.6, 0.4, car.z - Math.cos(car.heading) * 1.6);
  }
  G.audio.engine(Math.abs(car.speed) / top);
  G.rig.yaw = angleLerp(G.rig.yaw, car.heading, clamp(dt * 3, 0, 1));
}

function driveTrafficCar(G, car, dt) {
  if (!car.target) car.target = pickNextTarget(G.rng, G.city, car);
  const dx = car.target.x - car.x;
  const dz = car.target.z - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 4) {
    car.target = pickNextTarget(G.rng, G.city, car);
    return;
  }
  const want = Math.atan2(dx, dz);
  car.heading = angleLerp(car.heading, want, clamp(dt * 2.2, 0, 1));
  // Brake for the car ahead.
  let ahead = null;
  let aheadD = 14;
  for (const other of G.cars) {
    if (other === car) continue;
    const dd = dist2D(car.x, car.z, other.x, other.z);
    if (dd < aheadD) {
      const ang = Math.abs(wrapAngle(Math.atan2(other.x - car.x, other.z - car.z) - car.heading));
      if (ang < 0.5) {
        ahead = other;
        aheadD = dd;
      }
    }
  }
  const targetSpeed = ahead && aheadD < 9 ? 0 : CONFIG.trafficSpeed;
  car.speed = lerp(car.speed, targetSpeed, clamp(dt * 2, 0, 1));
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car === G.player.inCar) {
      drivePlayerCar(G, car, dt);
      continue;
    }
    if (car.model.kind === 'police') continue; // police.js drives cruisers
    if (car.traffic) {
      driveTrafficCar(G, car, dt);
    } else {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // Spin the wheels on any moving car.
    const spin = car.speed * dt * 2.4;
    for (const child of car.mesh.children) {
      if (child.name === 'wheel') child.rotation.x += spin;
    }
  }
  // A moving car that clips a pedestrian is a crime, not a joke.
  const p = G.player;
  if (p.inCar) {
    for (const ped of G.peds) {
      if (ped.fleeing) continue;
      if (dist2D(p.inCar.x, p.inCar.z, ped.x, ped.z) < 2.2 && Math.abs(p.inCar.speed) > 6) {
        ped.fleeing = true;
        ped.fleeT = 4;
        G.events.push({ type: 'crime', amount: 1, reason: 'Hit a pedestrian' });
        G.audio.crash();
        G.effects.hit(ped.x, 1.2, ped.z);
      }
    }
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
