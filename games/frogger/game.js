/*
 * Frogger Game
 * Pure JavaScript implementation using HTML5 canvas. No external dependencies.
 * Provides keyboard and touch support with polished visual design and smooth animations.
 */

(function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Game configuration
  const NUM_COLS = 12;
  const CELL_SIZE = canvas.width / NUM_COLS;
  const ROW_COUNT = Math.floor(canvas.height / CELL_SIZE);
  const waterRows = [1, 2, 3, 4];
  const roadRows  = [6, 7, 8, 9];
  const safeRows  = [5, 10];
  const finishRow = 0;
  const startRow  = ROW_COUNT - 1;

  // Game state variables
  let logs = [];
  let cars = [];
  let score = 0;
  let lives = 3;
  let playing = false;
  let lastTime = 0;
  let animFrameId = null;
  let level = 1;

  // Frog object (position in pixels and row/col indices)
  let frog = {
    row: startRow,
    col: Math.floor(NUM_COLS / 2),
    x: 0,
    y: 0,
    width: CELL_SIZE,
    height: CELL_SIZE
  };

  // DOM elements
  const startScreen   = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const startButton   = document.getElementById('startButton');
  const restartButton = document.getElementById('restartButton');
  const scoreDisplay  = document.getElementById('scoreDisplay');
  const finalScore    = document.getElementById('finalScore');
  // Touch controls
  const upBtn    = document.getElementById('upButton');
  const downBtn  = document.getElementById('downButton');
  const leftBtn  = document.getElementById('leftButton');
  const rightBtn = document.getElementById('rightButton');

  /**
   * Initialize game by binding event listeners.
   */
  function init() {
    // Position frog at starting location
    resetFrog();
    updateScoreboard();

    // Start/restart buttons
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // Keyboard controls
    window.addEventListener('keydown', handleKeyDown);

    // Touch controls
    upBtn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(0, -1); }, { passive: false });
    downBtn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(0, 1); }, { passive: false });
    leftBtn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(-1, 0); }, { passive: false });
    rightBtn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(1, 0); }, { passive: false });
    // Also handle mouse clicks on controls for desktop testing
    upBtn.addEventListener('mousedown', () => moveFrog(0, -1));
    downBtn.addEventListener('mousedown', () => moveFrog(0, 1));
    leftBtn.addEventListener('mousedown', () => moveFrog(-1, 0));
    rightBtn.addEventListener('mousedown', () => moveFrog(1, 0));

    // Draw initial board
    renderBackground();
    drawFrog();
  }

  /**
   * Start or restart the game. Initializes obstacles and resets state.
   */
  function startGame() {
    // Reset scores and lives only on new game (if starting from start screen or game over)
    score = 0;
    lives = 3;
    level = 1;
    updateScoreboard();
    resetFrog();
    createLogs();
    createCars();
    // Hide overlays
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    playing = true;
    lastTime = performance.now();
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
    }
    animFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Reset frog to starting position.
   */
  function resetFrog() {
    frog.row = startRow;
    frog.col = Math.floor(NUM_COLS / 2);
    frog.x   = frog.col * CELL_SIZE;
    frog.y   = frog.row * CELL_SIZE;
  }

  /**
   * Increase game difficulty by scaling obstacle speeds.
   */
  function increaseDifficulty() {
    level += 1;
    // Increase speeds by 5% each level
    logs.forEach(log => {
      log.speed *= 1.05;
    });
    cars.forEach(car => {
      car.speed *= 1.05;
    });
  }

  /**
   * Create log obstacles for water rows. Each log has a row, position, width and speed.
   */
  function createLogs() {
    logs = [];
    // Row-specific directions: 1 for right, -1 for left
    const directions = {
      1: 1,
      2: -1,
      3: 1,
      4: -1
    };
    // Row-specific speeds in pixels per second
    const speeds = {
      1: 60,
      2: 80,
      3: 70,
      4: 90
    };
    const widthCells = 3;
    waterRows.forEach(row => {
      const count = 3;
      for (let i = 0; i < count; i++) {
        // Starting positions spaced evenly but with random offset
        const base = (i / count) * canvas.width;
        const offset = Math.random() * (canvas.width / count);
        const xPos = (base + offset) % canvas.width;
        logs.push({
          row: row,
          x: xPos,
          width: widthCells * CELL_SIZE,
          speed: speeds[row] * directions[row],
          direction: directions[row]
        });
      }
    });
  }

  /**
   * Create car obstacles for road rows. Each car has a row, position, width and speed.
   */
  function createCars() {
    cars = [];
    const directions = {
      6: -1,
      7: 1,
      8: -1,
      9: 1
    };
    const speeds = {
      6: 100,
      7: 120,
      8: 90,
      9: 140
    };
    const widthCells = 2;
    roadRows.forEach(row => {
      const count = 3;
      for (let i = 0; i < count; i++) {
        const base = (i / count) * canvas.width;
        const offset = Math.random() * (canvas.width / count);
        const xPos = (base + offset) % canvas.width;
        cars.push({
          row: row,
          x: xPos,
          width: widthCells * CELL_SIZE,
          speed: speeds[row] * directions[row],
          direction: directions[row]
        });
      }
    });
  }

  /**
   * Main game loop. Updates and renders the game each frame.
   * @param {DOMHighResTimeStamp} timestamp
   */
  function gameLoop(timestamp) {
    if (!playing) return;
    const dt = (timestamp - lastTime) / 1000; // delta time in seconds
    lastTime = timestamp;
    update(dt);
    render();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  /**
   * Update positions of obstacles and check for collisions.
   * @param {number} dt Delta time in seconds
   */
  function update(dt) {
    // Move logs
    logs.forEach(log => {
      log.x += log.speed * dt;
      const totalWidth = canvas.width + log.width;
      // Wrap around when off screen
      if (log.speed > 0) {
        if (log.x > canvas.width) {
          log.x -= totalWidth;
        }
      } else {
        if (log.x + log.width < 0) {
          log.x += totalWidth;
        }
      }
    });
    // Move cars
    cars.forEach(car => {
      car.x += car.speed * dt;
      const totalWidth = canvas.width + car.width;
      if (car.speed > 0) {
        if (car.x > canvas.width) {
          car.x -= totalWidth;
        }
      } else {
        if (car.x + car.width < 0) {
          car.x += totalWidth;
        }
      }
    });
    // Handle frog interactions
    // If frog is on water row, check if it is on a log
    if (waterRows.includes(frog.row)) {
      let onLog = false;
      for (const log of logs) {
        if (log.row === frog.row) {
          // Check horizontal overlap between frog and log
          if (frog.x + frog.width > log.x && frog.x < log.x + log.width) {
            onLog = true;
            // Move frog with the log
            frog.x += log.speed * dt;
            break;
          }
        }
      }
      if (!onLog) {
        loseLife();
        return;
      } else {
        // Snap frog back to grid column and clamp within bounds
        if (frog.x < 0 || frog.x + frog.width > canvas.width) {
          loseLife();
          return;
        }
        // Align frog to closest column after riding on log
        const newCol = Math.floor((frog.x + CELL_SIZE / 2) / CELL_SIZE);
        frog.col = Math.max(0, Math.min(NUM_COLS - 1, newCol));
        frog.x = frog.col * CELL_SIZE;
      }
    }
    // If frog is on road row, check for car collision
    if (roadRows.includes(frog.row)) {
      for (const car of cars) {
        if (car.row === frog.row) {
          if (frog.x + frog.width > car.x && frog.x < car.x + car.width) {
            loseLife();
            return;
          }
        }
      }
    }
    // Check if frog reached finish row
    if (frog.row === finishRow) {
      score += 1;
      updateScoreboard();
      resetFrog();
      increaseDifficulty();
    }
  }

  /**
   * Lose one life. If no lives remain, end the game.
   */
  function loseLife() {
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      updateScoreboard();
      endGame();
    } else {
      updateScoreboard();
      resetFrog();
    }
  }

  /**
   * End the current game and show the game-over overlay.
   */
  function endGame() {
    playing = false;
    cancelAnimationFrame(animFrameId);
    finalScore.textContent = `Score: ${score}`;
    gameOverScreen.classList.add('active');
  }

  /**
   * Handle keydown events for arrow keys.
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    // Prevent default scrolling behaviour for arrow keys
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    if (!playing) return;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        moveFrog(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        moveFrog(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        moveFrog(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        moveFrog(1, 0);
        break;
    }
  }

  /**
   * Move the frog in grid units.
   * @param {number} dx Horizontal movement (-1, 0, 1)
   * @param {number} dy Vertical movement (-1, 0, 1)
   */
  function moveFrog(dx, dy) {
    const newRow = frog.row + dy;
    const newCol = frog.col + dx;
    // Stay within bounds
    if (newRow < 0 || newRow > startRow) return;
    if (newCol < 0 || newCol >= NUM_COLS) return;
    frog.row = newRow;
    frog.col = newCol;
    frog.x   = frog.col * CELL_SIZE;
    frog.y   = frog.row * CELL_SIZE;
  }

  /**
   * Update the score and lives display.
   */
  function updateScoreboard() {
    scoreDisplay.textContent = `Score: ${score}\u00A0\u00A0Lives: ${lives}`;
  }

  /**
   * Render the entire game: background, obstacles, frog, etc.
   */
  function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw background stripes (rows)
    renderBackground();
    // Draw logs
    logs.forEach(log => {
      drawLog(log);
    });
    // Draw cars
    cars.forEach(car => {
      drawCar(car);
    });
    // Draw frog on top
    drawFrog();
  }

  /**
   * Draw each row with different colours depending on its type.
   */
  function renderBackground() {
    for (let r = 0; r < ROW_COUNT; r++) {
      const y = r * CELL_SIZE;
      // Determine row type
      let color;
      if (r === finishRow) {
        color = '#46331a';
      } else if (waterRows.includes(r)) {
        color = '#0a2e5c';
      } else if (safeRows.includes(r)) {
        color = '#164d26';
      } else if (roadRows.includes(r)) {
        color = '#2a2a2a';
      } else {
        // default for start row (grass)
        color = '#164d26';
      }
      ctx.fillStyle = color;
      ctx.fillRect(0, y, canvas.width, CELL_SIZE);
      // Add subtle horizontal lines for road rows
      if (roadRows.includes(r)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        // dashed mid-lane line
        ctx.setLineDash([10, 15]);
        ctx.beginPath();
        ctx.moveTo(0, y + CELL_SIZE / 2);
        ctx.lineTo(canvas.width, y + CELL_SIZE / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /**
   * Draw a log on the canvas.
   * @param {Object} log
   */
  function drawLog(log) {
    const y = log.row * CELL_SIZE;
    ctx.fillStyle = '#326fa8';
    ctx.fillRect(log.x, y + 5, log.width, CELL_SIZE - 10);
    // Neon glow effect
    ctx.save();
    ctx.shadowColor = '#6cb5e3';
    ctx.shadowBlur = 10;
    ctx.fillRect(log.x, y + 5, log.width, CELL_SIZE - 10);
    ctx.restore();
  }

  /**
   * Draw a car on the canvas.
   * @param {Object} car
   */
  function drawCar(car) {
    const y = car.row * CELL_SIZE;
    // Assign colours per row for variety
    const colors = {
      6: '#b71c1c', // red
      7: '#e65100', // orange
      8: '#fdd835', // yellow
      9: '#ad1457'  // pink
    };
    ctx.fillStyle = colors[car.row] || '#888';
    ctx.fillRect(car.x, y + 8, car.width, CELL_SIZE - 16);
    // Draw wheels
    ctx.fillStyle = '#111';
    const wheelRadius = 6;
    const wheelY1 = y + CELL_SIZE - 10;
    const wheelY2 = y + 10;
    // Four wheels: two front, two back
    ctx.beginPath();
    ctx.arc(car.x + 10, wheelY1, wheelRadius, 0, Math.PI * 2);
    ctx.arc(car.x + car.width - 10, wheelY1, wheelRadius, 0, Math.PI * 2);
    ctx.arc(car.x + 10, wheelY2, wheelRadius, 0, Math.PI * 2);
    ctx.arc(car.x + car.width - 10, wheelY2, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw the frog on the canvas.
   */
  function drawFrog() {
    // Compute margin inside cell for better look
    const margin = 8;
    const x = frog.x + margin / 2;
    const y = frog.y + margin / 2;
    const size = CELL_SIZE - margin;
    // Frog body
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 6);
    ctx.fill();
    // Frog eyes
    ctx.fillStyle = '#fff';
    const eyeRadius = size * 0.12;
    ctx.beginPath();
    ctx.arc(x + size * 0.25, y + size * 0.25, eyeRadius, 0, Math.PI * 2);
    ctx.arc(x + size * 0.75, y + size * 0.25, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#000';
    const pupilRadius = eyeRadius * 0.5;
    ctx.beginPath();
    ctx.arc(x + size * 0.25, y + size * 0.25, pupilRadius, 0, Math.PI * 2);
    ctx.arc(x + size * 0.75, y + size * 0.25, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polyfill for roundRect if not supported (added in Canvas 5.2). Use simple rect instead.
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
      this.rect(x, y, width, height);
    };
  }

  // Initialize game when DOM is ready
  window.addEventListener('load', init);
})();