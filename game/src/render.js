// Meridian Bay — renderer, camera rig and time of day. The camera follows
// the player or the driven car from behind, with a mouse-drag orbit and a
// near/far toggle; the sky, sun and fog shift per time of day so the golden
// hour chase, the bright day, dusk and the neon night each read at once.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const TIMES = {
  day: {
    sky: CONFIG.palette.skyDay, fog: 0x9fd8f2, sun: CONFIG.palette.sunDay,
    sunIntensity: 1.25, hemiSky: 0xbfe8ff, hemiGround: 0x8a7a5a, hemiIntensity: 0.85,
    sunPos: [120, 180, 60], ambient: 0.35,
  },
  golden: {
    sky: CONFIG.palette.skyGolden, fog: 0xffc98a, sun: CONFIG.palette.sunGolden,
    sunIntensity: 1.2, hemiSky: 0xffd9a0, hemiGround: 0x7a5a4a, hemiIntensity: 0.95,
    sunPos: [-160, 55, 90], ambient: 0.32,
  },
  dusk: {
    sky: CONFIG.palette.skyDusk, fog: 0xb99ae0, sun: 0xff7a5c,
    sunIntensity: 0.9, hemiSky: 0x9a86d8, hemiGround: 0x4a3a5a, hemiIntensity: 0.65,
    sunPos: [-140, 40, -80], ambient: 0.28,
  },
  night: {
    sky: CONFIG.palette.skyNight, fog: 0x16233f, sun: CONFIG.palette.sunNight,
    sunIntensity: 0.5, hemiSky: 0x33456e, hemiGround: 0x1a2233, hemiIntensity: 0.5,
    sunPos: [80, 140, -60], ambient: 0.22,
  },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(TIMES.day.sky);
    this.scene.fog = new THREE.Fog(TIMES.day.fog, 120, 520);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.camera.position.set(0, 12, -18);

    this.sun = new THREE.DirectionalLight(TIMES.day.sun, TIMES.day.sunIntensity);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(TIMES.day.hemiSky, TIMES.day.hemiGround, TIMES.day.hemiIntensity);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, TIMES.day.ambient);
    this.scene.add(this.ambient);

    // camera rig state
    this.yaw = 0; // orbit around the target, added to the target heading
    this.pitch = 0.32;
    this.distance = 13;
    this.far = false;
    this.shake = 0;
    this.target = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.timeOfDay = 'day';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setTimeOfDay(name) {
    const t = TIMES[name] || TIMES.day;
    this.timeOfDay = name;
    this.scene.background.setHex(t.sky);
    this.scene.fog.color.setHex(t.fog);
    this.sun.color.setHex(t.sun);
    this.sun.intensity = t.sunIntensity;
    this.sun.position.set(t.sunPos[0], t.sunPos[1], t.sunPos[2]);
    this.hemi.color.setHex(t.hemiSky);
    this.hemi.groundColor.setHex(t.hemiGround);
    this.hemi.intensity = t.hemiIntensity;
    this.ambient.intensity = t.ambient;
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  // Follow `target` (a Vector3) facing `heading`; dt smooths the chase.
  follow(target, heading, dt, speed) {
    const dist = this.far ? 19 : 13;
    const height = this.far ? 7.5 : 5.2;
    const yaw = heading + Math.PI + this.yaw;
    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw) * dist,
      target.y + height + this.pitch * 8,
      target.z + Math.cos(yaw) * dist,
    );
    // faster catch-up when the target moves fast, gentle when it strolls
    const k = 1 - Math.exp(-dt * (speed > 20 ? 7 : 4.5));
    this.eye.lerp(desired, k);
    if (this.shake > 0.001) {
      this.eye.x += (Math.random() - 0.5) * this.shake;
      this.eye.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= Math.exp(-dt * 6);
    }
    this.camera.position.copy(this.eye);
    this.target.lerp(target, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(this.target.x, this.target.y + 1.6, this.target.z);
  }

  // A fixed cinematic camera for the shot states (position + lookAt).
  place(position, lookAt) {
    this.eye.set(position[0], position[1], position[2]);
    this.target.set(lookAt[0], lookAt[1], lookAt[2]);
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.target);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
