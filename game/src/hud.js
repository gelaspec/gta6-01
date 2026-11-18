// HUD: every DOM panel — mission panel, police response panel,
// money + wanted + REP, vitals, drive panel, weapon slots, the live
// circular minimap, toasts and hints — plus the full-screen states
// (title, pause, busted, mission passed, story complete).

import { CONFIG, RADIO_STATIONS, districtAt, streetAt, repRank } from './config.js';
import { formatMoney, formatClock } from './random.js';
import { policePanelData } from './police.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = null;
  let hintTimer = null;
  const cache = { money: null, clock: null, stars: null, rep: null };

  function drawMinimap(G) {
    const W = minimap.width;
    const H = minimap.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = W / 340; // city spans about -150..190 m
    const px = (x) => cx + (x - 10) * scale;
    const py = (z) => cy + z * scale;
    mctx.clearRect(0, 0, W, H);
    // Sea on the east, sand, then the city green.
    mctx.fillStyle = '#2a9db5';
    mctx.fillRect(px(140), 0, W, H);
    mctx.fillStyle = '#efd9a8';
    mctx.fillRect(px(120), 0, px(140) - px(120), H);
    mctx.fillStyle = '#24361f';
    mctx.fillRect(0, 0, px(120), H);
    // Roads.
    mctx.strokeStyle = '#6e7480';
    mctx.lineWidth = 4;
    for (let v = CONFIG.gridMin; v <= CONFIG.gridMax; v += CONFIG.block) {
      mctx.beginPath();
      mctx.moveTo(px(v), py(-150));
      mctx.lineTo(px(v), py(150));
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(px(-150), py(v));
      mctx.lineTo(px(150), py(v));
      mctx.stroke();
    }
    // Pier.
    mctx.strokeStyle = '#8a6a4a';
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.moveTo(px(140), py(0));
    mctx.lineTo(px(205), py(0));
    mctx.stroke();
    // Hidden packages.
    mctx.fillStyle = '#ffd34d';
    for (const pkg of G.missions.packages) {
      if (pkg.taken) continue;
      mctx.beginPath();
      mctx.arc(px(pkg.x), py(pkg.z), 2.5, 0, Math.PI * 2);
      mctx.fill();
    }
    // Police blips.
    for (const u of G.police.units) {
      mctx.fillStyle = '#2a6bff';
      mctx.beginPath();
      mctx.arc(px(u.x), py(u.z), 4, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#ff2a2a';
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
    // Mission beacon.
    if (G.missions.current && G.missions.current.target) {
      const t = G.missions.current.target;
      mctx.strokeStyle = '#ffd34d';
      mctx.lineWidth = 2;
      mctx.beginPath();
      mctx.arc(px(t.x), py(t.z), 7, 0, Math.PI * 2);
      mctx.stroke();
      mctx.fillStyle = '#ffd34d';
      mctx.beginPath();
      mctx.arc(px(t.x), py(t.z), 3, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player: a gold triangle pointing along the heading.
    const p = G.player;
    const h = p.inCar ? p.inCar.heading : p.heading;
    mctx.fillStyle = '#ffd34d';
    mctx.beginPath();
    mctx.moveTo(px(p.x) + Math.sin(h) * 7, py(p.z) + Math.cos(h) * 7);
    mctx.lineTo(px(p.x) + Math.sin(h + 2.5) * 5, py(p.z) + Math.cos(h + 2.5) * 5);
    mctx.lineTo(px(p.x) + Math.sin(h - 2.5) * 5, py(p.z) + Math.cos(h - 2.5) * 5);
    mctx.closePath();
    mctx.fill();
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 1;
    mctx.stroke();
    // North marker.
    mctx.fillStyle = '#fff';
    mctx.font = 'bold 11px Arial';
    mctx.textAlign = 'center';
    mctx.fillText('N', cx, 12);
  }

  return {
    update(G) {
      // Money, clock, district, street.
      const money = formatMoney(G.money);
      if (cache.money !== money) {
        cache.money = money;
        $('money').textContent = money;
      }
      const clock = formatClock(G.clockMinutes);
      if (cache.clock !== clock) {
        cache.clock = clock;
        $('clock').textContent = clock;
      }
      $('district').textContent = districtAt(G.player.x, G.player.z);
      $('map-street').textContent = `${districtAt(G.player.x, G.player.z)} · ${streetAt(G.player.x, G.player.z)}`;

      // Wanted stars + IN SIGHT.
      const wanted = Math.round(G.police.wanted);
      if (cache.stars !== wanted) {
        cache.stars = wanted;
        let html = '';
        for (let i = 0; i < 5; i++) {
          html += i < wanted ? '★' : '<span class="off">★</span>';
        }
        $('wanted-stars').innerHTML = html;
      }
      $('insight').style.display = wanted > 0 && G.police.inSight ? 'block' : 'none';

      // REP bar.
      const rank = repRank(G.rep);
      const repKey = `${rank.current.name}:${G.rep}`;
      if (cache.rep !== repKey) {
        cache.rep = repKey;
        const nextAt = rank.next ? rank.next.at : rank.current.at + 1000;
        const pct = Math.min(100, ((G.rep - rank.current.at) / Math.max(1, nextAt - rank.current.at)) * 100);
        $('rep-fill').style.width = `${pct}%`;
        $('rep-label').textContent = `REP ${G.rep} · ${rank.current.name}${rank.next ? ` → ${rank.next.name} ${nextAt}` : ''}`;
      }

      // Mission panel.
      const cur = G.missions.current;
      if (cur) {
        $('mission-chapter').textContent = cur.def.chapter;
        $('mission-name').textContent = `M${cur.index + 1}: ${cur.def.name}`;
        let obj = cur.def.objectives[Math.min(cur.stage, cur.def.objectives.length - 1)];
        if (cur.index === 1 && cur.stage === 1) obj += ` — ${Math.ceil(cur.timer)}s left`;
        if (cur.index === 3 && cur.stage === 1) obj += ` — survive ${Math.ceil(cur.surviveLeft)}s`;
        if (cur.index === 5 && cur.stage === 1) obj += ` — hold ${Math.ceil(cur.holdLeft)}s`;
        $('mission-objective').textContent = obj;
        $('mission-stage-fill').style.width = `${((cur.stage + 1) / cur.def.objectives.length) * 100}%`;
        const next = cur.index + 1 < G.missions.defs.length
          ? `NEXT: M${cur.index + 2}: ${G.missions.defs[cur.index + 1].name}`
          : 'NEXT: Story complete';
        $('mission-next').textContent = next;
        $('mission-panel').style.display = 'block';
      } else {
        $('mission-panel').style.display = 'none';
      }

      // Police response panel.
      const units = policePanelData(G);
      if (wanted > 0 && units.length > 0) {
        $('police-panel').style.display = 'block';
        $('police-count').textContent = `${units.length} UNIT${units.length > 1 ? 'S' : ''} RESPONDING`;
        $('police-units').innerHTML = units
          .map((u) => `<div class="unit"><span>${u.name}</span><span>${u.dist}m</span><span class="st">${u.status}</span></div>`)
          .join('');
        $('police-code').textContent = wanted >= 4 ? 'CODE 3 · ROADBLOCKS UP · AIR ONE OVERHEAD' : wanted >= 3 ? 'CODE 2 · AIR ONE OVERHEAD' : 'CODE 1 · PURSUIT IN PROGRESS';
      } else {
        $('police-panel').style.display = 'none';
      }

      // Vitals: health, ammo, weapon slots.
      $('health-num').textContent = `${Math.round(G.player.health)} HP`;
      $('health-fill').style.width = `${Math.max(0, G.player.health)}%`;
      $('health-fill').style.background = G.player.health > 50 ? '#54d977' : G.player.health > 25 ? '#ffd34d' : '#ff5d47';
      $('ammo').textContent = G.combat.reloading > 0
        ? 'RELOADING…'
        : `PISTOL ${G.combat.ammo}/12`;
      $('weapons').innerHTML =
        `<span class="wslot ${G.combat.ammo > 0 ? 'on' : ''}">PISTOL ${G.combat.ammo}</span>` +
        '<span class="wslot on">FISTS</span>' +
        '<span class="wslot lock">SMG — LOCKED</span>' +
        '<span class="wslot lock">SHOTGUN — LOCKED</span>';

      // Drive panel: speed, car, condition, radio.
      const car = G.player.inCar;
      if (car) {
        $('drive-panel').style.display = 'block';
        const kmh = Math.round(Math.abs(car.speed) * 3.6);
        $('speed').textContent = `${kmh} km/h`;
        $('car-name').textContent = car.model.name;
        $('car-cond-fill').style.width = `${Math.max(0, car.condition)}%`;
      } else {
        $('drive-panel').style.display = 'none';
      }
      const station = RADIO_STATIONS[G.radioIndex % RADIO_STATIONS.length];
      $('radio-line').textContent = `♪ ${station.name}`;
      $('song-line').textContent = station.songs[G.songIndex % station.songs.length];

      drawMinimap(G);
    },

    showScreen(id) {
      for (const s of ['screen-title', 'screen-pause', 'screen-busted', 'screen-passed', 'screen-complete']) {
        $(s).style.display = s === id ? 'flex' : 'none';
      }
    },

    hideScreens() {
      for (const s of ['screen-title', 'screen-pause', 'screen-busted', 'screen-passed', 'screen-complete']) {
        $(s).style.display = 'none';
      }
    },

    showPassed(data) {
      $('passed-title').textContent = data.title;
      $('passed-stars').textContent = '★'.repeat(data.stars) + '☆'.repeat(3 - data.stars);
      $('passed-stats').textContent = data.stats;
      $('passed-quote').textContent = data.quote;
      $('passed-next').textContent = data.next;
      this.showScreen('screen-passed');
    },

    showComplete(data) {
      $('complete-stats').textContent = data.stats;
      this.showScreen('screen-complete');
    },

    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.style.display = 'block';
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        el.style.display = 'none';
      }, 4000);
    },

    hint(msg) {
      const el = $('hint');
      el.textContent = msg;
      el.style.display = 'block';
      if (hintTimer) window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => {
        el.style.display = 'none';
      }, 6000);
    },
  };
}
