// Police: the MBPD wanted system. Crimes raise stars from 1 to 5;
// cruisers chase and ram, foot cops close in, and at three stars Air
// One puts its spotlight on the player. Break line of sight and stay
// quiet to cool the heat — or get busted standing still too long.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2D, wrapAngle, angleLerp } from './random.js';
import { buildCarMesh } from './vehicles.js';
import { buildFigure } from './player.js';
import { damagePlayer } from './player.js';

const UNIT_NAMES = ['UNIT 7', 'UNIT 12', 'UNIT 4', 'UNIT 21', 'UNIT 9', 'UNIT 16'];
const DISPATCH_LINES = [
  'All units, suspect is on the move. Set up a roadblock.',
  'Air One is overhead. Keep the spotlight on the suspect.',
  'Suspect vehicle is a hot-pink sports car. Do not lose it.',
  'Units 7 and 12, converge on the suspect now.',
];
const COP_LINES = [
  'MBPD! Stop right there!',
  'On the ground, now!',
  'You are not getting away!',
];

export function createPolice(scene, rng) {
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x1c2330 }),
  );
  heliBody.position.y = 0;
  heliGroup.add(heliBody);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x14161a }),
  );
  rotor.position.y = 1.1;
  heliGroup.add(rotor);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x1c2330 }),
  );
  tail.position.set(0, 0.2, -4);
  heliGroup.add(tail);
  // Spotlight cone: apex at the helicopter, wide base on the road
  // below. A cone's apex is its top, so it hangs unrotated.
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 20, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  spot.position.y = -11;
  heliGroup.add(spot);
  heliGroup.visible = false;
  scene.add(heliGroup);
  return {
    wanted: 0,
    heat: 0,
    lastCrimeAt: -100,
    bustTimer: 0,
    units: [],
    cops: [],
    heli: heliGroup,
    heliRotor: rotor,
    heliActive: false,
    dispatchAt: -100,
    dispatchLine: 0,
    inSight: false,
  };
}

function spawnUnit(G) {
  const p = G.player;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * CONFIG.policeSpawnRadius;
  const z = p.z + Math.sin(angle) * CONFIG.policeSpawnRadius;
  const model = { name: 'Cruiser', kind: 'police', top: 46, accel: 30 };
  const mesh = buildCarMesh(G.rng, model, 0xf2f4f8);
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const unit = {
    mesh,
    model,
    color: 0xf2f4f8,
    x,
    z,
    heading: Math.atan2(p.x - x, p.z - z),
    speed: 0,
    steer: 0,
    condition: 100,
    traffic: false,
    target: null,
    honk: 0,
    stuck: 0,
    name: UNIT_NAMES[G.police.units.length % UNIT_NAMES.length],
    status: 'PURSUIT',
    ramAt: 0,
  };
  G.police.units.push(unit);
  G.cars.push(unit);
  return unit;
}

function spawnCop(G) {
  const p = G.player;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * 18;
  const z = p.z + Math.sin(angle) * 18;
  const mesh = buildFigure(G.rng, { shirt: 0x1c2330, skin: 0xc98d5f, hair: 0x14161a });
  // A navy cap marks the foot cop.
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x1c2330 }),
  );
  cap.position.y = 2.2;
  mesh.add(cap);
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const cop = { mesh, x, z, heading: 0, speed: 0, name: 'OFFICER', shoutAt: 0 };
  G.police.cops.push(cop);
  return cop;
}

export function spawnUnits(G, count) {
  for (let i = 0; i < count; i++) spawnUnit(G);
}

