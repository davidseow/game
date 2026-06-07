# ECHO RUNNER

A zero-dependency HTML5 Canvas mobile arcade game.

## Gameplay

Tap to cycle your character across three lanes. Your echo mirrors every move you make — but with a delay that grows each level (0.1 s at level 1, up to 2 s at level 20). Score points by landing your **echo** on yellow targets; dodge red hazards with **yourself**. Plan ahead or lose.

## Features

- PWA — installable on mobile home screen
- Procedural audio via Web Audio API (no audio files)
- Global leaderboard via Firebase Realtime Database
- EN / 中文 language toggle
- Google Analytics (GA4)

## Run locally

No build step, no package manager.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Tech

Vanilla JS · HTML5 Canvas · Web Audio API · Firebase Realtime Database
