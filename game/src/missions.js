// Missions: the six-job story "The Meridian Job" for fixer Inez
// Kade, plus the side jobs (10 hidden packages, taxi fares) and the
// per-district HEAT that can push a district into LOCKDOWN. A gold
// beacon pillar marks the current objective in the world.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D, formatMoney, formatTime } from './random.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { addWanted } from './police.js';

const MISSION_DEFS = [
  {
    name: 'First Wheels',
    chapter: 'CHAPTER 1 · THE MERIDIAN JOB',
    intro: 'First: get wheels. Any car on the street. Walk up and press E.',
    objectives: ['Steal any car on the street', 'Drive to the Marina hideout'],
    payout: 400,
  },
  {
    name: 'Courier Run',
    chapter: 'CHAPTER 2 · THE MERIDIAN JOB',
    intro: 'A package for the Cannery, and the clock is already running. Ninety seconds.',
    objectives: ['Pick up the package at the Cannery', 'Deliver it to the Marina in 90 seconds'],
    payout: 650,
  },
  {
    name: 'The Pickup',
    chapter: 'CHAPTER 3 · THE MERIDIAN JOB',
    intro: 'Three drops around the bay. Grab them all, and do not get cute with the cops.',
    objectives: ['Collect drop 1 of 3', 'Collect drop 2 of 3', 'Collect drop 3 of 3'],
    payout: 900,
  },
  {
    name: 'Heat',
    chapter: 'CHAPTER 4 · THE MERIDIAN JOB',
    intro: 'The MBPD needs to know your name. Get to three stars — then vanish like smoke.',
    objectives: ['Raise your wanted level to 3 stars', 'Survive 30 seconds at 3 stars'],
    payout: 1500,
  },
  {
    name: 'Pier Heist',
    chapter: 'CHAPTER 5 · THE MERIDIAN JOB',
    intro: 'The Harbor Kings keep a black van on the pier. Take it. Bring it to the hideout.',
    objectives: ['Reach the black van on the pier', 'Steal the van', 'Drive it to the hideout'],
    payout: 2400,
  },
  {
    name: 'The Meridian Job',
    chapter: 'CHAPTER 6 · THE MERIDIAN JOB',
    intro: 'The bank. Twenty seconds inside while the whole city comes for you. Then run.',
    objectives: ['Get to Meridian Bank', 'Hold the vault for 20 seconds', 'Escape to the hideout'],
    payout: 5000,
  },
];

const PACKAGE_SPOTS = [
  [120, 60], [-100, -100], [60, -60], [-60, 60], [100, 100],
  [-120, 40], [40, -100], [-40, -60], [80, -20], [-80, 120],
];

const PASSED_QUOTES = [
  'Inez Kade: "Clean wheels, clean getaway. You drive like you mean it."',
  'Inez Kade: "Ninety seconds and not a scratch. The Cannery owes us one."',
  'Inez Kade: "Three drops, no witnesses. You are starting to look like a professional."',
  'Inez Kade: "You vanished like smoke. The pier van is next — the Harbor Kings won\'t miss it."',
  'Inez Kade: "The van is ours. One job left, Cassian. The big one."',
  'Inez Kade: "The Meridian Job is done. This city is yours now."',
];

const DROP_SPOTS = [[-100, -60], [80, 100], [120, -80]];
const HIDEOUT = { x: -60, z: 100 };
const BANK = { x: -20, z: -20 };
const PIER_VAN = { x: 150, z: 0 };

export function createMissions(scene) {
  // Waypoint beacon: a tall light pillar plus a ground ring.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.set(130, 30, 40);
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(130, 0.15, 40);
  scene.add(ring);

  // Hidden packages: small glowing crates.
  const packages = [];
  const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0xff9a00, emissiveIntensity: 0.7 });
  for (const [x, z] of PACKAGE_SPOTS) {
    const m = new THREE.Mesh(boxGeo, boxMat);
    m.position.set(x, 0.8, z);
    scene.add(m);
    packages.push({ mesh: m, x, z, taken: false });
  }

  return {
    defs: MISSION_DEFS,
    currentIndex: 0,
    started: false,
    current: null,
    beacon,
    ring,
    packages,
    packagesFound: 0,
    heat: {},
    taxi: { state: 'idle', passenger: null, dest: null, at: 0 },
    stats: { time: 0, maxWanted: 0, carsStolen: 0 },
  };
}

