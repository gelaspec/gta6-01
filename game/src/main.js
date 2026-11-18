// Meridian Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted and story complete. ?shot=chase|drive|
// foot|mission (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.

import { PROTAGONIST, RADIO_STATIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity, districtAt } from './city.js';
import { createRenderer } from './render.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { DIALOG_LINES, createDialog } from './dialog.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String((event && event.message) || event));
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const render = createRenderer(canvas);
const city = buildCity(render.scene, rng);
const input = createInput(canvas);
const player = createPlayer(render.scene);
const vehicles = createVehicles(render.scene, city, rng);
const peds = createPedestrians(render.scene, city, rng);
const police = createPolice(render.scene, city, vehicles, rng);
const effects = createEffects(render.scene);
const audio = createAudio();
const dialog = createDialog();
const combat = createCombat(render.scene, city, rng, effects, audio, (n) => police.addHeat(n));
const hud = createHud(city);
const save = loadSave();

let money = save.money;
let screen = 'title';
let camYaw = Math.PI;
let camPitch = 0.32;
let camFar = false;
let mouseIdle = 0;
let completeShown = false;
let simulating = false;
// The city clock runs one game minute per real second; the radio station
// rotates every 90 seconds of play. Shots set both directly.
let clockDay = 1;
let clockMin = 18 * 60 + 24; // DAY 1 18:24 — golden hour over the bay
let radio = RADIO_STATIONS[0];
let radioTimer = 0;
let lastWanted = 0;

function effectivePos() {
  const car = vehicles.playerCar;
  if (car) return { x: car.x, z: car.z, yaw: car.yaw };
  return { x: player.x, z: player.z, yaw: player.yaw };
}

function addMoney(amount) {
  money += amount;
}

function saveProgress() {
  writeSave({ money, mission: missions.index, packages: missions.foundPackageIds() });
}

const missions = createMissions(render.scene, city, rng, {
  playerPos: effectivePos,
  vehicles,
  police,
  combat,
  hud,
  audio,
  dialog,
  addMoney,
  saveProgress,
  onMissionPassed(stats) {
    screen = 'passed';
    hud.showPassed(stats);
    hud.showScreen('passed');
    announce(`${stats.title} passed. Press Enter to continue.`);
  },
});
missions.applySave(save);
hud.setTitleStats(money, save.mission);
hud.setObjective(missions.index >= 6 ? 'Free Roam' : `M${missions.index + 1}: ${['First Wheels', 'Courier Run', 'The Pickup', 'Heat', 'Pier Heist', 'The Meridian Job'][missions.index]}`, missions.objective);

function announce(message) {
  status.textContent = message;
}

function startGame() {
  screen = 'play';
  hud.showScreen('play');
  audio.ensure();
  audio.start();
  announce(`Playing. ${PROTAGONIST}, Meridian Bay.`);
  missions.showBriefing();
}

function resetAfterBusted() {
  player.health = 100;
  player.teleport(city.spawn.x, city.spawn.z, Math.PI);
  police.reset();
  combat.clearEnemies();
  vehicles.reset();
  camYaw = Math.PI;
  camPitch = 0.32;
  screen = 'play';
  hud.showScreen('play');
  announce('Back on the streets.');
}

function realInput() {
  return {
    move: input.move(),
    run: input.run(),
    jump: input.jumpHeld(),
    fire: input.takeFire(),
    actions: input.takeActions(),
  };
}

function fakeInput(scripted) {
  const move = scripted || { x: 0, z: 0, run: false, jump: false };
  return {
    move: { x: move.x || 0, z: move.z || 0 },
    run: !!move.run,
    jump: !!move.jump,
    fire: !!move.fire,
    actions: 0,
  };
}

