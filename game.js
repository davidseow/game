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

// ─── FEATURE FLAG ────────────────────────────────────────────────────────────
// Enable new features by appending ?features=1 to the URL.
const FF = new URLSearchParams(window.location.search).get('features') === '1';

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
  let sfxOn = true;
  let musicInterval = null;
  let musicStep = 0;
  const MUSIC_NOTES = [261, 329, 392, 523];

  function init() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  function tone(freq, type, dur, gain, when = 0) {
    if (!sfxOn || !ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  }

  function stopMusic() {
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
  }

  function startMusic(bpm = 120) {
    stopMusic();
    if (!sfxOn || !ctx) return;
    const stepMs = (60 / bpm) * 500;
    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 60 / bpm;
    const feedbackGain = ctx.createGain(); feedbackGain.gain.value = 0.32;
    const masterGain = ctx.createGain(); masterGain.gain.value = 0.15;
    delayNode.connect(feedbackGain); feedbackGain.connect(delayNode);
    delayNode.connect(masterGain); masterGain.connect(ctx.destination);
    musicStep = 0;
    musicInterval = setInterval(() => {
      if (!sfxOn) { stopMusic(); return; }
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      osc.frequency.value = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      osc.type = 'triangle';
      const dur = stepMs / 1000 * 0.85;
      envGain.gain.setValueAtTime(0.5, ctx.currentTime);
      envGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(envGain); envGain.connect(delayNode);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
      musicStep++;
    }, stepMs);
  }

  return {
    init,
    isOn()   { return sfxOn; },
    toggle() {
      const wasOn = sfxOn;
      sfxOn = !sfxOn;
      if (!sfxOn && FF) {
        stopMusic();
      } else if (sfxOn && !wasOn && FF && g.state === S.PLAYING) {
        startMusic();
      }
      localStorage.setItem('echorunner_sfx', sfxOn ? '1' : '0');
      const url = new URL(window.location);
      url.searchParams.set('sfx', sfxOn ? '1' : '0');
      window.history.replaceState({}, '', url);
      return sfxOn;
    },
    initSfx() {
      const p = new URLSearchParams(window.location.search).get('sfx');
      sfxOn = p === '0' ? false : p === '1' ? true : localStorage.getItem('echorunner_sfx') !== '0';
    },
    tap()       { tone(620, 'square', 0.04, 0.12); },
    score()     { tone(523, 'sine', 0.15, 0.2); tone(659, 'sine', 0.15, 0.2, 0.07); },
    combo()     { [523,659,784,1047].forEach((f,i) => tone(f,'sine',0.2,0.22,i*0.07)); },
    miss()      { tone(300, 'sawtooth', 0.18, 0.15); tone(200, 'sawtooth', 0.18, 0.1, 0.09); },
    die()       { tone(330,'sawtooth',0.5,0.3); tone(220,'sawtooth',0.5,0.2,0.1); tone(110,'sawtooth',0.4,0.15,0.25); },
    levelUp()   { [392,523,659,784].forEach((f,i) => tone(f,'square',0.18,0.2,i*0.09)); },
    startMusic,
    stopMusic,
  };
})();

// ─── ANALYTICS ──────────────────────────────────────────────────────────────
function track(event, params = {}) {
  if (typeof gtag === 'function') gtag('event', event, params);
}

// ─── HAPTIC FEEDBACK ─────────────────────────────────────────────────────────
function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ─── I18N ────────────────────────────────────────────────────────────────────
const LANG = {
  en: {
    title2:'RUNNER', tagline1:'Control your ECHO.', tagline2:'Delay grows each level.',
    tapToPlay:'TAP TO PLAY', best:'BEST', lvl:'LVL', echo:'ECHO', you:'YOU',
    go1:'GAME', go2:'OVER', score:'SCORE', newBest:'NEW BEST!',
    playAgain:'PLAY AGAIN', adNote:'(short ad may play)', home:'HOME',
    loading:'Loading...', tut1a:'TAP anywhere to switch lanes',
    tut1b:'Cycle: top → mid → bottom', tut2a:'YELLOW = your ECHO scores it',
    tut2b:'Be in that lane NOW', tut2c:'Echo follows later!',
    miss:'MISS', combo:'COMBO', level:'LEVEL',
    leaderboard:'LEADERBOARD', back:'BACK', submitScore:'SUBMIT SCORE',
    enterName:'Enter your name', noScores:'No scores yet. Be first!',
    yourBest:'YOUR BEST', lv:'Lv', submitting:'Submitting…', submitted:'Submitted!',
    howto:'HOW TO PLAY',
    howto1:'Tap to switch lanes',
    howto2:'Echo scores YELLOW · dodge RED',
    howto3:'Echo delay grows as you level up',
  },
  zh: {
    title2:'跑者', tagline1:'控制你的回声。',
    tagline2:'延迟随关卡增加。',
    tapToPlay:'点击开始', best:'最高分', lvl:'关卡',
    echo:'回声', you:'你',
    go1:'游戏', go2:'结束', score:'得分',
    newBest:'新纪录！', playAgain:'再玩一次',
    adNote:'（将播放短广告）', home:'主页',
    loading:'加载中…',
    tut1a:'点击屏幕切换跑道',
    tut1b:'循环：上 → 中 → 下',
    tut2a:'黄色目标 = 让回声撞上得分',
    tut2b:'现在进入该跑道',
    tut2c:'回声稍后跟随！',
    miss:'未中', combo:'连击', level:'关卡',
    leaderboard:'排行榜', back:'返回', submitScore:'提交分数',
    enterName:'输入你的名字', noScores:'暂无记录，率先上榜！',
    yourBest:'你的最高分', lv:'关', submitting:'提交中…', submitted:'提交成功！',
    howto:'玩法说明',
    howto1:'点击切换跑道',
    howto2:'回声击黄得分 · 躲开红色',
    howto3:'回声延迟随关卡增加',
  },
};
const ZH_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","WenQuanYi Micro Hei",sans-serif';
let currentLang = 'en';