export function missionObjectiveText(G) {
  const m = G.missions;
  if (!m.current) return 'Free roam — drive to the next job marker.';
  const def = m.current.def;
  const stage = Math.min(m.current.stage, def.objectives.length - 1);
  return def.objectives[stage];
}

function setBeacon(G, x, z) {
  G.missions.beacon.position.set(x, 30, z);
  G.missions.ring.position.set(x, 0.15, z);
  G.missions.beacon.visible = true;
  G.missions.ring.visible = true;
}

function hideBeacon(G) {
  G.missions.beacon.visible = false;
  G.missions.ring.visible = false;
}

export function restoreBeacon(G) {
  if (G.missions.current) {
    const t = G.missions.current.target;
    if (t) setBeacon(G, t.x, t.z);
  }
}

export function startMission(G, index) {
  const m = G.missions;
  const def = MISSION_DEFS[index];
  if (!def) return;
  m.currentIndex = index;
  m.started = true;
  m.current = {
    def,
    index,
    stage: 0,
    stageLabel: `STAGE 1/${def.objectives.length}`,
    timer: 0,
    holdLeft: 0,
    surviveLeft: 0,
    drops: 0,
    target: null,
    spawned: false,
  };
  const c = m.current;
  // First target per mission.
  if (index === 0) c.target = { x: 60, z: 60 };
  if (index === 1) c.target = { x: -100, z: 20 };
  if (index === 2) c.target = DROP_SPOTS[0];
  if (index === 4) c.target = { x: PIER_VAN.x, z: PIER_VAN.z };
  if (index === 5) c.target = { x: BANK.x, z: BANK.z };
  if (c.target) setBeacon(G, c.target.x, c.target.z);
  else hideBeacon(G);
  G.dialog.show('inez', def.intro, 7);
  G.hud.toast(`${def.chapter} — ${def.name}`);
}

function completeMission(G) {
  const m = G.missions;
  const c = m.current;
  if (!c) return;
  const payout = c.def.payout;
  G.money += payout;
  G.rep += 120 + c.index * 80;
  m.stats.time = G.time;
  clearEnemies(G);
  hideBeacon(G);
  const next = c.index + 1;
  const stars = c.index >= 4 ? 3 : 2;
  G.hud.showPassed({
    title: `M${c.index + 1}: ${c.def.name} — PASSED`,
    stars,
    stats: `Payout +${formatMoney(payout)} · Time ${formatTime(G.time)} · Max wanted ${'★'.repeat(Math.max(1, Math.min(5, G.police.wanted)))}${'☆'.repeat(5 - Math.max(1, Math.min(5, G.police.wanted)))} · Packages ${m.packagesFound}/10`,
    quote: PASSED_QUOTES[c.index],
    next: next < MISSION_DEFS.length ? `NEXT: M${next + 1}: ${MISSION_DEFS[next].name}` : 'Story complete — free roam.',
  });
  G.screen = 'passed';
  m.current = null;
  m.currentIndex = next;
  if (G.save) G.save.save();
}

function failMission(G, reason) {
  const m = G.missions;
  const c = m.current;
  if (!c) return;
  G.dialog.show('inez', `That went sideways — ${reason}. Shake it off and run it again.`, 6);
  G.hud.toast(`Mission failed: ${reason}`);
  c.stage = 0;
  c.stageLabel = `STAGE 1/${c.def.objectives.length}`;
  c.timer = 0;
  c.holdLeft = 0;
  c.surviveLeft = 0;
  c.drops = 0;
  c.spawned = false;
  if (c.index === 0) c.target = { x: 60, z: 60 };
  if (c.index === 1) c.target = { x: -100, z: 20 };
  if (c.index === 2) c.target = DROP_SPOTS[0];
  if (c.index === 4) c.target = { x: PIER_VAN.x, z: PIER_VAN.z };
  if (c.index === 5) c.target = { x: BANK.x, z: BANK.z };
  if (c.target) setBeacon(G, c.target.x, c.target.z);
}

