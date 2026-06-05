// ─── CONFIG ────────────────────────────────────────────────────────────────
const CFG = {
  W: 360, H: 640,
  LANES: [160, 290, 420],
  PLAYER_X: 270,
  ECHO_X: 70,
  CHAR_W: 20, CHAR_H: 24,
  OBS_W: 34, OBS_H: 26,
  BASE_SPEED: 2.5,
  SPEED_PER_LEVEL: 0.22,
  MAX_SPEED: 6.5,
  ECHO_DELAY_START: 100,   // ms at level 1 (easy: echo follows almost instantly)
  ECHO_DELAY_MAX: 2000,    // ms at level 20+ (hard: plan 2 seconds ahead)
  ECHO_DELAY_STEP: 100,    // ms added per level
  HIST_CAP: 1800,
  COLL_HALF: 14,
  PTS_YELLOW: 10,
  PTS_COMBO: 5,
  SPAWN_BASE: 88,
  SPAWN_MIN: 36,
  LEVEL_YELLOWS: 12,
};

// ─── PALETTES ───────────────────────────────────────────────────────────────
const PALETTES = [
  { bg1:'#0d1117', bg2:'#161b22', player:'#58a6ff', echo:'#30a46c', yellow:'#e3b341', red:'#f85149', lane:'#21262d', trail:'#388bfd' },
  { bg1:'#2d1b69', bg2:'#1a0533', player:'#bf91f9', echo:'#7ee787', yellow:'#ffd700', red:'#ff6b6b', lane:'#3d2082', trail:'#a371f7' },
  { bg1:'#012a13', bg2:'#001a09', player:'#3fb950', echo:'#79c0ff', yellow:'#ffa657', red:'#ff7b72', lane:'#033a1b', trail:'#56d364' },
  { bg1:'#161006', bg2:'#0d0a00', player:'#ffd700', echo:'#e3b341', yellow:'#ffffff', red:'#ff4444', lane:'#2a1e05', trail:'#f0a500' },
];
function getPal(level) { return PALETTES[Math.min(Math.floor((level - 1) / 5), 3)]; }

// ─── COLOUR UTILS ───────────────────────────────────────────────────────────
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpHex(a, b, t) {
  const [r1,g1,b1] = hexToRgb(a), [r2,g2,b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2-r1)*t), g = Math.round(g1 + (g2-g1)*t), bv = Math.round(b1 + (b2-b1)*t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}

// ─── AUDIO ──────────────────────────────────────────────────────────────────
const Audio = (() => {
  let ctx = null;
  function init() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  function tone(freq, type, dur, gain, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  }
  return {
    init,
    tap()     { tone(620, 'square', 0.04, 0.12); },
    score()   { tone(523, 'sine', 0.15, 0.2); tone(659, 'sine', 0.15, 0.2, 0.07); },
    combo()   { [523,659,784,1047].forEach((f,i) => tone(f,'sine',0.2,0.22,i*0.07)); },
    miss()    { tone(300, 'sawtooth', 0.18, 0.15); tone(200, 'sawtooth', 0.18, 0.1, 0.09); },
    die()     { tone(330,'sawtooth',0.5,0.3); tone(220,'sawtooth',0.5,0.2,0.1); tone(110,'sawtooth',0.4,0.15,0.25); },
    levelUp() { [392,523,659,784].forEach((f,i) => tone(f,'square',0.18,0.2,i*0.09)); },
  };
})();

// ─── ANALYTICS ──────────────────────────────────────────────────────────────
function track(event, params = {}) {
  if (typeof gtag === 'function') gtag('event', event, params);
}

// ─── PARTICLES ──────────────────────────────────────────────────────────────
const POOL_SIZE = 180;
const parts = Array.from({length: POOL_SIZE}, () => ({active:false,x:0,y:0,vx:0,vy:0,life:0,max:0,sz:0,col:'#fff'}));

function emit(x, y, col, n, upward = false) {
  let c = 0;
  for (const p of parts) {
    if (p.active || c >= n) continue;
    const a = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 3.5;
    p.active = true; p.x = x + (Math.random()-0.5)*12; p.y = y;
    p.vx = Math.cos(a)*spd; p.vy = Math.sin(a)*spd - (upward ? 2.5 : 0);
    p.life = p.max = 30 + Math.random()*25; p.sz = 2 + Math.random()*3; p.col = col;
    c++;
  }
}

