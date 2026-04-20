(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  const TABLE = "study_abroad_programs";
  const VISIBLE_STACK_SIZE = 4;

  const SWIPE_THRESHOLD_PX = 120;
  const SWIPE_VELOCITY = 0.4;
  const FLY_DISTANCE = 1500;
  const ROTATION_FACTOR = 0.08;
  const STAMP_FADE_DISTANCE = 100;

  let supabase = null;
  const supabaseGlobal = window.supabase;
  if (supabaseGlobal && typeof supabaseGlobal.createClient === "function") {
    try {
      supabase = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.error("Supabase client failed to initialize:", err);
    }
  } else {
    console.error(
      "Supabase library not loaded. Check the script URL and network access."
    );
  }

  const deck = document.getElementById("study-abroad-deck");
  const emptyState = document.getElementById("study-abroad-empty");
  const resultEl = document.getElementById("study-abroad-result");
  const resultNameEl = resultEl?.querySelector(".study-abroad-result__name");
  const resultLocationEl = resultEl?.querySelector(
    ".study-abroad-result__location"
  );
  const resultImageEl = resultEl?.querySelector(".study-abroad-result__image");
  const resultWhyTextEl = resultEl?.querySelector(
    ".study-abroad-result__why-text"
  );
  const resultMetaEl = resultEl?.querySelector(".study-abroad-result__meta");
  const resultHighlightEl = resultEl?.querySelector(
    ".study-abroad-result__highlight"
  );
  const resultHighlightTextEl = resultEl?.querySelector(
    ".study-abroad-result__highlight-text"
  );
  const actionsWrapEl = document.querySelector(".study-abroad-actions");
  const passBtn = document.getElementById("study-abroad-pass");
  const likeBtn = document.getElementById("study-abroad-like");
  const restartBtn = document.getElementById("study-abroad-restart");

  if (!deck) return;

  /** @typedef {{ id: string|number, name: string, location: string, image_url: string|null, pro_text: string|null, con_text: string|null, feature_vector: number[] }} Program */

  /** @type {Program[]} */
  let remainingPrograms = [];
  /** @type {Program[]} */
  let likedPrograms = [];
  /**
   * Running mean of feature_vectors of all liked programs.
   * Sized to match the table's feature_vector length on first fetch.
   * @type {number[]}
   */
  let userProfileVector = [];
  let likedCount = 0;
  let isAnimating = false;

  /**
   * Euclidean distance between two equal-length numeric arrays.
   * Returns Infinity if shapes mismatch (so unusable rows sink to the bottom).
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number}
   */
  function euclideanDistance(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return Number.POSITIVE_INFINITY;
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = Number(a[i]);
      const bi = Number(b[i]);
      if (!Number.isFinite(ai) || !Number.isFinite(bi)) {
        return Number.POSITIVE_INFINITY;
      }
      const d = ai - bi;
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  /**
   * Update userProfileVector with a newly liked feature_vector using a
   * running mean: mean_n = mean_{n-1} + (x_n - mean_{n-1}) / n.
   * @param {number[]} likedVector
   */
  function incorporateLikedVector(likedVector) {
    if (!Array.isArray(likedVector) || !likedVector.length) return;

    if (
      !userProfileVector.length ||
      userProfileVector.length !== likedVector.length
    ) {
      userProfileVector = new Array(likedVector.length).fill(0);
      likedCount = 0;
    }

    likedCount += 1;
    for (let i = 0; i < userProfileVector.length; i++) {
      const x = Number(likedVector[i]) || 0;
      userProfileVector[i] =
        userProfileVector[i] + (x - userProfileVector[i]) / likedCount;
    }
  }

  /**
   * Sort remainingPrograms in-place by ascending Euclidean distance to
   * userProfileVector. No-op until the user has liked at least one program.
   */
  function resortRemainingByProfile() {
    if (!likedCount || !userProfileVector.length) return;
    remainingPrograms.sort((p1, p2) => {
      const d1 = euclideanDistance(userProfileVector, p1.feature_vector);
      const d2 = euclideanDistance(userProfileVector, p2.feature_vector);
      return d1 - d2;
    });
  }

  /**
   * @param {Record<string, unknown>} row
   */
  function normalizeRow(row) {
    const fv = Array.isArray(row.feature_vector)
      ? row.feature_vector.map((n) => Number(n))
      : [];
    return {
      id: /** @type {string | number} */ (row.id),
      name: String(row.name || "Untitled program"),
      location: String(row.location || ""),
      image_url:
        typeof row.image_url === "string" && row.image_url.trim() !== ""
          ? row.image_url
          : null,
      pro_text:
        typeof row.pro_text === "string" && row.pro_text.trim() !== ""
          ? row.pro_text
          : null,
      con_text:
        typeof row.con_text === "string" && row.con_text.trim() !== ""
          ? row.con_text
          : null,
      feature_vector: fv,
    };
  }

  /**
   * @param {ReturnType<typeof normalizeRow>} program
   */
  function buildCard(program) {
    const card = document.createElement("article");
    card.className = "program-card";
    card.dataset.programId = String(program.id);

    const imageMarkup = program.image_url
      ? `<img src="${program.image_url}" alt="" loading="lazy" />`
      : `<span class="program-card__image-placeholder">Program image</span>`;

    card.innerHTML = `
      <div class="program-card__image" aria-hidden="true">
        ${imageMarkup}
      </div>
      <div class="program-card__body">
        <h4 class="program-card__name"></h4>
        <p class="program-card__location"></p>
        <div class="program-card__ai">
          <div class="program-card__ai-row program-card__ai-row--pro">
            <span class="program-card__ai-label">AI Pro</span>
            <p class="program-card__ai-text"></p>
          </div>
          <div class="program-card__ai-row program-card__ai-row--con">
            <span class="program-card__ai-label">AI Con</span>
            <p class="program-card__ai-text"></p>
          </div>
        </div>
      </div>
      <div class="program-card__stamp program-card__stamp--like" aria-hidden="true">Like</div>
      <div class="program-card__stamp program-card__stamp--pass" aria-hidden="true">Pass</div>
    `;

    card.querySelector(".program-card__name").textContent = program.name;
    card.querySelector(".program-card__location").textContent = program.location;
    const aiTexts = card.querySelectorAll(".program-card__ai-text");
    aiTexts[0].textContent =
      program.pro_text || "We'll surface a reason this could fit once we have one.";
    aiTexts[1].textContent =
      program.con_text || "No notable drawback recorded for this program yet.";

    return card;
  }

  function setActionsVisible(visible) {
    if (!actionsWrapEl) return;
    actionsWrapEl.hidden = !visible;
  }

  /**
   * Pick the liked program closest to the userProfileVector (smallest
   * Euclidean distance). With one like, that's the liked program itself;
   * with many, it's the liked program most representative of the running mean.
   * @returns {Program | null}
   */
  function pickTopMatch() {
    if (!likedPrograms.length) return null;
    if (!userProfileVector.length) return likedPrograms[0];
    let best = likedPrograms[0];
    let bestDist = euclideanDistance(userProfileVector, best.feature_vector);
    for (let i = 1; i < likedPrograms.length; i++) {
      const p = likedPrograms[i];
      const d = euclideanDistance(userProfileVector, p.feature_vector);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Build a short, human-readable reasoning string explaining why this
   * program was selected as the top match.
   * @param {Program} match
   * @returns {string}
   */
  function buildReasoning(match) {
    if (likedCount <= 1) {
      return `You only liked one program, so ${match.name} is your match by default — a clear sign it stood out to you.`;
    }
    const likedLabel = likedCount === 1 ? "program" : "programs";
    return `Out of the ${likedCount} ${likedLabel} you liked, ${match.name} most closely reflects the pattern of your preferences — it sits closest to the average of everything you swiped right on.`;
  }

  function showResultScreen() {
    if (!resultEl) return;

    const match = pickTopMatch();
    deck.innerHTML = "";
    deck.hidden = true;
    if (emptyState) emptyState.hidden = true;
    setActionsVisible(false);

    if (!match) {
      resultEl.hidden = true;
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent =
          "You didn't like any programs. Start over to try again.";
      }
      return;
    }

    if (resultNameEl) resultNameEl.textContent = match.name;
    if (resultLocationEl) resultLocationEl.textContent = match.location;

    if (resultImageEl) {
      resultImageEl.innerHTML = "";
      if (match.image_url) {
        const img = document.createElement("img");
        img.src = match.image_url;
        img.alt = `${match.name} in ${match.location}`;
        img.loading = "lazy";
        resultImageEl.appendChild(img);
      }
    }

    if (resultMetaEl) {
      const likedLabel = likedCount === 1 ? "program" : "programs";
      resultMetaEl.innerHTML = `Based on <strong>${likedCount}</strong> liked ${likedLabel}.`;
    }

    if (resultWhyTextEl) {
      resultWhyTextEl.textContent = buildReasoning(match);
    }

    if (resultHighlightEl && resultHighlightTextEl) {
      if (match.pro_text) {
        resultHighlightTextEl.textContent = match.pro_text;
        resultHighlightEl.hidden = false;
      } else {
        resultHighlightTextEl.textContent = "";
        resultHighlightEl.hidden = true;
      }
    }

    resultEl.hidden = false;
  }

  function render() {
    deck.innerHTML = "";

    if (remainingPrograms.length === 0) {
      showResultScreen();
      return;
    }

    if (resultEl) resultEl.hidden = true;
    if (emptyState) emptyState.hidden = true;
    deck.hidden = false;
    setActionsVisible(true);

    remainingPrograms.slice(0, VISIBLE_STACK_SIZE).forEach((program, index) => {
      const card = buildCard(program);
      card.dataset.stackIndex = String(index);
      deck.appendChild(card);
    });

    attachTopCardGestures();
  }

  let activeHammer = null;

  function attachTopCardGestures() {
    if (activeHammer) {
      activeHammer.destroy();
      activeHammer = null;
    }

    const topCard = deck.querySelector('.program-card[data-stack-index="0"]');
    if (!topCard) return;

    if (typeof Hammer === "undefined") {
      console.warn("Hammer.js not loaded; swipe gestures disabled.");
      return;
    }

    const stampLike = topCard.querySelector(".program-card__stamp--like");
    const stampPass = topCard.querySelector(".program-card__stamp--pass");

    const hammer = new Hammer.Manager(topCard, {
      recognizers: [
        [Hammer.Pan, { direction: Hammer.DIRECTION_ALL, threshold: 5 }],
      ],
    });

    hammer.on("panstart", function () {
      topCard.classList.add("is-dragging");
    });

    hammer.on("panmove", function (ev) {
      const x = ev.deltaX;
      const y = ev.deltaY;
      const rotation = x * ROTATION_FACTOR;
      topCard.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;

      const likeOpacity = Math.min(1, Math.max(0, x / STAMP_FADE_DISTANCE));
      const passOpacity = Math.min(1, Math.max(0, -x / STAMP_FADE_DISTANCE));
      if (stampLike) stampLike.style.opacity = String(likeOpacity);
      if (stampPass) stampPass.style.opacity = String(passOpacity);
    });

    hammer.on("panend pancancel", function (ev) {
      topCard.classList.remove("is-dragging");

      const x = ev.deltaX;
      const vx = ev.velocityX;
      const passedThreshold =
        Math.abs(x) > SWIPE_THRESHOLD_PX || Math.abs(vx) > SWIPE_VELOCITY;

      if (passedThreshold && x > 0) {
        flyOff(topCard, "like");
      } else if (passedThreshold && x < 0) {
        flyOff(topCard, "pass");
      } else {
        topCard.style.transform = "";
        if (stampLike) stampLike.style.opacity = "0";
        if (stampPass) stampPass.style.opacity = "0";
      }
    });

    activeHammer = hammer;
  }

  /**
   * @param {HTMLElement} card
   * @param {"like" | "pass"} direction
   */
  function flyOff(card, direction) {
    if (!card || isAnimating) return;
    isAnimating = true;

    const program = remainingPrograms[0];
    const isLike = direction === "like";
    const targetX = isLike ? FLY_DISTANCE : -FLY_DISTANCE;
    const rotation = isLike ? 25 : -25;

    if (isLike && program && Array.isArray(program.feature_vector)) {
      incorporateLikedVector(program.feature_vector);
      likedPrograms.push(program);
    }

    if (activeHammer) {
      activeHammer.destroy();
      activeHammer = null;
    }

    card.classList.add("is-flying");
    card.classList.remove("is-dragging");
    requestAnimationFrame(function () {
      card.style.transform = `translate(${targetX}px, 0) rotate(${rotation}deg)`;
      card.style.opacity = "0";
    });

    let cleanedUp = false;
    const cleanup = function () {
      if (cleanedUp) return;
      cleanedUp = true;
      card.removeEventListener("transitionend", cleanup);

      remainingPrograms.shift();

      if (isLike) {
        resortRemainingByProfile();
      }

      isAnimating = false;
      render();
    };
    card.addEventListener("transitionend", cleanup);
    setTimeout(cleanup, 600);
  }

  /** @param {"like" | "pass"} direction */
  function programmaticSwipe(direction) {
    if (isAnimating) return;
    const topCard = deck.querySelector('.program-card[data-stack-index="0"]');
    if (!topCard) return;
    flyOff(/** @type {HTMLElement} */ (topCard), direction);
  }

  if (likeBtn) {
    likeBtn.addEventListener("click", function () {
      programmaticSwipe("like");
    });
  }

  if (passBtn) {
    passBtn.addEventListener("click", function () {
      programmaticSwipe("pass");
    });
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      if (resultEl) resultEl.hidden = true;
      void loadPrograms();
    });
  }

  function showLoadingState() {
    deck.innerHTML = "";
    deck.hidden = false;
    if (resultEl) resultEl.hidden = true;
    setActionsVisible(false);
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "Loading programs…";
    }
  }

  function showErrorState(message) {
    deck.innerHTML = "";
    deck.hidden = false;
    if (resultEl) resultEl.hidden = true;
    setActionsVisible(false);
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = message;
    }
  }

  function resetEmptyStateText() {
    if (emptyState) {
      emptyState.textContent = "You're out of programs! Refresh to start over.";
    }
  }

  async function loadPrograms() {
    if (!supabase) {
      showErrorState(
        "Could not connect to Supabase. Refresh once your network is back."
      );
      return;
    }

    showLoadingState();

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, location, image_url, pro_text, con_text, feature_vector");

    if (error) {
      console.error("Failed to load study abroad programs:", error);
      showErrorState("Could not load programs. Try again later.");
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    remainingPrograms = rows.map(normalizeRow);
    likedPrograms = [];

    const firstWithVector = remainingPrograms.find(
      (p) => Array.isArray(p.feature_vector) && p.feature_vector.length > 0
    );
    if (firstWithVector) {
      userProfileVector = new Array(firstWithVector.feature_vector.length).fill(0);
    } else {
      userProfileVector = [];
    }
    likedCount = 0;

    if (resultEl) resultEl.hidden = true;
    resetEmptyStateText();
    render();
  }

  void loadPrograms();
})();
