// Meridian Bay — Cassian Rowe on foot. Capsule built from boxes (vest, belt,
// shoes), third-person movement relative to the camera, jump + gravity.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function buildBody() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const vest = new THREE.MeshLambertMaterial({ color: 0x2e6f5e }); // teal vest
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x241a12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), vest);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.36), shirt);
  chest.position.y = 1.22;
  g.add(chest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.34), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hair);
  hairTop.position.y = 2.0;
  g.add(hairTop);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.32), new THREE.MeshLambertMaterial({ color: 0x6a4a26 }));
  belt.position.y = 0.82;
  g.add(belt);
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), jeans);
    leg.position.set(sx, 0.4, 0);
    leg.castShadow = true;
    g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.44), shoes);
    shoe.position.set(sx, 0.06, 0.06);
    g.add(shoe);
  }
  for (const sx of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), shirt);
    arm.position.set(sx, 1.16, 0);
    g.add(arm);
  }
  return g;
}

export function createPlayer(scene, city) {
  const mesh = buildBody();
  scene.add(mesh);
  const pos = new THREE.Vector3(0, 0, 30);
  let heading = 0; // radians, 0 = facing -z
  let vy = 0;
  let onGround = true;
  let walkPhase = 0;
  const legs = [mesh.children[6], mesh.children[8]];
  const arms = [mesh.children[10], mesh.children[11]];

  function update(dt, input, camYaw) {
    const ax = input.axis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
    // movement relative to camera yaw
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const mx = -sin * ax.y + cos * ax.x;
    const mz = -cos * ax.y - sin * ax.x;
    const moving = Math.abs(ax.x) + Math.abs(ax.y) > 0;
    if (moving) {
      const len = Math.hypot(mx, mz) || 1;
      const nx = (mx / len) * speed * dt;
      const nz = (mz / len) * speed * dt;
      const res = city.resolveCollision(pos.x + nx, pos.z + nz, 0.6);
      pos.x = res.x;
      pos.z = res.z;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      heading += dh * Math.min(1, dt * 12);
      walkPhase += dt * (running ? 11 : 7);
      const swing = Math.sin(walkPhase) * 0.55;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * 0.7;
      arms[1].rotation.x = swing * 0.7;
    } else {
      legs[0].rotation.x *= 0.8;
      legs[1].rotation.x *= 0.8;
      arms[0].rotation.x *= 0.8;
      arms[1].rotation.x *= 0.8;
    }
    // jump + gravity
    if (input.hit('Space') && onGround) {
      vy = CONFIG.jumpSpeed;
      onGround = false;
    }
    vy -= CONFIG.gravity * dt;
    pos.y += vy * dt;
    if (pos.y <= 0) {
      pos.y = 0;
      vy = 0;
      onGround = true;
    }
    // clamp to the playable area (city + beach, not into the sea)
    pos.x = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.beachX + 52, pos.x));
    pos.z = Math.max(-CONFIG.cityHalf - 6, Math.min(CONFIG.cityHalf + 6, pos.z));
    mesh.position.copy(pos);
    mesh.rotation.y = heading;
    return { moving, running };
  }

  function setPos(x, z, h = 0) {
    pos.set(x, 0, z);
    heading = h;
    mesh.position.copy(pos);
    mesh.rotation.y = heading;
  }

  return { mesh, pos, get heading() { return heading; }, update, setPos };
}
