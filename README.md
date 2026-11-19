# PALMETTO HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yskikt/palmetto-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yskikt/palmetto-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A low-poly open-world crime game for make.fun **gta6-01**, built from scratch
in `palmetto-heat-r6/`. Ray, an ex-courier driver in the fictional golden-hour
port city of **Palmetto Bay**, takes three story jobs — *First Run*,
*The Set-Up*, *Last Heat* — plus repeatable deliveries, while traffic, signals,
pedestrians, a five-star wanted system and police AI keep the city alive.

- **World**: 10×6 street grid, beachfront boulevard, turquoise sea and beach,
  downtown towers, midtown, residential blocks, a working port (warehouses,
  container stacks, gantry cranes, a cargo ship) and 112 signature palms.
- **Systems**: third-person walking, car entry/theft and arcade driving,
  traffic AI (lanes, signals, car-following), pedestrians (avoid/flee/fall),
  wanted heat with decay, police pursuit with BUSTED pressure, combat
  (fists/bat/pistol with tracers and muzzle flash), a slow-motion weapon
  wheel, an in-car WebAudio radio (4 generated stations + OFF), story
  missions with detail panels, golden beacons and minimap route lines, a full
  HUD with minimap, and localStorage saving. All audio is synthesized with
  WebAudio; there are no external assets or network requests.
- **Tech**: three.js r160 vendored as a single file under `game/vendor/`,
  modular ES modules under `game/src/`, no build step.

## Run

```
node serve.ts          # serves game/ at http://localhost:8080
node main.ts           # make.fun plumbing: copies game/ + screenshots/ and writes dossier.json
node tools/capture.mjs # headless verification + screenshot capture
```

Controls: WASD move/drive · Shift run · E enter/exit car · F/click attack ·
Tab (hold) or Q weapon wheel · R radio · M take a job · mouse drag orbits.

Screenshots are real renders captured with `?shot=hero|foot|chase|mission`.

---

Entered on [make.fun](https://make.fun/?ref=z9zjjwax&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
