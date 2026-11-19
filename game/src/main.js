// Meridian Bay — boot, game loop, screens and the wiring between every
// system. Fixed-step updates (1/60 s) so the game plays the same on any
// machine; the renderer and HUD run every animation frame.
//
// URL params: ?shot=chase|foot|dialog|progress&seed=1 — a shot pins the
// whole world down, freezes it, and raises window.__shotReady when the
// frame has settled, for render-shots.mjs.

import * as THREE from 'three';
import { CFG } from './config.js';
import { dist2d } from './random.js';
import { createRenderer, createScene, createSky, createLights, setTimeOfDay, createCameraRig } from './render.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createVehicle, driveVehicle, createTraffic, createParkedCars, nearestCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createDialog } from './dialog.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { loadSave, saveSave } from './save.js';
import { applyShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || null;
const SEED = Number(params.get('seed') || 1) || 1;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);
const sky = createSky(scene);
const lights = createLights(scene);
const rig = createCameraRig(camera);

const city = buildCity(THREE, SEED);
scene.add(city.group);

const input = createInput();
const hud = createHUD(document);
const audio = createAudio();
const dialog = createDialog(hud);
const effects = createEffects(THREE, scene);
const combat = createCombat(THREE, scene);

const player = createPlayer(THREE, city);
scene.add(player.mesh);

const heroCar = createVehicle(THREE, CFG.cars[0], 200, -36, Math.PI / 2);
scene.add(heroCar.mesh);
const parkedCars = createParkedCars(THREE, city, SEED + 7);
for (const c of parkedCars) scene.add(c.mesh);
const traffic = createTraffic(THREE, city, SEED + 11, CFG.tuning.trafficCount);
for (const c of traffic.cars) scene.add(c.mesh);
const van = createVehicle(THREE, { name: 'SECURITY VAN', color: 0xf2f2f2, top: 150, accel: 20, grip: 0.85 }, 330, 0, Math.PI / 2);
van.condition = 100;
scene.add(van.mesh);
const peds = createPedestrians(THREE, city, SEED + 23, CFG.tuning.pedCount);
for (const p of peds.peds) scene.add(p.mesh);
const police = createPolice(THREE, city, scene);

const saved = loadSave();
const game = {
  screen: SHOT ? 'play' : 'title',
  frozen: false,
  shotId: SHOT,
  shotCam: null,
  shotDisplay: null,
  settleFrames: 0,
  clock: { day: saved.day || 1, hour: 9.25 },
  ammo: 12,
  ammoReserve: 60,
  camOrbit: 0,
  vanDir: 1,
  player,
  heroCar,
  parkedCars,
  traffic,
  police,
  city,
  van,
  missions: null,
  dialog,
  hud,
  setTimeOfDay: (h) => setTimeOfDay(scene, sky, lights, h),
};
window.__game = game;
window.__shotId = SHOT;

const missions = createMissions(THREE, scene, city, {
  dialog,
  hud,
  audio,
  police,
  effects,
  onSave: () => saveSave({
    money: missions.money,
    missionsDone: missions.state.done,
    packages: missions.state.packagesFound,
    rep: missions.rep,
    day: game.clock.day,
  }),
  onBusted: () => {},
  onComplete: () => {
    game.screen = 'complete';
    hud.showScreen('complete');
  },
});
missions.money = saved.money ?? 250;
missions.rep = saved.rep ?? 0;
missions.state.done = saved.missionsDone || [];
missions.markPackagesFound(saved.packages || []);
game.missions = missions;

function activeCar() {
  return player.onFoot ? null : (player.car || heroCar);
}

function heroPos() {
  const car = activeCar();
  return car ? car.pos : player.pos;
}

const CODE_NAMES = ['CODE 0 — QUIET', 'CODE 1 — RESPONDING', 'CODE 2 — PURSUIT', 'CODE 3 — BACKUP', 'CODE 4 — FULL RESPONSE', 'CODE 5 — LOCKDOWN'];

