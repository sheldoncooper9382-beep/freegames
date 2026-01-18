const games = [
  { title: "Tetris", description: "Stack blocks and clear lines", icon: "🟦", path: "games/tetris/index.html" },
  { title: "Snake", description: "Eat, grow, survive", icon: "🐍", path: "games/snake/index.html" },
  { title: "Pong", description: "Classic paddle duel", icon: "🏓", path: "games/pong/index.html" },
  { title: "Breakout", description: "Smash every brick", icon: "🧱", path: "games/breakout/index.html" },
  { title: "Space Invaders", description: "Defend the galaxy", icon: "👾", path: "games/space-invaders/index.html" }
];

const grid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const statsText = document.getElementById("statsText");
const emptyState = document.getElementById("emptyState");
const clearBtn = document.getElementById("clearBtn");

function render(list) {
  grid.innerHTML = "";

  list.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.tabIndex = 0;

    card.addEventListener("click", () => (location.href = game.path));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") location.href = game.path;
    });

    card.innerHTML = `
      <div class="game-icon" aria-hidden="true">${game.icon}</div>
      <div class="game-title">${escapeHTML(game.title)}</div>
      <div class="game-desc">${escapeHTML(game.description)}</div>
    `;

    grid.appendChild(card);
  });

  const total = games.length;
  const shown = list.length;
  statsText.textContent = `${shown} / ${total} games`;

  const isEmpty = shown === 0;
  emptyState.hidden = !isEmpty;
  grid.style.display = isEmpty ? "none" : "grid";
}

function applySearch() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const filtered = games.filter(g => {
    const t = (g.title || "").toLowerCase();
    const d = (g.description || "").toLowerCase();
    return t.includes(q) || d.includes(q);
  });
  render(filtered);
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (searchInput) {
  searchInput.addEventListener("input", applySearch);
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    applySearch();
    searchInput?.focus();
  });
}

// initial render
render(games);
