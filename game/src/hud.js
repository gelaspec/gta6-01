// Meridian Bay — the HUD: mission panel, wanted stars, money, police panel,
// dialog is in dialog.js; this file owns everything else on screen, plus the
// circular live minimap drawn on a 2D canvas.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

function money(n) {
  return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function createHud(city) {
  const els = {
    money: $('hud-money'),
    day: $('hud-day'),
    clock: $('hud-clock'),
    district: $('hud-district'),
    street: $('hud-street'),
    stars: $('hud-stars'),
    status: $('hud-status'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    repFill: $('rep-fill'),
    repText: $('rep-text'),
    repRank: $('rep-rank'),
    speed: $('hud-speed'),
    carName: $('hud-car'),
    condition: $('hud-condition'),
    radio: $('hud-radio'),
    missionChapter: $('mission-chapter'),
    missionName: $('mission-name'),
    missionObjective: $('mission-objective'),
    missionStage: $('mission-stage'),
    missionStageFill: $('mission-stage-fill'),
    missionNext: $('mission-next'),
    policeList: $('police-panel'),
    policeListInner: $('police-list'),
    policeHeader: $('police-header'),
    weaponSlots: $('weapon-slots'),
    minimap: $('minimap'),
    dispatch: $('dispatch-line'),
    minimapLabel: $('minimap-label'),
  };
  const mm = els.minimap.getContext('2d');
  const MM = 168; // canvas pixels
  const RANGE = 260; // world metres across the minimap

  function drawMinimap(px, pz, heading, missionSpot, policeUnits, heliPos, packages) {
    mm.clearRect(0, 0, MM, MM);
    const cx = MM / 2;
    const cy = MM / 2;
    const scale = MM / RANGE;
    const toMap = (x, z) => [cx + (x - px) * scale, cy + (z - pz) * scale];
    // sea + beach (east)
    const [bx] = toMap(CONFIG.beachX, 0);
    mm.fillStyle = '#2ec4d8';
    mm.fillRect(bx, 0, MM - bx, MM);
    mm.fillStyle = '#f2dfae';
    mm.fillRect(toMap(CONFIG.beachX - 14, 0)[0], 0, 14 * scale, MM);
    // roads
    mm.strokeStyle = '#8f969e';
    mm.lineWidth = 5;
    for (let i = 0; i <= CONFIG.grid; i++) {
      const c = -CONFIG.cityHalf + i * CONFIG.grid * 0 + i * CONFIG.block;
      const [x1] = toMap(c, 0);
      mm.beginPath(); mm.moveTo(x1, 0); mm.lineTo(x1, MM); mm.stroke();
      const [, z1] = toMap(0, c);
      mm.beginPath(); mm.moveTo(0, z1); mm.lineTo(MM, z1); mm.stroke();
    }
    // plaza
    const [plx, plz] = toMap(0, 0);
    mm.fillStyle = '#e8e2d2';
    mm.beginPath(); mm.arc(plx, plz, 6, 0, Math.PI * 2); mm.fill();
    // packages
    mm.fillStyle = '#39d353';
    for (const p of packages) {
      if (p.taken) continue;
      const [x, z] = toMap(p.pos.x, p.pos.z);
      if (x < 0 || x > MM || z < 0 || z > MM) continue;
      mm.fillRect(x - 2, z - 2, 4, 4);
    }
    // mission waypoint
    if (missionSpot) {
      const [x, z] = toMap(missionSpot.x, missionSpot.z);
      if (x >= 0 && x <= MM && z >= 0 && z <= MM) {
        mm.fillStyle = '#ffe600';
        mm.beginPath(); mm.arc(x, z, 6, 0, Math.PI * 2); mm.fill();
        mm.strokeStyle = '#111';
        mm.lineWidth = 2;
        mm.stroke();
      }
    }
    // police
    for (const u of policeUnits) {
      const [x, z] = toMap(u.car.pos.x, u.car.pos.z);
      if (x < 0 || x > MM || z < 0 || z > MM) continue;
      mm.fillStyle = '#2e6bff';
      mm.beginPath(); mm.arc(x, z, 4, 0, Math.PI * 2); mm.fill();
    }
    if (heliPos) {
      const [x, z] = toMap(heliPos.x, heliPos.z);
      mm.fillStyle = '#ff2e2e';
      mm.beginPath(); mm.arc(x, z, 5, 0, Math.PI * 2); mm.fill();
    }
    // player arrow (centre, points up the heading)
    mm.save();
    mm.translate(cx, cy);
    mm.rotate(Math.PI - heading);
    mm.fillStyle = '#ffffff';
    mm.strokeStyle = '#111';
    mm.lineWidth = 1.5;
    mm.beginPath();
    mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(0, 3); mm.lineTo(-6, 7);
    mm.closePath(); mm.fill(); mm.stroke();
    mm.restore();
  }

  function update(state) {
    const s = state;
    els.money.textContent = money(s.money);
    els.day.textContent = `DAY ${s.day}`;
    els.clock.textContent = s.clock;
    els.district.textContent = city.districtAt(s.pos.x, s.pos.z);
    els.street.textContent = city.streetAt(s.pos.x, s.pos.z);
    // wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    els.stars.textContent = stars;
    els.stars.className = s.wanted > 0 ? 'stars hot' : 'stars';
    els.status.textContent = s.wanted >= 3 ? 'IN SIGHT' : s.wanted > 0 ? 'WANTED' : 'CLEAR';
    els.status.className = s.wanted >= 3 ? 'status in-sight' : s.wanted > 0 ? 'status wanted' : 'status';
    // health
    els.healthFill.style.width = `${Math.max(0, s.health)}%`;
    els.healthNum.textContent = `${Math.max(0, Math.round(s.health))}`;
    // REP
    const rep = Math.min(s.rep, 2400);
    els.repFill.style.width = `${(rep / 2400) * 100}%`;
    const rank = CONFIG.repRanks[Math.min(4, Math.floor(s.rep / 600))];
    els.repText.textContent = `REP ${s.rep}`;
    els.repRank.textContent = rank.toUpperCase();
    // speed + car
    els.speed.textContent = s.inCar ? String(Math.round(s.speedKmh)) : '0';
    els.carName.textContent = s.inCar ? s.carName : 'ON FOOT';
    els.condition.textContent = s.inCar ? `COND ${Math.round(s.carCondition)}%` : '—';
    els.radio.textContent = s.inCar ? `${s.radioStation} ♫ ${s.radioSong}` : 'RADIO OFF';
    // mission panel
    const m = s.mission;
    els.missionChapter.textContent = m.chapter;
    els.missionName.textContent = `${m.id} — ${m.name}`;
    els.missionObjective.textContent = m.objective;
    els.missionStage.textContent = s.missionStageText;
    const stageFrac = s.missionStageFrac;
    els.missionStageFill.style.width = `${Math.round(stageFrac * 100)}%`;
    els.missionNext.textContent = s.missionNextText;
    // police panel
    if (s.wanted > 0 && s.policeUnits.length > 0) {
      els.policeList.classList.remove('hidden');
      els.policeHeader.textContent = `MBPD — ${s.wanted}★ — CODE 3`;
      els.policeListInner.innerHTML = s.policeUnits.map((u) =>
        `<div class="police-row"><span>${u.name}</span><span>${u.dist}m</span><span class="police-status">${u.status}</span></div>`).join('')
        + (s.heliVisible ? `<div class="police-row"><span>AIR ONE</span><span>—</span><span class="police-status">SPOTLIGHT</span></div><div class="police-row"><span>ROADBLOCK</span><span>—</span><span class="police-status">SET UP</span></div>` : '');
    } else {
      els.policeList.classList.add('hidden');
    }
    // weapon slots
    const slots = [
      { name: 'FISTS', ammo: '∞', locked: false, active: s.weapon === 'fists' },
      { name: 'PISTOL', ammo: `${s.ammo}/12`, locked: false, active: s.weapon === 'pistol' },
      { name: 'SHOTGUN', ammo: '', locked: true, active: false },
      { name: 'SMG', ammo: '', locked: true, active: false },
    ];
    els.weaponSlots.innerHTML = slots.map((w) =>
      `<div class="weapon${w.active ? ' active' : ''}${w.locked ? ' locked' : ''}"><span>${w.name}</span><span>${w.locked ? 'LOCKED' : w.ammo}</span></div>`).join('');
    // dispatch ticker
    if (s.dispatchLine) {
      els.dispatch.textContent = s.dispatchLine;
      els.dispatch.classList.remove('hidden');
    } else {
      els.dispatch.classList.add('hidden');
    }
    // minimap
    els.minimapLabel.textContent = `${city.districtAt(s.pos.x, s.pos.z)} — ${city.streetAt(s.pos.x, s.pos.z)}`;
    drawMinimap(s.pos.x, s.pos.z, s.heading, s.missionSpot, s.policeUnits, s.heliPos, s.packages);
  }

  return { update, money };
}
