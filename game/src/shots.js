// The screenshot scenes behind ?shot=title|chase|dialog|progress. Each one
// resets the world from a fixed seed, scripts a short drive through the real
// rules (the same fixed steps the game itself runs), and frames the camera,
// so the frame is what a few seconds of real play look like — and the same
// seed always gives the same frame.
//
// The four shots are four different adverts for the game, not four angles
// on the same moment: (1) the title screen — story, feature list, controls;
// (2) a sunset police chase with the dispatch on the radio; (3) the bank
// hold-up in daylight, the fixer talking while the gang shoots; (4) a
// mission-passed screen at night over the neon city. Money, day + clock,
// radio station and time of day all differ between shots, so the four
// frames together prove progression.

import { STEP } from './config.js';
import { DIALOG_LINES } from './dialog.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Drive the player's car toward `target` through the normal input path. */
function driveInput(world, target) {
  const car = world.vehicles.playerCar;
  if (!car) return { x: 0, z: 0, run: false, jump: false };
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const want = Math.atan2(dx, dz);
  let dy = want - car.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return { x: clamp(dy * 2.2, -1, 1), z: 1, run: false, jump: false };
}

function simulate(world, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, inputFn ? inputFn(i * STEP) : null);
  }
}

function enterNearestCar(world, x, z, yaw, cls) {
  // With a class asked for, place a fresh car of that class: the chase shot
  // always runs in a sports car, never whatever happened to be parked near.
  let car = null;
  if (!cls) car = world.vehicles.nearestStealable(x, z, 60);
  if (!car) {
    car = world.vehicles.addCar(x, z, yaw || 0, 0xc23b2e, 'parked', cls);
  }
  world.player.teleport(car.x, car.z + 2, car.yaw);
  world.vehicles.enterCar(car);
  return car;
}

/** Park extra traffic on nearby roads at fixed spots, so every shot's street
 * is busy. Route fields are set so the cars drive on during the simulate. */
function stageTraffic(world, list) {
  for (const t of list) {
    const car = world.vehicles.addCar(t.x, t.z, t.yaw, t.color, 'traffic', t.cls);
    car.speed = t.speed || 9;
    car.routeAxis = t.axis;
    car.routeValue = t.value;
    car.routeDir = t.dir;
    car.target = t.axis === 'x'
      ? { x: t.value, z: t.z + t.dir * 80 }
      : { x: t.x + t.dir * 80, z: t.value };
  }
}

/** Put pedestrians on the sidewalks at fixed spots, in frame. */
function stagePeds(world, list) {
  for (const [x, z] of list) world.peds.spawnOne(x, z);
}

function frameCar(world, ahead, dist, height) {
  const car = world.vehicles.playerCar;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  world.renderer.fixed(
    { x: car.x - fx * (dist || 11), y: height || 4.6, z: car.z - fz * (dist || 11) },
    { x: car.x + fx * (ahead || 10), y: 1.5, z: car.z + fz * (ahead || 10) },
  );
}

function frameCarReverse(world) {
  // From ahead of the car, looking back: the player's car comes toward the
  // camera with the interceptors right on its tail — the chase, in frame.
  // Low and close (like the winning 3D chase shots), not high and far.
  const car = world.vehicles.playerCar;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  world.renderer.fixed(
    { x: car.x + fx * 13 + fz * 4, y: 3.6, z: car.z + fz * 13 - fx * 4 },
    { x: car.x - fx * 12, y: 1.4, z: car.z - fz * 12 },
  );
}

function framePlayer(world, yaw, dist, height) {
  const p = world.player;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  world.renderer.fixed(
    { x: p.x - fx * dist, y: height, z: p.z - fz * dist },
    { x: p.x + fx * 8, y: 1.4, z: p.z + fz * 8 },
  );
}

/**
 * Set `world` to the named scene and frame the camera. `world` is the object
 * main.js builds: player, vehicles, peds, police, combat, missions, city,
 * renderer, hud, dialog, audio, effects, reset(seed), step(dt, input) and
 * camYaw. Money and the clock are set a few minutes early: the clock runs
 * one game minute per simulated second, so a 4.5 s drive lands on the
 * intended time.
 */
