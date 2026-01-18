<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Modern Tetris</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Inter is a versatile sans‑serif typeface with excellent readability. -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <!-- Animated background container -->
  <div class="background">
    <div class="bg-gradient"></div>
    <div class="bg-overlay"></div>
  </div>

  <header class="top-bar glass">
    <h1 class="title">Modern Tetris</h1>
    <div class="controls">
      <button id="restartBtn" class="btn">Restart</button>
      <button id="pauseBtn" class="btn">Pause</button>
      <button id="soundBtn" class="btn">Sound: On</button>
    </div>
  </header>

  <main class="container">
    <!-- Tetris game canvas -->
    <canvas id="tetris" width="320" height="640" aria-label="Tetris board"></canvas>
    <!-- Sidebar containing the score and next piece -->
    <aside class="sidebar glass">
      <section class="scoreboard">
        <div class="score-row"><span>Score</span><b id="score">0</b></div>
        <div class="score-row"><span>Lines</span><b id="lines">0</b></div>
        <div class="score-row"><span>Level</span><b id="level">1</b></div>
      </section>
      <section class="next-section">
        <h2 class="next-title">Next</h2>
        <canvas id="next" width="128" height="128" aria-label="Next piece preview"></canvas>
      </section>
    </aside>
  </main>

  <div class="overlay hidden" id="overlay">
    <div class="overlay-content glass">
      <h2 id="overlayTitle">Game Over</h2>
      <p id="overlaySubtitle">Press restart to play again</p>
    </div>
  </div>

  <script src="game.js"></script>
</body>
</html>
