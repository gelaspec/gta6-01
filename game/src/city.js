// Meridian Bay itself: a sun-soaked port city built once from a seed — a road
// grid, procedural towers with painted window facades, palm-lined streets,
// parks and plazas, a sandy beach, the ocean, and a wooden pier with a
// lighthouse. It also owns the collision boxes and the road data the traffic,
// the minimap and the missions all read from.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { chance, int, pick, range } from './random.js';

const SHOP_WORDS = ['CAFE', 'TACOS', 'SURF', 'PIZZA', 'HOTEL', 'MARKET', 'BAR', 'DELI', 'BIKES', 'FLOWERS'];

function facadeTexture(random, baseColor, floors, cols, shop) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shading so towers read at a distance.
  const shade = ctx.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.22)');
  shade.addColorStop(0.7, 'rgba(255,255,255,0.02)');
  shade.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  // Floor separator lines and a faint per-floor tint so the facade is not a
  // flat slab.
  const fh = (256 - 34) / floors;
  for (let f = 0; f < floors; f += 1) {
    const y0 = 10 + f * fh;
    ctx.fillStyle = f % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect(0, y0, 128, fh);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, y0 + fh - 1, 128, 1);
  }
  const litColors = ['rgba(255,226,150,0.95)', 'rgba(255,200,120,0.95)', 'rgba(190,225,255,0.9)'];
  const darkColors = ['rgba(74,102,128,0.9)', 'rgba(60,84,104,0.9)', 'rgba(88,110,128,0.85)'];
  const winW = (128 - 20) / cols - 6;
  const winH = Math.max(3, fh - 9);
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 10 + c * ((128 - 20) / cols);
      const y = 12 + f * fh;
      // Window frame, then glass — half the windows lit warm, the rest a
      // light blue-grey so shadow sides never read as black holes.
      ctx.fillStyle = 'rgba(238,232,218,0.92)';
      ctx.fillRect(x - 1, y - 1, winW + 2, winH + 2);
      ctx.fillStyle = chance(random, 0.5) ? pick(random, litColors) : pick(random, darkColors);
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x - 1, y + winH + 1, winW + 2, 2);
    }
  }
  // Ground floor: a shop band with a striped awning and a lit sign word for
  // low buildings, a glass lobby with a door for towers.
  const gy = 256 - 30;
  if (shop) {
    ctx.fillStyle = 'rgba(30,32,38,0.92)';
    ctx.fillRect(0, gy, 128, 30);
    const ac = pick(random, ['#e84a5f', '#2e8f86', '#e87a2e', '#c23b6e']);
    for (let s = 0; s < 8; s += 1) {
      ctx.fillStyle = s % 2 ? '#f2ede2' : ac;
      ctx.fillRect(s * 16, gy, 16, 7);
    }
    ctx.fillStyle = pick(random, ['#ffd94c', '#7df0d8', '#ffffff', '#ff9d5c']);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pick(random, SHOP_WORDS), 64, gy + 24);
  } else {
    ctx.fillStyle = 'rgba(40,60,80,0.95)';
    ctx.fillRect(0, gy, 128, 30);
    ctx.fillStyle = 'rgba(255,226,150,0.85)';
    ctx.fillRect(54, gy + 8, 20, 22);
    ctx.fillStyle = 'rgba(20,30,40,0.9)';
    ctx.fillRect(58, gy + 8, 4, 22);
  }
  // Parapet band at the very top.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, 128, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A dark sign board with a gold word, drawn on a canvas — reused by the
