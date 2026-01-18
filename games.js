const games = [
  {
    title: "Tetris",
    description: "Stack blocks and clear lines",
    icon: "🧱",
    path: "games/tetris/index.html"
  },
  {
    title: "Snake",
    description: "Eat, grow, and don't crash",
    icon: "🐍",
    path: "games/snake/index.html"
  },
  {
    title: "Pong",
    description: "Classic paddle vs paddle",
    icon: "🏓",
    path: "games/pong/index.html"
  },
  {
    title: "Breakout",
    description: "Smash bricks with the ball",
    icon: "🧨",
    path: "games/breakout/index.html"
  },
  {
    title: "Space Invaders",
    description: "Defend Earth from above",
    icon: "👾",
    path: "games/space-invaders/index.html"
  }
];

const grid = document.getElementById("gamesGrid");

games.forEach(game => {
  const card = document.createElement("div");
  card.className = "game-card";
  card.onclick = () => window.location.href = game.path;

  card.innerHTML = `
    <div class="game-icon">${game.icon}</div>
    <div class="game-title">${game.title}</div>
    <div class="game-desc">${game.description}</div>
  `;

  grid.appendChild(card);
});
