// Meridian Bay — procedural coastal city (7x7 grid, beach + pier + lighthouse).
// Bright palette on purpose: light-grey roads, pastel facades, turquoise sea.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const P = CONFIG.palette;

// A canvas texture for a building facade: window grid, some windows lit, a
// ground-floor shopfront with a sign. One texture per facade colour keeps the
// city varied without any image files.
function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shading so towers read at a distance
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.10)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // windows: 4 columns x 9 rows
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 10 + col * 29;
      const y = 12 + row * 24;
      const lit = rng.f() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : '#2e3d4d';
      g.fillRect(x, y, 20, 15);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 20, 3);
    }
  }
  // ground-floor shopfront
  g.fillStyle = '#20242c';
  g.fillRect(6, 226, 116, 28);
  g.fillStyle = '#9be8ff';
  g.fillRect(10, 230, 108, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roofTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = `#${P.roof[rng.int(0, P.roof.length - 1)].toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.strokeRect(4, 4, 56, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A neon sign board: coloured panel + glowing text, on two posts.
function makeSign(text, color, w = 14) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.1875),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  panel.position.y = 7.5;
  g.add(panel);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.5, 6), postMat);
    post.position.set(dx, 3.75, 0);
    g.add(post);
  }
  return g;
}

function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: P.palmTrunk });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.4, 7), trunkMat);
  trunk.position.y = 2.7;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: P.palmLeaf, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.5, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9);
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5a34 }),
  );
  nuts.position.y = 5.2;
  g.add(nuts);
  return g;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const { block, roadWidth, cityHalf } = CONFIG;
  const half = cityHalf;

  // -- ground: pale sand base under everything, grass plaza in the middle ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 220, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: P.sand }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // -- sea (east) + beach ---------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(90, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: P.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CONFIG.seaX + 45, 0.05, 0);
  group.add(sea);
  const seaDeep = new THREE.Mesh(
    new THREE.PlaneGeometry(60, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: P.seaDeep }),
  );
  seaDeep.rotation.x = -Math.PI / 2;
  seaDeep.position.set(CONFIG.seaX + 120, 0.04, 0);
  group.add(seaDeep);

  // -- roads: light-grey grid with centre dashes -----------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: P.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: P.asphaltLine });
  const roadLines = [];
  for (let i = 0; i <= CONFIG.grid; i++) {
    const c = -half + i * block;
    roadLines.push({ x: c, z: 0, w: roadWidth, d: half * 2 });
    roadLines.push({ x: 0, z: c, w: half * 2, d: roadWidth });
  }
  for (const r of roadLines) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(r.x, 0.06, r.z);
    m.receiveShadow = true;
    group.add(m);
  }
  // centre dashes along every road
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  for (let i = 0; i <= CONFIG.grid; i++) {
    const c = -half + i * block;
    for (let t = -half + 8; t < half - 4; t += 8) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.09, t);
      group.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.rotation.z = Math.PI / 2;
      d2.position.set(t, 0.09, c);
      group.add(d2);
    }
  }
  // zebra crossings at every intersection
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i <= CONFIG.grid; i++) {
    for (let j = 0; j <= CONFIG.grid; j++) {
      const cx = -half + i * block;
      const cz = -half + j * block;
      for (let s = -1; s <= 1; s += 2) {
        for (let k = -4; k <= 4; k++) {
          const z = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.4), zebraMat);
          z.rotation.x = -Math.PI / 2;
          z.position.set(cx + k * 1.1, 0.09, cz + s * (roadWidth / 2 - 1.4));
          group.add(z);
        }
      }
    }
  }

  // -- sidewalks (pale strips along every road) ------------------------------
  const walkMat = new THREE.MeshLambertMaterial({ color: P.sidewalk });
  for (let i = 0; i <= CONFIG.grid; i++) {
    const c = -half + i * block;
    for (const off of [-1, 1]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, half * 2), walkMat);
      s1.rotation.x = -Math.PI / 2;
      s1.position.set(c + off * (roadWidth / 2 + 1.2), 0.07, 0);
      group.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 2.4), walkMat);
      s2.rotation.x = -Math.PI / 2;
      s2.position.set(0, 0.07, c + off * (roadWidth / 2 + 1.2));
      group.add(s2);
    }
  }

  // -- blocks: procedural buildings ------------------------------------------
  const buildings = [];
  const colliders = [];
  const facadeCache = new Map();
  const facadeFor = (base) => {
    const key = base;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(rng, base, 0.45));
    return facadeCache.get(key);
  };
  const roofTex = roofTexture(rng);
  for (let bx = 0; bx < CONFIG.grid; bx++) {
    for (let bz = 0; bz < CONFIG.grid; bz++) {
      const cx = -half + bx * block + block / 2;
      const cz = -half + bz * block + block / 2;
      // plaza in the centre block: fountain instead of buildings
      if (bx === 3 && bz === 3) continue;
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n++) {
        const w = rng.range(9, 15);
        const d = rng.range(9, 15);
        const h = rng.chance(0.3) ? rng.range(26, 46) : rng.range(9, 22);
        const px = cx + rng.range(-8, 8);
        const pz = cz + rng.range(-8, 8);
        const base = P.building[rng.int(0, P.building.length - 1)];
        const mat = new THREE.MeshLambertMaterial({ map: facadeFor(base) });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(px, h / 2, pz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4),
          new THREE.MeshLambertMaterial({ map: roofTex }),
        );
        roof.position.set(px, h + 0.3, pz);
        group.add(roof);
        // rooftop props on tall towers
        if (h > 26) {
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 1.1, 1.6),
            new THREE.MeshLambertMaterial({ color: 0x9aa4ae }),
          );
          ac.position.set(px + w * 0.2, h + 1.1, pz);
          group.add(ac);
          const ant = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 5, 5),
            new THREE.MeshLambertMaterial({ color: 0x555c66 }),
          );
          ant.position.set(px - w * 0.25, h + 3, pz - d * 0.2);
          group.add(ant);
        }
        // neon strip on some ground floors
        if (rng.chance(0.4)) {
          const neon = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.8, 0.5, 0.3),
            new THREE.MeshBasicMaterial({ color: P.neon[rng.int(0, P.neon.length - 1)] }),
          );
          neon.position.set(px, 3.4, pz + d / 2 + 0.2);
          group.add(neon);
        }
        buildings.push({ x: px, z: pz, w, d, h });
        colliders.push({ x0: px - w / 2, x1: px + w / 2, z0: pz - d / 2, z1: pz + d / 2 });
      }
    }
  }

  // -- centre plaza: fountain + palms -----------------------------------------
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshLambertMaterial({ color: P.plaza }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.08, 0);
  group.add(plaza);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0xcfd8dc }),
  );
  basin.position.set(0, 0.55, 0);
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 20),
    new THREE.MeshLambertMaterial({ color: P.sea }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 1.12, 0);
  group.add(water);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 3.4, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }),
  );
  jet.position.set(0, 2.6, 0);
  group.add(jet);

  // -- palms along roads and beach ---------------------------------------------
  for (let i = 0; i < 90; i++) {
    const along = rng.chance(0.5);
    const c = -half + rng.int(0, CONFIG.grid) * block;
    const t = rng.range(-half, half);
    const palm = makePalm(rng);
    if (along) palm.position.set(c + rng.pick([-1, 1]) * (roadWidth / 2 + 2.6), 0, t);
    else palm.position.set(t, 0, c + rng.pick([-1, 1]) * (roadWidth / 2 + 2.6));
    palm.rotation.y = rng.range(0, Math.PI * 2);
    group.add(palm);
  }
  for (let i = 0; i < 16; i++) {
    const palm = makePalm(rng);
    palm.position.set(CONFIG.beachX + rng.range(-6, 6), 0, -140 + i * 18 + rng.range(-4, 4));
    palm.rotation.y = rng.range(0, Math.PI * 2);
    group.add(palm);
  }

  // -- pier + lighthouse --------------------------------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0xb08a5e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 10), pierMat);
  pier.position.set(CONFIG.beachX + 30, 0.9, 22);
  pier.receiveShadow = true;
  group.add(pier);
  for (let k = -20; k <= 20; k += 8) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), pierMat);
    post.position.set(CONFIG.beachX + 30 + k, -0.2, 22 + 4.4);
    group.add(post);
    const post2 = post.clone();
    post2.position.z = 22 - 4.4;
    group.add(post2);
  }
  // pier stalls
  for (const [sx, label] of [[-14, 'FISH'], [0, 'BAIT'], [14, 'SURF']]) {
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.4, 3),
      new THREE.MeshLambertMaterial({ color: 0xfff3d6 }),
    );
    counter.position.y = 1.2;
    stall.add(counter);
    const sign = makeSign(label, P.neon[1], 6);
    sign.position.y = 2.6;
    stall.add(sign);
    stall.position.set(CONFIG.beachX + 30 + sx, 1.5, 22);
    group.add(stall);
  }
  // lighthouse: red-white striped tower on the pier end
  const lh = new THREE.Group();
  const stripeCols = [0xe8e2d2, 0xd43a2e];
  for (let s = 0; s < 6; s++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6 - s * 0.22, 2.9 - s * 0.22, 3.4, 12),
      new THREE.MeshLambertMaterial({ color: stripeCols[s % 2] }),
    );
    seg.position.y = 1.7 + s * 3.4;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 2.6, 12),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 0.7 }),
  );
  lampRoom.position.y = 23;
  lh.add(lampRoom);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 2.2, 12),
    new THREE.MeshLambertMaterial({ color: 0x2e3d4d }),
  );
  cap.position.y = 25.4;
  lh.add(cap);
  lh.position.set(CONFIG.beachX + 52, 1.5, 22);
  group.add(lh);

  // -- landmark signs + neon billboards -----------------------------------------
  for (const lm of CONFIG.landmarks) {
    const sign = makeSign(lm.name, P.neon[rng.int(0, P.neon.length - 1)], 15);
    sign.position.set(lm.x, 0, lm.z);
    sign.rotation.y = rng.range(0, Math.PI * 2);
    group.add(sign);
  }
  for (let i = 0; i < 5; i++) {
    const bb = makeSign(rng.pick(['MERIDIAN BAY', 'CASINO LUNA', 'CLUB VOLT', 'PIER 40', 'SURF & SUN']), P.neon[i % P.neon.length], 18);
    bb.position.set(-120 + i * 62, 0, rng.pick([-140, 140]));
    bb.rotation.y = rng.pick([0, Math.PI]);
    group.add(bb);
  }

  // -- street lamps ---------------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= CONFIG.grid; i++) {
    for (let j = 0; j <= CONFIG.grid; j++) {
      if ((i + j) % 2 === 1) continue;
      const cx = -half + i * block;
      const cz = -half + j * block;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), lampMat);
      pole.position.set(cx + roadWidth / 2 + 1.4, 3.2, cz + roadWidth / 2 + 1.4);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampGlow);
      bulb.position.set(cx + roadWidth / 2 + 1.4, 6.5, cz + roadWidth / 2 + 1.4);
      group.add(bulb);
    }
  }

  // -- helpers ----------------------------------------------------------------------
  function districtAt(x, z) {
    for (const d of CONFIG.districts) {
      if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
    }
    return x >= CONFIG.beachX ? 'Beach' : 'Meridian Bay';
  }
  function streetAt(x, z) {
    const gx = Math.round((x + half) / block);
    const gz = Math.round((z + half) / block);
    return CONFIG.streets[(gx + gz) % CONFIG.streets.length];
  }
  function roadCoord(v) {
    return -half + Math.round((v + half) / block) * block;
  }
  function randomRoadPoint() {
    const vertical = rng.chance(0.5);
    const c = -half + rng.int(0, CONFIG.grid) * block;
    const t = rng.range(-half + 10, half - 10);
    return vertical ? { x: c, z: t } : { x: t, z: c };
  }
  function sidewalkPoint() {
    const p = randomRoadPoint();
    const off = rng.pick([-1, 1]) * (roadWidth / 2 + 1.6);
    return Math.abs(p.x - roadCoord(p.x)) < 0.1 ? { x: p.x + off, z: p.z } : { x: p.x, z: p.z + off };
  }
  // push a circle (x,z,r) out of building colliders; returns corrected {x,z}
  function resolveCollision(x, z, r) {
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) {
          x = c.x1 + r;
        } else {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        }
      }
    }
    return { x, z };
  }

  return {
    group, buildings, colliders,
    districtAt, streetAt, roadCoord, randomRoadPoint, sidewalkPoint, resolveCollision,
  };
}
