// Space Invaders – Ultimate Edition
// This script implements a fully featured modern take on the
// classic 1978 arcade game.  It is written entirely in vanilla
// JavaScript and uses the Canvas API for rendering.  All assets
// (ships, aliens, particles) are drawn procedurally to avoid
// external dependencies.  Sound is generated using the WebAudio
// API so the game remains fully offline.

(() => {
  'use strict';

  /*=============================================================
    Global variables
  =============================================================*/
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let WIDTH, HEIGHT;

  // DOM elements
  const startScreen = document.getElementById('startScreen');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const hud = document.getElementById('hud');
  const crtOverlay = document.getElementById('crtOverlay');
  const touchControls = document.getElementById('touchControls');

  const scoreValueEl = document.getElementById('scoreValue');
  const highScoreValueEl = document.getElementById('highScoreValue');
  const livesValueEl = document.getElementById('livesValue');
  const levelValueEl = document.getElementById('levelValue');

  const finalScoreEl = document.getElementById('finalScore');
  const finalStatsEl = document.getElementById('finalStats');

  // Buttons
  const classicModeBtn = document.getElementById('classicModeBtn');
  const enhancedModeBtn = document.getElementById('enhancedModeBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const restartBtn = document.getElementById('restartBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  // Settings controls
  const volumeSlider = document.getElementById('volumeSlider');
  const speedSlider = document.getElementById('speedSlider');
  const reducedMotionCheckbox = document.getElementById('reducedMotionCheckbox');
  const colorblindCheckbox = document.getElementById('colorblindCheckbox');
  const crtCheckbox = document.getElementById('crtCheckbox');
  // Touch controls
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const fireBtn = document.getElementById('fireBtn');

  // Game state
  let state = 'START'; // 'START', 'PLAY', 'PAUSE', 'GAMEOVER'
  let mode = 'classic'; // 'classic' or 'enhanced'
  let gameSpeed = 1.0;
  let reducedMotion = false;
  let colorblind = false;
  let crtEnabled = false;

  // Player & game stats
  let player;
  let aliens = [];
  let alienCols = 11;
  let alienRows = 5;
  let alienDirection = 1;
  let alienSpeed = 20; // pixels per second, will increase
  let descent = 20; // vertical descent when changing direction
  let bullets = [];
  let enemyBullets = [];
  let shields = [];
  let ufo = null;
  let powerUps = [];
  let particles = [];
  let boss = null;

  let score = 0;
  let highScore = 0;
  let lives = 3;
  let level = 1;
  let nextExtraLifeScore = 2000;
  let aliensRemaining = 0;
  let totalAliensThisWave = 0;
  let nextUFOTimer = 0;

  // Power-up state flags
  const activePowerUps = new Map();

  // Input state
  const keys = {};
  let leftPressed = false;
  let rightPressed = false;
  let firePressed = false;

  // Audio context and sound generator
  let audioCtx = null;
  let masterGain;
  let musicOsc;
  let musicPlaying = false;
  let soundEnabled = true;

  /**
   * Utility: clamp a value between min and max
   */
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  /**
   * Start/resume audio context on first user gesture
   */
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = parseFloat(volumeSlider.value);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  /**
   * Play a short sound with specified frequency, duration and type
   * All tones use the same masterGain node for overall volume control
   */
  function playTone(freq, duration = 0.1, type = 'square') {
    if (!soundEnabled) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.value = 0.15;
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  /**
   * Play explosion noise using a random noise buffer
   */
  function playExplosion() {
    if (!soundEnabled) return;
    initAudio();
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.2;
    noise.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();
  }

  /**
   * Start looping background music.  A simple oscillator is used
   * whose frequency increases as enemies are eliminated.  The
   * oscillator is ramped when a level starts and stops on pause/game over.
   */
  function startMusic() {
    if (!soundEnabled || musicPlaying) return;
    initAudio();
    musicOsc = audioCtx.createOscillator();
    // Use a sawtooth waveform for a more dynamic retro sound
    musicOsc.type = 'sawtooth';
    // Envelope to keep volume low
    const musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.05;
    musicOsc.connect(musicGain);
    musicGain.connect(masterGain);
    musicOsc.start();
    musicPlaying = true;
    updateMusicFrequency();
  }

  /** Stop background music */
  function stopMusic() {
    if (musicOsc) {
      musicOsc.stop();
      musicOsc.disconnect();
      musicOsc = null;
    }
    musicPlaying = false;
  }

  /**
   * Update the frequency of the music oscillator based on how many
   * aliens remain.  As the player progresses the pitch rises.
   */
  function updateMusicFrequency() {
    if (musicOsc) {
      const ratio = aliensRemaining > 0 ? (1 - aliensRemaining / totalAliensThisWave) : 1;
      // Start at a lower base frequency and expand a wider range for a pronounced tempo increase
      const baseFreq = 50;
      const freqRange = 400;
      musicOsc.frequency.setValueAtTime(baseFreq + freqRange * ratio, audioCtx.currentTime);
    }
  }

  /**
   * Game entity classes
   */
  class Player {
    constructor() {
      // Increase player size to make the ship more prominent
      this.width = 60;
      this.height = 30;
      this.x = 0;
      this.y = 0;
      this.speed = 250; // px/sec
      this.cooldown = 0.6; // seconds between shots
      this.doubleShot = false;
      this.cooldownTimer = 0;
    }
    reset() {
      // Maintain size on reset
      this.width = 60;
      this.height = 30;
      this.speed = 250;
      this.cooldown = 0.6;
      this.doubleShot = false;
      this.cooldownTimer = 0;
      this.x = (WIDTH - this.width) / 2;
      this.y = HEIGHT - this.height - 50;
    }
    update(dt) {
      let moveX = 0;
      if (keys['ArrowLeft'] || leftPressed) moveX -= 1;
      if (keys['ArrowRight'] || rightPressed) moveX += 1;
      this.x += moveX * this.speed * dt * gameSpeed;
      this.x = clamp(this.x, 0, WIDTH - this.width);
      this.cooldownTimer -= dt;
      // Fire bullet on space press
      if ((keys[' '] || firePressed) && this.cooldownTimer <= 0) {
        this.shoot();
        this.cooldownTimer = this.cooldown;
      }
    }
    shoot() {
      const bulletW = 4;
      const bulletH = 10;
      const baseX = this.x + this.width / 2 - bulletW / 2;
      const baseY = this.y - bulletH;
      // Primary bullet
      // Laser power-up: wider and taller projectile
      const laserActive = activePowerUps.has('laser');
      const width = laserActive ? 6 : bulletW;
      const height = laserActive ? 16 : bulletH;
      bullets.push(new Bullet(baseX, baseY, width, height, -400, 'player'));
      // Double shot: spawn two additional bullets offset horizontally
      if (this.doubleShot) {
        bullets.push(new Bullet(baseX - 8, baseY, width, height, -400, 'player'));
        bullets.push(new Bullet(baseX + 8, baseY, width, height, -400, 'player'));
      }
      playTone(700, 0.05);
    }
    draw() {
      ctx.save();
      // Draw a more detailed spaceship: nose, wings and body
      ctx.fillStyle = colorblind ? '#ffff66' : '#00ffcc';
      const x0 = this.x;
      const y0 = this.y;
      const w = this.width;
      const h = this.height;
      ctx.beginPath();
      // Nose tip
      ctx.moveTo(x0 + w * 0.5, y0);
      // Right wing tip
      ctx.lineTo(x0 + w, y0 + h * 0.7);
      // Right wing inner
      ctx.lineTo(x0 + w * 0.8, y0 + h * 0.7);
      // Right fuselage base
      ctx.lineTo(x0 + w * 0.8, y0 + h);
      // Left fuselage base
      ctx.lineTo(x0 + w * 0.2, y0 + h);
      // Left wing inner
      ctx.lineTo(x0 + w * 0.2, y0 + h * 0.7);
      // Left wing tip
      ctx.lineTo(x0, y0 + h * 0.7);
      ctx.closePath();
      ctx.fill();
      // Draw cockpit window
      ctx.fillStyle = colorblind ? '#ff00ff' : '#003355';
      ctx.fillRect(x0 + w * 0.4, y0 + h * 0.3, w * 0.2, h * 0.2);
      ctx.restore();
    }
  }

  class Bullet {
    constructor(x, y, w, h, speedY, owner) {
      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
      this.speedY = speedY;
      this.owner = owner; // 'player' or 'alien'
      this.active = true;
    }
    update(dt) {
      this.y += this.speedY * dt * gameSpeed;
      // Remove if offscreen
      if (this.y < -this.height || this.y > HEIGHT + this.height) {
        this.active = false;
      }
    }
    draw() {
      ctx.fillStyle = this.owner === 'player' ? (colorblind ? '#ff0066' : '#00ffff') : '#ff5555';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  class Alien {
    constructor(col, row) {
      this.col = col;
      this.row = row;
      this.alive = true;
      this.elite = false;
      this.shield = 0;
      // Enlarge aliens for more imposing presence
      this.width = 40;
      this.height = 30;
      // assign point values based on row (top low, bottom high)
      this.points = (5 - row) * 10;
      // assign color palette: top rows lighter
      const colorsClassic = ['#00ff66','#00ccff','#ff66cc','#ffcc00','#ff6600'];
      const colorsColorblind = ['#00aeff','#8eff00','#ff00e1','#ffff00','#ff7700'];
      this.baseColor = colorblind ? colorsColorblind[row % colorsColorblind.length] : colorsClassic[row % colorsClassic.length];
      // probability of being elite (in enhanced mode)
      if (mode === 'enhanced' && Math.random() < 0.1) {
        this.elite = true;
        this.shield = 1; // one extra hit
        this.points += 20;
      }
    }
    get x() {
      return this.col * this.width + alienOffsetX;
    }
    get y() {
      return this.row * this.height + alienOffsetY;
    }
    draw() {
      if (!this.alive) return;
      ctx.save();
      // Slight wiggle for elite aliens
      let wiggleX = 0;
      let wiggleY = 0;
      if (this.elite) {
        const t = performance.now() / 200;
        wiggleX = Math.sin(t + this.row) * 3;
        wiggleY = Math.cos(t + this.col) * 2;
      }
      const x = this.x + wiggleX;
      const y = this.y + wiggleY;
      const w = this.width;
      const h = this.height;
      // Draw head (oval)
      ctx.fillStyle = this.baseColor;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, y + h * 0.25, w * 0.25, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + w * 0.35, y + h * 0.2, w * 0.08, h * 0.08);
      ctx.fillRect(x + w * 0.57, y + h * 0.2, w * 0.08, h * 0.08);
      // Body
      ctx.fillStyle = this.baseColor;
      ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.35);
      // Arms
      ctx.fillRect(x, y + h * 0.45, w * 0.1, h * 0.25);
      ctx.fillRect(x + w * 0.9, y + h * 0.45, w * 0.1, h * 0.25);
      // Legs
      ctx.fillRect(x + w * 0.25, y + h * 0.8, w * 0.15, h * 0.25);
      ctx.fillRect(x + w * 0.6, y + h * 0.8, w * 0.15, h * 0.25);
      // Shield outline for elite aliens
      if (this.shield > 0) {
        ctx.strokeStyle = colorblind ? '#ff00ff' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      }
      ctx.restore();
    }
  }

  class ShieldBlock {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = 8;
      this.health = 3; // degrade through 3 states
    }
    draw() {
      if (this.health <= 0) return;
      ctx.fillStyle = this.health === 3 ? (colorblind ? '#0066ff' : '#00ff99') : this.health === 2 ? (colorblind ? '#0044aa' : '#00cc66') : (colorblind ? '#002266' : '#009944');
      ctx.fillRect(this.x, this.y, this.size, this.size);
    }
  }

  class PowerUp {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.width = 14;
      this.height = 14;
      this.type = type;
      this.active = true;
      this.speedY = 70;
    }
    update(dt) {
      this.y += this.speedY * dt * gameSpeed;
      if (this.y > HEIGHT) this.active = false;
    }
    draw() {
      ctx.save();
      let color;
      switch (this.type) {
        case 'rapid': color = '#ff00ff'; break;
        case 'double': color = '#00ffff'; break;
        case 'shield': color = '#00ff00'; break;
        case 'slow': color = '#ffff00'; break;
        case 'laser': color = '#ff8800'; break;
        case 'bomb': color = '#ff0000'; break;
        default: color = '#ffffff';
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, vx, vy, life, color) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.life = life;
      this.color = color;
    }
    update(dt) {
      this.x += this.vx * dt * gameSpeed;
      this.y += this.vy * dt * gameSpeed;
      this.life -= dt;
    }
    draw() {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, 2, 2);
    }
  }

  class UFO {
    constructor() {
      this.width = 40;
      this.height = 20;
      this.alive = true;
      // spawn direction randomly
      this.direction = Math.random() < 0.5 ? 1 : -1;
      this.x = this.direction === 1 ? -this.width : WIDTH + this.width;
      this.y = 40;
      this.speed = 100 * this.direction;
    }
    update(dt) {
      this.x += this.speed * dt * gameSpeed;
      if ((this.direction === 1 && this.x > WIDTH + this.width) || (this.direction === -1 && this.x < -this.width)) {
        this.alive = false;
      }
    }
    draw() {
      ctx.save();
      ctx.fillStyle = colorblind ? '#ff00a0' : '#ff00aa';
      const x = this.x;
      const y = this.y;
      const w = this.width;
      const h = this.height;
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2, w/2, h/3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Boss {
    constructor() {
      this.width = 100;
      this.height = 40;
      this.x = (WIDTH - this.width) / 2;
      this.y = 60;
      this.health = 200;
      this.direction = 1;
      this.speed = 50;
    }
    update(dt) {
      this.x += this.speed * this.direction * dt * gameSpeed;
      if (this.x < 0 || this.x + this.width > WIDTH) {
        this.direction *= -1;
      }
      // Boss occasionally fires multiple bullets
      if (Math.random() < 0.02 * gameSpeed * dt) {
        enemyBullets.push(new Bullet(this.x + this.width * 0.3, this.y + this.height, 6, 12, 200, 'alien'));
        enemyBullets.push(new Bullet(this.x + this.width * 0.7, this.y + this.height, 6, 12, 200, 'alien'));
      }
    }
    draw() {
      ctx.save();
      ctx.fillStyle = colorblind ? '#ff88ff' : '#8800ff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      // Draw eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(this.x + this.width * 0.25, this.y + this.height * 0.3, 12, 12);
      ctx.fillRect(this.x + this.width * 0.65, this.y + this.height * 0.3, 12, 12);
      // Health bar
      const barWidth = this.width;
      const barHeight = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(this.x, this.y - barHeight - 2, barWidth, barHeight);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(this.x, this.y - barHeight - 2, barWidth * (this.health / 200), barHeight);
      ctx.restore();
    }
  }

  /*=============================================================
    Game initialization and resets
  =============================================================*/
  function setupCanvas() {
    // Set canvas resolution to match device pixel ratio for crispness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
  }

  function resetGame() {
    score = 0;
    lives = 3;
    level = 1;
    nextExtraLifeScore = 2000;
    gameSpeed = parseFloat(speedSlider.value);
    reducedMotion = reducedMotionCheckbox.checked;
    colorblind = colorblindCheckbox.checked;
    crtEnabled = crtCheckbox.checked;
    applyCRT();
    // Clear arrays
    bullets = [];
    enemyBullets = [];
    shields = [];
    aliens = [];
    powerUps = [];
    particles = [];
    ufo = null;
    boss = null;
    activePowerUps.clear();
    initPlayer();
    initShields();
    spawnAliens();
    scheduleUFO();
    updateScoreboard();
    startMusic();
  }

  function initPlayer() {
    if (!player) player = new Player();
    player.reset();
  }

  function initShields() {
    shields = [];
    const bunkerCount = 4;
    const bunkerWidth = 8 * 6; // 6 blocks wide
    const spacing = (WIDTH - bunkerCount * bunkerWidth) / (bunkerCount + 1);
    // pattern of shield shape: 4 rows by 6 columns; 1 means block exists
    const pattern = [
      [0,1,1,1,1,0],
      [1,1,1,1,1,1],
      [1,1,1,1,1,1],
      [1,1,0,0,1,1]
    ];
    const rows = pattern.length;
    const cols = pattern[0].length;
    const startY = HEIGHT - 140;
    for (let i = 0; i < bunkerCount; i++) {
      const startX = spacing + i * (bunkerWidth + spacing);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c] === 1) {
            const block = new ShieldBlock(startX + c * 8, startY + r * 8);
            shields.push(block);
          }
        }
      }
    }
  }

  let alienOffsetX = 50;
  let alienOffsetY = 60;

  function spawnAliens() {
    aliens = [];
    // Start formation slightly lower on subsequent levels so invaders are closer to the ground
    alienOffsetX = 50;
    alienOffsetY = 60 + (level - 1) * 10;
    alienDirection = 1;
    // Increase horizontal speed for quicker back and forth movement
    alienSpeed = 40 + level * 10;
    // Adjust descent distance per turn; gets larger as levels progress
    descent = 25 + level * 5;
    totalAliensThisWave = alienCols * alienRows;
    aliensRemaining = totalAliensThisWave;
    for (let r = 0; r < alienRows; r++) {
      for (let c = 0; c < alienCols; c++) {
        aliens.push(new Alien(c, r));
      }
    }
  }

  function scheduleUFO() {
    // spawn in 10–30 seconds
    nextUFOTimer = Date.now() + 10000 + Math.random() * 20000;
  }

  /*=============================================================
    Collision detection
  =============================================================*/
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /*=============================================================
    Game loop and update functions
  =============================================================*/
  let lastTime = 0;
  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (state === 'PLAY') {
      update(dt);
      draw();
    }
    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // apply active power-up effects durations
    for (const [key, entry] of activePowerUps.entries()) {
      entry.time -= dt;
      if (entry.time <= 0) {
        // deactivate effect
        if (key === 'rapid') player.cooldown = 0.6;
        if (key === 'double') player.doubleShot = false;
        if (key === 'slow') gameSpeed = parseFloat(speedSlider.value);
        if (key === 'laser') {
          // revert bullet width/damage? currently bullet passes through automatically
        }
        activePowerUps.delete(key);
      }
    }
    // update player
    player.update(dt);
    // update bullets
    bullets.forEach(b => b.update(dt));
    bullets = bullets.filter(b => b.active);
    enemyBullets.forEach(b => b.update(dt));
    enemyBullets = enemyBullets.filter(b => b.active);
    // update particles
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
    // update UFO
    if (ufo) {
      ufo.update(dt);
      if (!ufo.alive) ufo = null;
    } else if (Date.now() > nextUFOTimer) {
      ufo = new UFO();
      scheduleUFO();
    }
    // update powerups
    powerUps.forEach(pu => pu.update(dt));
    powerUps = powerUps.filter(pu => pu.active);
    // update boss if exists
    if (boss) {
      boss.update(dt);
    }
    // update alien formation offset
    updateAliens(dt);
    // update music frequency
    updateMusicFrequency();
    // spawn enemy bullets
    spawnAlienBullets(dt);
    // handle collisions
    handleCollisions();
  }

  function updateAliens(dt) {
    // Move formation horizontally
    const movement = alienSpeed * alienDirection * dt * gameSpeed;
    alienOffsetX += movement;
    // Determine formation boundaries
    let leftMost = Infinity;
    let rightMost = -Infinity;
    aliens.forEach(a => {
      if (!a.alive) return;
      const left = a.x;
      const right = a.x + a.width;
      if (left < leftMost) leftMost = left;
      if (right > rightMost) rightMost = right;
    });
    if (leftMost < 10 && alienDirection < 0) {
      alienDirection = 1;
      alienOffsetY += descent;
      alienSpeed *= 1.05;
    } else if (rightMost > WIDTH - 10 && alienDirection > 0) {
      alienDirection = -1;
      alienOffsetY += descent;
      alienSpeed *= 1.05;
    }
  }

  function spawnAlienBullets(dt) {
    // Basic firing probability increases as fewer aliens remain
    const fireRate = 0.6 + (1 - aliensRemaining / totalAliensThisWave) * 1.8;
    // bottom-most aliens in each column can fire
    const bottomAliens = {};
    aliens.forEach(a => {
      if (!a.alive) return;
      // Key by column to find lowest row in each column
      if (!bottomAliens[a.col] || a.row > bottomAliens[a.col].row) {
        bottomAliens[a.col] = a;
      }
    });
    Object.values(bottomAliens).forEach(a => {
      if (Math.random() < fireRate * dt * gameSpeed * 0.05) {
        enemyBullets.push(new Bullet(a.x + a.width / 2 - 3, a.y + a.height, 6, 12, 200, 'alien'));
        playTone(300, 0.05);
      }
    });
  }

  function handleCollisions() {
    // Player bullet collisions with aliens
    bullets.forEach(b => {
      if (!b.active || b.owner !== 'player') return;
      // Check vs aliens
      for (const alien of aliens) {
        if (!alien.alive) continue;
        if (rectsOverlap(b.x, b.y, b.width, b.height, alien.x, alien.y, alien.width, alien.height)) {
          // If laser power-up active, allow bullet to pass through
          if (!activePowerUps.has('laser')) {
            b.active = false;
          }
          // Play a high tone when an alien is hit
          playTone(1000, 0.06);
          // Damage alien shield or kill
          if (alien.shield > 0) {
            alien.shield--;
          } else {
            alien.alive = false;
            aliensRemaining--;
            score += alien.points;
            checkExtraLife();
            // Particle explosion
            spawnParticles(alien.x + alien.width / 2, alien.y + alien.height / 2, alien.baseColor);
            playExplosion();
            // Elite aliens split into two smaller ones
            if (alien.elite) {
              // spawn two small aliens below
              const child1 = new Alien(alien.col, alien.row);
              const child2 = new Alien(alien.col, alien.row);
              child1.width = alien.width * 0.6;
              child1.height = alien.height * 0.6;
              child2.width = child1.width;
              child2.height = child1.height;
              child1.baseColor = alien.baseColor;
              child2.baseColor = alien.baseColor;
              child1.col = alien.col;
              child1.row = alien.row;
              child2.col = alien.col + 0.4; // fudge offset for position; will compute x from col
              child2.row = alien.row;
              aliens.push(child1);
              aliens.push(child2);
              aliensRemaining += 2;
              totalAliensThisWave += 2;
            }
            // Chance for power-up drop (only in enhanced)
            if (mode === 'enhanced' && Math.random() < 0.15) {
              const types = ['rapid','double','shield','slow','laser','bomb'];
              const type = types[Math.floor(Math.random() * types.length)];
              powerUps.push(new PowerUp(alien.x + alien.width / 2 - 7, alien.y + alien.height, type));
            }
          }
          updateScoreboard();
          break;
        }
      }
      // Player bullet hitting boss
      if (boss && b.active && rectsOverlap(b.x, b.y, b.width, b.height, boss.x, boss.y, boss.width, boss.height)) {
        if (!activePowerUps.has('laser')) b.active = false;
        boss.health -= 10;
        // Tone when boss is hit
        playTone(1200, 0.05);
        playExplosion();
        spawnParticles(b.x, b.y, '#ff00ff');
        if (boss.health <= 0) {
          score += 500;
          boss = null;
          updateScoreboard();
        }
      }
      // Player bullet hitting UFO
      if (ufo && b.active && rectsOverlap(b.x, b.y, b.width, b.height, ufo.x, ufo.y, ufo.width, ufo.height)) {
        if (!activePowerUps.has('laser')) b.active = false;
        const bonus = 50 + Math.floor(Math.random() * 150);
        // Tone when UFO is hit
        playTone(1500, 0.05);
        score += bonus;
        playExplosion();
        spawnParticles(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, '#ff00aa');
        ufo.alive = false;
        updateScoreboard();
      }
    });
    // Enemy bullet collisions with player
    enemyBullets.forEach(b => {
      if (!b.active) return;
      if (rectsOverlap(b.x, b.y, b.width, b.height, player.x, player.y, player.width, player.height)) {
        b.active = false;
        playerHit();
      }
    });
    // Bullets (both) colliding with shields
    bullets.concat(enemyBullets).forEach(b => {
      if (!b.active) return;
      for (const block of shields) {
        if (block.health > 0 && rectsOverlap(b.x, b.y, b.width, b.height, block.x, block.y, block.size, block.size)) {
          // Only deactivate bullet if not a laser (player) or if enemy bullet
          if (!(b.owner === 'player' && activePowerUps.has('laser'))) {
            b.active = false;
          }
          block.health--;
          // Play a mid frequency tone when a shield block is hit
          playTone(400, 0.05);
          if (block.health <= 0) {
            spawnParticles(block.x + block.size/2, block.y + block.size/2, '#55ff99');
          }
          break;
        }
      }
    });
    // Enemy bullets hitting aliens? (ignore friendly fire)
    // Player colliding with aliens or aliens reaching bottom
    let bottomReached = false;
    aliens.forEach(alien => {
      if (!alien.alive) return;
      // If alien reaches shields row (~player y minus some offset) -> game over
      if (alien.y + alien.height >= player.y) {
        bottomReached = true;
      }
      // Player colliding with alien
      if (rectsOverlap(alien.x, alien.y, alien.width, alien.height, player.x, player.y, player.width, player.height)) {
        bottomReached = true;
      }
    });
    if (bottomReached) {
      playerHit(true);
    }
    // Player collecting powerups
    powerUps.forEach(pu => {
      if (pu.active && rectsOverlap(pu.x, pu.y, pu.width, pu.height, player.x, player.y, player.width, player.height)) {
        applyPowerUp(pu.type);
        pu.active = false;
        spawnParticles(pu.x, pu.y, '#ffffff');
        playTone(900, 0.1);
      }
    });
    // Check if wave cleared
    if (aliensRemaining <= 0 && !boss) {
      nextLevel();
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 30;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      particles.push(new Particle(x, y, vx, vy, 0.6, color));
    }
  }

  function applyPowerUp(type) {
    const duration = 10; // seconds for most powerups
    if (type === 'rapid') {
      player.cooldown = 0.15;
      activePowerUps.set('rapid', { time: duration });
    } else if (type === 'double') {
      player.doubleShot = true;
      activePowerUps.set('double', { time: duration });
    } else if (type === 'shield') {
      // Restore some shield health
      shields.forEach(block => {
        if (block.health < 3) block.health++;
      });
    } else if (type === 'slow') {
      gameSpeed = parseFloat(speedSlider.value) * 0.5;
      activePowerUps.set('slow', { time: duration });
    } else if (type === 'laser') {
      // Bullets will pass through multiple aliens by not removing after kill
      activePowerUps.set('laser', { time: duration });
    } else if (type === 'bomb') {
      // Clear all aliens
      aliens.forEach(a => {
        if (a.alive) {
          a.alive = false;
          aliensRemaining--;
          score += a.points;
          spawnParticles(a.x + a.width / 2, a.y + a.height / 2, a.baseColor);
        }
      });
      updateScoreboard();
    }
  }

  function playerHit(bottom = false) {
    // screen shake effect
    triggerShake();
    spawnParticles(player.x + player.width/2, player.y + player.height/2, '#ffffff');
    playExplosion();
    if (bottom) {
      // immediate game over when aliens reach bottom
      lives = 0;
    } else {
      lives--;
    }
    updateScoreboard();
    if (lives <= 0) {
      gameOver();
    } else {
      // remove some bullets to give respite
      bullets = [];
      enemyBullets = [];
      // reset player position
      player.reset();
    }
  }

  function nextLevel() {
    level++;
    updateScoreboard();
    // Possibly spawn boss every 3 levels in enhanced mode
    if (mode === 'enhanced' && level % 3 === 0) {
      boss = new Boss();
    } else {
      spawnAliens();
    }
  }

  function checkExtraLife() {
    if (score >= nextExtraLifeScore) {
      lives++;
      nextExtraLifeScore += 2000;
    }
  }

  function updateScoreboard() {
    scoreValueEl.textContent = score;
    highScoreValueEl.textContent = highScore;
    livesValueEl.textContent = lives;
    levelValueEl.textContent = level;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('ultimate_space_invaders_highscore', highScore);
    }
  }

  /*=============================================================
    Rendering functions
  =============================================================*/
  function draw() {
    // Clear screen
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Draw background starfield and nebula
    drawBackground();
    // Draw shields
    shields.forEach(block => block.draw());
    // Draw player
    player.draw();
    // Draw bullets
    bullets.forEach(b => b.draw());
    enemyBullets.forEach(b => b.draw());
    // Draw aliens
    aliens.forEach(alien => alien.draw());
    // Draw ufo
    if (ufo) ufo.draw();
    // Draw powerups
    powerUps.forEach(pu => pu.draw());
    // Draw boss
    if (boss) boss.draw();
    // Draw particles
    particles.forEach(p => p.draw());
  }

  // Star field data
  const starsFar = [];
  const starsNear = [];
  function initStarfield() {
    starsFar.length = 0;
    starsNear.length = 0;
    for (let i = 0; i < 150; i++) {
      starsFar.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, r: Math.random() * 1.2 + 0.2 });
    }
    for (let i = 0; i < 60; i++) {
      starsNear.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, r: Math.random() * 2 + 0.5 });
    }
  }

  function drawBackground() {
    // Draw gradient nebula
    const grad = ctx.createRadialGradient(WIDTH/2, HEIGHT * 0.2, 0, WIDTH/2, HEIGHT * 0.2, HEIGHT * 0.8);
    grad.addColorStop(0, colorblind ? '#001133' : '#000022');
    grad.addColorStop(1, colorblind ? '#000011' : '#000008');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Draw stars far (slow speed)
    starsFar.forEach(star => {
      star.y += 10 * gameSpeed * (reducedMotion ? 0 : 1); // subtle drift
      if (star.y > HEIGHT) star.y = 0;
      ctx.fillStyle = '#445566';
      ctx.fillRect(star.x, star.y, star.r, star.r);
    });
    // Draw stars near (faster speed)
    starsNear.forEach(star => {
      star.y += 30 * gameSpeed * (reducedMotion ? 0 : 1);
      if (star.y > HEIGHT) star.y = 0;
      ctx.fillStyle = '#778899';
      ctx.fillRect(star.x, star.y, star.r, star.r);
    });
    // Cosmic dust as slight noise overlay
    if (!reducedMotion) {
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * WIDTH;
        const y = Math.random() * HEIGHT;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  /*=============================================================
    Screen shake
  =============================================================*/
  let shakeTime = 0;
  function triggerShake() {
    shakeTime = 0.3;
  }
  function applyShake() {
    if (shakeTime > 0) {
      shakeTime -= 0.016 * gameSpeed;
      const magnitude = 5 * (shakeTime / 0.3);
      const dx = (Math.random() - 0.5) * magnitude;
      const dy = (Math.random() - 0.5) * magnitude;
      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    } else {
      canvas.style.transform = '';
    }
  }

  /*=============================================================
    Event listeners
  =============================================================*/
  window.addEventListener('resize', () => {
    setupCanvas();
    initStarfield();
  });

  // Keyboard events
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    // Prevent default arrow key scrolling
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
    // Pause toggle
    if (e.key === 'p' || e.key === 'P') {
      if (state === 'PLAY') pauseGame();
      else if (state === 'PAUSE') resumeGame();
    }
    if (e.key === 'm' || e.key === 'M') {
      // mute/unmute
      soundEnabled = !soundEnabled;
    }
  });
  document.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  // Touch/mouse for mobile controls
  function setTouchControls(enabled) {
    if (enabled) {
      touchControls.classList.remove('hidden');
    } else {
      touchControls.classList.add('hidden');
    }
  }
  leftBtn.addEventListener('touchstart', e => { e.preventDefault(); leftPressed = true; });
  rightBtn.addEventListener('touchstart', e => { e.preventDefault(); rightPressed = true; });
  fireBtn.addEventListener('touchstart', e => { e.preventDefault(); firePressed = true; });
  leftBtn.addEventListener('touchend', e => { e.preventDefault(); leftPressed = false; });
  rightBtn.addEventListener('touchend', e => { e.preventDefault(); rightPressed = false; });
  fireBtn.addEventListener('touchend', e => { e.preventDefault(); firePressed = false; });

  // Buttons to start game in different modes
  classicModeBtn.addEventListener('click', () => {
    mode = 'classic';
    startGame();
  });
  enhancedModeBtn.addEventListener('click', () => {
    mode = 'enhanced';
    startGame();
  });
  resumeBtn.addEventListener('click', resumeGame);
  restartBtn.addEventListener('click', () => {
    stopMusic();
    resetGame();
    state = 'PLAY';
    pauseOverlay.classList.add('hidden');
  });
  playAgainBtn.addEventListener('click', () => {
    stopMusic();
    gameOverScreen.classList.add('hidden');
    resetGame();
    state = 'PLAY';
  });
  // Volume & speed controls
  volumeSlider.addEventListener('input', () => {
    if (masterGain) masterGain.gain.value = parseFloat(volumeSlider.value);
  });
  speedSlider.addEventListener('input', () => {
    if (!activePowerUps.has('slow')) {
      gameSpeed = parseFloat(speedSlider.value);
    }
  });
  reducedMotionCheckbox.addEventListener('input', () => {
    reducedMotion = reducedMotionCheckbox.checked;
  });
  colorblindCheckbox.addEventListener('input', () => {
    colorblind = colorblindCheckbox.checked;
  });
  crtCheckbox.addEventListener('input', () => {
    crtEnabled = crtCheckbox.checked;
    applyCRT();
  });

  /*=============================================================
    Game state transitions
  =============================================================*/
  function startGame() {
    initAudio();
    // Hide start screen
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    // Show or hide touch controls based on device width
    setTouchControls(window.innerWidth < 768);
    // Load high score from localStorage
    highScore = parseInt(localStorage.getItem('ultimate_space_invaders_highscore')) || 0;
    updateScoreboard();
    resetGame();
    state = 'PLAY';
  }
  function pauseGame() {
    state = 'PAUSE';
    pauseOverlay.classList.remove('hidden');
    stopMusic();
  }
  function resumeGame() {
    state = 'PLAY';
    pauseOverlay.classList.add('hidden');
    startMusic();
  }
  function gameOver() {
    state = 'GAMEOVER';
    stopMusic();
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.textContent = `Final Score: ${score}`;
    finalStatsEl.textContent = `Level Reached: ${level} • High Score: ${highScore}`;
  }

  function applyCRT() {
    if (crtEnabled) {
      crtOverlay.style.opacity = '0.2';
      crtOverlay.classList.remove('hidden');
    } else {
      crtOverlay.style.opacity = '0';
      crtOverlay.classList.add('hidden');
    }
  }

  /*=============================================================
    Initialization
  =============================================================*/
  setupCanvas();
  initStarfield();
  requestAnimationFrame(gameLoop);
  // Apply shake transform each frame by hooking into CSS transform
  setInterval(applyShake, 16);
})();
