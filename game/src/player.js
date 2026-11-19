// Meridian Bay — Cassian Rowe on foot: WASD movement relative to the
// camera, run, jump, a low-poly walker whose legs swing, and entering cars.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function limb(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(-40, 0, 30);
    this.heading = 0; // radians, 0 = facing +z... forward is -z in three
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.health = CONFIG.player.health;
    this.onFoot = true;
    this.car = null; // the car currently driven, if any
    this.walkPhase = 0;
    this.mesh = this.buildMesh();
    scene.add(this.mesh);
  }

  buildMesh() {
    const g = new THREE.Group();
    g.name = 'cassian';
    // jacket, jeans, skin head, cap — bright so he reads at a distance
    this.torso = limb(0.9, 1.0, 0.5, 0x1e6fd9, 0, 1.35, 0);
    this.head = limb(0.5, 0.5, 0.5, 0xe8b98a, 0, 2.15, 0);
    this.cap = limb(0.56, 0.16, 0.56, 0xff2e88, 0, 2.42, 0);
    this.legL = limb(0.34, 0.85, 0.4, 0x2c3440, -0.24, 0.45, 0);
    this.legR = limb(0.34, 0.85, 0.4, 0x2c3440, 0.24, 0.45, 0);
    this.armL = limb(0.28, 0.85, 0.34, 0x1e6fd9, -0.6, 1.35, 0);
    this.armR = limb(0.28, 0.85, 0.34, 0x1e6fd9, 0.6, 1.35, 0);
    g.add(this.torso, this.head, this.cap, this.legL, this.legR, this.armL, this.armR);
    return g;
  }

  reset(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.vy = 0;
    this.health = CONFIG.player.health;
    this.onFoot = true;
    this.car = null;
    this.mesh.visible = true;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * Math.min(1, this.speed / 5) * 0.6;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
  }

  // Move on foot. camYaw is the camera's yaw so WASD stays camera-relative.
  update(dt, input, city, camYaw) {
    if (!this.onFoot) return;
    const axes = input.moveAxes();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    const mag = Math.hypot(axes.x, axes.y);
    let want = 0;
    if (mag > 0.01) {
      const ax = axes.x / mag;
      const ay = axes.y / mag;
      // camera-relative: forward is away from the camera
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      const mx = fx * ay + rx * ax;
      const mz = fz * ay + rz * ax;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      want = target;
    }
    this.speed += (want - this.speed) * Math.min(1, dt * CONFIG.player.accel / 10);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const solved = city.resolveCircle(nx, nz, CONFIG.player.radius);
    this.pos.x = Math.max(-205, Math.min(285, solved.x));
    this.pos.z = Math.max(-205, Math.min(205, solved.z));
    // jump + gravity
    if (this.grounded && input.pressed('Space')) {
      this.vy = CONFIG.player.jumpSpeed;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= CONFIG.player.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    this.walkPhase += dt * this.speed * 1.6;
    this.syncMesh();
  }

  // The point the camera follows: the car when driving, the player on foot.
  focusPoint() {
    return this.car ? this.car.pos : this.pos;
  }

  focusHeading() {
    return this.car ? this.car.heading : this.heading;
  }

  focusSpeed() {
    return this.car ? Math.abs(this.car.speed) : this.speed;
  }
}
