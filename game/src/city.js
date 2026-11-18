// Meridian Bay city builder: streets, blocks, procedural buildings with
// lit windows, palms, lamps, the beach, the pier and the lighthouse.
// Everything is placed from a seeded RNG so the city is identical on
// every load. Colliders are plain AABBs the player and cars test against.

import * as THREE from 'three';
import { CONFIG, PALETTE, LANDMARKS } from './config.js';
import { makeRng, clamp } from './random.js';

function facadeTexture(rng, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = rng.pick(['#3a4a5e', '#4a3f55', '#54402e', '#2f4450', '#5e4632']);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 10 + c * 30;
      const y = 12 + r * 27;
      const on = lit && rng.chance(0.55);
      ctx.fillStyle = on ? (rng.chance(0.7) ? '#ffd98a' : '#9ad7ff') : '#141c28';
      ctx.fillRect(x, y, 20, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, 20, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101725';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '900 52px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    ctx.fillStyle = '#e8eef7';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText(sub, 256, 96);
  }
  const tex = new THREE.CanvasTexture(canvas);
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
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });

  // --- ground: grass base, asphalt roads, sidewalks, sand, sea
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, 0);
  grass.receiveShadow = false;
  group.add(grass);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const gridLines = [];
  for (let v = CONFIG.gridMin; v <= CONFIG.gridMax; v += CONFIG.block) gridLines.push(v);
  for (const at of gridLines) {
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2 * CONFIG.roadHalf + 4, 300), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(at, 0, 0);
    group.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(300, 2 * CONFIG.roadHalf + 4), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0, at);
    group.add(roadH);
    // centre dashes
    for (let d = -140; d <= 140; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), new THREE.MeshBasicMaterial({ color: 0xd8d8d8 }));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(at, 0.02, d + 8);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(d + 8, 0.02, at);
      dash2.rotation.z = Math.PI / 2;
      group.add(dash2);
    }
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CONFIG.beachX + 40, 0.02, 0);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CONFIG.seaX + 110, -0.4, 0);
  group.add(sea);

  // --- pier deck + lighthouse
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 10), pierMat);
  pier.position.set(CONFIG.beachX + 35, 0.4, 0);
  group.add(pier);
  colliders.push({ x0: CONFIG.beachX, x1: CONFIG.beachX + 70, z0: -5, z1: 5, top: 1.2 });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2ede0, emissive: 0xffe9a8, emissiveIntensity: 0.4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 10), lightMat);
  tower.position.set(CONFIG.pierEndX, 12, 0);
  group.add(tower);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lampTop.position.set(CONFIG.pierEndX, 24, 0);
  group.add(lampTop);
  colliders.push({ x0: CONFIG.pierEndX - 3, x1: CONFIG.pierEndX + 3, z0: -3, z1: 3, top: 22 });

  // --- buildings: one to three per block, taller downtown
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const downtown = (x, z) => Math.abs(x) < 45 && Math.abs(z) < 45;
  for (let gx = CONFIG.gridMin; gx < CONFIG.gridMax; gx += CONFIG.block) {
    for (let gz = CONFIG.gridMin; gz < CONFIG.gridMax; gz += CONFIG.block) {
      const cx = gx + CONFIG.block / 2;
      const cz = gz + CONFIG.block / 2;
      if (cx > CONFIG.beachX - 20) continue;
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const h = downtown(cx, cz) ? rng.range(24, 64) : rng.range(8, 24);
        const bx = cx + rng.range(-8, 8);
        const bz = cz + rng.range(-8, 8);
        const mat = facadeMats[rng.int(0, facadeMats.length - 1)];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(bx, h / 2, bz);
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 1, 0.8, d + 1);
        roof.position.set(bx, h + 0.4, bz);
        group.add(roof);
        colliders.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2, top: h });
      }
    }
  }

  // --- landmark buildings with name signs
  for (const lm of LANDMARKS) {
    const mat = facadeMats[rng.int(0, facadeMats.length - 1)];
    const b = new THREE.Mesh(boxGeo, mat);
    b.scale.set(lm.w, lm.h, lm.d);
    b.position.set(lm.x, lm.h / 2, lm.z);
    group.add(b);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(lm.w + 1, 0.8, lm.d + 1);
    roof.position.set(lm.x, lm.h + 0.4, lm.z);
    group.add(roof);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(lm.w * 0.9, lm.w * 0.22),
      new THREE.MeshBasicMaterial({ map: signTexture(lm.name, ''), transparent: false }),
    );
    sign.position.set(lm.x, lm.h * 0.82, lm.z + lm.d / 2 + 0.15);
    group.add(sign);
    signMeshes.push(sign);
    colliders.push({ x0: lm.x - lm.w / 2, x1: lm.x + lm.w / 2, z0: lm.z - lm.d / 2, z1: lm.z + lm.d / 2, top: lm.h });
  }

  // --- palms along the coast road and plaza
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafGeo = new THREE.ConeGeometry(3.2, 2.2, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  for (let i = 0; i < 90; i++) {
    const along = rng.range(-140, 140);
    const x = rng.chance(0.5) ? 112 : rng.range(-130, 130);
    const z = x === 112 ? along : rng.pick([-132, 132, -92, 92, -52, 52, -12, 12]);
    if (Math.abs(x) > 138 || Math.abs(z) > 138) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 7.6, z);
    group.add(leaves);
  }

  // --- street lamps (emissive heads, glow at night)
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const headGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const at of gridLines) {
    for (let d = -120; d <= 120; d += 40) {
      for (const [x, z] of [[at + 7, d], [d, at + 7]]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3, z);
        group.add(pole);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(x, 6.2, z);
        group.add(head);
        lamps.push(head);
      }
    }
  }

  // --- beach props: umbrellas, benches, crates
  const umbrellaMat = new THREE.MeshLambertMaterial({ color: 0xe85d75 });
  const umbrellaMat2 = new THREE.MeshLambertMaterial({ color: 0x3fa7d6 });
  for (let i = 0; i < 14; i++) {
    const x = rng.range(146, 176);
    const z = rng.range(-130, 130);
    const um = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 8), i % 2 ? umbrellaMat : umbrellaMat2);
    um.position.set(x, 2.6, z);
    group.add(um);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), poleMat);
    stick.position.set(x, 1.2, z);
    group.add(stick);
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e });
  for (let i = 0; i < 18; i++) {
    const x = rng.range(-130, 130);
    const z = rng.pick([-108, -68, -28, 12, 52, 92]);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
    bench.position.set(x, 0.6, z);
    group.add(bench);
  }

  // --- plaza fountain in downtown
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.2, 14),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 0.4, 14),
    new THREE.MeshLambertMaterial({ color: 0x2f8fb5 }),
  );
  water.position.set(0, 1.2, 0);
  group.add(water);
  colliders.push({ x0: -6.5, x1: 6.5, z0: -6.5, z1: 6.5, top: 1.2 });

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
    if (x + radius > c.x0 && x - radius < c.x1 && z + radius > c.z0 && z - radius < c.z1) return true;
  }
  return false;
}

export function clampToCity(x, z) {
  return {
    x: clamp(x, -150, CONFIG.beachX + 60),
    z: clamp(z, -150, 150),
  };
}
