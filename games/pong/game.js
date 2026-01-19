(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: true });

  const scoreL = document.getElementById("scoreL");
  const scoreR = document.getElementById("scoreR");
  const bestEl = document.getElementById("best");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");
  const btnHow = document.getElementById("btnHow");

  const aiToggle = document.getElementById("aiToggle");
  const fxToggle = document.getElementById("fxToggle");
  const diff = document.getElementById("diff");
  const speed = document.getElementById("speed");

  // ---------- Settings ----------
  const WIN_SCORE = 7;
  const PADDLE_W = 14;
  const PADDLE_H = 110;
  const BALL_R = 9;
  const WALL_PAD = 18;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Resize ----------
  let W = 900, H = 520;

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    // draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    W = rect.width;
    H = rect.height;
  }

  new ResizeObserver(fit).observe(canvas);
  window.addEventListener("resize", fit, { passive: true });

  // ---------- Game State ----------
  const state = {
    running: false,
    paused: false,
    serving: true,
    winner: null,
    glow: true,

    sL: 0,
    sR: 0,
    best: Number(localStorage.getItem("pong_best") || "0"),

    pL: { x: 0, y: 0, ty: 0 },
    pR: { x: 0, y: 0, ty: 0 },

    // velocities are now in px/second ✅
    ball: { x: 0, y: 0, vx: 0, vy: 0, spin: 0 },

    keys: new Set(),
    lastT: 0
  };

  bestEl.textContent = String(state.best);

  function resetPositions() {
    state.pL.x = WALL_PAD;
    state.pR.x = W - WALL_PAD - PADDLE_W;

    state.pL.y = (H - PADDLE_H) / 2;
    state.pR.y = (H - PADDLE_H) / 2;

    state.pL.ty = state.pL.y;
    state.pR.ty = state.pR.y;

    state.ball.x = W / 2;
    state.ball.y = H / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.spin = 0;

    state.serving = true;
    state.winner = null;

    overlayTitle.textContent = "Neon Pong";
    overlayText.innerHTML =
      "Desktop: <b>W/S</b> + <b>↑/↓</b> · <b>Space</b> serve · <b>P</b> pause<br/>" +
      "Mobile: drag left/right side paddles · tap serve";

    overlay.setAttribute("aria-hidden", "false");
  }

  function hardReset() {
    state.sL = 0;
    state.sR = 0;
    scoreL.textContent = "0";
    scoreR.textContent = "0";

    state.running = false;
    state.paused = false;
    state.serving = true;

    resetPositions();
    btnPause.textContent = "Pause";
  }

  // ---------- Serve ----------
  function serve(dirRight = true) {
    // ensure we have a valid size before serving
    if (!W || !H) fit();

    const base = Number(speed.value); // 6..18 (we convert to px/s below)
    const baseSpeed = base * 60;      // ✅ px/s scaled for a nice feel

    // angle spread
    const angle = (Math.random() * 0.8 - 0.4);

    state.ball.vx = (dirRight ? 1 : -1) * baseSpeed * (0.9 + Math.random() * 0.15);
    state.ball.vy = baseSpeed * Math.sin(angle) * 0.55;
    state.ball.spin = 0;

    state.serving = false;
    state.running = true;
    state.paused = false;

    // IMPORTANT: reset timing so first frame dt isn't weird
    state.lastT = performance.now();

    overlay.setAttribute("aria-hidden", "true");
  }

  // ---------- Input (keyboard) ----------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    if (k === " " || k === "arrowup" || k === "arrowdown") e.preventDefault();

    if (k === "p") togglePause();
    if (k === " " && (state.serving || !state.running)) serve(Math.random() < 0.5);

    state.keys.add(k);
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    state.keys.delete(e.key.toLowerCase());
  });

  // ---------- Touch / Mouse drag ----------
  let pointerDown = false;

  function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function setPaddleTargetByPointer(x, y) {
    if (x < W * 0.5) state.pL.ty = clamp(y - PADDLE_H / 2, 0, H - PADDLE_H);
    else state.pR.ty = clamp(y - PADDLE_H / 2, 0, H - PADDLE_H);
  }

  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    canvas.setPointerCapture(e.pointerId);

    const p = pointerToCanvas(e);
    setPaddleTargetByPointer(p.x, p.y);

    // tap/press to serve
    if (state.serving || !state.running) serve(p.x < W / 2);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointerDown) return;
    const p = pointerToCanvas(e);
    setPaddleTargetByPointer(p.x, p.y);
  });

  canvas.addEventListener("pointerup", () => (pointerDown = false));
  canvas.addEventListener("pointercancel", () => (pointerDown = false));

  // ---------- UI buttons ----------
  btnStart.addEventListener("click", () => {
    // always serve reliably
    serve(Math.random() < 0.5);
  });

  btnPause.addEventListener("click", togglePause);
  btnReset.addEventListener("click", hardReset);

  btnHow.addEventListener("click", () => {
    overlayTitle.textContent = "Controls";
    overlayText.innerHTML =
      "<b>Player 1:</b> W/S<br/>" +
      "<b>Player 2:</b> ↑/↓ (or enable AI)<br/>" +
      "<b>Serve:</b> Space / Tap / Start<br/>" +
      "<b>Pause:</b> P<br/>" +
      "<b>Mobile:</b> Drag on each side to move paddles";
  });

  fxToggle.addEventListener("change", () => (state.glow = fxToggle.checked));
  state.glow = fxToggle.checked;

  function togglePause() {
    if (!state.running && !state.serving) return;
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? "Resume" : "Pause";
    overlay.setAttribute("aria-hidden", state.paused ? "false" : "true");
  }

  // ---------- Physics ----------
  function paddleInput(dt) {
    const upL = state.keys.has("w");
    const downL = state.keys.has("s");
    const upR = state.keys.has("arrowup");
    const downR = state.keys.has("arrowdown");

    const step = 900; // px/s
    if (upL) state.pL.ty -= step * dt;
    if (downL) state.pL.ty += step * dt;

    if (!aiToggle.checked) {
      if (upR) state.pR.ty -= step * dt;
      if (downR) state.pR.ty += step * dt;
    }

    state.pL.ty = clamp(state.pL.ty, 0, H - PADDLE_H);
    state.pR.ty = clamp(state.pR.ty, 0, H - PADDLE_H);
  }

  function aiMove(dt) {
    if (!aiToggle.checked) return;

    const difficulty = Number(diff.value); // 1..10
    const reaction = lerp(0.10, 0.25, difficulty / 10);
    const max = lerp(680, 1250, difficulty / 10);

    const target = clamp(state.ball.y - PADDLE_H / 2, 0, H - PADDLE_H);
    const desired = lerp(state.pR.ty, target, reaction);

    const cap = max * dt;
    const dy = desired - state.pR.y;

    state.pR.y += clamp(dy, -cap, cap);
    state.pR.ty = state.pR.y;
  }

  function integratePaddles() {
    const follow = 0.22;
    state.pL.y = lerp(state.pL.y, state.pL.ty, follow);
    if (!aiToggle.checked) state.pR.y = lerp(state.pR.y, state.pR.ty, follow);
  }

  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return (dx * dx + dy * dy) <= r * r;
  }

  function reflectFromPaddle(p, dir) {
    const b = state.ball;

    const mid = p.y + PADDLE_H / 2;
    const t = clamp((b.y - mid) / (PADDLE_H / 2), -1, 1);

    const base = Number(speed.value) * 60; // px/s
    const hitSpeed = Math.hypot(b.vx, b.vy);
    const nextSpeed = clamp(hitSpeed * 1.05, base * 0.9, base * 1.8);

    const maxAngle = 0.9;
    const ang = t * maxAngle;

    b.vx = -dir * nextSpeed * Math.cos(ang);
    b.vy = nextSpeed * Math.sin(ang);

    b.spin = t * 0.9;

    b.x = dir > 0 ? (p.x - BALL_R - 0.5) : (p.x + PADDLE_W + BALL_R + 0.5);
  }

  function score(side) {
    if (side === "L") state.sL++;
    else state.sR++;

    scoreL.textContent = String(state.sL);
    scoreR.textContent = String(state.sR);

    const maxScore = Math.max(state.sL, state.sR);
    if (maxScore > state.best) {
      state.best = maxScore;
      localStorage.setItem("pong_best", String(state.best));
      bestEl.textContent = String(state.best);
    }

    if (state.sL >= WIN_SCORE || state.sR >= WIN_SCORE) {
      state.winner = state.sL >= WIN_SCORE ? "Player 1" : "Player 2";
      state.running = false;
      state.serving = true;

      overlayTitle.textContent = `${state.winner} wins!`;
      overlayText.innerHTML = `Final: <b>${state.sL}</b> – <b>${state.sR}</b><br/>Tap / Space / Start to play again.`;
      overlay.setAttribute("aria-hidden", "false");

      resetPositions();
      return;
    }

    state.running = false;
    state.serving = true;
    resetPositions();
  }

  // ---------- Render ----------
  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddle(p, tint) {
    const r = 10;
    ctx.save();

    if (state.glow) {
      ctx.shadowColor = tint;
      ctx.shadowBlur = 22;
    }

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;

    roundRect(ctx, p.x, p.y, PADDLE_W, PADDLE_H, r);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = tint;
    roundRect(ctx, p.x + 2, p.y + 2, PADDLE_W - 4, PADDLE_H - 4, r - 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBall() {
    const b = state.ball;
    ctx.save();

    if (state.glow) {
      ctx.shadowColor = "rgba(34,211,238,0.9)";
      ctx.shadowBlur = 26;
    }

    const grad = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, BALL_R + 8);
    grad.addColorStop(0, "rgba(255,255,255,0.98)");
    grad.addColorStop(0.45, "rgba(167,139,250,0.9)");
    grad.addColorStop(1, "rgba(34,211,238,0.7)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHintServe() {
    if (!state.serving) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Tap / Space / Start to Serve", W / 2, H / 2 - 140);
    ctx.restore();
  }

  // ---------- Loop ----------
  function step(t) {
    if (!state.lastT) state.lastT = t;
    const dt = Math.min(0.033, (t - state.lastT) / 1000);
    state.lastT = t;

    if (!W || !H) fit();

    if (state.running && !state.paused && !state.serving) {
      paddleInput(dt);
      aiMove(dt);
      integratePaddles();

      const b = state.ball;

      // spin drift (subtle)
      b.vy += b.spin * 30 * dt;

      // ✅ time-based integration
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // walls
      if (b.y - BALL_R <= 0) {
        b.y = BALL_R;
        b.vy *= -1;
        b.spin *= 0.85;
      }
      if (b.y + BALL_R >= H) {
        b.y = H - BALL_R;
        b.vy *= -1;
        b.spin *= 0.85;
      }

      // paddles collision
      const leftRect = { x: state.pL.x, y: state.pL.y, w: PADDLE_W, h: PADDLE_H };
      const rightRect = { x: state.pR.x, y: state.pR.y, w: PADDLE_W, h: PADDLE_H };

      if (b.vx < 0 && circleRectCollide(b.x, b.y, BALL_R, leftRect.x, leftRect.y, leftRect.w, leftRect.h)) {
        reflectFromPaddle(state.pL, -1);
      } else if (b.vx > 0 && circleRectCollide(b.x, b.y, BALL_R, rightRect.x, rightRect.y, rightRect.w, rightRect.h)) {
        reflectFromPaddle(state.pR, +1);
      }

      // scoring
      if (b.x + BALL_R < 0) score("R");
      if (b.x - BALL_R > W) score("L");
    } else {
      if (!state.paused) {
        paddleInput(dt);
        if (aiToggle.checked) aiMove(dt);
        integratePaddles();
      }
    }

    drawBackground();
    drawPaddle(state.pL, "rgba(34,211,238,0.95)");
    drawPaddle(state.pR, "rgba(167,139,250,0.95)");
    drawBall();
    drawHintServe();

    requestAnimationFrame(step);
  }

  // ---------- Init ----------
  function init() {
    fit();
    resetPositions();
    requestAnimationFrame(step);
  }

  init();
  hardReset();
})();
