// Meridian Bay itself: a 7x7 grid city with a beach, the sea and a pier.
// Everything is procedural from a seed: roads, buildings with lit windows,
// palms, streetlights and props. The module also answers the questions the
// rest of the game asks: which district is this, what street, is it solid?

import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, rngRange, rngInt, rngPick, rngChance, clamp } from './random.js';

// Canvas texture for a building facade: base colour + a grid of windows,
// some lit warm, so the city reads at dusk and at neon night.
function facadeTexture(base, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  const cols = 5;
  const rows = 10;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : 'rgba(20,26,38,0.85)';
      g.fillRect(8 + x * 24, 16 + y * 24, 16, 15);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One long road texture: asphalt with a dashed centre line and edge lines,
// repeated along the road so dashes stay the same size everywhere.
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4f5e';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#ffe9a8';
  g.fillRect(62, 10, 4, 44);
  g.fillRect(62, 74, 4, 44);
  g.fillStyle = '#e8e8e8';
  g.fillRect(4, 0, 3, 128);
  g.fillRect(121, 0, 3, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

export function buildCity(THREE, seed = 1) {
  const rng = mulberry32(seed);
  const P = CFG.palette;
  const C = CFG.city;
  const group = new THREE.Group();
  group.name = 'city';

  const colliders = [];
  const lambert = (color) => new THREE.MeshLambertMaterial({ color });

  // Ground: one big grass plane, then a drier patchwork tint via a second
  // translucent plane so the city does not look flat green.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    lambert(P.grass),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(140, -0.05, 0);
  group.add(ground);

  // Roads: one textured plane per grid line, both directions.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const line of C.roads) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(528, C.roadW), roadMat.clone());
    h.material.map = roadTex.clone();
    h.material.map.repeat.set(528 / 24, 1);
    h.material.map.needsUpdate = true;
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, line);
    group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(C.roadW, 528), roadMat.clone());
    v.material.map = roadTex.clone();
    v.material.map.repeat.set(528 / 24, 1);
    v.material.map.needsUpdate = true;
    v.rotation.x = -Math.PI / 2;
    v.rotation.z = Math.PI / 2;
    v.position.set(line, 0.02, 0);
    group.add(v);
  }

  // Beach sand, then the sea stretching east to the horizon.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(64, 560), lambert(P.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(C.beachX + 30, 0.01, 0);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 1100),
    new THREE.MeshPhongMaterial({ color: P.sea, shininess: 90, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(C.seaX + 280, 0.0, 0);
  sea.name = 'sea';
  group.add(sea);

  // Pier: wooden deck on posts, out into the sea at z = 0.
  const pier = new THREE.Group();
  pier.name = 'pier';
  const deckMat = lambert(P.pierWood);
  for (let x = C.pier.x0; x < C.pier.x1; x += 6) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 24), deckMat);
    plank.position.set(x + 3, 0.55, 0);
    pier.add(plank);
  }
  for (let x = C.pier.x0 + 4; x < C.pier.x1; x += 14) {
    for (const z of [-10, 10]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 8), lambert(0x6a4a2e));
      post.position.set(x, -0.8, z);
      pier.add(post);
    }
  }
  group.add(pier);

  // Buildings: one to three per block, skipped on two plaza blocks.
  // Downtown blocks are tall; the rest are low and colourful.
  const facadeMats = CFG.palette.building.map((c) => {
    const tex = facadeTexture(hexCss(c), 0.45, mulberry32(100 + c % 97));
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const downtownMats = CFG.palette.buildingDowntown.map((c) => {
    const tex = facadeTexture(hexCss(c), 0.55, mulberry32(200 + c % 89));
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const plazas = new Set(['-1,1', '1,-1']);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const cx = (i - 3) * C.pitch;
      const cz = (j - 3) * C.pitch;
      const key = `${i - 3},${j - 3}`;
      const downtown = Math.abs(cx) < 108 && Math.abs(cz) < 108;
      if (plazas.has(key)) {
        // Plaza: a little park with palms and benches instead of buildings.
        for (let p = 0; p < 5; p++) {
          addPalm(group, rng, cx + rngRange(rng, -20, 20), cz + rngRange(rng, -20, 20));
        }
        continue;
      }
      const n = downtown ? rngInt(rng, 2, 4) : rngInt(rng, 1, 3);
      for (let b = 0; b < n; b++) {
        const w = rngRange(rng, 14, 24);
        const d = rngRange(rng, 14, 24);
        const h = downtown ? rngRange(rng, 30, 68) : rngRange(rng, 8, 24);
        const ox = rngRange(rng, -12, 12);
        const oz = rngRange(rng, -12, 12);
        const bx = cx + ox;
        const bz = cz + oz;
        if (Math.abs(bx) > 240 || Math.abs(bz) > 240) continue;
        const mat = downtown ? rngPick(rng, downtownMats) : rngPick(rng, facadeMats);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        group.add(mesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), lambert(0x2a2e38));
        roof.position.set(bx, h + 0.4, bz);
        group.add(roof);
        colliders.push({ minX: bx - w / 2 - 0.4, maxX: bx + w / 2 + 0.4, minZ: bz - d / 2 - 0.4, maxZ: bz + d / 2 + 0.4 });
      }
    }
  }

  // Palms along the beach road and the north avenue.
  for (let z = -240; z <= 240; z += 36) {
    addPalm(group, rng, 246, z + rngRange(rng, -4, 4));
    if (rngChance(rng, 0.6)) addPalm(group, rng, -246, z + rngRange(rng, -4, 4));
  }
  for (let x = -240; x <= 240; x += 48) {
    if (rngChance(rng, 0.5)) addPalm(group, rng, x + rngRange(rng, -4, 4), -246);
  }

  // Streetlights at every other intersection; emissive so they glow at night.
  const poleMat = lambert(0x2e3138);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of [-180, -36, 108, 252]) {
    for (const z of [-180, -36, 108, 252]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 8), poleMat);
      pole.position.set(x + 9, 3.5, z + 9);
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), poleMat);
      arm.position.set(x + 8, 6.9, z + 9);
      group.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampMat);
      lamp.position.set(x + 6.9, 6.8, z + 9);
      group.add(lamp);
    }
  }

  // Port props west: crates and containers near Old Port.
  for (let i = 0; i < 10; i++) {
    const s = rngRange(rng, 2, 4);
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      lambert(rngPick(rng, [0xc8742e, 0x3e7ab8, 0x7ab83e, 0xb83e3e])),
    );
    crate.position.set(rngRange(rng, -248, -196), s / 2, rngRange(rng, -200, 200));
    crate.rotation.y = rngRange(rng, 0, Math.PI);
    group.add(crate);
    colliders.push({
      minX: crate.position.x - s / 2, maxX: crate.position.x + s / 2,
      minZ: crate.position.z - s / 2, maxZ: crate.position.z + s / 2,
    });
  }

  function addPalm(g, r, x, z) {
    const palm = new THREE.Group();
    const h = rngRange(r, 5, 8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, h, 7), lambert(P.palmTrunk));
    trunk.position.y = h / 2;
    trunk.rotation.z = rngRange(r, -0.08, 0.08);
    palm.add(trunk);
    const leafMat = lambert(P.palmLeaf);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.3, h + 0.4, Math.sin(a) * 1.3);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lambert(0x6a4a2e));
    nuts.position.y = h + 0.2;
    palm.add(nuts);
    palm.position.set(x, 0, z);
    g.add(palm);
  }

  // --- Queries the rest of the game uses ---------------------------------
  function districtAt(x, z) {
    if (Math.abs(x) < 108 && Math.abs(z) < 108) return 'DOWNTOWN';
    if (x > 108) return 'MARINA';
    if (x < -108) return 'OLD PORT';
    if (z > 108) return 'CALLE VERDE';
    return 'THE PALMS';
  }

  function streetAt(x, z) {
    const roads = CFG.city.roads;
    let bx = roads[0];
    let bz = roads[0];
    for (const r of roads) {
      if (Math.abs(x - r) < Math.abs(x - bx)) bx = r;
      if (Math.abs(z - r) < Math.abs(z - bz)) bz = r;
    }
    const ix = roads.indexOf(bx);
    const iz = roads.indexOf(bz);
    const ew = Math.abs(x - bx) < Math.abs(z - bz);
    return ew ? CFG.streetsEW[iz] : CFG.streetsNS[ix];
  }

  function collides(x, z, r) {
    if (x < -258 || x > 400 || z < -258 || z > 258) return true;
    // The sea blocks everything past the beach except on the pier deck.
    if (x > C.seaX - 6) {
      const onPier = z > C.pier.z0 && z < C.pier.z1 && x < C.pier.x1;
      if (!onPier) return true;
    }
    for (const b of colliders) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  // Push a circle out of whatever it overlaps; returns true if it hit.
  function pushOut(p, r) {
    let hit = false;
    for (const b of colliders) {
      if (p.x + r > b.minX && p.x - r < b.maxX && p.z + r > b.minZ && p.z - r < b.maxZ) {
        const dxl = p.x + r - b.minX;
        const dxr = b.maxX - (p.x - r);
        const dzl = p.z + r - b.minZ;
        const dzr = b.maxZ - (p.z - r);
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) p.x = b.minX - r;
        else if (m === dxr) p.x = b.maxX + r;
        else if (m === dzl) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
        hit = true;
      }
    }
    return hit;
  }

  function randomRoadPoint(r) {
    const line = rngPick(r, CFG.city.roads);
    const along = rngRange(r, -240, 240);
    return rngChance(r, 0.5) ? { x: line, z: along } : { x: along, z: line };
  }

  return {
    group,
    colliders,
    districtAt,
    streetAt,
    collides,
    pushOut,
    randomRoadPoint,
    spawn: {
      pier: { x: 300, z: 0 },
      marina: { x: 200, z: -36 },
      downtown: { x: 0, z: 36 },
      calleVerde: { x: -36, z: 180 },
      palms: { x: 36, z: -180 },
      oldPort: { x: -180, z: 36 },
    },
    pierEnd: { x: 390, z: 0 },
    rng,
  };
}
