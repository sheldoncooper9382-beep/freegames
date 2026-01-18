(() => {
  // ---------- Config ----------
  const COLS = 10;
  const ROWS = 20;
  const VISIBLE_ROWS = 20;
  const HIDDEN_ROWS = 2; // spawn area
  const BOARD_ROWS = ROWS + HIDDEN_ROWS;

  const DAS = 120;       // delayed auto shift (ms)
  const ARR = 35;        // auto repeat rate (ms)
  const SOFT_DROP = 20;  // ms per row while holding down

  const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };

  const COLORS = {
    I: "#22d3ee",
    O: "#fbbf24",
    T: "#a78bfa",
    S: "#34d399",
    Z: "#fb7185",
    J: "#60a5fa",
    L: "#fb923c",
    G: "rgba(255,255,255,.14)" // ghost
  };

  // 4 rotations each
  const PIECES = {
    I: [
      [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0],
      ],
      [
        [0,0,0,0],
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [0,1,0,0],
        [0,1,0,0],
        [0,1,0,0],
      ]
    ],
    O: [
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ]
    ],
    T: [
      [
        [0,1,0],
        [1,1,1],
        [0,0,0]
      ],
      [
        [0,1,0],
        [0,1,1],
        [0,1,0]
      ],
      [
        [0,0,0],
        [1,1,1],
        [0,1,0]
      ],
      [
        [0,1,0],
        [1,1,0],
        [0,1,0]
      ]
    ],
    S: [
      [
        [0,1,1],
        [1,1,0],
        [0,0,0]
      ],
      [
        [0,1,0],
        [0,1,1],
        [0,0,1]
      ],
      [
        [0,0,0],
        [0,1,1],
        [1,1,0]
      ],
      [
        [1,0,0],
        [1,1,0],
        [0,1,0]
      ]
    ],
    Z: [
      [
        [1,1,0],
        [0,1,1],
        [0,0,0]
      ],
      [
        [0,0,1],
        [0,1,1],
        [0,1,0]
      ],
      [
        [0,0,0],
        [1,1,0],
        [0,1,1]
      ],
      [
        [0,1,0],
        [1,1,0],
        [1,0,0]
      ]
    ],
    J: [
      [
        [1,0,0],
        [1,1,1],
        [0,0,0]
      ],
      [
        [0,1,1],
        [0,1,0],
        [0,1,0]
      ],
      [
        [0,0,0],
        [1,1,1],
        [0,0,1]
      ],
      [
        [0,1,0],
        [0,1,0],
        [1,1,0]
      ]
    ],
    L: [
      [
        [0,0,1],
        [1,1,1],
        [0,0,0]
      ],
      [
        [0,1,0],
        [0,1,0],
        [0,1,1]
      ],
      [
        [0,0,0],
        [1,1,1],
        [1,0,0]
      ],
      [
        [1,1,0],
        [0,1,0],
        [0,1,0]
      ]
    ]
  };

  // SRS-ish kicks (simplified)
  const KICKS = {
    normal: {
      "0>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
      "1>0": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
      "1>2": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
      "2>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
      "2>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
      "3>2": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
      "3>0": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
      "0>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    },
    I: {
      "0>1": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
      "1>0": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
      "1>2": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
      "2>1": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
      "2>3": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
      "3>2": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
      "3>0": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
      "0>3": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    }
  };

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const bestEl  = document.getElementById("best");

  const btnPause = document.getElementById("btnPause");
  const btnRestart = document.getElementById("btnRestart");
  const btnResume = document.getElementById("btnResume");
  const btnOverlayRestart = document.getElementById("btnOverlayRestart");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");

  const nextCanvases = [
    document.getElementById("next1"),
    document.getElementById("next2"),
    document.getElementById("next3"),
    document.getElementById("next4"),
  ];
  const nextCtxs = nextCanvases.map(c => c.getContext("2d"));
  const holdCanvas = document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");

  // ---------- Rendering helpers ----------
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetW = Math.floor(rect.width * dpr);
    const targetH = Math.floor(rect.width * 2 * dpr); // 10x20 ratio -> 1:2
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.setTransform(1,0,0,1,0,0);
  }

  window.addEventListener("resize", () => {
    fitCanvas();
    draw();
  });

  function clear2d(c, w, h) {
    c.clearRect(0,0,w,h);
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+rr, y);
    c.arcTo(x+w, y, x+w, y+h, rr);
    c.arcTo(x+w, y+h, x, y+h, rr);
    c.arcTo(x, y+h, x, y, rr);
    c.arcTo(x, y, x+w, y, rr);
    c.closePath();
  }

  function drawCell(c, x, y, size, color, alpha=1) {
    c.save();
    c.globalAlpha = alpha;

    // glossy block
    roundRect(c, x+1, y+1, size-2, size-2, Math.max(6, size*0.18));
    c.fillStyle = color;
    c.fill();

    // highlight
    c.globalAlpha = alpha * 0.25;
    roundRect(c, x+3, y+3, size-6, size-10, Math.max(6, size*0.18));
    c.fillStyle = "#ffffff";
    c.fill();

    // border
    c.globalAlpha = alpha * 0.18;
    c.strokeStyle = "#000";
    c.lineWidth = Math.max(1, size*0.04);
    roundRect(c, x+1.5, y+1.5, size-3, size-3, Math.max(6, size*0.18));
    c.stroke();

    c.restore();
  }

  function drawGridBackground() {
    const { cell, ox, oy } = layout();
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // subtle bg
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // grid
    ctx.globalAlpha = 1;
    for (let r = 0; r < VISIBLE_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawCell(ctx, ox + c*cell, oy + r*cell, cell, "rgba(255,255,255,0.035)", 1);
      }
    }

    ctx.restore();
  }

  function layout() {
    // board occupies full canvas; compute cell size based on width
    const cell = Math.floor(canvas.width / COLS);
    const boardW = cell * COLS;
    const boardH = cell * VISIBLE_ROWS;
    const ox = Math.floor((canvas.width - boardW) / 2);
    const oy = Math.floor((canvas.height - boardH) / 2);
    return { cell, boardW, boardH, ox, oy };
  }

  function drawMini(ctx2, pieceType) {
    const w = ctx2.canvas.width;
    const h = ctx2.canvas.height;
    clear2d(ctx2, w, h);

    // soft panel bg
    ctx2.save();
    ctx2.globalAlpha = 1;
    roundRect(ctx2, 2, 2, w-4, h-4, 12);
    ctx2.fillStyle = "rgba(255,255,255,0.06)";
    ctx2.fill();
    ctx2.restore();

    if (!pieceType) return;

    const mat = PIECES[pieceType][0];
    const color = COLORS[pieceType];

    // find bounds
    let minX = 99, minY = 99, maxX = -99, maxY = -99;
    for (let y=0; y<mat.length; y++) {
      for (let x=0; x<mat[y].length; x++) {
        if (mat[y][x]) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) return;

    const bw = (maxX - minX + 1);
    const bh = (maxY - minY + 1);
    const cell = Math.floor(Math.min(w/(bw+2), h/(bh+2)));

    const startX = Math.floor((w - bw*cell)/2);
    const startY = Math.floor((h - bh*cell)/2);

    for (let y=0; y<mat.length; y++) {
      for (let x=0; x<mat[y].length; x++) {
        if (mat[y][x]) {
          const px = startX + (x - minX)*cell;
          const py = startY + (y - minY)*cell;
          drawCell(ctx2, px, py, cell, color, 1);
        }
      }
    }
  }

  // ---------- Game state ----------
  const BEST_KEY = "tetris_best_v1";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);

  let board, cur, nextQueue, holdType, holdUsed;
  let score, lines, level;
  let paused = false;
  let gameOver = false;

  let fallTimer = 0;
  let lastTs = 0;

  // input state
  const keys = new Set();
  let leftHeld = false, rightHeld = false;
  let leftDAS = 0, rightDAS = 0;
  let leftARR = 0, rightARR = 0;
  let softHeld = false;
  let softTimer = 0;

  // Lock delay-ish (simple but feels good)
  let lockTimer = 0;
  const LOCK_DELAY = 450;

  // ---------- Utilities ----------
  function makeBoard() {
    return Array.from({length: BOARD_ROWS}, () => Array.from({length: COLS}, () => ""));
  }

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < BOARD_ROWS;
  }

  function clonePiece(p) {
    return { type: p.type, x: p.x, y: p.y, r: p.r };
  }

  function getMatrix(type, r) {
    const rots = PIECES[type];
    return rots[(r % 4 + 4) % 4];
  }

  function collides(p, dx=0, dy=0, rOverride=null) {
    const r = rOverride === null ? p.r : rOverride;
    const mat = getMatrix(p.type, r);
    const sizeY = mat.length;
    const sizeX = mat[0].length;

    for (let y=0; y<sizeY; y++) {
      for (let x=0; x<sizeX; x++) {
        if (!mat[y][x]) continue;
        const bx = p.x + x + dx;
        const by = p.y + y + dy;
        if (bx < 0 || bx >= COLS || by >= BOARD_ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function placePiece(p) {
    const mat = getMatrix(p.type, p.r);
    for (let y=0; y<mat.length; y++) {
      for (let x=0; x<mat[y].length; x++) {
        if (!mat[y][x]) continue;
        const bx = p.x + x;
        const by = p.y + y;
        if (by >= 0 && by < BOARD_ROWS && bx >= 0 && bx < COLS) {
          board[by][bx] = p.type;
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = 0; y < BOARD_ROWS; y++) {
      if (board[y].every(v => v)) {
        board.splice(y, 1);
        board.unshift(Array.from({length: COLS}, () => ""));
        cleared++;
        y--;
      }
    }
    return cleared;
  }

  function bag7() {
    const arr = ["I","O","T","S","Z","J","L"];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i+1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ensureQueue() {
    while (nextQueue.length < 10) nextQueue.push(...bag7());
  }

  function spawn() {
    ensureQueue();
    const type = nextQueue.shift();
    const r = 0;

    // spawn positions feel good for 10-wide
    let x = 3, y = 0;
    if (type === "O") x = 3, y = 0;
    if (type === "I") x = 3, y = 0;

    // y starts in hidden rows
    y = 0;

    const p = { type, x, y, r };

    // If immediate collision, game over
    if (collides(p, 0, 0, p.r)) {
      gameOver = true;
      showOverlay("Game Over", "Press Restart to play again.");
    }
    return p;
  }

  function hardDrop() {
    if (paused || gameOver) return;
    let drop = 0;
    while (!collides(cur, 0, 1)) {
      cur.y += 1;
      drop++;
    }
    score += drop * 2; // small reward
    lockDown();
  }

  function softDropTick() {
    if (paused || gameOver) return;
    if (!collides(cur, 0, 1)) {
      cur.y += 1;
      score += 1;
      lockTimer = 0;
    } else {
      // on ground, let lock delay handle it
    }
  }

  function tryMove(dx, dy) {
    if (paused || gameOver) return false;
    if (!collides(cur, dx, dy)) {
      cur.x += dx;
      cur.y += dy;
      if (dy !== 0) lockTimer = 0;
      return true;
    }
    return false;
  }

  function tryRotate(dir) {
    if (paused || gameOver) return false;
    const from = cur.r;
    const to = (from + dir + 4) % 4;
    const key = `${from}>${to}`;
    const kickTable = (cur.type === "I") ? KICKS.I : KICKS.normal;
    const kicks = kickTable[key] || [[0,0]];

    for (const [kx, ky] of kicks) {
      if (!collides(cur, kx, -ky, to)) { // note ky sign per typical SRS table; we use -ky so it matches common feel
        cur.x += kx;
        cur.y += -ky;
        cur.r = to;
        lockTimer = 0;
        return true;
      }
    }
    return false;
  }

  function computeGhost(p) {
    const g = clonePiece(p);
    while (!collides(g, 0, 1)) g.y += 1;
    return g;
  }

  function lockDown() {
    placePiece(cur);

    // if any blocks placed in hidden rows -> game over (top out)
    for (let y=0; y<HIDDEN_ROWS; y++) {
      if (board[y].some(v => v)) {
        gameOver = true;
        showOverlay("Game Over", "You topped out. Press Restart.");
        updateHUD();
        draw();
        return;
      }
    }

    const cleared = clearLines();
    if (cleared) {
      lines += cleared;
      const add = (SCORE_TABLE[cleared] || 0) * level;
      score += add;

      // level up each 10 lines
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) level = newLevel;
    }

    holdUsed = false;
    cur = spawn();
    lockTimer = 0;

    // best
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }

    updateHUD();
    draw();
  }

  function hold() {
    if (paused || gameOver) return;
    if (holdUsed) return;
    holdUsed = true;

    const curType = cur.type;

    if (!holdType) {
      holdType = curType;
      cur = spawn();
    } else {
      const tmp = holdType;
      holdType = curType;
      cur = { type: tmp, x: 3, y: 0, r: 0 };
      if (collides(cur, 0, 0, cur.r)) {
        gameOver = true;
        showOverlay("Game Over", "Hold swap caused top out. Press Restart.");
      }
    }

    drawMini(holdCtx, holdType);
    updateNextPreviews();
    draw();
  }

  function gravityMs() {
    // classic-ish: faster with level but not insane
    // level 1 ~ 900ms, level 10 ~ 200ms, clamps
    const ms = Math.max(55, 950 - (level-1) * 85);
    return ms;
  }

  // ---------- HUD / Overlay ----------
  function updateHUD() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
    bestEl.textContent  = String(best);
    updateNextPreviews();
    drawMini(holdCtx, holdType);
  }

  function updateNextPreviews() {
    ensureQueue();
    for (let i=0; i<4; i++) {
      drawMini(nextCtxs[i], nextQueue[i] || null);
    }
  }

  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.add("show");
  }

  function hideOverlay() {
    overlay.classList.remove("show");
  }

  function setPaused(v) {
    if (gameOver) return;
    paused = v;
    if (paused) {
      showOverlay("Paused", "Press Resume or hit P.");
    } else {
      hideOverlay();
      // reset timers so it doesn't drop instantly after resume
      lastTs = performance.now();
      leftDAS = rightDAS = leftARR = rightARR = 0;
      softTimer = 0;
    }
  }

  // ---------- Drawing ----------
  function drawBoardBlocks() {
    const { cell, ox, oy } = layout();
    // draw placed blocks (only visible portion)
    for (let y = HIDDEN_ROWS; y < BOARD_ROWS; y++) {
      const vy = y - HIDDEN_ROWS;
      if (vy < 0 || vy >= VISIBLE_ROWS) continue;
      for (let x = 0; x < COLS; x++) {
        const t = board[y][x];
        if (!t) continue;
        drawCell(ctx, ox + x*cell, oy + vy*cell, cell, COLORS[t], 1);
      }
    }
  }

  function drawPiece(p, color, alpha=1, isGhost=false) {
    const { cell, ox, oy } = layout();
    const mat = getMatrix(p.type, p.r);
    for (let y=0; y<mat.length; y++) {
      for (let x=0; x<mat[y].length; x++) {
        if (!mat[y][x]) continue;
        const bx = p.x + x;
        const by = p.y + y;
        const vy = by - HIDDEN_ROWS;
        if (vy < 0) continue; // hidden
        if (vy >= VISIBLE_ROWS) continue;
        const px = ox + bx*cell;
        const py = oy + vy*cell;
        if (isGhost) {
          // ghost: outlined + faint fill
          ctx.save();
          ctx.globalAlpha = alpha;
          roundRect(ctx, px+1, py+1, cell-2, cell-2, Math.max(6, cell*0.18));
          ctx.fillStyle = COLORS.G;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = Math.max(1, cell*0.05);
          ctx.stroke();
          ctx.restore();
        } else {
          drawCell(ctx, px, py, cell, color, alpha);
        }
      }
    }
  }

  function draw() {
    fitCanvas();
    drawGridBackground();
    drawBoardBlocks();

    if (cur && !gameOver) {
      const ghost = computeGhost(cur);
      drawPiece(ghost, COLORS.G, 1, true);
      drawPiece(cur, COLORS[cur.type], 1, false);
    }

    // vignette top/bottom
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "rgba(0,0,0,0.35)");
    grad.addColorStop(0.2, "rgba(0,0,0,0)");
    grad.addColorStop(0.8, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
  }

  // ---------- Input ----------
  function resetAutoShift() {
    leftDAS = rightDAS = 0;
    leftARR = rightARR = 0;
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (["arrowleft","arrowright","arrowdown","arrowup"," ","shift","c","p","escape"].includes(k) || k === "z" || k === "x") {
      e.preventDefault();
    }

    if (k === "p" || k === "escape") {
      if (!gameOver) setPaused(!paused);
      return;
    }

    if (paused || gameOver) return;

    if (keys.has(k)) return;
    keys.add(k);

    // movement
    if (k === "arrowleft") {
      leftHeld = true;
      tryMove(-1, 0);
      leftDAS = 0; leftARR = 0;
      rightHeld = false; rightDAS = 0; rightARR = 0; // last input wins
    }
    if (k === "arrowright") {
      rightHeld = true;
      tryMove(1, 0);
      rightDAS = 0; rightARR = 0;
      leftHeld = false; leftDAS = 0; leftARR = 0;
    }

    // rotate
    if (k === "arrowup" || k === "x") tryRotate(+1);
    if (k === "z") tryRotate(-1);

    // hard drop
    if (k === " ") hardDrop();

    // hold
    if (k === "shift" || k === "c") hold();

    // soft drop
    if (k === "arrowdown") {
      softHeld = true;
      softTimer = 0;
      softDropTick(); // immediate one step
    }

    draw();
    updateHUD();
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    keys.delete(k);

    if (k === "arrowleft") leftHeld = false;
    if (k === "arrowright") rightHeld = false;
    if (k === "arrowdown") softHeld = false;

    if (!leftHeld && !rightHeld) resetAutoShift();
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });

  // ---------- Buttons ----------
  btnPause?.addEventListener("click", () => setPaused(true));
  btnResume?.addEventListener("click", () => setPaused(false));
  btnRestart?.addEventListener("click", () => restart());
  btnOverlayRestart?.addEventListener("click", () => restart());

  // ---------- Main loop ----------
  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    if (!paused && !gameOver) {
      // lateral movement (DAS/ARR)
      if (leftHeld) {
        leftDAS += dt;
        if (leftDAS >= DAS) {
          leftARR += dt;
          while (leftARR >= ARR) {
            tryMove(-1, 0);
            leftARR -= ARR;
          }
        }
      }
      if (rightHeld) {
        rightDAS += dt;
        if (rightDAS >= DAS) {
          rightARR += dt;
          while (rightARR >= ARR) {
            tryMove(1, 0);
            rightARR -= ARR;
          }
        }
      }

      // soft drop
      if (softHeld) {
        softTimer += dt;
        while (softTimer >= SOFT_DROP) {
          softDropTick();
          softTimer -= SOFT_DROP;
        }
      }

      // gravity
      fallTimer += dt;
      const g = gravityMs();
      while (fallTimer >= g) {
        fallTimer -= g;

        if (!tryMove(0, 1)) {
          // on ground -> lock delay
          lockTimer += g;
          if (lockTimer >= LOCK_DELAY) {
            lockTimer = 0;
            lockDown();
            break;
          }
        } else {
          lockTimer = 0;
        }
      }

      // if grounded but player is not moving, lock timer still accumulates a bit
      if (collides(cur, 0, 1)) {
        lockTimer += dt * 0.35;
        if (lockTimer >= LOCK_DELAY) {
          lockTimer = 0;
          lockDown();
        }
      } else {
        lockTimer = 0;
      }

      // best update
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        bestEl.textContent = String(best);
      }

      draw();
      updateHUD();
    }

    requestAnimationFrame(tick);
  }

  // ---------- Start / Restart ----------
  function restart() {
    hideOverlay();
    paused = false;
    gameOver = false;

    board = makeBoard();
    nextQueue = [];
    holdType = null;
    holdUsed = false;

    score = 0;
    lines = 0;
    level = 1;

    fallTimer = 0;
    lockTimer = 0;

    leftHeld = rightHeld = softHeld = false;
    keys.clear();
    resetAutoShift();

    ensureQueue();
    cur = spawn();

    updateHUD();
    draw();

    // reset loop timing
    lastTs = performance.now();
  }

  // ---------- Boot ----------
  // make mini canvases crisp too
  function fitMiniCanvases() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const minis = [...nextCanvases, holdCanvas];
    minis.forEach(c => {
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const c2 = c.getContext("2d");
      c2.setTransform(1,0,0,1,0,0);
    });
  }

  window.addEventListener("resize", () => {
    fitMiniCanvases();
    updateHUD();
    draw();
  });

  fitCanvas();
  fitMiniCanvases();
  updateHUD();
  restart();
  requestAnimationFrame(tick);
})();
