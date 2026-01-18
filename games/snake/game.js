/* /games/snake/game.js */
/*
  Premium Snake Game Logic

  This script implements a modern Snake game using plain JavaScript and
  HTML5 canvas. It supports desktop and mobile input methods, including
  keyboard controls, on‑screen buttons, and swipe gestures. Gameplay
  features include:

  - 20×20 square grid on which the snake moves
  - Continuous movement at a controllable speed; speed increases with level
  - Randomly spawned food that grows the snake and increases the score
  - Level progression every few foods eaten, decreasing the movement
    interval to make the game more challenging
  - Pause/resume and restart functionality
  - Responsive interface with neon/glassmorphic styling to match the
    accompanying Tetris game

  Accessibility notes:
  - The main canvas is focusable via tabindex to enable keyboard play
  - On‑screen buttons have aria‑labels for screen readers
  - Animations respect the user’s prefers‑reduced‑motion setting by
    reducing visual effects where appropriate
*/

(function() {
  'use strict';

  /*----------------------------- Constants -----------------------------*/
  const COLS = 20;
  const ROWS = 20;
  const INITIAL_SPEED = 200;        // milliseconds per move at level 1
  const SPEED_DECREMENT = 10;       // ms faster per level
  const FOODS_PER_LEVEL = 5;        // foods to level up
  const MAX_SPEED = 60;             // minimum interval cap
  // Colors for snake and food (vertical gradients)
  const SNAKE_COLOR = { start: '#5aff72', end: '#32b84a' }; // green hues
  const FOOD_COLOR  = { start: '#ff6b6b', end: '#c91e42' }; // red hues
  // Opposite directions to prevent reversing
  const OPPOSITES = {
    ArrowUp: 'ArrowDown',
    ArrowDown: 'ArrowUp',
    ArrowLeft: 'ArrowRight',
    ArrowRight: 'ArrowLeft'
  };

  /*----------------------------- State variables -----------------------------*/
  let snake = [];
  let direction = 'ArrowRight';
  let nextDirection = 'ArrowRight';
  let food = { x: 0, y: 0 };
  let score = 0;
  let level = 1;
  let foodsEaten = 0;
  let highScore = 0;
  let speed = INITIAL_SPEED;
  let lastMoveTime = 0;
  let paused = false;
  let gameOver = false;

  /*----------------------------- DOM Elements -----------------------------*/
  const boardCanvas = document.getElementById('board');
  const scoreSpan = document.getElementById('score');
  const levelSpan = document.getElementById('level');
  const lengthSpan = document.getElementById('length');
  const highScoreSpan = document.getElementById('high-score');
  const overlay = document.getElementById('overlay');
  const messageElem = document.getElementById('message');
  const playAgainBtn = document.getElementById('play-again');
  const mobileControls = document.getElementById('mobile-controls');
  // Mobile control buttons
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');

  /*----------------------------- Utility functions -----------------------------*/
  // Generate a random integer between 0 and max-1 inclusive
  function rand(max) {
    return Math.floor(Math.random() * max);
  }

  // Place food on a random empty cell
  function spawnFood() {
    let fx, fy;
    do {
      fx = rand(COLS);
      fy = rand(ROWS);
    } while (snake.some(seg => seg.x === fx && seg.y === fy));
    food.x = fx;
    food.y = fy;
  }

  // Reset and start a new game
  function initGame() {
    snake = [];
    // Start with length 3 in the center moving right
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
    speed = INITIAL_SPEED;
    lastMoveTime = performance.now();
    paused = false;
    gameOver = false;
    spawnFood();
    updateStats();
    hideOverlay();
    resizeCanvas();
    requestAnimationFrame(loop);
  }

  // Update scoreboard and length
  function updateStats() {
    scoreSpan.textContent = score.toString();
    levelSpan.textContent = level.toString();
    lengthSpan.textContent = snake.length.toString();
    if (score > highScore) {
      highScore = score;
    }
    highScoreSpan.textContent = highScore.toString();
  }

  // Show overlay with message; append stats if game over
  function showOverlay(msg) {
    overlay.classList.remove('hidden');
    // Decide whether to show the play again button. When paused, hide it; when game over, show.
    playAgainBtn.style.display = gameOver ? '' : 'none';
    // Clear any previous details appended
    messageElem.innerHTML = '';
    messageElem.textContent = msg;
    if (gameOver) {
      const details = document.createElement('div');
      details.style.fontSize = '1rem';
      details.style.marginTop = '0.5rem';
      details.innerHTML = `Score: ${score}<br>Length: ${snake.length}<br>Level: ${level}`;
      // Replace content of messageElem and append details
      messageElem.textContent = msg;
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
      lastMoveTime = performance.now();
    }
  }

  // Restart game
  function restart() {
    initGame();
  }

  // Change direction if not opposite
  function changeDirection(dir) {
    if (OPPOSITES[direction] === dir) return; // prevent immediate reversal
    nextDirection = dir;
  }

  /*----------------------------- Drawing functions -----------------------------*/
  function drawBoard() {
    const ctx = boardCanvas.getContext('2d');
    const width = boardCanvas.clientWidth;
    const height = boardCanvas.clientHeight;
    const cellSize = width / COLS;
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    // Draw grid lines
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
    // Draw food
    drawCell(ctx, food.x, food.y, cellSize, FOOD_COLOR);
    // Draw snake segments (head first)
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      drawCell(ctx, seg.x, seg.y, cellSize, SNAKE_COLOR, i);
    }
  }

  // Draw a single cell at board coordinate (x,y) with gradient; for snake, lighten tail
  function drawCell(ctx, x, y, cellSize, color, index) {
    if (x < 0 || y < 0) return;
    const px = x * cellSize;
    const py = y * cellSize;
    // Create gradient
    const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
    let startColor = color.start;
    let endColor = color.end;
    // If drawing snake tail, lighten color based on index (optional)
    if (index !== undefined) {
      const factor = index / (snake.length - 1 || 1);
      startColor = lighten(color.start, factor * 0.4);
      endColor = lighten(color.end, factor * 0.4);
    }
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    ctx.save();
    ctx.fillStyle = gradient;
    // Glow effect
    ctx.shadowColor = color.end + '88';
    ctx.shadowBlur = 8;
    ctx.fillRect(px, py, cellSize, cellSize);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeRect(px, py, cellSize, cellSize);
    ctx.restore();
  }

  // Lighten a hex color by a percentage (0 to 1)
  function lighten(hex, amount) {
    // Remove # if present
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

  /*----------------------------- Game logic -----------------------------*/
  // Move snake one step according to direction and handle collisions
  function moveSnake() {
    // Update direction to nextDirection (set by input)
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
    // Wall collision
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
      gameOver = true;
      showOverlay('Game Over');
      return;
    }
    // Self collision: check if new head collides with any segment
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      if (seg.x === newX && seg.y === newY) {
        gameOver = true;
        showOverlay('Game Over');
        return;
      }
    }
    // Add new head
    snake.unshift({ x: newX, y: newY });
    // Check if eating food
    if (newX === food.x && newY === food.y) {
      score += 10;
      foodsEaten++;
      // Level up after certain foods eaten
      if (foodsEaten % FOODS_PER_LEVEL === 0) {
        level++;
        // Increase speed by decreasing interval
        speed = Math.max(MAX_SPEED, INITIAL_SPEED - SPEED_DECREMENT * (level - 1));
      }
      spawnFood();
    } else {
      // Remove tail
      snake.pop();
    }
    updateStats();
  }

  /*----------------------------- Input handling -----------------------------*/
  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (gameOver) {
      if (e.key.toLowerCase() === 'r') restart();
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

  // Mobile control buttons
  function attachMobileControls() {
    if (!mobileControls) return;
    // Movement buttons: set direction on click
    btnUp?.addEventListener('click', () => changeDirection('ArrowUp'));
    btnDown?.addEventListener('click', () => changeDirection('ArrowDown'));
    btnLeft?.addEventListener('click', () => changeDirection('ArrowLeft'));
    btnRight?.addEventListener('click', () => changeDirection('ArrowRight'));
    btnPause?.addEventListener('click', () => togglePause());
    btnRestart?.addEventListener('click', () => restart());
  }

  // Swipe gestures on the board
  function attachGestureControls() {
    let startX = 0;
    let startY = 0;
    let gestureActive = false;
    let moved = false;
    const threshold = 20;
    function pointerDown(ev) {
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
        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
          // horizontal swipe
          if (dx > 0) changeDirection('ArrowRight');
          else changeDirection('ArrowLeft');
        } else {
          // vertical swipe
          if (dy > 0) changeDirection('ArrowDown');
          else changeDirection('ArrowUp');
        }
      }
    }
    function pointerUp(ev) {
      if (!gestureActive) return;
      boardCanvas.releasePointerCapture(ev.pointerId);
      // If the swipe was too small to be a move, treat as tap to pause/resume
      if (!moved && !gameOver) {
        togglePause();
      }
      gestureActive = false;
    }
    boardCanvas.addEventListener('pointerdown', pointerDown);
    boardCanvas.addEventListener('pointermove', pointerMove);
    boardCanvas.addEventListener('pointerup', pointerUp);
    boardCanvas.addEventListener('pointercancel', pointerUp);
  }

  /*----------------------------- Resize handling -----------------------------*/
  function resizeCanvas() {
    // Maintain square aspect ratio for the board
    const playRect = boardCanvas.parentElement.getBoundingClientRect();
    let maxW = playRect.width;
    let maxH = playRect.height;
    // On mobile, leave room for controls
    if (window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches) {
      const controlsRect = mobileControls.getBoundingClientRect();
      maxH = window.innerHeight - controlsRect.height - 120;
    }
    // Determine new dimension based on square ratio
    let newSize = Math.min(maxW, maxH);
    // Set styles
    boardCanvas.style.width = `${newSize}px`;
    boardCanvas.style.height = `${newSize}px`;
    // Set intrinsic size for crisp rendering
    boardCanvas.width = newSize;
    boardCanvas.height = newSize;
    // Redraw board after resize
    drawBoard();
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  /*----------------------------- Main loop -----------------------------*/
  function loop(time) {
    const delta = time - lastMoveTime;
    if (!paused && !gameOver) {
      if (delta >= speed) {
        moveSnake();
        lastMoveTime = time;
      }
      drawBoard();
    } else {
      // Still draw board to keep grid crisp when paused/game over
      drawBoard();
    }
    requestAnimationFrame(loop);
  }

  // Bind Play Again button
  playAgainBtn.addEventListener('click', () => restart());

  // Initialize controls and start the game
  attachMobileControls();
  attachGestureControls();
  resizeCanvas();
  initGame();
})();