function snapshot() {
  const d = game.shotDisplay;
  const m = d ? d.mission : missions.currentMission();
  const pos = heroPos();
  const units = police.unitInfo(pos);
  if (police.heli.active) units.push({ name: 'AIR-1', dist: Math.round(dist2d(police.heli.pos.x, police.heli.pos.z, pos.x, pos.z)), status: 'SPOTLIGHT', x: police.heli.pos.x, z: police.heli.pos.z });
  const policePos = police.units.map((u) => ({ x: u.pos.x, z: u.pos.z, status: u.status }));
  if (police.heli.active) policePos.push({ x: police.heli.pos.x, z: police.heli.pos.z, status: 'SPOTLIGHT' });
  const nearest = units.reduce((a, u) => Math.min(a, u.dist), 1e9);
  const inCar = !player.onFoot;
  const stage = d ? { label: d.stageText } : missions.state.stages[missions.state.stageIdx];
  const nextStage = missions.state.stages[missions.state.stageIdx + 1];
  return {
    money: d ? d.money : missions.money,
    day: d ? d.day : game.clock.day,
    hour: d ? d.hour : game.clock.hour,
    minute: d ? d.minute : (game.clock.hour % 1) * 60,
    wanted: police.wanted,
    heat: police.heat,
    lockdown: police.lockdown,
    inSight: police.wanted > 0 && nearest < 60,
    hp: Math.round(player.hp),
    speedKmh: inCar ? Math.abs(activeCar().speed) * 3.6 : player.speed * 3.6,
    carName: inCar ? activeCar().spec.name : 'ON FOOT',
    condition: inCar ? Math.round(activeCar().condition) : 100,
    radioName: CFG.radio[audio.station].name,
    radioSong: CFG.radio[audio.station].song,
    weapons: [
      { name: 'PISTOL', ammo: `${game.ammo}/${game.ammoReserve}` },
      { name: 'FISTS', ammo: '∞' },
      { name: 'SHOTGUN', ammo: 'LOCKED', locked: true },
      { name: 'SMG', ammo: 'LOCKED', locked: true },
    ],
    rep: d ? d.rep : missions.rep,
    mission: m,
    stageText: d ? d.stageText : missions.stageLabel(),
    nextText: d ? d.nextText : (nextStage ? `NEXT: ${nextStage.label}` : ''),
    policeCode: CODE_NAMES[police.wanted],
    policeUnits: units,
    district: city.districtAt(pos.x, pos.z),
    street: city.streetAt(pos.x, pos.z),
    minimap: {
      px: pos.x,
      pz: pos.z,
      heading: player.onFoot ? player.heading : heroCar.heading,
      target: missions.beacon.visible ? { x: missions.beacon.position.x, z: missions.beacon.position.z } : null,
      police: policePos,
      packages: missions.packageMeshes.filter((p) => !p.found).map((p) => ({ x: p.x, z: p.z })),
    },
  };
}

// Targets are the LIVE objects (cops, pedestrians, cars) with a kind tag,
// so damage and knockdowns land on the real thing instead of a copy.
function combatTargets() {
  const list = [];
  for (const cop of police.cops) {
    cop.kind = 'cop';
    if (cop.hp === undefined) cop.hp = 100;
    list.push(cop);
  }
  for (const p of peds.peds) {
    p.kind = 'ped';
    if (p.hp === undefined) p.hp = 100;
    list.push(p);
  }
  for (const c of [...traffic.cars, ...parkedCars, heroCar]) {
    c.kind = 'car';
    list.push(c);
  }
  return list;
}

function update(dt) {
  // Clock: one game minute per real second.
  game.clock.hour += dt / 60;
  if (game.clock.hour >= 24) {
    game.clock.hour -= 24;
    game.clock.day += 1;
  }
  setTimeOfDay(scene, sky, lights, game.clock.hour);

  const pos = heroPos();
  const heading = player.onFoot ? player.heading : heroCar.heading;

  // Camera orbit from mouse drag; eases back to behind the player.
  if (input.dragging) game.camOrbit += input.mouseDX * 0.005;
  else game.camOrbit *= Math.max(0, 1 - dt * 1.2);
  const camYaw = heading + Math.PI + game.camOrbit;

  // On foot vs driving.
  if (player.onFoot) {
    player.update(dt, input, camYaw);
    if (input.wasPressed('KeyE')) {
      const car = nearestCar([...parkedCars, ...traffic.cars, heroCar], player.pos.x, player.pos.z);
      if (car) {
        player.enterCar(car);
        car.parked = false;
        police.addCrime(1);
        audio.blip(520, 0.15, 0.2);
        hud.showToast(`STOLE THE ${car.spec.name} — WANTED +1`);
      }
    }
    if (input.wasPressed('KeyF')) {
      combat.punch(player.pos, player.heading, combatTargets(), effects, (n) => police.addCrime(n));
      audio.blip(180, 0.1, 0.25);
    }
    if (input.wasPressed('Mouse0') && game.ammo > 0) {
      game.ammo -= 1;
      audio.shot();
      effects.shake(0.25);
      combat.shoot(player.pos, player.heading, 0, combatTargets(), effects, (n) => police.addCrime(n));
      if (game.ammo === 0) hud.showToast('PISTOL EMPTY — press R to reload');
    }
    if (input.wasPressed('KeyR') && game.ammoReserve > 0) {
      const take = Math.min(12 - game.ammo, game.ammoReserve);
      game.ammo += take;
      game.ammoReserve -= take;
      audio.blip(660, 0.1, 0.2);
    }
  } else {
    const car = activeCar();
    const res = driveVehicle(car, dt, input, city);
    player.pos.copy(car.pos);
    player.heading = car.heading;
    if (res.handbrake && Math.abs(car.speed) > 8) {
      effects.smoke(new THREE.Vector3(car.pos.x, 0.3, car.pos.z), 2);
    }
    if (input.wasPressed('KeyE')) {
      player.exitCar();
      audio.blip(520, 0.15, 0.2);
    }
    if (input.wasPressed('KeyT')) missions.boardTaxi({ player, heroCar });
  }

  if (input.wasPressed('KeyC')) rig.dist = rig.dist > 9 ? 7 : 11;
  if (input.wasPressed('KeyQ')) {
    audio.nextStation();
    hud.showToast(`RADIO — ${CFG.radio[audio.station].name}`);
  }
  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.muted);
    hud.showToast(audio.muted ? 'MUTED' : 'SOUND ON');
  }

  // The security van patrols the pier while M5 is active.
  if (missions.currentMission().id === 'M5') {
    van.pos.x += game.vanDir * 8 * dt;
    if (van.pos.x > 388) game.vanDir = -1;
    if (van.pos.x < 272) game.vanDir = 1;
    van.heading = game.vanDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    van.syncMesh();
  }

  // Danger for pedestrians: gunfire position or the speeding hero car.
  const danger = input.wasPressed('Mouse0') ? { x: player.pos.x, y: 0, z: player.pos.z } : null;
  peds.update(dt, danger);
  traffic.update(dt, heroPos());
  police.update(dt, player, activeCar());
  missions.update(dt, { player, heroCar: activeCar(), van, effects });
  dialog.update(dt);
  effects.update(dt);
  audio.engine(player.onFoot ? 0 : Math.abs(activeCar().speed) / 60, !player.onFoot);
  audio.siren(police.wanted >= 1);

  // Busted: HP hit zero.
  if (player.hp <= 0 && game.screen === 'play') {
    game.screen = 'busted';
    police.setWanted(0);
    hud.showScreen('busted');
    audio.siren(false);
    audio.engine(0, false);
  }
}

