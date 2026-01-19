(() => {
  // -------------------- Helpers --------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Canvas setup (logical size fixed, responsive via CSS)
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // UI
  const $score = document.getElementById("score");
  const $lives = document.getElementById("lives");
  const $level = document.getElementById("level");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const howBtn = document.getElementById("howBtn");

  const pauseBtn = document.getElementById("pauseBtn");
  const launchBtn = document.getElementById("launchBtn");
  const restartBtn = document.getElementById("restartBtn");

  // -------------------- Game Config --------------------
  const W = canvas.width;
  const H = canvas.height;

  const WORLD = {
    padY: H - 56,
    wall: 16,
    ceiling: 16,
  };

  const COLORS = {
    text: "rgba(234,240,255,.92)",
    muted: "rgba(234,240,255,.55)",
    glass: "rgba(255,255,255,.07)",
    stroke: "rgba(255,255,255,.14)",
    glow1: "rgba(125,211,252,.28)",
    glow2: "rgba(167,139,250,.22)",
    good: "rgba(52,211,153,.90)",
    warn: "rgba(251,113,133,.90)"
  };

  const LEVELS = [
    { rows: 6, cols: 12, hp: 1, speed: 1.00 },
    { rows: 7, cols: 12, hp: 2, speed: 1.08 },
    { rows: 8, cols: 13, hp: 2, speed: 1.14 },
    { rows: 9, cols: 13, hp: 3, speed: 1.20 },
  ];

  // -------------------- State --------------------
  let running = false;
  let paused = false;

  let score = 0;
  let lives = 3;
  let levelIndex = 0;

  const input = {
    left: false,
    right: false,
    pointerActive: false,
    pointerX: W / 2,
    launchRequested: false
  };

  const paddle = {
    x: W / 2,
    y: WORLD.padY,
    w: 160,
    h: 18,
    vx: 0,
    maxSpeed: 820,
    smoothing: 0.18,
    laser: false,
    laserCooldown: 0,
  };

  const balls = [];
  const particles = [];
  const powerups = [];
  const lasers = [];

  let bricks = [];
  let bricksRemaining = 0;

  // -------------------- Brick + Powerups --------------------
  function makeLevel(i){
    const L = LEVELS[clamp(i, 0, LEVELS.length - 1)];
    const rows = L.rows, cols = L.cols;

    const marginX = 44;
    const top = 72;
    const gutter = 10;

    const brickW = (W - marginX * 2 - gutter * (cols - 1)) / cols;
    const brickH = 22;

    bricks = [];
    bricksRemaining = 0;

    for(let r=0; r<rows; r++){
      for(let c=0; c<cols; c++){
        const x = marginX + c * (brickW + gutter);
        const y = top + r * (brickH + gutter);
        const hue = (210 + r * 12 + c * 6) % 360;

        const maxHp = L.hp + (Math.random() < 0.12 ? 1 : 0); // occasional tougher bricks
        const hp = maxHp;

        bricks.push({
          x, y, w: brickW, h: brickH,
          hp, maxHp,
          hue,
          alive: true,
          // Powerup chance
          drop: (Math.random() < 0.14) ? randomPowerType() : null
        });
        bricksRemaining++;
      }
    }

    // reset paddle buffs
    paddle.w = 160;
    paddle.laser = false;
    paddle.laserCooldown = 0;

    // clear projectiles / powerups
    powerups.length = 0;
    lasers.length = 0;

    // ensure at least one ball
    balls.length = 0;
    spawnBall(true);

    $level.textContent = (levelIndex + 1).toString();
  }

  function randomPowerType(){
    const r = Math.random();
    if(r < 0.40) return "widen";
    if(r < 0.68) return "slow";
    if(r < 0.88) return "multi";
    return "laser";
  }

  function spawnPowerup(x, y, type){
    powerups.push({
      x, y,
      vy: 160,
      r: 10,
      type,
      alive: true
    });
  }

  // -------------------- Ball --------------------
  function spawnBall(stuckToPaddle){
    const speedBase = 430 * (LEVELS[levelIndex]?.speed ?? 1);
    const b = {
      x: paddle.x,
      y: paddle.y - 22,
      r: 9,
      vx: rand(-120, 120),
      vy: -speedBase,
      stuck: !!stuckToPaddle,
      speedMul: 1
    };
    balls.push(b);
  }

  function launchBalls(){
    for(const b of balls){
      if(b.stuck){
        b.stuck = false;
        const angle = rand(-0.9, -2.25); // upward
        const speed = 430 * (LEVELS[levelIndex]?.speed ?? 1) * b.speedMul;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
    }
  }

  // -------------------- Particles --------------------
  function burst(x, y, hue, n=18){
    for(let i=0;i<n;i++){
      particles.push({
        x, y,
        vx: rand(-260, 260),
        vy: rand(-260, 260),
        life: rand(0.35, 0.75),
        t: 0,
        r: rand(1.5, 3.2),
        hue
      });
    }
  }

  // -------------------- Input --------------------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if(k === "arrowleft" || k === "a") input.left = true;
    if(k === "arrowright" || k === "d") input.right = true;

    if(k === " "){
      e.preventDefault();
      input.launchRequested = true;
    }
    if(k === "p"){
      togglePause();
    }
    if(k === "r"){
      hardRestart();
    }
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if(k === "arrowleft" || k === "a") input.left = false;
    if(k === "arrowright" || k === "d") input.right = false;
  });

  // Pointer / touch to drag paddle
  function canvasPosFromEvent(ev){
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.clientX - rect.left) / rect.width * W;
    const cy = (ev.clientY - rect.top) / rect.height * H;
    return {x: cx, y: cy};
  }

  canvas.addEventListener("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    input.pointerActive = true;
    const p = canvasPosFromEvent(ev);
    input.pointerX = p.x;
  });

  canvas.addEventListener("pointermove", (ev) => {
    if(!input.pointerActive) return;
    const p = canvasPosFromEvent(ev);
    input.pointerX = p.x;
  });

  canvas.addEventListener("pointerup", () => {
    input.pointerActive = false;
  });

  // Buttons
  startBtn.addEventListener("click", () => {
    hideOverlay();
    startGameIfNeeded();
  });

  howBtn.addEventListener("click", () => {
    overlayTitle.textContent = "How to play";
    overlayText.innerHTML =
      "Move the paddle to keep the ball in play and clear all bricks.<br><br>" +
      "Aim shots by hitting the ball with the paddle edge. Catch powerups to get advantages.";
  });

  pauseBtn.addEventListener("click", () => togglePause());
  launchBtn.addEventListener("click", () => { input.launchRequested = true; });
  restartBtn.addEventListener("click", () => hardRestart());

  function showOverlay(title, text){
    overlayTitle.textContent = title;
    overlayText.innerHTML = text;
    overlay.classList.remove("hidden");
  }
  function hideOverlay(){
    overlay.classList.add("hidden");
  }

  // -------------------- Game Flow --------------------
  function startGameIfNeeded(){
    if(!running){
      running = true;
      paused = false;
    }
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    if(paused){
      showOverlay("Paused", "Press <b>P</b> to resume, or tap <b>Pause</b> again.");
    }else{
      hideOverlay();
    }
  }

  function hardRestart(){
    score = 0;
    lives = 3;
    levelIndex = 0;
    $score.textContent = score.toString();
    $lives.textContent = lives.toString();
    $level.textContent = "1";
    running = true;
    paused = false;
    hideOverlay();
    makeLevel(levelIndex);
  }

  function nextLevel(){
    levelIndex++;
    if(levelIndex >= LEVELS.length){
      // loop with slightly harder speed each cycle
      levelIndex = LEVELS.length - 1;
      LEVELS[levelIndex].speed = Math.min(1.45, (LEVELS[levelIndex].speed + 0.04));
    }
    makeLevel(levelIndex);
    showOverlay("Level Up!", "Nice. Tap <b>Start</b> (or press <b>Space</b>) to launch.");
    running = true;
    paused = false;
  }

  function loseLife(){
    lives--;
    $lives.textContent = lives.toString();
    powerups.length = 0;
    lasers.length = 0;

    if(lives <= 0){
      running = false;
      paused = false;
      showOverlay("Game Over", `Score: <b>${score}</b><br><br>Tap <b>Start</b> to play again.`);
    }else{
      balls.length = 0;
      spawnBall(true);
      showOverlay("Life Lost", "Tap <b>Start</b> (or press <b>Space</b>) to relaunch.");
    }
  }

  // -------------------- Collisions --------------------
  function circleRectCollision(cx, cy, cr, rx, ry, rw, rh){
    const x = clamp(cx, rx, rx + rw);
    const y = clamp(cy, ry, ry + rh);
    const dx = cx - x;
    const dy = cy - y;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // -------------------- Update --------------------
  let last = performance.now();
  function tick(now){
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if(running && !paused){
      update(dt);
    }
    render(dt);

    requestAnimationFrame(tick);
  }

  function update(dt){
    // Launch
    if(input.launchRequested){
      input.launchRequested = false;
      hideOverlay();
      startGameIfNeeded();
      launchBalls();
    }

    // Paddle movement (keyboard)
    let targetX = paddle.x;
    if(input.pointerActive){
      targetX = input.pointerX;
    }else{
      const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      targetX = paddle.x + dir * paddle.maxSpeed * dt;
    }
    const minX = WORLD.wall + paddle.w/2;
    const maxX = W - WORLD.wall - paddle.w/2;
    paddle.x = lerp(paddle.x, clamp(targetX, minX, maxX), 1 - Math.pow(1 - paddle.smoothing, dt * 60));

    // Laser firing
    if(paddle.laser){
      paddle.laserCooldown -= dt;
      if(paddle.laserCooldown <= 0){
        paddle.laserCooldown = 0.22;
        lasers.push({ x: paddle.x - paddle.w*0.22, y: paddle.y - 12, vy: -780, alive:true });
        lasers.push({ x: paddle.x + paddle.w*0.22, y: paddle.y - 12, vy: -780, alive:true });
      }
    }

    // Update lasers
    for(const l of lasers){
      if(!l.alive) continue;
      l.y += l.vy * dt;
      if(l.y < -20) l.alive = false;

      // hit bricks
      for(const br of bricks){
        if(!br.alive) continue;
        if(l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h){
          l.alive = false;
          hitBrick(br, l.x, l.y, true);
          break;
        }
      }
    }

    // Update balls
    for(const b of balls){
      if(b.stuck){
        b.x = paddle.x;
        b.y = paddle.y - 22;
        continue;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Walls
      if(b.x - b.r < WORLD.wall){
        b.x = WORLD.wall + b.r;
        b.vx *= -1;
      }
      if(b.x + b.r > W - WORLD.wall){
        b.x = W - WORLD.wall - b.r;
        b.vx *= -1;
      }
      if(b.y - b.r < WORLD.ceiling){
        b.y = WORLD.ceiling + b.r;
        b.vy *= -1;
      }

      // Paddle collision
      const pr = paddle;
      const px = pr.x - pr.w/2;
      const py = pr.y - pr.h/2;

      if(b.vy > 0 && circleRectCollision(b.x, b.y, b.r, px, py, pr.w, pr.h)){
        // Push out above paddle
        b.y = py - b.r - 0.1;
        // Aim based on hit position
        const hit = (b.x - pr.x) / (pr.w/2); // -1..1
        const speed = Math.hypot(b.vx, b.vy);
        const angle = lerp(-Math.PI * 0.85, -Math.PI * 0.15, (hit + 1)/2);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        burst(b.x, b.y, 195, 10);
      }

      // Bricks collision
      for(const br of bricks){
        if(!br.alive) continue;
        if(circleRectCollision(b.x, b.y, b.r, br.x, br.y, br.w, br.h)){
          // reflect based on penetration direction (approx)
          const prevX = b.x - b.vx * dt;
          const prevY = b.y - b.vy * dt;

          const hitFromLeft  = prevX <= br.x - b.r;
          const hitFromRight = prevX >= br.x + br.w + b.r;
          const hitFromTop   = prevY <= br.y - b.r;
          const hitFromBot   = prevY >= br.y + br.h + b.r;

          if(hitFromLeft || hitFromRight){
            b.vx *= -1;
          }else if(hitFromTop || hitFromBot){
            b.vy *= -1;
          }else{
            // fallback
            b.vy *= -1;
          }

          hitBrick(br, b.x, b.y, false);
          break;
        }
      }
    }

    // Remove dead lasers
    for(let i=lasers.length-1;i>=0;i--){
      if(!lasers[i].alive) lasers.splice(i,1);
    }

    // Powerups fall + catch
    for(const p of powerups){
      if(!p.alive) continue;
      p.y += p.vy * dt;

      // Catch by paddle
      const px = paddle.x - paddle.w/2;
      const py = paddle.y - paddle.h/2;
      if(p.x >= px && p.x <= px + paddle.w && p.y + p.r >= py && p.y - p.r <= py + paddle.h){
        p.alive = false;
        applyPowerup(p.type);
        burst(p.x, p.y, 140, 14);
      }
      if(p.y > H + 30) p.alive = false;
    }
    for(let i=powerups.length-1;i>=0;i--){
      if(!powerups[i].alive) powerups.splice(i,1);
    }

    // Particles
    for(const pt of particles){
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.06, dt); // damping
      pt.vy *= Math.pow(0.06, dt);
    }
    for(let i=particles.length-1;i>=0;i--){
      if(particles[i].t >= particles[i].life) particles.splice(i,1);
    }

    // Ball out of bounds -> lose life (if all balls gone)
    for(let i=balls.length-1;i>=0;i--){
      if(balls[i].y - balls[i].r > H + 20){
        balls.splice(i,1);
      }
    }
    if(running && !paused && balls.length === 0){
      loseLife();
    }

    // Win level
    if(bricksRemaining <= 0){
      nextLevel();
    }
  }

  function hitBrick(br, x, y, viaLaser){
    br.hp--;
    burst(x, y, br.hue, viaLaser ? 14 : 18);

    if(br.hp <= 0){
      br.alive = false;
      bricksRemaining--;
      score += 10;
      if(br.drop){
        spawnPowerup(br.x + br.w/2, br.y + br.h/2, br.drop);
      }
      score += (br.maxHp > 1 ? 8 : 0);
    }else{
      score += 4;
    }
    $score.textContent = score.toString();
  }

  function applyPowerup(type){
    if(type === "widen"){
      paddle.w = clamp(paddle.w + 60, 140, 280);
      score += 25;
    }else if(type === "slow"){
      for(const b of balls){
        b.vx *= 0.82;
        b.vy *= 0.82;
        b.speedMul *= 0.92;
      }
      score += 20;
    }else if(type === "multi"){
      // duplicate each non-stuck ball once
      const current = balls.slice();
      for(const b of current){
        if(b.stuck) continue;
        const nb = { ...b };
        nb.vx = b.vx * (Math.random()<0.5 ? 1 : -1);
        nb.vy = b.vy;
        nb.x += rand(-8, 8);
        balls.push(nb);
      }
      score += 35;
    }else if(type === "laser"){
      paddle.laser = true;
      // Laser lasts a while; turn off after timer by storing time in paddle (simple)
      // We'll implement as timeout via a timestamp.
      const endAt = performance.now() + 12000;
      paddle._laserEndAt = endAt;
      score += 30;
    }
    $score.textContent = score.toString();
  }

  // Handle laser expiration (checked in render loop too)
  function updateBuffTimers(now){
    if(paddle.laser && paddle._laserEndAt && now > paddle._laserEndAt){
      paddle.laser = false;
      paddle._laserEndAt = 0;
      paddle.laserCooldown = 0;
    }
  }

  // -------------------- Render --------------------
  function roundedRectPath(x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function render(dt){
    updateBuffTimers(performance.now());

    // Clear
    ctx.clearRect(0,0,W,H);

    // subtle glow background inside canvas
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,.02)";
    ctx.fillRect(0,0,W,H);
    ctx.restore();

    // Frame / inner border
    ctx.save();
    roundedRectPath(10, 10, W-20, H-20, 18);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Bricks
    for(const br of bricks){
      if(!br.alive) continue;

      const hpT = br.hp / br.maxHp;
      const a = 0.80 + (1 - hpT) * 0.10;

      // fill
      ctx.save();
      roundedRectPath(br.x, br.y, br.w, br.h, 10);

      const grad = ctx.createLinearGradient(br.x, br.y, br.x + br.w, br.y + br.h);
      grad.addColorStop(0, `hsla(${br.hue}, 90%, 64%, ${a})`);
      grad.addColorStop(1, `hsla(${(br.hue+40)%360}, 90%, 58%, ${a})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // glass highlight
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(255,255,255,.18)";
      roundedRectPath(br.x + 2, br.y + 2, br.w - 4, br.h * 0.45, 9);
      ctx.fill();

      // border
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.22)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // hp pip if tough
      if(br.maxHp > 1){
        ctx.font = "700 11px system-ui, sans-serif";
        ctx.fillStyle = "rgba(10,14,30,.75)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${br.hp}`, br.x + br.w - 8, br.y + br.h/2 + 0.5);
      }

      ctx.restore();
    }

    // Powerups
    for(const p of powerups){
      ctx.save();
      const g = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, 18);
      const col = (p.type === "widen") ? "rgba(125,211,252,.95)"
                : (p.type === "slow") ? "rgba(52,211,153,.95)"
                : (p.type === "multi") ? "rgba(167,139,250,.95)"
                : "rgba(251,113,133,.95)";
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(255,255,255,.06)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "800 10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(10,14,30,.65)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = p.type === "widen" ? "W" : p.type === "slow" ? "S" : p.type === "multi" ? "M" : "L";
      ctx.fillText(label, p.x, p.y+0.5);
      ctx.restore();
    }

    // Lasers
    if(lasers.length){
      ctx.save();
      for(const l of lasers){
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "rgba(251,113,133,.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + 18);
        ctx.stroke();

        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "rgba(251,113,133,.75)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + 22);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Paddle
    const px = paddle.x - paddle.w/2;
    const py = paddle.y - paddle.h/2;

    ctx.save();
    // glow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = paddle.laser ? COLORS.warn : COLORS.glow1;
    roundedRectPath(px - 6, py - 6, paddle.w + 12, paddle.h + 12, 14);
    ctx.fill();

    // body
    ctx.globalAlpha = 1;
    const pg = ctx.createLinearGradient(px, py, px + paddle.w, py + paddle.h);
    pg.addColorStop(0, "rgba(255,255,255,.16)");
    pg.addColorStop(1, "rgba(255,255,255,.06)");
    ctx.fillStyle = pg;
    roundedRectPath(px, py, paddle.w, paddle.h, 12);
    ctx.fill();

    // stroke
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // highlight line
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(125,211,252,.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 5);
    ctx.lineTo(px + paddle.w - 14, py + 5);
    ctx.stroke();
    ctx.restore();

    // Balls
    for(const b of balls){
      ctx.save();
      const bg = ctx.createRadialGradient(b.x - 4, b.y - 5, 2, b.x, b.y, 16);
      bg.addColorStop(0, "rgba(255,255,255,.95)");
      bg.addColorStop(1, "rgba(125,211,252,.18)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();

      // glow
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(125,211,252,.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // Particles
    if(particles.length){
      ctx.save();
      for(const pt of particles){
        const t = pt.t / pt.life;
        const a = (1 - t);
        ctx.globalAlpha = a;
        ctx.fillStyle = `hsla(${pt.hue}, 95%, 65%, ${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Top info in-canvas (minimal)
    ctx.save();
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "left";
    ctx.fillText("P: pause • R: restart • Space: launch", 20, H - 18);
    ctx.restore();

    // Laser timer indicator
    if(paddle.laser && paddle._laserEndAt){
      const remain = Math.max(0, paddle._laserEndAt - performance.now());
      const t = clamp(remain / 12000, 0, 1);
      const barW = 180;
      const barH = 8;
      const bx = W - barW - 22;
      const by = H - 26;

      ctx.save();
      roundedRectPath(bx, by, barW, barH, 999);
      ctx.fillStyle = "rgba(255,255,255,.10)";
      ctx.fill();
      roundedRectPath(bx, by, barW * t, barH, 999);
      ctx.fillStyle = "rgba(251,113,133,.85)";
      ctx.fill();
      ctx.restore();
    }
  }

  // -------------------- Boot --------------------
  function init(){
    $score.textContent = "0";
    $lives.textContent = "3";
    $level.textContent = "1";

    makeLevel(levelIndex);

    showOverlay("Breakout", "Move the paddle and clear all bricks.<br><br>Tap <b>Start</b> (or press <b>Space</b>) to begin.");

    running = false;
    paused = false;

    requestAnimationFrame(tick);
  }

  init();
})();