function tickParts() {
  for (const p of parts) {
    if (!p.active) continue;
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
    if (p.life <= 0) p.active = false;
  }
}

function drawParts(ctx) {
  for (const p of parts) {
    if (!p.active) continue;
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.sz), Math.round(p.sz));
  }
  ctx.globalAlpha = 1;
}

// ─── HISTORY BUFFER ─────────────────────────────────────────────────────────
const hist = {
  buf: new Array(CFG.HIST_CAP).fill(null).map(() => ({lane:1, t:0})),
  head: 0, len: 0,
  push(lane, t) {
    this.buf[this.head % CFG.HIST_CAP] = {lane, t};
    this.head++; if (this.len < CFG.HIST_CAP) this.len++;
  },
  queryAt(target) {
    if (this.len === 0) return 1;
    // Walk backward from head to find newest entry with t <= target
    for (let i = 1; i <= this.len; i++) {
      const idx = (this.head - i + CFG.HIST_CAP) % CFG.HIST_CAP;
      if (this.buf[idx].t <= target) return this.buf[idx].lane;
    }
    return this.buf[(this.head - this.len + CFG.HIST_CAP) % CFG.HIST_CAP].lane;
  },
  clear() { this.head = 0; this.len = 0; },
};

// ─── OBSTACLE POOL ──────────────────────────────────────────────────────────
const OBS_POOL = 24;
const obs = Array.from({length: OBS_POOL}, () => ({active:false, x:0, lane:0, type:'yellow', glow:0}));

function spawnObs(lane, type) {
  for (const o of obs) {
    if (o.active) continue;
    o.active = true; o.x = CFG.W + 10; o.lane = lane; o.type = type; o.glow = 0;
    return;
  }
}

// ─── GAME STATE ──────────────────────────────────────────────────────────────
const S = { TITLE:'TITLE', PLAYING:'PLAYING', DEAD:'DEAD', AD:'AD' };

const g = {
  state: S.TITLE,
  playerLane: 1,  // 0,1,2
  echoLane: 1,
  score: 0, hi: 0,
  level: 1, combo: 0,
  yellows: 0,      // yellows scored this level
  speed: CFG.BASE_SPEED,
  echoDelay: 100,
  frame: 0,
  nextSpawn: 60,
  deathTimer: 0,
  tutStep: 0,       // 0=not started,1=tap prompt,2=echo prompt,3=done
  palBlend: 0, prevPal: null,
  laneAnim: { active:false, from:1, to:1, t:0 },  // smooth lane switch
  echoAnim: { active:false, from:1, to:1, t:0 },
  comboTimer: 0,
  missTimer: 0,
  levelTimer: 0,
  flashTimer: 0,  // white flash on switch
  comboMax: 0,
  sessionStart: 0,
  tapCount: 0,
  yellowsTotal: 0,
};

// ─── AD STUB ────────────────────────────────────────────────────────────────
window.showAd = window.showAd || function(cb) { setTimeout(cb, 0); };

// ─── INIT / RESET ────────────────────────────────────────────────────────────
function initGame() {
  g.playerLane = 1; g.echoLane = 1;
  g.score = 0; g.level = 1; g.combo = 0; g.yellows = 0;
  g.speed = CFG.BASE_SPEED;
  g.echoDelay = CFG.ECHO_DELAY_START;
  g.frame = 0; g.nextSpawn = 60;
  g.deathTimer = 0; g.comboTimer = 0; g.missTimer = 0; g.levelTimer = 0; g.flashTimer = 0;
  g.palBlend = 1; g.prevPal = null;
  g.laneAnim.active = false; g.laneAnim.from = g.laneAnim.to = 1;
  g.echoAnim.active = false; g.echoAnim.from = g.echoAnim.to = 1;
  g.comboMax = 0; g.tapCount = 0; g.yellowsTotal = 0;
  g.sessionStart = performance.now();
  hist.clear();
  parts.forEach(p => p.active = false);
  obs.forEach(o => o.active = false);
  track('game_start');
}