function t(key) { return (LANG[currentLang] || LANG.en)[key] || LANG.en[key] || key; }
function uiFont(size) { return currentLang === 'zh' ? `${size}px ${ZH_FONT}` : `${size}px monospace`; }

function initLang() {
  const p = new URLSearchParams(window.location.search).get('lang');
  if (p === 'zh' || p === 'en') {
    currentLang = p;
    localStorage.setItem('echorunner_lang', p);
  } else {
    const saved = localStorage.getItem('echorunner_lang');
    currentLang = saved || (navigator.language.startsWith('zh') ? 'zh' : 'en');
  }
}

function setLang(l) {
  currentLang = l;
  localStorage.setItem('echorunner_lang', l);
  const url = new URL(window.location);
  url.searchParams.set('lang', l);
  window.history.replaceState({}, '', url);
}

// For overlay words (COMBO/MISS/LEVEL): pixel font in EN, system font in ZH
function displayText(ctx, text, cx, cy, scale, col) {
  if (currentLang === 'zh') {
    ctx.fillStyle = col;
    ctx.font = `bold ${Math.round(scale * 8)}px ${ZH_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy + scale * 4.5);
  } else {
    drawText5(ctx, text, cx, cy, scale, col);
  }
}

// EN | 中文 toggle rendered at given y-centre
const LANG_BTN_Y_TITLE = FF ? 520 : 488;
const LANG_BTN_Y_GO    = 502;

function drawLangToggle(ctx, y) {
  const cx = CFG.W / 2, bw = 52, bh = 28;
  ctx.fillStyle = currentLang === 'en' ? 'rgba(88,166,255,0.85)' : 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - 58, y, bw, bh);
  ctx.fillStyle = currentLang === 'en' ? '#0d1117' : 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EN', cx - 32, y + 19);

  ctx.fillStyle = currentLang === 'zh' ? 'rgba(88,166,255,0.85)' : 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx + 6, y, bw, bh);
  ctx.fillStyle = currentLang === 'zh' ? '#0d1117' : 'rgba(255,255,255,0.6)';
  ctx.font = `bold 13px ${ZH_FONT}`;
  ctx.fillText('中文', cx + 32, y + 19);
}

function checkLangToggle(lx, ly, btnY) {
  if (ly < btnY || ly > btnY + 28) return false;
  const cx = CFG.W / 2;
  if (lx >= cx - 58 && lx <= cx - 6)  { setLang('en'); return true; }
  if (lx >= cx + 6  && lx <= cx + 58) { setLang('zh'); return true; }
  return false;
}

// ─── SANITISE / FIREBASE ─────────────────────────────────────────────────────
function sanitizeName(raw) {
  return raw
    .trim()
    .replace(/[<>&"'`]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .slice(0, 12);
}

let _db = null;
function fbInit() {
  if (_db) return true;
  if (!window._fbCfg || window._fbCfg.apiKey === 'YOUR_API_KEY') return false;
  try {
    if (!firebase.apps.length) firebase.initializeApp(window._fbCfg);
    _db = firebase.database();
    return true;
  } catch(e) { return false; }
}
function fbEnabled() { return _db !== null || fbInit(); }