// pier stalls and by the freestanding landmark signs. The font shrinks to
// fit long names instead of clipping them.
function signTexture(word) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22242a';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#ffd94c';
  ctx.textAlign = 'center';
  let size = 52;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  while (ctx.measureText(word).width > 480 && size > 18) {
    size -= 2;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
  }
  ctx.fillText(word, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material || new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Deterministic canvas textures (fixed LCG seed — the same seed, same city).
function lcg(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function speckleTexture(base, speck, count, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const rnd = lcg(seed);
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = speck;
    ctx.globalAlpha = 0.1 + rnd() * 0.2;
    ctx.beginPath();
    ctx.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tileTexture(base, line) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(128, i * 32); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function waveTexture(base) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = lcg(777);
  for (let i = 0; i < 26; i += 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1 + rnd() * 2;
    const y = rnd() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + rnd() * 8 - 4, 170, y + rnd() * 8 - 4, 256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function zebraTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(232,228,210,0.92)';
  for (let i = 0; i < 10; i += 1) ctx.fillRect(2, 4 + i * 13, 60, 7);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  const { roads, roadWidth, block, half } = CITY;

  // --- Ground: grass base, then road ribbons, sidewalks and the beach. ---
  const grassTex = speckleTexture('#7d9b5e', '#6a8a4e', 260, 4242);
  grassTex.repeat.set(40, 40);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshLambertMaterial({ color: PALETTE.roadLine });
  for (const r of roads) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 2 + roadWidth, roadWidth),
        roadMat,
      );
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : r, 0.02, horizontal ? r : 0);
      road.receiveShadow = true;
      group.add(road);
      // Dashed centre line.
      for (let t = -half; t < half; t += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? 0 : Math.PI / 2;
        dash.position.set(horizontal ? t : r, 0.03, horizontal ? r : t);
        group.add(dash);
      }
    }
  }

  // Zebra crossings at every intersection: one on each approach, offset from
  // the centre so the four crossings read as a real junction, not a white
  // block.
  const zebraMat = new THREE.MeshLambertMaterial({ map: zebraTexture(), transparent: true, opacity: 0.8 });
  for (const r1 of roads) {
    for (const r2 of roads) {
      for (const off of [-14, 14]) {
        const za = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 15), zebraMat);
        za.rotation.x = -Math.PI / 2;
        za.position.set(r1 + off, 0.04, r2);
        group.add(za);
        const zb = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 15), zebraMat);
        zb.rotation.x = -Math.PI / 2;
        zb.rotation.z = Math.PI / 2;
        zb.position.set(r1, 0.045, r2 + off);
        group.add(zb);
      }
    }
  }

  // Sidewalk slabs around every block.
  const walkTex = tileTexture('#b9b2a2', 'rgba(0,0,0,0.14)');
  walkTex.repeat.set(6, 6);
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  const blocks = [];
  for (let ix = 0; ix < roads.length - 1; ix += 1) {
    for (let iz = 0; iz < roads.length - 1; iz += 1) {
      const cx = (roads[ix] + roads[ix + 1]) / 2;
      const cz = (roads[iz] + roads[iz + 1]) / 2;
      blocks.push({ cx, cz, ix, iz });
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(block + 6, block + 6), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.015, cz);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // --- Buildings: towers downtown, low shops and houses further out. ---
  const facadeCache = new Map();
  function facade(base, floors, cols, shop) {
    const key = `${base}|${floors}|${cols}|${shop ? 1 : 0}`;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(random, base, floors, cols, shop));
    return facadeCache.get(key);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const downtown = (bx, bz) => Math.hypot(bx, bz) < 130;

  for (const b of blocks) {
    const roll = random();
    if (roll < 0.12) {
      // Park: palms, a lawn mound and benches, no collider.
      const parkTrees = int(random, 3, 6);
      for (let i = 0; i < parkTrees; i += 1) {
        addPalm(group, b.cx + range(random, -26, 26), b.cz + range(random, -26, 26), range(random, 0.8, 1.3), random);
      }
      group.add(box(10, 1, 4, 0x7a5a3a, b.cx, 0.5, b.cz - 10));
      continue;
    }
    if (roll < 0.2) {
      // Plaza: open paved square with a fountain basin.
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 8, 1.2, 20),
        new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }),
      );
      basin.position.set(b.cx, 0.6, b.cz);
      basin.castShadow = true;
      group.add(basin);
      addPalm(group, b.cx - 20, b.cz - 20, 1, random);
      addPalm(group, b.cx + 20, b.cz + 20, 1, random);
      continue;
    }
    const tall = downtown(b.cx, b.cz);
    const count = tall ? int(random, 1, 2) : int(random, 1, 3);
    for (let i = 0; i < count; i += 1) {
      const w = range(random, 16, 26);
      const d = range(random, 16, 26);
      const h = tall ? range(random, 28, 78) : range(random, 8, 22);
      const ox = count === 1 ? 0 : range(random, -14, 14);
      const oz = count === 1 ? 0 : range(random, -14, 14);
      const x = b.cx + ox;
      const z = b.cz + oz;
      const base = pick(random, PALETTE.building);
      const floors = Math.max(2, Math.floor(h / 4));
      const cols = Math.max(2, Math.floor(w / 5));
      const mat = new THREE.MeshLambertMaterial({ map: facade(base, floors, cols, !tall) });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      tower.position.set(x, h / 2, z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), roofMat);
      roof.position.set(x, h + 0.6, z);
      group.add(roof);
      const roofY = h + 1.2;
      if (tall) {
        // Rooftop furniture: AC unit, water tank, antenna with a red tip.
        if (chance(random, 0.7)) {
          group.add(box(range(random, 2, 3.5), 1, range(random, 2, 3), 0x8a8f96, x + range(random, -w / 4, w / 4), roofY + 0.5, z + range(random, -d / 4, d / 4)));
        }
        if (chance(random, 0.5)) {
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.3, 2.6, 10),
            new THREE.MeshLambertMaterial({ color: 0x5a4a3a }),
          );
          tank.position.set(x + range(random, -w / 4, w / 4), roofY + 1.3, z + range(random, -d / 4, d / 4));
          tank.castShadow = true;
          group.add(tank);
        }
        if (chance(random, 0.6)) {
          const ax = x + range(random, -w / 4, w / 4);
          const az = z + range(random, -d / 4, d / 4);
          const ant = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.12, 7, 6),
            new THREE.MeshLambertMaterial({ color: 0x2a2e33 }),
          );
          ant.position.set(ax, roofY + 3.5, az);
          group.add(ant);
          const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 6, 6),
            new THREE.MeshLambertMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.9 }),
          );
          tip.position.set(ax, roofY + 7, az);
          group.add(tip);
        }
      } else {
        // Balconies on the front/back faces and a neon shop sign.
        const balc = int(random, 1, 3);
        for (let bI = 0; bI < balc; bI += 1) {
          const face = chance(random, 0.5) ? 1 : -1;
          const by = range(random, 4, Math.max(5, h - 2));
          const bx = x + range(random, -w / 2 + 3, w / 2 - 3);
          group.add(box(3.4, 0.25, 1.3, 0x6a5a4a, bx, by, z + face * (d / 2 + 0.55)));
          group.add(box(3.4, 0.9, 0.12, 0x3a3f46, bx, by + 0.55, z + face * (d / 2 + 1.15)));
        }
        if (chance(random, 0.75)) {
          const neon = pick(random, PALETTE.neon);
          const signMat = new THREE.MeshLambertMaterial({ color: neon, emissive: neon, emissiveIntensity: 1.1 });
          const face = chance(random, 0.5) ? 1 : -1;
          const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.2, 0.35), signMat);
          sign.position.set(x + range(random, -w / 4, w / 4), 4.6, z + face * (d / 2 + 0.25));
          group.add(sign);
        }
      }
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }

  // --- Street palms and lamps along the roads. ---
  for (const r of roads) {
    for (let t = -half + 20; t < half; t += 80) {
      if (chance(random, 0.6)) addPalm(group, r + roadWidth / 2 + 3, t + range(random, -6, 6), range(random, 0.8, 1.2), random);
      if (chance(random, 0.6)) addPalm(group, t + range(random, -6, 6), r - roadWidth / 2 - 3, range(random, 0.8, 1.2), random);
    }
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
  const lampGlow = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.9 });
  for (const r of roads) {
    for (let t = -half + 40; t < half; t += 120) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), lampMat);
      pole.position.set(r + roadWidth / 2 + 1.5, 3.5, t);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), lampGlow);
      lamp.position.set(r + roadWidth / 2 + 1.5, 7.1, t);
      group.add(lamp);
    }
  }

  // --- Street furniture: hydrants, benches, signs and bushes so the
  // sidewalks read as lived-in, not empty slabs. ---
  const hydrantMat = new THREE.MeshLambertMaterial({ color: PALETTE.hydrant });
  for (const r of roads) {
    for (let t = -half + 60; t < half; t += 160) {
      if (chance(random, 0.5)) {
        const hx = r + roadWidth / 2 + 2.5;
        const hz = t;
        const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), hydrantMat);
        hyd.position.set(hx, 0.45, hz);
        group.add(hyd);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), hydrantMat);
        cap.position.set(hx, 0.95, hz);
        cap.scale.y = 0.7;
        group.add(cap);
      }
    }
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: PALETTE.benchWood });
  for (let i = 0; i < 24; i += 1) {
    const r = pick(random, roads);
    const t = range(random, -half + 30, half - 30);
    const alongRoad = chance(random, 0.5);
    const bx = alongRoad ? r + roadWidth / 2 + 3.5 : t;
    const bz = alongRoad ? t : r + roadWidth / 2 + 3.5;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.65), benchMat);
    seat.position.set(bx, 0.5, bz);
    seat.rotation.y = alongRoad ? 0 : Math.PI / 2;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.12), benchMat);
    back.position.set(bx + (alongRoad ? 0 : 0.3), 0.85, bz + (alongRoad ? -0.3 : 0));
    back.rotation.y = alongRoad ? 0 : Math.PI / 2;
    group.add(back);
  }
  const signPoleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const signFaceMat = new THREE.MeshLambertMaterial({ color: PALETTE.signGreen, side: THREE.DoubleSide });
  for (const r of roads) {
    for (let t = -half + 80; t < half; t += 160) {
      if (chance(random, 0.55)) {
        const sx = r - roadWidth / 2 - 2;
        const sz = t;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6), signPoleMat);
        pole.position.set(sx, 1.6, sz);
        group.add(pole);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), signFaceMat);
        face.position.set(sx, 3.1, sz);
        face.rotation.y = chance(random, 0.5) ? 0 : Math.PI / 2;
        group.add(face);
      }
    }
  }
  const bushMat = new THREE.MeshLambertMaterial({ color: PALETTE.bush });
  for (let i = 0; i < 40; i += 1) {
    const r = pick(random, roads);
    const t = range(random, -half + 20, half - 20);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(range(random, 0.8, 1.5), 8, 6), bushMat);
    bush.scale.y = 0.65;
    bush.position.set(
      chance(random, 0.5) ? r + roadWidth / 2 + 4 : t,
      0.4,
      chance(random, 0.5) ? t : r + roadWidth / 2 + 4,
    );
    group.add(bush);
  }
  // Beach umbrellas on the sand.
  for (let i = 0; i < 6; i += 1) {
    const ux = CITY.beachX + range(random, 6, 22);
    const uz = range(random, -200, 200);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
      new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
    );
    pole.position.set(ux, 1.2, uz);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: pick(random, PALETTE.umbrella) }),
    );
    top.position.set(ux, 2.8, uz);
    group.add(top);
  }

  // --- Beach, ocean and the pier. ---
  const sandTex = speckleTexture('#e8d5a4', '#d8c08a', 200, 913);
  sandTex.repeat.set(6, 60);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, half * 2 + 120),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 8, 0.01, 0);
  sand.receiveShadow = true;
  group.add(sand);
  // Ocean in two planes with a gap for the pier strip (z 30..50), so the
  // wooden deck — whose top sits just above the waterline — stays visible.
  const oceanTex = waveTexture('#2e7fa8');
  oceanTex.repeat.set(8, 8);
  const oceanMat = new THREE.MeshLambertMaterial({ map: oceanTex, transparent: true, opacity: 0.92 });
  const oceanNorth = new THREE.Mesh(new THREE.PlaneGeometry(700, 830), oceanMat);
  oceanNorth.rotation.x = -Math.PI / 2;
  oceanNorth.position.set(CITY.waterX + 350, 0.05, -385);
  group.add(oceanNorth);
  const oceanSouth = new THREE.Mesh(new THREE.PlaneGeometry(700, 750), oceanMat);
  oceanSouth.rotation.x = -Math.PI / 2;
  oceanSouth.position.set(CITY.waterX + 350, 0.05, 425);
  group.add(oceanSouth);
  const ocean = oceanNorth;

  const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.pierWood });
  const pierMatB = new THREE.MeshLambertMaterial({ color: 0x77552f });
  const pier = new THREE.Group();
  // The deck sits flush with the ground (top at y = 0) so the player can
  // walk the pier at street level. Planks alternate two wood tones so the
  // deck reads as boards, not one brown slab.
  let plankIdx = 0;
  for (let x = CITY.beachX; x < CITY.pierEndX; x += 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 16), plankIdx % 2 ? pierMat : pierMatB);
    plankIdx += 1;
    plank.position.set(x, -0.1, CITY.pierZ);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pier.add(plank);
  }
  for (let x = CITY.beachX + 8; x < CITY.pierEndX; x += 24) {
    for (const side of [-8, 8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 8), pierMat);
      post.position.set(x, 0.4, CITY.pierZ + side);
      pier.add(post);
    }
  }
  // Side rails linking the posts.
  for (const side of [-8, 8]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(CITY.pierEndX - CITY.beachX, 0.14, 0.14),
      pierMatB,
    );
    rail.position.set((CITY.beachX + CITY.pierEndX) / 2, 1.9, CITY.pierZ + side);
    pier.add(rail);
  }
  // Stalls with a counter, serving window and a sign board, facing the walkway.
  function stall(x, z, color, word, flip) {
    const g = new THREE.Group();
    g.add(box(6, 3, 5, color, 0, 1.5, 0));
    // Counter and a dark serving window on the front face, plus a sign board
    // with the stall's word. (No protruding awning: from the pier camera the
    // stalls are seen side-on, and an awning reads as a white sail.)
    g.add(box(5.5, 1.0, 0.8, 0x7a5a3a, 0, 0.55, 2.6));
    g.add(box(5, 0.9, 0.1, 0x2a3440, 0, 1.5, 2.56));
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 0.8),
      new THREE.MeshLambertMaterial({ map: signTexture(word) }),
    );
    sign.position.set(0, 2.65, 2.56);
    g.add(sign);
    g.position.set(x, 0, z);
    if (flip) g.rotation.y = Math.PI;
    pier.add(g);
  }
  stall(CITY.pierEndX - 40, CITY.pierZ - 4, 0xe87a2e, 'FISH', false);
  stall(CITY.pierEndX - 40, CITY.pierZ + 4, 0x2e8f86, 'BAIT', true);
  // Lighthouse: red/white bands, a gallery disc and a glowing lamp room.
  function stripeTexture(c1, c2, bands) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < bands; i += 1) {
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.fillRect(0, (i * 128) / bands, 64, 128 / bands);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 16, 12),
    new THREE.MeshLambertMaterial({ map: stripeTexture('#f2f2f2', '#c23b2e', 6) }),
  );
  tower.position.set(CITY.pierEndX - 6, 8, CITY.pierZ);
  tower.castShadow = true;
  pier.add(tower);
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(2.9, 2.9, 0.35, 12),
    new THREE.MeshLambertMaterial({ color: 0x2a2e33 }),
  );
  gallery.position.set(CITY.pierEndX - 6, 16.1, CITY.pierZ);
  pier.add(gallery);
  const lampTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12),
    new THREE.MeshLambertMaterial({ color: 0x2a2e33, emissive: 0xffe9a8, emissiveIntensity: 0.8 }),
  );
  lampTop.position.set(CITY.pierEndX - 6, 17, CITY.pierZ);
  pier.add(lampTop);
  group.add(pier);
  colliders.push({ minX: CITY.pierEndX - 8, maxX: CITY.pierEndX - 4, minZ: CITY.pierZ - 2, maxZ: CITY.pierZ + 2 });

  // --- Landmark signs: named places on poles at intersection corners, so
  // the city reads as a place with a bank, a motel, a casino, a garage, a
  // club, a market and a pier — not an anonymous grid. Corners are always
  // clear of buildings; the signs are double-sided and deterministic. ---
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
  function landmark(word, x, z, yaw) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 2.25),
      new THREE.MeshLambertMaterial({ map: signTexture(word), side: THREE.DoubleSide }),
    );
    sign.position.set(x, 7, z);
    sign.rotation.y = yaw;
    group.add(sign);
    for (const off of [-5.4, 5.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 6), postMat);
      post.position.set(x + Math.cos(yaw) * off, 3.5, z - Math.sin(yaw) * off);
      group.add(post);
    }
  }
  landmark('MERIDIAN BANK', 11, 11, Math.PI / 4);
  landmark('MARINA MOTEL', 229, 229, Math.PI / 4);
  landmark('CASINO LUNA', -149, 149, Math.PI / 4);
  landmark('PIER 40', 308, 30, Math.PI / 2);
  landmark('DOCKSIDE GARAGE', -229, 91, Math.PI / 4);
  landmark('CLUB VOLT', 91, -149, Math.PI / 4);
  landmark('HARBOR MARKET', -229, -11, Math.PI / 4);
  landmark('CALLE VERDE', 11, 171, Math.PI / 4);
  landmark('OLD PORT', -171, -171, Math.PI / 4);
  landmark('NORTHSIDE', 171, -171, Math.PI / 4);

  scene.add(group);
  return {
    colliders,
    roads: CITY.roads,
    half: CITY.half,
    spawn: { x: 8, z: 128 },
    bank: { x: -8, z: -8 },
    hideout: { x: 200, z: 200 },
    marina: { x: 240, z: 240 },
    pierEnd: { x: CITY.pierEndX - 14, z: CITY.pierZ },
    ocean,
  };
}

