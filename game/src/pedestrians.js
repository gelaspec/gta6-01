// Meridian Bay — pedestrians on the sidewalks: they stroll between
// corners, chat in place, and run away from gunshots, speeding cars and
// police chases. Bright shirts so the streets read as alive.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const SHIRTS = [0xff5f8f, 0x2fb7ff, 0xffc61a, 0x7ac74c, 0xb46bff, 0xff7a3c, 0xf2f2f2, 0x2c3440];
const PANTS = [0x2c3440, 0x4a5a6e, 0x6b4a2f, 0x3a3a3a];

export class Pedestrian {
  constructor(scene, rng, x, z) {
    this.rng = rng;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = rng.angle();
    this.speed = rng.range(1.2, 2.2);
    this.state = 'walk'; // walk | idle | flee
    this.stateTime = rng.range(0, 6);
    this.target = this.pickTarget();
    this.health = CONFIG.combat.pedHealth;
    this.alive = true;
    this.phase = rng.range(0, Math.PI * 2);
    this.mesh = this.buildMesh(rng);
    scene.add(this.mesh);
    this.syncMesh();
  }

  buildMesh(rng) {
    const g = new THREE.Group();
    const shirt = rng.pick(SHIRTS);
    const pants = rng.pick(PANTS);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.45), mat(shirt));
    torso.position.y = 1.3;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat(0xe8b98a));
    head.position.y = 2.0;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), mat(rng.pick([0x1c1c1c, 0x6b4a2f, 0xd8d8d8])));
    hair.position.y = 2.28;
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.36), mat(pants));
    this.legL.position.set(-0.2, 0.42, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.2;
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.3), mat(shirt));
    this.armL.position.set(-0.52, 1.3, 0);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.52;
    g.add(torso, head, hair, this.legL, this.legR, this.armL, this.armR);
    return g;
  }

  pickTarget() {
    // a sidewalk corner near the current spot
    const cx = Math.max(-196, Math.min(196, this.pos.x + this.rng.range(-70, 70)));
    const cz = Math.max(-196, Math.min(196, this.pos.z + this.rng.range(-70, 70)));
    return new THREE.Vector3(cx, 0, cz);
  }

  fleeFrom(x, z) {
    this.state = 'flee';
    this.stateTime = this.rng.range(3, 6);
    const dx = this.pos.x - x;
    const dz = this.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.target.set(this.pos.x + (dx / d) * 60, 0, this.pos.z + (dz / d) * 60);
    this.target.x = Math.max(-196, Math.min(196, this.target.x));
    this.target.z = Math.max(-196, Math.min(196, this.target.z));
  }

  update(dt, threats) {
    if (!this.alive) return;
    this.stateTime -= dt;
    // a nearby threat flips a walker into a runner
    for (const t of threats) {
      const d = Math.hypot(this.pos.x - t.x, this.pos.z - t.z);
      if (d < t.radius && this.state !== 'flee') this.fleeFrom(t.x, t.z);
    }
    if (this.state === 'flee' && this.stateTime <= 0) {
      this.state = 'walk';
      this.target = this.pickTarget();
    }
    if (this.state === 'idle') {
      if (this.stateTime <= 0) {
        this.state = 'walk';
        this.target = this.pickTarget();
      }
      this.syncMesh();
      return;
    }
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      if (this.state === 'walk' && this.rng.chance(0.3)) {
        this.state = 'idle';
        this.stateTime = this.rng.range(2, 7);
      } else {
        this.target = this.pickTarget();
      }
      this.syncMesh();
      return;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * 6);
    const speed = this.state === 'flee' ? 6.5 : this.speed;
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.pos.x = Math.max(-200, Math.min(200, this.pos.x));
    this.pos.z = Math.max(-200, Math.min(200, this.pos.z));
    this.phase += dt * speed * 2.2;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.phase) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;
  }

  die() {
    this.alive = false;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.35;
  }
}

export class Pedestrians {
  constructor(scene, rng) {
    this.list = [];
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-190, 190);
      const z = rng.range(-190, 190);
      this.list.push(new Pedestrian(scene, rng, x, z));
    }
  }

  update(dt, threats) {
    for (const p of this.list) p.update(dt, threats);
  }

  // Everyone alive within radius of a point (for combat + missions).
  near(x, z, radius) {
    return this.list.filter((p) => p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < radius);
  }
}