async function fetchLeaderboard() {
  if (!fbEnabled()) return;
  g.lb.loading = true;
  try {
    const snap = await _db.ref('leaderboard').orderByChild('score').limitToLast(25).get();
    const arr = [];
    // Use block body — arr.push() returns the new length (truthy), which would
    // cause Firebase DataSnapshot.forEach to cancel early if returned implicitly.
    snap.forEach(c => { arr.push(c.val()); });
    g.lb.entries = arr.sort((a, b) => b.score - a.score);
  } catch(e) { console.error('fetchLeaderboard:', e); }
  g.lb.loading = false;
}

async function submitScore(name, score, level) {
  if (!fbEnabled() || score <= 0) return;
  const clean = sanitizeName(name);
  if (!clean) return;
  g.lb.submitState = 'submitting';
  const path = g.dailyMode
    ? 'daily/' + new Date().toISOString().slice(0, 10)
    : 'leaderboard';
  try {
    await _db.ref(path).push({ name: clean, score, level, ts: Date.now() });
    g.lb.submitState = 'done';
    fetchLeaderboard();
  } catch(e) { g.lb.submitState = 'error'; }
}

function showNameForm() {
  if (!fbEnabled()) return;
  document.getElementById('nf-title').textContent = t('enterName');
  document.getElementById('nf-input').value = '';
  document.getElementById('name-form').style.display = 'flex';
  setTimeout(() => document.getElementById('nf-input').focus(), 100);
}

// ─── SEEDED PRNG (for daily challenge) ───────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let dailyRng = null;

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

// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_blood', label: 'FIRST BLOOD', check: s => s.yellowsTotal >= 1 },
  { id: 'echo_master', label: 'ECHO MASTER', check: s => s.level >= 5 },
  { id: 'time_lord',   label: 'TIME LORD',   check: s => s.echoDelay >= 2000 },
  { id: 'combo_king',  label: 'COMBO KING',  check: s => s.combo >= 10 },
  { id: 'speedster',   label: 'SPEEDSTER',   check: s => s.speed >= CFG.MAX_SPEED },
  { id: 'survivor',    label: 'SURVIVOR',    check: s => s.level >= 10 },
];

function checkAchievements() {
  let unlocked;
  try { unlocked = JSON.parse(localStorage.getItem('echorunner_ach') || '[]'); }
  catch(e) { unlocked = []; }
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.includes(ach.id) && ach.check(g)) {
      unlocked.push(ach.id);
      localStorage.setItem('echorunner_ach', JSON.stringify(unlocked));
      g.achTimer = 120;
      g.achLabel = ach.label;
      const pal = getPal(g.level);
      emit(CFG.W / 2, CFG.H / 3, pal.yellow, 16, true);
      Audio.levelUp();
      break;
    }
  }
}

// ─── GAME STATE ──────────────────────────────────────────────────────────────
const S = { TITLE:'TITLE', PLAYING:'PLAYING', DEAD:'DEAD', AD:'AD', LEADERBOARD:'LEADERBOARD' };

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
  lb: { entries: [], loading: false, submitState: 'idle' },
  shakeFrames: 0, shakeMag: 0,
  achTimer: 0, achLabel: '',
  dailyMode: false, dailyDate: '',
};

// ─── SHARE SCORE ─────────────────────────────────────────────────────────────
async function shareScore() {
  const offscreen = document.createElement('canvas');
  offscreen.width = 360; offscreen.height = 200;
  const oc = offscreen.getContext('2d');
  const pal = getPal(g.level);
  const grad = oc.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, pal.bg1); grad.addColorStop(1, pal.bg2);
  oc.fillStyle = grad; oc.fillRect(0, 0, 360, 200);
  drawText5(oc, 'ECHO', 180, 20, 5, pal.player);
  drawText5(oc, 'RUNNER', 180, 52, 3, pal.echo);
  oc.fillStyle = '#ffffff'; oc.font = 'bold 32px monospace';
  oc.textAlign = 'center'; oc.fillText(g.score, 180, 114);
  oc.fillStyle = 'rgba(255,255,255,0.6)'; oc.font = '11px monospace';
  oc.fillText('LVL ' + g.level + '  ·  ' + (Math.round(g.echoDelay / 100) / 10) + 's ECHO  ·  ×' + g.comboMax + ' COMBO', 180, 142);
  oc.fillStyle = 'rgba(255,255,255,0.28)'; oc.font = '9px monospace';
  oc.fillText('echo-runner', 180, 172);
  try {
    const blob = await new Promise(r => offscreen.toBlob(r, 'image/png'));
    if (!blob || blob.size === 0) throw new Error('empty');
    const file = new File([blob], 'echo-runner.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Echo Runner', files: [file] });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'echo-runner.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch(e) { /* user cancelled or not supported */ }
}

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
  g.comboMax = 0; g.tapCount = 0; g.yellowsTotal = 0; g.lb.submitState = 'idle';
  g.shakeFrames = 0; g.shakeMag = 0;
  g.achTimer = 0; g.achLabel = '';
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
  if (FF) haptic([30, 30, 30, 30, 60]);
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
  if (FF) haptic(g.combo >= 3 ? [15, 10, 15] : 15);
  const pal = getPal(g.level);
  const y = CFG.LANES[g.echoLane];
  emit(CFG.ECHO_X, y, pal.yellow, g.combo >= 3 ? 22 : 12, true);
  if (g.combo >= 3) {
    Audio.combo();
    if (FF) { g.shakeFrames = Math.max(g.shakeFrames, 6); g.shakeMag = Math.max(g.shakeMag, 4); }
  } else {
    Audio.score();
  }
  if (g.yellows >= CFG.LEVEL_YELLOWS) levelUp();
}

