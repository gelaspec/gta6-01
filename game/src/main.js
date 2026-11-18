// Meridian Bay — boot, fixed-step loop, screen state machine and the
// wiring between every system. The game opens on the title screen;
// Enter starts the story, P pauses, and the mission-passed screen
// chains into the next job.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { createRenderer, applyTimeOfDay, createCameraRig, updateCamera, resizeRenderer, addShake } from './render.js';
import { buildCity } from './city.js';
import { createInput, isDown, wasPressed, endFrame } from './input.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { createVehicles, updateVehicles, nearestCar, stealCar, exitCar, buildCarMesh } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addWanted } from './police.js';
import { createCombat, updateCombat, shoot, punch } from './combat.js';
import { createDialog } from './dialog.js';
import { createMissions, updateMissions, updateSideJobs, startMission, addDistrictHeat } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects, updateEffects, makeEffectsApi } from './effects.js';
import { loadSave, makeSaveApi } from './save.js';
import { applyShot, shotReady } from './shots.js';
import { districtAt } from './config.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const canvas = document.getElementById('game-canvas');
const view = createRenderer(canvas);
const rng = makeRng(seed);
const city = buildCity(view.scene, seed);
const input = createInput(canvas);
const audio = createAudio();
const effectsPool = createEffects(view.scene);
const effects = makeEffectsApi(effectsPool);
const hud = createHud();
const dialog = createDialog();

const G = {
  view,
  rng,
  city,
  input,
  audio,
  effects,
  hud,
  dialog,
  time: 0,
  clockMinutes: CONFIG.clockStartMinutes,
  money: CONFIG.startMoney,
  rep: 120,
  radioIndex: 0,
  songIndex: 0,
  screen: 'title',
  events: [],
  shot: null,
  cars: null,
  peds: null,
  police: null,
  combat: null,
  missions: null,
  player: null,
  rig: createCameraRig(),
  save: null,
};

G.player = createPlayer(view.scene, rng, city.spawn.x, city.spawn.z);
G.cars = createVehicles(view.scene, rng, city);
G.peds = createPedestrians(view.scene, rng, city);
G.police = createPolice(view.scene, rng);
G.combat = createCombat();
G.missions = createMissions(view.scene);
G.save = makeSaveApi(G);

// Debug handle for headless inspection (state, camera, scene graph).
window.__game = G;

// The black Harbor Kings van waits on the pier for M5.
{
  const vanModel = { name: 'Harbor Van', kind: 'van', top: 36, accel: 20 };
  const mesh = buildCarMesh(rng, vanModel, 0x14161a);
  mesh.position.set(150, 0, 0);
  mesh.rotation.y = Math.PI / 2;
  view.scene.add(mesh);
  G.cars.push({ mesh, model: vanModel, color: 0x14161a, x: 150, z: 0, heading: Math.PI / 2, speed: 0, steer: 0, condition: 100, traffic: false, target: null, honk: 0, stuck: 0 });
}

// Restore a save if one exists.
{
  const save = loadSave();
  if (save) {
    G.money = save.money ?? CONFIG.startMoney;
    G.rep = save.rep ?? 120;
    G.missions.currentIndex = Math.min(save.missionIndex ?? 0, 5);
    G.missions.packagesFound = save.packagesFound ?? 0;
    G.missions.heat = save.heat ?? {};
    G.clockMinutes = save.clockMinutes ?? CONFIG.clockStartMinutes;
    (save.packagesTaken || []).forEach((taken, i) => {
      if (taken && G.missions.packages[i]) {
        G.missions.packages[i].taken = true;
        G.missions.packages[i].mesh.visible = false;
      }
    });
  }
}

applyTimeOfDay(view, 'sunset', city);
hud.showScreen('screen-title');
document.getElementById('loading').style.display = 'none';

if (shotName) {
  applyShot(G, shotName);
} else {
  G.screen = 'title';
}

window.addEventListener('resize', () => resizeRenderer(view));

function processEvents() {
  for (const ev of G.events) {
    if (ev.type === 'crime') {
      addWanted(G, ev.amount, ev.reason);
      addDistrictHeat(G, districtAt(G.player.x, G.player.z), ev.amount * 0.5);
    } else if (ev.type === 'busted') {
      G.money = Math.max(0, G.money - CONFIG.bustFine);
      G.police.wanted = 0;
      G.screen = 'busted';
      hud.showScreen('screen-busted');
      audio.sirenBurst();
    } else if (ev.type === 'wasted') {
      document.querySelector('#screen-busted h1').textContent = 'WASTED';
      document.getElementById('busted-text').textContent = 'Cassian is down. The Bay keeps your money — it keeps everything.';
      G.money = Math.max(0, G.money - CONFIG.bustFine);
      G.police.wanted = 0;
      G.screen = 'busted';
      hud.showScreen('screen-busted');
    }
  }
  G.events.length = 0;
}