function render() {
  if (game.shotCam) {
    camera.position.set(game.shotCam.pos[0], game.shotCam.pos[1], game.shotCam.pos[2]);
    camera.lookAt(game.shotCam.look[0], game.shotCam.look[1], game.shotCam.look[2]);
  } else {
    const pos = heroPos();
    const car = activeCar();
    const heading = player.onFoot ? player.heading : car.heading;
    const speed01 = player.onFoot ? player.speed / 10 : Math.abs(car.speed) / 60;
    rig.update(1 / 60, pos, heading + game.camOrbit, speed01);
  }
  effects.applyShake(camera);
  renderer.render(scene, camera);
}

function respawn() {
  player.hp = 100;
  police.setWanted(0);
  player.place(city.spawn.downtown.x, city.spawn.downtown.z, 0);
  heroCar.pos.set(city.spawn.marina.x, 0, city.spawn.marina.z);
  heroCar.heading = Math.PI / 2;
  heroCar.speed = 0;
  heroCar.condition = 100;
  heroCar.syncMesh();
  missions.startMission(missions.state.index);
  hud.hideScreens();
  game.screen = 'play';
}

function startPlaying() {
  audio.ensure();
  audio.resume();
  audio.startMusic();
  hud.hideScreens();
  game.screen = 'play';
  if (!missions.state.started) {
    missions.startMission(saved.missionsDone ? saved.missionsDone.length : 0);
    dialog.sayFixer('intro', 8);
  }
}

// Boot.
setTimeOfDay(scene, sky, lights, game.clock.hour);
if (SHOT) {
  applyShot(game, SHOT);
  game.screen = 'play';
  hud.hideScreens();
} else {
  player.place(city.spawn.oldPort.x, city.spawn.oldPort.z, Math.PI / 2);
  hud.showScreen('title');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (game.screen === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Mouse0')) startPlaying();
    // Slow orbit around the city behind the title screen.
    const t = now * 0.00005;
    camera.position.set(Math.sin(t) * 260, 90, Math.cos(t) * 260);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  } else if (game.screen === 'pause') {
    if (input.wasPressed('Escape') || input.wasPressed('Enter')) {
      hud.hideScreens();
      game.screen = 'play';
    }
    renderer.render(scene, camera);
  } else if (game.screen === 'busted' || game.screen === 'complete') {
    if (input.wasPressed('Enter') || input.wasPressed('Mouse0')) {
      if (game.screen === 'busted') respawn();
      else {
        hud.hideScreens();
        game.screen = 'play';
      }
    }
    renderer.render(scene, camera);
  } else if (game.screen === 'play') {
    if (input.wasPressed('Escape')) {
      game.screen = 'pause';
      hud.showScreen('pause');
    } else if (!game.frozen) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        update(STEP);
        acc -= STEP;
        steps++;
        // Just-pressed edges fire once per rendered frame, not once per
        // fixed step: a slow frame runs up to 5 steps, and without this
        // one E press would enter, exit, enter, exit, enter a car (+3
        // wanted), and one click would fire five bullets.
        if (steps === 1) input.endFrame();
      }
      if (steps === 5) acc = 0;
    }
    render();
    if (SHOT) {
      game.settleFrames++;
      // The world is frozen, so the frame is identical from the first
      // render on; a dozen settled frames is plenty of proof it is stable.
      if (game.settleFrames === 12) window.__shotReady = true;
    }
  }

  // In a frozen shot the HUD values never change, so after the first
  // frames there is nothing to redraw — skip the (expensive) DOM and
  // minimap work and let the software renderer breathe.
  const needHud = !game.frozen || game.settleFrames <= 15;
  if (needHud) hud.update(snapshot(), dt);
  input.endFrame();
}
requestAnimationFrame(frame);
