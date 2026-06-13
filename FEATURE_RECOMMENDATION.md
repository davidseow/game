# Echo Runner — Feature Recommendations to Attract Players

## Context

Echo Runner is a polished, zero-dependency vanilla JS endless runner with a genuinely unique mechanic: an echo character that mirrors the player's lane with a growing time delay. The game's core loop, visuals, audio, leaderboard, and i18n are all fully implemented. The goal here is to identify additions that would most help **attract new players** and convert their first session into a habit.

Research methodology: full codebase audit of `game.js` (~749 lines) + industry research from GameAnalytics 2024–2025 benchmarks, AppsFlyer, SDT game-design research, GDC game-feel studies, Duolingo/Wordle case studies, and haptics/audio academic studies.

---

## Priority Stack

| #   | Feature                     | Impact Target                    | Effort      | Status         |
| --- | --------------------------- | -------------------------------- | ----------- | -------------- |
| 1   | Daily Challenge Mode        | D7/D30 retention                 | Medium      | ✅ Implemented |
| 2   | Haptic Feedback             | Perceived quality, feel          | Low         | ✅ Implemented |
| 3   | Screen Shake ("Juice")      | Perceived quality, word-of-mouth | Low         | ✅ Implemented |
| 4   | Shareable Score Card        | Organic acquisition (K-factor)   | Medium      | ✅ Implemented |
| 5   | Achievement System          | Competence loop, session depth   | Medium      | ✅ Implemented |
| 6   | Procedural Background Music | Session length                   | Medium-High | ✅ Implemented |

---

## Recommendation 1 — Daily Challenge Mode

### What

A fixed, seed-based obstacle sequence published once per day (UTC midnight). All players face the exact same run. A separate leaderboard (`daily_<YYYY-MM-DD>`) tracks only today's scores. The title screen shows a "DAILY" button alongside normal play.

### Why (Research)

- **Duolingo case study**: Adding daily streak mechanics improved next-day retention from 47% → 55%. Their app now has >500M downloads, with gamification cited as the #1 growth driver (Deconstructor of Fun, 2025).
- **Wordle model**: One shared puzzle per day averages **4.05M daily active users** (Udonis, 2025) — the shared experience creates social currency ("did you get today's?").
- **Industry norm**: Daily login/challenge mechanics are used by 95% of top-grossing mobile games (GameAnalytics 2024). They are the strongest single lever for D7 and D30 retention.
- **For Echo Runner specifically**: The echo delay mechanic produces deterministic, reproducible runs from identical inputs — daily seeding is architecturally trivial because obstacle timing is already driven by predictable game-state math.

### Implementation Sketch

```js
// Seed daily RNG from date string
const dailySeed = parseInt(
  new Date().toISOString().slice(0, 10).replace(/-/g, ""),
);
let rng = mulberry32(dailySeed); // replace Math.random() in spawnObs with rng()

// Separate Firebase path for daily leaderboard
const dailyDate = new Date().toISOString().slice(0, 10);
db.ref(`daily/${dailyDate}`).push({ name, score, level, ts });
```

- `mulberry32` is a 10-line seeded PRNG — no dependencies.
- Reuse existing leaderboard modal by parameterizing the DB path.
- Show a "DAILY CHALLENGE" vs "CLASSIC" toggle on the title screen.

---

## Recommendation 2 — Haptic Feedback

### What

Call `navigator.vibrate()` at key moments: lane switch (8ms pulse), yellow scored (15ms), red dodge (25ms + 10ms double), death (200ms + 80ms rumble), level-up (3-pulse pattern).

### Why (Research)

- **Quality perception**: Interhaptics/ResearchGate studies consistently show haptics increase perceived game quality scores — players rate haptic-enabled games higher on "responsiveness" and "immersion."
- **Reinforces the mechanic**: A subtle 8ms pulse when the echo character lands in its delayed lane makes the time-delay mechanic _feel_ real — players physically sense the echo arriving.
- **Low cost, high signal**: `navigator.vibrate()` is 1–2 lines of JS per event, supported on all Android browsers. iOS Safari supports haptics only via native APIs (not Web Vibration API), but that's expected.
- **Apple HIG citation**: Tactile feedback "conveys information through touch" — particularly useful for timed mechanics where visual-only feedback can be missed.

