// /game.js
(() => {
  "use strict";

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);

  const boardEl = $("#board");
  const goalEl = $("#goal");
  const movesEl = $("#moves");
  const timeEl = $("#time");
  const bestEl = $("#best");
  const sizeEl = $("#size");
  const statusPill = $("#statusPill");
  const solvableDot = $("#solvableDot");
  const solvableText = $("#solvableText");
  const goalLabel = $("#goalLabel");
  const seedLabel = $("#seedLabel");

  const newGameBtn = $("#newGame");
  const shuffleBtn = $("#shuffle");
  const resetBtn = $("#reset");
  const undoBtn = $("#undo");
  const checkBtn = $("#solveCheck");
  const hintBtn = $("#hint");

  const overlay = $("#overlay");
  const overlayTitle = $("#overlayTitle");
  const overlayBody = $("#overlayBody");
  const playBtn = $("#play");
  const closeOverlayBtn = $("#closeOverlay");

  // ---------- State ----------
  let N = 4;                 // board size
  let tiles = [];            // current tiles, 0 = empty
  let solved = [];           // solved tiles
  let emptyIndex = 0;
  let moves = 0;
  let startedAt = 0;
  let timerId = 0;
  let paused = true;
  let hintOn = false;

  // Undo: store previous emptyIndex + swapIndex
  let undoStack = [];        // array of {a,b} indices swapped

  // For reset (returns to the start of current game)
  let startTiles = [];
  let startEmptyIndex = 0;

  // For swipe handling
  let pointerDown = false;
  let p0 = { x: 0, y: 0 };
  let lastSwipeAt = 0;

  // Seed for “feel” (not cryptographic) to show on UI
  let seed = 0;

  const LS_BEST = "glass_slide_best_v1";
  const LS_LASTSIZE = "glass_slide_size_v1";

  // ---------- Helpers ----------
  function pad2(n) { return String(n).padStart(2, "0"); }

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${pad2(m)}:${pad2(r)}`;
  }

  function setStatus(text, kind = "neutral") {
    statusPill.textContent = text;
    statusPill.style.borderColor =
      kind === "good" ? "rgba(82,255,161,.35)" :
      kind === "bad"  ? "rgba(255,77,122,.35)" :
      kind === "warn" ? "rgba(255,214,107,.35)" :
                        "rgba(255,255,255,.12)";
  }

  function loadBest() {
    try {
      const raw = localStorage.getItem(LS_BEST);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch { return null; }
  }

  function saveBest(size, bestMoves, bestTimeMs) {
    const all = loadBest() || {};
    const key = String(size);
    const prev = all[key];
    const candidate = { moves: bestMoves, timeMs: bestTimeMs };

    // compare: prioritize fewer moves, tie-breaker time
    const better =
      !prev ||
      (candidate.moves < prev.moves) ||
      (candidate.moves === prev.moves && candidate.timeMs < prev.timeMs);

    if (better) {
      all[key] = candidate;
      try { localStorage.setItem(LS_BEST, JSON.stringify(all)); } catch {}
    }
  }

  function showBest() {
    const all = loadBest();
    const key = String(N);
    const b = all && all[key];
    if (!b) { bestEl.textContent = "—"; return; }
    bestEl.textContent = `${b.moves} / ${fmtTime(b.timeMs)}`;
  }

  function rand32() {
    // xorshift32-ish seed evolution
    seed |= 0;
    seed ^= seed << 13; seed |= 0;
    seed ^= seed >>> 17; seed |= 0;
    seed ^= seed << 5; seed |= 0;
    return (seed >>> 0);
  }

  function randInt(max) {
    return (rand32() % max);
  }

  function cloneArr(a) { return a.slice(); }

  // ---------- Solvability ----------
  function countInversions(arr) {
    // ignore 0
    let inv = 0;
    const list = arr.filter(v => v !== 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i] > list[j]) inv++;
      }
    }
    return inv;
  }

  function isSolvable(arr, size) {
    const inv = countInversions(arr);
    if (size % 2 === 1) {
      // odd grid: inversions must be even
      return inv % 2 === 0;
    } else {
      // even grid: depends on blank row from bottom (1-based)
      const idx0 = arr.indexOf(0);
      const rowFromTop = Math.floor(idx0 / size);
      const rowFromBottom = size - rowFromTop; // 1..size
      // solvable if (blank on even row from bottom and inversions odd)
      // or (blank on odd row from bottom and inversions even)
      const blankEven = (rowFromBottom % 2 === 0);
      const invEven = (inv % 2 === 0);
      return (blankEven && !invEven) || (!blankEven && invEven);
    }
  }

  function makeSolved(size) {
    const total = size * size;
    const arr = [];
    for (let i = 1; i < total; i++) arr.push(i);
    arr.push(0);
    return arr;
  }

  function shuffleSolvable(size) {
    const total = size * size;
    const arr = makeSolved(size);

    // Fisher-Yates shuffle with retries until solvable and not already solved
    // (Fast for 3–5 sizes)
    for (let attempt = 0; attempt < 2000; attempt++) {
      const a = arr.slice();
      for (let i = total - 1; i > 0; i--) {
        const j = randInt(i + 1);
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
      }
      if (a[total - 1] !== 0) {
        // keep 0 present, okay; no need to force last position.
      }
      if (isSolvable(a, size) && !isSolved(a, makeSolved(size))) {
        return a;
      }
    }

    // Fallback: do a sequence of valid moves from solved (always solvable)
    let a = makeSolved(size);
    let e = a.indexOf(0);
    let last = -1;
    for (let k = 0; k < size * size * 40; k++) {
      const nbs = neighbors(e, size).filter(x => x !== last);
      const pick = nbs[randInt(nbs.length)];
      a = swap(a, e, pick);
      last = e;
      e = pick;
    }
    if (isSolved(a, makeSolved(size))) {
      // ensure not solved
      const nbs = neighbors(e, size);
      a = swap(a, e, nbs[0]);
    }
    return a;
  }

  function isSolved(arr, solvedArr) {
    for (let i = 0; i < arr.length; i++) if (arr[i] !== solvedArr[i]) return false;
    return true;
  }

  function neighbors(index, size) {
    const r = Math.floor(index / size);
    const c = index % size;
    const out = [];
    if (r > 0) out.push(index - size);
    if (r < size - 1) out.push(index + size);
    if (c > 0) out.push(index - 1);
    if (c < size - 1) out.push(index + 1);
    return out;
  }

  function swap(arr, i, j) {
    const a = arr.slice();
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    return a;
  }

  // ---------- Rendering ----------
  function setBoardGrid(size) {
    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${size}, 1fr)`;
  }

  function renderGoal() {
    goalEl.innerHTML = "";
    goalEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    goalEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    goalLabel.textContent = `${N}×${N}`;

    const total = N * N;
    for (let i = 0; i < total; i++) {
      const v = solved[i];
      const d = document.createElement("div");
      d.className = "goalTile" + (v === 0 ? " empty" : "");
      d.textContent = v === 0 ? "" : String(v);
      goalEl.appendChild(d);
    }
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    setBoardGrid(N);

    const total = N * N;
    for (let i = 0; i < total; i++) {
      const v = tiles[i];
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile" + (v === 0 ? " empty" : "");
      tile.dataset.index = String(i);
      tile.dataset.value = String(v);
      tile.setAttribute("aria-label", v === 0 ? "Empty space" : `Tile ${v}`);
      tile.setAttribute("tabindex", v === 0 ? "-1" : "0");

      const span = document.createElement("span");
      span.textContent = v === 0 ? "" : String(v);
      tile.appendChild(span);

      if (v !== 0) {
        tile.addEventListener("click", () => tryMoveIndex(i));
      }

      boardEl.appendChild(tile);
    }

    applyHint();
  }

  function applyHint() {
    const total = N * N;
    for (let i = 0; i < total; i++) {
      const el = boardEl.children[i];
      const v = tiles[i];
      if (!el) continue;

      el.classList.toggle("good", v !== 0 && v === solved[i]);
      el.classList.toggle("hint", hintOn && v !== 0 && v === solved[i]);
    }
  }

  // ---------- Gameplay ----------
  function resetCounters() {
    moves = 0;
    undoStack = [];
    movesEl.textContent = "0";
    undoBtn.disabled = true;
    setStatus("Shuffled. Good luck!", "neutral");
  }

  function startTimer() {
    if (!paused) return;
    paused = false;
    startedAt = performance.now();
    const startOffset = elapsedMs; // preserve if resuming (not used heavily)
    const tick = () => {
      if (paused) return;
      const now = performance.now();
      const ms = startOffset + (now - startedAt);
      timeEl.textContent = fmtTime(ms);
      elapsedMs = ms;
      timerId = requestAnimationFrame(tick);
    };
    timerId = requestAnimationFrame(tick);
  }

  function stopTimer() {
    paused = true;
    if (timerId) cancelAnimationFrame(timerId);
    timerId = 0;
  }

  let elapsedMs = 0;
  function resetTimer() {
    stopTimer();
    elapsedMs = 0;
    timeEl.textContent = "00:00";
  }

  function setSolvableUI(ok) {
    solvableDot.style.background = ok ? "var(--good)" : "var(--bad)";
    solvableDot.style.boxShadow = ok
      ? "0 0 16px rgba(82,255,161,.35)"
      : "0 0 16px rgba(255,77,122,.35)";
    solvableText.textContent = ok ? "Solvable shuffle" : "Not solvable (should not happen)";
  }

  function newGame() {
    N = Number(sizeEl.value) || 4;
    solved = makeSolved(N);

    // seed derived from time + size, shown to user
    seed = ((Date.now() & 0xffffffff) ^ (N * 2654435761)) | 0;

    const shuffled = shuffleSolvable(N);
    tiles = shuffled;
    emptyIndex = tiles.indexOf(0);

    startTiles = cloneArr(tiles);
    startEmptyIndex = emptyIndex;

    resetCounters();
    resetTimer();
    showBest();

    seedLabel.textContent = `Seed: ${(seed >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
    setSolvableUI(isSolvable(tiles, N));

    renderGoal();
    renderBoard();

    // focus for keyboard
    boardEl.focus({ preventScroll: true });
  }

  function resetToStart() {
    tiles = cloneArr(startTiles);
    emptyIndex = startEmptyIndex;
    resetCounters();
    resetTimer();
    renderBoard();
    boardEl.focus({ preventScroll: true });
  }

  function canMove(index) {
    if (index === emptyIndex) return false;
    return neighbors(emptyIndex, N).includes(index);
  }

  function tryMoveIndex(index, recordUndo = true) {
    if (!canMove(index)) return false;

    if (paused && moves === 0 && elapsedMs === 0) {
      setStatus("Go!", "neutral");
      startTimer();
    }

    const a = emptyIndex;
    const b = index;

    tiles = swap(tiles, a, b);
    emptyIndex = b;

    if (recordUndo) {
      undoStack.push({ a, b });
      if (undoStack.length > 500) undoStack.shift();
      undoBtn.disabled = undoStack.length === 0;
    }

    moves++;
    movesEl.textContent = String(moves);

    renderBoard();
    checkWinAuto();

    return true;
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) return;

    // last move swapped empty (a) with tile (b)
    // to undo, swap them back: current emptyIndex should equal last.b
    const a = last.a;
    const b = last.b;

    // swap back
    tiles = swap(tiles, b, a);
    emptyIndex = a;

    moves = Math.max(0, moves - 1);
    movesEl.textContent = String(moves);

    undoBtn.disabled = undoStack.length === 0;
    renderBoard();
    setStatus("Undid last move.", "neutral");
  }

  function moveEmptyByDirection(dir) {
    // dir: "up" means move empty up by swapping with tile above (empty goes up)
    const r = Math.floor(emptyIndex / N);
    const c = emptyIndex % N;
    let target = -1;

    if (dir === "up" && r > 0) target = emptyIndex - N;
    else if (dir === "down" && r < N - 1) target = emptyIndex + N;
    else if (dir === "left" && c > 0) target = emptyIndex - 1;
    else if (dir === "right" && c < N - 1) target = emptyIndex + 1;

    if (target >= 0) {
      // swap empty with target tile (same as moving that tile into empty)
      return tryMoveIndex(target);
    }
    return false;
  }

  function checkWinAuto() {
    if (isSolved(tiles, solved)) {
      stopTimer();
      setStatus("Solved! 🎉", "good");
      applyHint();

      // update best
      saveBest(N, moves, elapsedMs);
      showBest();

      // show overlay
      overlayTitle.textContent = "You solved it!";
      overlayBody.textContent = `Size ${N}×${N} • Moves: ${moves} • Time: ${fmtTime(elapsedMs)}. Want another round?`;
      showOverlay(true);
    }
  }

  function manualCheck() {
    const ok = isSolved(tiles, solved);
    if (ok) {
      setStatus("Perfect. Solved!", "good");
      checkWinAuto();
    } else {
      setStatus("Not solved yet — keep going.", "warn");
    }
  }

  // ---------- Overlay ----------
  function showOverlay(show) {
    overlay.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) {
      closeOverlayBtn.focus({ preventScroll: true });
    } else {
      boardEl.focus({ preventScroll: true });
    }
  }

  // ---------- Input ----------
  function onKey(e) {
    const k = e.key.toLowerCase();
    if (overlay.getAttribute("aria-hidden") === "false") {
      if (k === "escape") showOverlay(false);
      return;
    }

    let handled = true;
    if (k === "arrowup" || k === "w") moveEmptyByDirection("up");
    else if (k === "arrowdown" || k === "s") moveEmptyByDirection("down");
    else if (k === "arrowleft" || k === "a") moveEmptyByDirection("left");
    else if (k === "arrowright" || k === "d") moveEmptyByDirection("right");
    else if (k === "u") undo();
    else if (k === "r") resetToStart();
    else if (k === "h") toggleHint();
    else if (k === "escape") showOverlay(true);
    else handled = false;

    if (handled) e.preventDefault();
  }

  function toggleHint() {
    hintOn = !hintOn;
    hintBtn.setAttribute("aria-pressed", hintOn ? "true" : "false");
    setStatus(hintOn ? "Hint on: correct tiles glow." : "Hint off.", "neutral");
    renderBoard();
  }

  // Pointer / swipe:
  // We interpret swipe direction as moving the empty space in that direction.
  function onPointerDown(e) {
    if (overlay.getAttribute("aria-hidden") === "false") return;
    pointerDown = true;
    const p = getPoint(e);
    p0 = p;
    boardEl.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!pointerDown) return;
    // optional: could add drag preview, but keep it fast
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    pointerDown = false;

    const now = performance.now();
    if (now - lastSwipeAt < 70) return; // throttle
    lastSwipeAt = now;

    const p1 = getPoint(e);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    const min = 22; // px threshold
    if (adx < min && ady < min) return;

    if (adx > ady) {
      // horizontal
      if (dx > 0) moveEmptyByDirection("right");
      else moveEmptyByDirection("left");
    } else {
      // vertical
      if (dy > 0) moveEmptyByDirection("down");
      else moveEmptyByDirection("up");
    }
  }

  function getPoint(e) {
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  // ---------- Wiring ----------
  function init() {
    // restore size
    try {
      const last = localStorage.getItem(LS_LASTSIZE);
      if (last && ["3", "4", "5"].includes(last)) sizeEl.value = last;
    } catch {}

    sizeEl.addEventListener("change", () => {
      try { localStorage.setItem(LS_LASTSIZE, sizeEl.value); } catch {}
      newGame();
    });

    newGameBtn.addEventListener("click", () => newGame());
    shuffleBtn.addEventListener("click", () => newGame());
    resetBtn.addEventListener("click", () => resetToStart());
    undoBtn.addEventListener("click", () => undo());
    checkBtn.addEventListener("click", () => manualCheck());
    hintBtn.addEventListener("click", () => toggleHint());

    playBtn.addEventListener("click", () => {
      newGame();
      showOverlay(false);
    });
    closeOverlayBtn.addEventListener("click", () => showOverlay(false));

    // clicking outside modal closes
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) showOverlay(false);
    });

    // keyboard
    window.addEventListener("keydown", onKey, { passive: false });

    // swipe controls
    boardEl.addEventListener("pointerdown", onPointerDown, { passive: true });
    boardEl.addEventListener("pointermove", onPointerMove, { passive: true });
    boardEl.addEventListener("pointerup", onPointerUp, { passive: true });
    boardEl.addEventListener("pointercancel", onPointerUp, { passive: true });

    // touch fallback (some browsers)
    boardEl.addEventListener("touchstart", onPointerDown, { passive: true });
    boardEl.addEventListener("touchend", onPointerUp, { passive: true });

    // initial
    newGame();
    overlayTitle.textContent = "Welcome";
    overlayBody.textContent = "Choose a size and press Play. Your shuffles are always solvable. (Hotkeys: Arrows/WASD, U=undo, R=reset, H=hint.)";
    showOverlay(true);
  }

  init();
})();
