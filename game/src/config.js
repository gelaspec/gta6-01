// Meridian Bay — tuning, palette, districts, missions, cars, radio.
// One data file: every other module reads its numbers from here so the
// whole game stays consistent (speeds, payouts, colours, names).

export const CFG = {
  // City geometry: 7x7 blocks, 72 m pitch, 16 m roads, 28 m block half-size.
  city: {
    blocks: 7,
    pitch: 72,
    roadW: 16,
    blockHalf: 28,
    half: 260,
    // Road centre lines (both axes), from the block grid.
    roads: [-252, -180, -108, -36, 36, 108, 180, 252],
    beachX: 268,
    seaX: 330,
    pier: { x0: 262, x1: 396, z0: -12, z1: 12 },
  },

  // Bright, sun-soaked palette. The user said v3 was too dark; everything
  // here is vivid: hot pink hero car, bright road, saturated sky.
  palette: {
    skyDay: 0x8fd3f4,
    skySunset: 0xff9e57,
    skyNight: 0x1b2340,
    fogDay: 0xa8d8ea,
    fogSunset: 0xf7b06a,
    fogNight: 0x232c4a,
    sunDay: 0xfff3c4,
    sunSunset: 0xff7733,
    grass: 0x77c04e,
    grassDry: 0x9ccb5f,
    sand: 0xecd193,
    sea: 0x2f9fd8,
    seaDeep: 0x1e7fb8,
    road: 0x4a4f5e,
    roadEdge: 0x333743,
    line: 0xffe9a8,
    sidewalk: 0xb9b3a4,
    pierWood: 0xa9805a,
    building: [0xf2ede4, 0xe8b4a0, 0xf6d98c, 0xa8c8e8, 0xd8a0b8, 0xb8d8a0, 0xe8e0f0, 0xf0c8a0],
    buildingDowntown: [0x9fb8d8, 0xd8c8b8, 0xb8c8d8, 0xe8d8c8, 0x8fb0d0],
    palmTrunk: 0x8a6a48,
    palmLeaf: 0x2fae5f,
    heroPink: 0xff2e88,
    policeWhite: 0xf2f2f2,
    policeBlack: 0x1c1e26,
  },

  // Five districts. Downtown wins in the centre; Marina hugs the beach.
  districts: [
    { name: 'OLD PORT', x0: -260, x1: -108, z0: -260, z1: 260, tint: 0x8a7a5a },
    { name: 'MARINA', x0: 108, x1: 260, z0: -260, z1: 260, tint: 0x5aa8c8 },
    { name: 'DOWNTOWN', x0: -108, x1: 108, z0: -108, z1: 108, tint: 0x9a8ac8 },
    { name: 'THE PALMS', x0: -108, x1: 108, z0: -260, z1: -108, tint: 0x6ab86a },
    { name: 'CALLE VERDE', x0: -108, x1: 108, z0: 108, z1: 260, tint: 0xd8a05a },
  ],

  // Street names for the HUD, picked from the nearest road line.
  streetsNS: ['Harbor View', 'Marina Blvd', 'Palm Row', 'Calle Verde', 'Bayfront Ave', 'Old Port Rd', 'Sunset Strip', 'Pier Approach'],
  streetsEW: ['Meridian Ave', 'Coral St', 'Neon Row', 'Dockside Way', 'Seabreeze Ln', 'Festival St', 'Anchor Rd', 'Boardwalk'],

  player: { name: 'Cassian Rowe', fixer: 'Inez Kade', fixerRole: 'FIXER', startMoney: 250 },
  police: { name: 'MBPD', heliName: 'AIR-1', unitNames: ['MBPD-12', 'MBPD-07', 'MBPD-21', 'MBPD-33', 'MBPD-05', 'MBPD-18', 'MBPD-27'] },

  // Cars: name, colour, top speed (km/h), acceleration, handling.
  cars: [
    { name: 'COMET GT', color: 0xff2e88, top: 212, accel: 34, grip: 1.0 },
    { name: 'VULCAR NOVA', color: 0x2ec8ff, top: 178, accel: 28, grip: 0.95 },
    { name: 'BENSON VAN', color: 0xf2f2f2, top: 142, accel: 20, grip: 0.85 },
    { name: 'TAXI CAB', color: 0xffc81e, top: 165, accel: 24, grip: 0.9 },
    { name: 'SUNSET CRUISER', color: 0xff7a1e, top: 158, accel: 22, grip: 0.9 },
    { name: 'HARBOUR HAULER', color: 0x3aa84e, top: 138, accel: 18, grip: 0.8 },
  ],

  radio: [
    { name: 'MERIDIAN FM 101.2', song: 'Neon Coast — Sunset Drive' },
    { name: 'BAYWAVE 88.4', song: 'Palmtree Nights — The Breakers' },
    { name: 'CALLE 96.7', song: 'Verde Lights — Marisol' },
    { name: 'HARBOUR TALK 740', song: 'Dockside News — Live' },
  ],

  // Six story missions. Payouts grow; the money in the screenshots
  // ($250 -> $4,850 -> $18,450 -> $31,200) comes from these.
  missions: [
    { id: 'M1', chapter: 1, name: 'FIRST WHEELS', payout: 990, short: 'Steal a car and bring it to the Marina', kind: 'steal' },
    { id: 'M2', chapter: 2, name: 'COURIER RUN', payout: 2450, short: 'Deliver three parcels across town, fast', kind: 'deliver' },
    { id: 'M3', chapter: 3, name: 'THE PICKUP', payout: 2200, short: 'Collect the drops in Calle Verde (0/3)', kind: 'collect' },
    { id: 'M4', chapter: 4, name: 'HEAT', payout: 13600, short: 'Lose a 3-star tail and stay clean', kind: 'survive' },
    { id: 'M5', chapter: 5, name: 'PIER HEIST', payout: 6350, short: 'Ram the security van on the pier', kind: 'ram' },
    { id: 'M6', chapter: 6, name: 'THE MERIDIAN JOB', payout: 6400, short: 'Break through the Downtown cordon — 4 stars', kind: 'escape' },
  ],

  tuning: {
    walkSpeed: 6.5,
    runSpeed: 10,
    jumpSpeed: 8.5,
    gravity: 24,
    carAccel: 26,
    carBrake: 42,
    carReverse: 14,
    carSteer: 1.9,
    handbrakeGrip: 0.35,
    trafficCount: 14,
    pedCount: 22,
    policeChaseSpeed: 30,
    wantedDecayDist: 130,
    wantedDecayTime: 14,
    packageValue: 150,
    taxiFare: 120,
    repPerMission: 13,
  },
};
