// Meridian Bay — boot, game loop, screens, car enter/exit, taxi fares.
// The game: Cassian Rowe, a fixer named Inez, six story missions, the MBPD,
// and one very pink Comet GT.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Rng } from './random.js';
import { buildCity } from './city.js';
import { createRender } from './render.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createCar, createTraffic, driveCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createDialog, DISPATCH_LINES } from './dialog.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { saveGame, loadGame } from './save.js';
import { applyShot } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10);
const shotName = params.get('shot') || '';
const rng = new Rng(seed);

const canvas = document.getElementById('game-canvas');
const render = createRender(canvas);
const scene = render.scene;
const city = buildCity(scene, rng);
const input = createInput();
const player = createPlayer(scene, city);
const traffic = createTraffic(scene, city, rng, 14);
const pedestrians = createPedestrians(scene, city, rng, 26);
const police = createPolice(scene, city, rng);
const combat = createCombat(scene, rng);
const dialog = createDialog();
const hud = createHud(city);
const audio = createAudio();
const effects = createEffects(scene);

// -- game state ---------------------------------------------------------------
const state = {
  money: 0,
  rep: 0,
  day: 1,
  clock: '09:00',
  clockMinutes: 9 * 60,
  health: 100,
  wanted: 0,
  speedKmh: 0,
  inCar: false,
  carName: '',
  carCondition: 100,
  radioStation: CONFIG.radio[0].station,
  radioSong: CONFIG.radio[0].song,
  radioIndex: 0,
  weapon: 'fists',
  ammo: CONFIG.pistolAmmo,
  mission: CONFIG.missions[0],
  missionStageText: 'Not started',
  missionStageFrac: 0,
  missionNextText: 'NEXT: M2 — Courier Run',
  missionSpot: null,
  policeUnits: [],
  heliVisible: false,
  heliPos: null,
  packages: [],
  dispatchLine: '',
  pos: player.pos,
  heading: 0,
  missionsDone: 0,
  packagesCollected: 0,
  shotMode: false,
};
const missions = createMissions(scene, rng, state);
state.packages = missions.packages;

// -- UI overlays ----------------------------------------------------------------
const ui = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  busted: document.getElementById('busted-screen'),
  passed: document.getElementById('passed-screen'),
  story: document.getElementById('story-screen'),
  toast: document.getElementById('toast'),
  hideAllOverlays() {
    for (const el of [this.title, this.pause, this.busted, this.passed, this.story]) el.classList.add('hidden');
  },
  showToast(text, ms = 2600) {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toast.classList.add('hidden'), ms);
  },
  showMissionPassed(m, stats) {
    document.getElementById('passed-title').textContent = `${m.id} — ${m.name.toUpperCase()} PASSED`;
    document.getElementById('passed-reward').textContent = `+$${stats.reward.toLocaleString('en-US')}`;
    document.getElementById('passed-stats').textContent =
      `TIME ${stats.time}  •  STARS ${'★'.repeat(stats.stars)}  •  PACKAGES ${stats.packages}/10  •  REP +240`;
    document.getElementById('passed-next').textContent = stats.next
      ? `NEXT: ${stats.next.id} — ${stats.next.name}`
      : 'STORY COMPLETE';
    this.passed.classList.remove('hidden');
  },
};

// -- cars ------------------------------------------------------------------------
let currentCar = null;
const parkedCars = [];
function spawnParkedCars() {
  const spots = [
    { cls: 0, color: 0xd8d3c8, x: -4, z: 24.5, h: Math.PI / 2 },
    { cls: 1, color: 0x3a7bd5, x: 48, z: -18.5, h: 0 },
    { cls: 2, color: 0x8a94a0, x: -92, z: 70, h: -Math.PI / 2 },
    { cls: 4, color: 0xffc400, x: 92, z: -18.5, h: Math.PI },
    { cls: 5, color: CONFIG.palette.pinkCar, x: 66, z: -70, h: Math.PI / 2 }, // the pink Comet GT
    { cls: 0, color: 0x7a9a5a, x: -48, z: -70, h: 0 },
    { cls: 3, color: 0x111114, x: 178, z: 22, h: Math.PI / 2 }, // M5 black van on the pier
    { cls: 1, color: 0xff6d5a, x: 110, z: 110, h: Math.PI },
  ];
  for (const s of spots) {
    const car = createCar(scene, s.cls, s.color, s.x, s.z, s.h);
    // the M5 black van lives on the pier deck (y = 1.5), not inside it
    if (s.x === 178 && s.z === 22) car.mesh.position.y = 1.5;
    parkedCars.push(car);
  }
}
spawnParkedCars();

