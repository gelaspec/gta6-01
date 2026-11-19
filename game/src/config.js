// Meridian Bay — tuning, palette and world constants (fresh authoring, v6).
// Everything the game tunes from lives here, so the other modules stay small.

export const CONFIG = {
  // -- city ---------------------------------------------------------------
  grid: 7, // 7x7 blocks
  block: 44, // metres per block (road centre to road centre)
  roadWidth: 13,
  sidewalk: 3.2,
  cityHalf: 154, // 7 * 44 / 2
  beachX: 168, // beach starts east of the grid
  seaX: 196,

  // -- bright palette (the user said v3 was too dark; top-20 covers are vivid)
  palette: {
    asphalt: 0x8f969e, // warm light-grey road (was near-black in v3)
    asphaltLine: 0xf5f2e8,
    sidewalk: 0xd8cfc0,
    sand: 0xf2dfae,
    sea: 0x2ec4d8, // turquoise
    seaDeep: 0x1d9fc4,
    grass: 0x7ec850,
    plaza: 0xe8e2d2,
    skyNoon: 0x7ec8f2,
    skyGolden: 0xffb36b,
    skyNight: 0x1c2440,
    sun: 0xffd9a0,
    building: [
      0xffe8c9, 0xffd9b0, 0xf6c6c6, 0xcfe8d8, 0xcfe0f5,
      0xfff3d6, 0xf2d7a0, 0xd8e8f2, 0xf7d1c0, 0xe6f2c8,
    ],
    roof: [0x8a6f5c, 0x6f7d8a, 0x9a8a7a, 0x7a6a8a],
    palmTrunk: 0x8a6a48,
    palmLeaf: 0x3fae5a,
    neon: [0xff2e88, 0x00e5ff, 0xffe600, 0x7c4dff, 0xff6d00],
    pinkCar: 0xff2e88, // hot-pink hero car
  },

  // -- districts (west -> east, south -> north) ----------------------------
  districts: [
    { name: 'Old Port', x0: -154, x1: -66, z0: -154, z1: 154 },
    { name: 'Calle Verde', x0: -66, x1: 22, z0: -154, z1: -22 },
    { name: 'Downtown', x0: -66, x1: 22, z0: -22, z1: 110 },
    { name: 'Northside', x0: -66, x1: 22, z0: 110, z1: 154 },
    { name: 'Marina', x0: 22, x1: 154, z0: -154, z1: 154 },
  ],
  streets: ['Harbor Blvd', 'Palm Row', 'Calle Verde', 'Marina Way', 'Dock St', 'Sunset Ave', 'Pier Rd'],

  // -- landmarks ------------------------------------------------------------
  landmarks: [
    { name: 'MERIDIAN BANK', x: -44, z: -22 },
    { name: 'MARINA MOTEL', x: 88, z: -66 },
    { name: 'CASINO LUNA', x: 44, z: 66 },
    { name: 'PIER 40', x: 154, z: 22 },
    { name: 'DOCKSIDE GARAGE', x: -110, z: 88 },
    { name: 'CLUB VOLT', x: 0, z: 110 },
    { name: 'HARBOR MARKET', x: -88, z: -110 },
    { name: 'CALLE VERDE', x: -22, z: -88 },
  ],

  // -- people ----------------------------------------------------------------
  hero: { name: 'Cassian Rowe', role: 'DRIVER' },
  fixer: { name: 'Inez Kade', role: 'FIXER' },
  dispatch: { name: 'MBPD Dispatch', role: 'DISPATCH' },
  rook: { name: 'Rook', role: 'HARBOR KINGS' },

  // -- gameplay tuning -------------------------------------------------------
  walkSpeed: 6.5,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 24,
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 46, // ~165 km/h for the Comet GT
  carTurn: 1.9,
  trafficSpeed: 11,
  policeSpeed: 40,
  heliHeight: 42,
  pistolAmmo: 12,
  pistolDamage: 34,
  punchDamage: 20,
  punchRange: 2.2,
  packageValue: 150,
  taxiFare: 120,

  // -- missions ---------------------------------------------------------------
  missions: [
    {
      id: 'M1', name: 'First Wheels', chapter: 'CH. 1 — FIRST WHEELS',
      brief: 'Welcome to Meridian Bay, Cassian. No car, no crew, no money. Steal something with four wheels and bring it to the garage.',
      objective: 'Steal a car and reach the Dockside Garage',
      reward: 250, time: 0,
    },
    {
      id: 'M2', name: 'Courier Run', chapter: 'CH. 2 — COURIER RUN',
      brief: 'A package for the Marina Motel, ninety seconds, no questions. The Kings are watching the docks — take the long way round.',
      objective: 'Deliver the package to Marina Motel in 90s',
      reward: 900, time: 90,
    },
    {
      id: 'M3', name: 'The Pickup', chapter: 'CH. 3 — THE PICKUP',
      brief: 'Three drops stashed around Calle Verde. Collect all three and do not let the heat climb past two stars.',
      objective: 'Collect 3 drops around Calle Verde',
      reward: 1600, time: 0,
    },
    {
      id: 'M4', name: 'Heat', chapter: 'CH. 4 — HEAT',
      brief: 'The MBPD is on you and they are not letting go. Survive three stars for a full minute. Lose them or outrun them — your call.',
      objective: 'Survive 3 stars for 60s',
      reward: 2400, time: 60,
    },
    {
      id: 'M5', name: 'Pier Heist', chapter: 'CH. 5 — PIER HEIST',
      brief: 'The black Harbor Kings van is parked on Pier 40, keys in it, two gunmen watching it. Take the van. Try not to start a war.',
      objective: 'Steal the black van from Pier 40',
      reward: 4850, time: 0,
    },
    {
      id: 'M6', name: 'The Meridian Job', chapter: 'CH. 6 — THE MERIDIAN JOB',
      brief: 'The bank. Twenty seconds inside while the whole city comes for you. Then the bridge, then the boat, then we are rich. Go.',
      objective: 'Hold the Meridian Bank for 20s, then escape',
      reward: 31200, time: 20,
    },
  ],

  // -- radio ------------------------------------------------------------------
  radio: [
    { station: 'WAVE 98.5', song: 'Sunset Drive — Neon Palms' },
    { station: 'BAY FM 101', song: 'Harbor Lights — The Breakers' },
    { station: 'VOLT RADIO', song: 'Night Circuit — Rook & Co.' },
  ],

  // -- REP ladder ---------------------------------------------------------------
  repRanks: ['Nobody', 'Wheelman', 'Hustler', 'Street King', 'Bay Legend'],
};