function advance(G, label) {
  const c = G.missions.current;
  c.stage++;
  c.stageLabel = label || `STAGE ${c.stage + 1}/${c.def.objectives.length}`;
  G.audio.pickup();
}

export function updateMissions(G, dt) {
  const m = G.missions;
  const c = m.current;
  if (!c) return;
  const p = G.player;
  const at = (x, z, r) => dist2D(p.x, p.z, x, z) < r;

  if (c.index === 0) {
    // M1: steal a car, then drive to the Marina hideout.
    if (c.stage === 0 && p.inCar) {
      advance(G);
      c.target = { x: 60, z: 60 };
      setBeacon(G, 60, 60);
    } else if (c.stage === 1 && at(60, 60, 6)) {
      completeMission(G);
    }
  } else if (c.index === 1) {
    // M2: pickup, then a 90-second delivery.
    if (c.stage === 0 && at(-100, 20, 5)) {
      advance(G);
      c.timer = 90;
      c.target = { x: 60, z: 60 };
      setBeacon(G, 60, 60);
      G.dialog.show('inez', 'Package in hand. Ninety seconds — go.', 5);
    } else if (c.stage === 1) {
      c.timer -= dt;
      if (at(60, 60, 6)) completeMission(G);
      else if (c.timer <= 0) failMission(G, 'the delivery was late');
    }
  } else if (c.index === 2) {
    // M3: three drops around the bay.
    const spot = DROP_SPOTS[c.drops];
    if (spot && at(spot[0], spot[1], 5)) {
      c.drops++;
      G.money += 100;
      G.audio.pickup();
      if (c.drops >= 3) {
        completeMission(G);
      } else {
        advance(G);
        c.target = DROP_SPOTS[c.drops];
        setBeacon(G, c.target[0], c.target[1]);
      }
    }
  } else if (c.index === 3) {
    // M4: get to 3 stars, then survive 30 seconds at 3+.
    if (c.stage === 0 && G.police.wanted >= 3) {
      advance(G);
      c.surviveLeft = 30;
      G.dialog.show('dispatch', 'All units, the suspect is at three stars. Bring them in.', 5);
    } else if (c.stage === 1) {
      if (G.police.wanted >= 3) {
        c.surviveLeft -= dt;
        if (c.surviveLeft <= 0) completeMission(G);
      }
    }
  } else if (c.index === 4) {
    // M5: steal the black Harbor Kings van, drive it home.
    const van = G.cars.find((car) => car.model.kind === 'van' && car.color === 0x14161a);
    if (c.stage === 0 && at(PIER_VAN.x, PIER_VAN.z, 6)) {
      advance(G);
      G.dialog.show('inez', 'There it is. Take the van.', 5);
    } else if (c.stage === 1 && p.inCar === van) {
      advance(G);
      c.target = { x: HIDEOUT.x, z: HIDEOUT.z };
      setBeacon(G, HIDEOUT.x, HIDEOUT.z);
      addWanted(G, 2, 'Van stolen');
    } else if (c.stage === 2 && p.inCar === van && at(HIDEOUT.x, HIDEOUT.z, 6)) {
      completeMission(G);
    }
  } else if (c.index === 5) {
    // M6: reach the bank, hold the vault 20 s, escape.
    if (c.stage === 0 && at(BANK.x, BANK.z, 7)) {
      advance(G);
      c.holdLeft = 20;
      addWanted(G, 4, 'Bank alarm');
      G.dialog.show('dispatch', 'Bank alarm at Meridian Bank. All units respond, code 3.', 5);
      // Harbor Kings gunmen defend the vault.
      spawnEnemy(G, BANK.x + 6, BANK.z + 4, 60);
      spawnEnemy(G, BANK.x - 6, BANK.z - 4, 60);
      spawnEnemy(G, BANK.x + 2, BANK.z - 8, 60);
    } else if (c.stage === 1) {
      c.holdLeft -= dt;
      if (!at(BANK.x, BANK.z, 12)) {
        c.holdLeft = Math.min(c.holdLeft + dt * 2, 20); // stepping out pauses the hold
      }
      if (c.holdLeft <= 0) {
        advance(G, 'STAGE 3/4');
        c.holdLeft = 14;
        c.target = { x: HIDEOUT.x, z: HIDEOUT.z };
        setBeacon(G, HIDEOUT.x, HIDEOUT.z);
        G.dialog.show('inez', 'The vault is ours. Now run — Air One is overhead.', 6);
      }
    } else if (c.stage === 2) {
      c.holdLeft -= dt;
      if (at(HIDEOUT.x, HIDEOUT.z, 6)) {
        G.money += 0; // payout lands in completeMission
        completeMission(G);
        G.hud.showComplete({
          stats: `Final take ${formatMoney(G.money)} · REP ${G.rep} · Packages ${m.packagesFound}/10 · Cars stolen ${m.stats.carsStolen}`,
        });
        G.screen = 'complete';
      } else if (c.holdLeft <= 0) {
        // The chase ran long; the job still completes at the hideout.
        c.holdLeft = 999;
      }
    }
  }
}