function step(dt) {
  G.time += dt;
  G.clockMinutes += dt * CONFIG.clockRate;
  if (G.shot && G.shot.drive) G.shot.drive();

  if (G.screen === 'play') {
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    updateSideJobs(G, dt);
    processEvents();
  } else if (G.screen === 'title' || G.screen === 'passed' || G.screen === 'complete') {
    // Ambient life behind menus: traffic and pedestrians keep moving.
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    processEvents();
  }
  updateEffects(effectsPool, dt);
  dialog.update(performance.now() / 1000);

  // Camera focus: player, car, or the fixed shot framing.
  const focus = G.player.inCar
    ? { x: G.player.inCar.x, y: 1.4, z: G.player.inCar.z }
    : { x: G.player.x, y: 1.4, z: G.player.z };
  if (G.rig.mode === 'fixed') {
    updateCamera(G.rig, view.camera, focus, dt, G.time);
  } else {
    updateCamera(G.rig, view.camera, focus, dt, G.time);
  }
  hud.update(G);
  view.renderer.render(view.scene, view.camera);
  // Shot readiness counts fixed sim steps (2.5 s), not rendered frames,
  // so a slow headless renderer takes the same frame as a fast one.
  if (G.shot) shotReady(G);
  // Belt and braces: in a slow software renderer the sim crawls, so a
  // shot is also ready after 10 rendered frames — the scene is fully
  // staged before the first frame, and the HUD settles on frame one.
  if (G.shot && !G.shot.ready) {
    G.shot.rendered = (G.shot.rendered || 0) + 1;
    if (G.shot.rendered >= 10) {
      G.shot.ready = true;
      window.__shotReady = true;
    }
  }
}

function onKey(e) {
  if (e.code === 'Enter') {
    audio.resume();
    audio.startMusic();
    if (G.screen === 'title') {
      G.screen = 'play';
      hud.hideScreens();
      if (!G.missions.current) startMission(G, G.missions.currentIndex);
      hud.hint('Follow the gold beacon — your next job is marked.');
    } else if (G.screen === 'busted') {
      G.player.health = CONFIG.playerHealth;
      G.player.x = city.spawn.x;
      G.player.z = city.spawn.z;
      G.player.mesh.position.set(G.player.x, 0, G.player.z);
      if (G.player.inCar) {
        G.player.inCar = null;
        G.player.mesh.visible = true;
      }
      document.querySelector('#screen-busted h1').textContent = 'BUSTED';
      G.screen = 'play';
      hud.hideScreens();
    } else if (G.screen === 'passed') {
      G.screen = 'play';
      hud.hideScreens();
      const next = G.missions.currentIndex + 1;
      if (next < G.missions.defs.length) startMission(G, next);
      else hud.hint('Free roam — the city is yours.');
    } else if (G.screen === 'complete') {
      G.screen = 'play';
      hud.hideScreens();
    }
  }
  if (e.code === 'KeyP' && (G.screen === 'play' || G.screen === 'pause')) {
    G.screen = G.screen === 'play' ? 'pause' : 'play';
    hud.showScreen(G.screen === 'pause' ? 'screen-pause' : null);
    if (G.screen === 'play') hud.hideScreens();
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (e.code === 'KeyR' && G.screen === 'play') {
    G.radioIndex = (G.radioIndex + 1) % 3;
    G.songIndex = (G.songIndex + 1) % 3;
    hud.toast(`Radio: ${['MERIDIAN FM 98.1', 'BAYWAVE 104.5', 'NEON NIGHTS 91.3'][G.radioIndex]}`);
  }
  if (e.code === 'KeyC' && G.screen === 'play') {
    G.rig.distance = G.rig.distance > 8 ? 6.5 : 11;
  }
  if (e.code === 'KeyE' && G.screen === 'play') {
    const p = G.player;
    if (p.inCar) {
      exitCar(G);
    } else {
      const car = nearestCar(G.cars, p.x, p.z, 3.6);
      if (car) stealCar(G, car);
      else hud.hint('No car close enough — walk up to one and press E.');
    }
  }
  if (e.code === 'KeyF' && G.screen === 'play') punch(G);
}
window.addEventListener('keydown', onKey);
canvas.addEventListener('click', () => {
  audio.resume();
  if (G.screen === 'title') {
    G.screen = 'play';
    hud.hideScreens();
    if (!G.missions.current) startMission(G, G.missions.currentIndex);
  } else if (G.screen === 'play') {
    shoot(G);
  }
});
canvas.addEventListener('mousedown', () => {
  if (G.screen === 'play' && !G.player.inCar) shoot(G);
});

// Fixed-step loop with a render every frame.
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    step(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 5) acc = 0;
  endFrame(input);
}
requestAnimationFrame(frame);
