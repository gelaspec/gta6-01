// Meridian Bay — combat: fists (F) and the pistol (mouse click). Shots
// raycast from the camera into peds, cops and cars; a hit flashes, sparks,
// and raises the wanted level when the MBPD sees it happen.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.ammo = CONFIG.combat.pistolAmmo;
    this.reserve = CONFIG.combat.pistolReserve;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.weapon = 'pistol'; // pistol | fists
    this.slots = [
      { name: 'PISTOL', ammo: '12/60', locked: false },
      { name: 'FISTS', ammo: '∞', locked: false },
      { name: 'SHOTGUN', ammo: 'LOCKED', locked: true },
      { name: 'SMG', ammo: 'LOCKED', locked: true },
    ];
  }

  reset() {
    this.ammo = CONFIG.combat.pistolAmmo;
    this.reserve = CONFIG.combat.pistolReserve;
    this.weapon = 'pistol';
    this.punchTimer = 0;
    this.shootTimer = 0;
  }

  update(dt, input, game) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    if (input.pressed('Digit1')) this.weapon = 'pistol';
    if (input.pressed('Digit2')) this.weapon = 'fists';
    if (input.pressed('KeyF') && this.punchTimer <= 0) this.punch(game);
    if (input.clicked() && this.weapon === 'pistol' && this.shootTimer <= 0) this.shoot(game);
    if (input.pressed('KeyR')) this.reload();
    this.slots[0].ammo = `${this.ammo}/${this.reserve}`;
  }

  reload() {
    if (this.ammo >= CONFIG.combat.pistolAmmo || this.reserve <= 0) return;
    const need = CONFIG.combat.pistolAmmo - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
  }

  punch(game) {
    this.punchTimer = 0.45;
    game.audio.punch();
    const p = game.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const hit = (pos) => {
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > CONFIG.combat.punchRange) return false;
      const dot = (dx * fx + dz * fz) / (d || 1);
      return dot > Math.cos(CONFIG.combat.punchArc);
    };
    let landed = false;
    for (const ped of game.peds.list) {
      if (ped.alive && hit(ped.pos)) {
        ped.health -= CONFIG.combat.punchDamage;
        game.effects.burst(ped.pos, 0xffe14d, 10);
        if (ped.health <= 0) ped.die();
        else ped.fleeFrom(p.pos.x, p.pos.z);
        landed = true;
      }
    }
    for (const cop of game.police.cops) {
      if (cop.alive && hit(cop.pos)) {
        game.effects.burst(cop.pos, 0xffe14d, 10);
        cop.alive = false;
        cop.mesh.rotation.x = -Math.PI / 2;
        landed = true;
      }
    }
    if (landed) {
      game.police.addWanted(1, game.time);
      game.effects.shake(0.25);
    }
  }

  shoot(game) {
    if (this.ammo <= 0) {
      game.audio.dryFire();
      this.reload();
      return;
    }
    this.ammo -= 1;
    this.shootTimer = 0.22;
    game.audio.gunshot();
    game.effects.muzzle(game.player);
    game.effects.shake(0.12);
    // raycast from the centre of the screen into the world
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const targets = [];
    for (const ped of game.peds.list) if (ped.alive) targets.push({ mesh: ped.mesh, ref: ped, kind: 'ped' });
    for (const cop of game.police.cops) if (cop.alive) targets.push({ mesh: cop.mesh, ref: cop, kind: 'cop' });
    for (const car of game.traffic.cars) targets.push({ mesh: car.mesh, ref: car, kind: 'car' });
    const meshes = targets.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return;
    const hit = hits[0];
    let obj = hit.object;
    while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
    const target = targets.find((t) => t.mesh === obj);
    if (!target) return;
    game.effects.burst(hit.point, 0xffe14d, 14);
    if (target.kind === 'ped') {
      target.ref.health -= CONFIG.combat.pistolDamage;
      if (target.ref.health <= 0) target.ref.die();
      else target.ref.fleeFrom(game.player.pos.x, game.player.pos.z);
    } else if (target.kind === 'cop') {
      target.ref.alive = false;
      target.ref.mesh.rotation.x = -Math.PI / 2;
    } else if (target.kind === 'car') {
      target.ref.health = Math.max(0, target.ref.health - 12);
      game.effects.burst(hit.point, 0x9aa0a8, 8);
    }
    if (target.kind !== 'car') game.police.addWanted(1, game.time);
  }

  // Damage the player (cop melee, car ram). Returns true when it kills.
  hurtPlayer(game, amount) {
    const p = game.player;
    p.health = Math.max(0, p.health - amount);
    game.effects.shake(0.3);
    game.hud.flashDamage();
    if (p.health <= 0) game.busted('You were taken down in the streets of Meridian Bay.');
    return p.health <= 0;
  }
}