export function updateSideJobs(G, dt) {
  const m = G.missions;
  const p = G.player;

  // Hidden packages: walk or drive over one to collect it.
  for (const pkg of m.packages) {
    if (pkg.taken) continue;
    if (dist2D(p.x, p.z, pkg.x, pkg.z) < 2.5) {
      pkg.taken = true;
      pkg.mesh.visible = false;
      m.packagesFound++;
      G.money += CONFIG.packageReward;
      G.rep += 20;
      G.audio.pickup();
      G.hud.toast(`Hidden package ${m.packagesFound}/10 — +${formatMoney(CONFIG.packageReward)}`);
      if (G.save) G.save.save();
    }
  }

  // Taxi fares: in a taxi, pick up the waiting passenger.
  const taxi = m.taxi;
  if (p.inCar && p.inCar.model.kind === 'taxi') {
    if (taxi.state === 'idle') {
      taxi.state = 'waiting';
      taxi.at = G.time + 2;
      taxi.passenger = { x: p.x + 30, z: p.z + 10 };
      taxi.dest = { x: G.rng.range(-100, 100), z: G.rng.range(-100, 100) };
      G.hud.toast('A fare is waiting nearby — drive to the gold marker.');
      setBeacon(G, taxi.passenger.x, taxi.passenger.z);
    } else if (taxi.state === 'waiting' && G.time >= taxi.at) {
      if (dist2D(p.x, p.z, taxi.passenger.x, taxi.passenger.z) < 6) {
        taxi.state = 'riding';
        setBeacon(G, taxi.dest.x, taxi.dest.z);
        G.dialog.show('cassian', 'Where to? …Right. Hold on.', 4);
      }
    } else if (taxi.state === 'riding') {
      if (dist2D(p.x, p.z, taxi.dest.x, taxi.dest.z) < 6) {
        taxi.state = 'idle';
        G.money += CONFIG.taxiFare;
        G.rep += 10;
        G.audio.pickup();
        G.hud.toast(`Fare complete — +${formatMoney(CONFIG.taxiFare)}`);
        restoreBeacon(G);
      }
    }
  } else if (taxi.state !== 'idle') {
    taxi.state = 'idle';
    restoreBeacon(G);
  }
}

export function addDistrictHeat(G, district, amount) {
  const m = G.missions;
  m.heat[district] = (m.heat[district] || 0) + amount;
  if (m.heat[district] >= 5 && m.heat[district] - amount < 5) {
    G.hud.toast(`${district} is in LOCKDOWN — the MBPD owns these streets.`);
    G.dialog.showDispatch(`${district} is locked down. All units hold the perimeter.`);
  }
}

export function districtHeat(G, district) {
  return G.missions.heat[district] || 0;
}
