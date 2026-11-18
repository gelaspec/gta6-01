// Renderer: the three.js renderer, the four times of day, and the
// third-person camera rig with deterministic shake. The sky is a
// gradient dome so the horizon reads bright and warm at golden hour,
// never flat grey.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

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
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0xffd29a) },
      bottom: { value: new THREE.Color(0xfff2d8) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; varying vec3 vP;' +
      'void main(){ float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  return { renderer, scene, camera, sun, hemi, ambient, sky };
}

export function applyTimeOfDay(view, presetName, city) {
  const p = TIME_PRESETS[presetName] || TIME_PRESETS.sunset;
  view.sun.color.setHex(p.sunColor);
  view.sun.intensity = p.sunIntensity;
  view.sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
  view.scene.background.setHex(p.sky);
  view.scene.fog.color.setHex(p.fog);
  view.scene.fog.near = p.fogNear;
  view.scene.fog.far = p.fogFar;
  view.hemi.color.setHex(p.hemiSky);
  view.hemi.groundColor.setHex(p.hemiGround);
  view.hemi.intensity = p.hemiIntensity;
  view.ambient.intensity = p.ambient;
  view.sky.material.uniforms.top.value.setHex(p.sky);
  view.sky.material.uniforms.bottom.value.setHex(p.fog);
  if (city) {
    for (const m of city.windowMats) m.emissiveIntensity = p.windowGlow;
    for (const lamp of city.lamps) lamp.material.emissiveIntensity = p.lampGlow;
  }
}

export function createCameraRig() {
  return {
    mode: 'follow', // follow | chase | fixed
    yaw: Math.PI,
    pitch: 0.32,
    distance: 9.5,
    fixedPos: null,
    fixedLook: null,
    shake: 0,
    shakeT: 0,
  };
}

export function updateCamera(rig, camera, focus, dt, time) {
  if (rig.mode === 'fixed' && rig.fixedPos && rig.fixedLook) {
    camera.position.set(rig.fixedPos.x, rig.fixedPos.y, rig.fixedPos.z);
    camera.lookAt(rig.fixedLook.x, rig.fixedLook.y, rig.fixedLook.z);
    return;
  }
  // Chase and follow share the rig distance: the chase camera sits
  // close enough that the car fills the frame, like the top covers.
  const dist = rig.distance;
  const height = rig.mode === 'chase' ? 3.2 : 2.6;
  const backX = focus.x - Math.sin(rig.yaw) * dist;
  const backZ = focus.z - Math.cos(rig.yaw) * dist;
  const tx = lerp(camera.position.x, backX, clamp(dt * 6, 0, 1));
  const ty = lerp(camera.position.y, focus.y + height, clamp(dt * 6, 0, 1));
  const tz = lerp(camera.position.z, backZ, clamp(dt * 6, 0, 1));
  camera.position.set(tx, ty, tz);
  // Deterministic shake: a sine of the running clock, so the same
  // seed replays the same frame — no Math.random in the camera.
  let sx = 0;
  let sy = 0;
  if (rig.shake > 0.001) {
    rig.shakeT += dt * 31;
    sx = Math.sin(rig.shakeT * 1.7) * rig.shake * 0.12;
    sy = Math.cos(rig.shakeT * 2.3) * rig.shake * 0.09;
    rig.shake = Math.max(0, rig.shake - dt * 2.2);
  }
  camera.lookAt(focus.x + sx, focus.y + sy, focus.z);
}

export function addShake(rig, amount) {
  rig.shake = Math.min(1.2, rig.shake + amount);
}

export function resizeRenderer(view) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.camera.aspect = w / h;
  view.camera.updateProjectionMatrix();
  view.renderer.setSize(w, h);
}
