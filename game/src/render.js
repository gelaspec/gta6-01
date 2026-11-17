// The three.js renderer and the third-person camera. One renderer, one scene,
// one camera for the whole game; the camera follows the player on foot or in
// a car, with mouse orbit and a smoothed chase, and a fixed framing for the
// screenshot scenes. No asset here comes from the network.

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 950);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(280, 420, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -380;
  sun.shadow.camera.right = 380;
  sun.shadow.camera.top = 380;
  sun.shadow.camera.bottom = -380;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1100;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  // A soft fill from the northwest so the sun's shadow sides never go black.
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.55);
  fill.position.set(-260, 180, -140);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2200);
  camera.position.set(0, 12, 24);

  let shakeAmount = 0;
  const camPos = new THREE.Vector3(0, 12, 24);
  const lookAt = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    shake(amount) {
      shakeAmount = Math.max(shakeAmount, amount);
    },
    /** Chase camera: behind `target` at `yaw`, `pitch` above the horizon. */
    follow(dt, target, yaw, pitch, distance, height) {
      const tx = target.x;
      const ty = (target.y || 0) + height * 0.4;
      const tz = target.z;
      const cx = tx - Math.sin(yaw) * Math.cos(pitch) * distance;
      const cz = tz - Math.cos(yaw) * Math.cos(pitch) * distance;
      const cy = ty + Math.sin(pitch) * distance + height * 0.45;
      const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
      camPos.x += (cx - camPos.x) * k;
      camPos.y += (cy - camPos.y) * k;
      camPos.z += (cz - camPos.z) * k;
      lookAt.x += (tx - lookAt.x) * k;
      lookAt.y += (ty + 1.2 - lookAt.y) * k;
      lookAt.z += (tz - lookAt.z) * k;
      shakeAmount = Math.max(0, shakeAmount - dt * 2.2);
      const sh = shakeAmount;
      camera.position.set(
        camPos.x + (Math.random() - 0.5) * sh,
        camPos.y + (Math.random() - 0.5) * sh * 0.6,
        camPos.z + (Math.random() - 0.5) * sh,
      );
      tmp.copy(lookAt);
      camera.lookAt(tmp);
    },
    /** Fixed framing, for title and screenshot scenes. */
    fixed(eye, target) {
      camPos.set(eye.x, eye.y, eye.z);
      lookAt.set(target.x, target.y, target.z);
      camera.position.copy(camPos);
      camera.lookAt(lookAt);
    },
    snap() {
      // After a teleport (mission start, shot staging) skip the chase lag.
      camera.position.copy(camPos);
      camera.lookAt(lookAt);
    },
    draw() {
      renderer.render(scene, camera);
    },
  };
}
