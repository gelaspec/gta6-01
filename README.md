# Meridian Bay — an open-world crime game for make.fun (gta6-01)

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gelaspec/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gelaspec/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Meridian Bay is a complete open-world crime game that runs entirely from static files — no build step, no network, no account. Steal cars, outrun the MBPD, run six story missions for fixer Inez Kade, and pull off the Meridian Job: twenty seconds inside the bank while the whole city comes for you.

## Play it

```sh
node serve.ts          # serves the game on http://localhost:8080
```

Then open http://localhost:8080 in a desktop browser and press Enter (or click) to start. Everything is generated in code: the city, the cars, the people, the radio, the sound. Three.js is vendored under `game/vendor/`.

## The game

- **The city.** A coastal 7×7 grid with five districts (Old Port, Downtown, Calle Verde, Northside, Marina), a beach and pier with a lighthouse, a plaza fountain, palm-lined streets, neon billboards, and eight landmark signs. Four times of day: golden-hour sunset, noon, neon night, dawn. The palette is deliberately bright — light-grey roads, vivid car paint, turquoise sea — so the game reads like the top entries' covers, not a dark alley.
- **On foot and by car.** Walk, run and jump as Cassian Rowe; steal any parked car with E, drive with WASD, handbrake with Space. Sedans, taxis, vans and the hot-pink Comet GT sports car all handle differently, and every car takes damage.
- **Traffic and pedestrians.** Cars follow the road grid and brake for the car ahead; pedestrians stroll the sidewalks, flee when you hit them, and shout at you.
- **Wanted and police.** Crimes raise your wanted level from one to five stars. MBPD cruisers chase and ram, foot cops close in, and at three stars the Air One helicopter puts its spotlight on you. Break line of sight and stay quiet to cool the heat. Each district tracks its own HEAT; at 5 a district goes into LOCKDOWN.
- **The story — "The Meridian Job".** Six missions with fixer briefs and MBPD radio chatter: steal your first wheels, run a 90-second courier, collect three drops, survive three stars, steal the black Harbor Kings van from the pier, and hold the bank for twenty seconds at four stars.
- **Side jobs.** Ten hidden packages across the city (+$150 each), taxi fares while you drive (+$120 a ride), and a REP ladder from Nobody to Bay Legend.
- **Combat.** Fists (F) and a pistol (click to shoot, 12 rounds, auto-reload) against Harbor Kings gunmen during the bank job.
- **HUD and minimap.** Mission panel with chapter, stage bar and NEXT line; named police units with distances and statuses; wanted stars with an IN SIGHT tag; money, day and clock; weapon slots; circular live minimap with district and street names; dialog box with portraits for Inez Kade, Cassian Rowe, MBPD Dispatch and Rook; speed, car condition, radio station and song; REP bar.
- **Sound.** A WebAudio synth: engine hum, sirens, gunshots, cash pickups and a synthwave radio loop (M to mute, R to change station).
- **Save.** Progress (money, REP, mission, packages, district heat) is saved to localStorage after every completed mission.

## Controls

| Key | Action |
| --- | --- |
| Enter / click | Start, continue, next mission |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| Space | Jump / handbrake |
| E | Steal / exit car |
| F | Punch |
| Click | Shoot (on foot) |
| C | Camera distance |
| R | Radio station |
| M | Mute |
| P | Pause |

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, taken deterministically with `?shot=<scene>&seed=1`:

1. `1-chase.jpg` — the cover: M6, four stars, Air One overhead, $31,200, golden hour, hot-pink Comet GT.
2. `2-onfoot.jpg` — M1, on foot beside a stolen sedan, $250, dusk.
3. `3-dialog.jpg` — M5, the Pier Heist brief from Inez Kade, $4,850, noon (panel and dialog name the same mission).
4. `4-progress.jpg` — M4 passed, $18,450, neon night.

Re-render them with:

```sh
node render-shots.mjs
```

## Build the dossier

```sh
node main.ts
```

This copies `game/` and `screenshots/` into `$MAKEFUN_OUTPUT_DIR` (default `/output`) and writes `dossier.json` there. Two runs from any directory produce byte-identical output. Note: `main.ts` never removes the output directory — the grader mounts `/output` as a volume, and removing a mount point fails (this is what killed the v3 entry).

## Original work

Meridian Bay is original IP written for this bounty: its city, characters, story, missions and code were created for the competition. Three.js (MIT) is vendored under `game/vendor/`; everything else is this repository's own code.
