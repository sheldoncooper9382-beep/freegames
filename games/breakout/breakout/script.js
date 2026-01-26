/*
 * Modern Breakout Game
 *
 * This script implements the classic brick‑breaking arcade game with a modern twist.
 * It draws the game on an HTML5 canvas, handles input via keyboard and mouse,
 * manages game state (start, playing, game over), and adds subtle effects like
 * glowing bricks and ball trails. The design is responsive and plays well on
 * desktop and mobile browsers.
 */

// Wait for DOM content to load before initializing the game
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const startButton = document.getElementById('startButton');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const restartButton = document.getElementById('restartButton');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const finalScore = document.getElementById('finalScore');
  const scoreDisplay = document.getElementById('score');
  const livesDisplay = document.getElementById('lives');

  // Canvas dimensions
  let width = canvas.width;
  let height = canvas.height;

  // Game parameters
  const brickRowCount = 5;
  const brickColumnCount = 10;
  const brickPadding = 10;
  const brickOffsetTop = 50;
  const brickOffsetLeft = 30;
  const brickWidth = (width - 2 * brickOffsetLeft - (brickColumnCount - 1) * brickPadding) / brickColumnCount;
  const brickHeight = 20;

  let bricks = [];
  let score = 0;
  let lives = 3;

  // Paddle settings
  const paddleHeight = 15;
  const paddleWidth = 100;
  let paddleX = (width - paddleWidth) / 2;
  let paddleDX = 7;
  let rightPressed = false;
  let leftPressed = false;

  // Ball settings
  let ballRadius = 10;
  let ballX;
  let ballY;
  let ballDX;
  let ballDY;
  // History of ball positions for trail effect
  const trailHistory = [];
  const trailLength = 8;

  // Brick colors (one per row for variety)
  const brickColors = [
    '#ff5c5c', // redish
    '#ffb74d', // orange
    '#ffd54f', // yellow
    '#4dd0e1', // turquoise
    '#9575cd'  // purple
  ];

  // Audio context for simple sound effects
  let audioCtx;

  function playBeep(frequency, duration = 0.05) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (err) {
      // In case AudioContext cannot be initialized (e.g., user gesture required)
    }
  }

  // Resize handler to keep canvas responsive
  function handleResize() {
    // Maintain aspect ratio (4:3) if container width changes
    const container = document.getElementById('gameContainer');
    const containerWidth = container.clientWidth;
    width = containerWidth;
    height = containerWidth * 0.75; // 4:3 ratio
    canvas.width = width;
    canvas.height = height;

    // Recalculate brick width and paddle position based on new dimensions
    // Compute new brickWidth based on width
    // Keep brick count constant but adjust sizes accordingly
    // (brickWidth computed at start won't update; so we recalc here)
    const totalPaddingX = brickPadding * (brickColumnCount - 1);
    const totalOffsetX = brickOffsetLeft * 2;
    const newBrickWidth = (width - totalOffsetX - totalPaddingX) / brickColumnCount;
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        // compute new positions only if brick still active
        b.width = newBrickWidth;
        b.height = brickHeight;
        b.x = brickOffsetLeft + c * (newBrickWidth + brickPadding);
        b.y = brickOffsetTop + r * (brickHeight + brickPadding);
      }
    }
    // Adjust paddle position
    paddleX = Math.min(paddleX, width - paddleWidth);
  }

  // Initialize bricks array
  function initBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        const x = brickOffsetLeft + c * (brickWidth + brickPadding);
        const y = brickOffsetTop + r * (brickHeight + brickPadding);
        bricks[c][r] = { x, y, width: brickWidth, height: brickHeight, status: 1 };
      }
    }
  }

  // Initialize ball and paddle positions
  function initBallAndPaddle() {
    ballX = width / 2;
    ballY = height - paddleHeight - ballRadius - 10;
    // Randomize starting direction slightly
    ballDX = 4 * (Math.random() > 0.5 ? 1 : -1);
    ballDY = -4;
    paddleX = (width - paddleWidth) / 2;
    trailHistory.length = 0;
  }

  // Reset game variables
  function resetGame() {
    score = 0;
    lives = 3;
    initBricks();
    initBallAndPaddle();
    updateScoreboard();
  }

  // Draw the bricks
  function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        if (b.status === 1) {
          ctx.save();
          // Create gradient for each brick to give depth
          const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.width, b.y + b.height);
          grad.addColorStop(0, adjustColor(brickColors[r], 0.1));
          grad.addColorStop(1, adjustColor(brickColors[r], -0.1));
          ctx.fillStyle = grad;
          ctx.fillRect(b.x, b.y, b.width, b.height);
          // Add slight glow
          ctx.shadowColor = brickColors[r];
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.fillRect(b.x, b.y, b.width, b.height);
          ctx.restore();
        }
      }
    }
  }

  // Draw paddle
  function drawPaddle() {
    ctx.save();
    // Paddle gradient for a sleek look
    const paddleGrad = ctx.createLinearGradient(paddleX, height - paddleHeight, paddleX + paddleWidth, height);
    paddleGrad.addColorStop(0, '#00bfff');
    paddleGrad.addColorStop(1, '#0088ff');
    ctx.fillStyle = paddleGrad;
    ctx.fillRect(paddleX, height - paddleHeight, paddleWidth, paddleHeight);
    // Add glow effect
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 10;
    ctx.fillRect(paddleX, height - paddleHeight, paddleWidth, paddleHeight);
    ctx.restore();
  }

  // Draw ball with radial gradient and trail
  function drawBall() {
    // Draw trailing circles with decreasing opacity
    for (let i = 0; i < trailHistory.length; i++) {
      const pos = trailHistory[i];
      const opacity = (i + 1) / trailHistory.length;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ballRadius * (1 - i * 0.05), 0, Math.PI * 2);
      // Use a blue tint for the trail to match the ball color
      ctx.fillStyle = `rgba(0, 191, 255, ${opacity * 0.4})`;
      ctx.fill();
    }
    // Draw the main ball
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(ballX, ballY, ballRadius * 0.1, ballX, ballY, ballRadius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#00bfff');
    ctx.fillStyle = gradient;
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }

  // Update scoreboard
  function updateScoreboard() {
    scoreDisplay.textContent = `Score: ${score}`;
    livesDisplay.textContent = `Lives: ${lives}`;
  }

  // Color adjustment helper: lighten or darken a hex color
  function adjustColor(col, amt) {
    // col: hex string '#RRGGBB'; amt: -1 to +1
    const num = parseInt(col.slice(1), 16);
    let r = (num >> 16) + Math.round(255 * amt);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * amt);
    let b = (num & 0x0000ff) + Math.round(255 * amt);
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Handle keyboard input
  function keyDownHandler(e) {
    if (e.code === 'ArrowRight' || e.key === 'Right' || e.key === 'ArrowRight') {
      rightPressed = true;
    } else if (e.code === 'ArrowLeft' || e.key === 'Left' || e.key === 'ArrowLeft') {
      leftPressed = true;
    }
  }
  function keyUpHandler(e) {
    if (e.code === 'ArrowRight' || e.key === 'Right' || e.key === 'ArrowRight') {
      rightPressed = false;
    } else if (e.code === 'ArrowLeft' || e.key === 'Left' || e.key === 'ArrowLeft') {
      leftPressed = false;
    }
  }

  // Mouse move handler to control paddle
  function mouseMoveHandler(e) {
    const rect = canvas.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    if (relativeX > paddleWidth / 2 && relativeX < width - paddleWidth / 2) {
      paddleX = relativeX - paddleWidth / 2;
    }
  }

  // Collision detection between ball and bricks
  function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        if (b.status === 1) {
          if (ballX > b.x && ballX < b.x + b.width && ballY > b.y && ballY < b.y + b.height) {
            ballDY = -ballDY;
            b.status = 0;
            score += 10;
            updateScoreboard();
            // Play a high‑pitched beep when a brick is broken
            playBeep(600, 0.06);
            // Check if all bricks are cleared
            if (score === brickRowCount * brickColumnCount * 10) {
              endGame(true);
            }
          }
        }
      }
    }
  }

  // End game with win or lose
  function endGame(win) {
    cancelAnimationFrame(animationId);
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'flex';
    if (win) {
      gameOverTitle.textContent = 'You Win!';
    } else {
      gameOverTitle.textContent = 'Game Over';
    }
    finalScore.textContent = `Your score: ${score}`;
  }

  let animationId;

  // Main draw function executed for each frame
  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBricks();
    drawBall();
    drawPaddle();
    collisionDetection();

    // Update trail history
    trailHistory.unshift({ x: ballX, y: ballY });
    if (trailHistory.length > trailLength) {
      trailHistory.pop();
    }

    // Bounce off walls
    if (ballX + ballDX > width - ballRadius || ballX + ballDX < ballRadius) {
      ballDX = -ballDX;
    }
    if (ballY + ballDY < ballRadius) {
      ballDY = -ballDY;
    }
    // Bounce off paddle
    if (ballY + ballDY > height - paddleHeight - ballRadius) {
      if (ballX > paddleX && ballX < paddleX + paddleWidth) {
        // Reflect ball depending on where it hits the paddle to give player control
        const hitPoint = (ballX - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
        ballDX = hitPoint * 5; // modify horizontal direction
        ballDY = -Math.abs(ballDY);
        // Play a medium‑pitched beep when paddle hits
        playBeep(350, 0.04);
      } else if (ballY + ballRadius > height) {
        // Ball fell below paddle
        lives--;
        updateScoreboard();
        if (lives === 0) {
          endGame(false);
          return;
        } else {
          // Reset ball and paddle positions
          initBallAndPaddle();
        }
      }
    }

    ballX += ballDX;
    ballY += ballDY;

    // Paddle movement based on keyboard input
    if (rightPressed && paddleX < width - paddleWidth) {
      paddleX += paddleDX;
    }
    if (leftPressed && paddleX > 0) {
      paddleX -= paddleDX;
    }

    animationId = requestAnimationFrame(draw);
  }

  // Start the game
  function startGame() {
    resetGame();
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    initBallAndPaddle();
    draw();
  }

  // Event listeners
  document.addEventListener('keydown', keyDownHandler, false);
  document.addEventListener('keyup', keyUpHandler, false);
  document.addEventListener('mousemove', mouseMoveHandler, false);
  window.addEventListener('resize', handleResize);
  startButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);

  // Initialize bricks and scoreboard on load
  initBricks();
  updateScoreboard();
  handleResize();
});