function enterCar(car, speedMs = 0) {
  currentCar = car;
  state.inCar = true;
  state.carName = car.name;
  state.carCondition = 100;
  car.speed = speedMs;
  player.mesh.visible = false;
  const idx = parkedCars.indexOf(car);
  if (idx >= 0) parkedCars.splice(idx, 1);
  audio.ensure();
  audio.startRadio();
  ui.showToast(`${car.name} — ${car.classIndex === 5 ? 'nice choice.' : 'stolen.'}`);
  if (!state.shotMode) police.addHeat(6);
}
function exitCar() {
  if (!currentCar) return;
  const car = currentCar;
  const sx = car.pos.x + Math.cos(car.heading) * 2.2;
  const sz = car.pos.z - Math.sin(car.heading) * 2.2;
  const res = city.resolveCollision(sx, sz, 0.6);
  player.setPos(res.x, res.z, car.heading);
  player.mesh.visible = true;
  currentCar = null;
  state.inCar = false;
  state.carName = '';
  state.speedKmh = 0;
  audio.stopRadio();
}
function nearestParkedCar(maxD = 3.6) {
  let best = null;
  let bestD = maxD;
  for (const car of parkedCars) {
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

// -- taxi fares --------------------------------------------------------------------
const fareBeacon = new THREE.Group();
{
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 20;
  fareBeacon.add(cyl);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 2, 4),
    new THREE.MeshBasicMaterial({ color: 0x39d353 }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 6;
  fareBeacon.add(cone);
  fareBeacon.visible = false;
  scene.add(fareBeacon);
}
let fare = null; // {x, z, timer}
function maybeStartFare() {
  if (fare || !currentCar || currentCar.name !== 'Taxi') return;
  // a pedestrian near the taxi wants a ride
  for (const p of pedestrians.peds) {
    const d = Math.hypot(p.pos.x - currentCar.pos.x, p.pos.z - currentCar.pos.z);
    if (d < 8) {
      const dest = city.randomRoadPoint();
      fare = { x: dest.x, z: dest.z, timer: 90 };
      fareBeacon.position.set(dest.x, 0, dest.z);
      fareBeacon.visible = true;
      dialog.show('Cassian Rowe', 'DRIVER', 'Hop in. Where to? The meter is running.', 4);
      state.dispatchLine = 'FARE: drop the passenger off — $120 on arrival.';
      return;
    }
  }
}

// -- mission flow ---------------------------------------------------------------------
let screen = shotName ? 'playing' : 'title';
let frameCount = 0;
let shotReadyAt = 0;
let shotStaged = false;
let missionClock = 0; // seconds into the current mission, for stats
let dispatchT = 0;
let dispatchIdx = 0;
let gameMinutes = 0;

function startMission(i, viaContinue = false) {
  const m = missions.startMission(i);
  state.mission = m;
  missionClock = 0;
  if (m.id === 'M4') police.addHeat(54); // start at 3 stars
  if (m.id === 'M6') police.addHeat(30); // the job starts hot
  dialog.showNow('Inez Kade', 'FIXER', m.brief, 8);
  state.dispatchLine = '';
  if (!viaContinue) ui.showToast(`${m.chapter} — ${m.name}`);
  return m;
}

function onMissionEvent(ev) {
  if (ev === 'PACKAGE') {
    effects.sparkle(player.pos);
    audio.pickup();
    ui.showToast(`Hidden package +$${CONFIG.packageValue}`);
    return;
  }
  if (ev === 'DROP') {
    audio.pickup();
    ui.showToast(`Drop ${missions.dropsCollected}/3 collected`);
    return;
  }
  if (ev === 'HOLD') {
    dialog.show('Inez Kade', 'FIXER', 'Twenty seconds. Hold the doors and do NOT let them in.', 5);
    police.addHeat(20);
    return;
  }
  if (ev === 'ESCAPE') {
    dialog.show('Inez Kade', 'FIXER', 'That is the money. Now the bridge, then the boat. GO!', 5);
    police.addHeat(25);
    return;
  }
  if (ev === 'FAILED') {
    dialog.show('Inez Kade', 'FIXER', 'That one is blown, Cassian. Come back to the garage and we run it again.', 6);
    audio.busted();
    ui.showToast('MISSION FAILED — try again from the garage');
    startMission(missions.current);
    return;
  }
  if (ev === 'COMPLETE') {
    const res = missions.completeMission();
    audio.missionPass();
    saveGame({ ...state, missionIndex: missions.current });
    screen = 'passed';
    ui.showMissionPassed(state.mission, {
      reward: res.reward,
      time: `${Math.round(missionClock)}s`,
      stars: Math.min(3, 1 + Math.floor(state.rep / 800)),
      packages: state.packagesCollected,
      next: res.next,
    });
    dialog.show('Inez Kade', 'FIXER', res.storyDone
      ? 'We did it. Meridian Bay is ours, Cassian.'
      : 'Clean. Take the money and meet me at the next one.', 7);
    if (res.storyDone) {
      setTimeout(() => {
        ui.hideAllOverlays();
        ui.story.classList.remove('hidden');
        screen = 'story';
      }, 1200);
    }
  }
}

// title screen buttons
document.getElementById('btn-start').addEventListener('click', () => {
  audio.ensure();
  ui.hideAllOverlays();
  screen = 'playing';
  startMission(0);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  const save = loadGame();
  audio.ensure();
  ui.hideAllOverlays();
  screen = 'playing';
  if (save) {
    state.money = save.money;
    state.rep = save.rep;
    state.day = save.day;
    state.missionsDone = save.missionsDone || 0;
    startMission(save.missionIndex || 0, true);
    ui.showToast(`Welcome back, Cassian. Day ${state.day}.`);
  } else {
    startMission(0);
  }
});
document.getElementById('btn-passed').addEventListener('click', () => {
  ui.hideAllOverlays();
  screen = 'playing';
  if (missions.current < CONFIG.missions.length - 1) startMission(missions.current + 1);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  ui.hideAllOverlays();
  screen = 'playing';
});
document.getElementById('btn-busted').addEventListener('click', () => {
  ui.hideAllOverlays();
  state.health = 100;
  state.money = Math.floor(state.money * 0.9);
  police.setWanted(0);
  player.setPos(0, 30, 0);
  screen = 'playing';
  ui.showToast('Busted. The MBPD took 10% and dropped you at the plaza.');
});
document.getElementById('btn-story').addEventListener('click', () => {
  ui.hideAllOverlays();
  screen = 'title';
  ui.title.classList.remove('hidden');
});

// -- shot staging ----------------------------------------------------------------------
const G = {
  state, scene, render, city, player, police, combat, missions, dialog, ui,
  enterCar, exitCar, stagedCars: [], freezeTraffic: false, camOverride: null,
  get currentCar() { return currentCar; },
};
if (shotName) {
  const ok = applyShot(G, shotName);
  if (ok) {
    shotStaged = true;
    state.mission = missions.def();
    shotReadyAt = performance.now();
  } else {
    window.__errors.push(`unknown shot: ${shotName}`);
  }
}

// -- main loop ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let lastHud = 0;

function missionStageFrac() {
  const m = missions.def();
  if (!missions.started) return 0;
  if (m.id === 'M1' || m.id === 'M5') return state.inCar ? 1 : 0.25;
  if (m.id === 'M2' || m.id === 'M4') return m.time > 0 ? Math.max(0, 1 - missions.timer / m.time) : 0;
  if (m.id === 'M3') return missions.dropsCollected / 3;
  if (m.id === 'M6') {
    if (missions.stage === 0) return 0.1;
    if (missions.stage === 1) return 0.4 + 0.3 * Math.max(0, 1 - missions.timer / m.time);
    return 0.85;
  }
  return 0;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frameCount += 1;

  // camera orbit on the title screen
  if (screen === 'title') {
    const t = performance.now() * 0.00008;
    const focus = new THREE.Vector3(Math.cos(t) * 40, 4, Math.sin(t) * 40);
    render.camera.position.set(Math.cos(t + 0.6) * 70, 34, Math.sin(t + 0.6) * 70);
    render.camera.lookAt(0, 6, 0);
    render.renderer.render(scene, render.camera);
    return;
  }

  if (screen === 'playing' && state.shotMode) {
    // STAGED: no simulation. The scene is composed as-is by shots.js; the
    // camera snaps into place and the HUD renders once. Without this freeze
    // the car would coast to a stop and the police would pile into it before
    // the slow headless renderer reached frame 10.
    const focusPos = state.inCar && currentCar ? currentCar.pos : player.pos;
    const focusHeading = state.inCar && currentCar ? currentCar.heading : player.heading;
    const camOpts = G.camOverride
      ? { dist: G.camOverride.dist, height: G.camOverride.height, pitch: G.camOverride.pitch, yaw: focusHeading, snap: frameCount < 4 }
      : { dist: 9.5, height: 3.4, pitch: 0.3, yaw: focusHeading, snap: frameCount < 4 };
    render.updateCamera(new THREE.Vector3(focusPos.x, 1.2, focusPos.z), dt, camOpts);
    state.pos = focusPos;
    state.heading = focusHeading;
    if (frameCount % 2 === 0) hud.update(state);
  } else if (screen === 'playing') {
    // -- input: camera orbit ------------------------------------------------
    const mouse = input.takeMouse();
    render.camState.yaw -= mouse.dx * 0.004;
    render.camState.pitch = Math.max(0.08, Math.min(0.9, render.camState.pitch + mouse.dy * 0.003));

    // E: enter the nearest parked car, or step out of the current one
    if (input.hit('KeyE')) {
      if (state.inCar) exitCar();
      else {
        const car = nearestParkedCar();
        if (car) enterCar(car);
      }
    }

    // -- player / car ---------------------------------------------------------
    let focusPos = player.pos;
    let focusHeading = player.heading;
    if (state.inCar && currentCar) {
      const res = driveCar(currentCar, dt, input, city);
      state.speedKmh = res.speedKmh;
      focusPos = currentCar.pos;
      focusHeading = currentCar.heading;
      if (res.handbrake && Math.abs(currentCar.speed) > 8 && frameCount % 3 === 0) {
        effects.smoke(new THREE.Vector3(currentCar.pos.x, 0, currentCar.pos.z));
      }
      audio.setEngine(state.speedKmh, true);
      maybeStartFare();
    } else {
      const moved = player.update(dt, input, render.camState.yaw);
      state.speedKmh = moved.moving ? (moved.running ? 11 : 6.5) * 3.6 : 0;
      focusPos = player.pos;
      focusHeading = player.heading;
      audio.setEngine(0, false);
    }

    // -- combat ---------------------------------------------------------------
    if (input.hit('Digit1')) state.weapon = 'fists';
    if (input.hit('Digit2')) state.weapon = 'pistol';
    if (input.hit('KeyF') && !state.inCar) {
      const hit = combat.punch(player.pos, player.heading);
      if (hit) { effects.impact(player.pos); police.addHeat(8); }
    }
    if (input.hit('KeyM')) {
      const muted = audio.toggleMute();
      ui.showToast(muted ? 'Sound off' : 'Sound on');
    }
    if (input.hit('KeyV') && state.inCar) {
      state.radioIndex = (state.radioIndex + 1) % CONFIG.radio.length;
      state.radioStation = CONFIG.radio[state.radioIndex].station;
      state.radioSong = CONFIG.radio[state.radioIndex].song;
      ui.showToast(`${state.radioStation} — ${state.radioSong}`);
    }
    combat.update(dt, player.pos, (dmg) => {
      state.health -= dmg;
      render.camState.shake = 0.5;
    });
    state.ammo = combat.ammo;

    // mouse click = shoot (only when on foot)
    if (input.takeClick() && !state.inCar) {
      const res = combat.shoot(render.camera, player.pos, player.heading, (pt) => {
        if (pt) effects.impact(pt);
      });
      if (res.fired) {
        audio.gunshot();
        combat.muzzle.position.set(player.pos.x, 1.4, player.pos.z);
        effects.muzzleFlash(player.pos);
        police.addHeat(10);
        pedestrians.update(0, player.pos, 18);
      }
    }

    // -- world ------------------------------------------------------------------
    if (!G.freezeTraffic) traffic.update(dt, currentCar);
    pedestrians.update(dt, state.inCar ? currentCar.pos : null, state.inCar ? 7 : 0);
    const pol = police.update(dt, focusPos, state.speedKmh, state.inCar);
    state.wanted = police.wanted;
    state.policeUnits = police.units;
    state.heliVisible = police.heli.group.visible;
    state.heliPos = police.heli.group.visible
      ? { x: police.heli.group.position.x, z: police.heli.group.position.z } : null;
    audio.setSiren(police.wanted > 0);
    effects.update(dt);
    effects.updateFlash(dt);
    dialog.update(dt);

    // dispatch chatter
    if (police.wanted > 0) {
      dispatchT += dt;
      if (dispatchT > 12) {
        dispatchT = 0;
        state.dispatchLine = `DISPATCH: ${DISPATCH_LINES[dispatchIdx % DISPATCH_LINES.length]}`;
        dispatchIdx += 1;
      }
    }

    // -- taxi fare ---------------------------------------------------------------
    if (fare) {
      fare.timer -= dt;
      const d = Math.hypot(fare.x - focusPos.x, fare.z - focusPos.z);
      if (d < 10) {
        state.money += CONFIG.taxiFare;
        ui.showToast(`Fare complete +$${CONFIG.taxiFare}`);
        audio.pickup();
        fare = null;
        fareBeacon.visible = false;
      } else if (fare.timer <= 0) {
        ui.showToast('Fare cancelled — passenger walked off');
        fare = null;
        fareBeacon.visible = false;
      }
    }

    // -- missions ------------------------------------------------------------------
    missionClock += dt;
    const ev = missions.update(dt, focusPos, state.inCar, police.wanted);
    if (ev) onMissionEvent(ev);
    state.mission = missions.def();
    state.missionStageText = missions.stageText();
    state.missionStageFrac = missionStageFrac();
    const nextIdx = missions.current + 1;
    state.missionNextText = nextIdx < CONFIG.missions.length
      ? `NEXT: ${CONFIG.missions[nextIdx].id} — ${CONFIG.missions[nextIdx].name}`
      : 'NEXT: STORY COMPLETE';
    state.missionSpot = missions.started
      ? { x: missions.marker.position.x, z: missions.marker.position.z } : null;
    state.packagesCollected = state.packages.filter((p) => p.taken).length;

    // -- clock -----------------------------------------------------------------------
    if (!state.shotMode) {
      gameMinutes += dt * 0.5; // 1 game minute per 2 real seconds
      if (gameMinutes >= 1) {
        gameMinutes -= 1;
        state.clockMinutes += 1;
        if (state.clockMinutes >= 24 * 60) {
          state.clockMinutes -= 24 * 60;
          state.day += 1;
        }
        const hh = String(Math.floor(state.clockMinutes / 60)).padStart(2, '0');
        const mm = String(state.clockMinutes % 60).padStart(2, '0');
        state.clock = `${hh}:${mm}`;
      }
    }

    // -- busted -------------------------------------------------------------------------
    if (state.health <= 0) {
      state.health = 0;
      audio.busted();
      screen = 'busted';
      ui.busted.classList.remove('hidden');
      document.getElementById('busted-loss').textContent =
        `The MBPD took 10% of your cash — $${Math.floor(state.money * 0.1).toLocaleString('en-US')}.`;
    }

    // -- pause ----------------------------------------------------------------------------
    if (input.hit('KeyP') || input.hit('Escape')) {
      screen = 'paused';
      ui.pause.classList.remove('hidden');
      saveGame({ ...state, missionIndex: missions.current });
    }

    // -- camera ------------------------------------------------------------------------------
    const camYaw = state.inCar ? focusHeading : render.camState.yaw;
    const camOpts = G.camOverride
      ? { dist: G.camOverride.dist, height: G.camOverride.height, pitch: G.camOverride.pitch, yaw: camYaw, snap: shotStaged && frameCount < 4 }
      : { dist: state.inCar ? 10.5 : 8.5, height: state.inCar ? 3.9 : 2.8, pitch: render.camState.pitch, yaw: camYaw, snap: shotStaged && frameCount < 4 };
    render.updateCamera(new THREE.Vector3(focusPos.x, 1.2, focusPos.z), dt, camOpts);
    state.pos = focusPos;
    state.heading = focusHeading;

    // -- HUD (every other frame is enough) ----------------------------------------------------
    if (frameCount % 2 === 0) hud.update(state);
    input.endFrame();
  }

  render.renderer.render(scene, render.camera);

  // -- shot ready ------------------------------------------------------------------------------
  if (shotStaged && !window.__shotReady) {
    const elapsed = performance.now() - shotReadyAt;
    if ((frameCount >= 10 && elapsed > 900) || elapsed > 20000) {
      window.__shotReady = true;
    }
  }
}

// show the continue button only when a save exists
if (loadGame()) document.getElementById('btn-continue').classList.remove('hidden');
window.__game = { state, missions, police, player };
animate();