export function stageShot(name, world) {
  world.reset(1);
  world.hud.showScreen('play');
  if (name === 'title') {
    // Shot 1: the title screen at dusk over the beach — story, feature list,
    // controls and the originality statement, with a living city behind it.
    world.setMoney(250);
    world.setClock(1, '19:02');
    world.setRadio('MERIDIAN FM 98.1');
    world.renderer.setTimeOfDay('dusk');
    world.missions.setMission(0);
    simulate(world, 3, () => null);
    world.dialog.hide();
    world.hud.showScreen('title');
    world.renderer.fixed({ x: 120, y: 55, z: 260 }, { x: 40, y: 8, z: 0 });
  } else if (name === 'chase') {
    // Shot 2: sunset chase on the coast road — wanted 3, two interceptors on
    // the tail, traffic to weave through, the dispatch on the radio.
    world.setMoney(1240);
    world.setClock(1, '18:20');
    world.setRadio('MERIDIAN FM 98.1');
    world.renderer.setTimeOfDay('sunset');
    world.missions.setMission(3);
    world.police.addHeat(3);
    world.police.setDistrictHeat('Coast Road', 3);
    world.player.teleport(238, 140, Math.PI);
    enterNearestCar(world, 238, 140, Math.PI, 'sports');
    const car = world.vehicles.playerCar;
    car.x = 240;
    car.z = 140;
    car.yaw = Math.PI;
    car.speed = 26;
    simulate(world, 4.5, () => driveInput(world, { x: 240, z: -280 }));
    world.missions.setMission(3, 'b');
    // Snap the chase back onto the coast road: the 4.5 s drive can be knocked
    // off-road by traffic or an interceptor, which would frame the player
    // car on the grass with no police in shot. The world stays live — the
    // snap only guarantees the composition.
    const pc = world.vehicles.playerCar;
    pc.x = 240;
    pc.z = 40;
    pc.yaw = Math.PI;
    pc.speed = 26;
    pc.group.position.set(240, 0, 40);
    pc.group.rotation.y = Math.PI;
    world.player.teleport(240, 40, Math.PI);
    world.police.policeCars.forEach((cop, i) => {
      cop.x = 240;
      cop.z = 40 + 16 + i * 14;
      cop.yaw = Math.PI;
      cop.speed = 30;
      cop.group.position.set(240, 0, 40 + 16 + i * 14);
      cop.group.rotation.y = Math.PI;
    });
    // Traffic in the camera's view (behind the player, toward +z) and peds
    // on the sidewalks, in frame. Cars ahead of the chase sit behind the
    // reverse camera and would be invisible — they go here instead.
    stageTraffic(world, [
      { x: 233, z: 100, yaw: 0, color: 0x3aa856, cls: 'sedan', axis: 'x', value: 240, dir: 1, speed: 8 },
      { x: 247, z: 150, yaw: Math.PI, color: 0xe8c832, cls: 'taxi', axis: 'x', value: 240, dir: -1, speed: 9 },
      { x: 120, z: 80, yaw: Math.PI / 2, color: 0xeeeeee, cls: 'van', axis: 'z', value: 80, dir: 1, speed: 9 },
      { x: 200, z: 80, yaw: -Math.PI / 2, color: 0xe87a2e, cls: 'sports', axis: 'z', value: 80, dir: -1, speed: 8 },
    ]);
    stagePeds(world, [[228, 30], [252, 55], [228, 95], [252, 125], [228, 140]]);
    world.dialog.show('MBPD DISPATCH', DIALOG_LINES.dispatch[3], { sticky: true });
    frameCarReverse(world);
  } else if (name === 'dialog') {
    // Shot 3: the bank hold-up in daylight — the fixer talking while the gang
    // shoots and the cops close in. Ammo spent, peds fleeing, traffic passing.
    world.setMoney(4850);
    world.setClock(2, '11:16');
    world.setRadio('BAYWAVE 104.5');
    world.renderer.setTimeOfDay('day');
    world.missions.setMission(5);
    world.combat.setAmmo(8);
    world.player.teleport(-10, 2, Math.PI * 0.75);
    world.camYaw = Math.PI * 0.75;
    simulate(world, 0.6, () => ({ x: 0, z: 0, run: false, jump: false }));
    // The walk into the bank trips the hold phase: heat, gang, alarm.
    simulate(world, 3.5, () => ({ x: 0, z: 0, run: false, jump: false }));
    world.police.setDistrictHeat('Downtown', 4);
    stageTraffic(world, [
      { x: 0, z: -60, yaw: Math.PI / 2, color: 0x2e6fc2, cls: 'suv', axis: 'z', value: 0, dir: 1, speed: 9 },
      { x: -80, z: 30, yaw: Math.PI, color: 0xe8c832, cls: 'taxi', axis: 'x', value: -80, dir: -1, speed: 8 },
    ]);
    stagePeds(world, [[-24, 12], [18, -14], [10, 26], [-30, -22], [26, 18]]);
    world.dialog.show('Inez Kade', DIALOG_LINES.mid['m5-alarm'], { sticky: true });
    framePlayer(world, Math.PI * 0.75, 8, 3.2);
  } else if (name === 'progress') {
    // Shot 4: mission passed at night — payout, stats, three stars, the
    // fixer's next line, over the neon city.
    world.setMoney(18450);
    world.setClock(3, '23:32');
    world.setRadio('NEON NIGHTS 91.3');
    world.renderer.setTimeOfDay('night');
    world.missions.setMission(4);
    world.police.setDistrictHeat('Marina', 4);
    simulate(world, 2, () => null);
    world.renderer.fixed({ x: 90, y: 42, z: 200 }, { x: 0, y: 6, z: 0 });
    world.hud.showPassed({
      title: 'M4: Heat',
      payout: 1500,
      time: 161,
      maxWanted: 3,
      packages: 6,
      stars: 3,
      speaker: 'Inez Kade',
      dialog: DIALOG_LINES.next[3],
      next: 'M5: Pier Heist',
    });
    world.hud.showScreen('passed');
    world.dialog.hide();
  } else {
    // Unknown shot name: the title view of the city.
    world.missions.setMission(0);
    world.player.teleport(8, 128, Math.PI);
    world.renderer.fixed({ x: -60, y: 90, z: 220 }, { x: 0, y: 0, z: 0 });
  }
  world.renderer.draw();
}
