// Meridian Bay — builds the 7x7 coastal city: roads, blocks, procedural
// buildings with lit-window canvas textures, palms, beach, sea, pier,
// streetlights and props. Also owns the collision boxes and the road grid
// the traffic, pedestrians and missions drive on.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// A building facade texture: bright wall, window grid, a few lit windows,
// a shop awning stripe on the ground floor. One canvas per colour/height.
function facadeTexture(rng, baseColor, floors, litRatio) {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);
  // subtle vertical shading so towers read at a distance
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // window grid
  const cols = 5;
  const rows = Math.max(3, Math.min(9, floors));
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.chance(litRatio);
      ctx.fillStyle = lit ? '#ffe9a3' : '#2c3e55';
      ctx.fillRect(c * cw + 5, r * ch + 6, cw - 10, ch - 12);
      if (lit) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(c * cw + 5, r * ch + 6, cw - 10, 4);
      }
    }
  }
  // ground-floor shop stripe
  ctx.fillStyle = rng.pick(['#ff5f8f', '#2fb7ff', '#ffc61a', '#7ac74c']);
  ctx.fillRect(0, h - 14, w, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 6; x < w - 8; x += 14) ctx.fillRect(x, h - 11, 8, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = []; // {minX, maxX, minZ, maxZ}
    this.buildings = [];
    this.palms = [];
    this.streetlights = [];
    this.roadCenters = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeachAndPier();
    this.buildPalmsAndLights();
    this.buildProps();
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  // Circle (x, z, radius) vs building boxes: push the circle out.
  resolveCircle(x, z, radius) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          x += dx * push;
          z += dz * push;
        } else {
          // centre inside the box: push out along the smallest exit
          const exits = [
            [c.minX - radius - x, 0],
            [c.maxX + radius - x, 0],
            [0, c.minZ - radius - z],
            [0, c.maxZ + radius - z],
          ];
          let best = exits[0];
          let bestLen = Infinity;
          for (const e of exits) {
            const len = Math.abs(e[0]) + Math.abs(e[1]);
            if (len < bestLen) { bestLen = len; best = e; }
          }
          x += best[0];
          z += best[1];
        }
      }
    }
    return { x, z };
  }

  buildGround() {
    const { half } = CONFIG.city;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 220, half * 2 + 120),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -0.05, 0);
    this.group.add(ground);
  }

  buildRoads() {
    const { blocks, block, road, pitch, half } = CONFIG.city;
    const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.palette.road });
    const lineMat = new THREE.MeshBasicMaterial({ color: CONFIG.palette.roadLine });
    const walkMat = new THREE.MeshLambertMaterial({ color: CONFIG.palette.sidewalk });
    const span = half * 2 + road;
    // road centres: between blocks plus the outer ring
    const centres = [];
    for (let i = 0; i < blocks - 1; i++) centres.push(-half + block + road / 2 + i * pitch);
    centres.push(-half - road / 2);
    centres.push(half + road / 2);
    this.roadCenters = centres;
    for (const c of centres) {
      // vertical road (along z)
      const v = new THREE.Mesh(new THREE.PlaneGeometry(road, span), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0, 0);
      this.group.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(span, road), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.001, c);
      this.group.add(h);
      // sidewalks flanking each road
      for (const s of [-1, 1]) {
        const sv = new THREE.Mesh(new THREE.PlaneGeometry(3, span), walkMat);
        sv.rotation.x = -Math.PI / 2;
        sv.position.set(c + s * (road / 2 + 1.5), 0.02, 0);
        this.group.add(sv);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(span, 3), walkMat);
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(0, 0.02, c + s * (road / 2 + 1.5));
        this.group.add(sh);
      }
      // centre dashes along both directions
      const dashGeo = new THREE.BoxGeometry(0.6, 0.06, 4);
      for (let d = -half; d < half; d += 12) {
        const dv = new THREE.Mesh(dashGeo, lineMat);
        dv.position.set(c, 0.03, d);
        this.group.add(dv);
        const dh = new THREE.Mesh(dashGeo, lineMat);
        dh.rotation.y = Math.PI / 2;
        dh.position.set(d, 0.03, c);
        this.group.add(dh);
      }
    }
  }

  buildBlocks() {
    const { blocks, block, pitch, half } = CONFIG.city;
    const rng = this.rng;
    const downtown = { x: 0, z: 0 };
    for (let bx = 0; bx < blocks; bx++) {
      for (let bz = 0; bz < blocks; bz++) {
        const cx = -half + block / 2 + bx * pitch;
        const cz = -half + block / 2 + bz * pitch;
        const distDowntown = Math.hypot(cx - downtown.x, cz - downtown.z);
        const tall = distDowntown < 70;
        const count = tall ? rng.int(1, 2) : rng.int(2, 4);
        for (let i = 0; i < count; i++) {
          const w = rng.range(10, 18);
          const d = rng.range(10, 18);
          const h = tall ? rng.range(28, 64) : rng.range(8, 22);
          const ox = rng.range(-8, 8);
          const oz = rng.range(-8, 8);
          const x = cx + ox;
          const z = cz + oz;
          const color = '#' + rng.pick(CONFIG.palette.building).toString(16).padStart(6, '0');
          const floors = Math.round(h / 4);
          const tex = facadeTexture(rng, color, floors, 0.35);
          const mats = [
            new THREE.MeshLambertMaterial({ map: tex }),
            new THREE.MeshLambertMaterial({ map: tex }),
            new THREE.MeshLambertMaterial({ color: 0x2c3440 }), // roof
            new THREE.MeshLambertMaterial({ color: 0x2c3440 }),
            new THREE.MeshLambertMaterial({ map: tex }),
            new THREE.MeshLambertMaterial({ map: tex }),
          ];
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
          b.position.set(x, h / 2, z);
          this.group.add(b);
          this.buildings.push(b);
          this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
          // rooftop box on tall towers
          if (tall && rng.chance(0.5)) {
            const roof = box(w * 0.4, 3, d * 0.4, 0x3a4556, x, h + 1.5, z);
            this.group.add(roof);
          }
        }
      }
    }
  }

  buildBeachAndPier() {
    const { beachX, seaX, half } = CONFIG.city;
    // sand strip
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(seaX - beachX + 40, half * 2 + 60),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(beachX + (seaX - beachX) / 2 + 10, 0.01, 0);
    this.group.add(sand);
    // sea
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(220, half * 2 + 260),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.sea }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(seaX + 110, -0.15, 0);
    this.group.add(sea);
    // pier: planks out to sea at z = 0, with posts and a shack
    const plankMat = new THREE.MeshLambertMaterial({ color: 0xb98a56 });
    const pier = new THREE.Group();
    pier.name = 'pier';
    for (let x = beachX; x < seaX + 52; x += 4) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 9), plankMat);
      plank.position.set(x, 0.6, 0);
      pier.add(plank);
    }
    for (let x = beachX + 4; x < seaX + 52; x += 12) {
      for (const s of [-4, 4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8), plankMat);
        post.position.set(x, -0.4, s);
        pier.add(post);
      }
    }
    const shack = box(7, 4, 6, 0xff5f8f, seaX + 38, 2.6, 0);
    pier.add(shack);
    const shackRoof = box(8, 0.5, 7, 0xffc61a, seaX + 38, 4.8, 0);
    pier.add(shackRoof);
    this.group.add(pier);
  }

  buildPalmsAndLights() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3440 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
    const palmAt = (x, z) => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 7), trunkMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = rng.range(-0.08, 0.08);
      palm.add(trunk);
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.4), leafMat);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.4, 7.1, Math.sin(a) * 1.4);
        leaf.rotation.y = -a;
        leaf.rotation.x = 0.5;
        palm.add(leaf);
      }
      palm.position.set(x, 0, z);
      this.group.add(palm);
      this.palms.push(palm);
    };
    // palms along the beach and the main avenues
    for (let z = -180; z <= 180; z += 30) {
      palmAt(CONFIG.city.beachX + 6, z + rng.range(-4, 4));
      if (rng.chance(0.6)) palmAt(-196, z);
    }
    for (let x = -168; x <= 168; x += 56) {
      if (rng.chance(0.5)) palmAt(x + rng.range(-6, 6), 196);
      if (rng.chance(0.5)) palmAt(x + rng.range(-6, 6), -196);
    }
    // streetlights at intersections — never on the outer ring road, where
    // they would crowd the coast-road chase camera
    for (const c of this.roadCenters) {
      for (const d of this.roadCenters) {
        if (Math.abs(c) >= 196 || Math.abs(d) >= 196) continue;
        if (this.rng.chance(0.4)) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
        pole.position.set(c + 8, 3, d + 8);
        this.group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), lampMat);
        lamp.position.set(c + 8, 6.2, d + 8);
        this.group.add(lamp);
        this.streetlights.push(lamp);
      }
    }
  }

  buildProps() {
    const rng = this.rng;
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xc98f4e });
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xff3c3c });
    // crates near Old Port docks
    for (let i = 0; i < 14; i++) {
      const s = rng.range(1.2, 2.4);
      const crate = box(s, s, s, 0xc98f4e, rng.range(-185, -120), s / 2, rng.range(-185, -120));
      crate.rotation.y = rng.angle();
      this.group.add(crate);
      this.addCollider(crate.position.x - s / 2, crate.position.x + s / 2, crate.position.z - s / 2, crate.position.z + s / 2);
    }
    // hydrants scattered on sidewalks
    for (let i = 0; i < 10; i++) {
      const x = rng.pick(this.roadCenters) + 8;
      const z = rng.range(-180, 180);
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8), hydMat);
      hyd.position.set(x, 0.55, z);
      this.group.add(hyd);
    }
    void crateMat;
  }
}

// A point on a road, for spawning cars and peds.
export function roadPoint(rng, city) {
  const vertical = rng.chance(0.5);
  const c = rng.pick(city.roadCenters);
  const along = rng.range(-180, 180);
  return vertical ? { x: c, z: along, heading: rng.chance(0.5) ? 0 : Math.PI } : { x: along, z: c, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
}
