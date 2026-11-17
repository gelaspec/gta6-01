// Meridian Bay itself: a sun-soaked port city built once from a seed — a road
// grid, procedural towers with painted window facades, palm-lined streets,
// parks and plazas, a sandy beach, the ocean, and a wooden pier with a
// lighthouse. It also owns the collision boxes and the road data the traffic,
// the minimap and the missions all read from.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { chance, int, pick, range } from './random.js';

function facadeTexture(random, baseColor, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shading so towers read at a distance.
  const shade = ctx.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.16)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  const lit = 'rgba(255,236,170,0.95)';
  const dark = 'rgba(30,48,66,0.85)';
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 10 + c * ((128 - 20) / cols);
      const y = 12 + f * ((256 - 24) / floors);
      ctx.fillStyle = chance(random, 0.35) ? lit : dark;
      ctx.fillRect(x, y, (128 - 20) / cols - 6, (256 - 24) / floors - 8);
    }
  }
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

export function buildCity(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  const { roads, roadWidth, block, half } = CITY;

  // --- Ground: grass base, then road ribbons, sidewalks and the beach. ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
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

  // Sidewalk slabs around every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
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
  function facade(base, floors, cols) {
    const key = `${base}|${floors}|${cols}`;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(random, base, floors, cols));
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
      const mat = new THREE.MeshLambertMaterial({ map: facade(base, floors, cols) });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      tower.position.set(x, h / 2, z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), roofMat);
      roof.position.set(x, h + 0.6, z);
      group.add(roof);
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

  // --- Beach, ocean and the pier. ---
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 8, 0.01, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 1600),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CITY.waterX + 350, 0.05, 0);
  group.add(ocean);

  const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.pierWood });
  const pier = new THREE.Group();
  // The deck sits flush with the ground (top at y = 0) so the player can
  // walk the pier at street level.
  for (let x = CITY.beachX; x < CITY.pierEndX; x += 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 16), pierMat);
    plank.position.set(x, -0.25, CITY.pierZ);
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
  // Stalls and a lighthouse at the pier's end.
  pier.add(box(6, 3, 5, 0xe87a2e, CITY.pierEndX - 40, 1.5, CITY.pierZ - 4));
  pier.add(box(6, 3, 5, 0x2e8f86, CITY.pierEndX - 40, 1.5, CITY.pierZ + 4));
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  tower.position.set(CITY.pierEndX - 6, 8, CITY.pierZ);
  tower.castShadow = true;
  pier.add(tower);
  const lampTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12),
    new THREE.MeshLambertMaterial({ color: 0x2a2e33, emissive: 0xffe9a8, emissiveIntensity: 0.8 }),
  );
  lampTop.position.set(CITY.pierEndX - 6, 17, CITY.pierZ);
  pier.add(lampTop);
  group.add(pier);
  colliders.push({ minX: CITY.pierEndX - 8, maxX: CITY.pierEndX - 4, minZ: CITY.pierZ - 2, maxZ: CITY.pierZ + 2 });

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

function addPalm(group, x, z, scale, random) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 6 * scale, 7), trunkMat);
  trunk.position.y = 3 * scale;
  trunk.rotation.z = range(random, -0.08, 0.08);
  trunk.castShadow = true;
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * scale, 3.4 * scale), leafMat);
    const angle = (i / 6) * Math.PI * 2 + random() * 0.5;
    frond.position.set(Math.cos(angle) * 1.3 * scale, 6.1 * scale, Math.sin(angle) * 1.3 * scale);
    frond.rotation.set(Math.sin(angle) * 0.9, angle, Math.cos(angle) * 0.9);
    frond.castShadow = true;
    palm.add(frond);
  }
  palm.position.set(x, 0, z);
  group.add(palm);
  return palm;
}

// --- Collision and road helpers (shared by player, cars, peds, police). ---

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