// ─── LEVEL UP ────────────────────────────────────────────────────────────────
function levelUp() {
  const prevPalIdx = Math.min(Math.floor((g.level - 1) / 5), 3);
  g.level++;
  track('level_up', { level: g.level });
  const newPalIdx  = Math.min(Math.floor((g.level - 1) / 5), 3);
  if (newPalIdx !== prevPalIdx) { g.prevPal = PALETTES[prevPalIdx]; g.palBlend = 0; }
  g.speed = Math.min(CFG.BASE_SPEED + (g.level - 1) * CFG.SPEED_PER_LEVEL, CFG.MAX_SPEED);
  g.echoDelay = Math.min(CFG.ECHO_DELAY_MAX, CFG.ECHO_DELAY_START + (g.level - 1) * CFG.ECHO_DELAY_STEP);
  g.yellows = 0;
  g.levelTimer = 90;
  Audio.levelUp();
}

// ─── SCORE YELLOW ────────────────────────────────────────────────────────────
function scoreYellow(o) {
  o.active = false;
  g.combo++;
  g.yellows++;
  g.yellowsTotal++;
  if (g.combo > g.comboMax) g.comboMax = g.combo;
  if (g.combo === 3 || g.combo === 5 || g.combo === 10) track('combo_milestone', { combo: g.combo });
  const pts = CFG.PTS_YELLOW + Math.max(0, g.combo - 1) * CFG.PTS_COMBO;
  g.score += pts;
  if (g.score > g.hi) {
    g.hi = g.score;
    localStorage.setItem('echorunner_hi', g.hi);
    track('new_high_score', { score: g.hi });
  }
  g.comboTimer = 70;
  const pal = getPal(g.level);
  const y = CFG.LANES[g.echoLane];
  emit(CFG.ECHO_X, y, pal.yellow, g.combo >= 3 ? 22 : 12, true);
  if (g.combo >= 3) Audio.combo(); else Audio.score();
  if (g.yellows >= CFG.LEVEL_YELLOWS) levelUp();
}

// ─── TRIGGER DEATH ───────────────────────────────────────────────────────────
function die(who) {
  if (g.state !== S.PLAYING) return;
  g.state = S.DEAD;
  g.deathTimer = 80;
  const pal = getPal(g.level);
  const x = who === 'player' ? CFG.PLAYER_X : CFG.ECHO_X;
  const y = CFG.LANES[who === 'player' ? g.playerLane : g.echoLane];
  emit(x, y, pal.red, 28);
  emit(x, y, '#ffffff', 10);
  Audio.die();
  track('game_over', {
    score: g.score,
    level: g.level,
    death_by: who,
    session_sec: Math.round((performance.now() - g.sessionStart) / 1000),
    combo_max: g.comboMax,
    taps: g.tapCount,
    yellows_total: g.yellowsTotal,
  });
  setTimeout(() => {
    g.state = S.AD;
    track('ad_request');
    window.showAd(() => { track('ad_complete'); initGame(); g.state = S.PLAYING; });
    setTimeout(() => { if (g.state === S.AD) { initGame(); g.state = S.PLAYING; } }, 10000);
  }, 900);
}

// ─── COLLISIONS ──────────────────────────────────────────────────────────────
function checkCollisions() {
  for (const o of obs) {
    if (!o.active) continue;
    // Player collision (red only)
    if (o.type === 'red' && o.lane === g.playerLane
        && Math.abs(o.x - CFG.PLAYER_X) < CFG.COLL_HALF) {
      die('player'); return;
    }
    // Echo collision
    if (Math.abs(o.x - CFG.ECHO_X) < CFG.COLL_HALF && o.lane === g.echoLane) {
      if (o.type === 'yellow') { scoreYellow(o); }
      else { die('echo'); return; }
    }
  }
}

// ─── SPAWN LOGIC ─────────────────────────────────────────────────────────────
function trySpawn() {
  if (g.frame < g.nextSpawn) return;
  const pal = getPal(g.level);
  // Yellow ratio decreases with level
  const yellowChance = Math.max(0.4, 0.65 - (g.level - 1) * 0.02);
  const type = Math.random() < yellowChance ? 'yellow' : 'red';
  const lane = Math.floor(Math.random() * 3);
  spawnObs(lane, type);
  const interval = Math.max(CFG.SPAWN_MIN, CFG.SPAWN_BASE - (g.level - 1) * 3);
  g.nextSpawn = g.frame + interval;
}