// ─── TRIGGER DEATH ───────────────────────────────────────────────────────────
function die(who) {
  if (g.state !== S.PLAYING) return;
  g.state = S.DEAD;
  g.deathTimer = 80;
  if (FF) { g.shakeFrames = 12; g.shakeMag = 8; haptic([200, 50, 80]); }
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
}

function triggerPlayAgain() {
  g.state = S.AD;
  track('ad_request');
  window.showAd(() => { track('ad_complete'); initGame(); g.state = S.PLAYING; if (FF) Audio.startMusic(); });
  setTimeout(() => { if (g.state === S.AD) { initGame(); g.state = S.PLAYING; if (FF) Audio.startMusic(); } }, 10000);
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
  const rng = (g.dailyMode && dailyRng) ? dailyRng : Math.random.bind(Math);
  const yellowChance = Math.max(0.4, 0.65 - (g.level - 1) * 0.02);
  const type = rng() < yellowChance ? 'yellow' : 'red';
  const lane = Math.floor(rng() * 3);
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
  // Score — nudged down to sit clear of the button row (y 2–32)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(g.score, CFG.W / 2, 44);
  // Best — right-aligned to SFX_BTN.x - 8 so it never overlaps the speaker button
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = uiFont(12);
  ctx.textAlign = 'right';
  ctx.fillText(t('best') + ' ' + g.hi, SFX_BTN.x - 8, 24);
  // Level (shifted right to clear home icon)
  ctx.textAlign = 'left';
  ctx.fillText(t('lvl') + ' ' + g.level, 38, 24);
  // Yellow progress count under LVL label
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(g.yellows + '/' + CFG.LEVEL_YELLOWS, 38, 36);

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

  // Daily mode badge
  if (FF && g.dailyMode) {
    ctx.fillStyle = 'rgba(227,179,65,0.2)';
    ctx.fillRect(CFG.W / 2 - 28, 55, 56, 12);
    ctx.fillStyle = '#e3b341';
    ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('DAILY', CFG.W / 2, 64);
  }
  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = uiFont(10);
  ctx.textAlign = 'left';
  ctx.fillText(t('echo'), CFG.ECHO_X - 18, 84);
  ctx.textAlign = 'right';
  ctx.fillText(t('you'), CFG.PLAYER_X + 18, 84);
  ctx.textAlign = 'center';
  ctx.fillText('← ' + Math.round(g.echoDelay / 100) / 10 + 's →', (CFG.ECHO_X + CFG.PLAYER_X) / 2, 84);
}

// ─── HOME BUTTON ─────────────────────────────────────────────────────────────
const HOME_BTN = { x: 2, y: 2, w: 30, h: 30 };
const SFX_BTN  = { x: CFG.W - 32, y: 2, w: 30, h: 30 };

// Tap regions — single source of truth for both drawing and hit-testing
const BTN = {
  LB_TITLE:    { x: CFG.W / 2 - 80,  y: 440, w: 160, h: 32 },
  DAILY_TITLE: { x: CFG.W / 2 - 80,  y: 480, w: 160, h: 32 },
  LB_BACK:     { x: CFG.W / 2 - 70,  y: 572, w: 140, h: 36 },
  PLAY_AGAIN:  { x: CFG.W / 2 - 90,  y: 360, w: 180, h: 44 },
  SUBMIT:      { x: CFG.W / 2 - 105, y: 428, w: 100, h: 32 },
  LB_GO:       { x: CFG.W / 2 + 5,   y: 428, w: 100, h: 32 },
  HOME_GO:     { x: CFG.W / 2 - 55,  y: 468, w: 110, h: 26 },
  SHARE:       { x: CFG.W / 2 - 55,  y: 536, w: 110, h: 26 },
};

function hitTest(lx, ly, r) {
  return lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h;
}

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

