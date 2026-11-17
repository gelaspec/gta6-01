// "The Meridian Job": six story missions from Inez Kade, plus the side
// work that pays between them — ten hidden packages around the city and
// taxi fares for anyone who flags a cab down. A mission is a small state
// machine: an objective, a waypoint beacon in the world, and a condition
// that pays out when it is met. Every job opens with the fixer's briefing
// and ends on a mission-passed screen with payout, stats and a star rating.

import * as THREE from 'three';
import { FIXER, MISSIONS, PACKAGE_COUNT, PACKAGE_REWARD } from './config.js';
import { DIALOG_LINES } from './dialog.js';
import { range } from './random.js';

const PACKAGE_SPOTS = [
  [-200, -200], [-40, -200], [120, -240], [200, -80], [-240, 40],
  [-120, 120], [40, 200], [200, 120], [-200, 200], [120, 40],
];

export function createMissions(scene, city, random, game) {
  // Waypoint beacon: a shaft of light and a spinning diamond over the goal.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
  );
  diamond.position.y = 9;
  beacon.add(diamond);
  beacon.visible = false;
  scene.add(beacon);

  const pkgMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0xa8840a, emissiveIntensity: 0.7 });
  const packages = PACKAGE_SPOTS.slice(0, PACKAGE_COUNT).map(([x, z], i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), pkgMat);
    mesh.position.set(x, 1.2, z);
    mesh.castShadow = true;
    scene.add(mesh);
    return { id: i, x, z, mesh, found: false };
  });

  const state = {
    index: 0, // 0-based mission; 6 = story complete
    phase: 'a',
    timer: 0,
    holdTimer: 0,
    collected: 0,
    van: null,
    taxi: null, // {passenger, dest, reward, state}
    taxiCooldown: 8,
    objective: '',
    waypoint: null,
    missionTime: 0, // seconds spent on the current mission (passed screen)
    maxWanted: 0, // highest wanted level reached this mission (passed screen)
  };

  function setObjective(text, waypoint) {
    state.objective = text;
    state.waypoint = waypoint || null;
    beacon.visible = !!waypoint;
    if (waypoint) beacon.position.set(waypoint.x, 0, waypoint.z);
    game.hud.setObjective(currentTitle(), text);
  }

  function currentTitle() {
    if (state.index >= MISSIONS.length) return 'Free Roam';
    return `M${MISSIONS[state.index].id}: ${MISSIONS[state.index].title}`;
  }

  function pay(amount, label) {
    game.addMoney(amount);
    game.hud.toast(`${label}  +$${amount}`);
    game.audio.mission();
  }

  function completeMission() {
    const m = MISSIONS[state.index];
    pay(m.reward, `${m.title} complete!`);
    game.saveProgress();
    const stats = {
      title: `M${m.id}: ${m.title}`,
      payout: m.reward,
      time: state.missionTime,
      maxWanted: state.maxWanted,
      packages: packages.filter((p) => p.found).length,
      stars: Math.max(1, 3 - (state.missionTime > (m.par || 180) ? 1 : 0) - (state.maxWanted >= 4 ? 1 : 0)),
      speaker: FIXER,
      dialog: DIALOG_LINES.next[state.index],
      next: state.index + 1 < MISSIONS.length
        ? `M${MISSIONS[state.index + 1].id}: ${MISSIONS[state.index + 1].title}`
        : '',
    };
    state.index += 1;
    state.phase = 'a';
    state.timer = 0;
    state.holdTimer = 0;
    state.collected = 0;
    state.van = null;
    state.missionTime = 0;
    state.maxWanted = 0;
    startMission();
    game.onMissionPassed(stats);
  }

  function showBriefing() {
    if (state.index >= MISSIONS.length) return;
    game.dialog.show(FIXER, DIALOG_LINES.briefings[state.index]);
  }

  function startMission() {
    const i = state.index;
    state.missionTime = 0;
    state.maxWanted = 0;
    if (i >= MISSIONS.length) {
      setObjective('The Meridian Job is done. Meridian Bay is yours — free roam, find the packages, run fares.', null);
      game.hud.toast('STORY COMPLETE — The Meridian Job');
      return;
    }
    if (i === 0) {
      setObjective('Steal a car (walk up and press E), then drive to the Marina marker.', { x: city.marina.x, z: city.marina.z });
    } else if (i === 1) {
      state.timer = 90;
      setObjective('Courier run: deliver the package to Calle Verde in 90 seconds.', { x: -240, z: 160 });
    } else if (i === 2) {
      state.collected = 0;
      setObjective('Pick up 3 packages around the Old Port (0/3).', { x: -200, z: -120 });
    } else if (i === 3) {
      if (state.phase === 'b') {
        setObjective('Three stars! Now lose them — break line of sight and stay quiet.', null);
      } else {
        setObjective('Get the heat on: reach 3 stars, any way you like. Steal, speed, shoot.', null);
      }
    } else if (i === 4) {
      const van = game.vehicles.addCar(-160, -200, Math.PI / 2, 0x1a1a1a, 'parked');
      van.isHeistVan = true;
      state.van = van;
      game.combat.spawnEnemy(-156, -196, 'gang');
      game.combat.spawnEnemy(-164, -204, 'gang');
      setObjective('Pier Heist: steal the black Harbor Kings van and take it to the hideout.', { x: -160, z: -200 });
    } else if (i === 5) {
      setObjective('The Meridian Job: get to the Meridian Bank downtown.', { x: city.bank.x, z: city.bank.z });
    }
  }

  function playerPos() {
    return game.playerPos();
  }

  function inCar() {
    return !!game.vehicles.playerCar;
  }

  function distTo(x, z) {
    const p = playerPos();
    return Math.hypot(p.x - x, p.z - z);
  }

  function update(dt) {
    // Beacon spin and bob.
    if (beacon.visible) {
      diamond.rotation.y += dt * 2;
      diamond.position.y = 9 + Math.sin(performance.now() / 400) * 0.8;
    }
    // Packages: spin, bob, collect.
    for (const pkg of packages) {
      if (pkg.found) continue;
      pkg.mesh.rotation.y += dt * 1.5;
      pkg.mesh.position.y = 1.2 + Math.sin(performance.now() / 300 + pkg.id) * 0.25;
      if (distTo(pkg.x, pkg.z) < 2.8) {
        pkg.found = true;
        pkg.mesh.visible = false;
        game.addMoney(PACKAGE_REWARD);
        game.hud.toast(`Hidden package ${packages.filter((p) => p.found).length}/${PACKAGE_COUNT}  +$${PACKAGE_REWARD}`);
        game.audio.pickup();
        game.saveProgress();
      }
    }
    updateTaxi(dt);
    const i = state.index;
    if (i < MISSIONS.length) {
      state.missionTime += dt;
      state.maxWanted = Math.max(state.maxWanted, game.police.wanted);
    }
    if (i >= MISSIONS.length) return;
    if (i === 0) {
      if (inCar() && distTo(city.marina.x, city.marina.z) < 14) completeMission();
    } else if (i === 1) {
      state.timer -= dt;
      game.hud.setTimer(Math.max(0, state.timer));
      if (distTo(-240, 160) < 10) {
        game.hud.setTimer(null);
        completeMission();
      } else if (state.timer <= 0) {
        state.timer = 90;
        game.dialog.show(FIXER, DIALOG_LINES.mid['m1-fail']);
        game.audio.denied();
      }
    } else if (i === 2) {
      const spots = [[-200, -120], [-120, -200], [-240, -40]];
      const p = playerPos();
      for (let k = 0; k < spots.length; k += 1) {
        if (!state['pick' + k] && Math.hypot(p.x - spots[k][0], p.z - spots[k][1]) < 3) {
          state['pick' + k] = true;
          state.collected += 1;
          game.audio.pickup();
          game.hud.toast(`Package ${state.collected}/3`);
        }
      }
      const next = spots.find((s, k) => !state['pick' + k]);
      if (next) {
        setObjective(`Pick up 3 packages around the Old Port (${state.collected}/3).`, { x: next[0], z: next[1] });
      }
      if (state.collected >= 3) completeMission();
    } else if (i === 3) {
      if (state.phase === 'a') {
        if (game.police.wanted >= 3) {
          state.phase = 'b';
          setObjective('Three stars! Now lose them — break line of sight and stay quiet.', null);
          game.dialog.show(FIXER, DIALOG_LINES.mid['m3-hot']);
        }
      } else if (game.police.wanted === 0) {
        completeMission();
      }
    } else if (i === 4) {
      if (state.phase === 'a') {
        if (state.van && game.vehicles.playerCar === state.van) {
          state.phase = 'b';
          setObjective('Van secured. Lose any tail and drive it to the hideout.', { x: city.hideout.x, z: city.hideout.z });
          game.dialog.show(FIXER, DIALOG_LINES.mid['m4-van']);
        }
      } else if (state.van && game.vehicles.playerCar === state.van && distTo(city.hideout.x, city.hideout.z) < 14) {
        completeMission();
      }
    } else if (i === 5) {
      if (state.phase === 'a') {
        if (distTo(city.bank.x, city.bank.z) < 12) {
          state.phase = 'b';
          state.holdTimer = 20;
          game.police.addHeat(4);
          game.combat.spawnEnemy(city.bank.x + 8, city.bank.z + 6, 'gang');
          game.combat.spawnEnemy(city.bank.x - 8, city.bank.z + 4, 'gang');
          game.combat.spawnEnemy(city.bank.x + 2, city.bank.z - 10, 'gang');
          setObjective('Hold the bank! 20 seconds while the whole city comes for you.', { x: city.bank.x, z: city.bank.z });
          game.hud.toast('ALARM — 4 stars!');
          game.dialog.show(FIXER, DIALOG_LINES.mid['m5-alarm']);
        }
      } else if (state.phase === 'b') {
        state.holdTimer -= dt;
        game.hud.setTimer(Math.max(0, state.holdTimer));
        if (distTo(city.bank.x, city.bank.z) > 16) {
          state.holdTimer = 20;
          setObjective('Back to the bank — the vault is not done yet!', { x: city.bank.x, z: city.bank.z });
        } else if (state.holdTimer <= 0) {
          game.hud.setTimer(null);
          state.phase = 'c';
          setObjective('Vault empty! Run for the pier — the boat is waiting.', { x: city.pierEnd.x, z: city.pierEnd.z });
          game.dialog.show(FIXER, DIALOG_LINES.mid['m5-vault']);
        }
      } else if (distTo(city.pierEnd.x, city.pierEnd.z) < 12) {
        completeMission();
      }
    }
  }

  function updateTaxi(dt) {
    const t = state.taxi;
    if (t) {
      if (t.state === 'pickup') {
        if (inCar() && distTo(t.passenger.x, t.passenger.z) < 5) {
          t.state = 'dropoff';
          setObjective(`Taxi fare: take the passenger to the marker. ($${t.reward})`, { x: t.dest.x, z: t.dest.z });
          game.hud.toast('Passenger in — drive to the marker.');
        }
      } else if (t.state === 'dropoff') {
        if (distTo(t.dest.x, t.dest.z) < 10) {
          pay(t.reward, 'Taxi fare complete!');
          state.taxi = null;
          state.taxiCooldown = 20;
          startMission();
        }
      }
      return;
    }
    state.taxiCooldown -= dt;
    if (state.taxiCooldown > 0) return;
    // A fare appears: a waving pedestrian near a road, with a destination.
    const road = city.roads[Math.floor(random() * city.roads.length)];
    const along = range(random, -200, 200);
    const spot = random() < 0.5
      ? { x: road + 10, z: along }
      : { x: along, z: road + 10 };
    const dest = { x: range(random, -220, 220), z: range(random, -220, 220) };
    const reward = 150 + Math.floor(random() * 4) * 50;
    state.taxi = { passenger: spot, dest, reward, state: 'pickup' };
    setObjective(`Taxi fare nearby — pick up the passenger at the marker. ($${reward})`, spot);
  }

  function applySave(save) {
    state.index = save.mission || 0;
    for (const pkg of packages) {
      if (save.packages && save.packages.includes(pkg.id)) {
        pkg.found = true;
        pkg.mesh.visible = false;
      }
    }
    startMission();
  }

  function foundPackageIds() {
    return packages.filter((p) => p.found).map((p) => p.id);
  }

  startMission();

  return {
    get index() {
      return state.index;
    },
    get objective() {
      return state.objective;
    },
    get waypoint() {
      return state.waypoint;
    },
    get taxi() {
      return state.taxi;
    },
    get packagesFound() {
      return packages.filter((p) => p.found).length;
    },
    packagePositions() {
      return packages.map((p) => ({ x: p.x, z: p.z, found: p.found }));
    },
    update,
    applySave,
    foundPackageIds,
    showBriefing,
    reset() {
      state.index = 0;
      state.phase = 'a';
      startMission();
    },
    /** Jump to a mission (used by the deterministic screenshot scenes). */
    setMission(index, phase) {
      state.index = index;
      state.phase = phase || 'a';
      state.timer = 0;
      state.holdTimer = 0;
      state.collected = 0;
      startMission();
    },
  };
}
