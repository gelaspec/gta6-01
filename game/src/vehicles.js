// Vehicles: arcade car physics, stealable cars, traffic AI on the road
// grid, and distinct models (sedan, taxi, van, sports, police cruiser)
// built from boxes with glass, wheels, lights and liveries.

import * as THREE from 'three';
import { CONFIG, PALETTE, CAR_MODELS } from './config.js';
import { clamp, wrapAngle, angleLerp, dist2D } from './random.js';
import { pointBlocked, clampToCity } from './city.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x1c2f42 });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd83232 });
const RED_BAR = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const BLUE_BAR = new THREE.MeshBasicMaterial({ color: 0x2a6bff });

export function buildCarMesh(rng, model, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const low = model.kind === 'sports';
  const long = model.kind === 'van' ? 5.4 : 4.4;
  const bodyH = model.kind === 'van' ? 1.5 : 0.75;
  const bodyY = low ? 0.55 : 0.75;

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, long), paint);
  body.position.y = bodyY;
  g.add(body);
  const cabinH = model.kind === 'van' ? 0.9 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, cabinH, long * 0.45), GLASS_MAT);
  cabin.position.set(0, bodyY + bodyH / 2 + cabinH / 2 - 0.08, model.kind === 'van' ? -0.4 : -0.25);
  g.add(cabin);
  if (low) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), WHEEL_MAT);
    spoiler.position.set(0, 1.28, -long / 2 + 0.25);
    g.add(spoiler);
  }
  if (model.kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xf2c230 }),
    );
    sign.position.set(0, bodyY + bodyH / 2 + cabinH + 0.05, -0.2);
    g.add(sign);
  }
  if (model.kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), WHEEL_MAT);
    bar.position.set(0, bodyY + bodyH / 2 + cabinH + 0.02, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), RED_BAR);
    red.position.set(-0.28, bodyY + bodyH / 2 + cabinH + 0.03, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), BLUE_BAR);
    blue.position.set(0.28, bodyY + bodyH / 2 + cabinH + 0.03, -0.2);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), LIGHT_MAT);
  headL.position.set(-0.62, bodyY, long / 2 + 0.02);
  g.add(headL);
  const headR = headL.clone();
  headR.position.x = 0.62;
  g.add(headR);
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), TAIL_MAT);
  tailL.position.set(-0.62, bodyY, -long / 2 - 0.02);
  g.add(tailL);
  const tailR = tailL.clone();
  tailR.position.x = 0.62;
  g.add(tailR);

  const wheels = [];
  for (const [wx, wz] of [[-0.95, long / 2 - 0.85], [0.95, long / 2 - 0.85], [-0.95, -long / 2 + 0.85], [0.95, -long / 2 + 0.85]]) {
    const w = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.length = long;
  return g;
}

function roadPoint(rng, lines) {
  const vertical = rng.chance(0.5);
  const at = rng.pick(lines);
  const along = rng.range(-130, 130);
  return vertical ? { x: at, z: along, heading: rng.chance(0.5) ? 0 : Math.PI } : { x: along, z: at, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
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
  return cars;
}

function pickNextTarget(rng, city, car) {
  const vertical = rng.chance(0.5);
  const at = rng.pick(city.roadLines);
  const along = rng.range(-130, 130);
  return vertical ? { x: at, z: along } : { x: along, z: at };
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (c.traffic && c.speed > 2) continue;
    const d = dist2D(x, z, c.x, c.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function stealCar(G, car) {
  const p = G.player;
  p.inCar = car;
  car.traffic = false;
  car.speed = 0;
  p.mesh.visible = false;
  G.rig.mode = 'chase';
  G.events.push({ type: 'crime', amount: 1, reason: 'car stolen' });
  G.hud.toast(`Stole the ${car.model.name} — lose the heat!`);
  G.audio.engineStart();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  p.mesh.visible = true;
  const side = Math.cos(car.heading) * 2.2;
  const fwd = Math.sin(car.heading) * 2.2;
  p.x = car.x + side;
  p.z = car.z - fwd;
  p.y = 0;
  p.mesh.position.set(p.x, 0, p.z);
  G.rig.mode = 'follow';
}

function drivePlayerCar(G, car, dt) {
  const input = G.input;
  const fwd = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const handbrake = input.keys.has('Space');
  const maxSpeed = car.model.top * (car.condition / 100 * 0.5 + 0.5);
  if (fwd) car.speed += car.model.accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? CONFIG.carBrake : car.model.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * 8 * dt;
  if (handbrake && Math.abs(car.speed) > 1) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    G.effects.tireSmoke(car.x, car.z);
  }
  car.speed = clamp(car.speed, -CONFIG.carReverseMax, maxSpeed);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = handbrake ? CONFIG.handbrakeGrip : CONFIG.carGrip;
  const turnRate = CONFIG.carSteer * (car.speed / maxSpeed) * grip * 0.16;
  car.heading += car.steer * turnRate * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (pointBlocked(G.city.colliders, nx, nz, 1.4)) {
    car.speed *= -0.25;
    car.condition = Math.max(20, car.condition - 4);
    G.effects.crashSparks(car.x, car.z);
    G.audio.thud();
    if (Math.abs(car.speed) > 6) G.events.push({ type: 'crime', amount: 0, reason: 'crash' });
  } else {
    car.x = nx;
    car.z = nz;
  }
  const c = clampToCity(car.x, car.z);
  car.x = c.x;
  car.z = c.z;
  // Camera follows the car heading: the rig yaw matches the heading, so
  // the camera sits behind the car and looks where it is going.
  G.rig.yaw = angleLerp(G.rig.yaw, car.heading, Math.min(1, dt * 3));
  G.audio.setEngine(Math.abs(car.speed) / maxSpeed, car.speed);
  if (Math.abs(car.speed) > 20) G.rig.shake = Math.max(G.rig.shake, 0.05);
}

function driveTrafficCar(G, car, dt) {
  if (!car.target) return;
  const dx = car.target.x - car.x;
  const dz = car.target.z - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 6) {
    car.target = pickNextTarget(G.rng, G.city, car);
    return;
  }
  const want = Math.atan2(dx, dz);
  car.heading = angleLerp(car.heading, want, Math.min(1, dt * 2.2));
  // Slow down for the car ahead.
  let slow = false;
  for (const other of G.cars) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 9 && side < 2.4) {
      slow = true;
      break;
    }
  }
  const targetSpeed = slow ? 0 : CONFIG.trafficSpeed;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car === G.player.inCar) {
      drivePlayerCar(G, car, dt);
    } else if (car.traffic) {
      driveTrafficCar(G, car, dt);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Wheel spin + front steer.
    const spin = car.speed * dt * 2.2;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    const frontL = car.mesh.userData.wheels[0];
    const frontR = car.mesh.userData.wheels[1];
    if (frontL) frontL.rotation.y = car.steer * 0.35;
    if (frontR) frontR.rotation.y = car.steer * 0.35;
    // Police light bar flash.
    if (car.model.kind === 'police' && car.mesh.userData.lightRed) {
      const phase = Math.floor(G.time * 6) % 2 === 0;
      car.mesh.userData.lightRed.material.color.setHex(phase ? 0xff2a2a : 0x551111);
      car.mesh.userData.lightBlue.material.color.setHex(phase ? 0x112255 : 0x2a6bff);
    }
  }
}
