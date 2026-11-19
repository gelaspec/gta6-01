// Meridian Bay — the MBPD: a wanted level 0-5, patrol cars that chase and
// ram, foot cops that run the player down, a helicopter with a spotlight
// from 3 stars up, and the named-unit response panel the HUD reads.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Car } from './vehicles.js';

const UNIT_NAMES = CONFIG.units;
const STATUSES = ['PURSUIT', 'RAMMING', 'ROADBLOCK', 'SPOTLIGHT', 'CLOSING IN'];

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.cops = [];
    this.heli = null;
    this.heliLight = null;
    this.bustTimer = 0;
    this.loseTimer = 0;
    this.lastSeen = 0; // game time of the last confirmed sighting
    this.flash = 0; // light-bar phase
    this.units = []; // {name, distance, status} for the HUD panel
  }

  get code() {
    if (this.wanted >= 5) return 'CODE 5 — LOCKDOWN';
    if (this.wanted >= 4) return 'CODE 4 — FULL RESPONSE';
    if (this.wanted >= 3) return 'CODE 3 — AIR SUPPORT';
    if (this.wanted >= 2) return 'CODE 2 — PURSUIT';
    if (this.wanted >= 1) return 'CODE 1 — RESPONDING';
    return 'CODE 0 — CLEAR';
  }

  addWanted(n, gameTime) {
    const before = this.wanted;
    this.wanted = Math.min(CONFIG.police.maxWanted, this.wanted + n);
    this.lastSeen = gameTime;
    this.loseTimer = 0;
    return this.wanted !== before;
  }

  setWanted(n, gameTime) {
    this.wanted = Math.max(0, Math.min(CONFIG.police.maxWanted, n));
    this.lastSeen = gameTime;
    this.loseTimer = 0;
  }

  spawnCar(x, z) {
    const model = { name: 'MBPD Interceptor', color: CONFIG.palette.policeCar, speed: 1.12, sport: true };
    const car = new Car(this.scene, model, x, z, 0);
    car.makePolice();
    this.cars.push(car);
    return car;
  }

  spawnCop(x, z) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.5), navy);
    torso.position.y = 1.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
    head.position.y = 2.1;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), navy);
    cap.position.y = 2.38;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.38), navy);
    legL.position.set(-0.22, 0.45, 0);
    const legR = legL.clone();
    legR.position.x = 0.22;
    g.add(torso, head, cap, legL, legR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const cop = { mesh: g, pos: g.position, heading: 0, speed: 7.5, phase: 0, legL, legR, alive: true };
    this.cops.push(cop);
    return cop;
  }

  spawnHeli(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
    );
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.9, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd8f2 }),
    );
    glass.position.set(0, 0.2, 2.0);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
    );
    tail.position.set(0, 0.3, -4.2);
    this.rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x14181f }),
    );
    this.rotor.position.y = 1.1;
    // spotlight cone under the helicopter
    const coneGeo = new THREE.ConeGeometry(7, 34, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c9, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.spotCone = new THREE.Mesh(coneGeo, coneMat);
    this.spotCone.rotation.x = Math.PI;
    this.spotCone.position.y = -17;
    g.add(body, glass, tail, this.rotor, this.spotCone);
    g.position.set(x, 46, z);
    this.scene.add(g);
    this.heli = g;
    this.heliLight = new THREE.SpotLight(0xfff6c9, 60, 90, 0.35, 0.5, 1.2);
    this.scene.add(this.heliLight);
    this.heliLight.target = new THREE.Object3D();
    this.scene.add(this.heliLight.target);
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli);
    this.scene.remove(this.heliLight);
    this.scene.remove(this.heliLight.target);
    this.heli = null;
    this.heliLight = null;
    this.rotor = null;
    this.spotCone = null;
  }

  // One frame of the whole response: spawn to match the wanted level,
  // chase the focus point, and work out bust / lose-the-tail.
  update(dt, gameTime, focus, focusSpeed, onFoot, events) {
    this.flash += dt * 7;
    const wantCars = this.wanted === 0 ? 0 : Math.min(CONFIG.police.maxCars, 1 + this.wanted);
    while (this.cars.length < wantCars) {
      const a = this.rng.angle();
      this.spawnCar(focus.x + Math.cos(a) * 90, focus.z + Math.sin(a) * 90);
    }
    while (this.cars.length > wantCars) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
    const wantCops = this.wanted >= 2 && onFoot ? Math.min(CONFIG.police.maxFoot, this.wanted) : 0;
    while (this.cops.length < wantCops) {
      const a = this.rng.angle();
      this.spawnCop(focus.x + Math.cos(a) * 30, focus.z + Math.sin(a) * 30);
    }
    while (this.cops.length > wantCops) {
      const cop = this.cops.pop();
      this.scene.remove(cop.mesh);
    }
    if (this.wanted >= CONFIG.police.heliAtWanted && !this.heli) {
      this.spawnHeli(focus.x + 20, focus.z - 20);
      events.push({ type: 'heli', text: 'MBPD helicopter overhead — spotlight on you.' });
    }
    if (this.wanted < CONFIG.police.heliAtWanted && this.heli) this.removeHeli();

    // chase cars
    let nearestCar = Infinity;
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - focus.x, car.pos.z - focus.z);
      nearestCar = Math.min(nearestCar, d);
      const top = this.wanted >= 4 ? CONFIG.police.ramSpeed : CONFIG.police.chaseSpeed;
      car.steerToward(dt, focus.x, focus.z, top);
      if (car.lightBar) {
        const on = Math.sin(this.flash) > 0;
        car.lightRed.material.color.setHex(on ? 0xff2a2a : 0x661111);
        car.lightBlue.material.color.setHex(on ? 0x2a6bff : 0x112266);
      }
    }
    // foot cops run the player down
    let nearestCop = Infinity;
    for (const cop of this.cops) {
      const dx = focus.x - cop.pos.x;
      const dz = focus.z - cop.pos.z;
      const d = Math.hypot(dx, dz);
      nearestCop = Math.min(nearestCop, d);
      const want = Math.atan2(dx, dz);
      cop.heading = want;
      cop.pos.x += Math.sin(want) * cop.speed * dt;
      cop.pos.z += Math.cos(want) * cop.speed * dt;
      cop.phase += dt * 9;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = want;
      cop.legL.rotation.x = Math.sin(cop.phase) * 0.7;
      cop.legR.rotation.x = -Math.sin(cop.phase) * 0.7;
    }
    // helicopter circles above, spotlight tracking the player — low and
    // close enough to read in a chase frame
    if (this.heli) {
      const t = gameTime * 0.45;
      const hx = focus.x + Math.cos(t) * 18;
      const hz = focus.z + Math.sin(t) * 18;
      this.heli.position.set(hx, 30 + Math.sin(gameTime * 0.8) * 1.5, hz);
      this.heli.rotation.y = Math.atan2(focus.x - hx, focus.z - hz);
      this.rotor.rotation.y += dt * 22;
      this.heliLight.position.copy(this.heli.position);
      this.heliLight.target.position.set(focus.x, 0, focus.z);
    }
    // busted: a foot cop touches the player, or the car is boxed in
    const boxed = !onFoot && focusSpeed < 1.5 && nearestCar < 7 && this.cars.length >= 2;
    const caught = onFoot && nearestCop < 1.6;
    if (this.wanted > 0 && (boxed || caught)) {
      this.bustTimer += dt;
      if (this.bustTimer >= CONFIG.police.bustTime) {
        events.push({ type: 'busted' });
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // lose the tail: far away and slow for long enough
    const nearest = Math.min(nearestCar, nearestCop);
    if (this.wanted > 0 && nearest > CONFIG.police.loseDistance) {
      this.loseTimer += dt;
      if (this.loseTimer >= CONFIG.police.loseTime) {
        this.wanted -= 1;
        this.loseTimer = 0;
        events.push({ type: 'starLost', wanted: this.wanted });
      }
    } else {
      this.loseTimer = 0;
    }
    // named units for the response panel
    this.units = [];
    this.cars.slice(0, 4).forEach((car, i) => {
      const d = Math.round(Math.hypot(car.pos.x - focus.x, car.pos.z - focus.z));
      const status = d < 12 ? 'RAMMING' : d < 45 ? 'PURSUIT' : 'CLOSING IN';
      this.units.push({ name: UNIT_NAMES[i % UNIT_NAMES.length], distance: d, status });
    });
    if (this.heli) {
      this.units.push({ name: 'AIR-1', distance: 0, status: 'SPOTLIGHT' });
    }
    void STATUSES;
  }

  // Is any unit close enough to see the player right now?
  inSight(focus) {
    if (this.wanted === 0) return false;
    for (const car of this.cars) {
      if (Math.hypot(car.pos.x - focus.x, car.pos.z - focus.z) < 60) return true;
    }
    for (const cop of this.cops) {
      if (Math.hypot(cop.pos.x - focus.x, cop.pos.z - focus.z) < 25) return true;
    }
    return this.heli !== null;
  }
}
