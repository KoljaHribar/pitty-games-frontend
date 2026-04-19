(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  let supabase = null;
  const supabaseGlobal = window.supabase;
  if (
    supabaseGlobal &&
    typeof supabaseGlobal.createClient === "function"
  ) {
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

  const CLUE_ORDER = [
    "year",
    "major",
    "freshman_dorm",
    "favorite_dining_option",
    "favorite_pitt_club",
    "high_school",
  ];

  const CLUE_LABELS = {
    year: "Year",
    major: "Major",
    freshman_dorm: "Freshman dorm",
    favorite_dining_option: "Favorite dining",
    favorite_pitt_club: "Favorite Pitt club",
    high_school: "High school",
  };

  const clueContainerEl = document.getElementById("clue-container");
  const inputEl = document.getElementById("guess-who-input");
  const dropdownEl = document.getElementById("guess-who-autocomplete");
  const submitBtn = document.getElementById("guess-who-submit");
  const historyEl = document.getElementById("guess-who-history");
  const errorEl = document.getElementById("guess-who-error");
  const modalEl = document.getElementById("results-modal");
  const modalTitleEl = document.getElementById("results-modal-title");
  const modalTargetEl = document.getElementById("results-modal-target");

  function localDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function storageKeyForDate(dateStr) {
    return `pittyGuessWho_${dateStr}`;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function normName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function fullNameFromParts(first, last) {
    return `${first || ""} ${last || ""}`.trim();
  }

  function formatClueValue(key, value) {
    if (value == null || value === "") return "—";
    return String(value);
  }

  /**
   * @param {Record<string, unknown>} profile
   * @param {number} incorrectCount
   */
  function renderClues(profile, incorrectCount) {
    if (!clueContainerEl || !profile) return;
    const n = Math.min(CLUE_ORDER.length, incorrectCount + 1);
    clueContainerEl.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const key = CLUE_ORDER[i];
      const label = CLUE_LABELS[key] || key;
      const raw = profile[key];
      const card = document.createElement("article");
      card.className = "guess-who-clue-card";
      card.innerHTML = `
        <span class="guess-who-clue-card__label"></span>
        <span class="guess-who-clue-card__value"></span>
      `;
      card.querySelector(".guess-who-clue-card__label").textContent = label;
      card.querySelector(".guess-who-clue-card__value").textContent =
        formatClueValue(key, raw);
      clueContainerEl.appendChild(card);
    }
  }

  function appendHistory(guessText) {
    if (!historyEl) return;
    const li = document.createElement("li");
    li.textContent = guessText;
    historyEl.appendChild(li);
  }

  function getPlayedState(todayStr) {
    try {
      const raw = localStorage.getItem(storageKeyForDate(todayStr));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== todayStr) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function savePlayedState(todayStr, payload) {
    try {
      localStorage.setItem(
        storageKeyForDate(todayStr),
        JSON.stringify({ ...payload, date: todayStr })
      );
    } catch (e) {
      console.warn("Could not save game state:", e);
    }
  }

  /**
   * @param {"win" | "loss"} outcome
   * @param {string} targetFullName
   */
  function showResultsModal(outcome, targetFullName) {
    if (!modalEl || !modalTitleEl || !modalTargetEl) return;
    const win = outcome === "win";
    modalTitleEl.textContent = win
      ? "You won!"
      : "Nice try — better luck tomorrow.";
    modalTargetEl.textContent = `Today’s student: ${targetFullName}`;
    modalEl.hidden = false;
  }

  function init() {
    const todayStr = localDateKey(new Date());
    const played = getPlayedState(todayStr);

    /** @type {Record<string, unknown> | null} */
    let targetProfile = null;
    let targetFullName = "";

    if (played && played.outcome && played.targetName != null) {
      showResultsModal(played.outcome, played.targetName);
    }

    if (!supabase) {
      showError(
        "Could not connect to Supabase. Check your network and that the Supabase script loaded, then refresh."
      );
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    /** @type {{ id: string, first_name: string | null, last_name: string | null }[]} */
    let allProfiles = [];
    let incorrectGuesses = played
      ? Number(played.incorrectGuesses) || 0
      : 0;
    let gameOver = !!played;

    void (async () => {
      hideError();
      const { data: puzzleRow, error: puzzleErr } = await supabase
        .from("daily_puzzles")
        .select("target_profile_id")
        .eq("puzzle_date", todayStr)
        .maybeSingle();

      if (puzzleErr) {
        console.error(puzzleErr);
        showError("Could not load today’s puzzle. Please try again later.");
        return;
      }
      if (!puzzleRow || !puzzleRow.target_profile_id) {
        showError("There is no puzzle scheduled for today yet.");
        return;
      }

      const targetId = puzzleRow.target_profile_id;

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (profileErr || !profileRow) {
        console.error(profileErr);
        showError("Could not load the mystery profile.");
        return;
      }

      targetProfile = profileRow;
      targetFullName = fullNameFromParts(
        profileRow.first_name,
        profileRow.last_name
      );

      const { data: namesData, error: namesErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      if (namesErr) {
        console.error(namesErr);
        showError("Could not load the name list for search.");
        return;
      }

      allProfiles = namesData || [];

      if (played) {
        incorrectGuesses = Number(played.incorrectGuesses) || 0;
        renderClues(targetProfile, incorrectGuesses);
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) inputEl.disabled = true;
        return;
      }

      incorrectGuesses = 0;
      renderClues(targetProfile, incorrectGuesses);

      /** @type {number} */
      let activeIndex = -1;

      function filteredProfiles(query) {
        const q = normName(query);
        if (!q) return [];
        return allProfiles.filter((p) => {
          const fn = normName(p.first_name);
          const ln = normName(p.last_name);
          const full = `${fn} ${ln}`.trim();
          return full.includes(q) || fn.startsWith(q) || ln.startsWith(q);
        });
      }

      function renderDropdown(matches) {
        if (!dropdownEl) return;
        dropdownEl.innerHTML = "";
        activeIndex = matches.length ? 0 : -1;
        const max = 12;
        const slice = matches.slice(0, max);
        slice.forEach((p, i) => {
          const li = document.createElement("li");
          li.setAttribute("role", "option");
          li.dataset.index = String(i);
          li.textContent = fullNameFromParts(p.first_name, p.last_name);
          if (i === 0) li.classList.add("is-active");
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (inputEl) {
              inputEl.value = li.textContent || "";
            }
            dropdownEl.hidden = true;
          });
          dropdownEl.appendChild(li);
        });
        dropdownEl.hidden = slice.length === 0;
      }

      function onInput() {
        if (gameOver || !inputEl) return;
        const q = inputEl.value;
        const matches = filteredProfiles(q);
        renderDropdown(matches);
      }

      function closeDropdown() {
        if (dropdownEl) dropdownEl.hidden = true;
        activeIndex = -1;
      }

      if (inputEl) {
        inputEl.addEventListener("input", onInput);
        inputEl.addEventListener("focus", onInput);
        inputEl.addEventListener("blur", () => {
          window.setTimeout(closeDropdown, 120);
        });
        inputEl.addEventListener("keydown", (e) => {
          if (!dropdownEl || dropdownEl.hidden) return;
          const items = dropdownEl.querySelectorAll("li");
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            items.forEach((el, i) =>
              el.classList.toggle("is-active", i === activeIndex)
            );
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            items.forEach((el, i) =>
              el.classList.toggle("is-active", i === activeIndex)
            );
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            const li = items[activeIndex];
            if (li && inputEl) {
              inputEl.value = li.textContent || "";
              closeDropdown();
            }
          } else if (e.key === "Escape") {
            closeDropdown();
          }
        });
      }

      document.addEventListener("click", (e) => {
        const t = e.target;
        if (
          dropdownEl &&
          inputEl &&
          t instanceof Node &&
          !dropdownEl.contains(t) &&
          !inputEl.contains(t)
        ) {
          closeDropdown();
        }
      });

      function endGame(outcome) {
        gameOver = true;
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) {
          inputEl.disabled = true;
          inputEl.value = "";
        }
        closeDropdown();
        showResultsModal(outcome, targetFullName);
        savePlayedState(todayStr, {
          outcome,
          targetName: targetFullName,
          incorrectGuesses,
        });
      }

      function onGuess() {
        if (gameOver || !targetProfile || !inputEl) return;
        const guessRaw = inputEl.value;
        const guessNorm = normName(guessRaw);
        if (!guessNorm) return;

        const targetNorm = normName(targetFullName);
        if (guessNorm === targetNorm) {
          endGame("win");
          return;
        }

        appendHistory(guessRaw.trim());
        inputEl.value = "";
        closeDropdown();

        incorrectGuesses += 1;
        if (incorrectGuesses >= CLUE_ORDER.length) {
          renderClues(targetProfile, incorrectGuesses - 1);
          endGame("loss");
          return;
        }

        renderClues(targetProfile, incorrectGuesses);
      }

      if (submitBtn) {
        submitBtn.addEventListener("click", onGuess);
      }
    })();
  }

  init();
})();
