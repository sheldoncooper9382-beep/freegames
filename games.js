let games = [];

const grid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const statsText = document.getElementById("statsText");
const emptyState = document.getElementById("emptyState");
const clearBtn = document.getElementById("clearBtn");

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
      <div class="game-icon" aria-hidden="true">${game.icon || "🎮"}</div>
      <div class="game-title">${escapeHTML(game.title || "Untitled")}</div>
      <div class="game-desc">${escapeHTML(game.description || "")}</div>
    `;

    grid.appendChild(card);
  });

  const total = games.length;
  const shown = list.length;
  if (statsText) statsText.textContent = `${shown} / ${total} games`;

  const isEmpty = shown === 0;
  if (emptyState) emptyState.hidden = !isEmpty;
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

async function loadGames() {
  try {
    // If games.json is next to index.html, this is correct:
    // - root/index.html -> fetch("games.json")
    // - root/games.json exists
    const res = await fetch("games.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading games.json`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("games.json must be an array");

    games = data;
    render(games);
  } catch (err) {
    console.error(err);
    // graceful fallback UI:
    games = [];
    render([]);
    if (statsText) statsText.textContent = "0 / 0 games";
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "Could not load games.json. Check file path + JSON format.";
    }
  }
}

// Wire up events
if (searchInput) searchInput.addEventListener("input", applySearch);

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    applySearch();
    searchInput?.focus();
  });
}

// Start
loadGames();
