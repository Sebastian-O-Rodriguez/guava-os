// ---------------------------------------------------------------------------
// TileAnimationDriver — shared rAF loop for all tile fluid fills
//
// One global loop. Tiles subscribe/unsubscribe. When no subscribers,
// the loop stops. When the first tile subscribes, it starts.
//
// This prevents N independent rAF loops for N tiles and provides
// a single point of control for pausing, throttling, or visibility gating.
// ---------------------------------------------------------------------------

type Subscriber = (time: number, dt: number) => void;

let subscribers = new Set<Subscriber>();
let animId = 0;
let lastTime = 0;
let running = false;

function loop(now: number) {
  const dt = lastTime > 0 ? (now - lastTime) / 1000 : 0.016;
  lastTime = now;

  for (const sub of subscribers) {
    sub(now, Math.min(dt, 0.05)); // cap dt to prevent jumps after tab switch
  }

  if (subscribers.size > 0) {
    animId = requestAnimationFrame(loop);
  } else {
    running = false;
    lastTime = 0;
  }
}

function start() {
  if (running) return;
  running = true;
  lastTime = 0;
  animId = requestAnimationFrame(loop);
}

function stop() {
  if (!running) return;
  cancelAnimationFrame(animId);
  running = false;
  lastTime = 0;
}

export function subscribe(fn: Subscriber) {
  subscribers.add(fn);
  start();
}

export function unsubscribe(fn: Subscriber) {
  subscribers.delete(fn);
  if (subscribers.size === 0) {
    stop();
  }
}
