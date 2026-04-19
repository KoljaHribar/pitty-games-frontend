(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  const GAME_TYPE = "guess_who";

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
  const modalStatsEl = document.getElementById("results-modal-stats");
  const statsBarEl = document.getElementById("guess-who-stats");
  const scoreNumEl = document.getElementById("guess-who-score");
  const streakNumEl = document.getElementById("guess-who-streak");

  function localDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** @param {unknown} v */
  function dateToYmd(v) {
    if (v == null || v === "") return "";
    if (typeof v === "string") return v.slice(0, 10);
    if (v instanceof Date) return localDateKey(v);
    return String(v).slice(0, 10);
  }

  /** @param {unknown} raw */
  function normalizeGuessList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => typeof x === "string");
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

  function clearHistoryUi() {
    if (!historyEl) return;
    historyEl.innerHTML = "";
  }

  function appendHistory(guessText) {
    if (!historyEl) return;
    const li = document.createElement("li");
    li.textContent = guessText;
    historyEl.appendChild(li);
  }

  /**
   * @param {number} wins
   * @param {number} streak
   */
  function updateStatsBar(wins, streak) {
    if (scoreNumEl) scoreNumEl.textContent = String(wins);
    if (streakNumEl) streakNumEl.textContent = String(streak);
    if (statsBarEl) statsBarEl.hidden = false;
  }

  /**
   * @param {"win" | "loss"} outcome
   * @param {string} targetFullName
   * @param {{ totalWins: number, currentStreak: number }} stats
   */
  function showResultsModal(outcome, targetFullName, stats) {
    if (!modalEl || !modalTitleEl || !modalTargetEl) return;
    const win = outcome === "win";
    modalTitleEl.textContent = win
      ? "You won!"
      : "Nice try — better luck tomorrow.";
    modalTargetEl.textContent = `Today’s student: ${targetFullName}`;
    if (modalStatsEl) {
      modalStatsEl.innerHTML = `Score: <strong>${stats.totalWins}</strong> · Current streak: <strong>${stats.currentStreak}</strong>`;
    }
    modalEl.hidden = false;
  }

  /**
   * @param {unknown} client
   * @param {Record<string, unknown>} row
   */
  async function upsertGameStats(client, row) {
    const payload = {
      user_id: row.user_id,
      game_type: row.game_type,
      total_wins: row.total_wins,
      current_streak: row.current_streak,
      last_played_date: row.last_played_date,
      today_status: row.today_status,
      today_guesses: row.today_guesses,
    };
    const { error } = await client.from("user_game_stats").upsert(payload, {
      onConflict: "user_id,game_type",
    });
    if (error) throw error;
  }

  /**
   * @param {unknown} client
   * @param {string} userId
   * @param {string} todayStr
   */
  async function ensureGuessWhoStats(client, userId, todayStr) {
    const { data: existing, error: selErr } = await client
      .from("user_game_stats")
      .select("*")
      .eq("user_id", userId)
      .eq("game_type", GAME_TYPE)
      .maybeSingle();

    if (selErr) throw selErr;

    if (!existing) {
      const insertRow = {
        user_id: userId,
        game_type: GAME_TYPE,
        total_wins: 0,
        current_streak: 0,
        last_played_date: todayStr,
        today_status: "in_progress",
        today_guesses: [],
      };
      const { data: created, error: insErr } = await client
        .from("user_game_stats")
        .insert(insertRow)
        .select("*")
        .single();
      if (insErr) throw insErr;
      return created;
    }

    const lastDay = dateToYmd(existing.last_played_date);
    if (lastDay !== todayStr) {
      const { data: updated, error: updErr } = await client
        .from("user_game_stats")
        .update({
          today_status: "in_progress",
          today_guesses: [],
          last_played_date: todayStr,
        })
        .eq("user_id", userId)
        .eq("game_type", GAME_TYPE)
        .select("*")
        .single();
      if (updErr) throw updErr;
      return updated;
    }

    return existing;
  }

  function init() {
    if (!supabase) {
      showError(
        "Could not connect to Supabase. Check your network and that the Supabase script loaded, then refresh."
      );
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    void (async () => {
      hideError();
      const todayStr = localDateKey(new Date());

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        showError(
          "Log in on the Pitty Games hub to play Guess Who and save your progress."
        );
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) inputEl.disabled = true;
        return;
      }

      /** @type {Record<string, unknown> | null} */
      let targetProfile = null;
      let targetFullName = "";

      /** @type {Record<string, unknown>} */
      let gameStats;
      try {
        gameStats = await ensureGuessWhoStats(supabase, user.id, todayStr);
      } catch (e) {
        console.error(e);
        showError("Could not load your game stats. Please try again later.");
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) inputEl.disabled = true;
        return;
      }

      const totalWins = Number(gameStats.total_wins) || 0;
      const currentStreak = Number(gameStats.current_streak) || 0;
      updateStatsBar(totalWins, currentStreak);

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

      const allProfiles = namesData || [];

      const todayStatus = String(gameStats.today_status || "in_progress");
      const wrongGuesses = normalizeGuessList(gameStats.today_guesses);

      let incorrectGuesses = wrongGuesses.length;
      let gameOver = todayStatus === "won" || todayStatus === "lost";

      if (todayStatus === "won" || todayStatus === "lost") {
        clearHistoryUi();
        wrongGuesses.forEach((g) => appendHistory(g));
        renderClues(targetProfile, incorrectGuesses);
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) {
          inputEl.disabled = true;
          inputEl.value = "";
        }
        showResultsModal(todayStatus === "won" ? "win" : "loss", targetFullName, {
          totalWins,
          currentStreak,
        });
        return;
      }

      clearHistoryUi();
      wrongGuesses.forEach((g) => appendHistory(g));
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

      async function endGame(outcome) {
        gameOver = true;
        if (submitBtn) submitBtn.disabled = true;
        if (inputEl) {
          inputEl.disabled = true;
          inputEl.value = "";
        }
        closeDropdown();

        const wins = Number(gameStats.total_wins) || 0;
        const streak = Number(gameStats.current_streak) || 0;

        if (outcome === "win") {
          gameStats.total_wins = wins + 1;
          gameStats.current_streak = streak + 1;
          gameStats.today_status = "won";
        } else {
          gameStats.current_streak = 0;
          gameStats.today_status = "lost";
        }
        gameStats.last_played_date = todayStr;

        try {
          await upsertGameStats(supabase, gameStats);
        } catch (e) {
          console.error(e);
          showError("Could not save your result. Check your connection.");
        }

        updateStatsBar(
          Number(gameStats.total_wins) || 0,
          Number(gameStats.current_streak) || 0
        );

        showResultsModal(outcome, targetFullName, {
          totalWins: Number(gameStats.total_wins) || 0,
          currentStreak: Number(gameStats.current_streak) || 0,
        });
      }

      async function onGuess() {
        if (gameOver || !targetProfile || !inputEl) return;
        const guessRaw = inputEl.value;
        const guessNorm = normName(guessRaw);
        if (!guessNorm) return;

        const targetNorm = normName(targetFullName);
        if (guessNorm === targetNorm) {
          await endGame("win");
          return;
        }

        const trimmed = guessRaw.trim();
        appendHistory(trimmed);
        inputEl.value = "";
        closeDropdown();

        const nextGuesses = normalizeGuessList(gameStats.today_guesses).concat(
          trimmed
        );
        gameStats.today_guesses = nextGuesses;
        incorrectGuesses = nextGuesses.length;

        try {
          await upsertGameStats(supabase, gameStats);
        } catch (e) {
          console.error(e);
          showError("Could not save your guess. Check your connection.");
        }

        if (incorrectGuesses >= CLUE_ORDER.length) {
          renderClues(targetProfile, incorrectGuesses - 1);
          await endGame("loss");
          return;
        }

        renderClues(targetProfile, incorrectGuesses);
      }

      if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          void onGuess();
        });
      }
    })();
  }

  init();
})();
