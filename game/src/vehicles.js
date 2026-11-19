// Meridian Bay — cars: factory (7 classes), arcade physics for the driven car,
// traffic AI that follows the road grid and brakes for the car ahead.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const CAR_CLASSES = [
  { name: 'Sedan', w: 1.9, l: 4.4, h: 1.35, top: 34, color: 0xd8d3c8 },
  { name: 'Coupe', w: 1.85, l: 4.2, h: 1.2, top: 38, color: 0x3a7bd5 },
  { name: 'SUV', w: 2.0, l: 4.8, h: 1.7, top: 32, color: 0x8a94a0 },
  { name: 'Van', w: 2.0, l: 5.2, h: 2.0, top: 28, color: 0x2b2b33 },
  { name: 'Taxi', w: 1.9, l: 4.4, h: 1.35, top: 34, color: 0xffc400 },
  { name: 'Comet GT', w: 1.95, l: 4.5, h: 1.15, top: 46, color: CONFIG.palette.pinkCar },
  { name: 'MBPD Cruiser', w: 1.95, l: 4.6, h: 1.4, top: 40, color: 0xf2f2f2 },
];

function buildCarMesh(cls, color, isPolice, isTaxi) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xd8dee8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(cls.w, cls.h * 0.55, cls.l), paint);
  body.position.y = cls.h * 0.42;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cls.w * 0.82, cls.h * 0.5, cls.l * 0.5), glass);
  cabin.position.set(0, cls.h * 0.92, -cls.l * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cls.w * 0.84, 0.08, cls.l * 0.52), paint);
  roof.position.set(0, cls.h * 1.18, -cls.l * 0.05);
  g.add(roof);
  // bumpers + grille
  for (const dz of [cls.l / 2 - 0.05, -cls.l / 2 + 0.05]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(cls.w * 0.96, 0.22, 0.18), chrome);
    bumper.position.set(0, 0.32, dz);
    g.add(bumper);
  }
  // headlights / taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const sx of [-cls.w * 0.32, cls.w * 0.32]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    hl.position.set(sx, cls.h * 0.55, cls.l / 2 + 0.02);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tl.position.set(sx, cls.h * 0.55, -cls.l / 2 - 0.02);
    g.add(tl);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-cls.w / 2, cls.l * 0.32], [cls.w / 2, cls.l * 0.32], [-cls.w / 2, -cls.l * 0.32], [cls.w / 2, -cls.l * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(cls.w + 0.02, 0.22, cls.l * 0.98), new THREE.MeshLambertMaterial({ color: 0x1c4fd6 }));
    stripe.position.y = cls.h * 0.62;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(cls.w * 0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    bar.position.set(0, cls.h * 1.28, -cls.l * 0.05);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(cls.w * 0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2e6bff }));
    bar2.position.set(0, cls.h * 1.28, -cls.l * 0.05 + 0.32);
    g.add(bar2);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    sign.position.set(0, cls.h * 1.28, -cls.l * 0.05);
    g.add(sign);
  }
  return g;
}

export function createCar(scene, classIndex, color, x, z, heading = 0) {
  const cls = CAR_CLASSES[classIndex];
  const isPolice = cls.name === 'MBPD Cruiser';
  const isTaxi = cls.name === 'Taxi';
  const mesh = buildCarMesh(cls, color !== undefined ? color : cls.color, isPolice, isTaxi);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, cls, heading,
    pos: mesh.position,
    speed: 0,
    classIndex,
    get name() { return cls.name; },
  };
}

// Arcade physics for the car the player drives.
export function driveCar(car, dt, input, city) {
  const ax = input.axis();
  const cls = car.cls;
  const forward = ax.y;
  const steer = ax.x;
  const handbrake = input.down('Space');
  const accel = forward > 0 ? CONFIG.carAccel : forward < 0 ? -CONFIG.carBrake * 0.6 : 0;
  car.speed += accel * dt;
  if (forward === 0) car.speed *= Math.pow(0.4, dt); // drag
  if (handbrake) car.speed *= Math.pow(0.08, dt);
  car.speed = Math.max(-12, Math.min(cls.top, car.speed));
  const turnRate = CONFIG.carTurn * (car.speed / cls.top) * (car.speed < 0 ? -1 : 1);
  car.heading += steer * turnRate * dt * (handbrake ? 1.6 : 1);
  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  const res = city.resolveCollision(nx, nz, 1.6);
  if (res.x !== nx || res.z !== nz) car.speed *= 0.55; // bumped a building
  car.pos.x = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.beachX + 52, res.x));
  car.pos.z = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.cityHalf + 6, res.z));
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  // body roll + pitch for feel
  car.mesh.rotation.z = -steer * 0.04 * Math.min(1, Math.abs(car.speed) / 20);
  car.mesh.rotation.x = -forward * 0.015 * Math.min(1, Math.abs(car.speed) / 20);
  return { speedKmh: Math.abs(car.speed) * 3.6, handbrake };
}

// Traffic: cars that follow the road grid, turn at intersections, brake for
// the car ahead. Deterministic spawn from the seeded rng.
export function createTraffic(scene, city, rng, count = 14) {
  const cars = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint();
    const key = `${Math.round(p.x)}:${Math.round(p.z)}`;
    if (used.has(key)) continue;
    used.add(key);
    const vertical = Math.abs(p.x - city.roadCoord(p.x)) < 0.1;
    const dir = rng.chance(0.5) ? 1 : -1;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const clsIdx = rng.int(0, 4);
    const car = createCar(scene, clsIdx, undefined, p.x, p.z, heading);
    car.speed = rng.range(8, CONFIG.trafficSpeed);
    car.vertical = vertical;
    car.dir = dir;
    cars.push(car);
  }

  function update(dt, playerCar) {
    for (const car of cars) {
      // brake if something is close ahead (another car or the player)
      let blocked = false;
      const ax = Math.sin(car.heading);
      const az = Math.cos(car.heading);
      const check = (ox, oz, r) => {
        const dx = ox - car.pos.x;
        const dz = oz - car.pos.z;
        const along = dx * ax + dz * az;
        const side = Math.abs(dx * az - dz * ax);
        return along > 0 && along < 9 + r && side < 2.4;
      };
      for (const other of cars) {
        if (other !== car && check(other.pos.x, other.pos.z, 2)) { blocked = true; break; }
      }
      if (!blocked && playerCar && check(playerCar.pos.x, playerCar.pos.z, 2)) blocked = true;
      const target = blocked ? 0 : rngTarget(car);
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      car.pos.x += ax * car.speed * dt;
      car.pos.z += az * car.speed * dt;
      // wrap at the city edge back to the opposite side
      if (car.pos.x > CONFIG.cityHalf + 10) car.pos.x = -CONFIG.cityHalf - 10;
      if (car.pos.x < -CONFIG.cityHalf - 10) car.pos.x = CONFIG.cityHalf + 10;
      if (car.pos.z > CONFIG.cityHalf + 10) car.pos.z = -CONFIG.cityHalf - 10;
      if (car.pos.z < -CONFIG.cityHalf - 10) car.pos.z = CONFIG.cityHalf + 10;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
    }
  }
  const speeds = new Map();
  function rngTarget(car) {
    if (!speeds.has(car)) speeds.set(car, 8 + (car.classIndex * 1.3));
    return speeds.get(car);
  }
  return { cars, update };
}
