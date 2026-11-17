// Cars: one arcade physics model for every car in Meridian Bay — the
// player's car, the traffic that loops the road grid, the parked cars waiting
// to be stolen, and the police interceptors. A car is a body, a cabin, four
// wheels and headlights; police cars add a flashing light bar.

import * as THREE from 'three';
import { CAR, CAR_NAMES, CITY, PALETTE, PARKED_COUNT, TRAFFIC_COUNT } from './config.js';
import { clampToCity, collideCircle, nearestRoad, randomRoadPoint } from './city.js';
import { chance, pick, range } from './random.js';

function carMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? PALETTE.policeWhite : color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), isPolice ? paint : glass);
  cabin.position.set(0, 1.15, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.2), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    band.position.set(0, 0.62, 0.6);
    group.add(band);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(lx, 0.62, 2.21);
    group.add(light);
  }
  let barRed = null;
  let barBlue = null;
  if (isPolice) {
    barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }),
    );
    barRed.position.set(-0.4, 1.55, -0.25);
    group.add(barRed);
    barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1 }),
    );
    barBlue.position.set(0.4, 1.55, -0.25);
    group.add(barBlue);
  }
  return { group, wheels, barRed, barBlue };
}

export function createVehicles(scene, city, random) {
  const cars = [];
  let playerCar = null;

  function addCar(x, z, yaw, color, kind) {
    const isPolice = kind === 'police';
    const { group, wheels, barRed, barBlue } = carMesh(color, isPolice);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
    const car = {
      group, wheels, barRed, barBlue,
      x, z, yaw,
      speed: 0,
      steer: 0,
      color,
      name: isPolice ? 'MBPD Interceptor' : pick(random, CAR_NAMES),
      kind, // 'player' | 'traffic' | 'parked' | 'police' | 'van'
      target: null, // traffic/police waypoint {x,z}
      routeAxis: null,
      routeValue: 0,
      routeDir: 1,
      sirenPhase: random() * 10,
      stuckTimer: 0,
      dead: false,
    };
    cars.push(car);
    return car;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint(city, random);
      const road = nearestRoad(city, p.x, p.z);
      const yaw = road.axis === 'x' ? (chance(random, 0.5) ? 0 : Math.PI) : (chance(random, 0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = addCar(p.x, p.z, yaw, pick(random, PALETTE.carPaint), 'traffic');
      car.speed = range(random, 7, 11);
      car.routeAxis = road.axis;
      car.routeValue = road.value;
      car.routeDir = chance(random, 0.5) ? 1 : -1;
      pickNextTarget(car);
    }
  }

  function pickNextTarget(car) {
    // Drive along the current road to the next intersection, then maybe turn.
    const half = CITY.half;
    const along = car.routeAxis === 'x' ? car.z : car.x;
    let next = along + car.routeDir * 80;
    if (next > half - 10 || next < -half + 10) {
      car.routeDir *= -1;
      next = along + car.routeDir * 80;
    }
    if (chance(random, 0.35)) {
      // Turn onto the crossing road at this intersection.
      const cross = nearestRoad(city, car.x, car.z);
      car.routeAxis = cross.axis === 'x' ? 'z' : 'x';
      car.routeValue = car.routeAxis === 'x' ? car.z : car.x;
      // Snap the value to the nearest real road.
      let best = city.roads[0];
      for (const r of city.roads) if (Math.abs(r - car.routeValue) < Math.abs(best - car.routeValue)) best = r;
      car.routeValue = best;
    }
    car.target = car.routeAxis === 'x'
      ? { x: car.routeValue, z: next }
      : { x: next, z: car.routeValue };
  }

  function spawnParked(count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint(city, random);
      const road = nearestRoad(city, p.x, p.z);
      const side = chance(random, 0.5) ? 1 : -1;
      const yaw = road.axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const x = road.axis === 'x' ? p.x + side * (CITY.roadWidth / 2 + 2.4) : p.x;
      const z = road.axis === 'z' ? p.z + side * (CITY.roadWidth / 2 + 2.4) : p.z;
      const car = addCar(x, z, yaw, pick(random, PALETTE.carPaint), 'parked');
      car.speed = 0;
    }
  }

  function nearestStealable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
      if (car === playerCar) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (playerCar) return null;
    car.kind = 'player';
    playerCar = car;
    return car;
  }

  function exitCar() {
    if (!playerCar) return null;
    const car = playerCar;
    car.kind = 'parked';
    car.speed = 0;
    playerCar = null;
    return car;
  }

  function stepCar(car, dt, throttle, steerInput, handbrake) {
    // Arcade bicycle-ish model: speed along the heading, steering by yaw rate.
    const drag = handbrake ? CAR.handbrakeDrag : CAR.drag;
    if (throttle > 0) car.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      car.speed += (car.speed > 0.5 ? -CAR.brake : CAR.reverseAccel * throttle) * dt;
    }
    car.speed -= car.speed * drag * dt;
    if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const targetSteer = steerInput * CAR.steerMax * (car.speed >= 0 ? 1 : -1);
    car.steer += (targetSteer - car.steer) * Math.min(1, dt * CAR.steerSpeed * 2);
    const yawRate = (car.speed / 2.6) * Math.tan(car.steer) * 0.9;
    car.yaw += yawRate * dt;
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
  }

  function steerToward(car, tx, tz, dt, speed) {
    const dx = tx - car.x;
    const dz = tz - car.z;
    const want = Math.atan2(dx, dz);
    let dy = want - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dy * 1.6));
    stepCar(car, dt, 1, steer, false);
    // Ease toward the cruising speed instead of flooring it.
    if (car.speed > speed) car.speed = Math.max(speed, car.speed - 20 * dt);
  }

  function update(dt, input, player) {
    // Player driving.
    if (playerCar) {
      const move = input.move();
      stepCar(playerCar, dt, move.z, -move.x, input.handbrake());
      const fixed = collideCircle(city, playerCar.x, playerCar.z, CAR.radius);
      if (fixed.x !== playerCar.x || fixed.z !== playerCar.z) {
        playerCar.speed *= 0.4;
        playerCar.x = fixed.x;
        playerCar.z = fixed.z;
      }
      const clamped = clampToCity(playerCar.x, playerCar.z);
      playerCar.x = clamped.x;
      playerCar.z = clamped.z;
    }
    // Traffic and police.
    for (const car of cars) {
      if (car === playerCar || car.kind === 'parked') continue;
      if (car.kind === 'traffic') {
        if (!car.target || Math.hypot(car.target.x - car.x, car.target.z - car.z) < 6) {
          pickNextTarget(car);
        }
        steerToward(car, car.target.x, car.target.z, dt, 10);
        // Slow down for the car ahead on the same road.
        for (const other of cars) {
          if (other === car || other.kind === 'parked') continue;
          const dx = other.x - car.x;
          const dz = other.z - car.z;
          const ahead = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw);
          const side = Math.abs(dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw));
          if (ahead > 0 && ahead < 9 && side < 3 && car.speed > other.speed) {
            car.speed = Math.max(0, other.speed - 1);
          }
        }
        const fixed = collideCircle(city, car.x, car.z, CAR.radius);
        car.x = fixed.x;
        car.z = fixed.z;
      } else if (car.kind === 'police') {
        // Police steering is set by police.js through car.target each frame.
        if (car.target) steerToward(car, car.target.x, car.target.z, dt, car.chaseSpeed || 34);
        const fixed = collideCircle(city, car.x, car.z, CAR.radius);
        car.x = fixed.x;
        car.z = fixed.z;
      }
    }
    // Car-car push-out (cheap circles).
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = CAR.radius * 2 - 0.4;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          if (a.kind !== 'parked') { a.x -= nx * push; a.z -= nz * push; }
          if (b.kind !== 'parked') { b.x += nx * push; b.z += nz * push; }
          if (a === playerCar || b === playerCar) {
            const other = a === playerCar ? b : a;
            if (other.kind === 'traffic' || other.kind === 'police') other.speed *= 0.7;
          }
        }
      }
    }
    // Pose and sirens.
    for (const car of cars) {
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.yaw;
      const steerVis = car === playerCar ? car.steer : 0;
      car.wheels[0].rotation.y = steerVis;
      car.wheels[1].rotation.y = steerVis;
      const spin = car.speed * dt * 2.6;
      for (const w of car.wheels) w.rotation.x += spin;
      if (car.barRed) {
        car.sirenPhase += dt * 6;
        const on = Math.sin(car.sirenPhase) > 0;
        car.barRed.material.emissiveIntensity = on ? 2.2 : 0.15;
        car.barBlue.material.emissiveIntensity = on ? 0.15 : 2.2;
      }
    }
    void player;
  }

  function reset() {
    for (const car of cars) {
      if (car.kind === 'police') {
        car.dead = true;
        scene.remove(car.group);
      }
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) if (cars[i].dead) cars.splice(i, 1);
    if (playerCar) {
      playerCar.kind = 'parked';
      playerCar.speed = 0;
      playerCar = null;
    }
  }

  spawnTraffic(TRAFFIC_COUNT);
  spawnParked(PARKED_COUNT);

  return {
    cars,
    get playerCar() {
      return playerCar;
    },
    addCar,
    nearestStealable,
    enterCar,
    exitCar,
    update,
    reset,
  };
}
