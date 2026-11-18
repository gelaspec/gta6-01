// Meridian Bay — the city itself: a 7x7 street grid, five districts,
// a beach and pier with a lighthouse on the east edge, procedural
// buildings with canvas window textures, palm trees, neon signs and
// a plaza fountain. Everything is generated from the seed.

import * as THREE from 'three';
import { CONFIG, PALETTE, LANDMARKS, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

function facadeTexture(rng, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const base = ['#e8dcc8', '#d8c8b0', '#c8b8a0', '#e0d0c0'][Math.floor(rng.next() * 4)];
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Rows of windows; lit ones glow warm at night.
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 10 + col * 30;
      const y = 12 + row * 30;
      const on = lit && rng.chance(0.55);
      g.fillStyle = on ? '#ffd88a' : (rng.chance(0.5) ? '#3a5a78' : '#2a4258');
      g.fillRect(x, y, 20, 18);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 20, 3);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101826';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ffd34d';
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    g.fillStyle = '#e8eef7';
    g.font = '28px Arial, sans-serif';
    g.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function neonTexture(text, ink, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1020';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = ink;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 500, 148);
  g.fillStyle = ink;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 62 : 80);
  if (sub) {
    g.font = '30px Arial, sans-serif';
    g.fillText(sub, 256, 122);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = [];
  const lamps = [];
  const windowMats = [];
  const signMeshes = [];

  const facadeTex = [facadeTexture(rng, false), facadeTexture(rng, true), facadeTexture(rng, false)];
  const facadeMats = facadeTex.map(
    (t) =>
      new THREE.MeshLambertMaterial({
        map: t,
        emissiveMap: t,
        emissive: new THREE.Color(0xffc46b),
        emissiveIntensity: 0,
      }),
  );
  windowMats.push(...facadeMats);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a4152 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xa8845c });

  // --- ground: grass base, asphalt roads, sand, sea
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, 0);
  group.add(grass);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const gridLines = [];
  for (let v = CONFIG.gridMin; v <= CONFIG.gridMax; v += CONFIG.block) gridLines.push(v);
  for (const at of gridLines) {
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2 * CONFIG.roadHalf + 4, 300), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(at, 0, 0);
    group.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(2 * CONFIG.roadHalf + 4, 300), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.rotation.z = Math.PI / 2;
    roadH.position.set(0, 0, at);
    group.add(roadH);
    // Pale centre dashes so the bright road reads at speed.
    for (let d = -140; d <= 140; d += 16) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 3),
        new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }),
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(at, 0.02, d);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(d, 0.02, at);
      dash2.rotation.z = Math.PI / 2;
      group.add(dash2);
    }
  }

  // Sidewalk strips along every road.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const at of gridLines) {
    for (const off of [-8, 8]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(3, 300), walkMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(at + off, 0.01, 0);
      group.add(strip);
      const strip2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 300), walkMat);
      strip2.rotation.x = -Math.PI / 2;
      strip2.position.set(0, 0.01, at + off);
      group.add(strip2);
    }
  }

  // Beach sand east of the grid, then the turquoise sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CONFIG.beachX + 18, 0.02, 0);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CONFIG.seaX + 90, -0.1, 0);
  group.add(sea);

  // Pier: wooden planks out to the lighthouse.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 10), pierMat);
  pier.position.set(172, 0.3, 0);
  group.add(pier);
  for (let x = 145; x <= 200; x += 7) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), pierMat);
    post.position.set(x, -0.6, x % 2 === 0 ? 4.6 : -4.6);
    group.add(post);
  }
  colliders.push({ x: 172, z: 0, r: 36 });

  // Lighthouse at the pier end: striped tower + lamp room.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xff3b30 });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6 - i * 0.25, 2.9 - i * 0.25, 4.4, 12),
      i % 2 === 0 ? lightMat : stripeMat,
    );
    seg.position.set(205, 2.5 + i * 4.4, 0);
    group.add(seg);
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 3, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lampRoom.position.set(205, 25.5, 0);
  group.add(lampRoom);
  const lampCap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 10), stripeMat);
  lampCap.position.set(205, 28, 0);
  group.add(lampCap);

  // --- buildings: one per block, skipping roads and the plaza
  const plaza = { x: 0, z: 0 };
  for (let gx = -3; gx <= 2; gx++) {
    for (let gz = -3; gz <= 2; gz++) {
      const cx = gx * CONFIG.block + 20;
      const cz = gz * CONFIG.block + 20;
      if (Math.abs(cx - plaza.x) < 25 && Math.abs(cz - plaza.z) < 25) continue;
      if (cx > 120) continue;
      const h = 8 + rng.range(0, 26) * (Math.abs(cx) < 40 ? 1.6 : 1);
      const w = 16 + rng.range(0, 10);
      const d = 14 + rng.range(0, 8);
      const mat = facadeMats[Math.floor(rng.next() * facadeMats.length)];
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.set(cx, h / 2, cz);
      group.add(box);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1), roofMat);
      roof.position.set(cx, h + 0.4, cz);
      group.add(roof);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), trimMat);
      trim.position.set(cx, 0.5, cz);
      group.add(trim);
      colliders.push({ x: cx, z: cz, r: Math.max(w, d) * 0.62 });
    }
  }

  // Landmark buildings with name signs.
  for (const lm of LANDMARKS) {
    const h = lm.h;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(lm.w, h, lm.d),
      new THREE.MeshLambertMaterial({ color: 0xd8c8b0, map: facadeTex[1] }),
    );
    box.position.set(lm.x, h / 2, lm.z);
    group.add(box);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(lm.w * 0.9, 3.2),
      new THREE.MeshBasicMaterial({ map: signTexture(lm.name, ''), transparent: false }),
    );
    sign.position.set(lm.x, h + 1.8, lm.z + lm.d / 2 + 0.1);
    group.add(sign);
    signMeshes.push(sign);
    colliders.push({ x: lm.x, z: lm.z, r: Math.max(lm.w, lm.d) * 0.62 });
  }

  // Neon billboards on downtown towers.
  const neons = [
    { text: 'MERIDIAN', ink: '#ff4da6', x: -20, z: -60, y: 34 },
    { text: 'BAY NIGHTS', ink: '#33e0ff', x: 20, z: -100, y: 30 },
    { text: 'CASINO', ink: '#ffe14d', x: 20, z: 100, y: 26, sub: 'ROYALE' },
    { text: 'PIER 9', ink: '#9dff57', x: 100, z: 20, y: 22 },
    { text: 'VELA MOTORS', ink: '#ff7a1a', x: 60, z: -100, y: 18 },
  ];
  for (const n of neons) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 5),
      new THREE.MeshBasicMaterial({ map: neonTexture(n.text, n.ink, n.sub || ''), transparent: false }),
    );
    board.position.set(n.x, n.y, n.z);
    group.add(board);
    signMeshes.push(board);
  }

  // Palm trees along Coast Road and the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 7, 8), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 5), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.8, 7.2, z + Math.sin(a) * 1.8);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
  }
  for (let z = -120; z <= 120; z += 20) {
    palm(112, z);
    palm(128, z + 10);
  }
  for (let i = 0; i < 10; i++) palm(rng.range(-30, 30), rng.range(-30, 30));

  // Street lamps along the avenues.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  for (const at of gridLines) {
    for (let d = -100; d <= 100; d += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 6), poleMat);
      pole.position.set(at + 7.5, 2.75, d);
      group.add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffd88a, emissiveIntensity: 0.4 }),
      );
      head.position.set(at + 7.5, 5.6, d);
      group.add(head);
      lamps.push(head);
    }
  }

  // Plaza fountain at the centre of the map.
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0xb9bfc9 }),
  );
  basin.position.set(0, 0.6, 0);
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.4, 0.3, 20),
    new THREE.MeshLambertMaterial({ color: 0x2a9db5 }),
  );
  water.position.set(0, 1.2, 0);
  group.add(water);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  spout.position.set(0, 2.4, 0);
  group.add(spout);
  colliders.push({ x: 0, z: 0, r: 8 });

  // District name plates at the map corners, readable from the air.
  for (const d of DISTRICTS) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 4),
      new THREE.MeshBasicMaterial({ map: signTexture(d.name, ''), transparent: false }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set((d.x0 + d.x1) / 2, 0.05, (d.z0 + d.z1) / 2);
    group.add(plate);
  }

  return {
    group,
    colliders,
    lamps,
    windowMats,
    signMeshes,
    spawn: { x: 0, z: 60 },
    roadLines: gridLines,
  };
}

export function pointBlocked(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const r = c.r + radius;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export function clampToCity(x, z) {
  return {
    x: clamp(x, -150, CONFIG.beachX + 60),
    z: clamp(z, -150, 150),
  };
}
