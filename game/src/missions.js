// Meridian Bay — the story: 6 missions in "The Meridian Job", each a short
// chain of stages (steal / goto / collect / timed / wanted / escape / ram /
// grab), plus 10 hidden packages and taxi fares on the side. The mission
// panel, the waypoint beacon and the minimap blip all read this state.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { briefLine } from './dialog.js';

function beacon(color) {
  const geo = new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 30;
  const ringGeo = new THREE.TorusGeometry(2.4, 0.25, 8, 32);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const group = new THREE.Group();
  group.add(mesh, ring);
  return group;
}

export class Missions {
  constructor(scene, rng, game) {
    this.scene = scene;
    this.rng = rng;
    this.game = game;
    this.index = 0; // current mission in CONFIG.missions
    this.stage = 0;
    this.done = 0; // missions completed
    this.timer = 0;
    this.timeLimit = 0;
    this.collected = 0; // drops collected in the current collect stage
    this.packagesFound = 0;
    this.packages = [];
    this.beacon = null;
    this.beaconTarget = null;
    this.taxi = null; // {ped, target, fare, active}
    this.finished = false;
    this.objective = 'Press Enter to start';
    this.spawnPackages();
    this.setMission(0);
  }

  get mission() {
    return CONFIG.missions[this.index];
  }

  get stageDef() {
    const m = this.mission;
    if (!m) return null;
    return m.stages[Math.min(this.stage, m.stages.length - 1)];
  }

