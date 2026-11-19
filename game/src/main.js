// Meridian Bay — boot and the main loop. One Game owns every system, the
// state machine (title / play / pause / busted / complete), the fixed-step
// update, entering and leaving cars, and the deterministic shot mode
// (?shot=chase|foot|dialog|passed) that the screenshots are taken from.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { RNG } from './random.js';
import { City } from './city.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Traffic, Car } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { Dialog } from './dialog.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Save } from './save.js';
import { applyShot } from './shots.js';

const START_POS = { x: -40, z: 30 };

export class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed') || 7);
    this.shotMode = params.get('shot') || null;
    this.rng = new RNG(this.seed);
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.scene = this.renderer.scene;
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.dialog = new Dialog();
    this.hud = new HUD();
    this.city = new City(this.scene, this.rng);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.rng, this.city);
    this.peds = new Pedestrians(this.scene, this.rng);
    this.police = new Police(this.scene, this.rng, this.city);
    this.combat = new Combat(this.scene, this.renderer.camera);
    this.effects = new Effects(this.scene, this.renderer);
    this.missions = new Missions(this.scene, this.rng, this);
    this.dialog.onShow = (line) => this.hud.showDialog(line);
    this.dialog.onHide = () => this.hud.hideDialog();

    // the Harbor Kings van, parked at the end of the pier for M5
    const vanModel = CONFIG.carModels.find((m) => m.van);
    this.heistVan = new Car(this.scene, vanModel, 258, 0, Math.PI / 2);
    this.heistVan.pos.y = 0.75; // sit on the pier planks, not in them
    this.traffic.cars.push(this.heistVan);

    this.money = CONFIG.side.startCash;
    this.rep = 0;
    this.day = 1;
    this.clockMin = 9 * 60 + 15;
    this.time = 0;
    this.state = 'title';
    this.shotWarmup = 0;
    this.titleAngle = 0;
    this.last = performance.now();
    this.raf = 0;

    // restore a previous run, if there is one
    const saved = Save.load();
    if (saved) {
      this.money = Math.max(this.money, saved.money);
      this.rep = saved.rep;
      if (saved.mission > 0 && saved.mission < CONFIG.missions.length) {
        this.missions.setMission(saved.mission);
      }
    }
    if (this.shotMode) {
      this.input.enabled = false;
      this.state = 'play';
      this.hud.hideScreens();
      applyShot(this, this.shotMode);
      window.__shotId = this.shotMode;
      this.shotWarmup = 50; // fixed frames before the shot is declared ready
    } else {
      this.hud.showScreen('title');
      const best = saved ? `BEST: $${saved.money.toLocaleString('en-US')}  •  MISSIONS ${saved.mission}/6  •  PACKAGES ${saved.packages}/10` : 'NO SAVE YET — A FRESH START IN MERIDIAN BAY';
      this.hud.setTitleBest(best);
    }
    this.hud.update(this, 0);
    window.__game = this;
    window.addEventListener('error', (e) => {
      window.__shotError = String(e.message || e.error || 'unknown error');
    });
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  clockText() {
    const h = Math.floor(this.clockMin / 60) % 24;
    const m = Math.floor(this.clockMin % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  saveGame() {
    Save.store({
      money: this.money,
      mission: this.missions.index,
      packages: this.missions.packagesFound,
      rep: this.rep,
      best: this.money,
    });
  }

  enterCar(car, silent = false) {
    const p = this.player;
    p.car = car;
    car.isPlayer = true;
    p.onFoot = false;
    p.mesh.visible = false;
    if (!silent) {
      if (!car.stolen && car !== this.traffic.hero) {
        car.stolen = true;
        this.police.addWanted(1, this.time);
        this.hud.toast('CAR STOLEN — MBPD NOTIFIED');
      } else if (car === this.traffic.hero && !car.stolen) {
        car.stolen = true;
        this.police.addWanted(1, this.time);
        this.hud.toast('COMET GT — YOURS NOW');
      }
      this.audio.blip(660, 0.08);
    }
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    car.isPlayer = false;
    p.car = null;
    p.onFoot = true;
    p.pos.set(car.pos.x + 2.5, 0, car.pos.z + 1.5);
    p.heading = car.heading;
    p.mesh.visible = true;
    p.syncMesh();
  }

  busted(reason) {
    if (this.state !== 'play') return;
    this.state = 'busted';
    this.police.setWanted(0, this.time);
    this.audio.siren(false);
    this.hud.setBusted(reason || 'The MBPD boxed you in.');
    this.hud.showScreen('busted');
    this.dialog.say({ name: 'MBPD Dispatch', role: 'DISPATCH', text: 'Suspect in custody. Units stand down. The Bay stays quiet — tonight.' }, 6);
    this.saveGame();
  }

  storyComplete() {
    if (this.state !== 'play') return;
    this.state = 'complete';
    this.audio.siren(false);
    const stats = `MONEY ${this.money.toLocaleString('en-US')}  •  MISSIONS 6/6  •  PACKAGES ${this.missions.packagesFound}/10  •  REP ${Math.round(this.rep)}%  •  DAY ${this.day}`;
    this.hud.setComplete(stats);
    this.hud.showScreen('complete');
    this.dialog.say({ name: 'Inez Kade', role: 'FIXER', text: 'Thirty-one thousand and change, Cassian. The Meridian Job is done. Meridian Bay is ours.' }, 8);
    this.saveGame();
  }

  restart() {
    this.player.reset(START_POS.x, START_POS.z, 0);
    this.player.health = CONFIG.player.health;
    this.police.setWanted(0, this.time);
    this.police.everWanted = false;
    this.combat.reset();
    this.hud.hideScreens();
    this.state = 'play';
  }

  // -- per-frame ---------------------------------------------------------------
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.state === 'title') {
      this.titleAngle += dt * 0.05;
      const cx = Math.cos(this.titleAngle) * 150;
      const cz = Math.sin(this.titleAngle) * 150;
      this.renderer.place([cx, 70, cz], [0, 8, 0]);
      this.effects.update(dt);
      this.renderer.render();
      if (this.input.pressed('Enter')) {
        this.input.enabled = true;
        this.hud.hideScreens();
        this.state = 'play';
        this.missions.setMission(this.missions.index);
      }
      this.input.endFrame();
      return;
    }
    if (this.state === 'pause') {
      if (this.input.pressed('Escape') || this.input.pressed('Enter')) {
        this.hud.hideScreens();
        this.state = 'play';
      }
      this.input.endFrame();
      return;
    }
    if (this.state === 'busted' || this.state === 'complete') {
      this.renderer.render();
      if (this.input.pressed('KeyR') || this.input.pressed('Enter')) {
        if (this.state === 'busted') this.restart();
        else this.restart();
      }
      this.input.endFrame();
      return;
    }
    this.update(dt);
    this.input.endFrame();
  }

  update(dt) {
    this.time += dt;
    this.clockMin += dt * 0.5; // one game minute every two real seconds
    if (this.clockMin >= 24 * 60) {
      this.clockMin -= 24 * 60;
      this.day += 1;
    }
    const input = this.input;
    // global keys
    if (input.pressed('Escape')) {
      this.hud.showScreen('pause');
      this.state = 'pause';
      return;
    }
    if (input.pressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (input.pressed('KeyC')) this.renderer.far = !this.renderer.far;
    if (input.pressed('Enter')) this.dialog.skip();
    if (input.pressed('KeyQ')) {
      const r = this.audio.nextRadio();
      this.hud.toast(`${r.station} — ${r.song}`);
    }
    // camera orbit from mouse drag
    if (input.mouseDX !== 0) this.renderer.yaw += input.mouseDX * 0.004;
    if (input.mouseDY !== 0) this.renderer.pitch = Math.max(0.05, Math.min(0.9, this.renderer.pitch + input.mouseDY * 0.002));

    const p = this.player;
    const camYaw = Math.atan2(
      this.renderer.camera.position.x - p.focusPoint().x,
      this.renderer.camera.position.z - p.focusPoint().z,
    ) + Math.PI;
    // enter / leave cars
    if (input.pressed('KeyE')) {
      if (p.onFoot) {
        const car = this.traffic.nearestCar(p.pos.x, p.pos.z, 3.5);
        if (car) this.enterCar(car);
        else if (this.missions.stageDef && this.missions.stageDef.type === 'grab') {
          // vault grab handled by the mission update
        }
      } else {
        this.exitCar();
      }
    }
    // taxi fare: T while driving past a pedestrian
    if (input.pressed('KeyT') && !p.onFoot && !this.missions.taxi) {
      const near = this.peds.near(p.pos.x, p.pos.z, 7)[0];
      if (near) {
        near.mesh.visible = false;
        near.alive = false;
        this.missions.startTaxi(near);
      }
    }
    // driving or walking
    let tireSmoke = false;
    if (!p.onFoot && p.car) {
      tireSmoke = p.car.drive(dt, input, this.city);
      if (tireSmoke) {
        this.effects.smoke(p.car.pos, 2);
      }
    } else {
      p.update(dt, input, this.city, camYaw);
    }
    // threats that make pedestrians run: gunfire, fast cars
    const threats = [];
    if (this.combat.shootTimer > 0.1) threats.push({ x: p.pos.x, z: p.pos.z, radius: 26 });
    if (p.car && Math.abs(p.car.speed) > 14) threats.push({ x: p.car.pos.x, z: p.car.pos.z, radius: 10 });
    this.traffic.update(dt, p.car, this.time);
    this.peds.update(dt, threats);
    // police
    const events = [];
    this.police.update(dt, this.time, p.focusPoint(), p.focusSpeed(), p.onFoot, events);
    for (const e of events) {
      if (e.type === 'busted') this.busted('The MBPD boxed you in on the streets of Meridian Bay.');
      else if (e.type === 'heli') this.dialog.say({ name: 'MBPD Dispatch', role: 'DISPATCH', text: e.text }, 5);
      else if (e.type === 'starLost') this.hud.toast(e.wanted === 0 ? 'YOU LOST THEM — CLEAN' : `WANTED DOWN TO ${e.wanted} STAR${e.wanted === 1 ? '' : 'S'}`);
    }
    if (this.police.wanted > 0) this.police.everWanted = true;
    // heat banner at 4+ stars
    if (this.police.wanted >= 4 && this.police.wanted < 5) this.hud.banner('HEAT — MBPD FULL RESPONSE');
    if (this.police.wanted >= 5) this.hud.banner('LOCKDOWN — EVERY UNIT IN THE BAY');
    // combat + missions
    this.combat.update(dt, input, this);
    this.missions.update(dt);
    this.missions.checkPackages();
    // cop melee: a cop that reaches the player on foot hurts them
    if (p.onFoot) {
      for (const cop of this.police.cops) {
        if (cop.alive && Math.hypot(cop.pos.x - p.pos.x, cop.pos.z - p.pos.z) < 1.4) {
          this.combat.hurtPlayer(this, 22 * dt);
        }
      }
    }
    // slow health regen while the cops are not watching
    if (p.health < CONFIG.player.health && this.police.wanted === 0) {
      p.health = Math.min(CONFIG.player.health, p.health + CONFIG.combat.playerRegen * dt);
    }
    // M6 vault grab raises the full heat
    const m = this.missions.mission;
    if (m && m.id === 'm6' && this.missions.stage === 2 && this.police.wanted < 4 && this.missions.done === 5) {
      this.police.setWanted(4, this.time);
      this.dialog.say({ name: 'Inez Kade', role: 'FIXER', text: 'Four stars! The whole Bay is coming — drive, Cassian, drive!' }, 6);
    }
    this.dialog.update(dt);
    this.effects.update(dt);
    this.audio.engine(p.car ? p.car.speed : 0, !!p.car);
    this.audio.siren(this.police.wanted > 0);
    // camera — the chase shot stages its composition every frame so the
    // cover is the same on any machine: a 3/4 rear view, 149 km/h, the
    // lead patrol car behind-right, a second unit head-on in the far lane,
    // traffic ahead, and the helicopter pinned ahead-right in the sky.
    const focus = p.focusPoint();
    if (this.shotMode === 'chase') {
      const h = p.focusHeading();
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = Math.cos(h);
      const rz = -Math.sin(h);
      if (p.car) p.car.speed = 41.4; // 149 km/h, held for the shot
      // only the two staged units stay in the frame; the rest hold at range
      // (the response panel still lists them from the update's count)
      while (this.police.cars.length > 2) {
        const extra = this.police.cars.pop();
        this.scene.remove(extra.mesh);
      }
      const pc = this.police.cars;
      if (pc[0]) {
        pc[0].pos.set(focus.x - fx * 10 + rx * 6, 0, focus.z - fz * 10 + rz * 6);
        pc[0].heading = h;
        pc[0].speed = 41.4;
        pc[0].syncMesh();
      }
      if (pc[1]) {
        pc[1].pos.set(focus.x + fx * 34 + rx * -8, 0, focus.z + fz * 34 + rz * -8);
        pc[1].heading = h + Math.PI; // head-on in the far lane
        pc[1].speed = 30;
        pc[1].syncMesh();
      }
      const tc = this.traffic.cars.filter((c) => !c.isPolice && c !== p.car);
      if (tc[0]) {
        tc[0].pos.set(focus.x + fx * 55, 0, focus.z + fz * 55);
        tc[0].heading = h;
        tc[0].speed = 14;
        tc[0].syncMesh();
      }
      if (tc[1]) {
        tc[1].pos.set(focus.x + fx * 85 + rx * -5, 0, focus.z + fz * 85 + rz * -5);
        tc[1].heading = h;
        tc[1].speed = 14;
        tc[1].syncMesh();
      }
      if (this.police.heli) {
        const heli = this.police.heli;
        heli.position.set(focus.x + fx * 30 + rx * 16, 24, focus.z + fz * 30 + rz * 16);
        heli.rotation.y = Math.atan2(focus.x - heli.position.x, focus.z - heli.position.z);
        this.police.heliLight.position.copy(heli.position);
        this.police.heliLight.target.position.set(focus.x, 0, focus.z);
      }
      this.renderer.place(
        [focus.x - fx * 22 + rx * 12, focus.y + 6, focus.z - fz * 22 + rz * 12],
        [focus.x + fx * 30, focus.y + 3, focus.z + fz * 30],
      );
    } else {
      this.renderer.follow(focus, p.focusHeading(), dt, p.focusSpeed());
    }
    this.hud.update(this, dt);
    this.renderer.render();
    // shot mode: after a fixed warm-up the frame is ready to capture
    if (this.shotMode) {
      if (this.shotWarmup > 0) {
        this.shotWarmup -= 1;
        if (this.shotWarmup === 0 && !window.__shotError) window.__shotReady = true;
      }
    }
  }
}

// Boot once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { new Game(); });
} else {
  new Game();
}