function stepGame(dt, inp) {
  const actions = inp.actions || 0;
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound off' : 'Sound on');
  }
  if (screen === 'title') {
    if (actions & ACTION_CONFIRM) {
      startGame();
      return;
    }
    // Ambient city behind the title: traffic and pedestrians keep moving.
    const dummy = { move: () => ({ x: 0, z: 0 }), handbrake: () => false };
    vehicles.update(dt, dummy, player);
    peds.update(dt, null);
    effects.update(dt);
    const t = performance.now() / 1000;
    render.fixed(
      { x: Math.sin(t * 0.03) * 260, y: 95, z: Math.cos(t * 0.03) * 260 },
      { x: 0, y: 10, z: 0 },
    );
    if (!simulating) render.draw();
    return;
  }
  if (screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = 'play';
      hud.showScreen('play');
    }
    if (!simulating) render.draw();
    return;
  }
  if (screen === 'passed') {
    if (actions & ACTION_CONFIRM) {
      screen = 'play';
      hud.showScreen('play');
      missions.showBriefing();
    }
    if (!simulating) render.draw();
    return;
  }
  if (screen === 'busted' || screen === 'complete') {
    if (actions & ACTION_CONFIRM) {
      if (screen === 'busted') resetAfterBusted();
      else {
        screen = 'play';
        hud.showScreen('play');
      }
    }
    if (!simulating) render.draw();
    return;
  }

  // --- Playing. ---
  if (actions & ACTION_PAUSE) {
    screen = 'pause';
    hud.showScreen('pause');
    announce('Paused.');
    return;
  }
  if (actions & ACTION_CAMERA) camFar = !camFar;

  const mouse = input.takeMouse();
  if (mouse.dx !== 0 || mouse.dy !== 0) {
    camYaw -= mouse.dx * 0.0032;
    camPitch = Math.max(-0.05, Math.min(1.1, camPitch + mouse.dy * 0.0022));
    mouseIdle = 0;
  } else {
    mouseIdle += dt;
  }

  const car = vehicles.playerCar;
  const inCar = !!car;
  const move = inp.move;

  if (actions & ACTION_ENTER) {
    if (inCar) {
      const left = vehicles.exitCar();
      player.teleport(left.x - Math.cos(left.yaw) * 3, left.z + Math.sin(left.yaw) * 3, left.yaw);
      player.group.visible = true;
      hud.setHint('');
    } else {
      const near = vehicles.nearestStealable(player.x, player.z, 3.5);
      if (near) {
        vehicles.enterCar(near);
        player.group.visible = false;
        police.addHeat(1);
        hud.toast('Car stolen — the law noticed. ★');
        audio.pickup();
      }
    }
  }
  if (!inCar && (actions & ACTION_PUNCH)) {
    player.punch();
    combat.punch(player, peds);
  }
  if (inp.fire) {
    if (inCar) {
      // Drive-by: the pistol fires from the car window.
      combat.shoot(render.camera, effectivePos());
    } else {
      combat.shoot(render.camera, effectivePos());
    }
  }

  if (inCar) {
    const eff = effectivePos();
    // Ease the camera behind the car unless the mouse steered it lately.
    if (mouseIdle > 1.2) {
      let dy = car.yaw - camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      camYaw += dy * Math.min(1, dt * 1.4);
    }
    void eff;
  } else {
    player.update(dt, { x: move.x, z: move.z, run: inp.run, jump: inp.jump }, camYaw, city);
  }

  const driveInput = {
    move: () => ({ x: move.x, z: move.z }),
    handbrake: () => inp.jump,
  };
  vehicles.update(dt, driveInput, player);

  // The player car ploughing through pedestrians is a crime.
  if (vehicles.playerCar) {
    const pc = vehicles.playerCar;
    for (const ped of peds.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - pc.x, ped.z - pc.z) < 2.6 && Math.abs(pc.speed) > 6) {
        peds.knockDown(ped);
        police.addHeat(1);
        effects.burst({ x: ped.x, y: 1, z: ped.z }, 0xc23b2e, 10, 4);
        render.shake(0.5);
        hud.toast('Pedestrian hit — ★ wanted level up');
      }
    }
  } else {
    // Traffic can run the player down on foot.
    for (const c of vehicles.cars) {
      if (c.kind !== 'traffic') continue;
      if (Math.hypot(c.x - player.x, c.z - player.z) < 1.8 && Math.abs(c.speed) > 4) {
        if (player.takeDamage(12)) {
          player.x += (player.x - c.x) * 0.6;
          player.z += (player.z - c.z) * 0.6;
          render.shake(0.6);
          hud.toast('Hit by traffic!');
        }
      }
    }
  }

  const danger = vehicles.playerCar
    ? { x: vehicles.playerCar.x, z: vehicles.playerCar.z, speed: vehicles.playerCar.speed }
    : null;
  peds.update(dt, danger);
  const speedNow = inCar ? Math.abs(car.speed) : player.speed;
  police.update(dt, effectivePos(), inCar, speedNow);
  // Police radio: the dispatch calls the chase as the stars climb.
  if (police.wanted > lastWanted && police.wanted >= 1) {
    dialog.show('MBPD DISPATCH', DIALOG_LINES.dispatch[police.wanted] || DIALOG_LINES.dispatch[2]);
  }
  lastWanted = police.wanted;
  combat.update(dt, effectivePos(), player);
  missions.update(dt);
  effects.update(dt);
  audio.update(dt, inCar ? car.speed : player.speed, police.wanted);
  // The city clock runs one game minute per real second; the radio station
  // rotates every 90 seconds of play.
  clockMin += dt;
  if (clockMin >= 1440) {
    clockMin -= 1440;
    clockDay += 1;
  }
  radioTimer += dt;
  if (radioTimer > 90) {
    radioTimer = 0;
    radio = RADIO_STATIONS[(RADIO_STATIONS.indexOf(radio) + 1) % RADIO_STATIONS.length];
  }

  // Tire smoke when the car slides.
  if (inCar && Math.abs(car.speed) > 12 && Math.abs(car.steer) > 0.35) {
    effects.smoke({ x: car.x - Math.sin(car.yaw) * 1.8, y: 0.2, z: car.z - Math.cos(car.yaw) * 1.8 });
  }

  // Camera.
  const focus = effectivePos();
  if (inCar) {
    render.follow(dt, { x: focus.x, z: focus.z, y: 0 }, camYaw, camPitch * 0.7 + 0.12, camFar ? 14 : 10.5, 3.4);
  } else {
    render.follow(dt, { x: focus.x, z: focus.z, y: player.y }, camYaw, camPitch, camFar ? 10 : 7.5, 2.2);
  }

  // HUD.
  const near = !inCar ? vehicles.nearestStealable(player.x, player.z, 3.5) : null;
  hud.setHint(near ? 'Press E to steal the car' : inCar ? 'E exit  •  Space handbrake  •  C camera' : '');
  const district = districtAt(focus.x, focus.z);
  hud.update(
    {
      money,
      health: player.health,
      wanted: police.wanted,
      speed: inCar ? car.speed : 0,
      inCar,
      aiming: !inCar,
      ammo: combat.ammo,
      ammoMax: combat.ammoMax,
      carName: inCar ? car.name : '',
      carClass: inCar ? car.clsLabel : '',
      gear: inCar ? (car.speed < -0.5 ? 'R' : 1 + Math.min(4, Math.floor(Math.abs(car.speed) / 9))) : 1,
      clock: `DAY ${clockDay} ${String(Math.floor(clockMin / 60)).padStart(2, '0')}:${String(Math.floor(clockMin % 60)).padStart(2, '0')}`,
      district,
      districtHeat: police.heatFor(district),
      radio,
      playerX: focus.x,
      playerZ: focus.z,
      playerYaw: focus.yaw,
      waypoint: missions.waypoint,
      policeCars: police.policeCars,
      packages: missions.packagePositions(),
    },
    performance.now(),
  );

  if (police.busted) {
    screen = 'busted';
    hud.setEndTitle('BUSTED');
    hud.showScreen('busted');
    announce('Busted by the Meridian Bay PD. Press Enter to get back out.');
    saveProgress();
  } else if (player.health <= 0) {
    screen = 'busted';
    hud.setEndTitle('WASTED');
    hud.showScreen('busted');
    announce('Wasted. Press Enter to get back out.');
    saveProgress();
  } else if (missions.index >= 6 && !completeShown) {
    completeShown = true;
    screen = 'complete';
    hud.setCompleteStats(money, missions.packagesFound);
    hud.showScreen('complete');
    announce('Story complete — The Meridian Job.');
    saveProgress();
  }

  if (!simulating) render.draw();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!frame.last) frame.last = now;
  let accumulator = Math.min((now - frame.last) / 1000, MAX_FRAME);
  frame.last = now;
  const inp = realInput();
  while (accumulator >= STEP) {
    stepGame(STEP, inp);
    accumulator -= STEP;
    // One-shot presses belong to the first step of the frame only.
    inp.actions = 0;
    inp.fire = false;
  }
}

