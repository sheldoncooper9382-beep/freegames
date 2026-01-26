(() => {
  // =======================
  // Utilities
  // =======================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const lerp = (a, b, t) => a + (b - a) * t;
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
    touchUI: $("touchUI"),
    knob: $("knob"),
    tShoot: $("tShoot"),
    tHyper: $("tHyper"),
    tPause: $("tPause"),
  };

  // Make canvas crisp on HiDPI
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  }
  window.addEventListener("resize", resizeCanvas, { passive: true });
  resizeCanvas();

  // =======================
  // Input (keyboard + touch)
  // =======================
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key)) e.preventDefault();

    if (!state.running && (e.key === "Enter")) startGame();
    if (e.key.toLowerCase() === "p") togglePause();
  }, { passive: false });

  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Touch stick: controls turn + thrust
  const stick = {
    active: false,
    cx: 0, cy: 0,
    x: 0, y: 0,
    dx: 0, dy: 0,
    // output:
    turn: 0,   // -1..1
    thrust: 0, // 0..1
  };

  function setKnob(px, py) {
    ui.knob.style.left = `${px}px`;
    ui.knob.style.top = `${py}px`;
  }

  function stickToOutput(dx, dy, radius) {
    const mag = Math.hypot(dx, dy);
    const n = mag > 0 ? mag / radius : 0;
    const nx = mag > 0 ? dx / mag : 0;
    const ny = mag > 0 ? dy / mag : 0;

    // Up direction => thrust, Left/Right => turn
    // Use a nice curve so it feels controllable.
    const thrust = clamp((-dy / radius + 0.05), 0, 1);
    const turn = clamp(dx / radius, -1, 1);

    stick.thrust = clamp(thrust, 0, 1);
    stick.turn = clamp(turn, -1, 1);
  }

  function initTouch() {
    const stickEl = document.querySelector(".stick");
    if (!stickEl) return;

    const onDown = (e) => {
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

      // Move knob inside ring
      const rect = stickEl.getBoundingClientRect();
      const px = rect.width / 2 + dx;
      const py = rect.height / 2 + dy;
      setKnob(px, py);

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

    // buttons
    ui.tShoot.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.running) shoot(); }, { passive: false });
    ui.tHyper.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.running) hyperspace(); }, { passive: false });
    ui.tPause.addEventListener("touchstart", (e) => { e.preventDefault(); togglePause(); }, { passive: false });
  }
  initTouch();

  // Desktop buttons
  ui.btnStart.addEventListener("click", () => startGame());
  ui.btnPause.addEventListener("click", () => togglePause());
  ui.btnHow.addEventListener("click", () => {
    ui.ovTitle.textContent = "How to play";
    ui.ovText.innerHTML =
      "Destroy asteroids, avoid collisions, and survive waves. Big rocks split into smaller ones. " +
      "Shoot carefully — you have limited fire rate.";
    ui.ovSmall.textContent = "Pro tip: Rotate first, then pulse thrust. Use hyperspace only when cornered.";
  });

  ui.tPause.addEventListener("click", () => togglePause());
  ui.tShoot.addEventListener("click", () => state.running && shoot());
  ui.tHyper.addEventListener("click", () => state.running && hyperspace());

  // =======================
  // Game state
  // =======================
  const cfg = {
    ship: {
      radius: 12,
      accel: 520,      // px/s^2
      maxSpeed: 520,   // px/s
      turnSpeed: 4.3,  // rad/s
      friction: 0.985,
      invuln: 1.8,     // seconds after spawn
    },
    bullet: {
      speed: 860,
      life: 1.1,       // seconds
      fireDelay: 0.16, // seconds
      radius: 2.2
    },
    asteroid: {
      baseSpeed: 58,
      speedJitter: 1.0,
      jag: 0.42,
      points: [20, 50, 100], // small, medium, large
      radii: [18, 34, 56],   // small, medium, large
      split: { 2: 2, 1: 2 }, // large->2 med, med->2 small
    },
    fx: {
      shake: 0,
      shakeDecay: 2.8,
    },
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
      vx: 0,
      vy: 0,
      a: -Math.PI / 2,
      dead: false,
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

  function spawnAsteroids(count) {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    const safeR = 140;
    for (let i = 0; i < count; i++) {
      let x, y;
      for (let tries = 0; tries < 50; tries++) {
        x = rand(0, w);
        y = rand(0, h);
        const dx = x - state.ship.x;
        const dy = y - state.ship.y;
        if (Math.hypot(dx, dy) > safeR) break;
      }
      const size = 2; // start large
      state.asteroids.push(makeAsteroid(x, y, size));
    }
  }

  function makeAsteroid(x, y, size /*0 small,1 med,2 large*/) {
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

  function startGame() {
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

  function spawnWave() {
    state.asteroids.length = 0;
    const count = 3 + Math.min(7, state.level); // ramps up
    spawnAsteroids(count);
    syncHUD();
  }

  function syncHUD() {
    ui.score.textContent = String(state.score);
    ui.lives.textContent = String(state.lives);
    ui.level.textContent = String(state.level);
  }

  function togglePause() {
    if (!state.running && !state.over) return;
    state.paused = !state.paused;
    ui.btnPause.textContent = state.paused ? "Resume" : "Pause";
    ui.tPause.textContent = state.paused ? "Resume" : "Pause";

    if (state.paused) {
      ui.overlay.classList.remove("hidden");
      ui.ovTitle.textContent = "Paused";
      ui.ovText.innerHTML = "Press <b>P</b> (or Pause) to resume.";
      ui.ovSmall.textContent = "Breathe. Then drift like a pro.";
    } else {
      ui.overlay.classList.add("hidden");
    }
  }

  // =======================
  // Core actions
  // =======================
  function shoot() {
    if (state.fireCooldown > 0 || state.paused || !state.running) return;

    const s = state.ship;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

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

    // tiny muzzle flash particles
    burst(s.x + nx * (cfg.ship.radius + 2), s.y + ny * (cfg.ship.radius + 2), 6, 160, 0.25);
  }

  function hyperspace() {
    if (!state.running || state.paused) return;
    if (state.hyperspaceCd > 0) return;

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    // jump to random safe-ish spot (try a few times)
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

    // If no safe spot found, still teleport (risk!)
    burst(state.ship.x, state.ship.y, 14, 260, 0.5);
    state.ship.x = rand(0, w);
    state.ship.y = rand(0, h);
    state.ship.vx *= 0.2;
    state.ship.vy *= 0.2;
    state.hyperspaceCd = 1.2;
    state.invulnT = Math.max(state.invulnT, 0.4);
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
  // Physics helpers (wrap)
  // =======================
  function wrap(obj, w, h) {
    if (obj.x < -20) obj.x = w + 20;
    if (obj.x > w + 20) obj.x = -20;
    if (obj.y < -20) obj.y = h + 20;
    if (obj.y > h + 20) obj.y = -20;
  }

  // =======================
  // Collision
  // =======================
  function hitShip() {
    if (state.invulnT > 0) return;

    state.lives -= 1;
    syncHUD();

    cfg.fx.shake = Math.max(cfg.fx.shake, 10);

    // explode ship
    burst(state.ship.x, state.ship.y, 40, 420, 0.9);

    if (state.lives <= 0) {
      gameOver();
      return;
    }

    // respawn ship
    resetShip(true);
  }

  function splitAsteroid(a) {
    const size = a.size;
    const pts = cfg.asteroid.points[size];

    state.score += pts;
    syncHUD();

    burst(a.x, a.y, 18, 260, 0.65);

    // remove asteroid
    const idx = state.asteroids.indexOf(a);
    if (idx >= 0) state.asteroids.splice(idx, 1);

    // split if possible
    if (size > 0) {
      const newSize = size - 1;
      const count = cfg.asteroid.split[size] || 2;
      for (let i = 0; i < count; i++) {
        const child = makeAsteroid(a.x, a.y, newSize);
        // inherit some momentum + randomize
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

    // cooldowns
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.invulnT = Math.max(0, state.invulnT - dt);
    state.hyperspaceCd = Math.max(0, state.hyperspaceCd - dt);
    cfg.fx.shake = Math.max(0, cfg.fx.shake - cfg.fx.shakeDecay * dt);

    // Ship control
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const thrustK = keys.has("w") || keys.has("arrowup");
    const shootK = keys.has(" ");
    const hyperK = keys.has("shift");

    if (shootK) shoot();
    if (hyperK) hyperspace();

    const s = state.ship;

    // turn
    const turnInput = (right ? 1 : 0) - (left ? 1 : 0);
    const turnTouch = stick.turn;
    const turn = clamp(turnInput + turnTouch, -1, 1);
    s.a += turn * cfg.ship.turnSpeed * dt;

    // thrust
    const thrust = clamp((thrustK ? 1 : 0) + stick.thrust, 0, 1);
    if (thrust > 0.01) {
      s.vx += Math.cos(s.a) * cfg.ship.accel * thrust * dt;
      s.vy += Math.sin(s.a) * cfg.ship.accel * thrust * dt;
      // engine particles
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

    // friction + speed cap
    s.vx *= Math.pow(cfg.ship.friction, dt * 60);
    s.vy *= Math.pow(cfg.ship.friction, dt * 60);
    const sp = Math.hypot(s.vx, s.vy);
    const max = cfg.ship.maxSpeed;
    if (sp > max) {
      const k = max / sp;
      s.vx *= k; s.vy *= k;
    }

    // move ship
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    wrap(s, w, h);

    // bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.t -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      wrap(b, w, h);
      if (b.t <= 0) state.bullets.splice(i, 1);
    }

    // asteroids
    for (const a of state.asteroids) {
      a.a += a.va * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      wrap(a, w, h);
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
      if (p.t <= 0) state.particles.splice(i, 1);
    }

    // collisions: bullets vs asteroids
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      for (let ai = state.asteroids.length - 1; ai >= 0; ai--) {
        const a = state.asteroids[ai];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx*dx + dy*dy <= (a.r + cfg.bullet.radius) ** 2) {
          // remove bullet
          state.bullets.splice(bi, 1);
          splitAsteroid(a);
          break;
        }
      }
    }

    // collisions: ship vs asteroids
    for (const a of state.asteroids) {
      const dx = s.x - a.x;
      const dy = s.y - a.y;
      if (dx*dx + dy*dy <= (a.r + cfg.ship.radius) ** 2) {
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
  function draw() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    // screen shake
    const sh = cfg.fx.shake;
    const sx = sh ? rand(-sh, sh) : 0;
    const sy = sh ? rand(-sh, sh) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    // background fade
    ctx.clearRect(0, 0, w, h);

    // stars
    ctx.globalAlpha = 1;
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

    // subtle vignette
    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.max(w,h)*0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);

    // asteroids
    for (const a of state.asteroids) drawAsteroid(a);

    // bullets
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, cfg.bullet.radius, 0, TAU);
      ctx.fillStyle = "rgba(234,240,255,.95)";
      ctx.shadowColor = "rgba(120,180,255,.7)";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // particles
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

    // ship
    if (state.ship && state.running) drawShip(state.ship);

    ctx.restore();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.a);

    // outline glow
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

    // inner sheen
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

    // ship body
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

    // cockpit
    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, TAU);
    ctx.fillStyle = "rgba(120,180,255,.75)";
    ctx.shadowColor = "rgba(120,180,255,.65)";
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // =======================
  // Main loop
  // =======================
  let perfNow = 0;

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

  // Also allow Start via overlay button even after game over
  ui.btnStart.addEventListener("click", () => startGame());

  // Keyboard enter when overlay visible
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (!state.running || state.over)) startGame();
  });

})();
