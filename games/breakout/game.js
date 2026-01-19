(() => {
  // -------------------- Helpers --------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Canvas setup (logical size fixed, responsive via CSS)
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // UI
  const $score = document.getElementById("score");
  const $lives = document.getElementById("lives");
  const $level = document.getElementById("level");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const howBtn = document.getElementById("howBtn");

  const pauseBtn = document.getElementById("pauseBtn");
  const launchBtn = document.getElementById("launchBtn");
  const restartBtn = document.getElementById("restartBtn");

  // -------------------- Game Config --------------------
  const W = canvas.width;
  const H = canvas.height;

  const WORLD = {
    padY: H - 56,
    wall: 16,
    ceiling: 16,
  };

  const COLORS = {
    text:
