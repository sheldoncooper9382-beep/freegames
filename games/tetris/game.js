/* /games/tetris/game.js */
/*
  Premium Tetris Game Logic

  This script implements a modern Tetris game using vanilla JavaScript
  and HTML5 canvas. It supports both desktop and mobile control schemes.
  Gameplay features include:

  - 10×20 board with the seven standard tetrominoes
  - Fair 7‑bag randomizer
  - Hold piece (press C or tap H)
  - Ghost piece showing where a tetromino will land
  - Hard drop (Space or ⇓ button) and soft drop (Down arrow or ↓ button)
  - Smooth left/right movement with DAS/ARR feel
  - Clockwise rotation (Up arrow/↻), counter‑clockwise rotation (Z/↺)
  - Pause (P/⏸) and restart (R/⟲) controls
  - Scoring system with level and line count; speed increases every 10 lines
  - On‑screen mobile controls and swipe/tap gestures for move/drop/rotate
  - Glassmorphic UI with neon gradients and animations

  Accessibility notes:
  - Buttons have aria‑labels
  - The board canvas is focusable via tabindex to allow keyboard control
  - Animations are disabled or reduced when prefers‑reduced‑motion is enabled
*/

(function() {
  'use strict';

  /*----------------------------- Constants -----------------------------*/
  const COLS = 10;
  const ROWS = 20;
  const LEVEL_LINES = 10; // lines per level
  const DAS = 150;       // ms delay before auto repeating movement
  const ARR = 50;        // ms interval between repeated movement

  // Tetromino definitions: Each piece has up to 4 rotation states
  // 1s represent blocks; 0s represent empty space
  const PIECES = [
    // I piece
    [
      [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
      ],
      [
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0]
      ],
      [
        [0,0,0,0],
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0]
      ],
      [
        [0,1,0,0],
        [0,1,0,0],
        [0,1,0,0],
        [0,1,0,0]
      ]
    ],
    // J piece
    [
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
    // L piece
    [
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
    ],
    // O piece (square)
    [
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0]
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0]
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0]
      ],
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0]
      ]
    ],
    // S piece
    [
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
    // Z piece
    [
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
    // T piece
    [
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
    ]
  ];

  // Color gradients for each tetromino (start and end colors). These will
  // be converted into canvas gradients when drawing.
  const COLORS = [
    { start: '#64e9ff', end: '#2c99ff' }, // I – cyan to blue
    { start: '#6975e8', end: '#3b50d4' }, // J – indigo
    { start: '#f9b26e', end: '#e57d2d' }, // L – orange
    { start: '#f5df4d', end: '#f5c92d' }, // O – yellow
    { start: '#5aff72', end: '#32b84a' }, // S – green
    { start: '#ff6b6b', end: '#c91e42' }, // Z – red
    { start: '#c175ff', end: '#8b45c7' }  // T – purple
  ];

  // Score values for line clears (per level multiplier)
  const SCORE_TABLE = {
    1: 100,
    2: 300,
    3: 500,
    4: 800
  };

  // Kick offsets for simple wall kicks: try these offsets when rotation collides.
  // The order matters: it tries original position first, then ±1, ±2.
  const KICK_TESTS = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -2, y: 0 }
  ];

  /*----------------------------- State variables -----------------------------*/
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
  let clearing = null; // { lines: [row indices], progress: 0..1 }
  let pendingSpawn = false; // spawn new piece after line clear

  // Movement state (DAS/ARR)
  const pressed = { left: false, right: false, down: false };
  const moveTimers = { left: 0, right: 0 };
  let softDropScoreBuffer = 0;

  /*----------------------------- DOM Elements -----------------------------*/
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
  // Buttons for mobile controls
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnSoft = document.getElementById('btn-soft');
  const btnHard = document.getElementById('btn-hard');
  const btnRotateCW = document.getElementById('btn-rotate-cw');
  const btnRotateCCW = document.getElementById('btn-rotate-ccw');
  const btnHold = document.getElementById('btn-hold');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');

  /*----------------------------- Utility functions -----------------------------*/
  // Shuffle an array (Fisher–Yates)
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Generate a new shuffled bag of tetromino indices
  function refillBag() {
    bag = shuffle([0, 1, 2, 3, 4, 5, 6]);
  }

  // Compute the drop interval (gravity speed) based on current level
  function computeDropInterval() {
    // Each level up makes the game ~75ms faster, down to a minimum of 100ms
    return Math.max(100, 1000 - (level - 1) * 75);
  }

  // Initialize the game state
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
    // Fill next queue with at least 5 upcoming pieces
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
    // Spawn initial piece
    spawnPiece();
    updateStats();
    updateHoldCanvas();
    updateNextCanvas();
    hideOverlay();
    requestAnimationFrame(loop);
  }

  // Spawn a new piece from the queue into currentPiece
  function spawnPiece() {
    // Get next type; maintain queue length
    if (nextQueue.length < 5) {
      nextQueue.push(bag.pop());
      if (bag.length === 0) refillBag();
    }
    const type = nextQueue.shift();
    currentPiece = {
      type: type,
      rotation: 0,
      x: Math.floor((COLS - PIECES[type][0][0].length) / 2),
      y: -1 // start above the board to allow entry
    };
    holdUsed = false;
    updateNextCanvas();
    // Check immediate collision for game over
    if (collides(currentPiece.x, currentPiece.y, currentPiece.rotation)) {
      // Game over condition
      gameOver = true;
      showOverlay('Game Over');
    }
  }

  // Check collision for a piece at a given position and rotation
  function collides(x, y, rotation) {
    const shape = PIECES[currentPiece.type][rotation];
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const boardX = x + col;
          const boardY = y + row;
          // Check walls and floor
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
            return true;
          }
          // Check if below top and hitting an occupied cell
          if (boardY >= 0 && board[boardY][boardX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Move piece by dx, dy; returns true if moved, false if collision
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

  // Rotate the current piece clockwise (cw=true) or counter‑clockwise (cw=false)
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

  // Lock current piece into the board and handle line clears
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
    // Check for line clears
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
      // Start clear animation
      clearing = { lines: lines, progress: 0 };
      pendingSpawn = true;
    } else {
      spawnPiece();
    }
  }

  // Perform hard drop: drop piece instantly to the lowest possible position
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

  // Update statistics display
  function updateStats() {
    scoreSpan.textContent = score.toString();
    levelSpan.textContent = level.toString();
    linesSpan.textContent = linesCleared.toString();
  }

  // Draw a tetromino piece onto a canvas context at a given offset
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

  // Draw a single cell at board coordinate (x, y)
  function drawCell(ctx, type, x, y, cellSize, ghost) {
    // Skip if outside visible area
    if (y < 0) return;
    const px = x * cellSize;
    const py = y * cellSize;
    // Create gradient per cell (vertical gradient)
    const gradient = ctx.createLinearGradient(0, py, 0, py + cellSize);
    const col = COLORS[type];
    gradient.addColorStop(0, col.start);
    gradient.addColorStop(1, col.end);
    ctx.save();
    if (ghost) {
      ctx.globalAlpha = 0.25;
    }
    ctx.fillStyle = gradient;
    // Glow effect via shadow
    ctx.shadowColor = col.end + '88';
    ctx.shadowBlur = ghost ? 5 : 10;
    ctx.fillRect(px, py, cellSize, cellSize);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeRect(px, py, cellSize, cellSize);
    ctx.restore();
  }

  // Draw the entire game board and active piece
  function drawBoard() {
    const ctx = boardCanvas.getContext('2d');
    const width = boardCanvas.clientWidth;
    const height = boardCanvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const cellSize = width / COLS;
    // Draw background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, ROWS * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(COLS * cellSize, y * cellSize);
      ctx.stroke();
    }
    // Draw locked blocks
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const type = board[row][col];
        if (type !== null) {
          drawCell(ctx, type, col, row, cellSize, false);
        }
      }
    }
    // Draw ghost piece
    if (currentPiece && !clearing) {
      let ghostY = currentPiece.y;
      while (!collides(currentPiece.x, ghostY + 1, currentPiece.rotation)) {
        ghostY++;
      }
      drawTetromino(ctx, currentPiece.type, currentPiece.rotation, currentPiece.x, ghostY, cellSize, true);
      // Draw current piece
      drawTetromino(ctx, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y, cellSize, false);
    }
    // Line clear animation
    if (clearing) {
      const { lines, progress } = clearing;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.4 - 0.4 * progress) + ')';
      for (const y of lines) {
        ctx.fillRect(0, y * cellSize, COLS * cellSize, cellSize);
      }
    }
  }

  // Draw hold piece
  function updateHoldCanvas() {
    const ctx = holdCanvas.getContext('2d');
    const cw = holdCanvas.clientWidth;
    const ch = holdCanvas.clientHeight;
    ctx.clearRect(0, 0, cw, ch);
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

  // Draw next pieces stack
  function updateNextCanvas() {
    const ctx = nextCanvas.getContext('2d');
    const cw = nextCanvas.clientWidth;
    const ch = nextCanvas.clientHeight;
    ctx.clearRect(0, 0, cw, ch);
    const maxPieces = Math.min(nextQueue.length, 5);
    const cellSize = cw / 4;
    for (let i = 0; i < maxPieces; i++) {
      const type = nextQueue[i];
      const shape = PIECES[type][0];
      const offsetX = (4 - shape[0].length) / 2;
      const offsetY = (3 * i) + (1 - shape.length) / 2; // vertical spacing (3 rows per piece)
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            drawCell(ctx, type, col + offsetX, row + offsetY, cellSize, false);
          }
        }
      }
    }
  }

  // Show overlay with a message
  function showOverlay(msg) {
    overlay.classList.remove('hidden');
    messageElem.textContent = msg;
    if (gameOver) {
      // Append final score and stats
      const details = document.createElement('div');
      details.style.fontSize = '1rem';
      details.style.marginTop = '0.5rem';
      details.innerHTML = `Score: ${score}<br>Lines: ${linesCleared}<br>Level: ${level}`;
      // Remove previous details if any
      messageElem.innerHTML = msg;
      messageElem.appendChild(details);
    }
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // Toggle pause state
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

  // Restart the game
  function restart() {
    initGame();
  }

  /*----------------------------- Input handling -----------------------------*/
  // Keyboard events
  document.addEventListener('keydown', (e) => {
    if (e.repeat) {
      // Avoid auto repeat of key events; continuous movement handled manually
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

  // Hold piece
  function doHold() {
    if (!currentPiece || holdUsed || paused || gameOver || clearing) return;
    const prevHold = holdPiece;
    holdPiece = currentPiece.type;
    updateHoldCanvas();
    if (prevHold === null) {
      // No previously held piece: spawn new piece from queue
      spawnPiece();
    } else {
      // Swap with hold
      currentPiece = {
        type: prevHold,
        rotation: 0,
        x: Math.floor((COLS - PIECES[prevHold][0][0].length) / 2),
        y: -1
      };
      // Check spawn collision
      if (collides(currentPiece.x, currentPiece.y, 0)) {
        gameOver = true;
        showOverlay('Game Over');
      }
    }
    holdUsed = true;
  }

  /* Mobile controls: attach event listeners for buttons */
  function attachMobileControls() {
    if (!mobileControls) return;
    // Generic helper: on start, set pressed flag; on end, clear
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
    // Soft drop button: move down repeatedly while held
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
    // Rotate CW
    btnRotateCW.addEventListener('click', () => rotatePiece(true));
    // Rotate CCW
    btnRotateCCW.addEventListener('click', () => rotatePiece(false));
    // Hard drop
    btnHard.addEventListener('click', () => hardDrop());
    // Hold
    btnHold.addEventListener('click', () => doHold());
    // Pause
    btnPause.addEventListener('click', () => togglePause());
    // Restart
    btnRestart.addEventListener('click', () => restart());
  }

  /* Swipe and tap gestures on the main board */
  function attachGestureControls() {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startTime = 0;
    let moved = false;
    let longPressTimer = null;
    let gestureActive = false;

    function pointerDown(ev) {
      if (gameOver || paused) return;
      gestureActive = true;
      moved = false;
      startX = lastX = ev.clientX;
      startY = lastY = ev.clientY;
      startTime = performance.now();
      // Set up long press for hard drop
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
      // Cancel long press if movement crosses threshold
      if (!moved && (absDX > threshold || absDY > threshold)) {
        moved = true;
        clearTimeout(longPressTimer);
      }
      // Horizontal movement
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
      }
      // Vertical movement (soft drop)
      else if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          // Soft drop once per threshold
          if (movePiece(0, 1)) {
            score += 1;
            softDropScoreBuffer++;
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
        // Tap -> rotate clockwise
        rotatePiece(true);
      }
      gestureActive = false;
    }
    boardCanvas.addEventListener('pointerdown', pointerDown);
    boardCanvas.addEventListener('pointermove', pointerMove);
    boardCanvas.addEventListener('pointerup', pointerUp);
    boardCanvas.addEventListener('pointercancel', pointerUp);
  }

  // Resize canvases to maintain aspect ratio and responsiveness
  function resizeCanvases() {
    // Board: maintain COLS×ROWS aspect ratio inside play area
    const playRect = boardCanvas.parentElement.getBoundingClientRect();
    let maxW = playRect.width;
    let maxH = playRect.height;
    // If we are on mobile controls, leave space at bottom for controls
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
    // Set canvas intrinsic size to match CSS size for crisp rendering
    boardCanvas.width = newW;
    boardCanvas.height = newH;
    // Hold canvas: square
    const holdParentWidth = holdCanvas.parentElement.clientWidth;
    holdCanvas.style.width = `${holdParentWidth}px`;
    holdCanvas.style.height = `${holdParentWidth}px`;
    holdCanvas.width = holdParentWidth;
    holdCanvas.height = holdParentWidth;
    // Next canvas: maintain 4 cols and 5 pieces * 3 rows (approx) but limit height
    const nextParentWidth = nextCanvas.parentElement.clientWidth;
    const nextHeight = nextParentWidth * 4; // reduce height so stats remain visible
    nextCanvas.style.width = `${nextParentWidth}px`;
    nextCanvas.style.height = `${nextHeight}px`;
    nextCanvas.width = nextParentWidth;
    nextCanvas.height = nextHeight;
    // After resizing canvases, update drawings
    updateHoldCanvas();
    updateNextCanvas();
  }

  window.addEventListener('resize', () => {
    resizeCanvases();
    drawBoard();
  });

  // Main game loop
  function loop(time) {
    const delta = time - lastTime;
    lastTime = time;
    if (!paused && !gameOver) {
      // Handle line clear animation
      if (clearing) {
        clearing.progress += delta / 300; // animation duration 300ms
        if (clearing.progress >= 1) {
          // Remove lines
          const lines = clearing.lines;
          lines.sort((a,b) => a - b);
          for (const idx of lines) {
            board.splice(idx, 1);
            board.unshift(new Array(COLS).fill(null));
          }
          // Update stats
          const cleared = lines.length;
          linesCleared += cleared;
          // Score
          score += (SCORE_TABLE[cleared] || 0) * level;
          // Level up
          const newLevel = Math.floor(linesCleared / LEVEL_LINES) + 1;
          if (newLevel > level) {
            level = newLevel;
            dropInterval = computeDropInterval();
          }
          updateStats();
          clearing = null;
          // Spawn new piece if pending
          if (pendingSpawn) {
            pendingSpawn = false;
            spawnPiece();
          }
        }
      } else {
        // Regular movement and gravity
        // Horizontal movement with DAS/ARR
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
        // Soft drop (manual down) takes priority over gravity
        if (pressed.down) {
          if (movePiece(0, 1)) {
            score += 1;
            updateStats();
          } else {
            lockPiece();
          }
          dropAccumulator = 0; // reset gravity timer when manually dropping
        } else {
          // Gravity
          dropAccumulator += delta;
          while (dropAccumulator >= dropInterval) {
            if (!movePiece(0, 1)) {
              lockPiece();
            }
            dropAccumulator -= dropInterval;
          }
        }
      }
      // Redraw board
      drawBoard();
    }
    requestAnimationFrame(loop);
  }

  // Event for Play Again button
  playAgainBtn.addEventListener('click', () => {
    restart();
  });

  // Initialize controls and start game
  attachMobileControls();
  attachGestureControls();
  resizeCanvases();
  initGame();
})();
