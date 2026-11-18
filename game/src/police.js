// Wanted level and the MBPD response: police cruisers that ram and
// chase, foot cops that close in, a helicopter with a spotlight at
// 3+ stars, dispatch radio lines, and the named-unit response panel
// the HUD shows during a chase.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2D } from './random.js';
import { buildCarMesh } from './vehicles.js';
import { buildFigure } from './player.js';

const UNIT_NAMES = ['UNIT 7', 'UNIT 12', 'UNIT 4', 'UNIT 21', 'UNIT 9', 'UNIT 16'];
const DISPATCH_LINES = [
  'Three stars on the runner. Two cruisers in pursuit — box him in.',
  'Suspect heading down Coast Road. All units converge.',
  'He is driving a stolen Comet GT. Do not let him reach the pier.',
  'Roadblock on Harbor Ave. Spike strip ready.',
  'Air One has the spotlight. Keep him in the light.',
  'He is slipping through Downtown. Cut him off at Marina Blvd.',
];
const COP_LINES = [
  'MBPD! On the ground!',
  'Stop right there!',
  'You are coming with me!',
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
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 20, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  // No rotation: the cone's apex sits at the helicopter and its wide
  // base opens onto the road below, like a real spotlight.
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
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = px + Math.cos(angle) * CONFIG.policeSpawnRadius;
  const z = pz + Math.sin(angle) * CONFIG.policeSpawnRadius;
  const model = { name: 'Cruiser', kind: 'police', top: 46, accel: 30 };
  const mesh = buildCarMesh(G.rng, model, 0xe8ecf0);
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const unit = {
    mesh, model, x, z,
    heading: Math.atan2(px - x, pz - z),
    speed: 0,
    name: UNIT_NAMES[G.police.units.length % UNIT_NAMES.length],
    status: 'PURSUIT',
    ramAt: 0,
  };
  G.police.units.push(unit);
  return unit;
}

function spawnCop(G) {
  const p = G.player;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * 18;
  const z = p.z + Math.sin(angle) * 18;
  const mesh = buildFigure(G.rng, { shirt: 0x1c2330, pants: 0x1c2330, hat: 0x1c2330 });
  mesh.position.set(x, 0, z);
  G.view.scene.add(mesh);
  const cop = { mesh, x, z, heading: 0, speed: CONFIG.policeFootSpeed, lineAt: 0 };
  G.police.cops.push(cop);
  return cop;
}

export function spawnUnits(G, count) {
  while (G.police.units.length < count) spawnUnit(G);
}

