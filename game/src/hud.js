// HUD: every DOM panel, the circular live minimap, toasts, and the
// full screens (title, pause, busted, mission-passed, story-complete).
// The density checklist from the top-20 covers lives here: mission
// panel with stage bar, named police units, weapon slots, REP bar.

import { CONFIG, RADIO_STATIONS, districtAt, streetAt, repRank } from './config.js';
import { formatMoney, formatClock, formatTime } from './random.js';
import { missionObjectiveText, districtHeat } from './missions.js';
import { policePanelData } from './police.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let toastAt = 0;
  let hintAt = 0;
  let flashAt = -10;

  const hud = {
    toast(text, seconds = 3) {
      const el = $('toast');
      el.textContent = text;
      el.style.display = 'block';
      toastAt = performance.now() / 1000 + seconds;
    },
    hint(text, seconds = 4) {
      const el = $('hint');
      el.textContent = text;
      el.style.display = 'block';
      hintAt = performance.now() / 1000 + seconds;
    },
    flashDamage() {
      flashAt = performance.now() / 1000;
    },
    refreshMission() {
      // Called when a mission starts or a stage changes.
    },
    update(G) {
      const now = performance.now() / 1000;
      if (now > toastAt) $('toast').style.display = 'none';
      if (now > hintAt) $('hint').style.display = 'none';
      const p = G.player;
      const px = p.inCar ? p.inCar.x : p.x;
      const pz = p.inCar ? p.inCar.z : p.z;

      // Money, district, clock, wanted, REP.
      $('money').textContent = formatMoney(G.money);
      const district = districtAt(px, pz);
      $('district').textContent = district;
      $('clock').textContent = formatClock(G.clockMinutes);
      const stars = Math.floor(G.police.wanted);
      $('wanted-stars').innerHTML =
        '★'.repeat(stars) + '<span class="off">' + '★'.repeat(5 - stars) + '</span>';
      $('insight').style.display = G.police.wanted > 0 && G.police.inSight ? 'block' : 'none';
      const rep = repRank(G.rep);
      const nextAt = rep.next ? rep.next.at : rep.current.at + 1000;
      const pct = Math.min(100, ((G.rep - rep.current.at) / Math.max(1, nextAt - rep.current.at)) * 100);
      $('rep-fill').style.width = pct + '%';
      $('rep-label').textContent = `REP ${G.rep} · ${rep.current.name} ${Math.round(pct)}% · NEXT: ${rep.next ? rep.next.name : 'MAX'}`;

      // Mission panel.
      const m = G.missions;
      if (m.current) {
        const def = m.current.def;
        const stageLabel = m.current.stageLabel ? ` · ${m.current.stageLabel}` : '';
        $('mission-chapter').textContent = `${def.chapter} · M${def.id} / 6${stageLabel}`;
        $('mission-name').textContent = def.name;
        let obj = missionObjectiveText(G);
        if (def.id === 2 && m.current.stage === 1) obj += ` — ${Math.ceil(m.current.timer)}s left.`;
        $('mission-objective').textContent = obj;
        const stageTotal = def.id === 3 ? 3 : def.id === 6 ? 3 : 1;
        const stageNow = def.id === 3 ? m.current.got : def.id === 6 ? m.current.stage + 1 : m.current.stage + 1;
        $('mission-stage-fill').style.width = `${Math.min(100, (stageNow / stageTotal) * 100)}%`;
        $('mission-next').textContent = def.next;
      } else {
        $('mission-chapter').textContent = 'FREE ROAM';
        $('mission-name').textContent = 'Meridian Bay';
        $('mission-objective').textContent = 'Drive to the next job marker or explore the city.';
        $('mission-stage-fill').style.width = '0%';
        $('mission-next').textContent = (() => {
          // The next job: the current index when nothing has started
          // yet, the one after it once a mission has been played.
          const nextIdx = m.started ? m.currentIndex + 1 : m.currentIndex;
          return nextIdx < m.defs.length
            ? `NEXT: M${nextIdx + 1} ${m.defs[nextIdx].name}`
            : 'Story complete — the city is yours.';
        })();
      }

      // Police response panel with named units.
      const panel = policePanelData(G);
      $('police-panel').style.display = G.police.wanted > 0 ? 'block' : 'none';
      $('police-count').textContent = `${panel.count} UNIT${panel.count === 1 ? '' : 'S'}`;
      $('police-units').innerHTML = panel.rows
        .map((r) => `<div class="unit"><span>${r.name} · ${r.dist}m</span><span class="st">${r.status}</span></div>`)
        .join('');
      $('police-code').textContent = `${panel.code} · HEAT ${districtHeat(G, district)}${districtHeat(G, district) >= 5 ? ' · LOCKDOWN' : ''}`;

      // Vitals.
      $('health-num').textContent = Math.ceil(p.health);
      $('health-fill').style.width = p.health + '%';
      $('health-fill').style.background = p.health > 50 ? '#54d977' : p.health > 25 ? '#ffd34d' : '#ff5d47';
      $('ammo').textContent = `AMMO ${G.combat.ammo}/12${G.combat.reloading > 0 ? ' · RELOADING' : ''}`;
      $('map-street').textContent = `${streetAt(px, pz)} · ${district}`;

      // Drive panel: weapons, speed, car, radio.
      const car = p.inCar;
      const speed = car ? Math.abs(car.speed) * 3.6 : Math.abs(p.speed) * 3.6;
      $('speed').innerHTML = `${Math.round(speed)} <small>km/h</small>`;
      $('car-name').textContent = car ? car.model.name : 'ON FOOT';
      const cond = car ? car.condition : 100;
      $('car-cond-fill').style.width = cond + '%';
      $('car-cond-fill').style.background = cond > 50 ? '#7dff9a' : cond > 25 ? '#ffd34d' : '#ff5d47';
      const station = RADIO_STATIONS[G.radioIndex % RADIO_STATIONS.length];
      $('radio-line').textContent = station.name;
      $('song-line').textContent = '♪ ' + station.songs[G.songIndex % station.songs.length];
      const weapons = [
        { name: 'FISTS', ammo: '∞', active: !car, locked: false },
        { name: 'PISTOL', ammo: `${G.combat.ammo}/12`, active: !car, locked: false },
        { name: 'SMG', ammo: '—', active: false, locked: true },
        { name: 'RIFLE', ammo: '—', active: false, locked: true },
      ];
      $('weapons').innerHTML = weapons
        .map((w) => `<div class="weapon${w.locked ? ' locked' : ''}${w.active ? ' active' : ''}"><b>${w.name}</b>${w.locked ? 'LOCKED' : w.ammo}</div>`)
        .join('');
      $('crosshair').style.display = !car && G.screen === 'play' ? 'block' : 'none';

      this.drawMinimap(G, mctx, px, pz);
      // Damage flash vignette via the vitals panel border.
      $('vitals').style.borderColor = now - flashAt < 0.25 ? '#ff5d47' : 'rgba(255,255,255,0.14)';
    },

    drawMinimap(G, ctx, px, pz) {
      const S = 184;
      const scale = S / 340;
      const toMap = (x, z) => [(x + 170) * scale, (z + 170) * scale];
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = '#24361f';
      ctx.fillRect(0, 0, S, S);
      // Sea + beach on the east.
      ctx.fillStyle = '#2a9db5';
      ctx.fillRect((165 + 170) * scale, 0, S, S);
      ctx.fillStyle = '#efd9a8';
      ctx.fillRect((140 + 170) * scale, 0, (165 - 140) * scale, S);
      // Roads.
      ctx.strokeStyle = '#565b66';
      ctx.lineWidth = 5;
      for (let v = -120; v <= 120; v += 40) {
        ctx.beginPath();
        ctx.moveTo(...toMap(v, -150));
        ctx.lineTo(...toMap(v, 150));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(...toMap(-150, v));
        ctx.lineTo(...toMap(150, v));
        ctx.stroke();
      }
      // Packages.
      ctx.fillStyle = '#ffd34d';
      for (const pkg of G.missions.packages) {
        if (pkg.taken) continue;
        const [mx, mz] = toMap(pkg.x, pkg.z);
        ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
      }
      // Mission beacon.
      if (G.missions.beacon.visible) {
        const [mx, mz] = toMap(G.missions.beacon.position.x, G.missions.beacon.position.z);
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.arc(mx, mz, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Police blips.
      ctx.fillStyle = '#ff4d4d';
      for (const u of G.police.units) {
        const [mx, mz] = toMap(u.x, u.z);
        ctx.beginPath();
        ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Traffic.
      ctx.fillStyle = '#e8eef7';
      for (const c of G.cars) {
        if (c === G.player.inCar) continue;
        const [mx, mz] = toMap(c.x, c.z);
        ctx.fillRect(mx - 1, mz - 1, 2, 2);
      }
      // Player arrow.
      const [mx, mz] = toMap(px, pz);
      const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
      ctx.save();
      ctx.translate(mx, mz);
      ctx.rotate(heading);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // North tick.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('N', S / 2 - 3, 11);
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
    showComplete(G) {
      $('complete-stats').textContent = `Money ${formatMoney(G.money)} · Packages ${G.missions.packagesFound}/10 · Time ${formatTime(G.missions.stats.time)} · Max wanted ${G.missions.stats.maxWanted}★`;
      this.showScreen('screen-complete');
    },
  };
  return hud;
}