// --- Palms: a bent, tapering frond geometry (shared by every palm) so the
// crown reads as layered 3D leaves, not flat planes. The bend is baked into
// the geometry: base at the origin, tip drooping toward -Z. ---
let frondOuterGeo = null;
let frondInnerGeo = null;
let trunkTex = null;

function bentFrondGeo(droop) {
  const geo = new THREE.PlaneGeometry(0.95, 3.6, 1, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const v = (y + 1.8) / 3.6; // 0 at the base, 1 at the tip
    pos.setZ(i, -droop * v * v * 3.6);
    pos.setX(i, pos.getX(i) * (1 - v * 0.55)); // taper toward the tip
  }
  geo.computeVertexNormals();
  geo.translate(0, 1.8, 0); // base at the origin
  return geo;
}

function makeTrunkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 10) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, y, 64, 3);
  }
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = 'rgba(60,40,20,0.22)';
    ctx.fillRect(8 + i * 9, 0, 2, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addPalm(group, x, z, scale, random) {
  if (!frondOuterGeo) frondOuterGeo = bentFrondGeo(0.42);
  if (!frondInnerGeo) frondInnerGeo = bentFrondGeo(0.22);
  if (!trunkTex) trunkTex = makeTrunkTexture();
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ map: trunkTex });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x4fa85e, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.34 * scale, 6 * scale, 7), trunkMat);
  trunk.position.y = 3 * scale;
  trunk.rotation.z = range(random, -0.08, 0.08);
  trunk.castShadow = true;
  palm.add(trunk);
  const crownY = 6.05 * scale;
  const tiers = [
    { geo: frondOuterGeo, count: 7, tilt: -1.85, mat: leafMat, len: 1.0 },
    { geo: frondInnerGeo, count: 5, tilt: -1.25, mat: leafMat2, len: 0.8 },
  ];
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i += 1) {
      const frond = new THREE.Mesh(tier.geo, tier.mat);
      const angle = (i / tier.count) * Math.PI * 2 + random() * 0.6;
      frond.rotation.order = 'YXZ';
      frond.rotation.y = angle;
      frond.rotation.x = tier.tilt + range(random, -0.08, 0.08);
      frond.position.set(Math.cos(angle) * 0.5 * scale, crownY, Math.sin(angle) * 0.5 * scale);
      frond.scale.setScalar(scale * tier.len * range(random, 0.9, 1.1));
      frond.castShadow = true;
      palm.add(frond);
    }
  }
  // Coconut cluster under the crown.
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.42 * scale, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  nuts.position.set(0, crownY - 0.35 * scale, 0);
  nuts.scale.y = 0.8;
  palm.add(nuts);
  palm.position.set(x, 0, z);
  group.add(palm);
  return palm;
}

