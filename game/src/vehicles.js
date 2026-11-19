// Meridian Bay — cars: arcade physics for the driven car, a simple traffic
// AI that follows the road grid, stealing (E), and the hero pink Comet GT.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { roadPoint } from './city.js';

function part(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export class Car {
  constructor(scene, model, x, z, heading) {
    this.scene = scene;
    this.model = model;
    this.name = model.name;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100; // condition, shown in the HUD
    this.isPlayer = false;
    this.isPolice = false;
    this.isTaxi = false;
    this.stolen = false;
    this.mesh = this.buildMesh(model);
    scene.add(this.mesh);
    this.syncMesh();
  }

  buildMesh(model) {
    const g = new THREE.Group();
    g.name = `car-${model.name}`;
    const color = model.color;
    const long = model.van ? 5.2 : 4.4;
    // body + cabin + details; vans get a tall box instead of a cabin
    g.add(part(model.van ? 2.2 : 2.0, 0.75, long, color, 0, 0.65, 0));
    if (model.van) {
      g.add(part(2.0, 1.1, 3.4, 0xd8dee8, 0, 1.55, -0.4));
    } else {
      g.add(part(1.7, 0.65, 2.2, 0x1c2733, 0, 1.3, -0.2));
    }
    // windshield band
    g.add(part(1.72, 0.5, 0.12, 0x9fd8f2, 0, 1.25, model.van ? 1.35 : 0.95));
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
    this.wheels = [];
    for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      g.add(w);
      this.wheels.push(w);
    }
    // headlights + taillights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    g.add(part(0.4, 0.18, 0.1, 0xfff6c9, -0.65, 0.72, long / 2));
    g.add(part(0.4, 0.18, 0.1, 0xfff6c9, 0.65, 0.72, long / 2));
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    g.add(part(0.4, 0.18, 0.1, 0xff2a2a, -0.65, 0.72, -long / 2));
    g.add(part(0.4, 0.18, 0.1, 0xff2a2a, 0.65, 0.72, -long / 2));
    if (model.sport) {
      g.add(part(1.9, 0.1, 0.5, 0x14181f, 0, 1.15, -long / 2 + 0.1)); // spoiler
    }
    this.lightBar = null;
    return g;
  }

  // Police light bar, added after construction for patrol cars.
  makePolice() {
    this.isPolice = true;
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    red.position.set(-0.4, 0, 0);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2a6bff }),
    );
    blue.position.set(0.4, 0, 0);
    bar.add(red, blue);
    bar.position.set(0, 1.75, -0.2);
    this.mesh.add(bar);
    this.lightBar = bar;
    this.lightRed = red;
    this.lightBlue = blue;
    // black-and-white patrol paint: white doors on the dark body
    const door = part(2.02, 0.5, 1.6, 0xf2f2f2, 0, 0.7, 0.1);
    this.mesh.add(door);
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  // Arcade drive step for the player's car.
  drive(dt, input, city) {
    const cfg = CONFIG.car;
    const max = cfg.maxSpeed * this.model.speed;
    const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0)
      - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const handbrake = input.down('Space');
    if (throttle > 0) this.speed += cfg.accel * this.model.speed * dt;
    else if (throttle < 0) {
      this.speed -= (this.speed > 0.5 ? cfg.brake : cfg.reverseAccel) * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    }
    if (this.speed > max) this.speed = max;
    if (this.speed < -cfg.maxReverse) this.speed = -cfg.maxReverse;
    const steerInput = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)
      - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    const steerTarget = steerInput * cfg.steer * Math.min(1, Math.abs(this.speed) / 8);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 10);
    this.heading += this.steer * (this.speed >= 0 ? 1 : -1) * dt * Math.min(1, Math.abs(this.speed) / 6 + 0.15);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const solved = city.resolveCircle(nx, nz, cfg.radius);
    if (solved.x !== nx || solved.z !== nz) {
      // clipped a building: lose speed, take a dent
      if (Math.abs(this.speed) > 8) {
        this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.35);
      }
      this.speed *= 0.4;
    }
    this.pos.x = Math.max(-205, Math.min(290, solved.x));
    this.pos.z = Math.max(-205, Math.min(205, solved.z));
    if (handbrake) this.speed *= Math.max(0, 1 - dt * 1.8);
    this.syncMesh();
    return handbrake && Math.abs(this.speed) > 6;
  }

  // Simple chase steering toward a point (police use this).
  steerToward(dt, tx, tz, topSpeed) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const want = Math.atan2(dx, dz);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += Math.max(-1.9 * dt, Math.min(1.9 * dt, dh));
    const dist = Math.hypot(dx, dz);
    const target = dist > 26 ? topSpeed : topSpeed * 0.55;
    this.speed += (target - this.speed) * Math.min(1, dt * 1.6);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.pos.x = Math.max(-205, Math.min(290, this.pos.x));
    this.pos.z = Math.max(-205, Math.min(205, this.pos.z));
    this.syncMesh();
  }
}

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this.hero = null;
    this.spawnInitial();
  }

  spawnInitial() {
    // the hero car: hot pink Comet GT parked by the pier, always stealable
    const heroModel = CONFIG.carModels[0];
    this.hero = new Car(this.scene, heroModel, 198, -24, Math.PI / 2);
    this.cars.push(this.hero);
    // parked cars around the districts
    const parked = [
      [-150, -120, 0], [60, 84, Math.PI / 2], [-84, 140, 0], [112, 28, Math.PI],
      [28, -140, Math.PI / 2], [-28, 168, 0], [168, -84, Math.PI / 2], [-140, 28, 0],
    ];
    for (const [x, z, h] of parked) {
      const model = this.rng.pick(CONFIG.carModels.slice(1));
      this.cars.push(new Car(this.scene, model, x, z, h));
    }
    // moving traffic on the roads
    for (let i = 0; i < 12; i++) {
      const p = roadPoint(this.rng, this.city);
      const model = this.rng.pick(CONFIG.carModels.slice(1));
      const car = new Car(this.scene, model, p.x, p.z, p.heading);
      car.cruise = this.rng.range(9, 15);
      car.nextTurn = this.rng.range(4, 10);
      this.cars.push(car);
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (c.isPolice) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt, playerCar, gameTime) {
    for (const car of this.cars) {
      if (car === playerCar || car.isPolice) continue;
      // parked cars (no cruise speed) stay where they are
      if (car.cruise === undefined) { car.syncMesh(); continue; }
      car.nextTurn -= dt;
      if (car.nextTurn <= 0) {
        car.nextTurn = this.rng.range(4, 11);
        if (this.rng.chance(0.45)) car.heading += this.rng.pick([-Math.PI / 2, Math.PI / 2]);
      }
      // slow down for the car ahead
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.4) { target = 0; break; }
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.4);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      // keep traffic inside the built-up city; wrap around the ring road
      if (car.pos.x > 200) car.pos.x = -200;
      if (car.pos.x < -204) car.pos.x = 200;
      if (car.pos.z > 200) car.pos.z = -200;
      if (car.pos.z < -204) car.pos.z = 200;
      car.syncMesh();
    }
    void gameTime;
  }
}
