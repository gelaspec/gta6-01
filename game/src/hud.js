// The HUD: money, mission objective and timer, wanted stars, health, speed,
// a live 2D minimap of Meridian Bay, the crosshair, toasts, contextual hints
// and the title / pause / busted / story-complete screens. All DOM, drawn
// over the WebGL canvas, so the screenshots show the game exactly as played.

import { CITY, MISSIONS, PACKAGE_COUNT } from './config.js';

export function createHud(city) {
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('money');
  const missionTitleEl = $('mission-title');
  const missionTextEl = $('mission-text');
  const missionTimerEl = $('mission-timer');
  const starsEl = $('stars');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const speedEl = $('speed');
  const speedVal = $('speed-val');
  const crosshair = $('crosshair');
  const toastEl = $('toast');
  const hintEl = $('hint');
  const mapCanvas = $('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const screens = {
    title: $('screen-title'),
    pause: $('screen-pause'),
    busted: $('screen-busted'),
    complete: $('screen-complete'),
  };
  const hudEl = $('hud');

  let toastTimer = null;
  let lastMap = 0;
  let lastMoney = -1;
  let lastHealth = -1;
  let lastWanted = -1;
  let lastSpeed = -1;

  function setObjective(title, text) {
    missionTitleEl.textContent = title;
    missionTextEl.textContent = text;
  }

  function setTimer(seconds) {
    if (seconds === null || seconds === undefined) {
      missionTimerEl.textContent = '';
      return;
    }
    missionTimerEl.textContent = `${Math.ceil(seconds)}s`;
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function setHint(text) {
    hintEl.textContent = text || '';
    hintEl.classList.toggle('show', !!text);
  }

  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      if (el) el.classList.toggle('show', key === name);
    }
    hudEl.classList.toggle('dim', name === 'title');
  }

  function drawMap(s) {
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const scale = W / 780;
    const ox = 300;
    const oz = 300;
    const X = (x) => (x + ox) * scale;
    const Y = (z) => (z + oz) * scale;
    // Land, ocean and beach.
    mapCtx.fillStyle = '#5d7a44';
    mapCtx.fillRect(0, 0, W, H);
    mapCtx.fillStyle = '#2e7fa8';
    mapCtx.fillRect(X(CITY.waterX), 0, W - X(CITY.waterX), H);
    mapCtx.fillStyle = '#e8d5a4';
    mapCtx.fillRect(X(CITY.beachX), 0, X(CITY.waterX) - X(CITY.beachX), H);
    // Roads.
    mapCtx.strokeStyle = '#3a3f46';
    mapCtx.lineWidth = Math.max(2, CITY.roadWidth * scale);
    for (const r of city.roads) {
      mapCtx.beginPath();
      mapCtx.moveTo(X(-CITY.half), Y(r));
      mapCtx.lineTo(X(CITY.half), Y(r));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(X(r), Y(-CITY.half));
      mapCtx.lineTo(X(r), Y(CITY.half));
      mapCtx.stroke();
    }
    // Pier.
    mapCtx.strokeStyle = '#9a7a52';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(X(CITY.beachX), Y(CITY.pierZ));
    mapCtx.lineTo(X(CITY.pierEndX), Y(CITY.pierZ));
    mapCtx.stroke();
    // Mission waypoint.
    if (s.waypoint) {
      mapCtx.fillStyle = '#f2c94c';
      mapCtx.beginPath();
      mapCtx.arc(X(s.waypoint.x), Y(s.waypoint.z), 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#7a5c00';
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
    // Hidden packages not yet found.
    if (s.packages) {
      mapCtx.fillStyle = '#ffd94a';
      for (const p of s.packages) {
        if (p.found) continue;
        mapCtx.fillRect(X(p.x) - 2, Y(p.z) - 2, 4, 4);
      }
    }
    // Police.
    if (s.policeCars) {
      for (const c of s.policeCars) {
        mapCtx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4444' : '#4488ff';
        mapCtx.beginPath();
        mapCtx.arc(X(c.x), Y(c.z), 4, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // Player arrow.
    const px = X(s.playerX);
    const py = Y(s.playerZ);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.PI - s.playerYaw); // arrow points where the player faces
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#222222';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
  }

  function update(s, now) {
    if (s.money !== lastMoney) {
      moneyEl.textContent = `$${Math.floor(s.money).toLocaleString('en-US')}`;
      lastMoney = s.money;
    }
    if (s.health !== lastHealth) {
      healthFill.style.width = `${Math.max(0, s.health)}%`;
      healthNum.textContent = `${Math.ceil(s.health)}`;
      healthFill.style.background = s.health > 50 ? '#3aa856' : s.health > 25 ? '#e8a832' : '#c23b2e';
      lastHealth = s.health;
    }
    if (s.wanted !== lastWanted) {
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < s.wanted ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.classList.toggle('hot', s.wanted > 0);
      lastWanted = s.wanted;
    }
    if (s.inCar) {
      speedEl.classList.add('show');
      const kmh = Math.round(Math.abs(s.speed) * 3.6);
      if (kmh !== lastSpeed) {
        speedVal.textContent = kmh;
        lastSpeed = kmh;
      }
    } else {
      speedEl.classList.remove('show');
    }
    crosshair.classList.toggle('show', !!s.aiming);
    if (now - lastMap > 100) {
      lastMap = now;
      drawMap(s);
    }
  }

  return {
    setObjective,
    setTimer,
    toast,
    setHint,
    showScreen,
    update,
    setCompleteStats(money, packages) {
      const el = $('complete-stats');
      if (el) el.textContent = `Final take: $${Math.floor(money).toLocaleString('en-US')}  •  Packages ${packages}/${PACKAGE_COUNT}  •  Missions 6/6`;
    },
    setEndTitle(text) {
      const el = $('busted-title');
      if (el) el.textContent = text;
    },
    setTitleStats(money, mission) {
      const el = $('title-stats');
      if (el) {
        el.textContent = money > 250 || mission > 0
          ? `Saved: $${Math.floor(money).toLocaleString('en-US')}  •  ${mission >= MISSIONS.length ? 'Story complete' : `Mission ${mission + 1}/6`}`
          : 'A new story in Meridian Bay';
      }
    },
  };
}
