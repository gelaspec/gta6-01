// Story missions and side jobs. Six missions — "The Meridian Job" —
// each with fixer dialog, staged objectives, a waypoint beacon and a
// payout, plus hidden packages, taxi fares and district HEAT that
// climbs with crime and locks a district down at 5.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D, formatMoney } from './random.js';
import { addWanted } from './police.js';
import { spawnEnemy, clearEnemies } from './combat.js';

const MISSION_DEFS = [
  {
    id: 1, chapter: 'CHAPTER 1', name: 'First Wheels',
    intro: [
      ['inez', 'Cassian. Welcome back to the Bay. You owe me four grand — time to earn it.'],
      ['inez', 'First: get wheels. Any car on the street. Walk up and press E.'],
    ],
    objective: 'Steal a car (walk up and press E), then drive to the Marina marker.',
    next: 'NEXT: M2 Courier Run — deliver the package in 90 seconds.',
    payout: 400,
  },
  {
    id: 2, chapter: 'CHAPTER 1', name: 'Courier Run',
    intro: [
      ['inez', 'A package for the Marina. Ninety seconds on the clock. Do not scratch the paint.'],
    ],
    objective: 'Pick up the package, then deliver it to the Marina before the timer runs out.',
    next: 'NEXT: M3 The Pickup — collect three drops for the crew.',
    payout: 650,
  },
  {
    id: 3, chapter: 'CHAPTER 2', name: 'The Pickup',
    intro: [
      ['inez', 'Three drops around the city. Collect them all, keep your head down.'],
    ],
    objective: 'Collect the three drops (0/3).',
    next: 'NEXT: M4 Heat — three stars. Lose them.',
    payout: 900,
  },
  {
    id: 4, chapter: 'CHAPTER 2', name: 'Heat',
    intro: [
      ['inez', 'Time to learn the heat. Get three stars on you — then vanish.'],
      ['dispatch', 'All units: suspect flagged. Three stars. Move in.'],
    ],
    objective: 'Get three stars, then break line of sight and stay quiet until the heat dies.',
    next: 'NEXT: M5 Pier Heist — steal the black Harbor Kings van.',
    payout: 1500,
  },
  {
    id: 5, chapter: 'CHAPTER 3', name: 'Pier Heist',
    intro: [
      ['inez', 'The Harbor Kings keep a black van on the pier. Take it. Bring it to the hideout.'],
      ['rook', 'That van is Kings property. Touch it and we bury you.'],
    ],
    objective: 'Steal the black Harbor Kings van on the pier and take it to the hideout.',
    next: 'NEXT: M6 The Meridian Job — the bank. Twenty seconds. Everything on the line.',
    payout: 2400,
  },
  {
    id: 6, chapter: 'CHAPTER 3', name: 'The Meridian Job',
    intro: [
      ['inez', 'The bank. Twenty seconds. The whole city will come for you — hold the line.'],
      ['dispatch', 'Alarm at Meridian Bank. Four stars. All units respond.'],
    ],
    objective: 'Hold the bank 20 seconds while the whole city comes for you, then escape.',
    next: 'NEXT: Free roam — the city is yours, Cassian.',
    payout: 5000,
  },
];

const PACKAGE_SPOTS = [
  [-100, -100], [100, -100], [-100, 100], [100, 100], [0, -120],
  [-120, 0], [120, 60], [60, -120], [-60, 120], [130, -40],
];

const PASSED_QUOTES = [
  'Clean work, Cassian. The Bay is starting to notice you.',
  'You vanished like smoke. The next job is already waiting.',
  'That is how you drive in Meridian Bay. Keep it up.',
  'Four grand closer. You are almost a free man.',
  'The Kings will remember this one. So will I.',
  'The vault is ours. You just bought your freedom.',
];

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
  if (def.id === 3) return `Collect the three drops (${m.current.got}/3).`;
  if (def.id === 4) {
    return m.current.stage === 0
      ? 'Get three stars on you — steal a car or cause trouble.'
      : 'Three stars! Now lose them — break line of sight and stay quiet.';
  }
  if (def.id === 6 && m.current.stage === 1) return `Hold the bank! ${Math.ceil(m.current.holdLeft)}s left — the whole city is coming.`;
  return def.objective;
}

function setBeacon(G, x, z) {
  const m = G.missions;
  m.beacon.position.set(x, 30, z);
  m.ring.position.set(x, 0.15, z);
  m.beacon.visible = true;
  m.ring.visible = true;
}

function hideBeacon(G) {
  G.missions.beacon.visible = false;
  G.missions.ring.visible = false;
}

