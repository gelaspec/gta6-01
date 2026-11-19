// Meridian Bay — deterministic shot states for the four screenshots.
// Each one sets the time of day, the money, the mission, the wanted level,
// the vehicles and the dialog, then the game runs a fixed warm-up so the
// frame is alive (police closing in, helicopter circling) but repeatable.
// ?shot=chase|foot|dialog|passed (&seed=) — the cover is never a menu.
import { CONFIG } from './config.js';

function placePedNear(game, x, z) {
  const ped = game.peds.list.find((p) => p.alive);
  if (!ped) return;
  ped.pos.set(x, 0, z);
  ped.target.set(x + 20, 0, z);
  ped.syncMesh();
}

export function applyShot(game, name) {
  const g = game;
  const p = g.player;
  // a clean slate: no wanted, no taxi, dialog cleared, no stale toast
  g.police.setWanted(0, g.time);
  g.police.everWanted = false;
  g.missions.taxi = null;
  g.dialog.queue = [];
  g.dialog.current = null;
  g.hud.hideToast();

  if (name === 'chase') {
    // M6 "The Meridian Job" — late-mission chase at golden hour.
    g.renderer.setTimeOfDay('golden');
    g.day = 6;
    g.clockMin = 18 * 60 + 42;
    g.money = 31200;
    g.rep = 78;
    g.missions.index = 5;
    g.missions.stage = 2;
    g.missions.done = 5;
    g.missions.objective = 'Break through the Downtown cordon — 4 stars';
    g.missions.setBeacon(150, -150);
    g.missions.finished = false;
    // hero car on the coast road, doing 149 km/h north
    const hero = g.traffic.hero;
    g.enterCar(hero, true);
    hero.pos.set(196, 0, 40);
    hero.heading = Math.PI;
    hero.speed = 41.4;
    hero.health = 82;
    // two patrol cars right behind, lights flashing
    g.police.setWanted(4, g.time);
    g.police.everWanted = true;
    const c1 = g.police.spawnCar(190, 54);
    c1.heading = Math.PI;
    c1.speed = 41.4;
    const c2 = g.police.spawnCar(202, 60);
    c2.heading = Math.PI;
    c2.speed = 41.4;
    // traffic ahead on the same road, far enough to never be caught
    const t1 = g.traffic.cars.find((c) => !c.isPolice && c !== hero);
    if (t1) { t1.pos.set(196, 0, -80); t1.heading = Math.PI; t1.speed = 14; }
    const t2 = g.traffic.cars.filter((c) => !c.isPolice && c !== hero)[1];
    if (t2) { t2.pos.set(190, 0, -120); t2.heading = Math.PI; t2.speed = 12; }
    // pedestrians scattering on the beach-side sidewalk, off the road
    placePedNear(g, 209, 10);
    placePedNear(g, 209, -14);
    g.dialog.say({
      name: 'Inez Kade', role: 'FIXER',
      text: 'Four stars and a helicopter, Cassian — lose them on the coast road and meet the boat at the Marina.',
    }, 30);
    g.hud.toast('M6 — THE MERIDIAN JOB  •  STAGE 3/4');
    return;
  }

  if (name === 'foot') {
    // M1, on foot on the pier, day one, $250.
    g.renderer.setTimeOfDay('day');
    g.day = 1;
    g.clockMin = 9 * 60 + 15;
    g.money = 250;
    g.rep = 0;
    g.missions.index = 0;
    g.missions.stage = 0;
    g.missions.done = 0;
    g.missions.objective = 'Steal a car (press E near one)';
    g.missions.finished = false;
    p.reset(220, 2, -Math.PI / 2);
    const hero = g.traffic.hero;
    hero.pos.set(206, 0, 8);
    hero.heading = 0;
    hero.speed = 0;
    placePedNear(g, 212, -6);
    placePedNear(g, 214, 8);
    placePedNear(g, 206, 4);
    g.hud.toast('M1 — FIRST WHEELS');
    g.dialog.say({
      name: 'Inez Kade', role: 'FIXER',
      text: 'Cassian, you are back in Meridian Bay with nothing but a bus ticket. Steal a car and bring it to the Marina.',
    }, 30);
    return;
  }

  if (name === 'dialog') {
    // M3 brief at dusk in Calle Verde — panel and dialog name the same mission.
    g.renderer.setTimeOfDay('dusk');
    g.day = 3;
    g.clockMin = 17 * 60 + 20;
    g.money = 4850;
    g.rep = 31;
    g.missions.index = 2;
    g.missions.stage = 0;
    g.missions.done = 2;
    g.missions.objective = 'Collect the drops in Calle Verde (0/3)';
    g.missions.finished = false;
    g.missions.setBeacon(-110, 165);
    p.reset(-140, 128, Math.PI * 0.75);
    const hero = g.traffic.hero;
    hero.pos.set(-140, 0, 100);
    hero.heading = Math.PI;
    hero.speed = 0;
    g.police.setWanted(1, g.time);
    g.police.everWanted = true;
    const c1 = g.police.spawnCar(-112, 100);
    c1.heading = Math.PI;
    c1.speed = 20;
    placePedNear(g, -146, 140);
    placePedNear(g, -132, 122);
    const m = CONFIG.missions[2];
    g.dialog.say({ name: m.giver, role: m.role, text: m.brief }, 30);
    return;
  }

  if (name === 'passed') {
    // M4 "Heat" PASSED at neon night — $18,450 on the board.
    g.renderer.setTimeOfDay('night');
    g.day = 4;
    g.clockMin = 22 * 60 + 5;
    g.money = 18450;
    g.rep = 52;
    g.missions.index = 4;
    g.missions.stage = 0;
    g.missions.done = 4;
    g.missions.objective = 'Reach the pier';
    g.missions.finished = false;
    g.missions.setBeacon(205, 0);
    const hero = g.traffic.hero;
    g.enterCar(hero, true);
    hero.pos.set(28, 0, 40);
    hero.heading = Math.PI;
    hero.speed = 0;
    hero.health = 88;
    const t1 = g.traffic.cars.find((c) => !c.isPolice && c !== hero);
    if (t1) { t1.pos.set(28, 0, -10); t1.heading = Math.PI; t1.speed = 11; }
    const m = CONFIG.missions[3];
    g.hud.showPassed({
      chapter: m.chapter,
      name: m.name,
      reward: m.reward,
      rating: 3,
      stats: 'TIME 04:12  •  DAMAGE 12%  •  PACKAGES 2/10  •  TOP SPEED 164 KM/H',
    }, true);
    g.dialog.say({
      name: 'Inez Kade', role: 'FIXER',
      text: 'Clean work, Cassian. Thirteen thousand six hundred is yours — and the MBPD never even saw your face.',
    }, 30);
    return;
  }

  // unknown shot: fall back to the chase
  applyShot(game, 'chase');
}

export const SHOT_NAMES = ['chase', 'foot', 'dialog', 'passed'];