function drawSfxBtn(ctx) {
  const { x, y } = SFX_BTN;
  const on = Audio.isOn();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, 30, 30);
  const bx = x + 7, by = y + 7;
  ctx.fillStyle = on ? 'rgba(255,255,255,0.8)' : 'rgba(255,100,100,0.6)';
  // Speaker body
  ctx.fillRect(bx,     by + 4, 4, 8);
  // Speaker cone (stepped triangle)
  ctx.fillRect(bx + 4, by + 2, 2, 2);
  ctx.fillRect(bx + 4, by + 4, 5, 8);
  ctx.fillRect(bx + 4, by + 12, 2, 2);
  if (on) {
    // Sound waves
    ctx.fillRect(bx + 10, by + 3,  2, 3);
    ctx.fillRect(bx + 10, by + 10, 2, 3);
    ctx.fillRect(bx + 13, by + 1,  2, 5);
    ctx.fillRect(bx + 13, by + 10, 2, 5);
  } else {
    // Strike-through X
    ctx.fillStyle = 'rgba(255,60,60,0.95)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(bx + i * 4,      by + i * 4,      3, 3);
      ctx.fillRect(bx + 12 - i * 4, by + i * 4,      3, 3);
    }
  }
}

function goHome() {
  if (FF) Audio.stopMusic();
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
  drawText5(ctx, 'ECHO', CFG.W / 2, 140, 9, '#58a6ff');
  displayText(ctx, t('title2'), CFG.W / 2, 200, 7, '#30a46c');
  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = uiFont(13);
  ctx.textAlign = 'center';
  ctx.fillText(t('tagline1'), CFG.W / 2, 268);
  ctx.fillText(t('tagline2'), CFG.W / 2, 286);
  // How to play box
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(20, 300, CFG.W - 40, 72);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(20, 300, CFG.W - 40, 72);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = uiFont(10);
  ctx.textAlign = 'center';
  ctx.fillText(t('howto'), CFG.W / 2, 315);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = uiFont(12);
  ctx.fillText(t('howto1'), CFG.W / 2, 333);
  ctx.fillText(t('howto2'), CFG.W / 2, 350);
  ctx.fillText(t('howto3'), CFG.W / 2, 367);
  // Blink prompt
  const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 450);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = `bold 15px ${currentLang === 'zh' ? ZH_FONT : 'monospace'}`;
  ctx.fillText(t('tapToPlay'), CFG.W / 2, 393);
  // Best score
  if (g.hi > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = uiFont(12);
    ctx.fillText(t('best') + ': ' + g.hi, CFG.W / 2, 424);
  }
  // Leaderboard button
  ctx.fillStyle = 'rgba(88,166,255,0.2)';
  ctx.fillRect(BTN.LB_TITLE.x, BTN.LB_TITLE.y, BTN.LB_TITLE.w, BTN.LB_TITLE.h);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = uiFont(13);
  ctx.fillText(t('leaderboard'), CFG.W / 2, 461);
  // Daily challenge button (feature-flagged)
  if (FF) { const todayStr = new Date().toISOString().slice(0, 10);
  ctx.fillStyle = 'rgba(227,179,65,0.22)';
  ctx.fillRect(BTN.DAILY_TITLE.x, BTN.DAILY_TITLE.y, BTN.DAILY_TITLE.w, BTN.DAILY_TITLE.h);
  ctx.strokeStyle = 'rgba(227,179,65,0.5)';
  ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.strokeRect(BTN.DAILY_TITLE.x, BTN.DAILY_TITLE.y, BTN.DAILY_TITLE.w, BTN.DAILY_TITLE.h);
  ctx.fillStyle = '#e3b341';
  ctx.font = uiFont(13);
  ctx.fillText('DAILY  ' + todayStr.slice(5), CFG.W / 2, 501); }
  // Language toggle
  drawLangToggle(ctx, LANG_BTN_Y_TITLE);
}

