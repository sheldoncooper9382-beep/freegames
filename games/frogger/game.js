(() => {
  "use strict";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("c");
  const ctx = canvas.getContext("2d", { alpha: true });

  const ui = {
    score: $("score"),
    lives: $("lives"),
    level: $("level"),
    status: $("status"),
    btnStart: $("btnStart"),
    btnPause: $("btnPause"),
    btnRestart: $("btnRestart"),
    btnSound: $("btnSound"),
    btnFS: $("btnFS"),
  };

  // ---------- HiDPI canvas scaling (crisp on mobile) ----------
  function fitCanvas() {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();

    // Keep internal resolution proportional to original aspect
    const baseW = 960, baseH = 720;
    const aspect = baseW / baseH;

    let w = rect.width;
    let h = rect.height;
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;

    const internalW = Math.round(w * dpr);
    const internalH = Math.round(h * dpr);

    // Prevent churn if unchanged
    if (canvas.width !== internalW || canvas.height !== internalH) {
      canvas.width = internalW;
      canvas.height = internalH;
    }

    // Scale drawing space to "world" units
    scale.x = internalW / baseW;
    scale.y = internalH / baseH;
  }

  const scale = { x: 1, y: 1 };
  window.addEventListener("resize", () => { fitCanvas(); draw(); }, { passive: true });

  // ---------- Audio (procedural SFX, no external files) ----------
  let audio = null;
  let soundOn = true;

  function ensureAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
  }

  function beep({ type="sine", freq=440, dur=0.08, gain=0.08, detune=0, sweepTo=null } = {}) {
    if (!soundOn) return;
    ensureAudio();
    if (!audio) return;
    if (audio.state === "suspended") audio.resume().catch(()=>{});

    const t0 = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    if (detune) o.detune.setValueAtTime(detune, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noisePop({ dur=0.12, gain=0.10, tone=280 } = {}) {
    if (!soundOn) return;
    ensureAudio();
    if (!audio) return;
    if (audio.state === "suspended") audio.resume().catch(()=>{});

    const t0 = audio.currentTime;
    const bufferSize = Math.floor(audio.sampleRate * dur);
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const x = i / bufferSize;
      // "crunchy" pop: noise with quick decay
      data[i] = (Math.random() * 2 - 1) * (1 - x) * (1 - x);
    }
    const src = audio.createBufferSource();
    src.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(tone, t0);
    filter.Q.setValueAtTime(2.2, t0);

    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(audio.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    hop: () => beep({ type:"triangle", freq: 520, dur: 0.06, gain: 0.06, sweepTo: 740 }),
    home: () => { beep({ type:"sine", freq: 660, dur: 0.10, gain: 0.07, sweepTo: 880 }); beep({ type:"sine", freq: 990, dur: 0.12, gain: 0.05 }); },
    hit: () => noisePop({ dur: 0.14, gain: 0.12, tone: 220 }),
    splash: () => noisePop({ dur: 0.18, gain: 0.10, tone: 420 }),
    level: () => { beep({ type:"square", freq: 440, dur: 0.09, gain: 0.06 }); beep({ type:"square", freq: 554, dur: 0.09, gain: 0.06 }); beep({ type:"square", freq: 659, dur: 0.12, gain: 0.06 }); }
  };

  // ---------- Game constants (world units) ----------
  const W = 960;
  const H = 720;

  const GRID_COLS = 13;         // classic-ish width
  const CELL = 64;              // world cell size (in world coords)
  const PLAY_W = GRID_COLS * CELL; // 832
  const LEFT = Math.round((W - PLAY_W) / 2);

  const ROWS = 11; // safe/home + river + median + road + safe
  const TOP = 24;
  const ROW_H = 60;

  const rowY = (r) => TOP + r * ROW_H;

  // Row indices
  const R_HOME = 0;
  const R_RIVER_START = 1; // 1-4 river
  const R_RIVER_END = 4;
  const R_MEDIAN = 5;
  const R_ROAD_START = 6; // 6-9 road
  const R_ROAD_END = 9;
  const R_START = 10;

  const HOMES = 5;

  // ---------- State ----------
  const state = {
    running: false,
    paused: false,
    level: 1,
    score: 0,
    lives: 3,
    homes: Array(HOMES).fill(false),
    // frog is grid-based movement
    frog: { gx: Math.floor(GRID_COLS / 2), gr: R_START, alive: true, rideVX: 0, invuln: 0 },
    // entities are per-row lists
    cars: [],
    logs: [],
    tick: 0,
    timeBonus: 0,
    // for touch input
    touch: { x: 0, y: 0, t: 0, active: false },
  };

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const wrapX = (x) => {
    const min = LEFT - 220;
    const max = LEFT + PLAY_W + 220;
    const span = max - min;
    while (x < min) x += span;
    while (x > max) x -= span;
    return x;
  };

  function setStatus(msg) {
    ui.status.innerHTML = msg;
  }

  function updateHUD() {
    ui.score.textContent = String(state.score);
    ui.lives.textContent = String(state.lives);
    ui.level.textContent = String(state.level);
  }

  function resetFrog() {
    state.frog.gx = Math.floor(GRID_COLS / 2);
    state.frog.gr = R_START;
    state.frog.alive = true;
    state.frog.rideVX = 0;
    state.frog.invuln = 0.55; // short grace after respawn
  }

  function resetLevel(keepProgress = true) {
    if (!keepProgress) {
      state.level = 1;
      state.score = 0;
      state.lives = 3;
      state.homes = Array(HOMES).fill(false);
    }
    resetFrog();
    buildRows();
    state.timeBonus = Math.max(0, 6000 - (state.level - 1) * 500); // ms pool
    updateHUD();
  }

  // ---------- Build rows ----------
  function buildRows() {
    state.cars = [];
    state.logs = [];

    // Speed scales by level but stays fair on mobile
    const speedMul = 1 + (state.level - 1) * 0.10;

    // Road rows 6-9
    const roadDefs = [
      { r: 6, dir: +1, speed: 165 },
      { r: 7, dir: -1, speed: 210 },
      { r: 8, dir: +1, speed: 260 },
      { r: 9, dir: -1, speed: 305 },
    ];

    for (const d of roadDefs) {
      const lane = [];
      const count = 3 + Math.min(3, Math.floor((state.level - 1) / 2));
      for (let i = 0; i < count; i++) {
        const w = [88, 104, 128][irand(0, 2)];
        lane.push({
          r: d.r,
          x: LEFT + rand(0, PLAY_W),
          w,
          h: 38,
          vx: d.dir * d.speed * speedMul,
          type: ["car", "truck", "car"][irand(0, 2)]
        });
      }
      state.cars.push(lane);
    }

    // River rows 1-4 (logs + pads)
    const riverDefs = [
      { r: 1, dir: -1, speed: 110, kind: "log" },
      { r: 2, dir: +1, speed: 140, kind: "turtle" },
      { r: 3, dir: -1, speed: 165, kind: "log" },
      { r: 4, dir: +1, speed: 190, kind: "log" },
    ];

    for (const d of riverDefs) {
      const lane = [];
      const count = 3 + (d.kind === "turtle" ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const w = d.kind === "turtle" ? [140, 160, 180][irand(0, 2)] : [180, 220, 260][irand(0, 2)];
        lane.push({
          r: d.r,
          x: LEFT + rand(0, PLAY_W),
          w,
          h: 34,
          vx: d.dir * d.speed * speedMul,
          kind: d.kind,
          // turtles can "dip" at higher levels (briefly unsafe)
          dipT: 0,
          dipPhase: rand(0, 6.28),
        });
      }
      state.logs.push(lane);
    }
  }

  // ---------- Collision checks ----------
  function frogRect() {
    const fx = LEFT + state.frog.gx * CELL + CELL / 2;
    const fy = rowY(state.frog.gr) + ROW_H / 2;
    return { x: fx, y: fy, w: 38, h: 38 };
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function rowCars(r) {
    const idx = r - R_ROAD_START;
    return state.cars[idx] || [];
  }

  function rowLogs(r) {
    const idx = r - R_RIVER_START;
    return state.logs[idx] || [];
  }

  function checkHome() {
    if (state.frog.gr !== R_HOME) return false;
    // Home slots spread across play area
    const slotW = PLAY_W / HOMES;
    const fx = state.frog.gx * CELL + CELL / 2; // grid-space
    const wx = LEFT + fx;
    const slot = clamp(Math.floor((wx - LEFT) / slotW), 0, HOMES - 1);

    if (state.homes[slot]) {
      // already filled -> bounce back a bit
      state.frog.gr = 1;
      state.frog.invuln = 0.25;
      return false;
    }
    state.homes[slot] = true;
    state.score += 50 + Math.floor(state.timeBonus / 100);
    sfx.home();
    updateHUD();

    // Win level if all homes filled
    if (state.homes.every(Boolean)) {
      state.level += 1;
      state.score += 250;
      sfx.level();
      setStatus(`Level up! <b>Level ${state.level}</b> — traffic and river speed increased.`);
      resetLevel(true);
    } else {
      setStatus(`Nice! Home secured (${state.homes.filter(Boolean).length}/${HOMES}).`);
      resetFrog();
    }
    return true;
  }

  function die(reason = "hit") {
    if (state.frog.invuln > 0) return;
    state.lives -= 1;
    updateHUD();

    if (reason === "water") sfx.splash();
    else sfx.hit();

    if (state.lives <= 0) {
      state.running = false;
      state.paused = false;
      setStatus(`Game Over — press <b>Restart</b> to try again.`);
    } else {
      setStatus(`Ouch! You lost a life (${state.lives} left).`);
      resetFrog();
    }
  }

  // ---------- Movement/input ----------
  function tryMove(dx, dr) {
    if (!state.running || state.paused) return;

    const nf = { gx: state.frog.gx + dx, gr: state.frog.gr + dr };
    nf.gx = clamp(nf.gx, 0, GRID_COLS - 1);
    nf.gr = clamp(nf.gr, 0, R_START);

    // small hop sound only if movement changes position
    if (nf.gx !== state.frog.gx || nf.gr !== state.frog.gr) {
      state.frog.gx = nf.gx;
      state.frog.gr = nf.gr;
      sfx.hop();

      // reward advancing upward
      if (dr < 0) state.score += 2;
      updateHUD();
      // attempt home capture
      checkHome();
    }
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","f"," "].includes(k)) {
      e.preventDefault();
    }

    if (k === "f") toggleFullscreen();
    if (k === " ") { // space = quick start/pause
      if (!state.running) start();
      else togglePause();
    }

    if (!state.running || state.paused) {
      if (k === "arrowup" || k === "w") { /* allow warm-up? */ }
      return;
    }

    if (k === "arrowup" || k === "w") tryMove(0, -1);
    else if (k === "arrowdown" || k === "s") tryMove(0, +1);
    else if (k === "arrowleft" || k === "a") tryMove(-1, 0);
    else if (k === "arrowright" || k === "d") tryMove(+1, 0);
  }

  window.addEventListener("keydown", onKey, { passive: false });

  // Tap controls
  document.querySelectorAll(".pad").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dir = btn.getAttribute("data-dir");
      if (!state.running) start();
      if (dir === "up") tryMove(0, -1);
      if (dir === "down") tryMove(0, +1);
      if (dir === "left") tryMove(-1, 0);
      if (dir === "right") tryMove(+1, 0);
    }, { passive: false });
  });

  // Swipe controls on canvas
  canvas.addEventListener("pointerdown", (e) => {
    state.touch.active = true;
    state.touch.x = e.clientX;
    state.touch.y = e.clientY;
    state.touch.t = performance.now();
    canvas.setPointerCapture(e.pointerId);
    // also unlock audio
    ensureAudio();
    if (!state.running) setStatus(`Swipe or use buttons to move. Press <b>Start</b> when ready.`);
  }, { passive: true });

  canvas.addEventListener("pointerup", (e) => {
    if (!state.touch.active) return;
    state.touch.active = false;

    const dx = e.clientX - state.touch.x;
    const dy = e.clientY - state.touch.y;
    const dt = performance.now() - state.touch.t;

    const dist = Math.hypot(dx, dy);
    if (dist < 18 || dt > 600) return; // ignore tiny/slow

    if (!state.running) start();

    if (Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? 1 : -1, 0);
    } else {
      tryMove(0, dy > 0 ? 1 : -1);
    }
  }, { passive: true });

  // ---------- Fullscreen ----------
  function toggleFullscreen() {
    const el = document.documentElement;
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFS) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  }

  ui.btnFS.addEventListener("click", () => {
    ensureAudio();
    toggleFullscreen();
  });

  // ---------- Buttons ----------
  function start() {
    ensureAudio();
    if (!state.running) {
      state.running = true;
      state.paused = false;
      ui.btnStart.textContent = "Running";
      setStatus(`Go! Reach all <b>${HOMES}</b> homes. Avoid cars and water.`);
    }
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    ui.btnPause.textContent = state.paused ? "Resume" : "Pause";
    setStatus(state.paused ? "Paused." : "Resumed.");
  }

  function restart() {
    ensureAudio();
    state.running = true;
    state.paused = false;
    ui.btnPause.textContent = "Pause";
    ui.btnStart.textContent = "Running";
    setStatus("Restarted. Good luck!");
    resetLevel(false);
  }

  ui.btnStart.addEventListener("click", () => start());
  ui.btnPause.addEventListener("click", () => togglePause());
  ui.btnRestart.addEventListener("click", () => restart());

  ui.btnSound.addEventListener("click", () => {
    ensureAudio();
    soundOn = !soundOn;
    ui.btnSound.textContent = `Sound: ${soundOn ? "On" : "Off"}`;
    ui.btnSound.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) sfx.hop();
  });

  // ---------- Game Loop ----------
  let last = performance.now();

  function step(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state.running && !state.paused) update(dt);
    draw();

    requestAnimationFrame(step);
  }

  function update(dt) {
    state.tick += dt;

    // reduce invuln
    state.frog.invuln = Math.max(0, state.frog.invuln - dt);

    // time bonus drains while playing
    state.timeBonus = Math.max(0, state.timeBonus - dt * 1000);

    // Move cars/logs
    for (const lane of state.cars) {
      for (const c of lane) {
        c.x = wrapX(c.x + c.vx * dt);
      }
    }
    for (const lane of state.logs) {
      for (const l of lane) {
        l.x = wrapX(l.x + l.vx * dt);

        if (l.kind === "turtle" && state.level >= 3) {
          // dip behavior (periodic)
          l.dipPhase += dt * (0.9 + (state.level - 3) * 0.10);
          l.dipT = (Math.sin(l.dipPhase) + 1) * 0.5; // 0..1
        } else {
          l.dipT = 0;
        }
      }
    }

    // Apply river riding + hazards
    state.frog.rideVX = 0;
    if (state.frog.gr >= R_RIVER_START && state.frog.gr <= R_RIVER_END) {
      const fr = frogRect();
      let onFloat = false;

      for (const obj of rowLogs(state.frog.gr)) {
        const oy = rowY(obj.r) + (ROW_H - obj.h) / 2;
        const safe = !(obj.kind === "turtle" && obj.dipT > 0.80);
        if (safe && aabb(fr.x - fr.w/2, fr.y - fr.h/2, fr.w, fr.h, obj.x - obj.w/2, oy, obj.w, obj.h)) {
          onFloat = true;
          state.frog.rideVX = obj.vx;
          break;
        }
      }

      if (!onFloat) {
        die("water");
      } else {
        // ride along in world x, update gx approximately
        const fxWorld = LEFT + state.frog.gx * CELL + CELL / 2;
        const nx = fxWorld + state.frog.rideVX * dt;

        // convert to gx; clamp to edges
        const gx = Math.round((nx - LEFT - CELL / 2) / CELL);
        state.frog.gx = clamp(gx, 0, GRID_COLS - 1);

        // If riding pushes beyond boundary, die (fell off board)
        if (nx < LEFT + 8 || nx > LEFT + PLAY_W - 8) die("water");
      }
    }

    // Road collisions
    if (state.frog.gr >= R_ROAD_START && state.frog.gr <= R_ROAD_END) {
      const fr = frogRect();
      for (const c of rowCars(state.frog.gr)) {
        const cy = rowY(c.r) + (ROW_H - c.h) / 2;
        if (aabb(fr.x - fr.w/2, fr.y - fr.h/2, fr.w, fr.h, c.x - c.w/2, cy, c.w, c.h)) {
          die("hit");
          break;
        }
      }
    }

    // If reached top row, check home slots (handled on move too, but riding may land there)
    if (state.frog.gr === R_HOME) checkHome();
  }

  // ---------- Drawing ----------
  function sx(x) { return x * scale.x; }
  function sy(y) { return y * scale.y; }

  function rr(x,y,w,h,r){
    const R = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+R,y);
    ctx.arcTo(x+w,y,x+w,y+h,R);
    ctx.arcTo(x+w,y+h,x,y+h,R);
    ctx.arcTo(x,y+h,x,y,R);
    ctx.arcTo(x,y,x+w,y,R);
    ctx.closePath();
  }

  function draw() {
    fitCanvas();

    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // background vignette
    ctx.save();
    ctx.scale(scale.x, scale.y);

    // soft gradient field
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"rgba(255,255,255,0.05)");
    g.addColorStop(0.45,"rgba(255,255,255,0.01)");
    g.addColorStop(1,"rgba(0,0,0,0.10)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // play area frame
    ctx.globalAlpha = 0.9;
    rr(LEFT-10, TOP-10, PLAY_W+20, ROWS*ROW_H+20, 18);
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // row bands
    for (let r = 0; r <= R_START; r++) {
      const y = rowY(r);
      let col = "rgba(255,255,255,0.03)";
      if (r === R_HOME) col = "rgba(16,185,129,0.10)";
      else if (r >= R_RIVER_START && r <= R_RIVER_END) col = "rgba(34,211,238,0.08)";
      else if (r === R_MEDIAN) col = "rgba(255,255,255,0.04)";
      else if (r >= R_ROAD_START && r <= R_ROAD_END) col = "rgba(255,255,255,0.02)";
      else if (r === R_START) col = "rgba(124,58,237,0.08)";

      rr(LEFT, y, PLAY_W, ROW_H-6, 16);
      ctx.fillStyle = col;
      ctx.fill();

      // subtle grid columns
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      for (let c = 1; c < GRID_COLS; c++) {
        const x = LEFT + c * CELL;
        ctx.beginPath();
        ctx.moveTo(x, y+8);
        ctx.lineTo(x, y+ROW_H-14);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
    }

    // Home slots
    const slotW = PLAY_W / HOMES;
    for (let i = 0; i < HOMES; i++) {
      const x = LEFT + i * slotW + slotW * 0.12;
      const y = rowY(R_HOME) + 10;
      const w = slotW * 0.76;
      const h = ROW_H - 26;

      rr(x, y, w, h, 16);
      ctx.fillStyle = state.homes[i] ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.strokeStyle = state.homes[i] ? "rgba(16,185,129,0.65)" : "rgba(255,255,255,0.18)";
      ctx.stroke();

      // tiny icon
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(255,255,255,0.80)";
      ctx.font = "20px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.homes[i] ? "🏡" : "○", x + w/2, y + h/2);
      ctx.globalAlpha = 0.9;
    }

    // Cars
    for (const lane of state.cars) {
      for (const c of lane) {
        const y = rowY(c.r) + (ROW_H - c.h) / 2;

        // body
        rr(c.x - c.w/2, y, c.w, c.h, 12);
        const cg = ctx.createLinearGradient(c.x - c.w/2, y, c.x + c.w/2, y + c.h);
        cg.addColorStop(0, "rgba(255,255,255,0.10)");
        cg.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = cg;
        ctx.fill();

        // outline glow
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.stroke();

        // lights
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillRect(c.x - c.w/2 + 8, y + 10, 10, 6);
        ctx.fillRect(c.x + c.w/2 - 18, y + 10, 10, 6);
      }
    }

    // Logs / turtles
    for (const lane of state.logs) {
      for (const l of lane) {
        const y = rowY(l.r) + (ROW_H - l.h) / 2;

        // dipping turtles become faint
        const safe = !(l.kind === "turtle" && l.dipT > 0.80);
        ctx.globalAlpha = safe ? 0.95 : 0.28;

        rr(l.x - l.w/2, y, l.w, l.h, 14);
        const lg = ctx.createLinearGradient(l.x - l.w/2, y, l.x + l.w/2, y + l.h);
        if (l.kind === "turtle") {
          lg.addColorStop(0,"rgba(16,185,129,0.26)");
          lg.addColorStop(1,"rgba(16,185,129,0.06)");
        } else {
          lg.addColorStop(0,"rgba(245,158,11,0.22)");
          lg.addColorStop(1,"rgba(245,158,11,0.06)");
        }
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.stroke();

        // segments (visual polish)
        ctx.globalAlpha *= 0.8;
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 2;
        for (let i = 1; i < Math.floor(l.w / 70); i++) {
          const sx = l.x - l.w/2 + i * 70;
          ctx.beginPath();
          ctx.moveTo(sx, y + 6);
          ctx.lineTo(sx, y + l.h - 6);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 0.95;

    // Frog
    const fr = frogRect();
    const fx = fr.x;
    const fy = fr.y;

    // frog shadow
    ctx.globalAlpha = 0.55;
    rr(fx - 20, fy + 10, 40, 12, 10);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    ctx.globalAlpha = 0.95;

    const blink = state.frog.invuln > 0 ? (Math.sin(state.tick * 22) * 0.5 + 0.5) : 1;
    ctx.globalAlpha = 0.65 + 0.35 * blink;

    // body
    rr(fx - 20, fy - 20, 40, 40, 14);
    const fg = ctx.createRadialGradient(fx - 6, fy - 8, 6, fx, fy, 26);
    fg.addColorStop(0, "rgba(34,211,238,0.35)");
    fg.addColorStop(0.6, "rgba(16,185,129,0.55)");
    fg.addColorStop(1, "rgba(16,185,129,0.18)");
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.stroke();

    // eyes
    ctx.globalAlpha = 0.9 * (0.65 + 0.35 * blink);
    rr(fx - 16, fy - 26, 14, 14, 7);
    rr(fx + 2,  fy - 26, 14, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(fx - 12, fy - 22, 6, 6);
    ctx.fillRect(fx + 6,  fy - 22, 6, 6);

    ctx.globalAlpha = 0.95;

    // Overlay paused
    if (!state.running || state.paused) {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(LEFT, TOP, PLAY_W, ROWS*ROW_H);

      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 34px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const msg = !state.running ? "Press Start" : "Paused";
      ctx.fillText(msg, LEFT + PLAY_W/2, TOP + (ROWS*ROW_H)/2 - 8);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.fillText("Arrow Keys / WASD • Swipe / Buttons • F = Fullscreen • Space = Start/Pause",
        LEFT + PLAY_W/2, TOP + (ROWS*ROW_H)/2 + 26
      );
    }

    // Time bonus bar
    if (state.running) {
      const barW = PLAY_W;
      const barH = 8;
      const x = LEFT;
      const y = TOP + ROWS*ROW_H + 8;
      const max = Math.max(1, 6000 - (state.level - 1) * 500);
      const p = clamp(state.timeBonus / max, 0, 1);

      rr(x, y, barW, barH, 8);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fill();

      rr(x, y, barW * p, barH, 8);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(34,211,238,0.35)";
      ctx.fill();
      ctx.globalAlpha = 0.95;
    }

    ctx.restore();
  }

  // ---------- Init ----------
  function init() {
    fitCanvas();
    resetLevel(false);
    setStatus(`Press <b>Start</b>. Tip: On mobile, swipe on the game or use the arrows.`);
    updateHUD();
    requestAnimationFrame(step);
  }

  init();
})();
