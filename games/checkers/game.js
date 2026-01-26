// /game.js
(() => {
  const SIZE = 8;
  const EMPTY = 0;
  const R = 1;       // red man
  const RK = 2;      // red king
  const B = -1;      // black man
  const BK = -2;     // black king

  const boardEl = document.getElementById("board");
  const turnText = document.getElementById("turnText");
  const statusPill = document.getElementById("statusPill");
  const redCountEl = document.getElementById("redCount");
  const blackCountEl = document.getElementById("blackCount");
  const sidePlayerEl = document.getElementById("sidePlayer");
  const capAvailEl = document.getElementById("capAvail");
  const selInfoEl = document.getElementById("selInfo");

  const mustCaptureEl = document.getElementById("mustCapture");
  const showHintsEl = document.getElementById("showHints");

  const btnNew = document.getElementById("btnNew");
  const btnUndo = document.getElementById("btnUndo");
  const btnRules = document.getElementById("btnRules");

  const modal = document.getElementById("modal");
  const btnClose = document.getElementById("btnClose");
  const btnClose2 = document.getElementById("btnClose2");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const isRed = (v) => v > 0;
  const isBlack = (v) => v < 0;
  const isKing = (v) => Math.abs(v) === 2;

  let board = makeInitialBoard();
  let turn = R; // R means red to play; B means black to play
  let selected = null; // {r,c}
  let legalMovesForSelection = []; // [{to:{r,c}, capture:{r,c}|null}]
  let snapshotForUndo = null; // one-level undo

  function makeInitialBoard() {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    // Standard checkers: pieces on dark squares.
    // Top 3 rows: black
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) b[r][c] = B;
      }
    }
    // Bottom 3 rows: red
    for (let r = SIZE - 3; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) b[r][c] = R;
      }
    }
    return b;
  }

  function cloneBoard(b) {
    return b.map(row => row.slice());
  }

  function setStatus(msg) {
    statusPill.textContent = msg;
  }

  function setTurnUI() {
    const t = turn === R ? "Red" : "Black";
    turnText.textContent = t;
    sidePlayerEl.textContent = t;
  }

  function countPieces() {
    let red = 0, black = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = board[r][c];
        if (v === EMPTY) continue;
        if (isRed(v)) red++;
        else black++;
      }
    }
    redCountEl.textContent = String(red);
    blackCountEl.textContent = String(black);
    return { red, black };
  }

  function anyCapturesAvailable(forTurn) {
    const isMine = forTurn === R ? isRed : isBlack;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = board[r][c];
        if (v === EMPTY || !isMine(v)) continue;
        const caps = getCapturesFrom(r, c, v);
        if (caps.length) return true;
      }
    }
    return false;
  }

  function getDirs(v) {
    // returns array of [dr,dc] for simple moves and capture moves directions.
    const dirs = [];
    if (v === R) { // red moves up (toward row 0)
      dirs.push([-1, -1], [-1, 1]);
    } else if (v === B) { // black moves down (toward row 7)
      dirs.push([1, -1], [1, 1]);
    } else { // kings
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    return dirs;
  }

  function getCapturesFrom(r, c, v) {
    const dirs = getDirs(v);
    const caps = [];
    for (const [dr, dc] of dirs) {
      const midR = r + dr;
      const midC = c + dc;
      const toR = r + 2 * dr;
      const toC = c + 2 * dc;
      if (!inBounds(toR, toC) || !inBounds(midR, midC)) continue;
      if (board[toR][toC] !== EMPTY) continue;

      const midV = board[midR][midC];
      if (midV === EMPTY) continue;

      // must be opponent
      if (isRed(v) && isBlack(midV)) caps.push({ to: { r: toR, c: toC }, capture: { r: midR, c: midC } });
      if (isBlack(v) && isRed(midV)) caps.push({ to: { r: toR, c: toC }, capture: { r: midR, c: midC } });
    }
    return caps;
  }

  function getSimpleMovesFrom(r, c, v) {
    const dirs = getDirs(v);
    const moves = [];
    for (const [dr, dc] of dirs) {
      const toR = r + dr;
      const toC = c + dc;
      if (!inBounds(toR, toC)) continue;
      if (board[toR][toC] !== EMPTY) continue;
      moves.push({ to: { r: toR, c: toC }, capture: null });
    }
    return moves;
  }

  function getLegalMovesForPiece(r, c) {
    const v = board[r][c];
    if (v === EMPTY) return [];
    const mustCap = mustCaptureEl.checked && anyCapturesAvailable(turn);

    const captures = getCapturesFrom(r, c, v);
    if (captures.length) return captures;
    if (mustCap) return []; // captures exist elsewhere; this piece can't move
    return getSimpleMovesFrom(r, c, v);
  }

  function render() {
    boardEl.innerHTML = "";

    const capAvail = mustCaptureEl.checked ? (anyCapturesAvailable(turn) ? "Yes" : "No") : "Off";
    capAvailEl.textContent = capAvail;

    const { red, black } = countPieces();
    setTurnUI();

    // Build squares
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const sq = document.createElement("button");
        sq.type = "button";
        sq.className = "square " + (((r + c) % 2 === 0) ? "light" : "dark");
        sq.setAttribute("role", "gridcell");
        sq.dataset.r = String(r);
        sq.dataset.c = String(c);

        // Place piece
        const v = board[r][c];
        if (v !== EMPTY) {
          const p = document.createElement("div");
          p.className = "piece " + (isRed(v) ? "red" : "black") + (isKing(v) ? " king" : "");
          if (selected && selected.r === r && selected.c === c) p.classList.add("selected");
          p.setAttribute("aria-label", (isRed(v) ? "Red" : "Black") + (isKing(v) ? " king" : " piece"));
          sq.appendChild(p);
        }

        // Hints for selected
        if (showHintsEl.checked && selected && legalMovesForSelection.length && selected.r === r && selected.c === c) {
          // (nothing here; hints go on target squares)
        }
        if (showHintsEl.checked && selected) {
          const hit = legalMovesForSelection.find(m => m.to.r === r && m.to.c === c);
          if (hit) {
            const h = document.createElement("div");
            h.className = "hint" + (hit.capture ? " capture" : "");
            h.setAttribute("aria-hidden", "true");
            sq.appendChild(h);
          }
        }

        // Click handler
        sq.addEventListener("click", onSquareClick);
        boardEl.appendChild(sq);
      }
    }

    // Selection info
    if (!selected) selInfoEl.textContent = "—";
    else {
      const v = board[selected.r][selected.c];
      const who = isRed(v) ? "Red" : "Black";
      const kind = isKing(v) ? "King" : "Man";
      selInfoEl.textContent = `${who} ${kind} @ ${String.fromCharCode(65 + selected.c)}${SIZE - selected.r}`;
    }

    // Win check
    if (red === 0 || black === 0) {
      const winner = red === 0 ? "Black" : "Red";
      openModal("Game Over", `
        <p><b class="win">${winner}</b> wins — opponent has no pieces left.</p>
        <p>Start a new match to play again.</p>
      `);
    } else {
      // also check no-move situations
      const hasMove = playerHasAnyMove(turn);
      if (!hasMove) {
        const winner = (turn === R) ? "Black" : "Red";
        openModal("Game Over", `
          <p><b class="win">${winner}</b> wins — <b>${turn === R ? "Red" : "Black"}</b> has no legal moves.</p>
          <p>Start a new match to play again.</p>
        `);
      }
    }
  }

  function playerHasAnyMove(forTurn) {
    const isMine = forTurn === R ? isRed : isBlack;
    const mustCap = mustCaptureEl.checked && anyCapturesAvailable(forTurn);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = board[r][c];
        if (v === EMPTY || !isMine(v)) continue;
        const caps = getCapturesFrom(r, c, v);
        if (caps.length) return true;
        if (!mustCap) {
          const sm = getSimpleMovesFrom(r, c, v);
          if (sm.length) return true;
        }
      }
    }
    return false;
  }

  function clearSelection() {
    selected = null;
    legalMovesForSelection = [];
    setStatus("Select a piece.");
    render();
  }

  function onSquareClick(e) {
    const r = Number(e.currentTarget.dataset.r);
    const c = Number(e.currentTarget.dataset.c);
    const v = board[r][c];

    // If modal is open, ignore board clicks
    if (modal.classList.contains("show")) return;

    // If clicking a piece
    if (v !== EMPTY) {
      // Only select own pieces
      if ((turn === R && isRed(v)) || (turn === B && isBlack(v))) {
        selected = { r, c };
        legalMovesForSelection = getLegalMovesForPiece(r, c);

        if (!legalMovesForSelection.length) {
          const mustCap = mustCaptureEl.checked && anyCapturesAvailable(turn);
          setStatus(mustCap ? "A capture is available — choose a piece that can capture." : "That piece has no legal moves.");
        } else {
          const anyCap = legalMovesForSelection.some(m => m.capture);
          setStatus(anyCap ? "Capture available: jump an opponent piece." : "Choose a highlighted destination.");
        }

        render();
      } else {
        // Clicking opponent piece while something selected: do nothing (user can reselect)
        if (selected) setStatus("Select your own piece or a highlighted destination.");
      }
      return;
    }

    // Clicking an empty square: attempt move if selected and square is a legal target
    if (!selected) {
      setStatus("Select a piece first.");
      return;
    }

    const move = legalMovesForSelection.find(m => m.to.r === r && m.to.c === c);
    if (!move) {
      setStatus("Not a legal destination. Tap a glowing target.");
      return;
    }

    // Save snapshot for undo (one move)
    snapshotForUndo = {
      board: cloneBoard(board),
      turn,
      selected: selected ? { ...selected } : null
    };
    btnUndo.disabled = false;

    performMove(selected.r, selected.c, move);
  }

  function promoteIfNeeded(toR, toC, v) {
    if (isKing(v)) return v;
    if (v === R && toR === 0) return RK;
    if (v === B && toR === SIZE - 1) return BK;
    return v;
  }

  function performMove(fromR, fromC, move) {
    const v = board[fromR][fromC];
    board[fromR][fromC] = EMPTY;

    // capture?
    if (move.capture) {
      board[move.capture.r][move.capture.c] = EMPTY;
    }

    const newV = promoteIfNeeded(move.to.r, move.to.c, v);
    board[move.to.r][move.to.c] = newV;

    // If capture, check for multi-capture chain from new position (same piece continues)
    if (move.capture) {
      const chainCaps = getCapturesFrom(move.to.r, move.to.c, newV);

      if (chainCaps.length) {
        selected = { r: move.to.r, c: move.to.c };
        legalMovesForSelection = chainCaps;
        setStatus("Multi-capture! Continue jumping with the same piece.");
        render();
        return; // same player's turn continues
      }
    }

    // Turn ends
    turn = (turn === R) ? B : R;
    selected = null;
    legalMovesForSelection = [];
    setStatus("Select a piece.");
    render();
  }

  function newGame() {
    board = makeInitialBoard();
    turn = R;
    selected = null;
    legalMovesForSelection = [];
    snapshotForUndo = null;
    btnUndo.disabled = true;
    setStatus("Select a piece.");
    closeModal();
    render();
  }

  function undo() {
    if (!snapshotForUndo) return;
    board = cloneBoard(snapshotForUndo.board);
    turn = snapshotForUndo.turn;
    selected = snapshotForUndo.selected ? { ...snapshotForUndo.selected } : null;
    legalMovesForSelection = selected ? getLegalMovesForPiece(selected.r, selected.c) : [];
    snapshotForUndo = null;
    btnUndo.disabled = true;
    setStatus("Undone. Continue your turn.");
    closeModal();
    render();
  }

  function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function showRules() {
    openModal("Rules", `
      <p><b>Movement:</b> Pieces move diagonally on dark squares. Men move forward only; kings move forward and backward.</p>
      <p><b>Captures:</b> Jump diagonally over one adjacent opponent piece into an empty square beyond it. The jumped piece is removed.</p>
      <p><b>Multi-capture:</b> If after a capture you can capture again with the same piece, you must continue.</p>
      <p><b>Kings:</b> Reaching the far edge promotes a man to a king.</p>
      <p><b>Win:</b> Capture all opponent pieces or leave them with no legal moves.</p>
    `);
  }

  // Keyboard: Esc clears selection; R opens rules; N new game
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); clearSelection(); }
    if (e.key.toLowerCase() === "r") showRules();
    if (e.key.toLowerCase() === "n") newGame();
  });

  // Modal close
  btnClose.addEventListener("click", closeModal);
  btnClose2.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Controls
  btnNew.addEventListener("click", newGame);
  btnUndo.addEventListener("click", undo);
  btnRules.addEventListener("click", showRules);

  mustCaptureEl.addEventListener("change", () => {
    // If selection exists, recompute legality under new rule
    if (selected) legalMovesForSelection = getLegalMovesForPiece(selected.r, selected.c);
    setStatus("Rules updated.");
    render();
  });
  showHintsEl.addEventListener("change", render);

  // Init
  btnUndo.disabled = true;
  setStatus("Select a piece.");
  render();
})();
