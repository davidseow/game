# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ECHO RUNNER** is a zero-dependency, vanilla JavaScript HTML5 Canvas mobile game. No build system, no package manager, no transpilation—files are served directly in the browser. The entire game logic lives in a single file: `game.js`.

## Running the Game

Since there is no build step, serve the files with any static HTTP server:

```bash
# Python (recommended for local dev)
python3 -m http.server 8080

# Node.js (if available)
npx serve .
```

Open `http://localhost:8080` in a browser. There are no tests, no linting tools, and no CI configuration.

## Architecture

All game logic is in `game.js` (~749 lines), organized top-to-bottom in these sections:

### CONFIG (top of file)
Central constants for canvas dimensions (360×640), lane Y-positions (`[160, 290, 420]`), player/echo X-positions, speed ranges, scoring, and the echo delay ramp (`ECHO_DELAY_START`/`ECHO_DELAY_MAX`/`ECHO_DELAY_STEP`). Tuning gameplay feel starts here.

### Core Systems (in order of definition)

| System | What it does |
|---|---|
| **Color palettes** | 4 palette tiers that cycle every 5 levels; `hexToRgb`/`lerpHex` for smooth transitions |
| **Audio module** | Lazy Web Audio API init; all sounds are procedurally synthesized—no audio files |
| **Particle pool** | Fixed pool of 180 particles (avoids GC). `emit(x, y, color, count)` is the public API |
| **History buffer** | Ring buffer (1800 frames). Records player lane + timestamp each frame. `hist.queryAt(t)` retrieves the lane at any past timestamp—this powers the echo delay |
| **Obstacle pool** | Fixed pool of 24 obstacles. Yellow = scoring targets; red = hazards. `spawnObs(lane, type)` activates one |
| **Game state** | Plain object tracking FSM state (`TITLE/PLAYING/DEAD/AD`), score, level, combo, lane animations, tutorial progress |

### Game Loop (`loop` → `update` → `render`)

- **`update(now)`**: Pushes current player lane to history, queries echo lane `ECHO_DELAY_MS` back (grows each level), moves obstacles, checks collisions, spawns new obstacles, updates animations.
- **`render(ctx, now)`**: Draws background, lanes, obstacles (with glow/pulse effects), characters (pixel-art with animated legs), prediction trail (8-step lookahead), and HUD.
- **`loop(ts)`**: `requestAnimationFrame` wrapper calling both.

### The Echo Mechanic

The defining mechanic: the echo character mirrors whatever lane the player chose N milliseconds ago, implemented via `hist.queryAt(now - ECHO_DELAY_MS)`. Difficulty ramps by *increasing* the delay: it starts at `ECHO_DELAY_START` (100ms, nearly instant) and grows by `ECHO_DELAY_STEP` (100ms) per level up to `ECHO_DELAY_MAX` (2000ms)—forcing the player to plan further ahead.

### Input

`onTap()` cycles the player lane `0→1→2→0` on every `touchstart` or `mousedown`. Lane changes are recorded into the history buffer immediately.

### Difficulty Progression

Level-ups trigger every 12 yellows scored. Each level increases obstacle speed (cap: `MAX_SPEED`), tightens the echo delay, decreases spawn interval, and reduces yellow obstacle frequency.

### Persistence

`localStorage` stores the high score only. No backend, no accounts.

## PWA Setup

- `manifest.json`: Makes the game installable (standalone display mode, dark theme).
- `sw.js`: Service worker under cache key `echorunner-v2`. Uses **network-first** for `.js`/`.css`/`.html` (so code updates are always fetched fresh) and cache-first for everything else. When deploying, bump the version constant in `sw.js` to purge old caches.

## Key Conventions

- **Object pools over allocation**: Never `new` particles or obstacles during gameplay. Reuse pool entries by toggling an `active` flag.
- **Pixel-art rendering**: `style.css` sets `image-rendering: pixelated`. Keep canvas resolution at 360×640; do not scale up asset resolution.
- **No external assets**: Audio is synthesized via Web Audio API; characters/obstacles are drawn procedurally with canvas primitives. Do not introduce image or audio file dependencies.
- **`drawText5()`**: Custom 5×5 pixel font renderer used for all in-game text. Do not use `ctx.font` for game UI text.
