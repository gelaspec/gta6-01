// Three.js plumbing: renderer, sky, sun, camera rig and the low-poly mesh
// factories (cars, people, helicopter). No game logic lives here — only
// how things look and how the camera follows the action.

import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp } from './random.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.palette.skyDay);
  scene.fog = new THREE.Fog(CFG.palette.fogDay, 220, 900);
  return scene;
}

// Gradient sky dome: a big sphere whose vertex colours blend horizon to
// zenith, so golden hour actually looks golden.
export function createSky(scene) {
  const geo = new THREE.SphereGeometry(1200, 24, 12);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const top = new THREE.Color(0x3d7ec8);
  const mid = new THREE.Color(0x9fd8f0);
  const low = new THREE.Color(0xffe0b0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1200;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(low, 1 - (y + 0.2) / 0.45);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'skyDome';
  scene.add(dome);

  // Sun disc: a bright circle that moves with the time of day.
  const sunMat = new THREE.MeshBasicMaterial({ color: CFG.palette.sunDay, fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(46, 24), sunMat);
  sun.name = 'sunDisc';
  scene.add(sun);
  return { dome, sun, top, mid, low };
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3c4, 1.6);
  sun.position.set(180, 260, 120);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);
  return { hemi, sun, amb };
}

// hour: 0..24. 7 = morning, 13 = noon, 18.7 = golden hour, 22 = neon night.
export function setTimeOfDay(scene, sky, lights, hour) {
  const P = CFG.palette;
  let skyTop;
  let skyMid;
  let skyLow;
  let fog;
  let sunColor;
  let sunI;
  let hemiI;
  if (hour >= 6 && hour < 11) {
    const t = (hour - 6) / 5;
    skyTop = new THREE.Color(0x3d7ec8).lerp(new THREE.Color(0x2f6fc0), t);
    skyMid = new THREE.Color(0x9fd8f0).lerp(new THREE.Color(0x7cc4ee), t);
    skyLow = new THREE.Color(0xffe0b0).lerp(new THREE.Color(0xd8ecf8), t);
    fog = new THREE.Color(P.fogDay);
    sunColor = new THREE.Color(0xfff3c4);
    sunI = 1.3 + t * 0.4;
    hemiI = 0.85 + t * 0.15;
  } else if (hour >= 11 && hour < 17) {
    skyTop = new THREE.Color(0x2f6fc0);
    skyMid = new THREE.Color(0x7cc4ee);
    skyLow = new THREE.Color(0xd8ecf8);
    fog = new THREE.Color(P.fogDay);
    sunColor = new THREE.Color(0xfff8dc);
    sunI = 1.7;
    hemiI = 1.0;
  } else if (hour >= 17 && hour < 19.5) {
    const t = (hour - 17) / 2.5;
    skyTop = new THREE.Color(0x4a5aa8).lerp(new THREE.Color(0x7a4a8a), t);
    skyMid = new THREE.Color(0xffb36a).lerp(new THREE.Color(0xff7a4a), t);
    skyLow = new THREE.Color(0xffd9a0).lerp(new THREE.Color(0xff9a57), t);
    fog = new THREE.Color(P.fogSunset);
    sunColor = new THREE.Color(P.sunSunset);
    sunI = 1.5 - t * 0.5;
    hemiI = 0.9 - t * 0.25;
  } else {
    skyTop = new THREE.Color(0x0e1430);
    skyMid = new THREE.Color(0x2a3560);
    skyLow = new THREE.Color(0x4a3a6a);
    fog = new THREE.Color(P.fogNight);
    sunColor = new THREE.Color(0xd8e4ff);
    sunI = 0.35;
    hemiI = 0.45;
  }
  // Repaint the dome gradient.
  const pos = sky.dome.geometry.attributes.position;
  const col = sky.dome.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1200;
    const c = y > 0.25 ? skyTop.clone().lerp(skyMid, 1 - (y - 0.25) / 0.75) : skyMid.clone().lerp(skyLow, 1 - clamp((y + 0.2) / 0.45, 0, 1));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  scene.background = skyMid.clone();
  scene.fog.color.copy(fog);
  // Sun position on its arc; at night the disc becomes the moon, low and pale.
  const ang = ((hour - 6) / 12) * Math.PI;
  const sx = Math.cos(ang) * 950;
  const sy = Math.max(Math.sin(ang), 0.06) * 620;
  sky.sun.position.set(sx, sy, -420);
  sky.sun.lookAt(0, 0, 0);
  sky.sun.material.color.copy(sunColor);
  lights.sun.color.copy(sunColor);
  lights.sun.intensity = sunI;
  lights.sun.position.set(sx * 0.4, Math.max(sy * 0.45, 60), -160);
  lights.hemi.intensity = hemiI;
}

