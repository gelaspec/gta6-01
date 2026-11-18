// Renderer, third-person camera and time-of-day lighting.
// Four presets (sunset, noon, night, dawn) drive the sun, sky, fog and
// window glow, so every screenshot can carry its own hour.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { clamp, lerp, wrapAngle } from './random.js';

export const TIME_PRESETS = {
  sunset: {
    sunColor: 0xffb36b, sunIntensity: 2.4, sunPos: [-60, 26, -90],
    sky: 0xff9a52, fog: 0xf2a06b, fogNear: 90, fogFar: 420,
    hemiSky: 0xffc98a, hemiGround: 0x4a3a2a, hemiIntensity: 0.75,
    windowGlow: 0.25, lampGlow: 0.4, ambient: 0.35,
  },
  noon: {
    sunColor: 0xfff2d8, sunIntensity: 3.0, sunPos: [40, 120, 30],
    sky: 0x6fb7ff, fog: 0xa8c8e8, fogNear: 120, fogFar: 520,
    hemiSky: 0xbfe3ff, hemiGround: 0x5a6a4a, hemiIntensity: 0.9,
    windowGlow: 0.0, lampGlow: 0.0, ambient: 0.5,
  },
  night: {
    sunColor: 0x8fa8ff, sunIntensity: 0.55, sunPos: [-40, 80, -60],
    sky: 0x0b1026, fog: 0x0d1428, fogNear: 70, fogFar: 320,
    hemiSky: 0x2a3a66, hemiGround: 0x141018, hemiIntensity: 0.5,
    windowGlow: 0.85, lampGlow: 1.0, ambient: 0.22,
  },
  dawn: {
    sunColor: 0xffc07a, sunIntensity: 2.0, sunPos: [90, 22, -70],
    sky: 0xffb27a, fog: 0xe8a06b, fogNear: 100, fogFar: 460,
    hemiSky: 0xffd0a0, hemiGround: 0x4a4030, hemiIntensity: 0.7,
    windowGlow: 0.35, lampGlow: 0.5, ambient: 0.32,
  },
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skySunset);
  scene.fog = new THREE.Fog(PALETTE.fogSunset, 90, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.position.set(-60, 26, -90);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffc98a, 0x4a3a2a, 0.75);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // Big gradient sky dome so the horizon never reads as flat grey.
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
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }),
  );
  sunDisc.position.set(-320, 90, -480);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  // A few drifting clouds.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
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
  view.sunDisc.material.color.setHex(presetName === 'night' ? 0xdfe8ff : 0xffe0a0);
  view.sunDisc.visible = presetName !== 'noon';
  if (city) {
    for (const m of city.windowMats) m.emissiveIntensity = p.windowGlow;
    for (const l of city.lamps) l.material.color.setHex(p.lampGlow > 0.5 ? 0xffe9a8 : 0x8a8f96);
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
  const dist = rig.mode === 'chase' ? 7.2 : rig.distance;
  const height = rig.mode === 'chase' ? 3.1 : 4.6;
  const pitch = rig.mode === 'chase' ? 0.24 : rig.pitch;
  if (rig.mode === 'fixed' && rig.fixedPos) {
    camera.position.set(rig.fixedPos.x, rig.fixedPos.y, rig.fixedPos.z);
    camera.lookAt(rig.fixedLook.x, rig.fixedLook.y, rig.fixedLook.z);
    return;
  }
  const bx = focus.x - Math.sin(rig.yaw) * Math.cos(pitch) * dist;
  const bz = focus.z - Math.cos(rig.yaw) * Math.cos(pitch) * dist;
  const by = focus.y + height + Math.sin(pitch) * dist * 0.4;
  const s = rig.shake;
  const sx = s > 0.001 ? (Math.sin(time * 61) + Math.sin(time * 47)) * 0.5 * s : 0;
  const sy = s > 0.001 ? (Math.cos(time * 53) + Math.sin(time * 59)) * 0.5 * s : 0;
  camera.position.set(bx + sx, by + sy, bz);
  camera.lookAt(focus.x + sx * 0.4, focus.y + 1.6, focus.z);
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