// ─── DRAW CHARACTER ──────────────────────────────────────────────────────────
function drawChar(ctx, x, y, col, alpha, legFrame) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  // Head
  ctx.fillRect(x - 5, y - 12, 10, 10);
  // Body
  ctx.fillRect(x - 4, y - 2, 8, 9);
  // Legs (alternating)
  const lOff = legFrame ? 2 : 0;
  ctx.fillRect(x - 4, y + 7, 4, 5 + lOff);
  ctx.fillRect(x,     y + 7, 4, 5 - lOff + 2);
  // Eyes (white dots)
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 3, y - 9, 2, 2);
  ctx.fillRect(x + 1, y - 9, 2, 2);
  ctx.globalAlpha = 1;
}

// ─── DRAW OBSTACLE ───────────────────────────────────────────────────────────
function drawObs(ctx, o, pal) {
  const y = CFG.LANES[o.lane];
  const hw = CFG.OBS_W / 2, hh = CFG.OBS_H / 2;
  if (o.type === 'yellow') {
    // Glow pulse when echo approaching
    const dist = o.x - CFG.ECHO_X;
    const approaching = dist > 0 && dist < 120;
    if (approaching) {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 80);
      ctx.fillStyle = pal.yellow;
      ctx.fillRect(Math.round(o.x - hw - 6), Math.round(y - hh - 6), CFG.OBS_W + 12, CFG.OBS_H + 12);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = pal.yellow;
    ctx.fillRect(Math.round(o.x - hw), Math.round(y - hh), CFG.OBS_W, CFG.OBS_H);
    // Star icon (5 fillRect pixels)
    ctx.fillStyle = '#0d1117';
    const sx = Math.round(o.x), sy = Math.round(y);
    ctx.fillRect(sx-1, sy-4, 2, 8); ctx.fillRect(sx-4, sy-1, 8, 2);
    ctx.fillRect(sx-3, sy-3, 2, 2); ctx.fillRect(sx+1, sy-3, 2, 2);
    ctx.fillRect(sx-3, sy+1, 2, 2); ctx.fillRect(sx+1, sy+1, 2, 2);
  } else {
    // Red spike obstacle
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 120);
    ctx.globalAlpha = Math.abs(o.x - CFG.PLAYER_X) < 80 ? pulse : 1;
    ctx.fillStyle = pal.red;
    ctx.fillRect(Math.round(o.x - hw), Math.round(y - hh), CFG.OBS_W, CFG.OBS_H);
    // Spikes top
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < 3; i++) {
      const sx = Math.round(o.x - hw + 4 + i * 10);
      ctx.fillRect(sx, Math.round(y - hh - 5), 4, 6);
      ctx.fillRect(sx, Math.round(y + hh - 1), 4, 6);
    }
    ctx.globalAlpha = 1;
  }
}

// ─── DRAW PREDICTION TRAIL ───────────────────────────────────────────────────
function drawTrail(ctx, pal, now) {
  // Show echo's upcoming lane at several time intervals
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const futureT = now - g.echoDelay + (i / steps) * g.echoDelay;
    const lane = hist.queryAt(futureT);
    const y = CFG.LANES[lane];
    const x = CFG.ECHO_X + (CFG.PLAYER_X - CFG.ECHO_X) * (i / steps);
    // Check if any obstacle is near this trail point
    let danger = false;
    for (const o of obs) {
      if (!o.active) continue;
      if (o.type === 'red' && o.lane === lane && Math.abs(o.x - x) < 20) { danger = true; break; }
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = danger ? pal.red : pal.trail;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
  }
  ctx.globalAlpha = 1;
}

