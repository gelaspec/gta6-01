// Meridian Bay — deterministic screenshot staging (?shot=chase|foot|dialog|mission).
// Each shot sets money, day, clock, mission, wanted, positions and dialog so
// the four dossier frames are stable and readable. No randomness here.
import { CONFIG } from './config.js';
import { createCar, CAR_CLASSES } from './vehicles.js';

const SHOT_DEFS = {
  chase: { file: '1-chase.jpg', label: 'M6 chase cover' },
  foot: { file: '2-onfoot.jpg', label: 'M1 on foot' },
  dialog: { file: '3-dialog.jpg', label: 'M5 pier brief' },
  mission: { file: '4-progress.jpg', label: 'M4 passed' },
};

export function applyShot(G, name) {
  const s = G.state;
  if (!SHOT_DEFS[name]) return false;
  // reset the world to a clean staged state
  G.police.setWanted(0);
  G.combat.clearGunmen();
  G.dialog.hide();
  G.ui.hideAllOverlays();
  s.dispatchLine = '';
  s.shotMode = true;

  if (name === 'chase') {
    // -- COVER: M6 "The Meridian Job" late-mission chase, golden hour --------
    G.render.setTimeOfDay('golden');
    s.money = 31200;
    s.day = 3;
    s.clock = '18:42';
    s.rep = 1840;
    G.missions.startMission(5);
    G.missions.stageForShot(2, 0);
    // player in the hot-pink Comet GT, east on Harbor Blvd (z = 22)
    const car = createCar(G.scene, 5, CONFIG.palette.pinkCar, 0, 22, Math.PI / 2);
    G.enterCar(car, 149 / 3.6);
    car.speed = 149 / 3.6; // 149 km/h
    s.carCondition = 92;
    // police formation AHEAD (roadblock): negative `back` = ahead of the
    // player, facing back toward him — all four stay in front of the camera
    G.police.setWanted(4);
    G.police.stageFormation(
      { x: 0, z: 22 }, Math.PI / 2,
      [
        { back: -24, side: -3.6, face: 'toward' },
        { back: -31, side: 4.2, face: 'toward' },
        { back: -40, side: -4.8, face: 'toward' },
        { back: -52, side: 3.4, face: 'toward' },
      ],
    );
    // police formation AHEAD of the player (roadblock composition): the chase
    // camera sits behind the player, so units behind it would be out of frame
    const t1 = createCar(G.scene, 0, 0xd8d3c8, 88, 22, Math.PI / 2);
    t1.speed = 30;
    const t2 = createCar(G.scene, 1, 0x3a7bd5, 115, 22, Math.PI / 2);
    t2.speed = 28;
    const t3 = createCar(G.scene, 2, 0x8a94a0, 66, 15.5, -Math.PI / 2);
    t3.speed = 24;
    G.stagedCars = [car, t1, t2, t3];
    G.freezeTraffic = true;
    G.camOverride = { dist: 9.5, height: 2.7, pitch: 0.14 };
    G.dialog.showNow(
      'Inez Kade', 'FIXER',
      'Stay on the bridge, Cassian — the whole city is coming for you. Do NOT stop.',
      30,
    );
    s.dispatchLine = 'DISPATCH: All units — suspect is hot pink, east on Harbor Blvd. Code 3.';
  } else if (name === 'foot') {
    // -- M1 on foot, DAY 1, dusk ----------------------------------------------
    G.render.setTimeOfDay('dawn');
    s.money = 250;
    s.day = 1;
    s.clock = '17:20';
    s.rep = 40;
    G.missions.startMission(0);
    // Cassian on the sidewalk next to a parked sedan, camera over the shoulder
    G.exitCar();
    G.player.setPos(-8, 30, 2.51); // facing the parked sedan at (-4, 24.5)
    const parked = createCar(G.scene, 0, 0xd8d3c8, -4, 24.5, Math.PI / 2);
    G.stagedCars = [parked];
    G.camOverride = { dist: 7.5, height: 2.6, pitch: 0.24 };
    G.dialog.showNow(
      'Inez Kade', 'FIXER',
      'Welcome to Meridian Bay, Cassian. No car, no crew, no money. Steal something with four wheels and bring it to the garage.',
      30,
    );
    s.dispatchLine = '';
  } else if (name === 'dialog') {
    // -- M5 Pier Heist brief, noon, player at the pier with the black van ------
    G.render.setTimeOfDay('noon');
    s.money = 4850;
    s.day = 2;
    s.clock = '11:20';
    s.rep = 860;
    G.missions.startMission(4);
    G.exitCar();
    // The black van parks at the NEAR end of the pier (178, 22) — the middle
    // of the pier is full of market stalls that swallow a car whole.
    G.player.setPos(170, 30, 2.36); // facing the van at (178, 22)
    // The pier deck sits at y = 1.5 — the van and the gunmen stand ON it,
    // not sunk inside it (the v6 first pass buried them).
    const van = createCar(G.scene, 3, 0x111114, 178, 22, Math.PI / 2);
    van.mesh.position.y = 1.5;
    G.stagedCars = [van];
    // two Harbor Kings gunmen watching the van
    const g1 = G.combat.spawnGunman(174, 17, Math.PI);
    g1.mesh.position.y = 1.5;
    const g2 = G.combat.spawnGunman(182, 27, -Math.PI / 2);
    g2.mesh.position.y = 1.5;
    G.camOverride = { dist: 7.5, height: 2.6, pitch: 0.26 };
    G.dialog.showNow(
      'Inez Kade', 'FIXER',
      'The black Harbor Kings van is parked on Pier 40, keys in it, two gunmen watching it. Take the van. Try not to start a war.',
      30,
    );
    s.dispatchLine = '';
  } else if (name === 'mission') {
    // -- M4 "Heat" PASSED, neon night, mission-passed panel --------------------
    G.render.setTimeOfDay('night');
    s.money = 18450;
    s.day = 3;
    s.clock = '23:33';
    s.rep = 1240;
    G.missions.startMission(3);
    const car = createCar(G.scene, 1, 0x3a7bd5, 44, 66, 0);
    G.enterCar(car, 8);
    car.speed = 8;
    G.stagedCars = [car];
    G.police.setWanted(0);
    G.camOverride = { dist: 9.5, height: 3.4, pitch: 0.3 };
    G.ui.showMissionPassed(CONFIG.missions[3], {
      reward: 2400, time: '60s survived', stars: 3, packages: 4,
      next: CONFIG.missions[4],
    });
    G.dialog.showNow(
      'Inez Kade', 'FIXER',
      'You shook three stars and lived. The Kings are impressed — and the pier job is yours.',
      30,
    );
    s.dispatchLine = 'DISPATCH: All units stand down. Suspect lost on Marina Way.';
  }
  // Sync the HUD state to the staged values. The simulation is frozen in shot
  // mode, so the HUD would otherwise show empty panels.
  s.policeUnits = G.police.units;
  s.heliVisible = G.police.heli.group.visible;
  s.heliPos = s.heliVisible
    ? { x: G.police.heli.group.position.x, z: G.police.heli.group.position.z } : null;
  s.mission = G.missions.def();
  s.missionSpot = G.missions.started
    ? { x: G.missions.marker.position.x, z: G.missions.marker.position.z } : null;
  s.missionStageText = G.missions.stageText();
  if (name === 'mission') s.missionStageText = 'Survived 60s';
  s.missionStageFrac = name === 'chase' ? 0.85 : name === 'mission' ? 1 : 0.25;
  const nextIdx = G.missions.current + 1;
  s.missionNextText = nextIdx < CONFIG.missions.length
    ? `NEXT: ${CONFIG.missions[nextIdx].id} — ${CONFIG.missions[nextIdx].name}`
    : 'NEXT: STORY COMPLETE';
  s.pos = s.inCar && G.currentCar ? G.currentCar.pos : G.player.pos;
  s.heading = s.inCar && G.currentCar ? G.currentCar.heading : G.player.heading;
  s.wanted = G.police.wanted;
  s.speedKmh = s.inCar && G.currentCar ? Math.abs(G.currentCar.speed) * 3.6 : 0;
  s.carName = s.inCar && G.currentCar ? G.currentCar.name : '';
  s.ammo = G.combat.ammo;
  return true;
}

export { SHOT_DEFS };
