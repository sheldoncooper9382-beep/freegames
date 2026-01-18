/* /games/tetris/game.js */
(function() {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const LEVEL_LINES = 10;
  const DAS = 150;
  const ARR = 50;

  const PIECES = [
    [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
    ],
    [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]]
    ],
    [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]]
    ],
    [
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]
    ],
    [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]]
    ],
    [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]]
    ],
    [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]]
    ]
  ];

  const COLORS = [
    { start: '#64e9ff', end: '#2c99ff' },
    { start: '#6975e8', end: '#3b50d4' },
    { start: '#f9b26e', end: '#e57d2d' },
    { start: '#f5df4d', end: '#f5c92d' },
    { start: '#5aff72', end: '#32b84a' },
    { start: '#ff6b6b', end: '#c91e42' },
    { start: '#c175ff', end: '#8b45c7' }
  ];

  const SCORE_TABLE = {1:100, 2:300, 3:500, 4:800};
  const KICK_TESTS = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -2, y: 0 }
  ];

  let board;
  let currentPiece = null;
  let bag = [];
  let nextQueue = [];
  let holdPiece = null;
  let holdUsed = false;
  let score = 0;
  let level = 1;
  let linesCleared = 0;
  let dropInterval = 1000;
  let dropAccumulator = 0;
  let lastTime = 0;
  let paused = false;
  let gameOver = false;
  let clearing = null;
  let pendingSpawn = false;

  const pressed = { left: false, right: false, down: false };
  const moveTimers = { left: 0, right: 0 };

  const boardCanvas = document.getElementById('board');
  const holdCanvas = document.getElementById('hold-canvas');
  const nextCanvas = document.getElementById('next-canvas');
  const scoreSpan = document.getElementById('score');
  const levelSpan = document.getElementById('level');
  const linesSpan = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const messageElem = document.getElementById('message');
  const playAgainBtn = document.getElementById('play-again');
  const mobileControls = document.getElementById('mobile-controls');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnSoft = document.getElementById('btn-soft');
  const btnHard = document.getElementById('btn-hard');
  const btnRotateCW = document.getElementById('btn-rotate-cw');
  const btnRotateCCW = document.getElementById('btn-rotate-ccw');
  const btnHold = document.getElementById('btn-hold');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function refillBag() {
    bag = shuffle([0, 1, 2, 3, 4, 5, 6]);
  }

  function computeDropInterval() {
    return Math.max(100, 1000 - (level - 1) * 75);
  }

  function initGame() {
    board = [];
    for (let y = 0; y < ROWS; y++) {
      board[y] = new Array(COLS).fill(null);
    }
    score = 0;
    level = 1;
    linesCleared = 0;
    holdPiece = null;
    holdUsed = false;
    bag = [];
    nextQueue = [];
    refillBag();
    while (nextQueue.length < 5) {
      nextQueue.push(bag.pop());
      if (bag.length === 0) refillBag();
    }
    dropInterval = computeDropInterval();
    dropAccumulator = 0;
    lastTime = performance.now();
    paused = false;
    gameOver = false;
    clearing = null;
    pendingSpawn = false;
    currentPiece = null;
    spawnPiece();
    updateStats();
    updateHoldCanvas();
    updateNextCanvas();
    hideOverlay();
    requestAnimationFrame(loop);
  }

  function spawnPiece() {
    if (nextQueue.length < 5) {
      nextQueue.push(bag.pop());
      if (bag.length === 0) refillBag();
    }
    const type = nextQueue.shift();
    currentPiece = {
      type: type,
      rotation: 0,
      x: Math.floor((COLS - PIECES[type][0][0].length) / 2),
      y: -1
    };
    holdUsed = false;
    updateNextCanvas();
    if (collides(currentPiece.x, currentPiece.y, currentPiece.rotation)) {
      gameOver = true;
      showOverlay('Game Over');
    }
  }

  function collides(x, y, rotation) {
    const shape = PIECES[currentPiece.type][rotation];
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const boardX = x + col;
          const boardY = y + row;
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
            return true;
          }
          if (boardY >= 0 && board[boardY][boardX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function movePiece(dx, dy) {
    if (!currentPiece) return false;
    const newX = currentPiece.x + dx;
    const newY = currentPiece.y + dy;
    if (!collides(newX, newY, currentPiece.rotation)) {
      currentPiece.x = newX;
      currentPiece.y = newY;
      return true;
    }
    return false;
  }

  function rotatePiece(cw) {
    if (!currentPiece) return;
    const oldRotation = currentPiece.rotation;
    const newRotation = (oldRotation + (cw ? 1 : 3)) % 4;
    for (const offset of KICK_TESTS) {
      const newX = currentPiece.x + offset.x;
      const newY = currentPiece.y + offset.y;
      const shape = PIECES[currentPiece.type][newRotation];
      let ok = true;
      for (let row = 0; row < shape.length && ok; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const boardX = newX + col;
            const boardY = newY + row;
            if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
              ok = false; break;
            }
            if (boardY >= 0 && board[boardY][boardX] !== null) {
              ok = false; break;
            }
          }
        }
      }
      if (ok) {
        currentPiece.x = newX;
        currentPiece.y = newY;
        currentPiece.rotation = newRotation;
        return true;
      }
    }
    return false;
  }

  function lockPiece() {
    if (!currentPiece) return;
    const shape = PIECES[currentPiece.type][currentPiece.rotation];
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const boardX = currentPiece.x + col;
          const boardY = currentPiece.y + row;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = currentPiece.type;
          }
        }
      }
    }
    currentPiece = null;
    const lines = [];
    for (let y = 0; y < ROWS; y++) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] === null) {
          full = false;
          break;
        }
      }
      if (full) lines.push(y);
    }
    if (lines.length > 0) {
      clearing = { lines: lines, progress: 0 };
      pendingSpawn = true;
    } else {
      spawnPiece();
    }
  }

  function hardDrop() {
    if (!currentPiece || paused || gameOver || clearing) return;
    let cellsDropped = 0;
    while (movePiece(0, 1)) {
      cellsDropped++;
    }
    score += cellsDropped * 2;
    lockPiece();
    updateStats();
  }

  function updateStats() {
    scoreSpan.textContent = score.toString();
    levelSpan.textContent = level.toString();
    linesSpan.textContent = linesCleared.toString();
  }

  function drawTetromino(ctx, type, rotation, offsetX, offsetY, cellSize, ghost) {
    const shape = PIECES[type][rotation];
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const x = offsetX + col;
          const y = offsetY + row;
          drawCell(ctx, type, x, y, cellSize, ghost);
        }
      }
    }
  }

  function drawCell(ctx, type, x, y, cellSize, ghost) {
    if (y < 0) return;
    const px = x * cellSize;
    const py = y * cellSize;
    const gradient = ctx.createLinearGradient(0, py, 0, py + cellSize);
    const col = COLORS[type];
    gradient.addColorStop(0, col.start);
    gradient.addColorStop(1, col.end);
    ctx.save();
    if (ghost) {
      ctx.globalAlpha = 0.25;
    }
    ctx.fillStyle = gradient;
    ctx.shadowColor = col.end + '88';
    ctx.shadowBlur = ghost ? 5 : 10;
    ctx.fillRect(px, py, cellSize, cellSize);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeRect(px, py, cellSize, cellSize);
    ctx.restore();
  }

  function drawBoard() {
    const ctx = boardCanvas.getContext('2d');
    const width = boardCanvas.clientWidth;
    const cellSize = width / COLS;
    ctx.clearRect(0, 0, width, boardCanvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const boardHeight = cellSize * ROWS;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, boardHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      const yPos = y * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(width, yPos);
      ctx.stroke();
    }
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const type = board[row][col];
        if (type !== null) {
          drawCell(ctx, type, col, row, cellSize, false);
        }
      }
    }
    if (currentPiece && !clearing) {
      let ghostY = currentPiece.y;
      while (!collides(currentPiece.x, ghostY + 1, currentPiece.rotation)) {
        ghostY++;
      }
      const shape = PIECES[currentPiece.type][currentPiece.rotation];
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const gx = currentPiece.x + col;
            const gy = ghostY + row;
            if (gy >= 0 && board[gy][gx] === null) {
              drawCell(ctx, currentPiece.type, gx, gy, cellSize, true);
            }
          }
        }
      }
      drawTetromino(ctx, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y, cellSize, false);
    }
    if (clearing) {
      const { lines, progress } = clearing;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.4 - 0.4 * progress) + ')';
      for (const y of lines) {
        ctx.fillRect(0, y * cellSize, COLS * cellSize, cellSize);
      }
    }
  }

  function updateHoldCanvas() {
    const ctx = holdCanvas.getContext('2d');
    const cw = holdCanvas.clientWidth;
    ctx.clearRect(0, 0, cw, holdCanvas.clientHeight);
    if (holdPiece === null) return;
    const shape = PIECES[holdPiece][0];
    const size = Math.max(shape.length, shape[0].length);
    const cellSize = cw / size;
    const offsetX = (size - shape[0].length) / 2;
    const offsetY = (size - shape.length) / 2;
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          drawCell(ctx, holdPiece, col + offsetX, row + offsetY, cellSize, false);
        }
      }
    }
  }

  function updateNextCanvas() {
    const ctx = nextCanvas.getContext('2d');
    const cw = nextCanvas.clientWidth;
    ctx.clearRect(0, 0, cw, nextCanvas.clientHeight);
    const maxPieces = Math.min(nextQueue.length, 5);
    const cellSize = cw / 4;
    for (let i = 0; i < maxPieces; i++) {
      const type = nextQueue[i];
      const shape = PIECES[type][0];
      const offsetX = (4 - shape[0].length) / 2;
      const offsetY = (3 * i) + (1 - shape.length) / 2;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            drawCell(ctx, type, col + offsetX, row + offsetY, cellSize, false);
          }
        }
      }
    }
  }

  function showOverlay(msg) {
    overlay.classList.remove('hidden');
    messageElem.textContent = msg;
    if (gameOver) {
      const details = document.createElement('div');
      details.style.fontSize = '1rem';
      details.style.marginTop = '0.5rem';
      details.innerHTML = `Score: ${score}<br>Lines: ${linesCleared}<br>Level: ${level}`;
      messageElem.innerHTML = msg;
      messageElem.appendChild(details);
    }
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
      showOverlay('Paused');
    } else {
      hideOverlay();
      lastTime = performance.now();
    }
  }

  function restart() {
    initGame();
  }

  document.addEventListener('keydown', (e) => {
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (gameOver) {
      if (e.key.toLowerCase() === 'r') {
        restart();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowLeft':
        pressed.left = true;
        movePiece(-1, 0);
        moveTimers.left = -DAS;
        break;
      case 'ArrowRight':
        pressed.right = true;
        movePiece(1, 0);
        moveTimers.right = -DAS;
        break;
      case 'ArrowDown':
        pressed.down = true;
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
      case 'ArrowUp':
        rotatePiece(true);
        break;
      case 'z':
      case 'Z':
        rotatePiece(false);
        break;
      case 'c':
      case 'C':
        doHold();
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

  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        pressed.left = false;
        moveTimers.left = 0;
        break;
      case 'ArrowRight':
        pressed.right = false;
        moveTimers.right = 0;
        break;
      case 'ArrowDown':
        pressed.down = false;
        break;
    }
  });

  function doHold() {
    if (!currentPiece || holdUsed || paused || gameOver || clearing) return;
    const prevHold = holdPiece;
    holdPiece = currentPiece.type;
    updateHoldCanvas();
    if (prevHold === null) {
      spawnPiece();
    } else {
      currentPiece = {
        type: prevHold,
        rotation: 0,
        x: Math.floor((COLS - PIECES[prevHold][0][0].length) / 2),
        y: -1
      };
      if (collides(currentPiece.x, currentPiece.y, 0)) {
        gameOver = true;
        showOverlay('Game Over');
      }
    }
    holdUsed = true;
  }

  function attachMobileControls() {
    if (!mobileControls) return;
    function bindPress(btn, prop, dx) {
      btn.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        if (prop) {
          pressed[prop] = true;
          if (dx !== 0) {
            movePiece(dx, 0);
            moveTimers[prop] = -DAS;
          }
        }
      });
      btn.addEventListener('touchend', () => {
        if (prop) {
          pressed[prop] = false;
          moveTimers[prop] = 0;
        }
      });
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        if (prop) {
          pressed[prop] = true;
          if (dx !== 0) {
            movePiece(dx, 0);
            moveTimers[prop] = -DAS;
          }
        }
      });
      btn.addEventListener('mouseup', () => {
        if (prop) {
          pressed[prop] = false;
          moveTimers[prop] = 0;
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (prop) {
          pressed[prop] = false;
          moveTimers[prop] = 0;
        }
      });
    }
    bindPress(btnLeft, 'left', -1);
    bindPress(btnRight, 'right', 1);
    btnSoft.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      pressed.down = true;
    });
    btnSoft.addEventListener('touchend', () => {
      pressed.down = false;
    });
    btnSoft.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      pressed.down = true;
    });
    btnSoft.addEventListener('mouseup', () => {
      pressed.down = false;
    });
    btnSoft.addEventListener('mouseleave', () => {
      pressed.down = false;
    });
    btnRotateCW.addEventListener('click', () => rotatePiece(true));
    btnRotateCCW.addEventListener('click', () => rotatePiece(false));
    btnHard.addEventListener('click', () => hardDrop());
    btnHold.addEventListener('click', () => doHold());
    btnPause.addEventListener('click', () => togglePause());
    btnRestart.addEventListener('click', () => restart());
  }

  function attachGestureControls() {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let moved = false;
    let longPressTimer = null;
    let gestureActive = false;

    function pointerDown(ev) {
      if (gameOver || paused) return;
      gestureActive = true;
      moved = false;
      startX = lastX = ev.clientX;
      startY = lastY = ev.clientY;
      longPressTimer = setTimeout(() => {
        if (gestureActive && !moved) {
          hardDrop();
          gestureActive = false;
        }
      }, 350);
      boardCanvas.setPointerCapture(ev.pointerId);
    }
    function pointerMove(ev) {
      if (!gestureActive) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      const absDX = Math.abs(ev.clientX - startX);
      const absDY = Math.abs(ev.clientY - startY);
      const threshold = 20;
      if (!moved && (absDX > threshold || absDY > threshold)) {
        moved = true;
        clearTimeout(longPressTimer);
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
        if (dx > 0) {
          movePiece(1, 0);
          moveTimers.right = -DAS;
        } else {
          movePiece(-1, 0);
          moveTimers.left = -DAS;
        }
        lastX = ev.clientX;
        lastY = ev.clientY;
      } else if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          if (movePiece(0, 1)) {
            score += 1;
            updateStats();
          } else {
            lockPiece();
          }
        }
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
    }
    function pointerUp(ev) {
      if (!gestureActive) return;
      boardCanvas.releasePointerCapture(ev.pointerId);
      clearTimeout(longPressTimer);
      if (!moved) {
        rotatePiece(true);
      }
      gestureActive = false;
    }
    boardCanvas.addEventListener('pointerdown', pointerDown);
    boardCanvas.addEventListener('pointermove', pointerMove);
    boardCanvas.addEventListener('pointerup', pointerUp);
    boardCanvas.addEventListener('pointercancel', pointerUp);
  }

  function resizeCanvases() {
    const playRect = boardCanvas.parentElement.getBoundingClientRect();
    let maxW = playRect.width;
    let maxH = playRect.height;
    if (window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches) {
      maxH = window.innerHeight - mobileControls.getBoundingClientRect().height - 120;
    }
    const boardRatio = ROWS / COLS;
    let newW = maxW;
    let newH = newW * boardRatio;
    if (newH > maxH) {
      newH = maxH;
      newW = newH / boardRatio;
    }
    boardCanvas.style.width = `${newW}px`;
    boardCanvas.style.height = `${newH}px`;
    boardCanvas.width = newW;
    boardCanvas.height = newH;
    const holdParentWidth = holdCanvas.parentElement.clientWidth;
    holdCanvas.style.width = `${holdParentWidth}px`;
    holdCanvas.style.height = `${holdParentWidth}px`;
    holdCanvas.width = holdParentWidth;
    holdCanvas.height = holdParentWidth;
    const nextParentWidth = nextCanvas.parentElement.clientWidth;
    const nextHeight = nextParentWidth * 4;
    nextCanvas.style.width = `${nextParentWidth}px`;
    nextCanvas.style.height = `${nextHeight}px`;
    nextCanvas.width = nextParentWidth;
    nextCanvas.height = nextHeight;
    updateHoldCanvas();
    updateNextCanvas();
  }

  window.addEventListener('resize', () => {
    resizeCanvases();
    drawBoard();
  });

  function loop(time) {
    const delta = time - lastTime;
    lastTime = time;
    if (!paused && !gameOver) {
      if (clearing) {
        clearing.progress += delta / 300;
        if (clearing.progress >= 1) {
          const lines = clearing.lines;
          lines.sort((a,b) => a - b);
          for (const idx of lines) {
            board.splice(idx, 1);
            board.unshift(new Array(COLS).fill(null));
          }
          const cleared = lines.length;
          linesCleared += cleared;
          score += (SCORE_TABLE[cleared] || 0) * level;
          const newLevel = Math.floor(linesCleared / LEVEL_LINES) + 1;
          if (newLevel > level) {
            level = newLevel;
            dropInterval = computeDropInterval();
          }
          updateStats();
          clearing = null;
          if (pendingSpawn) {
            pendingSpawn = false;
            spawnPiece();
          }
        }
      } else {
        if (pressed.left && !pressed.right) {
          moveTimers.left += delta;
          if (moveTimers.left >= 0) {
            movePiece(-1, 0);
            moveTimers.left -= ARR;
          }
        } else {
          moveTimers.left = 0;
        }
        if (pressed.right && !pressed.left) {
          moveTimers.right += delta;
          if (moveTimers.right >= 0) {
            movePiece(1, 0);
            moveTimers.right -= ARR;
          }
        } else {
          moveTimers.right = 0;
        }
        if (pressed.down) {
          if (movePiece(0, 1)) {
            score += 1;
            updateStats();
          } else {
            lockPiece();
          }
          dropAccumulator = 0;
        } else {
          dropAccumulator += delta;
          while (dropAccumulator >= dropInterval) {
            if (!movePiece(0, 1)) {
              lockPiece();
            }
            dropAccumulator -= dropInterval;
          }
        }
      }
      drawBoard();
    }
    requestAnimationFrame(loop);
  }

  playAgainBtn.addEventListener('click', () => {
    restart();
  });

  attachMobileControls();
  attachGestureControls();
  resizeCanvases();
  initGame();
})();
