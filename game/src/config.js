// Meridian Bay — tuning, palette, names and world constants.
// Every number the game balances on lives here so the other modules
// stay small and readable.

export const CONFIG = {
  // World layout: a 7x7 street grid, 40 m blocks, beach on the east edge.
  block: 40,
  roadHalf: 5,
  gridMin: -120,
  gridMax: 120,
  beachX: 140,
  seaX: 165,
  pierEndX: 205,

  // Player
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 8.5,
  gravity: 24,
  playerHealth: 100,
  pistolAmmo: 12,
  pistolDamage: 34,
  punchDamage: 18,
  punchRange: 2.4,
  shootRange: 70,

  // Cars
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 46,
  carReverseMax: 14,
  carSteer: 1.9,
  carGrip: 6.5,
  handbrakeGrip: 2.2,
  trafficSpeed: 11,
  trafficCount: 14,
  parkedCount: 12,

  // Police and wanted
  wantedMax: 5,
  wantedDecaySeconds: 9,
  policeCarSpeed: 40,
  policeFootSpeed: 7.5,
  policeSpawnRadius: 55,
  heliWantedAt: 3,
  bustDistance: 3.2,
  bustSeconds: 2.5,

  // Economy
  startMoney: 250,
  taxiFare: 120,
  packageReward: 150,
  missionPayouts: [400, 650, 900, 1500, 2400, 5000],
  bustFine: 300,

  // Pedestrians
  pedCount: 26,
  pedSpeed: 2.2,
  pedFleeSpeed: 5.5,

  // Clock: one game minute per real second, day starts 19:04.
  clockStartMinutes: 19 * 60 + 4,
  clockRate: 1,
};

export const PALETTE = {
  skySunset: 0xff9a52,
  skyNoon: 0x6fb7ff,
  skyNight: 0x0b1026,
  skyDawn: 0xffb27a,
  sunSunset: 0xffb36b,
  sunNoon: 0xfff2d8,
  sunNight: 0x8fa8ff,
  fogSunset: 0xf2a06b,
  fogNoon: 0xa8c8e8,
  fogNight: 0x0d1428,
  sea: 0x1d6f8e,
  sand: 0xe3cf9e,
  grass: 0x5d8a4a,
  asphalt: 0x2b2f36,
  sidewalk: 0x9aa0a8,
  buildingGlass: 0x2c3e55,
  carColors: [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0x8e44ad, 0xd8d8d8, 0x222831, 0xe67e22],
  taxiYellow: 0xf2c230,
  policeWhite: 0xe8ecf0,
  policeBlack: 0x1c2330,
};

export const DISTRICTS = [
  { name: 'OLD PORT', x0: -140, x1: -40, z0: -140, z1: 140 },
  { name: 'DOWNTOWN', x0: -40, x1: 40, z0: -140, z1: 140 },
  { name: 'CALLE VERDE', x0: -140, x1: 40, z0: 40, z1: 140 },
  { name: 'NORTHSIDE', x0: -40, x1: 140, z0: -140, z1: -40 },
  { name: 'MARINA', x0: 40, x1: 140, z0: -40, z1: 140 },
];

export const STREETS = [
  { name: 'COAST ROAD', vertical: true, at: 120 },
  { name: 'PALM ROW', vertical: true, at: 80 },
  { name: 'FLAMINGO ST', vertical: false, at: 80 },
  { name: 'HARBOR AVE', vertical: true, at: 0 },
  { name: 'MARINA BLVD', vertical: false, at: 0 },
  { name: 'CALLE VERDE', vertical: false, at: 40 },
  { name: 'PIER LANE', vertical: true, at: 40 },
  { name: 'LIGHTHOUSE WAY', vertical: false, at: -80 },
];

export const LANDMARKS = [
  { name: 'MERIDIAN BANK', x: -20, z: -20, w: 26, d: 18, h: 46 },
  { name: 'PALM MOTEL', x: 60, z: 60, w: 22, d: 14, h: 16 },
  { name: 'CASINO ROYALE', x: 20, z: 100, w: 28, d: 20, h: 30 },
  { name: 'THE CANNERY', x: -100, z: 20, w: 24, d: 16, h: 14 },
  { name: 'SURF SHACK', x: 130, z: -60, w: 12, d: 10, h: 8 },
  { name: 'VELA MOTORS', x: 60, z: -100, w: 24, d: 16, h: 12 },
  { name: 'COCO MOTEL', x: -60, z: 100, w: 20, d: 14, h: 15 },
  { name: 'NEON GYM', x: 100, z: 20, w: 16, d: 14, h: 18 },
];

export const RADIO_STATIONS = [
  { name: 'MERIDIAN FM 98.1', songs: ['Sunset Static — The Palms', 'Neon Drive — Cassia Blue', 'Bay Lights — The Breakers'] },
  { name: 'BAYWAVE 104.5', songs: ['Tide Runner — Sol & the Keys', 'Golden Hour — Marina Vale', 'Pier Lights — The Gulls'] },
  { name: 'NEON NIGHTS 91.3', songs: ['Midnight Chrome — Vex Nine', 'Glass City — Night Parade', 'Afterglow — Inez'] },
];

export const CAR_MODELS = [
  { name: 'Comet GT', kind: 'sports', top: 52, accel: 32 },
  { name: 'Vela Sedan', kind: 'sedan', top: 42, accel: 26 },
  { name: 'Harbor Van', kind: 'van', top: 36, accel: 20 },
  { name: 'City Taxi', kind: 'taxi', top: 44, accel: 26 },
  { name: 'Cruiser', kind: 'police', top: 46, accel: 30 },
];

export const REP_RANKS = [
  { at: 0, name: 'NOBODY' },
  { at: 100, name: 'STREET SOLDIER' },
  { at: 400, name: 'WHEELMAN' },
  { at: 1000, name: 'HEAT SEEKER' },
  { at: 2500, name: 'BAY LEGEND' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return x >= CONFIG.beachX ? 'THE PIER' : 'DOWNTOWN';
}

export function streetAt(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const s of STREETS) {
    const d = s.vertical ? Math.abs(x - s.at) : Math.abs(z - s.at);
    if (d < bestD) {
      bestD = d;
      best = s.name;
    }
  }
  return best ?? 'PALM ROW';
}

export function repRank(rep) {
  let current = REP_RANKS[0];
  let next = null;
  for (let i = 0; i < REP_RANKS.length; i++) {
    if (rep >= REP_RANKS[i].at) current = REP_RANKS[i];
    else {
      next = REP_RANKS[i];
      break;
    }
  }
  return { current, next };
}
