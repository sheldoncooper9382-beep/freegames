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

  const modeHumanEl = document.getElementById("modeHuman");
  const modeAIEl = document.getElementById("modeAI");
  const aiSideEl = document.getElementById("aiSide");
  const aiDifficultyEl = document.getElementById("aiDifficulty");
  const aiDelayEl = document.getElementById("aiDelay");

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

  let aiThinking = false;
  let aiTimeout = null;

  function makeInitialBoard() {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    // Top 3 rows: black on dark squares
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) b[r][c] = B;
      }
    }
    // Bottom 3 rows: red on dark squares
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

  function countPiecesOn(b = board) {
    let red = 0, black = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = b[r][c];
        if (v === EMPTY) continue;
        if (isRed(v)) red++;
        else black++;
      }
    }
    return { red, black };
  }

  function countPiecesUI() {
    const { red, black } = countPiecesOn(board);
    redCountEl.textContent = String(red);
    blackCountEl.textContent = String(black);
    return { red, black };
  }

  function getDirs(v) {
    const dirs = [];
    if (v === R) dirs.push([-1, -1], [-1, 1]);           // red up
    else if (v === B) dirs.push([1, -1], [1, 1]);        // black down
    else dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);  // kings
    return dirs;
  }

  function getCapturesFrom(b, r, c, v) {
    const dirs = getDirs(v);
    const caps = [];
    for (const [dr, dc] of dirs) {
      const midR = r + dr, midC = c + dc;
      const toR = r + 2 * dr, toC = c + 2 * dc;
      if (!inBounds(toR, toC) || !inBounds(midR, midC)) continue;
      if (b[toR][toC] !== EMPTY) continue;

      const midV = b[midR][midC];
      if (midV === EMPTY) continue;

      if (isRed(v) && isBlack(midV)) caps.push({ to: { r: toR, c: toC }, capture: { r: midR, c: midC } });
      if (isBlack(v) && isRed(midV)) caps.push({ to: { r: toR, c: toC }, capture: { r: midR, c: midC } });
    }
    return caps;
  }

  function getSimpleMovesFrom(b, r, c, v) {
    const dirs = getDirs(v);
    const moves = [];
    for (const [dr, dc] of dirs) {
      const toR = r + dr, toC = c + dc;
      if (!inBounds(toR, toC)) continue;
      if (b[toR][toC] !== EMPTY) continue;
      moves.push({ to: { r: toR, c: toC }, capture: null });
    }
    return moves;
  }

  function anyCapturesAvailable(b, forTurn) {
    const isMine = forTurn === R ? isRed : isBlack;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = b[r][c];
        if (v === EMPTY || !isMine(v)) continue;
        if (getCapturesFrom(b, r, c, v).length) return true;
      }
    }
    return false;
  }

  function getLegalMovesForPiece(b, r, c, forTurn) {
    const v = b[r][c];
    if (v === EMPTY) return [];
    const mustCap = mustCaptureEl.checked && anyCapturesAvailable(b, forTurn);

    const captures = getCapturesFrom(b, r, c, v);
    if (captures.length) return captures;
    if (mustCap) return [];
    return getSimpleMovesFrom(b, r, c, v);
  }

  function playerHasAnyMove(b, forTurn) {
    const isMine = forTurn === R ? isRed : isBlack;
    const mustCap = mustCaptureEl.checked && anyCapturesAvailable(b, forTurn);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = b[r][c];
        if (v === EMPTY || !isMine(v)) continue;
        const caps = getCapturesFrom(b, r, c, v);
        if (caps.length) return true;
        if (!mustCap) {
          const sm = getSimpleMovesFrom(b, r, c, v);
          if (sm.length) return true;
        }
      }
    }
    return false;
  }

  function promoteIfNeeded(toR, v) {
    if (isKing(v)) return v;
    if (v === R && toR === 0) return RK;
    if (v === B && toR === SIZE - 1) return BK;
    return v;
  }

  function applyMove(b, from, move) {
    // Returns { board:newBoard, turnDelta: {sameTurn:boolean, chainFrom?:{r,c}}, capturedCount:number }
    const nb = cloneBoard(b);
    const v = nb[from.r][from.c];
    nb[from.r][from.c] = EMPTY;

    let captured = 0;
    if (move.capture) {
      nb[move.capture.r][move.capture.c] = EMPTY;
      captured = 1;
    }

    const newV = promoteIfNeeded(move.to.r, v);
    nb[move.to.r][move.to.c] = newV;

    // multi-capture check (only if capture happened)
    if (move.capture) {
      const chainCaps = getCapturesFrom(nb, move.to.r, move.to.c, newV);
      if (chainCaps.length) {
        return { board: nb, sameTurn: true, chainFrom: { r: move.to.r, c: move.to.c } };
      }
    }
    return { board: nb, sameTurn: false };
  }

  // ---------- UI / Rendering ----------

  function render() {
    boardEl.innerHTML = "";

    const capAvail = mustCaptureEl.checked ? (anyCapturesAvailable(board, turn) ? "Yes" : "No") : "Off";
    capAvailEl.textContent = capAvail;

    const { red, black } = countPiecesUI();
    setTurnUI();

    const isAIMode = modeAIEl.checked;
    const aiSide = aiSideEl.value === "red" ? R : B;
    const aiToMove = isAIMode && turn === aiSide;

    // Build squares
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const sq = document.createElement("button");
        sq.type = "button";
        sq.className = "square " + (((r + c) % 2 === 0) ? "light" : "dark");
        sq.setAttribute("role", "gridcell");
        sq.dataset.r = String(r);
        sq.dataset.c = String(c);
        sq.disabled = aiThinking || aiToMove; // prevent clicking during AI turn

        const v = board[r][c];
        if (v !== EMPTY) {
          const p = document.createElement("div");
          p.className = "piece " + (isRed(v) ? "red" : "black") + (isKing(v) ? " king" : "");
          if (selected && selected.r === r && selected.c === c) p.classList.add("selected");
          sq.appendChild(p);
        }

        if (showHintsEl.checked && selected) {
          const hit = legalMovesForSelection.find(m => m.to.r === r && m.to.c === c);
          if (hit) {
            const h = document.createElement("div");
            h.className = "hint" + (hit.capture ? " capture" : "");
            sq.appendChild(h);
          }
        }

        sq.addEventListener("click", onSquareClick);
        boardEl.appendChild(sq);
      }
    }

    // selection info
    if (!selected) selInfoEl.textContent = "—";
    else {
      const v = board[selected.r][selected.c];
      const who = isRed(v) ? "Red" : "Black";
      const kind = isKing(v) ? "King" : "Man";
      selInfoEl.textContent = `${who} ${kind} @ ${String.fromCharCode(65 + selected.c)}${SIZE - selected.r}`;
    }

    // win checks
    if (red === 0 || black === 0) {
      const winner = red === 0 ? "Black" : "Red";
      openModal("Game Over", `
        <p><b class="win">${winner}</b> wins — opponent has no pieces left.</p>
        <p>Start a new match to play again.</p>
      `);
      return;
    }
    if (!playerHasAnyMove(board, turn)) {
      const winner = (turn === R) ? "Black" : "Red";
      openModal("Game Over", `
        <p><b class="win">${winner}</b> wins — <b>${turn === R ? "Red" : "Black"}</b> has no legal moves.</p>
        <p>Start a new match to play again.</p>
      `);
      return;
    }

    // schedule AI if needed
    maybeDoAITurn();
  }

  function clearSelection() {
    selected = null;
    legalMovesForSelection = [];
    setStatus("Select a piece.");
    render();
  }

  function isHumanTurn() {
    if (!modeAIEl.checked) return true;
    const aiSide = aiSideEl.value === "red" ? R : B;
    return turn !== aiSide;
  }

  function onSquareClick(e) {
    if (!isHumanTurn()) return;
    if (modal.classList.contains("show")) return;

    const r = Number(e.currentTarget.dataset.r);
    const c = Number(e.currentTarget.dataset.c);
    const v = board[r][c];

    // click piece
    if (v !== EMPTY) {
      if ((turn === R && isRed(v)) || (turn === B && isBlack(v))) {
        selected = { r, c };
        legalMovesForSelection = getLegalMovesForPiece(board, r, c, turn);

        if (!legalMovesForSelection.length) {
          const mustCap = mustCaptureEl.checked && anyCapturesAvailable(board, turn);
          setStatus(mustCap ? "A capture is available — choose a piece that can capture." : "That piece has no legal moves.");
        } else {
          const anyCap = legalMovesForSelection.some(m => m.capture);
          setStatus(anyCap ? "Capture available: jump an opponent piece." : "Choose a highlighted destination.");
        }
        render();
      } else {
        if (selected) setStatus("Select your own piece or a highlighted destination.");
      }
      return;
    }

    // click empty square -> try move
    if (!selected) {
      setStatus("Select a piece first.");
      return;
    }

    const move = legalMovesForSelection.find(m => m.to.r === r && m.to.c === c);
    if (!move) {
      setStatus("Not a legal destination. Tap a glowing target.");
      return;
    }

    snapshotForUndo = {
      board: cloneBoard(board),
      turn,
      selected: selected ? { ...selected } : null,
      modeAI: modeAIEl.checked,
      aiSide: aiSideEl.value,
      aiDifficulty: aiDifficultyEl.value,
      mustCapture: mustCaptureEl.checked
    };
    btnUndo.disabled = false;

    performMoveHuman(selected.r, selected.c, move);
  }

  function performMoveHuman(fromR, fromC, move) {
    const v = board[fromR][fromC];
    board[fromR][fromC] = EMPTY;

    if (move.capture) board[move.capture.r][move.capture.c] = EMPTY;

    const newV = promoteIfNeeded(move.to.r, v);
    board[move.to.r][move.to.c] = newV;

    if (move.capture) {
      const chainCaps = getCapturesFrom(board, move.to.r, move.to.c, newV);
      if (chainCaps.length) {
        selected = { r: move.to.r, c: move.to.c };
        legalMovesForSelection = chainCaps;
        setStatus("Multi-capture! Continue jumping with the same piece.");
        render();
        return;
      }
    }

    turn = (turn === R) ? B : R;
    selected = null;
    legalMovesForSelection = [];
    setStatus("Select a piece.");
    render();
  }

  // ---------- AI ----------

  function listAllLegalMoves(b, forTurn) {
    const isMine = forTurn === R ? isRed : isBlack;
    const mustCap = mustCaptureEl.checked && anyCapturesAvailable(b, forTurn);

    const moves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = b[r][c];
        if (v === EMPTY || !isMine(v)) continue;
        const caps = getCapturesFrom(b, r, c, v);
        if (caps.length) {
          for (const m of caps) moves.push({ from: { r, c }, move: m });
        } else if (!mustCap) {
          const sm = getSimpleMovesFrom(b, r, c, v);
          for (const m of sm) moves.push({ from: { r, c }, move: m });
        }
      }
    }
    // If mustCap, keep only capture moves
    if (mustCap) return moves.filter(x => x.move.capture);
    return moves;
  }

  function evalBoard(b, aiTurn) {
    // Simple material + advancement + king bonus (higher is better for aiTurn)
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = b[r][c];
        if (v === EMPTY) continue;

        const sign = (aiTurn === R) ? (isRed(v) ? 1 : -1) : (isBlack(v) ? 1 : -1);

        const man = Math.abs(v) === 1;
        const king = Math.abs(v) === 2;

        // base
        score += sign * (man ? 10 : 18);

        // kings favored
        if (king) score += sign * 6;

        // advancement for men
        if (man) {
          const adv = (isRed(v) ? (SIZE - 1 - r) : r); // closer to king row
          score += sign * (adv * 0.6);
        }

        // center control
        if (r >= 2 && r <= 5 && c >= 2 && c <= 5) score += sign * 0.4;
      }
    }
    return score;
  }

  function minimax(b, toMove, aiSide, depth, alpha, beta) {
    // terminal
    const { red, black } = countPiecesOn(b);
    if (red === 0 || black === 0) {
      const winner = red === 0 ? B : R;
      return { score: winner === aiSide ? 9999 : -9999 };
    }
    if (!playerHasAnyMove(b, toMove)) {
      const winner = (toMove === R) ? B : R;
      return { score: winner === aiSide ? 9999 : -9999 };
    }
    if (depth <= 0) return { score: evalBoard(b, aiSide) };

    const all = listAllLegalMoves(b, toMove);
    if (!all.length) return { score: evalBoard(b, aiSide) };

    const maximizing = (toMove === aiSide);
    let best = { score: maximizing ? -Infinity : Infinity, pick: null };

    // small shuffle to avoid deterministic boring play
    for (let i = all.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [all[i], all[j]] = [all[j], all[i]];
    }

    for (const cand of all) {
      let next = applyMove(b, cand.from, cand.move);
      let nextTurn = toMove;

      // if chain capture continues, same player continues; we approximate by forcing one extra ply:
      // In real play, chain continues with same piece. We simulate by exploring additional captures greedily
      // to a reasonable extent inside this node.
      if (next.sameTurn) {
        // continue forced captures for the same piece (greedy for speed)
        const from = next.chainFrom;
        let bb = next.board;
        while (true) {
          const piece = bb[from.r][from.c];
          const caps = getCapturesFrom(bb, from.r, from.c, piece);
          if (!caps.length) break;

          // choose capture that looks best for the mover (local heuristic)
          let bestCap = null;
          let bestCapScore = -Infinity;
          for (const cap of caps) {
            const applied = applyMove(bb, from, cap);
            const s = evalBoard(applied.board, aiSide);
            const moverIsAI = (toMove === aiSide);
            const val = moverIsAI ? s : -s;
            if (val > bestCapScore) { bestCapScore = val; bestCap = cap; }
          }
          const applied = applyMove(bb, from, bestCap);
          bb = applied.board;
          from.r = bestCap.to.r;
          from.c = bestCap.to.c;
          if (!applied.sameTurn) break;
        }
        next = { board: bb, sameTurn: false };
      }

      nextTurn = (toMove === R) ? B : R;

      const res = minimax(next.board, nextTurn, aiSide, depth - 1, alpha, beta);

      if (maximizing) {
        if (res.score > best.score) best = { score: res.score, pick: cand };
        alpha = Math.max(alpha, res.score);
      } else {
        if (res.score < best.score) best = { score: res.score, pick: cand };
        beta = Math.min(beta, res.score);
      }
      if (beta <= alpha) break;
    }

    return best;
  }

  function aiDepth() {
    const d = aiDifficultyEl.value;
    if (d === "easy") return 1;
    if (d === "medium") return 2;
    return 3; // hard
  }

  function maybeDoAITurn() {
    if (!modeAIEl.checked) return;
    if (modal.classList.contains("show")) return;

    const aiSide = aiSideEl.value === "red" ? R : B;
    if (turn !== aiSide) return;
    if (aiThinking) return;

    // if mid chain capture for AI? We'll handle by letting AI play from current position selection-less,
    // but rule enforcement ensures captures when available.
    aiThinking = true;
    clearTimeout(aiTimeout);

    // lock UI state
    selected = null;
    legalMovesForSelection = [];
    setStatus("AI thinking…");

    const delay = Number(aiDelayEl.value || "450");
    aiTimeout = setTimeout(() => {
      const depth = aiDepth();
      const result = minimax(cloneBoard(board), turn, aiSide, depth, -Infinity, Infinity);
      const pick = result.pick;

      if (!pick) {
        aiThinking = false;
        setStatus("AI has no moves.");
        render();
        return;
      }

      // Save undo snapshot (AI move also undoable)
      snapshotForUndo = {
        board: cloneBoard(board),
        turn,
        selected: null,
        modeAI: modeAIEl.checked,
        aiSide: aiSideEl.value,
        aiDifficulty: aiDifficultyEl.value,
        mustCapture: mustCaptureEl.checked
      };
      btnUndo.disabled = false;

      // Apply move to real board including full chain captures (AI completes chain)
      applyMoveWithFullChain(pick.from, pick.move);

      aiThinking = false;
      render();
    }, delay);
  }

  function applyMoveWithFullChain(from, move) {
    // apply first
    let applied = applyMove(board, from, move);
    board = applied.board;

    // If chain continues, the mover must continue with same piece and captures only.
    if (applied.sameTurn && applied.chainFrom) {
      let pos = { r: applied.chainFrom.r, c: applied.chainFrom.c };

      while (true) {
        const piece = board[pos.r][pos.c];
        const caps = getCapturesFrom(board, pos.r, pos.c, piece);
        if (!caps.length) break;

        // choose best capture by quick eval (AI side is current turn)
        let best = null;
        let bestScore = -Infinity;
        const aiSide = (aiSideEl.value === "red") ? R : B;
        for (const cap of caps) {
          const tmp = applyMove(board, pos, cap).board;
          const s = evalBoard(tmp, aiSide);
          if (s > bestScore) { bestScore = s; best = cap; }
        }
        const nxt = applyMove(board, pos, best);
        board = nxt.board;
        pos = { r: best.to.r, c: best.to.c };
        if (!nxt.sameTurn) break;
      }
    }

    // end turn
    turn = (turn === R) ? B : R;
    setStatus("Select a piece.");
  }

  // ---------- Modal / Controls ----------

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
      <p><b>AI mode:</b> You control the side that is <b>not</b> set as AI.</p>
    `);
  }

  function newGame() {
    board = makeInitialBoard();
    turn = R;
    selected = null;
    legalMovesForSelection = [];
    snapshotForUndo = null;
    btnUndo.disabled = true;
    aiThinking = false;
    clearTimeout(aiTimeout);
    setStatus("Select a piece.");
    closeModal();
    render();
  }

  function undo() {
    if (!snapshotForUndo) return;
    board = cloneBoard(snapshotForUndo.board);
    turn = snapshotForUndo.turn;
    selected = snapshotForUndo.selected ? { ...snapshotForUndo.selected } : null;
    legalMovesForSelection = selected ? getLegalMovesForPiece(board, selected.r, selected.c, turn) : [];
    snapshotForUndo = null;
    btnUndo.disabled = true;
    aiThinking = false;
    clearTimeout(aiTimeout);
    setStatus("Undone. Continue your turn.");
    closeModal();
    render();
  }

  function modeChanged() {
    aiThinking = false;
    clearTimeout(aiTimeout);
    selected = null;
    legalMovesForSelection = [];
    setStatus("Mode updated.");
    render();
  }

  // Keyboard: Esc clears selection; R rules; N new game
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); clearSelection(); }
    if (e.key.toLowerCase() === "r") showRules();
    if (e.key.toLowerCase() === "n") newGame();
  });

  btnClose.addEventListener("click", closeModal);
  btnClose2.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  btnNew.addEventListener("click", newGame);
  btnUndo.addEventListener("click", undo);
  btnRules.addEventListener("click", showRules);

  mustCaptureEl.addEventListener("change", () => {
    if (selected) legalMovesForSelection = getLegalMovesForPiece(board, selected.r, selected.c, turn);
    setStatus("Rules updated.");
    render();
  });
  showHintsEl.addEventListener("change", render);

  modeHumanEl.addEventListener("change", modeChanged);
  modeAIEl.addEventListener("change", modeChanged);
  aiSideEl.addEventListener("change", modeChanged);
  aiDifficultyEl.addEventListener("change", modeChanged);
  aiDelayEl.addEventListener("change", modeChanged);

  // Init
  btnUndo.disabled = true;
  setStatus("Select a piece.");
  render();
})();