// ─── PIXEL TEXT (large display text) ────────────────────────────────────────
// Minimal 5×5 pixel font for capital letters and digits
const FONT5 = {
  'E':'1111010000111101000011110','C':'0111010000100001000001110',
  'H':'1000110001111111000110001','O':'0111010001100011000101110',
  'R':'1111010001111101001010001','U':'1000110001100011000101110',
  'N':'1000111001101011001110001','G':'0111010000100011001001110',
  'A':'0111010001111111000110001','M':'1000111011101011000110001',
  'V':'1000110001100010101000100','L':'1000010000100001000011111',
  'S':'0111110000011100000101110','T':'1111100100001000010000100',
  'P':'1111010001111101000010000','Y':'1000101010001000010000100',
  'B':'1111010001111101000111110','D':'1111010001100011000111110',
  'F':'1111010000111101000010000','I':'1111000100001000010011110',
  'K':'1000101010011000101010001','W':'1000110001101011011110001',
  'X':'1000101010001000101010001','Z':'1111100010001000100011111',
  '0':'0111010001100011000101110','1':'0010001100001000010001110',
  '2':'0111010001001100100011111','3':'1111000010011000001011110',
  '4':'1000110001111100000100001','5':'1111110000111000001011110',
  '6':'0011010000111101000101110','7':'1111100010001000100010000',
  '8':'0111010001011101000101110','9':'0111010001011100000101110',
  ' ':'0000000000000000000000000',':':'0000000100000000010000000',
  '!':'0010000100001000000000100','×':'0000010101000100101010000',
  '+':'0000000100111000010000000',
};

function drawText5(ctx, text, cx, cy, scale, col) {
  const chars = text.toUpperCase().split('');
  const totalW = chars.length * 6 * scale - scale;
  let dx = cx - totalW / 2;
  ctx.fillStyle = col;
  for (const ch of chars) {
    const bits = FONT5[ch] || FONT5[' '];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (bits[r * 5 + c] === '1') {
          ctx.fillRect(Math.round(dx + c * scale), Math.round(cy + r * scale), scale, scale);
        }
      }
    }
    dx += 6 * scale;
  }
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function drawHUD(ctx, pal) {
  // Score
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(g.score, CFG.W / 2, 36);
  // Best
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('BEST ' + g.hi, CFG.W - 8, 20);
  // Level (shifted right to clear home icon)
  ctx.textAlign = 'left';
  ctx.fillText('LVL ' + g.level, 38, 20);
  // Yellow progress count under LVL label
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(g.yellows + '/' + CFG.LEVEL_YELLOWS, 38, 32);

  // Speed bar
  const frac = (g.speed - CFG.BASE_SPEED) / (CFG.MAX_SPEED - CFG.BASE_SPEED);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 50, CFG.W, 3);
  ctx.fillStyle = pal.trail;
  ctx.fillRect(0, 50, CFG.W * Math.min(frac, 1), 3);

  // Level progress bar (segmented, yellow)
  const lvlFrac = g.yellows / CFG.LEVEL_YELLOWS;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, 55, CFG.W, 5);
  ctx.fillStyle = pal.yellow;
  ctx.fillRect(0, 55, Math.round(CFG.W * lvlFrac), 5);
  // Segment dividers (one per yellow)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 1; i < CFG.LEVEL_YELLOWS; i++) {
    ctx.fillRect(Math.round(CFG.W * i / CFG.LEVEL_YELLOWS), 55, 2, 5);
  }
  // Pulse the last segment when one yellow away
  if (g.yellows === CFG.LEVEL_YELLOWS - 1) {
    const pulse = 0.4 + 0.4 * Math.sin(Date.now() / 150);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.fillRect(Math.round(CFG.W * (CFG.LEVEL_YELLOWS - 1) / CFG.LEVEL_YELLOWS), 55,
                 Math.round(CFG.W / CFG.LEVEL_YELLOWS), 5);
  }

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ECHO', CFG.ECHO_X - 18, 84);
  ctx.textAlign = 'right';
  ctx.fillText('YOU', CFG.PLAYER_X + 18, 84);
  // Divider arrow between them
  ctx.textAlign = 'center';
  ctx.fillText('← ' + Math.round(g.echoDelay / 100) / 10 + 's →', (CFG.ECHO_X + CFG.PLAYER_X) / 2, 84);
}

// ─── HOME BUTTON ─────────────────────────────────────────────────────────────
const HOME_BTN = { x: 2, y: 2, w: 30, h: 30 };