// Re-point the beacon at the current mission's active target without
// restarting the mission (used after a taxi fare moves it).
export function restoreBeacon(G) {
  const m = G.missions;
  const cur = m.current;
  if (!cur) {
    hideBeacon(G);
    return;
  }
  const def = cur.def;
  if (def.id === 1) setBeacon(G, 130, 40);
  else if (def.id === 2) setBeacon(G, cur.stage === 0 ? -100 : 100, cur.stage === 0 ? -100 : 100);
  else if (def.id === 3) setBeacon(G, cur.data.drops[cur.got].x, cur.data.drops[cur.got].z);
  else if (def.id === 5) setBeacon(G, cur.data.vanStolen ? -120 : 150, cur.data.vanStolen ? -120 : 0);
  else if (def.id === 6) setBeacon(G, cur.stage === 2 ? 0 : -20, cur.stage === 2 ? 60 : -20);
  else hideBeacon(G);
}

export function startMission(G, index) {
  const m = G.missions;
  const def = m.defs[index];
  if (!def) return;
  m.currentIndex = index;
  m.started = true;
  clearEnemies(G);
  m.current = { def, stage: 0, timer: 0, got: 0, holdLeft: 20, data: {} };
  m.stats.time = 0;
  for (const [who, line] of def.intro) G.dialog.show(who, line, 5);
  G.audio.mission();
  if (def.id === 1) setBeacon(G, 130, 40);
  if (def.id === 2) {
    m.current.data.pickup = { x: -100, z: -100 };
    setBeacon(G, -100, -100);
  }
  if (def.id === 3) {
    m.current.data.drops = [{ x: -60, z: 80 }, { x: 60, z: -60 }, { x: 120, z: 0 }];
    setBeacon(G, -60, 80);
  }
  if (def.id === 4) {
    hideBeacon(G);
    addWanted(G, 3, 'The heat is on');
  }
  if (def.id === 5) {
    setBeacon(G, 150, 0);
    m.current.data.vanStolen = false;
  }
  if (def.id === 6) setBeacon(G, -20, -20);
  G.hud.refreshMission();
}

function completeMission(G) {
  const m = G.missions;
  const cur = m.current;
  if (!cur) return;
  const def = cur.def;
  G.money += def.payout;
  G.rep += 120 + def.id * 40;
  G.audio.cash();
  const acc = G.combat.fired > 0 ? Math.round((G.combat.hits / G.combat.fired) * 100) : 100;
  const stars = acc >= 80 && m.stats.time < 240 ? 3 : acc >= 50 ? 2 : 1;
  G.hud.showPassed({
    title: `M${def.id}: ${def.name} — PASSED`,
    stars,
    stats: `Payout +${formatMoney(def.payout)} · Time ${Math.floor(m.stats.time / 60)}:${String(Math.floor(m.stats.time % 60)).padStart(2, '0')} · Max wanted ${'★'.repeat(m.stats.maxWanted)}${'☆'.repeat(5 - m.stats.maxWanted)} · Packages ${m.packagesFound}/10`,
    quote: `Inez Kade: "${PASSED_QUOTES[def.id - 1]}"`,
    next: def.next,
  });
  G.screen = 'passed';
  m.current = null;
  hideBeacon(G);
  clearEnemies(G);
  G.save.save();
}

