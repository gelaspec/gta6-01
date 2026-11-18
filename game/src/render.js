// Renderer, third-person chase camera and time-of-day lighting.
// Four presets (sunset, noon, night, dawn) drive the sun, sky, fog
// and window glow. v4 turns the exposure up and keeps the golden
// hour bright — the cover frame has to read vivid, not murky.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { clamp } from './random.js';

export const TIME_PRESETS = {
  sunset: {
    sunColor: 0xffc46b, sunIntensity: 2.8, sunPos: [-60, 26, -90],
    sky: 0xffb45e, fog: 0xf7b478, fogNear: 90, fogFar: 420,
    hemiSky: 0xffd29a, hemiGround: 0x5a4a38, hemiIntensity: 0.9,
    windowGlow: 0.3, lampGlow: 0.4, ambient: 0.45,
  },
  noon: {
    sunColor: 0xfff2d8, sunIntensity: 3.2, sunPos: [40, 120, 30],
    sky: 0x7cc0ff, fog: 0xb8d4f0, fogNear: 120, fogFar: 520,
    hemiSky: 0xcfe8ff, hemiGround: 0x6a7a58, hemiIntensity: 1.0,
    windowGlow: 0.0, lampGlow: 0.0, ambient: 0.55,
  },
  night: {
    sunColor: 0x9db4ff, sunIntensity: 0.7, sunPos: [-40, 80, -60],
    sky: 0x141c3a, fog: 0x141a30, fogNear: 70, fogFar: 320,
    hemiSky: 0x35447a, hemiGround: 0x1c1420, hemiIntensity: 0.6,
    windowGlow: 0.9, lampGlow: 1.0, ambient: 0.3,
  },
  dawn: {
    sunColor: 0xffc07a, sunIntensity: 2.3, sunPos: [90, 22, -70],
    sky: 0xffc07a, fog: 0xf0a870, fogNear: 100, fogFar: 460,
    hemiSky: 0xffd8b0, hemiGround: 0x54483a, hemiIntensity: 0.85,
    windowGlow: 0.4, lampGlow: 0.5, ambient: 0.4,
  },
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skySunset);
  scene.fog = new THREE.Fog(PALETTE.fogSunset, 90, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  const sun = new THREE.DirectionalLight(0xffc46b, 2.8);
  sun.position.set(-60, 26, -90);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd29a, 0x5a4a38, 0.9);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  // Gradient sky dome so the horizon never reads as flat grey.
  const skyGeo = new THREE.SphereGeometry(700, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: PALETTE.skySunset,
    side: THREE.BackSide,
    fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Low sun disc that reads in golden-hour frames.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }),
  );
  sunDisc.position.set(-320, 90, -480);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  // Drifting clouds.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(4 + p * 1.5, 8, 6), cloudMat);
      s.position.set(p * 5 - 6, (p % 2) * 1.5, (p % 3) - 1);
      s.scale.y = 0.55;
      cloud.add(s);
    }
    cloud.position.set(-260 + i * 62, 78 + (i % 3) * 12, -240 + ((i * 37) % 220));
    scene.add(cloud);
    clouds.push(cloud);
  }

  return { renderer, scene, camera, sun, hemi, ambient, sky, sunDisc, clouds };
}

export function applyTimeOfDay(view, presetName, city) {
  const p = TIME_PRESETS[presetName] || TIME_PRESETS.sunset;
  view.sun.color.setHex(p.sunColor);
  view.sun.intensity = p.sunIntensity;
  view.sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
  view.scene.background.setHex(p.sky);
  view.sky.material.color.setHex(p.sky);
  view.scene.fog.color.setHex(p.fog);
  view.scene.fog.near = p.fogNear;
  view.scene.fog.far = p.fogFar;
  view.hemi.color.setHex(p.hemiSky);
  view.hemi.groundColor.setHex(p.hemiGround);
  view.hemi.intensity = p.hemiIntensity;
  view.ambient.intensity = p.ambient;
  view.sunDisc.material.color.setHex(presetName === 'night' ? 0xdfe8ff : 0xffe8b0);
  view.sunDisc.visible = presetName !== 'noon';
  if (city) {
    for (const m of city.windowMats) m.emissiveIntensity = p.windowGlow;
    for (const l of city.lamps) l.material.color.setHex(p.lampGlow > 0.5 ? 0xffe9a8 : 0x9aa0a8);
  }
}

export function createCameraRig() {
  return {
    yaw: 0,
    pitch: 0.32,
    distance: 9.5,
    shake: 0,
    mode: 'follow', // follow | chase | orbit | fixed
    fixedPos: null,
    fixedLook: null,
  };
}

// Third-person camera: behind the focus point, lower and closer when
// driving (the chase look the top entries use), higher when on foot.
export function updateCamera(rig, camera, focus, dt, time) {
  if (rig.mode === 'fixed' && rig.fixedPos) {
    camera.position.set(rig.fixedPos.x, rig.fixedPos.y, rig.fixedPos.z);
    camera.lookAt(rig.fixedLook.x, rig.fixedLook.y, rig.fixedLook.z);
    return;
  }
  const dist = rig.mode === 'chase' ? 8.2 : rig.distance;
  const height = rig.mode === 'chase' ? 3.4 : 4.6;
  const pitch = rig.mode === 'chase' ? 0.24 : rig.pitch;
  const bx = focus.x - Math.sin(rig.yaw) * Math.cos(pitch) * dist;
  const bz = focus.z - Math.cos(rig.yaw) * Math.cos(pitch) * dist;
  const by = focus.y + height + Math.sin(pitch) * dist * 0.4;
  const s = rig.shake;
  const sx = s > 0.001 ? (Math.sin(time * 61) + Math.sin(time * 47)) * 0.5 * s : 0;
  const sy = s > 0.001 ? (Math.cos(time * 53) + Math.sin(time * 59)) * 0.5 * s : 0;
  camera.position.set(bx + sx, by + sy, bz);
  // In chase mode look a touch lower so the whole hero car sits in the
  // middle band of the frame, clear of the bottom-centre dialog box.
  const lookY = focus.y + (rig.mode === 'chase' ? 1.5 : 1.6);
  camera.lookAt(focus.x + sx * 0.4, lookY, focus.z);
  rig.shake = Math.max(0, rig.shake - dt * 1.8);
}

export function addShake(rig, amount) {
  rig.shake = Math.min(0.6, rig.shake + amount);
}

export function resizeRenderer(view) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.camera.aspect = w / h;
  view.camera.updateProjectionMatrix();
  view.renderer.setSize(w, h);
}
