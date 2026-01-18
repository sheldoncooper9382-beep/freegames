/* /games/snake/game.js */
(function () {
  'use strict';

  /*----------------------------- Constants -----------------------------*/
  const COLS = 20;
  const ROWS = 20;

  const DEFAULT_BASE_SPEED = 200;   // ms per move at level 1 (slider value)
  const SPEED_DECREMENT = 10;       // ms faster per level
  const FOODS_PER_LEVEL = 5;        // foods to level up
  const MAX_SPEED = 60;             // minimum interval cap

  // Colors for snake and food
  const SNAKE_COLOR = { start: '#5aff72', end: '#32b84a' };
  const FOOD_COLOR  = { start: '#ff6b6b', end: '#c91e42' };

  const OPPOSITES = {
    ArrowUp: 'ArrowDown',
    ArrowDown: 'ArrowUp',
    ArrowLeft: 'ArrowRight',
    ArrowRight: 'ArrowLeft'
  };

  /*----------------------------- State -----------------------------*/
  let snake = [];
  let direction = 'ArrowRight';
  let nextDirection = 'ArrowRight';
  let food = { x: 0, y: 0 };

  let score = 0;
  let level = 1;
  let foodsEaten = 0;
  let highScore = 0;

  let baseSpeed = DEFAULT_BASE_SPEED; // controlled by slider
  let speed = DEFAULT_BASE_SPEED;     // effective speed after level scaling
  let lastMoveTime = 0;

  let paused = true;     // STARTS paused until Start pressed
  let started = false;   // requires Start button
  let gameOver = false;

  /*----------------------------- DOM -----------------------------*/
  const boardCanvas = document.getElementById('board');

  const scoreSpan = document.getElementById('score');
  const levelSpan = document.getElementById('level');
  const lengthSpan = document.getElementById('length');
  const highScoreSpan = document.getElementById('high-score');

  const overlay = document.getElementById('overlay');
  const messageElem = document.getElementById('message');
  const startOverlayBtn = document.getElementById('start-game');
  const playAgainBtn = document.getElementById('play-again');

  const mobileControls = document.getElementById('mobile-controls');

  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');

  // Desktop buttons + speed
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const restartBtn = document.getElementById('restart-btn');
  const speedInput = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');

  /*----------------------------- Utils -----------------------------*/
  function rand(max) {
    return Math.floor(Math.random() * max);
  }

  function computeEffectiveSpeed() {
    // slider sets baseSpeed; level makes it faster
    speed = Math.max(MAX_SPEED, baseSpeed - SPEED_DECREMENT * (level - 1));
  }

  function updateSpeedUI() {
    if (speedValue) speedValue.textContent = String(baseSpeed);
  }

  function spawnFood() {
    let fx, fy;
    do {
      fx = rand(COLS);
      fy = rand(ROWS);
    } while (snake.some(seg => seg.x === fx && seg.y === fy));
    food.x = fx;
    food.y = fy;
  }

  function updateStats() {
    scoreSpan.textContent = String(score);
    levelSpan.textContent = String(level);
    lengthSpan.textContent = String(snake.length);
    if (score > highScore) highScore = score;
    highScoreSpan.textContent = String(highScore);
  }

  function showOverlay(msg, mode) {
    // mode: 'start' | 'pause' | 'gameover'
    overlay.classList.remove('hidden');
    messageElem.innerHTML = '';
    messageElem.textContent = msg;

    if (startOverlayBtn) startOverlayBtn.style.display = (mode === 'start') ? '' : 'none';
    if (playAgainBtn) playAgainBtn.style.display = (mode === 'gameover') ? '' : 'none';

    if (mode === 'gameover') {
      const details = document.createElement('div');
      details.style.fontSize = '1rem';
      details.style.marginTop = '0.5rem';
      details.innerHTML = `Score: ${score}<br>Length: ${snake.length}<br>Level: ${level}`;
      messageElem.appendChild(details);
    }
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function startGame() {
    if (gameOver) return;
    started = true;
    paused = false;
    hideOverlay();
    lastMoveTime = performance.now();
    // focus canvas so keyboard works immediately
    boardCanvas.focus();
  }

  function togglePause() {
    if (gameOver || !started) return;
    paused = !paused;
    if (paused) {
      showOverlay('Paused', 'pause');
    } else {
      hideOverlay();
      lastMoveTime = performance.now();
    }
  }

  function restart() {
    initGame();
  }

  function changeDirection(dir) {
    if (!started || paused || gameOver) return; // only allow input after Start (feel more “premium”)
    if (OPPOSITES[direction] === dir) return;
    nextDirection = dir;
  }

  /*----------------------------- Drawing -----------------------------*/
  function lighten(hex, amount) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    r = Math.min(255, Math.floor(r + (255 - r) * amount));
    g = Math.min(255, Math.floor(g + (255 - g) * amount));
    b = Math.min(255, Math.floor(b + (255 - b) * amount));
    return `rgb(${r},${g},${b})`;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawCell(ctx, x, y, cellSize, color, index) {
    const px = x * cellSize;
    const py = y * cellSize;

    const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
    let startColor = color.start;
    let endColor = color.end;

    if (index !== undefined) {
      const factor = index / (snake.length - 1 || 1);
      startColor = lighten(color.start, factor * 0.4);
      endColor = lighten(color.end, factor * 0.4);
    }

    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.shadowColor = (color.end + '88');
    ctx.shadowBlur = 10;

    const pad = Math.max(1, Math.floor(cellSize * 0.06));
    const rx = px + pad;
    const ry = py + pad;
    const rw = cellSize - pad * 2;
    const rh = cellSize - pad * 2;
    roundedRect(ctx, rx, ry, rw, rh, Math.floor(cellSize * 0.22));
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeRect(px, py, cellSize, cellSize);
    ctx.restore();
  }

  // Pac-Man style chomping head
  function drawPacmanHead(ctx, x, y, cellSize, time) {
    const px = x * cellSize;
    const py = y * cellSize;
    const cx = px + cellSize / 2;
    const cy = py + cellSize / 2;
    const r = cellSize * 0.46;

    // mouth oscillates between small and wide
    const open = 0.18 + 0.22 * ((Math.sin(time * 0.02) + 1) / 2); // radians

    let startA = 0;
    let endA = Math.PI * 2;

    switch (direction) {
      case 'ArrowRight':
        startA = open;
        endA = (Math.PI * 2) - open;
        break;
      case 'ArrowLeft':
        startA = Math.PI + open;
        endA = (Math.PI * 3) - open;
        break;
      case 'ArrowUp':
        startA = (Math.PI * 1.5) + open;
        endA = (Math.PI * 3.5) - open;
        break;
      case 'ArrowDown':
        startA = (Math.PI * 0.5) + open;
        endA = (Math.PI * 2.5) - open;
        break;
    }

    // gradient fill
    const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
    gradient.addColorStop(0, SNAKE_COLOR.start);
    gradient.addColorStop(1, SNAKE_COLOR.end);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.shadowColor = SNAKE_COLOR.end + '88';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startA, endA, false);
    ctx.closePath();
    ctx.fill();

    // subtle cell border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeRect(px, py, cellSize, cellSize);

    // eye (direction-aware-ish)
    const eyeOffset = cellSize * 0.14;
    let ex = cx;
    let ey = cy;
    if (direction === 'ArrowRight') { ex = cx + eyeOffset; ey = cy - eyeOffset; }
    if (direction === 'ArrowLeft')  { ex = cx - eyeOffset; ey = cy - eyeOffset; }
    if (direction === 'ArrowUp')    { ex = cx + eyeOffset; ey = cy - eyeOffset; }
    if (direction === 'ArrowDown')  { ex = cx + eyeOffset; ey = cy + eyeOffset * 0.2; }

    ctx.fillStyle = 'rgba(10,10,10,0.75)';
    ctx.beginPath();
    ctx.arc(ex, ey, cellSize * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBoard(time) {
    const ctx = boardCanvas.getContext('2d');
    const width = boardCanvas.clientWidth;
    const height = boardCanvas.clientHeight;
    const cellSize = width / COLS;

    ctx.clearRect(0, 0, width, height);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      const px = x * cellSize;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      const py = y * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // food
    drawCell(ctx, food.x, food.y, cellSize, FOOD_COLOR);

    // snake
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      if (i === 0) {
        drawPacmanHead(ctx, seg.x, seg.y, cellSize, time);
      } else {
        drawCell(ctx, seg.x, seg.y, cellSize, SNAKE_COLOR, i);
      }
    }
  }

  /*----------------------------- Game logic -----------------------------*/
  function moveSnake() {
    direction = nextDirection;
    const head = snake[0];
    let newX = head.x;
    let newY = head.y;

    switch (direction) {
      case 'ArrowUp': newY -= 1; break;
      case 'ArrowDown': newY += 1; break;
      case 'ArrowLeft': newX -= 1; break;
      case 'ArrowRight': newX += 1; break;
    }

    // wall collision
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
      gameOver = true;
      paused = true;
      showOverlay('Game Over', 'gameover');
      return;
    }

    // self collision
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      if (seg.x === newX && seg.y === newY) {
        gameOver = true;
        paused = true;
        showOverlay('Game Over', 'gameover');
        return;
      }
    }

    // add new head
    snake.unshift({ x: newX, y: newY });

    // eat?
    if (newX === food.x && newY === food.y) {
      score += 10;
      foodsEaten++;

      // level up
      if (foodsEaten % FOODS_PER_LEVEL === 0) {
        level++;
      }

      computeEffectiveSpeed();
      spawnFood();
      // IMPORTANT: do not pop => snake grows by 1 each food ✅
    } else {
      snake.pop();
    }

    updateStats();
  }

  /*----------------------------- Input -----------------------------*/
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    if (gameOver) {
      if (e.key.toLowerCase() === 'r') restart();
      if (e.key === 'Enter' || e.key === ' ') restart();
      return;
    }

    // allow starting from keyboard
    if (!started && (e.key === 'Enter' || e.key === ' ')) {
      startGame();
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        changeDirection(e.key);
        break;
      case 'p':
      case 'P':
        togglePause();
        break;
      case 'r':
      case 'R':
        restart();
        break;
    }
  });

  function attachMobileControls() {
    btnUp?.addEventListener('click', () => changeDirection('ArrowUp'));
    btnDown?.addEventListener('click', () => changeDirection('ArrowDown'));
    btnLeft?.addEventListener('click', () => changeDirection('ArrowLeft'));
    btnRight?.addEventListener('click', () => changeDirection('ArrowRight'));
    btnPause?.addEventListener('click', () => togglePause());
    btnRestart?.addEventListener('click', () => restart());
  }

  function attachGestureControls() {
    let startX = 0;
    let startY = 0;
    let gestureActive = false;
    let moved = false;
    const threshold = 20;

    function pointerDown(ev) {
      // tap to start if not started yet
      if (!started && !gameOver) {
        startGame();
      }
      if (gameOver) return;

      gestureActive = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      boardCanvas.setPointerCapture(ev.pointerId);
    }

    function pointerMove(ev) {
      if (!gestureActive) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        moved = true;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) changeDirection('ArrowRight');
          else changeDirection('ArrowLeft');
        } else {
          if (dy > 0) changeDirection('ArrowDown');
          else changeDirection('ArrowUp');
        }
      }
    }

    function pointerUp(ev) {
      if (!gestureActive) return;
      boardCanvas.releasePointerCapture(ev.pointerId);

      // small tap toggles pause only after started
      if (!moved && started && !gameOver) togglePause();
      gestureActive = false;
    }

    boardCanvas.addEventListener('pointerdown', pointerDown);
    boardCanvas.addEventListener('pointermove', pointerMove);
    boardCanvas.addEventListener('pointerup', pointerUp);
    boardCanvas.addEventListener('pointercancel', pointerUp);
  }

  /*----------------------------- Resize -----------------------------*/
  function resizeCanvas() {
    const playRect = boardCanvas.parentElement.getBoundingClientRect();
    let maxW = playRect.width;
    let maxH = playRect.height;

    if (window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches) {
      if (mobileControls) {
        const controlsRect = mobileControls.getBoundingClientRect();
        maxH = window.innerHeight - controlsRect.height - 120;
      }
    }

    const newSize = Math.min(maxW, maxH);
    boardCanvas.style.width = `${newSize}px`;
    boardCanvas.style.height = `${newSize}px`;
    boardCanvas.width = newSize;
    boardCanvas.height = newSize;
  }

  window.addEventListener('resize', () => resizeCanvas());

  /*----------------------------- Init + Loop -----------------------------*/
  function initGame() {
    snake = [];
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);

    snake.push({ x: startX, y: startY });
    snake.push({ x: startX - 1, y: startY });
    snake.push({ x: startX - 2, y: startY });

    direction = 'ArrowRight';
    nextDirection = 'ArrowRight';

    score = 0;
    level = 1;
    foodsEaten = 0;

    // slider-driven base speed
    baseSpeed = speedInput ? parseInt(speedInput.value, 10) : DEFAULT_BASE_SPEED;
    computeEffectiveSpeed();

    started = false;
    paused = true;
    gameOver = false;

    spawnFood();
    updateStats();
    updateSpeedUI();

    resizeCanvas();
    lastMoveTime = performance.now();

    showOverlay('Ready?', 'start');
  }

  function loop(time) {
    // Always draw so the board looks alive (and mouth animates even when paused)
    drawBoard(time);

    if (!paused && started && !gameOver) {
      const delta = time - lastMoveTime;
      if (delta >= speed) {
        moveSnake();
        lastMoveTime = time;
      }
    }

    requestAnimationFrame(loop);
  }

  // Hook up overlay buttons
  startOverlayBtn?.addEventListener('click', () => startGame());
  playAgainBtn?.addEventListener('click', () => restart());

  // Desktop buttons
  startBtn?.addEventListener('click', () => startGame());
  pauseBtn?.addEventListener('click', () => {
    // if not started yet, start (feels nicer)
    if (!started && !gameOver) startGame();
    else togglePause();
  });
  restartBtn?.addEventListener('click', () => restart());

  // Speed slider
  speedInput?.addEventListener('input', () => {
    baseSpeed = parseInt(speedInput.value, 10);
    updateSpeedUI();
    computeEffectiveSpeed();
    // don't “teleport” timing; just reset move timer so it feels responsive
    lastMoveTime = performance.now();
  });

  attachMobileControls();
  attachGestureControls();

  initGame();
  requestAnimationFrame(loop);
})();
