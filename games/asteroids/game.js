(() => {
  // =======================
  // Utilities
  // =======================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const TAU = Math.PI * 2;

  // =======================
  // Canvas + UI
  // =======================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $("score"),
    lives: $("lives"),
    level: $("level"),
    overlay: $("overlay"),
    ovTitle: $("ovTitle"),
    ovText: $("ovText"),
    ovSmall: $("ovSmall"),
    btnStart: $("btnStart"),
    btnHow: $("btnHow"),
    btnPause: $("btnPause"),
    btnFull: $("btnFull"), // NEW
    touchUI: $("touchUI"),
    knob: $("knob"),
    tShoot: $("tShoot"),
    tHyper: $("tHyper"),
    tPause: $("tPause"),
  };

  const stageEl = document.querySelector(".stage");

  // Make canvas crisp on HiDPI
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  }
  window.addEventListener("resize", resizeCanvas, { passive: true });
  document.addEventListener("fullscreenchange", () => {
    updateFullscreenLabel();
    // allow layout to settle
    setTimeout(() => {
      resizeCanvas();
      makeStars();
    }, 50);
  });
  resizeCanvas();

  // =======================
  // Fullscreen
  // =======================
  function isFullscreen() {
    return !!document.fullscreenElement;
  }

  function updateFullscreenLabel() {
    if (!ui.btnFull) return;
    ui.btnFull.textContent = isFullscreen() ? "Exit Full Screen" : "Full Screen";
  }

  async function toggleFullscreen() {
    try {
      // Ensure audio is unlocked by a user gesture too
      sfx.ensure();

      if (!isFullscreen()) {
        // Prefer the stage container so the HUD/overlay still fits nicely
        await (stageEl?.requestFullscreen?.() || canvas.requestFullscreen?.());
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // If fullscreen fails (browser policy), do nothing silently.
    }
  }

  if (ui.btnFull) {
    ui.btnFull.addEventListener("click", toggleFullscreen);
    updateFullscreenLabel();
  }

  // =======================
  // Web Audio SFX (no files)
  // =======================
  const sfx = (() => {
    let ac = null;
    let master = null;
    let unlocked = false;

    function ensure() {
      if (unlocked) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!ac) ac = new AudioCtx();
        if (!master) {
          master = ac.createGain();
          master.gain.value = 0.28; // master volume
          master.connect(ac.destination);
        }
        if (ac.state === "suspended") ac.resume();
        unlocked = true;
      } catch {
        // ignore
      }
    }

    function envGain(t0, a, d, peak = 1, end = 0.0001) {
      const g = ac.createGain();
      g.gain.setValueAtTime(end, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(end, t0 + a + d);
      return g;
    }

    function shoot() {
      if (!unlocked || !ac) return;
      const t0 = ac.currentTime;

      // "Pew" = fast pitch drop, slight noise layer
      const o = ac.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(860, t0);
      o.frequency.exponentialRampToValueAtTime(240, t0 + 0.09);

      const g = envGain(t0, 0.003, 0.10, 0.9);

      // tiny filter to tame harshness
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(2800, t0);
      f.frequency.exponentialRampToValueAtTime(1200, t0 + 0.10);

      o.connect(f);
      f.connect(g);
      g.connect(master);

      o.start(t0);
      o.stop(t0 + 0.12);
    }

    function hit() {
      if (!unlocked || !ac) return;
      const t0 = ac.currentTime;

      // "Zap/Crack" layer
      const o = ac.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, t0);
      o.frequency.exponentialRampToValueAtTime(90, t0 + 0.14);

      const g = envGain(t0, 0.002, 0.16, 1.0);

      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(800, t0);
      f.Q.setValueAtTime(5, t0);

      o.connect(f);
      f.connect(g);
      g.connect(master);

      o.start(t0);
      o.stop(t0 + 0.18);

      // Tiny noise burst (for impact)
      noiseBurst(0.06, 0.65);
    }

    function explode() {
      if (!unlocked || !ac) return;
      const t0 = ac.currentTime;

      // Deep boom
      const o = ac.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(35, t0 + 0.35);

      const g = envGain(t0, 0.003, 0.55, 1.0);

      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900, t0);

      o.connect(f);
      f.connect(g);
      g.connect(master);

      o.start(t0);
      o.stop(t0 + 0.6);

      noiseBurst(0.25, 1.0);
    }

    function noiseBurst(len = 0.08, amp = 0.5) {
      if (!unlocked || !ac) return;
      const t0 = ac.currentTime;

      const sr = ac.sampleRate;
      const frames = Math.max(1, Math.floor(sr * len));
      const buf = ac.createBuffer(1, frames, sr);
      const data = buf.getChannelData(0);

      for (let i = 0; i < frames; i++) {
        // quick-decaying noise
        const k = 1 - i / frames;
        data[i] = (Math.random() * 2 - 1) * k;
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      const g = ac.createGain();
      g.gain.setValueAtTime(amp * 0.8, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);

      const f = ac.createBiquadFilter();
      f.type = "highpass";
      f.frequency.setValueAtTime(220, t0);

      src.connect(f);
      f.connect(g);
      g.connect(master);

      src.start(t0);
      src.stop(t0 + len);
    }

    return { ensure, shoot, hit, explode };
  })();

  // =======================
  // Input (keyboard + touch)
  // =======================
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key)) e.preventDefault();

    // Unlock audio on first key gesture
    sfx.ensure();

    if (!state.running && (e.key === "Enter")) startGame();
    if (e.key.toLowerCase() === "p") togglePause();
    if (e.key.toLowerCase() === "f") toggleFullscreen(); // NEW hotkey
  }, { passive: false });

  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Touch stick: controls turn + thrust
  const stick = {
    active: false,
    cx: 0, cy: 0,
    x: 0, y: 0,
    dx: 0, dy: 0,
    turn: 0,   // -1..1
    thrust: 0, // 0..1
  };

  function setKnob(px, py) {
    ui.knob.style.left = `${px}px`;
    ui.knob.style.top = `${py}px`;
  }

  function stickToOutput(dx, dy, radius) {
    const thrust = clamp((-dy / radius + 0.05), 0, 1);
    const turn = clamp(dx / radius, -1, 1);
    stick.thrust = thrust;
    stick.turn = turn;
  }

  function initTouch() {
    const stickEl = document.querySelector(".stick");
    if (!stickEl) return;

    const onDown = (e) => {
      sfx.ensure();
      stick.active = true;
      const rect = stickEl.getBoundingClientRect();
      stick.cx = rect.left + rect.width / 2;
      stick.cy = rect.top + rect.height / 2;
      const p = (e.touches ? e.touches[0] : e);
      stick.x = p.clientX; stick.y = p.clientY;
      stick.dx = stick.x - stick.cx;
      stick.dy = stick.y - stick.cy;
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!stick.active) return;
      const p = (e.touches ? e.touches[0] : e);
      stick.x = p.clientX; stick.y = p.clientY;
      stick.dx = stick.x - stick.cx;
      stick.dy = stick.y - stick.cy;

      const radius = 60;
      const mag = Math.hypot(stick.dx, stick.dy);
      const scale = mag > radius ? radius / mag : 1;
      const dx = stick.dx * scale;
      const dy = stick.dy * scale;

      const rect = stickEl.getBoundingClientRect();
      setKnob(rect.width / 2 + dx, rect.height / 2 + dy);

      stickToOutput(dx, dy, radius);
      e.preventDefault();
    };

    const onUp = (e) => {
      stick.active = false;
      stick.dx = stick.dy = 0;
      stick.turn = 0;
      stick.thrust = 0;
      const rect = stickEl.getBoundingClientRect();
      setKnob(rect.width / 2, rect.height / 2);
      e.preventDefault();
    };

    stickEl.addEventListener("touchstart", onDown, { passive: false });
    stickEl.addEventListener("touchmove", onMove, { passive: false });
    stickEl.addEventListener("touchend", onUp, { passive: false });
    stickEl.addEventListener("touchcancel", onUp, { passive: false });

    ui.tShoot.addEventListener("touchstart", (e) => { e.preventDefault(); sfx.ensure(); if (state.running) shoot(); }, { passive: false });
    ui.tHyper.addEventListener("touchstart", (e) => { e.preventDefault(); sfx.ensure(); if (state.running) hyperspace(); }, { passive: false });
    ui.tPause.addEventListener("touchstart", (e) => { e.preventDefault(); sfx.ensure(); togglePause(); }, { passive: false });

    ui.tShoot.addEventListener("click", () => { sfx.ensure(); state.running && shoot(); });
    ui.tHyper.addEventListener("click", () => { sfx.ensure(); state.running && hyperspace(); });
    ui.tPause.addEventListener("click", () => { sfx.ensure(); togglePause(); });
  }
  initTouch();

  // Desktop buttons
  ui.btnStart.addEventListener("click", () => { sfx.ensure(); startGame(); });
  ui.btnPause.addEventListener("click", () => { sfx.ensure(); togglePause(); });
  ui.btnHow.addEventListener("click", () => {
    sfx.ensure();
    ui.ovTitle.textContent = "How to play";
    ui.ovText.innerHTML =
      "Destroy asteroids, avoid collisions, and survive waves. Big rocks split into smaller ones. " +
      "Shoot carefully — you have limited fire rate.";
    ui.ovSmall.textContent = "Pro tip: Rotate first, then pulse thrust. Use hyperspace only when cornered.";
  });

  // =======================
  // Game state
  // =======================
  const cfg = {
    ship: {
      radius: 12,
      accel: 520,
      maxSpeed: 520,
      turnSpeed: 4.3,
      friction: 0.985,
      invuln: 1.8,
    },
    bullet: {
      speed: 860,
      life: 1.1,
      fireDelay: 0.16,
      radius: 2.2
    },
    asteroid: {
      baseSpeed: 58,
      jag: 0.42,
      points: [20, 50, 100], // small, medium, large
      radii: [18, 34, 56],
      split: { 2: 2, 1: 2 },
    },
    fx: { shake: 0, shakeDecay: 2.8 },
  };

  const state = {
    running: false,
    paused: false,
    over: false,
    score: 0,
    lives: 3,
    level: 1,
    lastTime: 0,
    fireCooldown: 0,
    invulnT: 0,
    hyperspaceCd: 0,
    stars: [],
    bullets: [],
    asteroids: [],
    particles: [],
    ship: null,
  };

  function resetShip(center = true) {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    state.ship = {
      x: center ? w / 2 : rand(0, w),
      y: center ? h / 2 : rand(0, h),
      vx: 0, vy: 0,
      a: -Math.PI / 2,
    };
    state.invulnT = cfg.ship.invuln;
    state.hyperspaceCd = 0;
  }

  function makeStars() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const n = Math.round((w * h) / 14000);
    state.stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(0.6, 1.8),
      tw: rand(0.2, 1.0),
      ph: rand(0, TAU),
    }));
  }
  makeStars();
  window.addEventListener("resize", makeStars, { passive: true });

  function makeAsteroid(x, y, size) {
    const r = cfg.asteroid.radii[size];
    const pts = [];
    const n = randi(10, 16);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      const noise = rand(1 - cfg.asteroid.jag, 1 + cfg.asteroid.jag);
      pts.push({ ang, k: noise });
    }

    const base = cfg.asteroid.baseSpeed + state.level * 7;
    const sp = base * rand(0.75, 1.25);
    const dir = rand(0, TAU);

    return {
      x, y,
      vx: Math.cos(dir) * sp,
      vy: Math.sin(dir) * sp,
      a: rand(0, TAU),
      va: rand(-1.2, 1.2),
      size,
      r,
      pts,
    };
  }

  function spawnAsteroids(count) {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    const safeR = 140;
    for (let i = 0; i < count; i++) {
      let x, y;
      for (let tries = 0; tries < 50; tries++) {
        x = rand(0, w);
        y = rand(0, h);
        if (Math.hypot(x - state.ship.x, y - state.ship.y) > safeR) break;
      }
      state.asteroids.push(makeAsteroid(x, y, 2));
    }
  }

  function spawnWave() {
    state.asteroids.length = 0;
    const count = 3 + Math.min(7, state.level);
    spawnAsteroids(count);
    syncHUD();
  }

  function syncHUD() {
    ui.score.textContent = String(state.score);
    ui.lives.textContent = String(state.lives);
    ui.level.textContent = String(state.level);
  }

  function startGame() {
    sfx.ensure();
    state.running = true;
    state.paused = false;
    state.over = false;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.bullets.length = 0;
    state.asteroids.length = 0;
    state.particles.length = 0;
    state.fireCooldown = 0;

    resetShip(true);
    spawnWave();

    ui.overlay.classList.add("hidden");
    syncHUD();
  }

  function gameOver() {
    state.over = true;
    state.running = false;
    ui.overlay.classList.remove("hidden");
    ui.ovTitle.textContent = "Game Over";
    ui.ovText.innerHTML = `Final score: <b>${state.score}</b>. Press <b>Enter</b> (or Start) to try again.`;
    ui.ovSmall.textContent = "Tip: Keep distance from rocks — bullets travel fast, but you don’t.";
  }

  function togglePause() {
    if (!state.running && !state.over) return;
    state.paused = !state.paused;
    ui.btnPause.textContent = state.paused ? "Resume" : "Pause";
    ui.tPause.textContent = state.paused ? "Resume" : "Pause";

    if (state.paused) {
      ui.overlay.classList.remove("hidden");
      ui.ovTitle.textContent = "Paused";
      ui.ovText.innerHTML = "Press <b>P</b> (or Pause) to resume. Press <b>F</b> for fullscreen.";
      ui.ovSmall.textContent = "Breathe. Then drift like a pro.";
    } else {
      ui.overlay.classList.add("hidden");
    }
  }

  // =======================
  // Particles
  // =======================
  function burst(x, y, n, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const v = rand(spd * 0.35, spd);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        t: rand(life * 0.5, life),
        s: rand(1.2, 2.8),
      });
    }
  }

  // =======================
  // Wrap helper
  // =======================
  function wrap(obj, w, h) {
    if (obj.x < -20) obj.x = w + 20;
    if (obj.x > w + 20) obj.x = -20;
    if (obj.y < -20) obj.y = h + 20;
    if (obj.y > h + 20) obj.y = -20;
  }

  // =======================
  // Core actions
  // =======================
  function shoot() {
    if (state.fireCooldown > 0 || state.paused || !state.running) return;

    const s = state.ship;
    const nx = Math.cos(s.a);
    const ny = Math.sin(s.a);

    state.bullets.push({
      x: s.x + nx * (cfg.ship.radius + 2),
      y: s.y + ny * (cfg.ship.radius + 2),
      vx: s.vx + nx * cfg.bullet.speed,
      vy: s.vy + ny * cfg.bullet.speed,
      t: cfg.bullet.life,
    });

    state.fireCooldown = cfg.bullet.fireDelay;

    // SFX + tiny muzzle burst
    sfx.shoot();
    burst(s.x + nx * (cfg.ship.radius + 2), s.y + ny * (cfg.ship.radius + 2), 6, 160, 0.25);
  }

  function hyperspace() {
    if (!state.running || state.paused) return;
    if (state.hyperspaceCd > 0) return;

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    for (let tries = 0; tries < 40; tries++) {
      const x = rand(0, w);
      const y = rand(0, h);
      const ok = state.asteroids.every(a => Math.hypot(a.x - x, a.y - y) > a.r + 60);
      if (ok) {
        burst(state.ship.x, state.ship.y, 14, 260, 0.5);
        state.ship.x = x;
        state.ship.y = y;
        state.ship.vx *= 0.2;
        state.ship.vy *= 0.2;
        state.hyperspaceCd = 1.2;
        state.invulnT = Math.max(state.invulnT, 0.6);
        burst(x, y, 14, 260, 0.5);
        return;
      }
    }

    burst(state.ship.x, state.ship.y, 14, 260, 0.5);
    state.ship.x = rand(0, w);
    state.ship.y = rand(0, h);
    state.ship.vx *= 0.2;
    state.ship.vy *= 0.2;
    state.hyperspaceCd = 1.2;
    state.invulnT = Math.max(state.invulnT, 0.4);
  }

  // =======================
  // Collision
  // =======================
  function hitShip() {
    if (state.invulnT > 0) return;

    state.lives -= 1;
    syncHUD();

    cfg.fx.shake = Math.max(cfg.fx.shake, 10);

    // SFX explode (bonus)
    sfx.explode();

    burst(state.ship.x, state.ship.y, 40, 420, 0.9);

    if (state.lives <= 0) {
      gameOver();
      return;
    }

    resetShip(true);
  }

  function splitAsteroid(a) {
    const pts = cfg.asteroid.points[a.size];
    state.score += pts;
    syncHUD();

    // SFX hit
    sfx.hit();

    burst(a.x, a.y, 18, 260, 0.65);

    const idx = state.asteroids.indexOf(a);
    if (idx >= 0) state.asteroids.splice(idx, 1);

    if (a.size > 0) {
      const newSize = a.size - 1;
      const count = cfg.asteroid.split[a.size] || 2;
      for (let i = 0; i < count; i++) {
        const child = makeAsteroid(a.x, a.y, newSize);
        child.vx = a.vx * 0.5 + child.vx * 0.7;
        child.vy = a.vy * 0.5 + child.vy * 0.7;
        state.asteroids.push(child);
      }
    }
  }

  // =======================
  // Update loop
  // =======================
  function update(dt) {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.invulnT = Math.max(0, state.invulnT - dt);
    state.hyperspaceCd = Math.max(0, state.hyperspaceCd - dt);
    cfg.fx.shake = Math.max(0, cfg.fx.shake - cfg.fx.shakeDecay * dt);

    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const thrustK = keys.has("w") || keys.has("arrowup");
    const shootK = keys.has(" ");
    const hyperK = keys.has("shift");

    if (shootK) shoot();
    if (hyperK) hyperspace();

    const s = state.ship;

    const turnInput = (right ? 1 : 0) - (left ? 1 : 0);
    const turn = clamp(turnInput + stick.turn, -1, 1);
    s.a += turn * cfg.ship.turnSpeed * dt;

    const thrust = clamp((thrustK ? 1 : 0) + stick.thrust, 0, 1);
    if (thrust > 0.01) {
      s.vx += Math.cos(s.a) * cfg.ship.accel * thrust * dt;
      s.vy += Math.sin(s.a) * cfg.ship.accel * thrust * dt;

      if (Math.random() < 10 * dt) {
        const backA = s.a + Math.PI + rand(-0.35, 0.35);
        const v = rand(80, 220);
        state.particles.push({
          x: s.x - Math.cos(s.a) * (cfg.ship.radius - 2),
          y: s.y - Math.sin(s.a) * (cfg.ship.radius - 2),
          vx: Math.cos(backA) * v + s.vx * 0.1,
          vy: Math.sin(backA) * v + s.vy * 0.1,
          t: rand(0.18, 0.32),
          s: rand(1.0, 2.2),
        });
      }
    }

    s.vx *= Math.pow(cfg.ship.friction, dt * 60);
    s.vy *= Math.pow(cfg.ship.friction, dt * 60);

    const sp = Math.hypot(s.vx, s.vy);
    if (sp > cfg.ship.maxSpeed) {
      const k = cfg.ship.maxSpeed / sp;
      s.vx *= k; s.vy *= k;
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    wrap(s, w, h);

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.t -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      wrap(b, w, h);
      if (b.t <= 0) state.bullets.splice(i, 1);
    }

    for (const a of state.asteroids) {
      a.a += a.va * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      wrap(a, w, h);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
      if (p.t <= 0) state.particles.splice(i, 1);
    }

    // bullets vs asteroids
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      for (let ai = state.asteroids.length - 1; ai >= 0; ai--) {
        const a = state.asteroids[ai];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy <= (a.r + cfg.bullet.radius) ** 2) {
          state.bullets.splice(bi, 1);
          splitAsteroid(a);
          break;
        }
      }
    }

    // ship vs asteroids
    for (const a of state.asteroids) {
      const dx = s.x - a.x;
      const dy = s.y - a.y;
      if (dx * dx + dy * dy <= (a.r + cfg.ship.radius) ** 2) {
        hitShip();
        break;
      }
    }

    // next wave
    if (state.asteroids.length === 0 && state.running) {
      state.level += 1;
      syncHUD();
      resetShip(true);
      spawnWave();
    }
  }

  // =======================
  // Render
  // =======================
  let perfNow = 0;

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.a);

    ctx.shadowColor = "rgba(120,180,255,.28)";
    ctx.shadowBlur = 18;

    ctx.beginPath();
    const r = a.r;
    for (let i = 0; i < a.pts.length; i++) {
      const p = a.pts[i];
      const rr = r * p.k;
      const x = Math.cos(p.ang) * rr;
      const y = Math.sin(p.ang) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(234,240,255,.78)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const g = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.2, 0, 0, r*1.2);
    g.addColorStop(0, "rgba(255,255,255,.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawShip(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);

    const R = cfg.ship.radius;
    const inv = state.invulnT > 0;
    const blink = inv ? (Math.sin(perfNow * 12) > 0.2) : false;

    ctx.beginPath();
    ctx.moveTo(R + 4, 0);
    ctx.lineTo(-R, -R * 0.72);
    ctx.lineTo(-R * 0.58, 0);
    ctx.lineTo(-R, R * 0.72);
    ctx.closePath();

    ctx.lineWidth = 2.2;

    if (inv && blink) {
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.shadowColor = "rgba(255,120,214,.35)";
      ctx.shadowBlur = 14;
    } else {
      ctx.strokeStyle = "rgba(234,240,255,.9)";
      ctx.shadowColor = "rgba(120,180,255,.55)";
      ctx.shadowBlur = 18;
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, TAU);
    ctx.fillStyle = "rgba(120,180,255,.75)";
    ctx.shadowColor = "rgba(120,180,255,.65)";
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function draw() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    const sh = cfg.fx.shake;
    const sx = sh ? rand(-sh, sh) : 0;
    const sy = sh ? rand(-sh, sh) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.clearRect(0, 0, w, h);

    for (const s of state.stars) {
      s.ph += 0.012;
      const tw = 0.55 + 0.45 * Math.sin(s.ph) * s.tw;
      ctx.globalAlpha = 0.6 * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = "rgba(234,240,255,1)";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.max(w,h)*0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);

    for (const a of state.asteroids) drawAsteroid(a);

    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, cfg.bullet.radius, 0, TAU);
      ctx.fillStyle = "rgba(234,240,255,.95)";
      ctx.shadowColor = "rgba(120,180,255,.7)";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const p of state.particles) {
      const t = clamp(p.t / 1.0, 0, 1);
      ctx.globalAlpha = clamp(t, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, TAU);
      ctx.fillStyle = "rgba(234,240,255,.9)";
      ctx.shadowColor = "rgba(255,120,214,.45)";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (state.ship && state.running) drawShip(state.ship);

    ctx.restore();
  }

  // =======================
  // Main loop
  // =======================
  function frame(t) {
    perfNow = t / 1000;

    if (!state.lastTime) state.lastTime = t;
    const dt = clamp((t - state.lastTime) / 1000, 0, 0.033);
    state.lastTime = t;

    if (state.running && !state.paused) update(dt);
    draw();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Allow Start after game over too
  ui.btnStart.addEventListener("click", () => { sfx.ensure(); startGame(); });

})();
