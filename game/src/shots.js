// Deterministic staged scenes for the four screenshots.
// ?shot=title|chase|dialog|progress&seed=1 sets money, day, time,
// wanted, mission, camera and traffic, then marks window.__shotReady
// once the frame has settled. The game itself keeps running behind
// the staged state, so every shot is a real render of the live game.

import { CONFIG } from './config.js';
import { applyTimeOfDay } from './render.js';
import { startMission } from './missions.js';
import { addWanted, spawnUnits } from './police.js';

function setClock(G, day, hour, minute) {
  G.clockMinutes = (day - 1) * 1440 + hour * 60 + minute;
}

function putPlayerInCar(G, modelName, x, z, heading, speed) {
  const car = G.cars.find((c) => c.model.name === modelName);
  if (!car) return null;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.traffic = false;
  car.condition = 92;
  const p = G.player;
  p.inCar = car;
  p.mesh.visible = false;
  p.x = x;
  p.z = z;
  G.rig.mode = 'chase';
  G.rig.yaw = heading;
  return car;
}

function stageTrafficOnRoad(G, roadX, zFrom, zTo, count) {
  let placed = 0;
  for (const car of G.cars) {
    if (placed >= count) break;
    if (car === G.player.inCar) continue;
    if (car.model.kind === 'police') continue;
    const z = zFrom + ((zTo - zFrom) * placed) / Math.max(1, count - 1);
    car.x = roadX + (placed % 2 === 0 ? -3.2 : 3.2);
    car.z = z;
    car.heading = placed % 2 === 0 ? 0 : Math.PI;
    car.speed = 9;
    car.traffic = true;
    placed++;
  }
}

function stagePedsNear(G, x, z, count, radius) {
  let placed = 0;
  for (const ped of G.peds) {
    if (placed >= count) break;
    const angle = (placed / count) * Math.PI * 2;
    ped.x = x + Math.cos(angle) * radius * (0.5 + (placed % 3) * 0.25);
    ped.z = z + Math.sin(angle) * radius * (0.5 + (placed % 3) * 0.25);
    ped.heading = angle + Math.PI;
    ped.idle = 30;
    placed++;
  }
}