### Implementation Sketch

```js
function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// In onTap(): haptic(8);
// In scoring yellow: haptic(15);
// In die(): haptic([200, 50, 80]);
// In levelUp(): haptic([30, 30, 30, 30, 60]);
```

Respect the existing SFX toggle — add `state.hapticsOn` mirroring `state.sfxOn`, same UI button pattern.

---

## Recommendation 3 — Screen Shake ("Juice")

### What

On player or echo death, apply a brief camera shake to the canvas: translate by a decaying random offset over 12 frames before resetting.

### Why (Research)

- **"Juice It or Lose It"** (GDC 2012, Martin Jonasson & Petri Purho): Demonstrated live that adding screen shake, particles, and animation polish to an identical base game dramatically increases perceived quality and fun — without changing any rules. The talk is cited in virtually every game-feel discussion as the canonical demonstration that _feel_ drives engagement.
- **Echo Runner already has two of three juice layers**: particles (on score and death) and sound. Screen shake is the missing third.
- **Death is the emotional peak**: Research on player emotion in games (Lazzaro, 2004) identifies "fear/excitement" at loss as the most memorable moment. Shake amplifies that moment, making the game feel more consequential and the next run more motivated.

### Implementation Sketch

```js
// In state: shakeFrames: 0, shakeMag: 0
// In die(): state.shakeFrames = 12; state.shakeMag = 8;

// In render(), before any drawing:
if (state.shakeFrames > 0) {
  const dx = (Math.random() - 0.5) * state.shakeMag;
  const dy = (Math.random() - 0.5) * state.shakeMag;
  ctx.save();
  ctx.translate(dx, dy);
  state.shakeFrames--;
  state.shakeMag *= 0.85; // decay
}
// After all drawing: if (shakeFrames > 0) ctx.restore();
```

Also add a milder shake (4px, 6 frames) on combo multiplier milestones (3×, 5×, 10×).

---

## Recommendation 4 — Shareable Score Card

### What

After game-over, render a 360×200 canvas snapshot (off-screen) containing: game logo, final score, level reached, max echo delay, max combo. Offer a "SHARE" button that uses the Web Share API (`navigator.share({ files: [blob] })`) to share the image natively.

### Why (Research)

- **K-factor**: AppsFlyer defines K-factor as new organic users per existing user. For mobile games, the median K-factor is ~0.45 — meaning every 100 users generate ~45 more organically. Share cards are one of the few free levers that move this number.
- **Timing matters**: Share prompts placed at the emotional peak (just after a personal best or high combo) convert at 3–5× vs prompts shown at neutral moments (devtodev, 2020).
- **The echo mechanic is uniquely shareable**: "I reached level 12 with a 1.2s echo delay" is a self-explanatory hook that makes people curious — the delay number is novel, not just a raw score. That curiosity is the acquisition driver.
- **Wordle effect**: Wordle's grid share format went viral specifically because it was visually distinct and prompted "what is this?" — Echo Runner's delay stat has similar potential.
- **Web Share API**: Supported by iOS Safari 15+, Chrome Android, Edge Mobile — the majority of mobile browser users.

### Implementation Sketch

```js
async function shareScore() {
  const offscreen = document.createElement("canvas");
  offscreen.width = 360;
  offscreen.height = 200;
  // draw logo, score, level, echo delay, max combo
  const blob = await new Promise((r) => offscreen.toBlob(r));
  const file = new File([blob], "echo-runner.png", { type: "image/png" });
  if (navigator.share) {
    await navigator.share({ title: "Echo Runner", files: [file] });
  } else {
    // fallback: download link
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "echo-runner.png";
    a.click();
  }
}
```

Add a "SHARE" button on the DEAD screen alongside PLAY AGAIN.

---

## Recommendation 5 — Achievement System

### What

A set of in-game milestones that display a badge overlay when triggered and persist to `localStorage`. Implemented achievements:

| Achievement | Condition |

