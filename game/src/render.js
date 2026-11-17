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
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 950);

  // --- Cinematic sky: gradient dome (warm horizon, blue zenith), a low
  // golden sun with a halo, and a few soft clouds — all fixed geometry, so
  // every screenshot from the same seed sees the same sky. ---
  const sunDir = new THREE.Vector3(280, 420, 160).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x4f9fe8) },
      mid: { value: new THREE.Color(0x9fd4f2) },
      horizon: { value: new THREE.Color(0xffd9a0) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(0xffe9b8) },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;',
      'uniform vec3 sunDir; uniform vec3 sunColor;',
      'void main() {',
      '  float h = clamp(vDir.y, -0.05, 1.0);',
      '  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));',
      '  col = mix(col, top, smoothstep(0.15, 0.65, h));',
      '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
      '  col += sunColor * (pow(s, 24.0) * 0.5 + pow(s, 350.0) * 1.1);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat));
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }),
  );
  sunDisc.position.copy(sunDir).multiplyScalar(1350);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(130, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.22, fog: false }),
  );
  sunHalo.position.copy(sunDir).multiplyScalar(1340);
  sunHalo.lookAt(0, 0, 0);
  scene.add(sunHalo);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false });
  const cloudSpots = [
    [-500, 240, -600], [200, 260, -700], [650, 220, -400], [-700, 200, 300],
    [500, 250, 600], [-200, 280, 700], [900, 230, 100], [-900, 260, -200],
    [0, 300, -900], [350, 210, 850],
  ];
  for (const [cx, cy, cz] of cloudSpots) {
    const cloud = new THREE.Group();
    for (const [ox, oy, oz, r] of [[0, 0, 0, 26], [30, 4, 6, 20], [-28, 2, -4, 18], [8, 10, -8, 16]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(cx, cy, cz);
    scene.add(cloud);
  }

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.3);
  sun.position.set(280, 420, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -380;
  sun.shadow.camera.right = 380;
  sun.shadow.camera.top = 380;
  sun.shadow.camera.bottom = -380;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1100;
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 1.0;
  scene.add(sun);
  scene.add(sun.target);
  // A soft fill from the northwest so the sun's shadow sides never go black,
  // plus a warm bounce off the ocean side.
  const fill = new THREE.DirectionalLight(0xbfd8ff, 1.0);
  fill.position.set(-260, 180, -140);
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xffe0b8, 0.35);
  bounce.position.set(300, 120, 100);
  scene.add(bounce);

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