function drawHomeBtn(ctx, pal) {
  const bx = 6, by = 6;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(HOME_BTN.x, HOME_BTN.y, HOME_BTN.w, HOME_BTN.h);
  ctx.fillStyle = pal.player;
  // Roof — three rows forming a triangle
  ctx.fillRect(bx + 7, by,     4, 3);
  ctx.fillRect(bx + 4, by + 3, 10, 3);
  ctx.fillRect(bx + 1, by + 6, 16, 3);
  // Walls
  ctx.fillRect(bx + 1, by + 9, 16, 9);
  // Door cutout
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx + 7, by + 13, 5, 5);
}

function goHome() {
  obs.forEach(o => o.active = false);
  parts.forEach(p => p.active = false);
  hist.clear();
  g.state = S.TITLE;
}

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
function drawBackground(ctx, pal) {
  const grad = ctx.createLinearGradient(0, 0, 0, CFG.H);
  let bg1 = pal.bg1, bg2 = pal.bg2;
  if (g.prevPal && g.palBlend < 1) {
    bg1 = lerpHex(g.prevPal.bg1, pal.bg1, g.palBlend);
    bg2 = lerpHex(g.prevPal.bg2, pal.bg2, g.palBlend);
  }
  grad.addColorStop(0, bg1);
  grad.addColorStop(1, bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CFG.W, CFG.H);
}

// ─── LANE DIVIDERS ───────────────────────────────────────────────────────────
function drawLanes(ctx, pal) {
  ctx.strokeStyle = pal.lane;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);
  // Draw lines between lanes
  for (let i = 0; i < 2; i++) {
    const y = (CFG.LANES[i] + CFG.LANES[i + 1]) / 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Vertical separator between echo zone and player zone
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(CFG.W / 2, 90); ctx.lineTo(CFG.W / 2, CFG.H - 60); ctx.stroke();
}

// ─── TITLE SCREEN ────────────────────────────────────────────────────────────
function drawTitle(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  drawText5(ctx, 'ECHO', CFG.W / 2, 160, 9, '#58a6ff');
  drawText5(ctx, 'RUNNER', CFG.W / 2, 220, 7, '#30a46c');
  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Control your ECHO.', CFG.W / 2, 310);
  ctx.fillText('Plan 2 seconds ahead.', CFG.W / 2, 328);
  // Blink prompt
  const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 450);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = 'bold 15px monospace';
  ctx.fillText('TAP TO START', CFG.W / 2, 410);
  // Best score
  if (g.hi > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText('BEST: ' + g.hi, CFG.W / 2, 450);
  }
}

// ─── GAME OVER SCREEN ────────────────────────────────────────────────────────
function drawGameOver(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  drawText5(ctx, 'GAME', CFG.W / 2, 180, 8, '#f85149');
  drawText5(ctx, 'OVER', CFG.W / 2, 232, 8, '#f85149');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCORE: ' + g.score, CFG.W / 2, 316);
  if (g.score > 0 && g.score >= g.hi) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px monospace';
    ctx.fillText('NEW BEST!', CFG.W / 2, 338);
  }
  // Play again button
  ctx.fillStyle = '#238636';
  ctx.fillRect(CFG.W / 2 - 90, 370, 180, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('PLAY AGAIN', CFG.W / 2, 397);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.fillText('(short ad may play)', CFG.W / 2, 428);
  // Home button
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(CFG.W / 2 - 55, 442, 110, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '14px monospace';
  ctx.fillText('HOME', CFG.W / 2, 465);
}

// ─── AD WAITING SCREEN ───────────────────────────────────────────────────────
function drawAdWait(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Loading...', CFG.W / 2, CFG.H / 2);
}

// ─── TUTORIAL PROMPTS ────────────────────────────────────────────────────────
function drawTutorial(ctx) {
  const tDone = localStorage.getItem('echorunner_tutDone');
  if (tDone) return;
  if (g.tutStep === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, CFG.H - 160, CFG.W - 40, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TAP anywhere to switch lanes', CFG.W / 2, CFG.H - 130);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Cycle: top → mid → bottom', CFG.W / 2, CFG.H - 110);
  } else if (g.tutStep === 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, CFG.H - 180, CFG.W - 40, 96);
    ctx.fillStyle = '#e3b341';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YELLOW = your ECHO scores it', CFG.W / 2, CFG.H - 150);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Be in that lane NOW', CFG.W / 2, CFG.H - 130);
    ctx.fillText('Echo follows 2 sec later!', CFG.W / 2, CFG.H - 110);
  }
}