export function addWanted(G, amount, reason) {
  const pol = G.police;
  if (pol.wanted >= CONFIG.wantedMax && amount > 0) return;
  pol.wanted = clamp(pol.wanted + amount, 0, CONFIG.wantedMax);
  pol.lastCrimeAt = G.time;
  pol.inSight = true;
  if (pol.wanted >= 1 && pol.units.length < 1) spawnUnit(G);
  if (pol.wanted >= 2 && pol.cops.length < 1) spawnCop(G);
  if (pol.wanted >= 3 && !pol.heliActive) {
    pol.heliActive = true;
    pol.heli.visible = true;
    G.hud.toast('MBPD Air One is overhead — lose the spotlight!');
  }
  if (amount > 0) {
    G.hud.toast(`${reason} — wanted level ${pol.wanted}.`);
    G.audio.sirenBurst();
  }
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : p.speed;

  // Wanted decays when the player is far from every unit and quiet.
  if (pol.wanted > 0 && G.time - pol.lastCrimeAt > CONFIG.wantedDecaySeconds) {
    let nearest = Infinity;
    for (const u of pol.units) nearest = Math.min(nearest, dist2D(px, pz, u.x, u.z));
    for (const c of pol.cops) nearest = Math.min(nearest, dist2D(px, pz, c.x, c.z));
    if (nearest > 45) {
      pol.wanted = Math.max(0, pol.wanted - dt * 0.25);
      if (pol.wanted < 1) {
        pol.wanted = 0;
        pol.inSight = false;
        clearUnits(G);
      }
    }
  }

  // Dispatch radio: a fresh line every ~20 s while wanted.
  if (pol.wanted >= 1 && G.time - pol.dispatchAt > 20) {
    pol.dispatchAt = G.time;
    pol.dispatchLine = (pol.dispatchLine + 1) % DISPATCH_LINES.length;
    G.dialog.showDispatch(DISPATCH_LINES[pol.dispatchLine]);
  }

  const wantUnits = pol.wanted >= 4 ? 3 : pol.wanted >= 2 ? 2 : pol.wanted >= 1 ? 1 : 0;
  while (pol.units.length < wantUnits) spawnUnit(G);

  for (const u of pol.units) {
    const d = dist2D(px, pz, u.x, u.z);
    const want = Math.atan2(px - u.x, pz - u.z);
    // Ram when close, pursue otherwise; one unit tries to cut ahead.
    const isBlocker = pol.units.indexOf(u) === 1 && d < 40;
    const targetHeading = isBlocker ? want + Math.PI * 0.35 : want;
    let turn = 2.4;
    u.heading += clamp(((targetHeading - u.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -turn * dt, turn * dt);
    const targetSpeed = d > 60 ? CONFIG.policeCarSpeed : CONFIG.policeCarSpeed * 0.85;
    u.speed += (targetSpeed - u.speed) * Math.min(1, dt * 1.2);
    u.x += Math.sin(u.heading) * u.speed * dt;
    u.z += Math.cos(u.heading) * u.speed * dt;
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    u.status = d < 10 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'CLOSING IN';
    if (d < 4.5 && playerSpeed < 12) {
      u.ramAt += dt;
      if (u.ramAt > 0.5) {
        u.ramAt = 0;
        if (p.inCar) {
          p.inCar.speed *= 0.4;
          p.inCar.condition = Math.max(20, p.inCar.condition - 6);
          G.effects.crashSparks(u.x, u.z);
          G.audio.thud();
        }
      }
    } else {
      u.ramAt = 0;
    }
  }

  for (const c of pol.cops) {
    const d = dist2D(px, pz, c.x, c.z);
    const want = Math.atan2(px - c.x, pz - c.z);
    c.heading += clamp(((want - c.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -3 * dt, 3 * dt);
    if (d > 2 && !p.inCar) {
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
    }
    const parts = c.mesh.userData.parts;
    const swing = Math.sin(G.time * 9) * 0.5;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    if (d < 8 && G.time - c.lineAt > 8) {
      c.lineAt = G.time;
      G.dialog.showDispatch(G.rng.pick(COP_LINES), 'mbpd');
    }
  }

  // Helicopter: hovers ahead-above the player, rotor spinning, spotlight
  // on — ahead so the chase camera sees it in frame.
  if (pol.heliActive && pol.wanted >= CONFIG.heliWantedAt) {
    pol.heli.visible = true;
    pol.heli.position.set(px + 12, 20, pz + 70);
    pol.heli.rotation.y = Math.atan2(px - pol.heli.position.x, pz - pol.heli.position.z);
    pol.heliRotor.rotation.y += dt * 22;
    pol.heli.position.y = 20 + Math.sin(G.time * 0.8) * 1.5;
  } else if (pol.heliActive && pol.wanted < CONFIG.heliWantedAt) {
    pol.heli.visible = false;
    pol.heliActive = false;
  }

  // Busted: a cop or cruiser sits on the player while on foot.
  if (pol.wanted > 0 && !p.inCar) {
    let closest = Infinity;
    for (const c of pol.cops) closest = Math.min(closest, dist2D(px, pz, c.x, c.z));
    for (const u of pol.units) closest = Math.min(closest, dist2D(px, pz, u.x, u.z));
    if (closest < CONFIG.bustDistance && playerSpeed < 1) {
      pol.bustTimer += dt;
      if (pol.bustTimer > CONFIG.bustSeconds) {
        pol.bustTimer = 0;
        G.events.push({ type: 'busted' });
      }
    } else {
      pol.bustTimer = 0;
    }
  } else {
    pol.bustTimer = 0;
  }
}

function clearUnits(G) {
  for (const u of G.police.units) G.view.scene.remove(u.mesh);
  for (const c of G.police.cops) G.view.scene.remove(c.mesh);
  G.police.units = [];
  G.police.cops = [];
  G.police.heli.visible = false;
  G.police.heliActive = false;
}

export function policePanelData(G) {
  const pol = G.police;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;
  const rows = [];
  for (const u of pol.units) {
    rows.push({ name: u.name, dist: Math.round(dist2D(px, pz, u.x, u.z)), status: u.status });
  }
  if (pol.heliActive) rows.push({ name: 'AIR ONE', dist: 34, status: 'SPOTLIGHT ON YOU' });
  if (pol.wanted >= 2) rows.push({ name: 'ROADBLOCK', dist: 120, status: 'SET UP' });
  const code = pol.wanted >= 4 ? 'CODE 3 · AIR SUPPORT ACTIVE' : pol.wanted >= 2 ? 'CODE 2 · AIR SUPPORT ON STANDBY' : 'CODE 1 · PATROL RESPONSE';
  return { rows, code, count: pol.units.length + (pol.heliActive ? 1 : 0) };
}