// ─── GAME OVER SCREEN ────────────────────────────────────────────────────────
function drawGameOver(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  displayText(ctx, t('go1'), CFG.W / 2, 180, 8, '#f85149');
  displayText(ctx, t('go2'), CFG.W / 2, 232, 8, '#f85149');
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${currentLang === 'zh' ? ZH_FONT : 'monospace'}`;
  ctx.textAlign = 'center';
  ctx.fillText(t('score') + ': ' + g.score, CFG.W / 2, 316);
  if (g.score > 0 && g.score >= g.hi) {
    ctx.fillStyle = '#ffd700';
    ctx.font = uiFont(14);
    ctx.fillText(t('newBest'), CFG.W / 2, 338);
  }
  // Play again button
  ctx.fillStyle = '#238636';
  ctx.fillRect(BTN.PLAY_AGAIN.x, BTN.PLAY_AGAIN.y, BTN.PLAY_AGAIN.w, BTN.PLAY_AGAIN.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${currentLang === 'zh' ? ZH_FONT : 'monospace'}`;
  ctx.fillText(t('playAgain'), CFG.W / 2, 387);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = uiFont(10);
  ctx.fillText(t('adNote'), CFG.W / 2, 418);
  // Submit score + Leaderboard row (only show submit button if not yet submitted/skipped)
  const hasFb = fbEnabled();
  if (g.lb.submitState === 'idle') {
    ctx.fillStyle = hasFb ? 'rgba(35,134,54,0.7)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(BTN.SUBMIT.x, BTN.SUBMIT.y, BTN.SUBMIT.w, BTN.SUBMIT.h);
    ctx.fillStyle = hasFb ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.font = `bold 10px ${currentLang === 'zh' ? ZH_FONT : 'monospace'}`;
    ctx.fillText(t('submitScore'), CFG.W / 2 - 55, 449);
  }
  ctx.fillStyle = 'rgba(88,166,255,0.25)';
  ctx.fillRect(BTN.LB_GO.x, BTN.LB_GO.y, BTN.LB_GO.w, BTN.LB_GO.h);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `bold 10px ${currentLang === 'zh' ? ZH_FONT : 'monospace'}`;
  ctx.fillText(t('leaderboard'), CFG.W / 2 + 55, 449);
  // Home button
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(BTN.HOME_GO.x, BTN.HOME_GO.y, BTN.HOME_GO.w, BTN.HOME_GO.h);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = uiFont(14);
  ctx.fillText(t('home'), CFG.W / 2, 486);
  // Share score button (feature-flagged)
  if (FF) {
    ctx.fillStyle = 'rgba(88,166,255,0.18)';
    ctx.fillRect(BTN.SHARE.x, BTN.SHARE.y, BTN.SHARE.w, BTN.SHARE.h);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = uiFont(12);
    ctx.textAlign = 'center';
    ctx.fillText('SHARE SCORE', CFG.W / 2, BTN.SHARE.y + 18);
  }
  // Language toggle
  drawLangToggle(ctx, LANG_BTN_Y_GO);
}

// ─── LEADERBOARD SCREEN ──────────────────────────────────────────────────────
function drawLeaderboard(ctx) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  displayText(ctx, t('leaderboard'), CFG.W / 2, 12, 3, '#58a6ff');

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 36, CFG.W, 1);

  ctx.textAlign = 'center';
  if (!fbEnabled()) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = uiFont(12);
    ctx.fillText('Firebase not configured.', CFG.W / 2, CFG.H / 2 - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = uiFont(10);
    ctx.fillText('See index.html to set up.', CFG.W / 2, CFG.H / 2);
  } else if (g.lb.loading) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = uiFont(12);
    ctx.fillText(t('loading'), CFG.W / 2, CFG.H / 2);
  } else if (g.lb.entries.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = uiFont(12);
    ctx.fillText(t('noScores'), CFG.W / 2, CFG.H / 2);
  } else {
    const rowH = 24, startY = 46;
    for (let i = 0; i < Math.min(25, g.lb.entries.length); i++) {
      const entry = g.lb.entries[i];
      const ry = startY + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, ry, CFG.W, rowH);
      }
      const ty = ry + 17;
      ctx.textAlign = 'left';
      ctx.font = uiFont(11);
      ctx.fillStyle = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)';
      ctx.fillText('#' + (i + 1), 8, ty);
      ctx.fillStyle = '#c9d1d9';
      ctx.fillText(String(entry.name).slice(0, 10), 42, ty);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(entry.score, 272, ty);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'left';
      ctx.fillText(t('lv') + entry.level, 280, ty);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(0, 548, CFG.W, 1);
  if (g.hi > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = uiFont(11);
    ctx.textAlign = 'center';
    ctx.fillText(t('yourBest') + ': ' + g.hi, CFG.W / 2, 562);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(BTN.LB_BACK.x, BTN.LB_BACK.y, BTN.LB_BACK.w, BTN.LB_BACK.h);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = uiFont(13);
  ctx.textAlign = 'center';
  ctx.fillText(t('back'), CFG.W / 2, 595);
}

// ─── AD WAITING SCREEN ───────────────────────────────────────────────────────
function drawAdWait(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = uiFont(14);
  ctx.textAlign = 'center';
  ctx.fillText(t('loading'), CFG.W / 2, CFG.H / 2);
}