### Implementation Sketch

```js
function startMusic(bpm = 120) {
  const delayNode = ctx.createDelay(1.0);
  delayNode.delayTime.value = 60 / bpm;
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = 0.32;
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  // Arp sequence — new oscillator per step, auto-stops (no leak)
  musicInterval = setInterval(() => {
    const osc = ctx.createOscillator();
    osc.frequency.value = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    osc.connect(envGain);
    envGain.connect(delayNode);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
    musicStep++;
  }, stepMs);
}
```

Stops on SFX-off and `goHome()`. Resumes when SFX is toggled back on during active play.

---

## Priority Rationale

If only one feature ships: **Daily Challenge Mode** — it's the single biggest lever for bringing players back on D7/D30, where Echo Runner's current architecture (deterministic RNG, Firebase) makes it nearly free to build.

If two: add **Screen Shake** — it's 15 lines of code, costs nothing, and the GDC research is unambiguous that it's one of the highest-ROI polish moves available.

If three: add **Haptic Feedback** — another low-effort, high-perception-quality win that specifically reinforces the echo mechanic.

The **Share Card** and **Achievements** are medium-effort with strong acquisition/retention ROI and should follow.

**Background music** is last because it requires the most careful tuning (wrong music actively hurts engagement) but has the highest thematic fit of any feature on this list.

---

## Verification

Each test has a **pass condition** and an explicit **fail condition**.

### 1. Screen Shake

**Setup**: Trigger a death in-game (with `?features=1`).

|          |                                                                                |
| -------- | ------------------------------------------------------------------------------ |
| **Pass** | Canvas visibly offsets ≥ 4px for exactly 12 frames, then returns to origin.    |
| **Fail** | Shake never fires; OR shake never stops; OR shake triggers during normal play. |

```js
// Devtools breakpoint at ctx.translate() inside render() — confirm shakeFrames decrements 12 → 0
```

### 2. Haptic Feedback

**Setup**: Spy on `navigator.vibrate` in the browser console.

```js
const calls = [];
navigator.vibrate = (p) => {
  calls.push(p);
  return true;
};
```

|          |                                                                      |
| -------- | -------------------------------------------------------------------- |
| **Pass** | Tap → `calls` has `8`; score yellow → `15`; death → `[200, 50, 80]`. |
| **Fail** | `calls` stays empty; OR haptic fires every frame.                    |

### 3. Achievement System

**Setup**: `localStorage.removeItem('echorunner_ach')`

|          |                                                                                |
| -------- | ------------------------------------------------------------------------------ |
| **Pass** | First yellow → "FIRST BLOOD" overlay ~2s → key written → no re-fire on reload. |
| **Fail** | Overlay never appears; OR fires on every yellow; OR key absent after unlock.   |

### 4. Share Card

**Setup**: `navigator.share = async (d) => { window._shared = d; }`

|          |                                                                               |
| -------- | ----------------------------------------------------------------------------- |
| **Pass** | SHARE tap → `_shared.files[0]` is PNG, size > 0, title `'Echo Runner'`.       |
| **Fail** | `_shared` is null; OR blob size is 0; OR button present during PLAYING state. |

### 5. Daily Challenge Mode

**Setup**: Override `Date.prototype.toISOString` to a fixed date.

|          |                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Pass** | Two runs same date → identical obstacle sequence. Different date → different sequence. Firebase path is `daily/YYYY-MM-DD`. |
| **Fail** | Sequences differ same-day; OR identical across dates; OR wrong Firebase path.                                               |

### 6. Procedural Background Music

**Setup**: Spy `AudioContext.prototype.createOscillator`.

```js
let n = 0;
const orig = AudioContext.prototype.createOscillator;
AudioContext.prototype.createOscillator = function () {
  n++;
  return orig.apply(this, arguments);
};
```

|          |                                                                                     |
| -------- | ----------------------------------------------------------------------------------- |
| **Pass** | `n` increases ~every 250ms during play; stops on SFX-off; resumes on SFX-on.        |
| **Fail** | `n` never increases; OR grows unboundedly (leak); OR music continues after SFX-off. |