export function applyShot(G, name) {
  G.shot = { name, frames: 0, ready: false };
  const p = G.player;

  if (name === 'title') {
    // Title screen over downtown at golden hour.
    G.money = 250;
    G.rep = 120;
    setClock(G, 1, 19, 4);
    G.radioIndex = 0;
    G.songIndex = 0;
    applyTimeOfDay(G.view, 'sunset', G.city);
    startMission(G, 0);
    p.x = 0;
    p.z = 60;
    p.mesh.position.set(p.x, 0, p.z);
    G.rig.mode = 'fixed';
    G.rig.fixedPos = { x: 55, y: 42, z: 130 };
    G.rig.fixedLook = { x: -10, y: 8, z: 0 };
    G.screen = 'title';
    G.hud.showScreen('screen-title');
    return;
  }

  if (name === 'chase') {
    // COVER: late-mission chase, M6, four stars, helicopter, $31,200.
    G.money = 31200;
    G.rep = 1840;
    setClock(G, 3, 18, 42);
    G.radioIndex = 0;
    G.songIndex = 1;
    applyTimeOfDay(G.view, 'sunset', G.city);
    startMission(G, 5);
    // Escape stage: the vault is ours and the chase is on — no
    // "Get back to the bank!" toast spamming the cover frame.
    G.missions.current.stage = 2;
    G.missions.current.holdLeft = 14;
    G.missions.current.stageLabel = 'STAGE 3/4';
    // The car starts on the hidden package at (120, 60) in other scenes:
    // mark it taken here so the cover money stays exactly $31,200.
    const pkg = G.missions.packages.find((p) => p.x === 120 && p.z === 60);
    if (pkg) {
      pkg.taken = true;
      pkg.mesh.visible = false;
    }
    const car = putPlayerInCar(G, 'Comet GT', 120, 0, 0, 41.4);
    // Bright red paint so the sports car reads against the asphalt.
    car.mesh.children[0].material.color.setHex(0xd83232);
    car.color = 0xd83232;
    G.shot.drive = () => {
      if (car) {
        car.speed = 41.4;
        car.heading = 0;
        car.x = 120;
      }
    };
    // Police: three cruisers converging ahead of the player, in frame
    // of the chase camera (which sits behind the car). All three are
    // spawned up front so every unit gets a staged spot. They are staged
    // far ahead: the units close at ~80 m/s relative to the player, so
    // a close stage would have them pass the car before the shot.
    addWanted(G, 4, 'Bank alarm');
    spawnUnits(G, 3);
    const units = G.police.units;
    const spots = [[120, 85, 'PURSUIT'], [110, 75, 'CLOSING IN'], [130, 95, 'CLOSING IN']];
    units.forEach((u, i) => {
      const s = spots[i % spots.length];
      u.x = s[0];
      u.z = s[1];
      u.heading = Math.PI;
      u.speed = 40;
      u.status = s[2];
    });
    G.police.heliActive = true;
    G.police.heli.visible = true;
    stageTrafficOnRoad(G, 120, -120, -40, 4);
    // Oncoming traffic in the opposite lane, ahead of the player.
    let oncoming = 0;
    for (const c of G.cars) {
      if (oncoming >= 2) break;
      if (c === G.player.inCar || c.model.kind === 'police' || !c.traffic) continue;
      c.x = 116.8;
      c.z = 110 + oncoming * 25;
      c.heading = Math.PI;
      c.speed = 9;
      oncoming++;
    }
    // Every other traffic car parks in the far west, out of frame: a
    // stray taxi once cut diagonally across the player's car and its
    // roof sign read as a yellow box on the Comet GT.
    let parked = 0;
    for (const c of G.cars) {
      if (c === G.player.inCar || c.model.kind === 'police' || !c.traffic) continue;
      if (Math.abs(c.x - 116.8) < 1 && c.z > 100) continue; // the oncoming pair
      if (c.z < -30 && Math.abs(c.x - 120) < 4) continue; // the staged rear pair
      c.traffic = false;
      c.speed = 0;
      c.x = -118 + (parked % 4) * 8;
      c.z = -118 + Math.floor(parked / 4) * 8;
      c.heading = 0;
      parked++;
    }
    // Peds on the east sidewalk, clear of the road, so the chase car
    // never clips one (a hit would add a fifth star).
    stagePedsNear(G, 134, 30, 6, 5);
    G.dialog.clear();
    G.dialog.show('inez', 'Four stars and Air One overhead — hold the line, Cassian, the vault is almost ours.', 60);
    G.screen = 'play';
    G.hud.hideScreens();
    return;
  }

  if (name === 'onfoot') {
    // On foot, M1 First Wheels: Cassian beside a parked car at dusk,
    // the gold beacon marking the Marina job in the distance.
    G.money = 250;
    G.rep = 120;
    setClock(G, 1, 19, 4);
    G.radioIndex = 0;
    G.songIndex = 0;
    applyTimeOfDay(G.view, 'sunset', G.city);
    startMission(G, 0);
    p.x = 0;
    p.z = 60;
    p.heading = Math.PI * 0.85;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.visible = true;
    // Park a stealable sedan right beside him.
    const sedan = G.cars.find((c) => c.model.kind === 'sedan' && !c.traffic);
    if (sedan) {
      sedan.x = 4;
      sedan.z = 64;
      sedan.heading = Math.PI;
      sedan.speed = 0;
    }
    G.rig.mode = 'follow';
    G.rig.yaw = Math.PI * 0.9;
    G.rig.distance = 9.5;
    stageTrafficOnRoad(G, 0, -60, 30, 3);
    stagePedsNear(G, 0, 60, 7, 12);
    G.dialog.clear();
    G.dialog.show('inez', 'First: get wheels. Any car on the street. Walk up and press E.', 60);
    G.screen = 'play';
    G.hud.hideScreens();
    return;
  }

  if (name === 'dialog') {
    // On foot at the bank, noon, fixer dialog, $4,850.
    G.money = 4850;
    G.rep = 640;
    setClock(G, 2, 11, 20);
    G.radioIndex = 1;
    G.songIndex = 0;
    applyTimeOfDay(G.view, 'noon', G.city);
    startMission(G, 5);
    p.x = -14;
    p.z = -8;
    p.heading = Math.PI * 0.15;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    G.rig.mode = 'follow';
    G.rig.yaw = Math.PI * 0.9;
    G.rig.distance = 8;
    addWanted(G, 4, 'Bank alarm');
    const units = G.police.units;
    if (units[0]) {
      units[0].x = -2;
      units[0].z = 18;
      units[0].heading = Math.PI;
      units[0].speed = 0;
    }
    stageTrafficOnRoad(G, 0, -60, 30, 4);
    stagePedsNear(G, -14, -8, 8, 12);
    G.dialog.clear();
    G.dialog.show('inez', 'The Harbor Kings keep a black van on the pier. Take it. Bring it to the hideout.', 60);
    G.screen = 'play';
    G.hud.hideScreens();
    return;
  }

  if (name === 'progress') {
    // Mission-passed screen, neon night, $18,450.
    G.money = 18450;
    G.rep = 980;
    setClock(G, 3, 23, 33);
    G.radioIndex = 2;
    G.songIndex = 2;
    applyTimeOfDay(G.view, 'night', G.city);
    G.missions.packagesFound = 6;
    // M4 just passed, so the current index still points at M4; the
    // HUD's NEXT line then correctly names M5: Pier Heist.
    G.missions.currentIndex = 3;
    G.missions.started = true;
    G.rig.mode = 'fixed';
    G.rig.fixedPos = { x: 60, y: 48, z: 120 };
    G.rig.fixedLook = { x: -10, y: 10, z: -10 };
    G.hud.showPassed({
      title: 'M4: Heat — PASSED',
      stars: 3,
      stats: 'Payout +$1,500 · Time 2:41 · Max wanted ★★★☆☆ · Packages 6/10',
      quote: 'Inez Kade: "You vanished like smoke. The pier van is next — the Harbor Kings won\'t miss it."',
      next: 'NEXT: M5: Pier Heist',
    });
    G.screen = 'passed';
    return;
  }

  // Unknown shot: fall back to plain play.
  G.screen = 'play';
  G.hud.hideScreens();
}

export function shotReady(G) {
  if (!G.shot || G.shot.ready) return;
  G.shot.frames++;
  if (G.shot.frames >= 150) {
    G.shot.ready = true;
    window.__shotReady = true;
  }
}
