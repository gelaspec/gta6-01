// Cars: one arcade physics model for every car in Meridian Bay — the
// player's car, the traffic that loops the road grid, the parked cars waiting
// to be stolen, and the police interceptors.
//
// v2: every car is one of seven classes (sedan, coupe, SUV, van, taxi,
// sports, police), each with its own silhouette — body and cabin proportions,
// wheels, glass, lights, bumpers and class extras (taxi sign, spoiler, roof
// rails, push bar) — so a chase reads at a glance: which car is the runner,
// which is a cab, which is the law. The footprint stays 2.0 x 4.4 m for
// every class, so the collision radius, steering and traffic AI are exactly
// the v1 ones; only the model changes.

import * as THREE from 'three';
import {
  CAR, CAR_CLASS_LABEL, CAR_CLASS_WEIGHTS, CAR_NAMES_BY_CLASS,
  CITY, PALETTE, PARKED_COUNT, TRAFFIC_COUNT,
} from './config.js';
import { clampToCity, collideCircle, nearestRoad, randomRoadPoint } from './city.js';
import { chance, pick, range, weighted } from './random.js';

// Body/cabin proportions per class: [width, height, depth, centre height]
// and [width, height, depth, centre height, centre z]. The van has no
// separate cabin — its body is the cabin.
const CLASS_SPECS = {
  sedan: { body: [2.0, 0.62, 4.4, 0.62], cabin: [1.7, 0.55, 2.2, 1.15, -0.25], wheelR: 0.38, wheelY: 0.38 },
  coupe: { body: [2.0, 0.55, 4.4, 0.58], cabin: [1.6, 0.48, 1.7, 1.05, -0.55], wheelR: 0.38, wheelY: 0.38 },
  suv: { body: [2.0, 0.78, 4.4, 0.70], cabin: [1.75, 0.62, 2.6, 1.35, -0.10], wheelR: 0.42, wheelY: 0.42 },
  van: { body: [2.0, 1.05, 4.4, 0.85], cabin: null, wheelR: 0.40, wheelY: 0.40 },
  taxi: { body: [2.0, 0.62, 4.4, 0.62], cabin: [1.7, 0.55, 2.2, 1.15, -0.25], wheelR: 0.38, wheelY: 0.38 },
  sports: { body: [2.05, 0.50, 4.5, 0.55], cabin: [1.6, 0.42, 1.5, 0.95, -0.40], wheelR: 0.40, wheelY: 0.40 },
  police: { body: [2.0, 0.62, 4.4, 0.62], cabin: [1.7, 0.55, 2.2, 1.15, -0.25], wheelR: 0.38, wheelY: 0.38 },
};

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function carMesh(color, isPolice, cls) {
  const spec = CLASS_SPECS[cls] || CLASS_SPECS.sedan;
  const [bw, bh, bd, by] = spec.body;
  const frontZ = bd / 2;
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? PALETTE.policeWhite : color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8e8 });
  const trim = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });

  // Body + hood + trunk (the van's tall body is its own cabin).
  const body = box(bw, bh, bd, paint, 0, by, 0);
  body.castShadow = true;
  group.add(body);
  if (cls !== 'van') {
    const hoodLen = cls === 'coupe' || cls === 'sports' ? 1.35 : 1.0;
    group.add(box(bw - 0.1, 0.26, hoodLen, paint, 0, by + 0.1, frontZ - hoodLen / 2 - 0.15));
    group.add(box(bw - 0.1, 0.3, 0.9, paint, 0, by + 0.1, -frontZ + 0.45));
  }

  // Cabin: glasshouse, or the police white roof. The van gets a raked
  // windshield and side glass instead of a separate cabin box.
  if (spec.cabin) {
    const [cw, ch, cd, cy, cz] = spec.cabin;
    const cabin = box(cw, ch, cd, isPolice ? paint : glass, 0, cy, cz);
    cabin.castShadow = true;
    group.add(cabin);
    // Windshield and rear window: thin tilted glass over the cabin ends,
    // sloping down from the roof to the hood and the trunk. (A positive
    // rotation.x tips the panel's front edge down; negative tips its rear
    // edge down.)
    const shield = box(cw - 0.1, 0.05, 1.1, glass, 0, cy + ch / 2 - 0.15, cz + cd / 2 + 0.45);
    shield.rotation.x = 0.5;
    group.add(shield);
    const rearGlass = box(cw - 0.1, 0.05, 1.0, glass, 0, cy + ch / 2 - 0.15, cz - cd / 2 - 0.4);
    rearGlass.rotation.x = -0.5;
    group.add(rearGlass);
  } else {
    const shield = box(1.8, 0.7, 0.06, glass, 0, 1.35, frontZ - 0.25);
    shield.rotation.x = -0.3;
    group.add(shield);
    for (const sx of [-1, 1]) {
      group.add(box(0.04, 0.5, 2.6, glass, sx * (bw / 2 + 0.01), 1.3, -0.3));
      group.add(box(0.02, 0.9, 1.2, trim, sx * (bw / 2 + 0.01), 0.8, 0.3));
    }
    group.add(box(1.4, 0.4, 0.04, glass, 0, 1.5, -frontZ - 0.01));
  }

  // Wheels with hubcaps; the hubcap rides on the wheel so it spins with it.
  const wheelGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, cls === 'sports' ? 0.34 : 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const hubGeo = new THREE.CylinderGeometry(spec.wheelR * 0.55, spec.wheelR * 0.55, 0.32, 10);
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xb8bcc2 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, spec.wheelY, wz);
    wheel.castShadow = true;
    wheel.add(new THREE.Mesh(hubGeo, hubMat));
    group.add(wheel);
    wheels.push(wheel);
  }

  // Lights: warm headlights and grille up front, red taillights at the back.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xd41e1e, emissiveIntensity: 0.8 });
  for (const lx of [-0.6, 0.6]) {
    group.add(box(0.4, 0.18, 0.1, lightMat, lx, by, frontZ + 0.01));
    group.add(box(0.42, 0.16, 0.08, tailMat, lx, by + 0.05, -frontZ - 0.01));
  }
  group.add(box(1.2, 0.14, 0.06, trim, 0, by - 0.08, frontZ + 0.01));
  // Bumpers and mirrors.
  group.add(box(bw + 0.02, 0.16, 0.12, trim, 0, 0.42, frontZ + 0.02));
  group.add(box(bw + 0.02, 0.16, 0.12, trim, 0, 0.42, -frontZ - 0.02));
  for (const mx of [-1, 1]) {
    group.add(box(0.12, 0.1, 0.22, trim, mx * (bw / 2 + 0.04), 1.05, 0.75));
  }

  // Class extras — the details that read at a glance in a screenshot.
  if (cls === 'taxi') {
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffc93c, emissive: 0xffb020, emissiveIntensity: 1.0 });
    group.add(box(0.9, 0.22, 0.4, signMat, 0, 1.55, -0.25));
    for (const sx of [-1, 1]) group.add(box(0.02, 0.2, 3.8, trim, sx * (bw / 2 + 0.01), by, 0));
  } else if (cls === 'sports') {
    group.add(box(1.7, 0.06, 0.4, trim, 0, 1.02, -frontZ + 0.15));
    for (const sx of [-0.6, 0.6]) group.add(box(0.08, 0.22, 0.08, trim, sx, 0.9, -frontZ + 0.15));
    for (const sx of [-1, 1]) group.add(box(0.1, 0.12, 3.6, trim, sx * (bw / 2 + 0.02), 0.32, 0));
  } else if (cls === 'suv') {
    for (const rx of [-0.7, 0.7]) group.add(box(0.08, 0.08, 2.4, trim, rx, 1.7, -0.1));
  }

  let barRed = null;
  let barBlue = null;
  if (isPolice) {
    const band = box(2.02, 0.3, 1.2, new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }), 0, 0.62, 0.6);
    group.add(band);
    // Push bar on the nose: the interceptor's calling card.
    group.add(box(1.6, 0.18, 0.12, trim, 0, 0.55, frontZ + 0.06));
    for (const vx of [-0.5, 0.5]) group.add(box(0.12, 0.5, 0.1, trim, vx, 0.6, frontZ + 0.06));
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

  function addCar(x, z, yaw, color, kind, cls) {
    const isPolice = kind === 'police';
    const carCls = cls || (isPolice ? 'police' : weighted(random, CAR_CLASS_WEIGHTS));
    const paint = carCls === 'taxi' ? 0xe8c832 : color;
    const { group, wheels, barRed, barBlue } = carMesh(paint, isPolice, carCls);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
    const car = {
      group, wheels, barRed, barBlue,
      x, z, yaw,
      speed: 0,
      steer: 0,
      color: paint,
      name: isPolice ? 'MBPD Interceptor' : pick(random, CAR_NAMES_BY_CLASS[carCls]),
      cls: carCls,
      clsLabel: CAR_CLASS_LABEL[carCls],
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
