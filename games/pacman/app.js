(() => {
  // ------------------------------------------------------------
  // Classic-style Pac-Man implemented as a tile-based game.
  // Note: This is a "Pac-Man style" recreation (no original ROM/assets).
  // ------------------------------------------------------------

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    score: document.getElementById("score"),
    high: document.getElementById("high"),
    lives: document.getElementById("lives"),
    level: document.getElementById("level"),
    toast: document.getElementById("toast"),
    btnStart: document.getElementById("btnStart"),
    btnPause: document.getElementById("btnPause"),
    btnRestart: document.getElementById("btnRestart"),
    dpad: Array.from(document.querySelectorAll(".dpad-btn")),
  };

  // -------------------- Audio (tiny synth) --------------------
  // No external files. Simple WebAudio bleeps. Toggle with M.
  let audioOn = true;
  let ac = null;
  const beep = (freq, dur = 0.06, type = "sine", gain = 0.04) => {
    if (!audioOn) return;
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  };

  // -------------------- Grid & Map --------------------
  const TILE = 24;
  const COLS = 28;
  const ROWS = 31;

  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  // Legend:
  // # wall
  // . pellet
  // o power pellet
  // ' ' empty
  // = gate (ghost house door - Pac cannot pass, ghosts can)
  // P player spawn
  // G ghost spawns (4)
  const MAP_RAW = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##### ## #####.#     ",
    "     #.##          ##.#     ",
    "     #.## ###==### ##.#     ",
    "######.## #      # ##.######",
    "      .   # GGGG #   .      ",
    "######.## #      # ##.######",
    "     #.## ######## ##.#     ",
    "     #.##          ##.#     ",
    "     #.## ######## ##.#     ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o..##................##..o#",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#........................P.#",
    "############################",
    "                            ",
    "                            ",
  ];

  // Normalize to ROWS length and COLS width
  const map = MAP_RAW.slice(0, ROWS).map((row) => {
    row = row.padEnd(COLS, " ").slice(0, COLS);
    return row.split("");
  });

  const isWall = (r, c) => map[r]?.[c] === "#";
  const isGate = (r, c) => map[r]?.[c] === "=";
  const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  const wrapTunnel = (x) => {
    // Horizontal tunnel wrap (classic)
    const maxX = COLS * TILE;
    if (x < -TILE / 2) return maxX + TILE / 2;
    if (x > maxX + TILE / 2) return -TILE / 2;
    return x;
  };

  // Find spawns
  let playerSpawn = { r: 27, c: 26 };
  const ghostSpawns = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map[r][c] === "P") {
        playerSpawn = { r, c };
        map[r][c] = " ";
      }
      if (map[r][c] === "G") {
        ghostSpawns.push({ r, c });
        map[r][c] = " ";
      }
    }
  }

  // Count pellets
  const countPellets = () => {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (map[r][c] === "." || map[r][c] === "o") n++;
    }
    return n;
  };

  // -------------------- Game State --------------------
  const DIRS = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    none: { x: 0, y: 0 },
  };

  const keyToDir = (k) => {
    switch (k) {
      case "ArrowLeft":
      case "a":
      case "A":
        return "left";
      case "ArrowRight":
      case "d":
      case "D":
        return "right";
      case "ArrowUp":
      case "w":
      case "W":
        return "up";
      case "ArrowDown":
      case "s":
      case "S":
        return "down";
      default:
        return null;
    }
  };

  let running = false;
  let paused = false;

  const storeKey = "pm_highscore_v1";
  const loadHigh = () => Number(localStorage.getItem(storeKey) || 0);
  const saveHigh = (v) => localStorage.setItem(storeKey, String(v));

  const state = {
    score: 0,
    high: loadHigh(),
    lives: 3,
    level: 1,
    pelletsLeft: countPellets(),
    frightenedUntil: 0,
    ghostEatChain: 0,
  };

  const resetToast = (msg = "Ready! Press Start.") => {
    ui.toast.textContent = msg;
  };

  // -------------------- Entities --------------------
  const centerOf = (r, c) => ({
    x: c * TILE + TILE / 2,
    y: r * TILE + TILE / 2,
  });

  const tileAt = (x, y) => ({
    c: Math.floor(x / TILE),
    r: Math.floor(y / TILE),
  });

  const canEnter = (r, c, asGhost = false) => {
    if (!inBounds(r, c)) return false;
    if (isWall(r, c)) return false;
    if (!asGhost && isGate(r, c)) return false;
    return true;
  };

  const alignToTileCenter = (e) => {
    // Snap to center when close to avoid jitter
    const t = tileAt(e.x, e.y);
    const cx = t.c * TILE + TILE / 2;
    const cy = t.r * TILE + TILE / 2;
    if (Math.abs(e.x - cx) < e.snap) e.x = cx;
    if (Math.abs(e.y - cy) < e.snap) e.y = cy;
  };

  const player = {
    x: centerOf(playerSpawn.r, playerSpawn.c).x,
    y: centerOf(playerSpawn.r, playerSpawn.c).y,
    dir: "left",
    want: "left",
    speed: 2.05,
    radius: 9.2,
    mouth: 0,
    mouthDir: 1,
    snap: 2.2,
    dead: false,
    deathT: 0,
  };

  const makeGhost = (i, pos) => {
    const colors = ["#ff4d6d", "#22d3ee", "#fbbf24", "#a78bfa"];
    return {
      id: i,
      x: centerOf(pos.r, pos.c).x,
      y: centerOf(pos.r, pos.c).y,
      dir: "left",
      speed: 1.8,
      radius: 9.0,
      color: colors[i % colors.length],
      mode: "scatter", // scatter/chase/frightened/eyes
      scared: false,
      eyes: false,
      snap: 2.0,
      target: { r: 1, c: 1 },
      home: { r: pos.r, c: pos.c },
    };
  };

  const ghosts = ghostSpawns.length
    ? ghostSpawns.slice(0, 4).map((p, i) => makeGhost(i, p))
    : [
        makeGhost(0, { r: 14, c: 13 }),
        makeGhost(1, { r: 14, c: 14 }),
        makeGhost(2, { r: 14, c: 12 }),
        makeGhost(3, { r: 14, c: 15 }),
      ];

  // Scatter corners (classic feel)
  const scatterTargets = [
    { r: 1, c: 1 },
    { r: 1, c: COLS - 2 },
    { r: ROWS - 3, c: 1 },
    { r: ROWS - 3, c: COLS - 2 },
  ];

  // -------------------- Helpers --------------------
  const now = () => performance.now();

  const setHUD = () => {
    ui.score.textContent = state.score;
    ui.high.textContent = state.high;
    ui.lives.textContent = state.lives;
    ui.level.textContent = state.level;
  };

  const setScore = (delta) => {
    state.score += delta;
    if (state.score > state.high) {
      state.high = state.score;
      saveHigh(state.high);
    }
    setHUD();
  };

  const softResetPositions = () => {
    player.x = centerOf(playerSpawn.r, playerSpawn.c).x;
    player.y = centerOf(playerSpawn.r, playerSpawn.c).y;
    player.dir = "left";
    player.want = "left";
    player.dead = false;
    player.deathT = 0;

    ghosts.forEach((g, i) => {
      const sp = ghostSpawns[i] || { r: 14, c: 13 + i };
      g.x = centerOf(sp.r, sp.c).x;
      g.y = centerOf(sp.r, sp.c).y;
      g.dir = "left";
      g.eyes = false;
      g.scared = false;
      g.mode = "scatter";
    });

    state.frightenedUntil = 0;
    state.ghostEatChain = 0;
  };

  const resetLevel = () => {
    // Rebuild pellets by reloading MAP_RAW into map and removing spawns again
    const raw = MAP_RAW.slice(0, ROWS).map(r => r.padEnd(COLS, " ").slice(0, COLS).split(""));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) map[r][c] = raw[r][c];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (map[r][c] === "P") map[r][c] = " ";
      if (map[r][c] === "G") map[r][c] = " ";
    }
    state.pelletsLeft = countPellets();
    softResetPositions();
  };

  const toast = (msg) => {
    ui.toast.textContent = msg;
  };

  // -------------------- Movement --------------------
  const isCentered = (e) => {
    const t = tileAt(e.x, e.y);
    const cx = t.c * TILE + TILE / 2;
    const cy = t.r * TILE + TILE / 2;
    return Math.abs(e.x - cx) < 0.8 && Math.abs(e.y - cy) < 0.8;
  };

  const tryTurn = (e, wantDir, asGhost = false) => {
    if (wantDir === "none") return false;
    const d = DIRS[wantDir];
    const t = tileAt(e.x, e.y);
    // Only turn cleanly at centers
    const cx = t.c * TILE + TILE / 2;
    const cy = t.r * TILE + TILE / 2;
    if (Math.abs(e.x - cx) > 1.2 || Math.abs(e.y - cy) > 1.2) return false;
    const nr = t.r + d.y;
    const nc = t.c + d.x;
    if (canEnter(nr, nc, asGhost)) {
      e.x = cx; e.y = cy;
      e.dir = wantDir;
      return true;
    }
    return false;
  };

  const stepEntity = (e, speed, asGhost = false) => {
    const d = DIRS[e.dir] || DIRS.none;
    const nx = e.x + d.x * speed;
    const ny = e.y + d.y * speed;

    // collision check by looking ahead a bit from center
    const lookX = nx + d.x * (TILE * 0.35);
    const lookY = ny + d.y * (TILE * 0.35);
    const t = tileAt(lookX, lookY);

    if (!canEnter(t.r, t.c, asGhost)) {
      // stop at wall
      return;
    }
    e.x = wrapTunnel(nx);
    e.y = ny;
  };

  // -------------------- Ghost AI (simple but good) --------------------
  const validDirsFrom = (g) => {
    const t = tileAt(g.x, g.y);
    const dirs = ["left","right","up","down"];
    const out = [];
    for (const dir of dirs) {
      const d = DIRS[dir];
      const nr = t.r + d.y;
      const nc = t.c + d.x;
      if (canEnter(nr, nc, true)) out.push(dir);
    }
    return out;
  };

  const opposite = (dir) => {
    switch (dir) {
      case "left": return "right";
      case "right": return "left";
      case "up": return "down";
      case "down": return "up";
      default: return dir;
    }
  };

  const dist2 = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx*dx + dy*dy;
  };

  const chooseGhostDir = (g) => {
    if (!isCentered(g)) return;

    const dirs = validDirsFrom(g);
    // avoid reversing unless forced
    const back = opposite(g.dir);
    const options = dirs.length > 1 ? dirs.filter(d => d !== back) : dirs;

    const t = tileAt(g.x, g.y);

    // Determine target tile
    let targetTile;
    if (g.eyes) {
      targetTile = g.home;
    } else if (g.scared) {
      // run away: target opposite of player by mirroring
      const pt = tileAt(player.x, player.y);
      targetTile = { r: Math.max(1, Math.min(ROWS-2, t.r + (t.r - pt.r))),
                    c: Math.max(1, Math.min(COLS-2, t.c + (t.c - pt.c))) };
    } else {
      // chase with slight personality
      const pt = tileAt(player.x, player.y);
      if (g.id === 0) {
        // direct chase
        targetTile = pt;
      } else if (g.id === 1) {
        // aim ahead of player
        const pd = DIRS[player.dir] || DIRS.left;
        targetTile = { r: pt.r + pd.y * 4, c: pt.c + pd.x * 4 };
      } else if (g.id === 2) {
        // patrol-ish: mix scatter corner and player
        const s = scatterTargets[g.id];
        targetTile = (Math.random() < 0.25) ? s : pt;
      } else {
        // ambush: target a diagonal offset
        targetTile = { r: pt.r + 3, c: pt.c - 3 };
      }

      // clamp
      targetTile = {
        r: Math.max(1, Math.min(ROWS - 2, targetTile.r)),
        c: Math.max(1, Math.min(COLS - 2, targetTile.c)),
      };
    }

    const targetPos = centerOf(targetTile.r, targetTile.c);

    let best = options[0];
    let bestD = Infinity;
    for (const dir of options) {
      const d = DIRS[dir];
      const nextCenter = {
        x: (t.c + d.x) * TILE + TILE / 2,
        y: (t.r + d.y) * TILE + TILE / 2,
      };
      const dd = dist2(nextCenter, targetPos);
      if (dd < bestD) { bestD = dd; best = dir; }
    }
    g.dir = best;
  };

  // -------------------- Eating & Collisions --------------------
  const eatAtPlayer = () => {
    const t = tileAt(player.x, player.y);
    const cell = map[t.r]?.[t.c];
    if (cell === "." || cell === "o") {
      map[t.r][t.c] = " ";
      state.pelletsLeft--;
      if (cell === ".") {
        setScore(10);
        beep(540, 0.03, "square", 0.02);
      } else {
        setScore(50);
        beep(180, 0.08, "sawtooth", 0.03);
        // frightened
        state.frightenedUntil = now() + 8500;
        state.ghostEatChain = 0;
        ghosts.forEach(g => {
          if (!g.eyes) {
            g.scared = true;
          }
        });
      }

      if (state.pelletsLeft <= 0) {
        // next level
        running = false;
        paused = false;
        state.level++;
        toast(`Level ${state.level}!`);
        setHUD();
        setTimeout(() => {
          resetLevel();
          running = true;
          toast("Go!");
          beep(880, 0.08, "triangle", 0.03);
        }, 800);
      }
    }
  };

  const playerGhostCollision = () => {
    const pr = player.radius;
    for (const g of ghosts) {
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < pr + g.radius - 2) {
        if (g.scared && !g.eyes) {
          // eat ghost
          g.eyes = true;
          g.scared = false;
          state.ghostEatChain++;
          const points = 200 * Math.pow(2, state.ghostEatChain - 1);
          setScore(points);
          toast(`+${points}!`);
          beep(220, 0.09, "square", 0.04);
          beep(440, 0.06, "square", 0.03);
        } else if (!g.eyes && !player.dead) {
          // player dies
          player.dead = true;
          player.deathT = now();
          running = false;
          state.lives--;
          setHUD();
          beep(120, 0.18, "sawtooth", 0.05);
          beep(90, 0.22, "sawtooth", 0.05);

          if (state.lives <= 0) {
            toast("Game Over — press Restart");
          } else {
            toast("Ouch! Resetting…");
            setTimeout(() => {
              softResetPositions();
              running = true;
              toast("Go!");
            }, 1200);
          }
        }
      }
    }
  };

  // Ghost returns home when eyes
  const updateEyes = (g) => {
    if (!g.eyes) return;
    const t = tileAt(g.x, g.y);
    if (t.r === g.home.r && t.c === g.home.c) {
      g.eyes = false;
      g.scared = false;
    }
  };

  // -------------------- Rendering --------------------
  const drawGlassFrame = () => {
    // subtle inner glow
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(125,211,252,.20)";
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.restore();
  };

  const drawMaze = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background gradient
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "rgba(5,10,25,0.85)");
    g.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // walls
    ctx.save();
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = "rgba(125,211,252,.55)";
    ctx.fillStyle = "rgba(12, 30, 60, .25)";

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = map[r][c];
        if (cell === "#") {
          const x = c * TILE, y = r * TILE;
          // rounded-ish blocks
          ctx.beginPath();
          roundRect(ctx, x + 1.2, y + 1.2, TILE - 2.4, TILE - 2.4, 7);
          ctx.fill();
          ctx.stroke();
        } else if (cell === "=") {
          // gate
          const x = c * TILE, y = r * TILE;
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 3, y + TILE / 2);
          ctx.lineTo(x + TILE - 3, y + TILE / 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.restore();

    // pellets
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = map[r][c];
        if (cell === "." || cell === "o") {
          const x = c * TILE + TILE / 2;
          const y = r * TILE + TILE / 2;
          ctx.beginPath();
          const rad = cell === "." ? 2.2 : 5.2;
          ctx.fillStyle = cell === "." ? "rgba(255,255,255,.85)" : "rgba(251,191,36,.95)";
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fill();

          if (cell === "o") {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(x, y, 10.5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(251,191,36,.9)";
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    drawGlassFrame();
  };

  const drawPlayer = () => {
    // mouth animation
    if (!player.dead) {
      player.mouth += 0.12 * player.mouthDir;
      if (player.mouth > 1) { player.mouth = 1; player.mouthDir = -1; }
      if (player.mouth < 0) { player.mouth = 0; player.mouthDir = 1; }
    }

    const open = 0.20 + player.mouth * 0.35;
    const base = dirAngle(player.dir);
    const a1 = base + open;
    const a2 = base - open;

    ctx.save();
    ctx.translate(player.x, player.y);

    // glow
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.fillStyle = "rgba(251,191,36,1)";
    ctx.arc(0, 0, player.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // body
    ctx.beginPath();
    ctx.fillStyle = "rgba(251,191,36,1)";
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, player.radius, a2, a1, false);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = "rgba(15,23,42,0.9)";
    const eye = eyeOffset(player.dir);
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawGhost = (g) => {
    ctx.save();
    ctx.translate(g.x, g.y);

    const bodyR = g.radius;
    const scared = g.scared && !g.eyes;

    // glow
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.fillStyle = scared ? "rgba(96,165,250,1)" : g.color;
    ctx.arc(0, 0, bodyR + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (g.eyes) {
      // eyes only
      drawGhostEyes(ctx, 0, 0, g.dir, true);
      ctx.restore();
      return;
    }

    // body
    ctx.fillStyle = scared ? "rgba(96,165,250,1)" : g.color;
    ctx.beginPath();
    // head
    ctx.arc(0, -2, bodyR, Math.PI, 0, false);
    // skirt
    const skirtY = bodyR + 2;
    ctx.lineTo(bodyR, skirtY);
    const bumps = 6;
    for (let i = 0; i < bumps; i++) {
      const bx = bodyR - (i * (bodyR * 2 / bumps)) - (bodyR * 2 / bumps) / 2;
      const br = (bodyR * 2 / bumps) / 2;
      ctx.arc(bx, skirtY, br, 0, Math.PI, true);
    }
    ctx.closePath();
    ctx.fill();

    // face
    drawGhostEyes(ctx, 0, 0, g.dir, false);

    if (scared) {
      // scared mouth
      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.beginPath();
      ctx.arc(0, 7, 4.2, 0, Math.PI, false);
      ctx.fill();
    }

    ctx.restore();
  };

  function drawGhostEyes(ctx, x, y, dir, eyesOnly) {
    // whites
    const dx = dir === "left" ? -2 : dir === "right" ? 2 : 0;
    const dy = dir === "up" ? -2 : dir === "down" ? 2 : 0;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.ellipse(-4.2, -3, 3.0, 3.8, 0, 0, Math.PI * 2);
    ctx.ellipse( 4.2, -3, 3.0, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // pupils
    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.beginPath();
    ctx.arc(-4.2 + dx * 0.7, -3 + dy * 0.7, 1.6, 0, Math.PI * 2);
    ctx.arc( 4.2 + dx * 0.7, -3 + dy * 0.7, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (eyesOnly) {
      // small outline for visibility
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
  }

  function dirAngle(dir) {
    switch (dir) {
      case "right": return 0;
      case "left": return Math.PI;
      case "up": return -Math.PI / 2;
      case "down": return Math.PI / 2;
      default: return 0;
    }
  }

  function eyeOffset(dir) {
    switch (dir) {
      case "right": return { x: 2, y: -4 };
      case "left": return { x: -2, y: -4 };
      case "up": return { x: -4, y: -2 };
      case "down": return { x: 4, y: -2 };
      default: return { x: 2, y: -4 };
    }
  }

  // -------------------- Main Loop --------------------
  let last = 0;
  let chaseToggle = 0;
  let chaseMode = "scatter"; // alternates

  const updateModes = (t) => {
    // alternate scatter/chase rhythm (simplified)
    chaseToggle += t;
    const cycle = 9000; // ms per segment
    if (chaseToggle > cycle) {
      chaseToggle = 0;
      chaseMode = chaseMode === "scatter" ? "chase" : "scatter";
    }
  };

  const tick = (ts) => {
    requestAnimationFrame(tick);
    if (!paused && running) {
      const dt = Math.min(32, ts - last || 16);
      last = ts;

      updateModes(dt);

      // frightened timer
      if (state.frightenedUntil && ts > state.frightenedUntil) {
        state.frightenedUntil = 0;
        state.ghostEatChain = 0;
        ghosts.forEach(g => { if (!g.eyes) g.scared = false; });
      } else {
        // keep scared
        if (state.frightenedUntil) ghosts.forEach(g => { if (!g.eyes) g.scared = true; });
      }

      // player wants turn
      tryTurn(player, player.want, false);

      alignToTileCenter(player);
      stepEntity(player, player.speed, false);

      eatAtPlayer();

      // ghosts
      ghosts.forEach((g) => {
        // speed adjustments
        const base = 1.75 + state.level * 0.05;
        let s = base;
        if (g.scared && !g.eyes) s = base * 0.72;
        if (g.eyes) s = base * 1.25;
        g.speed = s;

        // set mode flags
        if (!g.eyes) {
          g.mode = g.scared ? "frightened" : chaseMode;
        } else {
          g.mode = "eyes";
        }

        alignToTileCenter(g);
        chooseGhostDir(g);
        stepEntity(g, g.speed, true);
        updateEyes(g);
      });

      playerGhostCollision();
    }

    // render
    drawMaze();
    ghosts.forEach(drawGhost);
    drawPlayer();

    // paused overlay
    if (paused) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  };

  // -------------------- Input --------------------
  const setWant = (dir) => {
    if (!DIRS[dir]) return;
    player.want = dir;
  };

  window.addEventListener("keydown", (e) => {
    const dir = keyToDir(e.key);
    if (dir) {
      e.preventDefault();
      setWant(dir);
      return;
    }
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "m" || e.key === "M") {
      audioOn = !audioOn;
      toast(audioOn ? "Sound on" : "Sound off");
      if (audioOn) beep(660, 0.06, "triangle", 0.03);
    }
  }, { passive: false });

  ui.dpad.forEach(btn => {
    const dir = btn.dataset.dir;
    const on = (ev) => {
      ev.preventDefault();
      setWant(dir);
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("touchstart", on, { passive: false });
  });

  // -------------------- Controls --------------------
  const start = () => {
    if (state.lives <= 0) return;
    if (!running) {
      running = true;
      paused = false;
      toast("Go!");
      beep(880, 0.08, "triangle", 0.03);
    }
  };

  const togglePause = () => {
    if (!running) return;
    paused = !paused;
    toast(paused ? "Paused" : "Go!");
    beep(paused ? 320 : 520, 0.05, "square", 0.02);
  };

  const restart = () => {
    // full reset
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    setHUD();
    resetLevel();
    running = true;
    paused = false;
    toast("New game — Go!");
    beep(760, 0.08, "triangle", 0.03);
  };

  ui.btnStart.addEventListener("click", start);
  ui.btnPause.addEventListener("click", togglePause);
  ui.btnRestart.addEventListener("click", restart);

  // -------------------- Init --------------------
  setHUD();
  resetToast();
  softResetPositions();
  requestAnimationFrame(tick);

  // show "Ready" frame
  drawMaze();
  ghosts.forEach(drawGhost);
  drawPlayer();
})();