// ─── TUTORIAL PROMPTS ────────────────────────────────────────────────────────
function drawTutorial(ctx) {
  if (g.tutStep >= 3) return;
  if (g.tutStep === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, CFG.H - 160, CFG.W - 40, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = uiFont(13);
    ctx.textAlign = 'center';
    ctx.fillText(t('tut1a'), CFG.W / 2, CFG.H - 130);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('tut1b'), CFG.W / 2, CFG.H - 110);
  } else if (g.tutStep === 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, CFG.H - 180, CFG.W - 40, 96);
    ctx.fillStyle = '#e3b341';
    ctx.font = uiFont(13);
    ctx.textAlign = 'center';
    ctx.fillText(t('tut2a'), CFG.W / 2, CFG.H - 150);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(t('tut2b'), CFG.W / 2, CFG.H - 130);
    ctx.fillText(t('tut2c'), CFG.W / 2, CFG.H - 110);
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
      displayText(ctx, t('combo'), CFG.ECHO_X, y - 20, 4, pal.yellow);
      drawText5(ctx, '×' + g.combo, CFG.ECHO_X, y + 8, 5, '#ffffff');
    } else {
      drawText5(ctx, '+' + (CFG.PTS_YELLOW + (g.combo - 1) * CFG.PTS_COMBO), CFG.ECHO_X, y, 4, pal.yellow);
    }
    ctx.globalAlpha = 1;
  }
  if (g.missTimer > 0) {
    const a = Math.min(1, g.missTimer / 20);
    ctx.globalAlpha = a;
    displayText(ctx, t('miss'), CFG.ECHO_X, CFG.LANES[g.echoLane] - 28, 4, pal.red);
    ctx.globalAlpha = 1;
  }
  if (g.levelTimer > 0) {
    const a = Math.min(1, g.levelTimer / 30);
    ctx.globalAlpha = a;
    displayText(ctx, t('level') + ' ' + g.level, CFG.W / 2, CFG.H / 2 - 20, 5, pal.player);
    ctx.globalAlpha = 1;
  }
  // Flash on lane switch
  if (g.flashTimer > 0) {
    ctx.globalAlpha = g.flashTimer / 10 * 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.globalAlpha = 1;
  }
  // Achievement unlock badge
  if (FF && g.achTimer > 0) {
    const a = Math.min(1, g.achTimer / 30);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,215,0,0.18)';
    ctx.fillRect(CFG.W / 2 - 95, CFG.H / 2 - 50, 190, 40);
    ctx.strokeStyle = 'rgba(255,215,0,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(CFG.W / 2 - 95, CFG.H / 2 - 50, 190, 40);
    drawText5(ctx, g.achLabel, CFG.W / 2, CFG.H / 2 - 40, 3, '#ffd700');
    ctx.globalAlpha = 1;
  }
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────
function render(ctx, now) {
  const pal = getPal(g.level);
  drawBackground(ctx, pal);

  if (g.state === S.LEADERBOARD) { drawLeaderboard(ctx); drawSfxBtn(ctx); return; }
  if (g.state === S.TITLE) { drawTitle(ctx); drawSfxBtn(ctx); return; }
  if (g.state === S.AD)    { drawAdWait(ctx); return; }

  // Screen shake — applied to all game-play and game-over content
  let didShake = false;
  if (FF && g.shakeFrames > 0) {
    const sdx = (Math.random() - 0.5) * g.shakeMag;
    const sdy = (Math.random() - 0.5) * g.shakeMag;
    ctx.save();
    ctx.translate(sdx, sdy);
    g.shakeFrames--;
    g.shakeMag *= 0.85;
    didShake = true;
  }

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

  // Home + SFX buttons — always on top during active play/dead states
  if (g.state === S.PLAYING || g.state === S.DEAD) { drawHomeBtn(ctx, pal); drawSfxBtn(ctx); }

  if (didShake) ctx.restore();
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

function stepAnim(anim) {
  if (!anim.active) return;
  anim.t = Math.min(1, anim.t + 0.18);
  if (anim.t >= 1) anim.active = false;
}

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
  stepAnim(g.laneAnim);
  stepAnim(g.echoAnim);

  // Palette blend
  if (g.palBlend < 1) g.palBlend = Math.min(1, g.palBlend + 0.025);

  // Timers
  if (g.comboTimer > 0) g.comboTimer--;
  if (g.missTimer  > 0) g.missTimer--;
  if (g.levelTimer > 0) g.levelTimer--;
  if (g.flashTimer > 0) g.flashTimer--;
  if (FF && g.achTimer > 0) g.achTimer--;

  // Tutorial progression
  if (g.tutStep < 3) {
    if (g.tutStep === 0 && g.frame === 1) g.tutStep = 1;
    if (g.tutStep === 1 && g.frame > 180) g.tutStep = 2;
    if (g.tutStep === 2 && g.yellows >= 1) { g.tutStep = 3; localStorage.setItem('echorunner_tutDone','1'); track('tutorial_complete'); }
  }

  if (FF) checkAchievements();
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
    const { lx, ly } = tapLogical(e);
    if (checkLangToggle(lx, ly, LANG_BTN_Y_TITLE)) return;
    if (lx >= SFX_BTN.x && lx <= SFX_BTN.x + SFX_BTN.w && ly >= SFX_BTN.y && ly <= SFX_BTN.y + SFX_BTN.h) { Audio.toggle(); return; }
    if (hitTest(lx, ly, BTN.LB_TITLE)) { fetchLeaderboard(); g.state = S.LEADERBOARD; return; }
    if (FF && hitTest(lx, ly, BTN.DAILY_TITLE)) {
      const dateStr = new Date().toISOString().slice(0, 10);
      const seed = parseInt(dateStr.replace(/-/g, ''), 10);
      dailyRng = mulberry32(seed);
      g.dailyMode = true; g.dailyDate = dateStr;
      initGame(); g.state = S.PLAYING;
      g.tutStep = localStorage.getItem('echorunner_tutDone') ? 3 : 0;
      Audio.startMusic();
      return;
    }
    dailyRng = null; g.dailyMode = false;
    initGame();
    g.state = S.PLAYING;
    g.tutStep = localStorage.getItem('echorunner_tutDone') ? 3 : 0;
    if (FF) Audio.startMusic();
    return;
  }

  const { lx, ly } = tapLogical(e);

  // SFX toggle — top-right corner, all non-title states
  if (lx >= SFX_BTN.x && lx <= SFX_BTN.x + SFX_BTN.w && ly >= SFX_BTN.y && ly <= SFX_BTN.y + SFX_BTN.h) { Audio.toggle(); return; }

  if (g.state === S.LEADERBOARD) {
    if (hitTest(lx, ly, BTN.LB_BACK)) { g.state = S.TITLE; }
    return;
  }

  // Home button (top-left 30×30) — checked first in all active states
  if ((g.state === S.PLAYING || g.state === S.DEAD)
      && lx >= HOME_BTN.x && lx <= HOME_BTN.x + HOME_BTN.w
      && ly >= HOME_BTN.y && ly <= HOME_BTN.y + HOME_BTN.h) {
    goHome();
    return;
  }

  if (g.state === S.DEAD) {
    if (checkLangToggle(lx, ly, LANG_BTN_Y_GO)) return;
    if (hitTest(lx, ly, BTN.PLAY_AGAIN)) { triggerPlayAgain(); return; }
    if (hitTest(lx, ly, BTN.SUBMIT))     { showNameForm(); return; }
    if (hitTest(lx, ly, BTN.LB_GO))      { fetchLeaderboard(); g.state = S.LEADERBOARD; return; }
    if (hitTest(lx, ly, BTN.HOME_GO))               { goHome(); return; }
    if (FF && hitTest(lx, ly, BTN.SHARE))            { shareScore(); return; }
    return;
  }

  if (g.state === S.PLAYING) {
    const prev = g.playerLane;
    g.playerLane = (g.playerLane + 1) % 3;
    g.laneAnim = { active: true, from: prev, to: g.playerLane, t: 0 };
    g.flashTimer = 8;
    g.tapCount++;
    Audio.tap();
    if (FF) haptic(8);
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

  initLang();
  Audio.initSfx();
  const saved = localStorage.getItem('echorunner_hi');
  g.hi = saved ? parseInt(saved, 10) : 0;

  canvas.addEventListener('touchstart', onTap, { passive: false });
  canvas.addEventListener('mousedown',  onTap);

  document.getElementById('nf-submit').onclick = () => {
    const name = sanitizeName(document.getElementById('nf-input').value);
    if (!name) { document.getElementById('nf-input').focus(); return; }
    document.getElementById('name-form').style.display = 'none';
    submitScore(name, g.score, g.level);
  };
  document.getElementById('nf-skip').onclick = () => {
    document.getElementById('name-form').style.display = 'none';
    g.lb.submitState = 'done';
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/game/sw.js').catch(() => {});
  }

  g.state = S.TITLE;
  raf = requestAnimationFrame(loop);
})();

// Node.js test exports — inert in browser (no `module` global)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    CFG, PALETTES, LANG, S, g, hist, obs,
    hexToRgb, lerpHex, getPal,
    sanitizeName, mulberry32,
    easeOut, stepAnim, hitTest,
    t, uiFont,
    update, initGame, spawnObs, checkCollisions, scoreYellow, die,
  };
}