// ─── COMBO + MISS OVERLAYS ───────────────────────────────────────────────────
function drawOverlays(ctx, pal) {
  if (g.comboTimer > 0) {
    const a = Math.min(1, g.comboTimer / 30);
    ctx.globalAlpha = a;
    const yOff = (70 - g.comboTimer) * 0.5;
    const y = CFG.LANES[g.echoLane] - 30 - yOff;
    if (g.combo >= 3) {
      drawText5(ctx, 'COMBO', CFG.ECHO_X, y - 20, 4, pal.yellow);
      drawText5(ctx, '×' + g.combo, CFG.ECHO_X, y + 8, 5, '#ffffff');
    } else {
      drawText5(ctx, '+' + (CFG.PTS_YELLOW + (g.combo - 1) * CFG.PTS_COMBO), CFG.ECHO_X, y, 4, pal.yellow);
    }
    ctx.globalAlpha = 1;
  }
  if (g.missTimer > 0) {
    const a = Math.min(1, g.missTimer / 20);
    ctx.globalAlpha = a;
    drawText5(ctx, 'MISS', CFG.ECHO_X, CFG.LANES[g.echoLane] - 28, 4, pal.red);
    ctx.globalAlpha = 1;
  }
  if (g.levelTimer > 0) {
    const a = Math.min(1, g.levelTimer / 30);
    ctx.globalAlpha = a;
    drawText5(ctx, 'LEVEL ' + g.level, CFG.W / 2, CFG.H / 2 - 20, 5, pal.player);
    ctx.globalAlpha = 1;
  }
  // Flash on lane switch
  if (g.flashTimer > 0) {
    ctx.globalAlpha = g.flashTimer / 10 * 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.globalAlpha = 1;
  }
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────
function render(ctx, now) {
  const pal = getPal(g.level);
  drawBackground(ctx, pal);

  if (g.state === S.TITLE) { drawTitle(ctx); return; }
  if (g.state === S.AD)    { drawAdWait(ctx); return; }

  drawLanes(ctx, pal);

  // Prediction trail
  if (g.state === S.PLAYING) drawTrail(ctx, pal, now);

  // Obstacles
  for (const o of obs) {
    if (o.active) drawObs(ctx, o, pal);
  }

  // Characters
  const legFrame = Math.floor(g.frame / 8) % 2;
  const playerY = g.laneAnim.active
    ? CFG.LANES[g.laneAnim.from] + (CFG.LANES[g.laneAnim.to] - CFG.LANES[g.laneAnim.from]) * easeOut(g.laneAnim.t)
    : CFG.LANES[g.playerLane];
  const echoY = g.echoAnim.active
    ? CFG.LANES[g.echoAnim.from] + (CFG.LANES[g.echoAnim.to] - CFG.LANES[g.echoAnim.from]) * easeOut(g.echoAnim.t)
    : CFG.LANES[g.echoLane];

  // Echo (behind, ghostly)
  drawChar(ctx, CFG.ECHO_X, echoY, pal.echo, 0.55, legFrame);
  // Player (solid)
  drawChar(ctx, CFG.PLAYER_X, playerY, pal.player, 1, legFrame);

  // Particles
  drawParts(ctx);

  // HUD
  drawHUD(ctx, pal);

  // Overlays
  drawOverlays(ctx, pal);

  // Tutorial
  if (g.state === S.PLAYING) drawTutorial(ctx);

  // Game over
  if (g.state === S.DEAD) drawGameOver(ctx);

  // Home button — always on top during active play/dead states
  if (g.state === S.PLAYING || g.state === S.DEAD) drawHomeBtn(ctx, pal);
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

// ─── UPDATE ──────────────────────────────────────────────────────────────────
function update(now) {
  if (g.state !== S.PLAYING) return;

  g.frame++;

  // Push player lane to history
  hist.push(g.playerLane, now);

  // Resolve echo lane from history
  const newEchoLane = hist.queryAt(now - g.echoDelay);
  if (newEchoLane !== g.echoLane) {
    g.echoAnim = { active: true, from: g.echoLane, to: newEchoLane, t: 0 };
    g.echoLane = newEchoLane;
  }

  // Move obstacles
  for (const o of obs) {
    if (!o.active) continue;
    o.x -= g.speed;
    if (o.x < -50) {
      // Yellow missed by echo check
      if (o.type === 'yellow' && o.x < CFG.ECHO_X - 40) {
        g.combo = 0; g.missTimer = 35; Audio.miss();
      }
      o.active = false;
    }
  }

  checkCollisions();
  trySpawn();
  tickParts();

  // Animations
  if (g.laneAnim.active) { g.laneAnim.t = Math.min(1, g.laneAnim.t + 0.18); if (g.laneAnim.t >= 1) g.laneAnim.active = false; }
  if (g.echoAnim.active) { g.echoAnim.t = Math.min(1, g.echoAnim.t + 0.18); if (g.echoAnim.t >= 1) g.echoAnim.active = false; }

  // Palette blend
  if (g.palBlend < 1) g.palBlend = Math.min(1, g.palBlend + 0.025);

  // Timers
  if (g.comboTimer > 0) g.comboTimer--;
  if (g.missTimer  > 0) g.missTimer--;
  if (g.levelTimer > 0) g.levelTimer--;
  if (g.flashTimer > 0) g.flashTimer--;

  // Tutorial progression
  const tDone = localStorage.getItem('echorunner_tutDone');
  if (!tDone) {
    if (g.tutStep === 0 && g.frame === 1) g.tutStep = 1;
    if (g.tutStep === 1 && g.frame > 180) g.tutStep = 2;
    if (g.tutStep === 2 && g.yellows >= 1) { g.tutStep = 3; localStorage.setItem('echorunner_tutDone','1'); track('tutorial_complete'); }
  }
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
function tapLogical(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const physX = (cx - rect.left) * dpr;
  const physY = (cy - rect.top)  * dpr;
  const scale = Math.min(canvas.width / CFG.W, canvas.height / CFG.H);
  return { lx: (physX - offX) / scale, ly: (physY - offY) / scale };
}

function onTap(e) {
  e.preventDefault();
  Audio.init();

  if (g.state === S.TITLE) {
    initGame();
    g.state = S.PLAYING;
    g.tutStep = 0;
    return;
  }

  const { lx, ly } = tapLogical(e);

  // Home button (top-left 30×30) — checked first in all active states
  if ((g.state === S.PLAYING || g.state === S.DEAD)
      && lx >= HOME_BTN.x && lx <= HOME_BTN.x + HOME_BTN.w
      && ly >= HOME_BTN.y && ly <= HOME_BTN.y + HOME_BTN.h) {
    goHome();
    return;
  }

  if (g.state === S.DEAD) {
    // HOME text button in game-over screen
    if (lx > CFG.W / 2 - 55 && lx < CFG.W / 2 + 55 && ly > 442 && ly < 478) {
      goHome();
    }
    // PLAY AGAIN button handled by die() timeout — tap is a no-op here
    return;
  }

  if (g.state === S.PLAYING) {
    const prev = g.playerLane;
    g.playerLane = (g.playerLane + 1) % 3;
    g.laneAnim = { active: true, from: prev, to: g.playerLane, t: 0 };
    g.flashTimer = 8;
    g.tapCount++;
    Audio.tap();
  }
}

// ─── CANVAS SETUP ────────────────────────────────────────────────────────────
let canvas, ctx, scaleX, scaleY, offX, offY;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  const scale = Math.min(canvas.width / CFG.W, canvas.height / CFG.H);
  offX = (canvas.width  - CFG.W * scale) / 2;
  offY = (canvas.height - CFG.H * scale) / 2;

  ctx.setTransform(scale, 0, 0, scale, offX, offY);
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
let raf;
function loop(ts) {
  update(ts);
  render(ctx, ts);
  raf = requestAnimationFrame(loop);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
(function boot() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const saved = localStorage.getItem('echorunner_hi');
  g.hi = saved ? parseInt(saved, 10) : 0;

  canvas.addEventListener('touchstart', onTap, { passive: false });
  canvas.addEventListener('mousedown',  onTap);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  g.state = S.TITLE;
  raf = requestAnimationFrame(loop);
})();
