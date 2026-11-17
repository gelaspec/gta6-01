# Meridian Bay — Open-World Crime

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gelaspec/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gelaspec/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Meridian Bay** is an open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): a sun-soaked port city
you explore on foot and by car, with traffic, pedestrians, a wanted level and
police who chase you, six story missions, combat, a HUD with a live minimap,
and a save that keeps your progress.

## The story

Vex Marlow is back in town with nothing but a debt and a fast mouth. Fixer
Delia Voss has six jobs for you — steal a car, run a courier package, pick up
the Old Port drops, get the heat on and lose it, heist the Harbor Kings van,
and finally pull **The Meridian Job**: rob the Meridian Bank and run for the
pier. Between jobs there are ten hidden packages to find and taxi fares to run.

## Play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play in desktop Chrome. No network request is
made; everything — including three.js — is a file under `game/`.

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run |
| Space | Jump / handbrake |
| E | Steal car / exit car |
| F | Punch |
| Click | Shoot the pistol |
| C | Camera |
| P / Esc | Pause |
| M | Mute |

## Systems

- **City** — a procedural road grid with towers, parks, plazas, palms, a beach,
  the ocean and a wooden pier with a lighthouse (`game/src/city.js`).
- **Cars** — arcade physics, stealable parked cars, traffic that follows the
  road grid, police interceptors (`game/src/vehicles.js`, `game/src/police.js`).
- **Wanted** — 0–5 stars. Stealing, hitting pedestrians and shooting raise the
  heat; break line of sight and stay quiet to cool off.
- **Missions** — six story jobs with waypoints, timers and payouts, plus hidden
  packages and taxi fares (`game/src/missions.js`).
- **Combat** — pistol with raycast hits, muzzle flash and tracers, melee punch,
  gang members who shoot back (`game/src/combat.js`).
- **HUD** — money, mission objective, wanted stars, health, speed and a live
  2D minimap (`game/src/hud.js`).
- **Sound** — fully synthesised WebAudio: engine, sirens, gunshots, pickups and
  a synthwave pad (`game/src/audio.js`).
- **Save** — money, mission progress and packages in localStorage
  (`game/src/save.js`).

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, taken
deterministically with `?shot=chase|drive|foot|mission&seed=1` — a police
chase at three stars, cruising the coast road, on foot on the pier, and the
bank hold-up from the final mission.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
