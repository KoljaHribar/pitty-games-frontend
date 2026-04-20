(function () {
  "use strict";

  // Placeholder game script. The Connections game is not yet implemented —
  // for now the page simply surfaces an "in progress" notice so users
  // understand the card is a planned feature.
  function init() {
    const status = document.getElementById("connections-status");
    if (status) {
      status.textContent = "In progress — check back soon.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
