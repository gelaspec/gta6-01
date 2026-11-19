// Meridian Bay — the MBPD. Wanted 0-5 stars, cruisers that chase and ram,
// foot cops, and AIR ONE, the helicopter with a spotlight at 3+ stars.
// Named units with distance + status feed the police panel in the HUD.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCar, CAR_CLASSES } from './vehicles.js';

const UNIT_NAMES = ['UNIT 7', 'UNIT 12', 'UNIT 4', 'UNIT 9', 'UNIT 21', 'UNIT 3', 'UNIT 18', 'UNIT 6'];

function buildHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c4fd6 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9be8ff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), bodyMat);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), glass);
  nose.position.set(0, 0.1, 2.4);
  nose.scale.set(1, 0.8, 1);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), bodyMat);
  tail.position.set(0, 0.3, -3.8);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.9), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  fin.position.set(0, 1.0, -5.4);
  g.add(fin);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), rotorMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), rotorMat);
  tailRotor.position.set(0.3, 0.6, -5.4);
  g.add(tailRotor);
  const skids = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.4), rotorMat);
  skids.position.y = -0.9;
  g.add(skids);
  // spotlight cone (translucent, points down)
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 16, 1, true), coneMat);
  cone.rotation.x = Math.PI;
  cone.position.y = -20;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff2b8, 3.2, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  spot.target.position.set(0, -42, 0);
  g.add(spot);
  g.add(spot.target);
  return { group: g, rotor, cone, spot };
}