const world = {
  player,
  vehicles,
  peds,
  police,
  combat,
  missions,
  city,
  renderer: render,
  hud,
  dialog,
  audio,
  effects,
  setMoney(value) {
    money = value;
  },
  setClock(day, time) {
    const [h, m] = time.split(':').map(Number);
    clockDay = day;
    clockMin = h * 60 + m;
  },
  setRadio(name) {
    radio = name;
  },
  get camYaw() {
    return camYaw;
  },
  set camYaw(value) {
    camYaw = value;
  },
  reset() {
    player.health = 100;
    player.teleport(city.spawn.x, city.spawn.z, Math.PI);
    player.group.visible = true;
    police.reset();
    combat.clearEnemies();
    combat.setAmmo(combat.ammoMax);
    vehicles.reset();
    missions.reset();
    dialog.hide();
    lastWanted = 0;
    camYaw = Math.PI;
    camPitch = 0.32;
    screen = 'play';
    hud.showScreen('play');
  },
  step(dt, scripted) {
    simulating = true;
    try {
      stepGame(dt, fakeInput(scripted));
    } finally {
      simulating = false;
    }
  },
};

// Debug/probe handle (also lets the shot tooling inspect the staged scene).
window.__game = world;

if (shot) {
  hud.showScreen('play');
  stageShot(shot, world);
  let painted = 0;
  function paint() {
    render.draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  hud.showScreen('title');
  announce('Meridian Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}