// Third-person camera rig with smoothing and a near/far toggle.
export function createCameraRig(camera) {
  const rig = {
    dist: 11,
    height: 4.6,
    yaw: 0,
    pitch: 0.32,
    look: new THREE.Vector3(),
    pos: new THREE.Vector3(0, 8, -14),
    update(dt, target, heading, speed01) {
      const wantDist = this.dist + speed01 * 3.5;
      const cy = Math.cos(heading);
      const sy = Math.sin(heading);
      const tx = target.x - sy * wantDist;
      const tz = target.z - cy * wantDist;
      const ty = target.y + this.height + speed01 * 1.2;
      const k = 1 - Math.pow(0.0001, dt);
      this.pos.x = lerp(this.pos.x, tx, k);
      this.pos.y = lerp(this.pos.y, ty, k);
      this.pos.z = lerp(this.pos.z, tz, k);
      this.look.lerp(new THREE.Vector3(target.x, target.y + 1.6, target.z), k);
      camera.position.copy(this.pos);
      camera.lookAt(this.look);
    },
    snap(target, heading) {
      const cy = Math.cos(heading);
      const sy = Math.sin(heading);
      this.pos.set(target.x - sy * this.dist, target.y + this.height, target.z - cy * this.dist);
      this.look.set(target.x, target.y + 1.6, target.z);
    },
  };
  return rig;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

function wheel(r = 0.42) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.32, 12),
    new THREE.MeshLambertMaterial({ color: 0x16181e }),
  );
  m.rotation.z = Math.PI / 2;
  return m;
}

// A low-poly car: body, cabin, wheels, headlights, taillights. Police cars
// get a light bar; the hero car gets a spoiler and neon underglow strip.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyColor = color;
  const body = box(2.0, 0.62, 4.4, bodyColor, 0, 0.62, 0);
  g.add(body);
  const cabin = box(1.7, 0.55, 2.2, opts.cabin ?? 0x1a2028, 0, 1.18, -0.25);
  g.add(cabin);
  const nose = box(1.9, 0.3, 0.5, bodyColor, 0, 0.55, 2.2);
  g.add(nose);
  const hl = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.12, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
  );
  hl.position.set(0, 0.62, 2.46);
  g.add(hl);
  const tl = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.12, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  tl.position.set(0, 0.66, -2.24);
  g.add(tl);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = wheel();
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  let lightBar = null;
  if (opts.police) {
    lightBar = new THREE.Group();
    const r = box(0.7, 0.16, 0.5, 0xff2020, -0.4, 1.52, -0.25);
    const b = box(0.7, 0.16, 0.5, 0x2040ff, 0.4, 1.52, -0.25);
    lightBar.add(r);
    lightBar.add(b);
    lightBar.userData.red = r;
    lightBar.userData.blue = b;
    g.add(lightBar);
  }
  if (opts.spoiler) {
    g.add(box(1.9, 0.08, 0.5, 0x14161c, 0, 1.02, -2.05));
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.06, 4.0),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
    );
    glow.position.set(0, 0.1, 0);
    g.add(glow);
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  g.userData.body = body;
  return g;
}

// A low-poly person: legs, torso, head, cap. Colours vary per pedestrian.
export function makePersonMesh(shirt, pants, skin = 0xe8b88a, cap = null) {
  const g = new THREE.Group();
  const legL = box(0.22, 0.8, 0.24, pants, -0.14, 0.4, 0);
  const legR = box(0.22, 0.8, 0.24, pants, 0.14, 0.4, 0);
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.16, 0);
  const head = box(0.42, 0.42, 0.4, skin, 0, 1.78, 0);
  g.add(legL, legR, torso, head);
  if (cap !== null) {
    g.add(box(0.46, 0.12, 0.44, cap, 0, 2.02, 0));
    g.add(box(0.46, 0.06, 0.2, cap, 0, 1.96, 0.3));
  }
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.torso = torso;
  return g;
}

// Police helicopter: body, tail, rotors, spotlight cone.
export function makeHeliMesh() {
  const g = new THREE.Group();
  const body = box(2.2, 1.4, 3.4, 0x20242e, 0, 0, 0);
  g.add(body);
  const glass = box(1.9, 0.7, 1.0, 0x9fd8f0, 0, 0.25, 1.5);
  g.add(glass);
  const tail = box(0.5, 0.5, 4.2, 0x20242e, 0, 0.25, -3.4);
  g.add(tail);
  const fin = box(0.18, 1.2, 0.9, 0xff2020, 0, 0.7, -5.4);
  g.add(fin);
  const mast = box(0.24, 0.5, 0.24, 0x14161c, 0, 0.95, 0);
  g.add(mast);
  const rotor = box(7.6, 0.08, 0.5, 0x14161c, 0, 1.22, 0);
  g.add(rotor);
  const tailRotor = box(0.08, 1.4, 0.4, 0x14161c, 0.32, 0.5, -5.2);
  g.add(tailRotor);
  // Spotlight cone: apex at the helicopter, widening down to the ground —
  // a real beam, narrow at the source. (Flipped, it reads as a white wedge
  // in the sky, which is how the first cover render looked.)
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(9, 44, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.set(0, -22, 0);
  g.add(spot);
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  return g;
}

// Waypoint beacon: a glowing pillar the player drives toward.
export function makeBeaconMesh(color = 0xffd21e) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 13;
  g.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 7;
  g.add(diamond);
  g.userData.diamond = diamond;
  return g;
}
