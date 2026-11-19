// HUD: every DOM panel the player reads — money, wanted stars, mission
// panel, police response panel, speed, weapons, REP, the circular minimap
// and the fixer dialog box — plus the title / pause / busted / complete
// screens. The game hands this module one snapshot per frame.

import { CFG } from './config.js';
import { clamp } from './random.js';

export function createHUD(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    hud: $('hud'),
    money: $('money'),
    daytime: $('daytime'),
    stars: $('stars'),
    inSight: $('in-sight'),
    heatTag: $('heat-tag'),
    mChapter: $('m-chapter'),
    mName: $('m-name'),
    mObjective: $('m-objective'),
    mStage: $('m-stage'),
    mNext: $('m-next'),
    pCode: $('p-code'),
    pCount: $('p-count'),
    pUnits: $('p-units'),
    speed: $('speed'),
    carName: $('car-name'),
    condition: $('condition-fill'),
    conditionWrap: $('condition'),
    radio: $('radio'),
    weapons: $('weapons'),
    repFill: $('rep-fill'),
    repPct: $('rep-pct'),
    hpFill: $('hp-fill'),
    minimap: $('minimap'),
    district: $('district'),
    street: $('street'),
    dialog: $('dialog'),
    dPortrait: $('d-portrait'),
    dName: $('d-name'),
    dRole: $('d-role'),
    dText: $('d-text'),
    hint: $('hint'),
    toast: $('toast'),
    passed: $('passed-banner'),
    passedTitle: $('passed-title'),
    passedPayout: $('passed-payout'),
    passedStats: $('passed-stats'),
    screens: {
      title: $('screen-title'),
      pause: $('screen-pause'),
      busted: $('screen-busted'),
      complete: $('screen-complete'),
    },
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  let toastT = 0;

  function fmtMoney(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtTime(day, hour, minute) {
    const h = Math.floor(hour);
    const m = Math.floor(minute);
    const hh = ((h + 11) % 12) + 1;
    const ap = h >= 12 ? 'PM' : 'AM';
    return `DAY ${day} — ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function setMission(mission, stage) {
    if (!mission) return;
    if (el.mChapter) el.mChapter.textContent = `CHAPTER ${mission.chapter}`;
    if (el.mName) el.mName.textContent = `${mission.name} — $${mission.payout.toLocaleString('en-US')}`;
    if (el.mObjective) el.mObjective.textContent = mission.short;
    if (el.mStage && stage) el.mStage.textContent = stage.label || '';
    if (el.mNext) el.mNext.textContent = '';
  }

  function showDialog(d) {
    if (!el.dialog) return;
    el.dialog.style.display = 'flex';
    if (el.dPortrait) {
      el.dPortrait.textContent = d.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
      el.dPortrait.style.background = d.color || '#ff2e88';
    }
    if (el.dName) el.dName.textContent = d.name;
    if (el.dRole) el.dRole.textContent = d.role;
    if (el.dText) el.dText.textContent = d.text;
  }

  function hideDialog() {
    if (el.dialog) el.dialog.style.display = 'none';
  }

  function showPassed(title, payout, stats) {
    if (!el.passed) return;
    el.passed.style.display = 'block';
    if (el.passedTitle) el.passedTitle.textContent = title;
    if (el.passedPayout) el.passedPayout.textContent = `+$${payout.toLocaleString('en-US')}`;
    if (el.passedStats) el.passedStats.textContent = stats || '★★★';
  }

  function hidePassed() {
    if (el.passed) el.passed.style.display = 'none';
  }

  function showToast(text, ms = 2600) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.style.display = 'block';
    toastT = ms / 1000;
  }

  function showScreen(name) {
    for (const key of Object.keys(el.screens)) {
      const s = el.screens[key];
      if (s) s.style.display = key === name ? 'flex' : 'none';
    }
    if (el.hud) el.hud.style.display = name ? 'none' : 'block';
  }

  function hideScreens() {
    for (const key of Object.keys(el.screens)) {
      const s = el.screens[key];
      if (s) s.style.display = 'none';
    }
    if (el.hud) el.hud.style.display = 'block';
  }

  // Circular minimap: roads, sea, mission target, police, packages, player.
  function drawMinimap(s) {
    if (!mm || !el.minimap) return;
    const W = el.minimap.width;
    const H = el.minimap.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = W / 2 - 4;
    const scale = R / 280;
    const px = (x) => cx + x * scale;
    const py = (z) => cy + z * scale;
    mm.save();
    mm.clearRect(0, 0, W, H);
    mm.beginPath();
    mm.arc(cx, cy, R, 0, Math.PI * 2);
    mm.clip();
    mm.fillStyle = '#20242e';
    mm.fillRect(0, 0, W, H);
    // Sea on the east edge.
    mm.fillStyle = '#2f9fd8';
    mm.fillRect(px(268), 0, W - px(268), H);
    mm.fillStyle = '#ecd193';
    mm.fillRect(px(252), 0, px(268) - px(252), H);
    // Roads.
    mm.strokeStyle = 'rgba(200,205,220,0.75)';
    mm.lineWidth = 3;
    for (const line of CFG.city.roads) {
      mm.beginPath();
      mm.moveTo(px(-260), py(line));
      mm.lineTo(px(260), py(line));
      mm.stroke();
      mm.beginPath();
      mm.moveTo(px(line), py(-260));
      mm.lineTo(px(line), py(260));
      mm.stroke();
    }
    // Blocks.
    mm.fillStyle = 'rgba(120,130,150,0.35)';
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const bx = (i - 3) * 72;
        const bz = (j - 3) * 72;
        mm.fillRect(px(bx - 24), py(bz - 24), 48 * scale, 48 * scale);
      }
    }
    // Packages.
    if (s.packages) {
      mm.fillStyle = '#ffd21e';
      for (const p of s.packages) {
        mm.beginPath();
        mm.arc(px(p.x), py(p.z), 2.5, 0, Math.PI * 2);
        mm.fill();
      }
    }
    // Mission target.
    if (s.target) {
      mm.fillStyle = '#ffd21e';
      mm.save();
      mm.translate(px(s.target.x), py(s.target.z));
      mm.rotate(Math.PI / 4);
      mm.fillRect(-4, -4, 8, 8);
      mm.restore();
    }
    // Police blips.
    if (s.police) {
      for (const u of s.police) {
        mm.fillStyle = u.status === 'SPOTLIGHT' ? '#ff2020' : '#4e8ae8';
        mm.beginPath();
        mm.arc(px(u.x), py(u.z), 3, 0, Math.PI * 2);
        mm.fill();
      }
    }
    // Player arrow.
    mm.save();
    mm.translate(px(s.px), py(s.pz));
    mm.rotate(s.heading);
    mm.fillStyle = '#ff2e88';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
    mm.restore();
    // Ring.
    mm.beginPath();
    mm.arc(cx, cy, R, 0, Math.PI * 2);
    mm.strokeStyle = 'rgba(255,255,255,0.85)';
    mm.lineWidth = 2;
    mm.stroke();
  }

  function update(s, dt) {
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0 && el.toast) el.toast.style.display = 'none';
    }
    if (el.money) el.money.textContent = fmtMoney(s.money);
    if (el.daytime) el.daytime.textContent = fmtTime(s.day, s.hour, s.minute);
    if (el.stars) {
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
      el.stars.textContent = stars;
      el.stars.style.color = s.wanted >= 3 ? '#ff5a3c' : '#ffd21e';
    }
    if (el.inSight) el.inSight.style.display = s.inSight ? 'block' : 'none';
    if (el.heatTag) {
      el.heatTag.style.display = s.heat ? 'block' : 'none';
      el.heatTag.textContent = s.lockdown ? 'LOCKDOWN' : 'HEAT';
    }
    if (el.mChapter && s.mission) el.mChapter.textContent = `CHAPTER ${s.mission.chapter}`;
    if (el.mName && s.mission) el.mName.textContent = `${s.mission.name} — $${s.mission.payout.toLocaleString('en-US')}`;
    if (el.mObjective && s.mission) el.mObjective.textContent = s.mission.short;
    if (el.mStage) el.mStage.textContent = s.stageText || '';
    if (el.mNext) el.mNext.textContent = s.nextText || '';
    if (el.pCode) el.pCode.textContent = s.policeCode || 'CODE 0 — QUIET';
    if (el.pCount) el.pCount.textContent = `${s.policeUnits.length} UNITS`;
    if (el.pUnits) {
      el.pUnits.innerHTML = s.policeUnits.map((u) => (
        `<div class="pu"><span>${u.name}</span><span class="dist">${u.dist}m</span><span class="st">${u.status}</span></div>`
      )).join('');
    }
    if (el.speed) el.speed.textContent = String(Math.round(s.speedKmh));
    if (el.carName) el.carName.textContent = s.carName || 'ON FOOT';
    if (el.condition) el.condition.style.width = `${clamp(s.condition, 0, 100)}%`;
    if (el.radio) el.radio.textContent = `${s.radioName} — ${s.radioSong}`;
    if (el.hpFill) el.hpFill.style.width = `${clamp(s.hp, 0, 100)}%`;
    const hpNum = doc.getElementById('hp-num');
    if (hpNum) hpNum.textContent = String(Math.round(s.hp));
    if (el.repFill) el.repFill.style.width = `${clamp(s.rep, 0, 100)}%`;
    if (el.repPct) el.repPct.textContent = `REP ${Math.round(s.rep)}%`;
    if (el.weapons) {
      el.weapons.innerHTML = s.weapons.map((w) => (
        `<div class="wslot${w.locked ? ' locked' : ''}"><span>${w.name}</span><span class="ammo">${w.ammo}</span></div>`
      )).join('');
    }
    if (el.district) el.district.textContent = s.district || '';
    if (el.street) el.street.textContent = s.street || '';
    drawMinimap(s.minimap || { px: 0, pz: 0, heading: 0 });
  }

  return { update, setMission, showDialog, hideDialog, showPassed, hidePassed, showToast, showScreen, hideScreens, drawMinimap };
}
