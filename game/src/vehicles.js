// Cars: the hero's COMET GT, stealable parked cars and the traffic that
// keeps the streets alive. Arcade physics on purpose — fast, forgiving,
// handbrake turns — with a simple road-following brain for traffic.
//
// Parked cars are never traffic: they have no route at all, so their speed
// can never go undefined and turn into NaN. Traffic cars always carry a
// route object from the moment they spawn.

import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, rngRange, rngInt, rngPick, clamp, angleDelta, dist2d } from './random.js';
import { makeCarMesh } from './render.js';

export function createVehicle(THREE, spec, x, z, heading) {
  const mesh = makeCarMesh(spec.color, {
    spoiler: spec.name === 'COMET GT',
    police: spec.police === true,
  });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh,
    spec,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    condition: 100,
    parked: false,
    route: null,
    brakeLight: false,
    syncMesh() {
      mesh.position.copy(this.pos);
      mesh.rotation.y = this.heading;
      const wob = Math.min(Math.abs(this.speed) * 0.02, 0.12);
      mesh.rotation.z = -this.steer * wob;
      const spin = this.speed * 0.016;
      for (const w of mesh.userData.wheels) w.rotation.x += spin;
    },
  };
}

// Drive the hero car: W/S throttle, A/D steer, Space handbrake, E exit.
export function driveVehicle(v, dt, input, city) {
  const ax = input.axis();
  const t = CFG.tuning;
  const top = (v.spec.top / 3.6) * 0.9;
  if (ax.y > 0) v.speed += t.carAccel * dt * (v.spec.accel / 26);
  else if (ax.y < 0) v.speed -= (v.speed > 0.5 ? t.carBrake : t.carReverse) * dt;
  else v.speed -= v.speed * 0.55 * dt;
  const handbrake = input.isDown('Space');
  const grip = handbrake ? t.handbrakeGrip : 1;
  v.speed = clamp(v.speed, -top * 0.35, top);
  const steerTarget = -ax.x * t.carSteer * (v.speed >= 0 ? 1 : -1);
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  const turn = v.steer * (v.speed / top) * grip * 1.9;
  v.heading += turn * dt * (v.speed >= 0 ? 1 : -1);
  const nx = v.pos.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.pos.z + Math.cos(v.heading) * v.speed * dt;
  if (!city.collides(nx, v.pos.z, 1.6)) v.pos.x = nx;
  else v.speed *= 0.4;
  if (!city.collides(v.pos.x, nz, 1.6)) v.pos.z = nz;
  else v.speed *= 0.4;
  city.pushOut(v.pos, 1.6);
  v.pos.x = clamp(v.pos.x, -258, 396);
  v.pos.z = clamp(v.pos.z, -258, 258);
  v.brakeLight = ax.y < 0;
  v.syncMesh();
  return { handbrake, speed01: Math.abs(v.speed) / top };
}

// Traffic: cars that follow the road grid. Each one drives along one road
// line, picks a new direction at every intersection, and slows for the car
// ahead. They never leave the roads, so the streets always feel busy.
export function createTraffic(THREE, city, seed, count) {
  const rng = mulberry32(seed);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spec = rngPick(rng, CFG.cars.slice(1));
    const p = city.randomRoadPoint(rng);
    const horizontal = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    const v = createVehicle(THREE, spec, p.x, p.z, horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    v.speed = rngRange(rng, 8, 14);
    v.route = { horizontal, dir, target: rngRange(rng, 10, 40) };
    cars.push(v);
  }

  function update(dt, heroPos) {
    for (const v of cars) {
      const r = v.route;
      // Slow down for anything stopped ahead (hero car, police, traffic).
      let want = 11;
      if (heroPos) {
        const d = dist2d(v.pos.x, v.pos.z, heroPos.x, heroPos.z);
        const ahead = Math.sin(v.heading) * (heroPos.x - v.pos.x) + Math.cos(v.heading) * (heroPos.z - v.pos.z);
        if (d < 14 && ahead > 0) want = 0;
      }
      v.speed += (want - v.speed) * Math.min(1, dt * 1.5);
      const step = v.speed * dt;
      if (r.horizontal) v.pos.x += r.dir * step;
      else v.pos.z += r.dir * step;
      r.target -= step;
      if (r.target <= 0) {
        // Reached an intersection: maybe turn, maybe carry on.
        const roads = CFG.city.roads;
        const near = roads.reduce((best, line) => {
          const d = r.horizontal ? Math.abs(v.pos.z - line) : Math.abs(v.pos.x - line);
          return d < best.d ? { line, d } : best;
        }, { line: 0, d: 1e9 });
        if (near.d < 10 || Math.abs(v.pos.x) > 250 || Math.abs(v.pos.z) > 250) {
          if (Math.random() < 0.55) {
            r.horizontal = !r.horizontal;
            r.dir = Math.random() < 0.5 ? 1 : -1;
          }
          const wantHeading = r.horizontal ? (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (r.dir > 0 ? 0 : Math.PI);
          v.heading += angleDelta(v.heading, wantHeading) * Math.min(1, dt * 6);
        }
        r.target = rngRange(rng, 24, 70);
        // Snap back onto the nearest road line after a turn.
        if (r.horizontal) v.pos.z += (near.line - v.pos.z) * Math.min(1, dt * 4);
        else v.pos.x += (near.line - v.pos.x) * Math.min(1, dt * 4);
      }
      // Keep heading matched to travel direction on straights.
      const straight = r.horizontal ? (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (r.dir > 0 ? 0 : Math.PI);
      v.heading += angleDelta(v.heading, straight) * Math.min(1, dt * 3);
      v.pos.x = clamp(v.pos.x, -258, 258);
      v.pos.z = clamp(v.pos.z, -258, 258);
      v.syncMesh();
    }
  }

  return { cars, update };
}

// Parked cars the player can steal: placed on road edges, never moving.
export function createParkedCars(THREE, city, seed) {
  const rng = mulberry32(seed);
  const spots = [
    { x: 170, z: -44, h: Math.PI / 2, spec: CFG.cars[0] },
    { x: -36, z: 120, h: 0, spec: CFG.cars[1] },
    { x: 108, z: 200, h: Math.PI, spec: CFG.cars[4] },
    { x: -180, z: -100, h: -Math.PI / 2, spec: CFG.cars[3] },
    { x: 36, z: -180, h: 0, spec: CFG.cars[5] },
    { x: 240, z: 60, h: Math.PI / 2, spec: CFG.cars[2] },
  ];
  const cars = spots.map((s) => {
    const v = createVehicle(THREE, s.spec, s.x, s.z, s.h);
    v.parked = true;
    v.speed = 0;
    v.route = null;
    return v;
  });
  return cars;
}

// Nearest stealable car within reach of a position, or null.
export function nearestCar(cars, x, z, maxDist = 4.5) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = dist2d(x, z, c.pos.x, c.pos.z);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