  spawnPackages() {
    const geo = new THREE.OctahedronGeometry(0.9);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
    for (let i = 0; i < CONFIG.side.packages; i++) {
      const x = this.rng.range(-185, 185);
      const z = this.rng.range(-185, 185);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 1.2, z);
      this.scene.add(mesh);
      this.packages.push({ mesh, x, z, found: false });
    }
  }

  setMission(i) {
    this.index = i;
    this.stage = 0;
    this.collected = 0;
    this.timer = 0;
    const m = this.mission;
    if (!m) {
      this.finished = true;
      this.objective = 'Story complete — Meridian Bay is yours';
      this.clearBeacon();
      return;
    }
    this.timeLimit = m.timeLimit || 0;
    this.game.dialog.say(briefLine(m), 7);
    this.game.hud.toast(`${m.chapter} — ${m.name}`);
    this.applyStage();
  }

  applyStage() {
    const s = this.stageDef;
    if (!s) return;
    this.objective = s.text;
    if (s.type === 'timed') this.timer = this.timeLimit;
    if (s.target) this.setBeacon(s.target[0], s.target[1]);
    else if (s.targets) this.setBeacon(s.targets[this.collected][0], s.targets[this.collected][1]);
    else this.clearBeacon();
  }

  setBeacon(x, z) {
    this.clearBeacon();
    this.beacon = beacon(0xffd23c);
    this.beacon.position.set(x, 0, z);
    this.scene.add(this.beacon);
    this.beaconTarget = { x, z };
  }

  clearBeacon() {
    if (this.beacon) {
      this.scene.remove(this.beacon);
      this.beacon = null;
      this.beaconTarget = null;
    }
  }

  completeStage() {
    const m = this.mission;
    this.stage += 1;
    this.game.audio.pickup();
    if (this.stage >= m.stages.length) this.completeMission();
    else this.applyStage();
  }

  completeMission() {
    const m = this.mission;
    this.game.money += m.reward;
    this.done += 1;
    this.game.rep = Math.min(100, this.game.rep + CONFIG.side.repPerMission);
    this.game.audio.missionDone();
    this.game.hud.toast(`MISSION PASSED — ${m.name}  +$${m.reward.toLocaleString('en-US')}`);
    const rating = this.game.player.health > 70 ? 3 : this.game.player.health > 40 ? 2 : 1;
    const mins = Math.floor(this.game.time / 60);
    const secs = Math.floor(this.game.time % 60);
    this.game.hud.showPassed({
      chapter: m.chapter,
      name: m.name,
      reward: m.reward,
      rating,
      stats: `TIME ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}  •  DAMAGE ${Math.round(100 - this.game.player.health)}%  •  PACKAGES ${this.packagesFound}/10  •  TOP SPEED ${Math.round(166)} KM/H`,
    });
    this.game.dialog.say({
      name: m.giver, role: m.role,
      text: `Clean work, Cassian. $${m.reward.toLocaleString('en-US')} is yours.`,
    }, 5);
    this.game.saveGame();
    if (this.done >= CONFIG.missions.length) {
      this.game.storyComplete();
      return;
    }
    this.setMission(this.index + 1);
  }

  // Called when the player picks up a hidden package.
  checkPackages() {
    const p = this.game.player.pos;
    for (const pkg of this.packages) {
      if (pkg.found) continue;
      if (Math.hypot(pkg.x - p.x, pkg.z - p.z) < 2.2) {
        pkg.found = true;
        pkg.mesh.visible = false;
        this.packagesFound += 1;
        this.game.money += CONFIG.side.packageReward;
        this.game.audio.pickup();
        this.game.hud.toast(`HIDDEN PACKAGE ${this.packagesFound}/10  +$${CONFIG.side.packageReward}`);
        this.game.dialog.say({ name: 'Inez Kade', role: 'FIXER', text: 'One package down. Keep them coming — each one pays.' }, 4);
      }
    }
  }

  startTaxi(ped) {
    if (this.taxi) return;
    const tx = this.rng.range(-170, 170);
    const tz = this.rng.range(-170, 170);
    this.taxi = { ped, target: { x: tx, z: tz }, fare: CONFIG.side.taxiFare, active: true };
    this.setBeacon(tx, tz);
    this.game.dialog.say({ name: 'Passenger', role: 'FARE', text: 'Marina, please — and step on it, I am late for a boat.' }, 5);
    this.objective = 'Taxi fare: take the passenger to the marker';
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (this.finished) return;
    // beacon pulse
    if (this.beacon) {
      this.beacon.rotation.y += dt * 1.5;
      const s = 1 + Math.sin(g.time * 3) * 0.08;
      this.beacon.scale.set(s, 1, s);
    }
    // package glow spin
    for (const pkg of this.packages) {
      if (!pkg.found) {
        pkg.mesh.rotation.y += dt * 2;
        pkg.mesh.position.y = 1.2 + Math.sin(g.time * 2 + pkg.x) * 0.25;
      }
    }
    if (this.taxi && this.taxi.active) {
      const t = this.taxi.target;
      if (Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < 5) {
        g.money += this.taxi.fare;
        g.audio.pickup();
        g.hud.toast(`FARE COMPLETE  +$${this.taxi.fare}`);
        this.taxi = null;
        this.applyStage();
      }
      return;
    }
    const s = this.stageDef;
    if (!s) return;
    const px = p.pos.x;
    const pz = p.pos.z;
    if (s.type === 'timed') {
      this.timer -= dt;
      if (this.timer <= 0) {
        g.hud.toast('TOO SLOW — the courier run failed. Try again.');
        this.setMission(this.index); // restart the mission
        return;
      }
    }
    switch (s.type) {
      case 'steal':
        if (!p.onFoot) this.completeStage();
        break;
      case 'goto':
      case 'grab': {
        if (s.target && Math.hypot(s.target[0] - px, s.target[1] - pz) < 6) {
          if (s.type === 'grab' && !g.input.pressed('KeyE')) break;
          this.completeStage();
        }
        break;
      }
      case 'collect': {
        const t = s.targets[this.collected];
        if (t && Math.hypot(t[0] - px, t[1] - pz) < 5) {
          this.collected += 1;
          g.money += 150;
          g.audio.pickup();
          this.objective = `Collect the drops in Calle Verde (${this.collected}/3)`;
          if (this.collected >= s.targets.length) this.completeStage();
          else this.setBeacon(s.targets[this.collected][0], s.targets[this.collected][1]);
        }
        break;
      }
      case 'wanted':
        if (g.police.wanted >= s.wanted) this.completeStage();
        break;
      case 'escape':
        if (g.police.wanted === 0 && this.stage > 0) {
          // only completes once the heat was actually raised in this mission
          if (g.police.everWanted) this.completeStage();
        }
        break;
      case 'ram': {
        const van = g.heistVan;
        if (van && Math.hypot(van.pos.x - px, van.pos.z - pz) < 6) {
          g.money += 800;
          g.effects.burst(van.pos, 0xffd23c, 24);
          g.audio.gunshot();
          g.hud.toast('VAN CRACKED  +$800');
          this.completeStage();
        }
        break;
      }
      default:
        break;
    }
  }
}
