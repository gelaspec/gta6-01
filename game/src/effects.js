// Meridian Bay — particles and screen shake: muzzle flashes, sparks,
// tire smoke, pickup glints and the golden-hour dust that hangs over the
// coast road. One pooled Points cloud, no per-frame allocation.
import * as THREE from 'three';

const MAX = 420;

export class Effects {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'particles';
    scene.add(this.points);
    // a reusable flash sprite for muzzle + pickups
    const flashGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c9, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashTime = 0;
  }

  spawn(x, y, z, color, speed, life) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    const c = new THREE.Color(color);
    this.colors[i * 3] = c.r;
    this.colors[i * 3 + 1] = c.g;
    this.colors[i * 3 + 2] = c.b;
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * 2 - 0.4;
    this.vel[i * 3] = Math.cos(a) * speed;
    this.vel[i * 3 + 1] = up * speed;
    this.vel[i * 3 + 2] = Math.sin(a) * speed;
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  burst(pos, color, count, speed = 6, life = 0.6) {
    for (let i = 0; i < count; i++) {
      this.spawn(pos.x, pos.y + 1, pos.z, color, speed * (0.5 + Math.random()), life * (0.6 + Math.random() * 0.8));
    }
  }

  smoke(pos, count = 3) {
    for (let i = 0; i < count; i++) {
      this.spawn(pos.x, pos.y + 0.3, pos.z, 0x8a8f96, 1.6, 1.1);
    }
  }

  muzzle(player) {
    const p = player.focusPoint();
    const fx = Math.sin(player.focusHeading());
    const fz = Math.cos(player.focusHeading());
    this.flash.position.set(p.x + fx * 1.6, p.y + 1.5, p.z + fz * 1.6);
    this.flash.visible = true;
    this.flashTime = 0.07;
    this.burst(new THREE.Vector3(p.x + fx * 1.6, p.y + 1.4, p.z + fz * 1.6), 0xffe14d, 6, 8, 0.25);
  }

  shake(amount) {
    this.renderer.addShake(amount);
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100; // park dead particles underground
        continue;
      }
      this.life[i] -= dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 5 * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] = 0;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.material.opacity = Math.max(0, this.flashTime / 0.07);
      this.flash.lookAt(this.renderer.camera.position);
      if (this.flashTime <= 0) this.flash.visible = false;
    }
  }
}
