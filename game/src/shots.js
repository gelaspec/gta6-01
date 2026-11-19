// Deterministic screenshot states. Each shot pins the whole game down —
// money, day and time, wanted level, mission panel, dialog, positions of
// the hero car, police units and traffic, the camera and the time of day —
// then freezes the world so the frame is identical every time it renders.
//
// The money progression across the four shots is $250 -> $4,850 -> $18,450
// (cover $31,200), exactly as the top-20 covers do it.

import { CFG } from './config.js';

function setDisplay(game, d) {
  game.shotDisplay = d;
}

function placeCar(game, car, x, z, heading, speed) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed || 0;
  car.syncMesh();
}

function placeUnit(game, unit, x, z) {
  unit.pos.set(x, 0, z);
  unit.mesh.position.set(x, 0, z);
  unit.mesh.rotation.y = Math.atan2(game.player.pos.x - x, game.player.pos.z - z);
}

export function applyShot(game, id) {
  const P = game.player;
  const M = game.missions;
  const police = game.police;
  const city = game.city;

  // A clean slate: no stray wanted level, no banner, heli parked.
  police.setWanted(0);
  police.heli.active = false;
  police.heli.mesh.visible = false;
  game.hud.hidePassed();
  game.hud.hideDialog();

  if (id === 'chase') {
    // COVER — M6 late-mission chase at golden hour.
    const m6 = CFG.missions[5];
    M.state.index = 5;
    M.state.stageIdx = 2;
    M.state.stages = [
      { type: 'goto', point: { x: 36, z: 108 }, radius: 10, label: 'Break through the Downtown cordon' },
      { type: 'goto', point: { x: 180, z: 36 }, radius: 10, label: 'Coast road — keep moving' },
      { type: 'goto', point: { x: 240, z: -36 }, radius: 10, label: 'Almost there — the Marina' },
      { type: 'goto', point: { x: 390, z: 0 }, radius: 10, label: 'Escape to the Marina boat' },
    ];
    setDisplay(game, {
      money: 31200, day: 6, hour: 18, minute: 43, rep: 78,
      mission: m6, stageText: 'STAGE 3/4', nextText: 'NEXT: Escape to the Marina boat',
    });
    // Hero car eastbound on the coast road, 149 km/h.
    P.enterCar(game.heroCar);
    P.pos.set(150, 0, -36);
    placeCar(game, game.heroCar, 150, -36, Math.PI / 2, 149 / 3.6);
    game.heroCar.condition = 82;
    // Four patrol cars + the helicopter = five units on the panel.
    police.setWanted(3);
    const cars = police.units;
    placeUnit(game, cars[0], 168, -30); // ~19 m, PURSUIT
    placeUnit(game, cars[1], 140, -44); // ~15 m, PURSUIT
    placeUnit(game, cars[2], 196, -28); // ~47 m, CLOSING IN
    placeUnit(game, cars[3], 210, -42); // ~62 m, CLOSING IN
    police.wanted = 4;
    police.heat = true;
    police.heli.active = true;
    police.heli.mesh.visible = true;
    police.heli.pos.set(185, 26, -58);
    police.heli.mesh.position.copy(police.heli.pos);
    // Traffic ahead for depth: a green car and a taxi on the same road.
    const t = game.traffic.cars;
    if (t[0]) placeCar(game, t[0], 205, -36, Math.PI / 2, 11);
    if (t[1]) placeCar(game, t[1], 232, -28, Math.PI / 2, 9);
    if (t[2]) placeCar(game, t[2], 175, -44, Math.PI / 2, 12);
    game.dialog.show('Inez Kade', 'FIXER', '#ff2e88', 'Four stars and a helicopter, Cassian — lose them on the coast road and meet the boat at the Marina.', 999);
    game.setTimeOfDay(18.72);
    // Low on the coast road behind the hero car, looking east: the pink
    // COMET GT fills the lower centre, patrol cars ahead, heli top-right.
    game.shotCam = { pos: [128, 5.5, -36], look: [185, 2, -36] };
    game.frozen = true;
  } else if (id === 'foot') {
    // ON FOOT — M1, day one, on the pier.
    const m1 = CFG.missions[0];
    M.state.index = 0;
    M.state.stageIdx = 0;
    M.state.stages = [
      { type: 'steal', label: 'Steal a car (press E near one)' },
      { type: 'goto', point: { x: 200, z: -36 }, radius: 10, label: 'Drive to the Marina marker' },
    ];
    setDisplay(game, {
      money: 250, day: 1, hour: 9, minute: 15, rep: 0,
      mission: m1, stageText: 'STAGE 1/2', nextText: 'NEXT: Drive to the Marina marker',
    });
    P.place(310, 2, Math.PI * 0.9);
    placeCar(game, game.heroCar, 288, 8, Math.PI / 2, 0);
    game.heroCar.condition = 100;
    const t = game.traffic.cars;
    if (t[0]) placeCar(game, t[0], 200, -36, Math.PI / 2, 10);
    if (t[1]) placeCar(game, t[1], 236, -28, Math.PI / 2, 8);
    game.dialog.show('Inez Kade', 'FIXER', '#ff2e88', 'Cassian, you are back in Meridian Bay with nothing but a bus ticket. Steal a car and bring it to the Marina.', 999);
    game.setTimeOfDay(9.25);
    game.shotCam = { pos: [346, 7.5, -20], look: [296, 1.2, 2] };
    game.frozen = true;
  } else if (id === 'dialog') {
    // DIALOG — M3 brief in Calle Verde, one star, pink car in frame.
    const m3 = CFG.missions[2];
    M.state.index = 2;
    M.state.stageIdx = 0;
    M.state.stages = [
      { type: 'collect', points: [{ x: -60, z: 150 }, { x: -108, z: 200 }, { x: -20, z: 120 }], radius: 6, label: 'Collect the drops in Calle Verde (0/3)' },
    ];
    setDisplay(game, {
      money: 4850, day: 3, hour: 17, minute: 20, rep: 31,
      mission: m3, stageText: 'STAGE 1/1', nextText: 'NEXT: Finish the job',
    });
    P.place(-40, 150, Math.PI * 0.15);
    placeCar(game, game.heroCar, -30, 132, Math.PI / 2, 0);
    const t = game.traffic.cars;
    if (t[0]) placeCar(game, t[0], -30, 144, Math.PI / 2, 0);
    if (t[1]) placeCar(game, t[1], -64, 158, 0, 0);
    police.setWanted(1);
    const cars = police.units;
    placeUnit(game, cars[0], -34, 141); // ~15 m, PURSUIT
    placeUnit(game, cars[1], -38, 155); // ~6 m, RAMMING
    game.dialog.show('Inez Kade', 'FIXER', '#ff2e88', 'Three drops are hidden around Calle Verde. Collect them all and stay off the MBPD radar. The money is good and the risk is honest.', 999);
    game.setTimeOfDay(17.33);
    game.shotCam = { pos: [-78, 13, 116], look: [-38, 1.5, 152] };
    game.frozen = true;
  } else if (id === 'progress') {
    // MISSION PASSED — M4 Heat passed at neon night, M5 panel behind it.
    const m5 = CFG.missions[4];
    M.state.index = 4;
    M.state.stageIdx = 0;
    M.state.stages = [
      { type: 'ram', hits: 3, label: 'Ram the security van on the pier' },
      { type: 'goto', point: { x: 200, z: -36 }, radius: 10, label: 'Take the case to the Marina' },
    ];
    setDisplay(game, {
      money: 18450, day: 4, hour: 22, minute: 6, rep: 52,
      mission: m5, stageText: 'STAGE 1/3', nextText: 'NEXT: Ram the security van',
    });
    P.enterCar(game.heroCar);
    P.pos.set(330, 0, 0);
    placeCar(game, game.heroCar, 330, 0, Math.PI / 2, 0);
    game.heroCar.condition = 88;
    if (game.van) placeCar(game, game.van, 348, 4, Math.PI / 2, 0);
    const t = game.traffic.cars;
    if (t[0]) placeCar(game, t[0], 300, -6, Math.PI / 2, 8);
    game.hud.showPassed('CHAPTER 4 — HEAT PASSED', 13600, 'TIME 04:12 • DAMAGE 12% • PACKAGES 2/10 • TOP SPEED 164 KM/H');
    game.dialog.show('Inez Kade', 'FIXER', '#ff2e88', 'Clean work, Cassian. Thirteen thousand six hundred is yours — and the MBPD never even saw your face.', 999);
    game.setTimeOfDay(22.1);
    // High over the pier's south edge looking down the deck: the hero car
    // sits well below the passed banner, the security van right of it —
    // neither is hidden behind the banner.
    game.shotCam = { pos: [316, 14, 14], look: [338, 0, -2] };
    game.frozen = true;
  }

  // The dialog timer would hide the box after a few seconds; in a frozen
  // shot it must stay up, so pin its timer via the HUD directly.
  game.shotId = id;
  game.settleFrames = 0;
}

export const SHOT_IDS = ['chase', 'foot', 'dialog', 'progress'];
