// Meridian Bay — renderer, sky, lighting and the third-person camera.
// Time-of-day presets: noon, golden (cover), night (neon), dawn.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const TOD = {
  noon: {
    skyTop: 0x4fa8e8, skyBottom: 0xcfeefb, fog: 0xbfd9e8, sunColor: 0xfff2d0,
    sunPos: [120, 180, 60], hemiSky: 0xbfe3ff, hemiGround: 0x8a7a5c,
    exposure: 1.15, sunIntensity: 2.2, hemiIntensity: 0.9, ambient: 0.35,
  },
  golden: {
    skyTop: 0x6a4fd8, skyBottom: 0xff9e3d, fog: 0xe89a5c, sunColor: 0xffc98a,
    sunPos: [150, 42, -70], hemiSky: 0xffc98a, hemiGround: 0x6a5a44,
    exposure: 1.18, sunIntensity: 2.4, hemiIntensity: 0.75, ambient: 0.3,
  },
  night: {
    skyTop: 0x0d1230, skyBottom: 0x2a2a55, fog: 0x1c2440, sunColor: 0x8aa8ff,
    sunPos: [80, 120, -100], hemiSky: 0x33406e, hemiGround: 0x1a1a22,
    exposure: 1.05, sunIntensity: 0.7, hemiIntensity: 0.45, ambient: 0.22,
  },
  dawn: {
    skyTop: 0x5a7bd6, skyBottom: 0xffc4a3, fog: 0xe8b8a0, sunColor: 0xffd9a0,
    sunPos: [160, 40, -60], hemiSky: 0xffc4a3, hemiGround: 0x7a6a55,
    exposure: 1.15, sunIntensity: 1.9, hemiIntensity: 0.8, ambient: 0.32,
  },
};

function skyTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${top.toString(16).padStart(6, '0')}`);
  grad.addColorStop(0.55, `#${bottom.toString(16).padStart(6, '0')}`);
  grad.addColorStop(1, `#${bottom.toString(16).padStart(6, '0')}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfd9e8, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 60);

  // sky dome (gradient) + sun disc + a few soft clouds
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat);
  scene.add(sky);
  const sunMat = new THREE.MeshBasicMaterial({ color: CONFIG.palette.sun, fog: false });
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 24), sunMat);
  scene.add(sunDisc);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let k = 0; k < puffs; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + k * 3, 8, 6), cloudMat);
      s.position.set(k * 9 - puffs * 4, (k % 2) * 2, 0);
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set(-320 + (i * 53) % 640, 95 + (i * 17) % 45, -260 + (i * 91) % 520);
    clouds.add(cl);
  }
  scene.add(clouds);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5c, 0.9);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  let tod = 'noon';
  function setTimeOfDay(name) {
    const p = TOD[name] || TOD.noon;
    tod = name;
    skyMat.map = skyTexture(p.skyTop, p.skyBottom);
    skyMat.needsUpdate = true;
    scene.fog.color.setHex(p.fog);
    sun.color.setHex(p.sunColor);
    sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    sun.intensity = p.sunIntensity;
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    ambient.intensity = p.ambient;
    renderer.toneMappingExposure = p.exposure;
    sunDisc.position.set(p.sunPos[0] * 3.4, Math.max(p.sunPos[1] * 3.4, 60), p.sunPos[2] * 3.4);
    sunDisc.lookAt(camera.position);
    clouds.visible = name !== 'night';
  }
  setTimeOfDay('noon');

  // third-person follow camera with smoothing; orbitYaw is the player orbit
  const camState = { yaw: 0, pitch: 0.32, dist: 9.5, height: 3.4, shake: 0 };
  function updateCamera(focus, dt, opts = {}) {
    const dist = opts.dist !== undefined ? opts.dist : camState.dist;
    const height = opts.height !== undefined ? opts.height : camState.height;
    const yaw = opts.yaw !== undefined ? opts.yaw : camState.yaw;
    const pitch = opts.pitch !== undefined ? opts.pitch : camState.pitch;
    const tx = focus.x - Math.sin(yaw) * Math.cos(pitch) * dist;
    const tz = focus.z - Math.cos(yaw) * Math.cos(pitch) * dist;
    const ty = focus.y + height + Math.sin(pitch) * dist * 0.55;
    const k = 1 - Math.pow(0.0001, dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    if (camState.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * camState.shake;
      camera.position.y += (Math.random() - 0.5) * camState.shake;
      camState.shake *= Math.pow(0.02, dt);
    }
    camera.lookAt(focus.x, focus.y + 1.6, focus.z);
    sunDisc.lookAt(camera.position);
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.set(focus.x + TOD[tod].sunPos[0], TOD[tod].sunPos[1], focus.z + TOD[tod].sunPos[2]);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, setTimeOfDay, updateCamera, camState, get tod() { return tod; } };
}
