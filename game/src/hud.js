// Meridian Bay — the HUD: money, wanted stars, health, speed, mission
// panel, police response panel, weapon slots, live minimap, REP bar, radio,
// dialog box, toasts and the title / pause / busted / complete screens.
// All of it is DOM + one 2D canvas, so it stays crisp at any resolution.
import { CONFIG, districtAt, streetAt } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function money(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export class HUD {
  constructor() {
    this.el = {};
    const ids = [
      'money', 'day-time', 'stars', 'wanted-tag', 'health-fill', 'health-text',
      'speed', 'car-name', 'car-cond', 'car-cond-fill', 'radio',
      'mission-chapter', 'mission-name', 'mission-objective', 'mission-stage',
      'mission-next', 'police-panel', 'police-units', 'police-code',
      'police-count', 'weapon-slots', 'minimap', 'district', 'street',
      'rep-fill', 'rep-text', 'dialog-box', 'dialog-portrait', 'dialog-name',
      'dialog-role', 'dialog-text', 'toast', 'banner', 'damage-flash',
      'screen-title', 'screen-pause', 'screen-busted', 'screen-complete',
      'busted-reason', 'complete-stats', 'title-best', 'hint', 'heat-label',
      'passed-card', 'passed-title', 'passed-reward', 'passed-stars', 'passed-stats',
    ];
    for (const id of ids) this.el[id] = $(id);
    this.minimap = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.toastTimer = 0;
    this.bannerTimer = 0;
    this.damageTimer = 0;
    this.buildWeaponSlots();
  }

  buildWeaponSlots() {
    const wrap = this.el['weapon-slots'];
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const slot of [
      { name: 'PISTOL', ammo: '12/60' },
      { name: 'FISTS', ammo: '∞' },
      { name: 'SHOTGUN', ammo: 'LOCKED' },
      { name: 'SMG', ammo: 'LOCKED' },
    ]) {
      const div = document.createElement('div');
      div.className = 'weapon' + (slot.ammo === 'LOCKED' ? ' locked' : '');
      const n = document.createElement('div');
      n.className = 'weapon-name';
      n.textContent = slot.name;
      const a = document.createElement('div');
      a.className = 'weapon-ammo';
      a.textContent = slot.ammo;
      div.append(n, a);
      wrap.append(div);
    }
  }

  toast(text, seconds = 3.5) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  hideToast() {
    this.toastTimer = 0;
    if (this.el.toast) this.el.toast.classList.remove('show');
  }

  banner(text, seconds = 3) {
    if (!this.el.banner) return;
    this.el.banner.textContent = text;
    this.el.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  flashDamage() {
    if (!this.el['damage-flash']) return;
    this.el['damage-flash'].classList.add('show');
    this.damageTimer = 0.35;
  }

  // The MISSION PASSED card: mission name, payout, star rating, run stats.
  // sticky=true keeps it on screen (the screenshots use that).
  showPassed(info, sticky = false) {
    const card = this.el['passed-card'];
    if (!card) return;
    card.classList.add('show');
    this.el['passed-title'].textContent = `${info.chapter} — ${info.name.toUpperCase()} PASSED`;
    this.el['passed-reward'].textContent = `+$${info.reward.toLocaleString('en-US')}`;
    this.el['passed-stars'].textContent = '★'.repeat(info.rating) + '☆'.repeat(3 - info.rating);
    this.el['passed-stats'].textContent = info.stats || '';
    if (!sticky) {
      this.passedTimer = 6;
    } else {
      this.passedTimer = 0;
    }
  }

  hidePassed() {
    if (this.el['passed-card']) this.el['passed-card'].classList.remove('show');
  }

  showDialog(line) {
    const box = this.el['dialog-box'];
    if (!box) return;
    box.classList.add('show');
    this.el['dialog-portrait'].textContent = line.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    this.el['dialog-portrait'].style.background = line.role === 'FIXER' ? '#ff2e88' : line.role === 'DISPATCH' ? '#1c2733' : '#2fb7ff';
    this.el['dialog-name'].textContent = line.name;
    this.el['dialog-role'].textContent = line.role;
    this.el['dialog-text'].textContent = line.text;
  }

  hideDialog() {
    if (this.el['dialog-box']) this.el['dialog-box'].classList.remove('show');
  }

  showScreen(name) {
    for (const key of ['screen-title', 'screen-pause', 'screen-busted', 'screen-complete']) {
      const el = this.el[key];
      if (el) el.classList.toggle('show', key === `screen-${name}`);
    }
  }

  hideScreens() {
    this.showScreen('none');
  }

  setBusted(reason) {
    if (this.el['busted-reason']) this.el['busted-reason'].textContent = reason;
  }

  setComplete(stats) {
    if (this.el['complete-stats']) this.el['complete-stats'].textContent = stats;
  }

  setTitleBest(text) {
    if (this.el['title-best']) this.el['title-best'].textContent = text;
  }

  // -- per-frame update ------------------------------------------------------
  update(game, dt) {
    const p = game.player;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.el.toast) this.el.toast.classList.remove('show');
    }
    if (this.passedTimer > 0) {
      this.passedTimer -= dt;
      if (this.passedTimer <= 0) this.hidePassed();
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.el.banner) this.el.banner.classList.remove('show');
    }
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      if (this.damageTimer <= 0 && this.el['damage-flash']) this.el['damage-flash'].classList.remove('show');
    }
    if (this.el.money) this.el.money.textContent = money(game.money);
    if (this.el['day-time']) {
      this.el['day-time'].textContent = `DAY ${game.day} — ${game.clockText()}`;
    }
    if (this.el.stars) {
      const w = game.police.wanted;
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="star${i < w ? ' on' : ''}">★</span>`;
      this.el.stars.innerHTML = html;
    }
    if (this.el['wanted-tag']) {
      const inSight = game.police.inSight(p.focusPoint());
      this.el['wanted-tag'].textContent = game.police.wanted === 0 ? '' : inSight ? 'IN SIGHT' : 'HIDDEN';
      this.el['wanted-tag'].className = inSight ? 'tag sight' : 'tag hidden';
    }
    if (this.el['health-fill']) this.el['health-fill'].style.width = `${Math.max(0, p.health)}%`;
    if (this.el['health-text']) this.el['health-text'].textContent = `HP ${Math.ceil(p.health)}`;
    // speed + car
    const kmh = Math.round(Math.abs(p.focusSpeed()) * 3.6);
    if (this.el.speed) this.el.speed.textContent = String(kmh);
    if (this.el['car-name']) this.el['car-name'].textContent = p.car ? p.car.name.toUpperCase() : 'ON FOOT';
    if (this.el['car-cond-fill'] && p.car) this.el['car-cond-fill'].style.width = `${Math.max(0, p.car.health)}%`;
    if (this.el['car-cond']) this.el['car-cond'].style.display = p.car ? 'block' : 'none';
    if (this.el.radio) {
      const r = CONFIG.radio[game.audio.radioIndex % CONFIG.radio.length];
      this.el.radio.textContent = `${r.station} — ${r.song}`;
    }
    // mission panel
    const m = game.missions.mission;
    if (m) {
      if (this.el['mission-chapter']) this.el['mission-chapter'].textContent = m.chapter;
      if (this.el['mission-name']) this.el['mission-name'].textContent = `${m.name.toUpperCase()} — $${m.reward.toLocaleString('en-US')}`;
      if (this.el['mission-objective']) this.el['mission-objective'].textContent = game.missions.objective;
      if (this.el['mission-stage']) this.el['mission-stage'].textContent = `STAGE ${Math.min(game.missions.stage + 1, m.stages.length)}/${m.stages.length}`;
      if (this.el['mission-next']) {
        const next = m.stages[Math.min(game.missions.stage + 1, m.stages.length - 1)];
        this.el['mission-next'].textContent = next && game.missions.stage + 1 < m.stages.length ? `NEXT: ${next.text}` : 'NEXT: Finish the job';
      }
    }
    // police panel
    const panel = this.el['police-panel'];
    if (panel) {
      panel.classList.toggle('show', game.police.wanted > 0);
      if (this.el['police-code']) this.el['police-code'].textContent = game.police.code;
      if (this.el['police-count']) this.el['police-count'].textContent = `${game.police.units.length} UNITS`;
      if (this.el['police-units']) {
        this.el['police-units'].innerHTML = game.police.units.map((u) => (
          `<div class="unit"><span class="unit-name">${u.name}</span><span class="unit-dist">${u.distance}m</span><span class="unit-status">${u.status}</span></div>`
        )).join('');
      }
    }
    // heat / lockdown label
    if (this.el['heat-label']) {
      this.el['heat-label'].textContent = game.police.wanted >= 5 ? 'LOCKDOWN' : game.police.wanted >= 4 ? 'HEAT' : '';
    }
    // REP bar
    if (this.el['rep-fill']) this.el['rep-fill'].style.width = `${game.rep}%`;
    if (this.el['rep-text']) this.el['rep-text'].textContent = `REP ${Math.round(game.rep)}%`;
    // district + street under the minimap
    const focus = p.focusPoint();
    if (this.el.district) this.el.district.textContent = districtAt(focus.x, focus.z).toUpperCase();
    if (this.el.street) this.el.street.textContent = streetAt(focus.x, focus.z);
    this.drawMinimap(game);
    // weapon slot ammo
    const slots = this.el['weapon-slots'] ? this.el['weapon-slots'].children : [];
    if (slots[0]) slots[0].querySelector('.weapon-ammo').textContent = `${game.combat.ammo}/${game.combat.reserve}`;
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.toggle('active', (i === 0 && game.combat.weapon === 'pistol') || (i === 1 && game.combat.weapon === 'fists'));
    }
  }

  drawMinimap(game) {
    const ctx = this.minimap;
    const canvas = this.el.minimap;
    if (!ctx || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const half = 210; // world half-span shown
    const toX = (x) => ((x + half) / (half * 2)) * W;
    const toY = (z) => ((z + half) / (half * 2)) * H;
    ctx.clearRect(0, 0, W, H);
    // water + sand on the east edge
    ctx.fillStyle = '#12303f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2fa8c9';
    ctx.fillRect(toX(238), 0, W - toX(238), H);
    ctx.fillStyle = '#f2d492';
    ctx.fillRect(toX(206), 0, toX(238) - toX(206), H);
    // city blocks
    ctx.fillStyle = '#3a4556';
    ctx.fillRect(toX(-196), toY(-196), toX(196) - toX(-196), toY(196) - toY(-196));
    // roads
    ctx.strokeStyle = '#9aa0a8';
    ctx.lineWidth = 4;
    for (const c of game.city.roadCenters) {
      ctx.beginPath(); ctx.moveTo(toX(c), toY(-196)); ctx.lineTo(toX(c), toY(196)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(-196), toY(c)); ctx.lineTo(toX(196), toY(c)); ctx.stroke();
    }
    // district tint dots
    for (const d of CONFIG.districts) {
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(toX(d.x), toY(d.z), 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const dot = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // hidden packages
    for (const pkg of game.missions.packages) {
      if (!pkg.found) dot(pkg.x, pkg.z, '#ffd23c', 3);
    }
    // mission beacon
    const b = game.missions.beaconTarget;
    if (b) {
      ctx.fillStyle = '#ffd23c';
      ctx.save();
      ctx.translate(toX(b.x), toY(b.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // police
    for (const car of game.police.cars) dot(car.pos.x, car.pos.z, '#2a6bff', 4);
    for (const cop of game.police.cops) dot(cop.pos.x, cop.pos.z, '#2a6bff', 3);
    // traffic
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const car of game.traffic.cars) {
      if (car.isPolice || car === game.player.car) continue;
      ctx.beginPath(); ctx.arc(toX(car.pos.x), toY(car.pos.z), 2, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const p = game.player.focusPoint();
    const heading = game.player.focusHeading();
    ctx.save();
    ctx.translate(toX(p.x), toY(p.z));
    ctx.rotate(heading);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