export function addWanted(G, amount, reason) {
  const pol = G.police;
  const before = pol.wanted;
  pol.wanted = clamp(pol.wanted + amount, 0, CONFIG.wantedMax);
  pol.lastCrimeAt = G.time;
  pol.inSight = true;
  if (pol.wanted > before) {
    const need = Math.min(pol.wanted, 4) - pol.units.length;
    for (let i = 0; i < need; i++) spawnUnit(G);
    if (pol.wanted >= 2 && pol.cops.length < 2) spawnCop(G);
    if (pol.wanted >= 1 && G.time - pol.dispatchAt > 12) {
      pol.dispatchAt = G.time;
      G.dialog.showDispatch(DISPATCH_LINES[pol.dispatchLine % DISPATCH_LINES.length]);
      pol.dispatchLine++;
    }
    if (reason) G.hud.toast(`Wanted ★${pol.wanted} — ${reason}`);
  }
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;

  // Wanted cools when the player stays out of trouble.
  if (pol.wanted > 0 && G.time - pol.lastCrimeAt > CONFIG.wantedDecaySeconds) {
    const nearest = pol.units.reduce((m, u) => Math.min(m, dist2D(u.x, u.z, p.x, p.z)), Infinity);
    if (nearest > 45 || pol.units.length === 0) {
      pol.wanted = Math.max(0, pol.wanted - dt * 0.25);
      if (pol.wanted < 1) {
        pol.wanted = 0;
        clearUnits(G);
        G.hud.toast('You lost them. The heat is off — for now.');
      }
    }
  }

  // Cruisers chase the player and ram.
  for (const u of pol.units) {
    const d = dist2D(u.x, u.z, p.x, p.z);
    const want = Math.atan2(p.x - u.x, p.z - u.z);
    u.heading = angleLerp(u.heading, want, clamp(dt * 2.4, 0, 1));
    const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : p.speed;
    const targetSpeed = d > 6 ? Math.min(CONFIG.policeCarSpeed, 26 + playerSpeed * 0.9) : 12;
    u.speed = lerp(u.speed, targetSpeed, clamp(dt * 1.6, 0, 1));
    u.x += Math.sin(u.heading) * u.speed * dt;
    u.z += Math.cos(u.heading) * u.speed * dt;
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    u.status = d < 10 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'CLOSING IN';
    if (d < 4 && G.time - u.ramAt > 1.2) {
      u.ramAt = G.time;
      G.audio.crash();
      G.effects.burst(p.x, 1, p.z);
      if (p.inCar) {
        p.inCar.condition = Math.max(0, p.inCar.condition - 6);
        p.inCar.speed *= 0.6;
      } else {
        damagePlayer(G, 12);
      }
      addShakeSafe(G, 0.5);
    }
  }

  // Foot cops close in and try to bust the player.
  for (const cop of pol.cops) {
    const d = dist2D(cop.x, cop.z, p.x, p.z);
    if (d > 60) {
      cop.x = p.x + (G.rng.next() - 0.5) * 30;
      cop.z = p.z + (G.rng.next() - 0.5) * 30;
    }
    const want = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.heading = angleLerp(cop.heading, want, clamp(dt * 4, 0, 1));
    const step = Math.min(CONFIG.policeFootSpeed * dt, d);
    cop.x += Math.sin(cop.heading) * step;
    cop.z += Math.cos(cop.heading) * step;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    const swing = Math.sin(G.time * 10 + cop.x) * 0.7;
    const armL = cop.mesh.getObjectByName('armL');
    const armR = cop.mesh.getObjectByName('armR');
    if (armL) armL.rotation.x = swing;
    if (armR) armR.rotation.x = -swing;
    if (d < 2.5 && G.time - cop.shoutAt > 4) {
      cop.shoutAt = G.time;
      G.dialog.showDispatch(COP_LINES[Math.floor(G.rng.next() * COP_LINES.length)], 'mbpd');
    }
  }

  // Busted: a cop standing next to the player for 2.5 s ends the run.
  if (pol.wanted > 0) {
    const close = pol.cops.some((c) => dist2D(c.x, c.z, p.x, p.z) < CONFIG.bustDistance)
      || pol.units.some((u) => dist2D(u.x, u.z, p.x, p.z) < CONFIG.bustDistance && !p.inCar);
    if (close) {
      pol.bustTimer += dt;
      if (pol.bustTimer > CONFIG.bustSeconds) {
        pol.bustTimer = 0;
        G.events.push({ type: 'busted' });
      }
    } else {
      pol.bustTimer = 0;
    }
  }

  // Air One: helicopter + spotlight at 3+ stars.
  pol.heliActive = pol.wanted >= CONFIG.heliWantedAt;
  pol.heli.visible = pol.heliActive;
  if (pol.heliActive) {
    pol.heliRotor.rotation.y += dt * 22;
    // Hover ahead-above the player, so the helicopter and its
    // spotlight cone are in the chase camera's frame.
    const hx = p.x + 8;
    const hz = p.z + 22;
    pol.heli.position.set(hx, 30, hz);
    pol.heli.rotation.y = Math.atan2(p.x - hx, p.z - hz);
  }

  // In-sight flag: any unit within 35 m sees the player.
  pol.inSight = pol.units.some((u) => dist2D(u.x, u.z, p.x, p.z) < 35)
    || pol.cops.some((c) => dist2D(c.x, c.z, p.x, p.z) < 20);

  // Siren ambience, paced so it never overlaps itself.
  if (pol.wanted > 0 && Math.floor(G.time * 2) !== Math.floor((G.time - dt) * 2)) {
    G.audio.sirenTick(pol.wanted);
  }
}

function clearUnits(G) {
  for (const u of G.police.units) {
    G.view.scene.remove(u.mesh);
    const i = G.cars.indexOf(u);
    if (i >= 0) G.cars.splice(i, 1);
  }
  for (const c of G.police.cops) G.view.scene.remove(c.mesh);
  G.police.units = [];
  G.police.cops = [];
}

function addShakeSafe(G, amount) {
  if (G.rig) G.rig.shake = Math.min(1.2, (G.rig.shake || 0) + amount);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function policePanelData(G) {
  const out = [];
  const p = G.player;
  for (const u of G.police.units) {
    out.push({
      name: u.name,
      dist: Math.round(dist2D(u.x, u.z, p.x, p.z)),
      status: u.status,
    });
  }
  if (G.police.heliActive) {
    out.push({ name: 'AIR ONE', dist: 42, status: 'SPOTLIGHT' });
  }
  if (G.police.wanted >= 4) {
    out.push({ name: 'ROADBLOCK', dist: 120, status: 'SET UP' });
  }
  return out.slice(0, 5);
}