export function createPolice(scene, city, rng) {
  const units = []; // { car, name, status, dist }
  const cops = []; // foot cops { mesh, pos, heading }
  const heli = buildHeli();
  heli.group.visible = false;
  scene.add(heli.group);
  let wanted = 0;
  let heat = 0; // 0..100, decays when hidden
  let escapeTimer = 0;
  let spawnCooldown = 0;

  function unitCountForStars(s) {
    return s === 0 ? 0 : s === 1 ? 1 : s === 2 ? 2 : s === 3 ? 3 : s === 4 ? 4 : 5;
  }

  function spawnUnit(near) {
    const name = UNIT_NAMES[units.length % UNIT_NAMES.length];
    const p = city.randomRoadPoint();
    const car = createCar(scene, 6, undefined, p.x, p.z, 0);
    car.speed = CONFIG.policeSpeed * 0.6;
    units.push({ car, name, status: 'RESPONDING', dist: 0 });
    return car;
  }

  function syncUnits(targetPos) {
    const want = unitCountForStars(wanted);
    while (units.length < want) spawnUnit(targetPos);
    while (units.length > want) {
      const u = units.pop();
      scene.remove(u.car.mesh);
    }
  }

  function addHeat(n) {
    heat = Math.min(100, heat + n);
    const newWanted = heat <= 0 ? 0 : heat < 20 ? 1 : heat < 40 ? 2 : heat < 60 ? 3 : heat < 85 ? 4 : 5;
    if (newWanted !== wanted) wanted = newWanted;
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
    heat = wanted * 18;
  }

  function update(dt, targetPos, targetSpeed, inCar) {
    syncUnits(targetPos);
    spawnCooldown -= dt;
    // heat decays when the player is far from every unit
    let nearest = Infinity;
    for (const u of units) {
      const d = Math.hypot(u.car.pos.x - targetPos.x, u.car.pos.z - targetPos.z);
      u.dist = Math.round(d);
      if (d < nearest) nearest = d;
    }
    if (wanted > 0 && nearest > 90) {
      escapeTimer += dt;
      if (escapeTimer > 6) {
        heat -= dt * 8;
        if (heat <= 0) { wanted = 0; heat = 0; escapeTimer = 0; }
      }
    } else {
      escapeTimer = 0;
    }
    // cruisers pursue: steer toward the target, ram on contact
    for (const u of units) {
      const car = u.car;
      const dx = targetPos.x - car.pos.x;
      const dz = targetPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const maxTurn = 2.6 * dt;
      car.heading += Math.max(-maxTurn, Math.min(maxTurn, dh));
      const speed = dist > 14 ? CONFIG.policeSpeed : CONFIG.policeSpeed * 0.55;
      car.speed += (speed - car.speed) * Math.min(1, dt * 1.6);
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      const res = city.resolveCollision(nx, nz, 1.6);
      car.pos.x = res.x;
      car.pos.z = res.z;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      if (dist < 4) u.status = 'RAMMING';
      else if (dist < 18) u.status = 'PURSUIT';
      else if (dist < 45) u.status = 'CLOSING IN';
      else u.status = 'RESPONDING';
    }
    // helicopter at 3+ stars: orbit above the target, spotlight on
    if (wanted >= 3) {
      heli.group.visible = true;
      const t = performance.now() * 0.0004;
      const hx = targetPos.x + Math.cos(t) * 26;
      const hz = targetPos.z + Math.sin(t) * 26;
      heli.group.position.set(hx, CONFIG.heliHeight, hz);
      heli.group.rotation.y = Math.atan2(targetPos.x - hx, targetPos.z - hz);
      heli.rotor.rotation.y += dt * 22;
      heli.spot.target.position.set(targetPos.x - hx, -CONFIG.heliHeight, targetPos.z - hz);
    } else {
      heli.group.visible = false;
    }
    // foot cops at 1-2 stars: walk toward the player
    if (wanted >= 1 && wanted <= 2 && cops.length < 2 && spawnCooldown <= 0) {
      spawnCooldown = 4;
      const p = city.sidewalkPoint();
      const mesh = new THREE.Group();
      const uni = new THREE.MeshLambertMaterial({ color: 0x1c4fd6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), uni);
      body.position.y = 1.18;
      mesh.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.32), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.76;
      mesh.add(head);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x111827 }));
      cap.position.y = 1.98;
      mesh.add(cap);
      mesh.position.set(p.x, 0, p.z);
      scene.add(mesh);
      cops.push({ mesh, pos: mesh.position, heading: 0 });
    }
    for (const c of cops) {
      const dx = targetPos.x - c.pos.x;
      const dz = targetPos.z - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      c.pos.x += (dx / d) * 3.4 * dt;
      c.pos.z += (dz / d) * 3.4 * dt;
      c.mesh.rotation.y = Math.atan2(dx, dz);
      c.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008)) * 0.06;
    }
    if (wanted === 0) {
      for (const c of cops) scene.remove(c.mesh);
      cops.length = 0;
    }
    return { nearest, escapeTimer };
  }

  // Stage a formation for a screenshot: cruisers at fixed offsets from the
  // target. `back` is metres behind the target along its heading (negative =
  // ahead of the target); `face: 'toward'` turns the unit to face the target
  // (roadblock composition — the units stay in front of the chase camera).
  function stageFormation(targetPos, targetHeading, offsets) {
    syncUnits(targetPos);
    units.forEach((u, i) => {
      const off = offsets[i % offsets.length];
      const fx = Math.sin(targetHeading);
      const fz = Math.cos(targetHeading);
      const rx = Math.cos(targetHeading);
      const rz = -Math.sin(targetHeading);
      u.car.pos.set(
        targetPos.x - fx * off.back + rx * off.side,
        0,
        targetPos.z - fz * off.back + rz * off.side,
      );
      u.car.heading = off.face === 'toward' ? targetHeading + Math.PI : targetHeading;
      u.car.speed = CONFIG.policeSpeed * 0.8;
      u.car.mesh.position.copy(u.car.pos);
      u.car.mesh.rotation.y = u.car.heading;
      u.dist = Math.round(Math.hypot(off.back, off.side));
      u.status = i === 0 ? 'PURSUIT' : 'CLOSING IN';
    });
    if (wanted >= 3) {
      heli.group.visible = true;
      // Hover ahead of the target, low enough to sit inside the frame: at
      // 50m ahead and 16m up the heli reads clearly in a chase shot, clear
      // of the dispatch ticker, and its spotlight cone cuts down to the road.
      const fx = Math.sin(targetHeading);
      const fz = Math.cos(targetHeading);
      const rx = Math.cos(targetHeading);
      const rz = -Math.sin(targetHeading);
      heli.group.position.set(
        targetPos.x + fx * 50 + rx * 10,
        16,
        targetPos.z + fz * 50 + rz * 10,
      );
      heli.group.rotation.y = Math.atan2(targetPos.x - heli.group.position.x, targetPos.z - heli.group.position.z);
      heli.spot.target.position.set(-fx * 50 - rx * 10, -16, -fz * 50 - rz * 10);
    }
  }

  return {
    get wanted() { return wanted; },
    get heat() { return heat; },
    units,
    heli,
    addHeat, setWanted, update, stageFormation,
    get heliVisible() { return heli.group.visible; },
  };
}