// --- Collision and road helpers (shared by player, cars, peds, police). ---

/** The named district under a world position — shown in the HUD and used
 * by district heat. Order matters: the pier and beach win over the east
 * strip, Calle Verde wins over the west strip. */
export function districtAt(x, z) {
  if (x > 320 && Math.abs(z - CITY.pierZ) < 24) return 'The Pier';
  if (x > 280) return 'Beachfront';
  if (x >= 160 && z > 120) return 'Marina';
  if (x >= 200) return 'Coast Road';
  if (x < -160 && z < -30) return 'Old Port';
  if (z >= 160) return 'Calle Verde';
  if (Math.abs(x) < 130 && Math.abs(z) < 130) return 'Downtown';
  if (z < -160) return 'Northside';
  if (x < -160) return 'The Docks';
  return 'Midtown';
}

export function collideCircle(city, x, z, radius) {
  let px = x;
  let pz = z;
  for (const c of city.colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx;
    const dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      } else {
        pz = c.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

export function clampToCity(x, z) {
  return {
    x: Math.max(-CITY.half - 6, Math.min(CITY.pierEndX + 4, x)),
    z: Math.max(-CITY.half - 6, Math.min(CITY.half + 6, z)),
  };
}

export function nearestRoad(city, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const r of city.roads) {
    const d = Math.abs(x - r);
    if (d < bestD) {
      bestD = d;
      best = { axis: 'x', value: r, along: z };
    }
    const d2 = Math.abs(z - r);
    if (d2 < bestD) {
      bestD = d2;
      best = { axis: 'z', value: r, along: x };
    }
  }
  return best;
}

export function isOnRoad(city, x, z) {
  for (const r of city.roads) {
    if (Math.abs(x - r) < CITY.roadWidth / 2 + 1) return true;
    if (Math.abs(z - r) < CITY.roadWidth / 2 + 1) return true;
  }
  return false;
}

export function randomRoadPoint(city, random) {
  const road = pick(random, city.roads);
  const along = range(random, -city.half + 20, city.half - 20);
  if (chance(random, 0.5)) return { x: road + range(random, -3, 3), z: along };
  return { x: along, z: road + range(random, -3, 3) };
}