function failMission(G, reason) {
  const m = G.missions;
  G.hud.toast(`${reason} — mission failed. Try again.`);
  G.dialog.show('inez', 'That one slipped. Shake it off — we run it again.', 5);
  if (m.current) {
    const idx = m.current.def.id - 1;
    m.current = null;
    hideBeacon(G);
    clearEnemies(G);
    startMission(G, idx);
  }
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (!m.current) return;
  m.stats.time += dt;
  m.stats.maxWanted = Math.max(m.stats.maxWanted, Math.floor(G.police.wanted));
  const cur = m.current;
  const def = cur.def;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;

  if (def.id === 1) {
    if (p.inCar && dist2D(px, pz, 130, 40) < 8) completeMission(G);
  } else if (def.id === 2) {
    if (cur.stage === 0) {
      if (dist2D(px, pz, -100, -100) < 6) {
        cur.stage = 1;
        cur.timer = 90;
        setBeacon(G, 100, 100);
        G.hud.toast('Package picked up — 90 seconds to the Marina!');
        G.audio.pickup();
      }
    } else {
      cur.timer -= dt;
      if (dist2D(px, pz, 100, 100) < 8) completeMission(G);
      else if (cur.timer <= 0) failMission(G, 'Out of time');
    }
  } else if (def.id === 3) {
    const drops = cur.data.drops;
    if (cur.got < drops.length) {
      const d = drops[cur.got];
      if (dist2D(px, pz, d.x, d.z) < 6) {
        cur.got++;
        G.audio.pickup();
        G.hud.toast(`Drop collected (${cur.got}/3).`);
        if (cur.got < drops.length) setBeacon(G, drops[cur.got].x, drops[cur.got].z);
        else completeMission(G);
      }
    }
  } else if (def.id === 4) {
    if (cur.stage === 0 && G.police.wanted >= 3) {
      cur.stage = 1;
      G.hud.toast('Three stars! Now lose them — break line of sight and stay quiet.');
    } else if (cur.stage === 1 && G.police.wanted <= 0) {
      completeMission(G);
    }
  } else if (def.id === 5) {
    if (!cur.data.vanStolen) {
      // The black van waits on the pier.
      if (p.inCar && p.inCar.model.kind === 'van' && p.inCar.color === 0x14161a && dist2D(px, pz, 150, 0) < 10) {
        cur.data.vanStolen = true;
        setBeacon(G, -120, -120);
        G.hud.toast('Van stolen — take it to the hideout, fast!');
        addWanted(G, 2, 'Van heist');
      }
    } else if (dist2D(px, pz, -120, -120) < 8) {
      completeMission(G);
    }
  } else if (def.id === 6) {
    if (cur.stage === 0) {
      if (dist2D(px, pz, -20, -20) < 8) {
        cur.stage = 1;
        cur.holdLeft = 20;
        addWanted(G, 4, 'Bank alarm');
        spawnEnemy(G, -14, -14, 100);
        spawnEnemy(G, -26, -14, 100);
        spawnEnemy(G, -20, -28, 100);
        G.hud.toast('ALARM — 4 stars! Hold the bank!');
        G.dialog.show('inez', 'Alarm is up — four stars! Hold the bank, twenty seconds, and the vault is ours.', 6);
      }
    } else if (cur.stage === 1) {
      cur.holdLeft -= dt;
      if (dist2D(px, pz, -20, -20) > 16) {
        cur.holdLeft = Math.min(20, cur.holdLeft + dt * 2);
        if (G.time - (cur.data.lastBackToast || -100) > 6) {
          cur.data.lastBackToast = G.time;
          G.hud.toast('Get back to the bank!');
        }
      }
      if (cur.holdLeft <= 0) {
        cur.stage = 2;
        setBeacon(G, 0, 60);
        G.hud.toast('Vault cracked — escape to the hideout!');
      }
    } else if (cur.stage === 2) {
      if (dist2D(px, pz, 0, 60) < 8) {
        // The Meridian Job ends the story: straight to the complete
        // screen, not through the mission-passed screen.
        const payout = cur.def.payout;
        G.money += payout;
        G.rep += 120 + cur.def.id * 40;
        G.audio.cash();
        m.current = null;
        hideBeacon(G);
        clearEnemies(G);
        G.save.save();
        G.screen = 'complete';
        G.hud.showComplete(G);
      }
    }
  }

  // Beacon pulse.
  m.beacon.rotation.y += dt * 0.8;
  m.ring.scale.setScalar(1 + Math.sin(G.time * 3) * 0.12);
}

export function updateSideJobs(G, dt) {
  const m = G.missions;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;

  // Hidden packages.
  for (const pkg of m.packages) {
    if (pkg.taken) continue;
    pkg.mesh.rotation.y += dt;
    pkg.mesh.position.y = 0.8 + Math.sin(G.time * 2 + pkg.x) * 0.15;
    if (dist2D(px, pz, pkg.x, pkg.z) < 3) {
      pkg.taken = true;
      pkg.mesh.visible = false;
      m.packagesFound++;
      G.money += CONFIG.packageReward;
      G.rep += 15;
      G.audio.pickup();
      G.hud.toast(`Hidden package ${m.packagesFound}/10 — +$${CONFIG.packageReward}.`);
    }
  }

  // Taxi fares: a passenger waits near the player while driving.
  const taxi = m.taxi;
  if (taxi.state === 'idle') {
    taxi.at += dt;
    if (taxi.at > 25 && p.inCar) {
      taxi.at = 0;
      const angle = G.rng.range(0, Math.PI * 2);
      taxi.passenger = { x: px + Math.cos(angle) * 18, z: pz + Math.sin(angle) * 18 };
      taxi.state = 'waiting';
      G.hud.toast('Taxi fare waiting nearby — stop by the marker.');
    }
  } else if (taxi.state === 'waiting') {
    if (p.inCar && dist2D(px, pz, taxi.passenger.x, taxi.passenger.z) < 6) {
      taxi.state = 'riding';
      const angle = G.rng.range(0, Math.PI * 2);
      taxi.dest = { x: px + Math.cos(angle) * 90, z: pz + Math.sin(angle) * 90 };
      setBeacon(G, taxi.dest.x, taxi.dest.z);
      G.hud.toast('Passenger aboard — take them to the marker.');
    }
  } else if (taxi.state === 'riding') {
    if (dist2D(px, pz, taxi.dest.x, taxi.dest.z) < 8) {
      G.money += CONFIG.taxiFare;
      G.rep += 10;
      G.audio.cash();
      G.hud.toast(`Fare complete — +$${CONFIG.taxiFare}.`);
      taxi.state = 'idle';
      taxi.at = 0;
      restoreBeacon(G);
    }
  }
}

export function addDistrictHeat(G, district, amount) {
  const m = G.missions;
  m.heat[district] = Math.min(5, (m.heat[district] || 0) + amount);
  if (m.heat[district] >= 5) {
    G.hud.toast(`${district} is on LOCKDOWN — extra units rolling in.`);
    addWanted(G, 1, 'Lockdown');
  }
}

export function districtHeat(G, district) {
  return Math.round(G.missions.heat[district] || 0);
}
