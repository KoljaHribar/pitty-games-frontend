(function () {
  "use strict";

  const ROUTES = {
    grid: "/games/grid",
    bingo: "/games/bingo",
    wordle: "/games/wordle",
    connections: "/games/connections",
  };

  const LABELS = {
    grid: "Grid",
    bingo: "Bingo",
    wordle: "Wordle",
    connections: "Connections",
  };

  const toastEl = document.getElementById("toast");
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove("is-visible");
      window.setTimeout(() => {
        toastEl.hidden = true;
      }, 300);
    }, 2600);
  }

  function navigateToGame(gameId) {
    const path = ROUTES[gameId];
    const name = LABELS[gameId] || gameId;

    if (path && window.location.pathname !== path) {
      showToast(`${name} is coming soon — route reserved at ${path}`);
    }
  }

  document.querySelectorAll(".game-card[data-game]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gameId = btn.getAttribute("data-game");
      if (gameId) navigateToGame(gameId);
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });
  });

  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      if (action === "login") {
        showToast("Log in — coming soon");
      } else if (action === "signup") {
        showToast("Sign up — coming soon");
      }
    });
  });
})();
