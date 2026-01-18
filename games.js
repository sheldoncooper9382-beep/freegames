const games = [
  {
    title: "Tetris",
    description: "Stack blocks and clear lines",
    icon: "ph-cube",
    path: "games/tetris/index.html"
  },
  {
    title: "Snake",
    description: "Eat, grow, survive",
    icon: "ph-snake",
    path: "games/snake/index.html"
  },
  {
    title: "Pong",
    description: "Classic paddle duel",
    icon: "ph-tennis-ball",
    path: "games/pong/index.html"
  },
  {
    title: "Breakout",
    description: "Smash every brick",
    icon: "ph-bricks",
    path: "games/breakout/index.html"
  },
  {
    title: "Space Invaders",
    description: "Defend the galaxy",
    icon: "ph-alien",
    path: "games/space-invaders/index.html"
  }
];

const grid = document.getElementById("gamesGrid");

games.forEach(game => {
  const card = document.createElement("div");
  card.className = "game-card";
  card.onclick = () => location.href = game.path;

  card.innerHTML = `
    <div class="game-icon">
      <i class="ph ${game.icon}"></i>
    </div>
    <div class="game-title">${game.title}</div>
    <div class="game-desc">${game.description}</div>
  `;

  grid.appendChild(card);
});
