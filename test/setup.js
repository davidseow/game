// Browser global stubs — loaded via `node --require ./test/setup.js`
// Must execute before game.js is require()'d.

const mockCtx = new Proxy({}, {
  get: (_, prop) => {
    if (prop === 'setTransform' || prop === 'fillRect' || prop === 'fillText') return () => {};
    return () => {};
  },
});

const makeMockEl = () => ({
  onclick: null,
  style: { display: '', width: '', height: '' },
  focus: () => {},
  value: '',
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }),
});

const mockCanvas = {
  ...makeMockEl(),
  width: 360,
  height: 640,
  getContext: () => mockCtx,
};

global.window = {
  location: {
    search: '',
    href: 'http://localhost/',
    toString() { return 'http://localhost/'; },
  },
  history: { replaceState: () => {} },
  devicePixelRatio: 1,
  addEventListener: () => {},
  innerWidth: 360,
  innerHeight: 640,
  showAd: undefined,
};

global.document = {
  getElementById: (id) => id === 'gameCanvas' ? mockCanvas : makeMockEl(),
  querySelector: () => makeMockEl(),
  createElement: () => makeMockEl(),
  addEventListener: () => {},
};

const _lsStore = {
  'echorunner_sfx': '0', // disable audio so Audio.score/die/etc. return early in tests
};
global.localStorage = {
  getItem: (k) => Object.prototype.hasOwnProperty.call(_lsStore, k) ? _lsStore[k] : null,
  setItem: (k, v) => { _lsStore[k] = String(v); },
  removeItem: (k) => { delete _lsStore[k]; },
  clear: () => { Object.keys(_lsStore).forEach(k => delete _lsStore[k]); },
};

global.navigator = {
  language: 'en-US',
  vibrate: () => {},
  serviceWorker: { register: () => Promise.resolve() },
};

global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.AudioContext = class {};
global.performance = { now: () => Date.now() };
global.gtag = () => {};
