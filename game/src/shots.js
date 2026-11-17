// The screenshot scenes behind ?shot=chase|drive|foot|mission. Each one resets
// the world from a fixed seed, scripts a short drive through the real rules
// (the same fixed steps the game itself runs), and frames the camera, so the
// frame is what a few seconds of real play look like — and the same seed
// always gives the same frame.

import { STEP } from './config.js';

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

function enterNearestCar(world, x, z, yaw) {
  let car = world.vehicles.nearestStealable(x, z, 60);
  if (!car) {
    car = world.vehicles.addCar(x, z, yaw || 0, 0xc23b2e, 'parked');
  }
  world.player.teleport(car.x, car.z + 2, car.yaw);
  world.vehicles.enterCar(car);
  return car;
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
  const car = world.vehicles.playerCar;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  world.renderer.fixed(
    { x: car.x + fx * 17 + fz * 5, y: 5.2, z: car.z + fz * 17 - fx * 5 },
    { x: car.x - fx * 14, y: 1.6, z: car.z - fz * 14 },
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
 * renderer, hud, audio, effects, reset(seed), step(dt, input) and camYaw.
 */
export function stageShot(name, world) {
  world.reset(1);
  world.hud.showScreen('play');
  if (name === 'chase') {
    // Wanted 3, two interceptors on the tail, the Marina job on the HUD.
    world.missions.setMission(3);
    world.police.addHeat(3);
    world.player.teleport(238, 140, Math.PI);
    enterNearestCar(world, 238, 140);
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
    frameCarReverse(world);
  } else if (name === 'drive') {
    // Cruising the coast road in traffic, first job on the HUD.
    world.missions.setMission(0);
    world.player.teleport(238, -120, 0);
    enterNearestCar(world, 238, -120);
    const car = world.vehicles.playerCar;
    car.x = 240;
    car.z = -120;
    car.yaw = 0;
    car.speed = 22;
    simulate(world, 4, () => driveInput(world, { x: 240, z: 280 }));
    frameCar(world, 12, 9, 4.0);
  } else if (name === 'foot') {
    // On foot on the pier at golden hour, pedestrians around, packages to find.
    world.missions.setMission(2);
    world.player.teleport(392, 40, Math.PI / 2);
    world.camYaw = Math.PI / 2;
    for (let i = 0; i < 6; i += 1) {
      world.peds.spawnOne(380 + i * 8, 34 + (i % 3) * 6);
    }
    simulate(world, 2.5, () => ({ x: 0, z: 0.3, run: false, jump: false }));
    framePlayer(world, Math.PI / 2, 8, 3.4);
  } else if (name === 'mission') {
    // The Meridian Job: holding the bank at 4 stars, gang inside, cops coming.
    world.missions.setMission(5);
    world.player.teleport(-10, 2, Math.PI * 0.75);
    world.camYaw = Math.PI * 0.75;
    simulate(world, 0.6, () => ({ x: 0, z: 0, run: false, jump: false }));
    // The walk into the bank trips the hold phase: heat, gang, alarm.
    simulate(world, 3.5, () => ({ x: 0, z: 0, run: false, jump: false }));
    framePlayer(world, Math.PI * 0.75, 9, 3.6);
  } else {
    // Unknown shot name: the title view of the city.
    world.missions.setMission(0);
    world.player.teleport(8, 128, Math.PI);
    world.renderer.fixed({ x: -60, y: 90, z: 220 }, { x: 0, y: 0, z: 0 });
  }
  world.renderer.draw();
}
