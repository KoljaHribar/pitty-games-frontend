(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  const GAME_TYPE = "wordle";
  const MAX_GUESSES = 5;

  const KEY_RANK = { correct: 3, present: 2, absent: 1 };

  /** @type {unknown} */
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

  const gridEl = document.getElementById("wordle-grid");
  const keyboardEl = document.getElementById("wordle-keyboard");
  const errorEl = document.getElementById("wordle-error");
  const targetKindEl = document.getElementById("wordle-target-kind");
  const lengthLineEl = document.getElementById("wordle-length-line");
  const modalEl = document.getElementById("results-modal");
  const modalTitleEl = document.getElementById("results-modal-title");
  const modalTargetEl = document.getElementById("results-modal-target");
  const modalStatsEl = document.getElementById("results-modal-stats");
  const statsBarEl = document.getElementById("wordle-stats");
  const scoreNumEl = document.getElementById("wordle-score");
  const streakNumEl = document.getElementById("wordle-streak");

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

  function fullNameFromParts(first, last) {
    return `${first || ""} ${last || ""}`.trim();
  }

  /**
   * @param {string} raw
   * @returns {string}
   */
  function cleanNamePart(raw) {
    return String(raw || "")
      .replace(/[\s-]+/g, "")
      .toUpperCase();
  }

  /**
   * @param {string} target
   * @param {string} guess
   * @returns {("correct" | "present" | "absent")[]}
   */
  function evaluateGuess(target, guess) {
    const t = target.split("");
    const g = guess.split("");
    /** @type {("correct" | "present" | "absent")[]} */
    const result = g.map(() => "absent");
    const usedT = t.map(() => false);

    for (let i = 0; i < g.length; i++) {
      if (g[i] === t[i]) {
        result[i] = "correct";
        usedT[i] = true;
      }
    }
    for (let i = 0; i < g.length; i++) {
      if (result[i] === "correct") continue;
      const ch = g[i];
      const j = t.findIndex((tc, idx) => tc === ch && !usedT[idx]);
      if (j !== -1) {
        result[i] = "present";
        usedT[j] = true;
      }
    }
    return result;
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
    modalTargetEl.textContent = `Today’s answer: ${targetFullName}`;
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
   * Same day-rollover and insert behavior as Guess Who, for Wordle rows.
   * @param {unknown} client
   * @param {string} userId
   * @param {string} todayStr
   */
  async function ensureWordleStats(client, userId, todayStr) {
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

  /**
   * @param {number} wordLen
   * @returns {HTMLElement[][]}
   */
  function buildGrid(wordLen) {
    if (!gridEl) return [];
    gridEl.innerHTML = "";
    gridEl.style.setProperty("--wordle-len", String(wordLen));
    /** @type {HTMLElement[][]} */
    const cells = [];
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement("div");
      row.className = "wordle-row";
      row.setAttribute("role", "row");
      cells[r] = [];
      for (let c = 0; c < wordLen; c++) {
        const cell = document.createElement("div");
        cell.className = "wordle-cell";
        cell.setAttribute("role", "gridcell");
        row.appendChild(cell);
        cells[r][c] = cell;
      }
      gridEl.appendChild(row);
    }
    return cells;
  }

  /**
   * @param {HTMLElement[][]} cells
   * @param {number} row
   * @param {string} text
   */
  function setRowDraft(cells, row, text) {
    const len = cells[row].length;
    for (let c = 0; c < len; c++) {
      const ch = text[c] || "";
      const el = cells[row][c];
      el.textContent = ch;
      el.classList.toggle("wordle-cell--filled", Boolean(ch));
      el.classList.remove(
        "wordle-cell--correct",
        "wordle-cell--present",
        "wordle-cell--absent"
      );
    }
  }

  /**
   * @param {HTMLElement[][]} cells
   * @param {number} row
   * @param {string} guess
   * @param {("correct" | "present" | "absent")[]} states
   */
  function lockRowWithStates(cells, row, guess, states) {
    const len = cells[row].length;
    for (let c = 0; c < len; c++) {
      const el = cells[row][c];
      el.textContent = guess[c] || "";
      el.classList.remove("wordle-cell--filled");
      el.classList.remove(
        "wordle-cell--correct",
        "wordle-cell--present",
        "wordle-cell--absent"
      );
      const st = states[c];
      if (st === "correct") el.classList.add("wordle-cell--correct");
      else if (st === "present") el.classList.add("wordle-cell--present");
      else el.classList.add("wordle-cell--absent");
    }
  }

  /**
   * @param {Map<string, HTMLButtonElement>} keyMap
   * @param {string} guess
   * @param {("correct" | "present" | "absent")[]} states
   */
  function updateKeyboardColors(keyMap, guess, states) {
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const btn = keyMap.get(ch);
      if (!btn) continue;
      const st = states[i];
      const prev = btn.dataset.evalState || "";
      const prevRank =
        prev === "correct" || prev === "present" || prev === "absent"
          ? KEY_RANK[prev]
          : 0;
      if (KEY_RANK[st] > prevRank) {
        btn.dataset.evalState = st;
        btn.classList.remove(
          "wordle-key--correct",
          "wordle-key--present",
          "wordle-key--absent"
        );
        btn.classList.add(`wordle-key--${st}`);
      }
    }
  }

  function setKeyboardDisabled(disabled) {
    if (!keyboardEl) return;
    keyboardEl.querySelectorAll("button").forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  /**
   * @returns {Map<string, HTMLButtonElement>}
   */
  function buildKeyboard() {
    const map = new Map();
    if (!keyboardEl) return map;
    keyboardEl.innerHTML = "";
    const rows = [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
    ];
    rows.forEach((keys) => {
      const row = document.createElement("div");
      row.className = "wordle-keyboard__row";
      keys.forEach((k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wordle-key";
        if (k === "ENTER" || k === "BACKSPACE") {
          btn.classList.add("wordle-key--wide");
          btn.textContent = k === "ENTER" ? "Enter" : "⌫";
          btn.dataset.key = k;
        } else {
          btn.textContent = k;
          btn.dataset.key = k;
          map.set(k, btn);
        }
        row.appendChild(btn);
      });
      keyboardEl.appendChild(row);
    });
    return map;
  }

  function init() {
    if (!supabase) {
      showError(
        "Could not connect to Supabase. Check your network and that the Supabase script loaded, then refresh."
      );
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
          "Log in on the Pitty Games hub to play Wordle and save your progress."
        );
        return;
      }

      /** @type {Record<string, unknown>} */
      let gameStats;
      try {
        gameStats = await ensureWordleStats(supabase, user.id, todayStr);
      } catch (e) {
        console.error(e);
        showError("Could not load your game stats. Please try again later.");
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

      const targetFullName = fullNameFromParts(
        /** @type {string} */ (profileRow.first_name),
        /** @type {string} */ (profileRow.last_name)
      );

      const targetWord = cleanNamePart(
        typeof profileRow.last_name === "string"
          ? profileRow.last_name
          : ""
      );

      if (!targetWord) {
        showError(
          "Today’s profile does not have a usable last name for Wordle."
        );
        return;
      }

      if (targetKindEl) {
        targetKindEl.textContent = "Target: Last name";
      }
      if (lengthLineEl) {
        lengthLineEl.textContent = `Length: ${targetWord.length} letters`;
      }

      const wordLen = targetWord.length;
      const cells = buildGrid(wordLen);
      const keyMap = buildKeyboard();

      const todayStatus = String(gameStats.today_status || "in_progress");
      const savedGuesses = normalizeGuessList(gameStats.today_guesses).map(
        (g) => cleanNamePart(g)
      );

      let gameOver = todayStatus === "won" || todayStatus === "lost";
      let currentRow = 0;
      let draft = "";

      function refreshDraftRow() {
        if (gameOver) return;
        setRowDraft(cells, currentRow, draft);
      }

      function applySavedGuessesThroughRow(endExclusive) {
        for (let r = 0; r < endExclusive; r++) {
          const g = savedGuesses[r];
          if (!g || g.length !== wordLen) continue;
          const states = evaluateGuess(targetWord, g);
          lockRowWithStates(cells, r, g, states);
          updateKeyboardColors(keyMap, g, states);
        }
      }

      applySavedGuessesThroughRow(savedGuesses.length);

      if (gameOver) {
        setKeyboardDisabled(true);
        showResultsModal(todayStatus === "won" ? "win" : "loss", targetFullName, {
          totalWins,
          currentStreak,
        });
        return;
      }

      async function endGame(outcome) {
        gameOver = true;
        setKeyboardDisabled(true);

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

      async function submitGuess() {
        if (gameOver) return;
        if (draft.length !== wordLen) return;
        const guess = draft.toUpperCase();
        const states = evaluateGuess(targetWord, guess);
        lockRowWithStates(cells, currentRow, guess, states);
        updateKeyboardColors(keyMap, guess, states);

        const nextGuesses = normalizeGuessList(gameStats.today_guesses).concat(
          guess
        );
        gameStats.today_guesses = nextGuesses;
        draft = "";

        try {
          await upsertGameStats(supabase, gameStats);
        } catch (e) {
          console.error(e);
          showError("Could not save your guess. Check your connection.");
        }

        if (guess === targetWord) {
          await endGame("win");
          return;
        }

        if (nextGuesses.length >= MAX_GUESSES) {
          await endGame("loss");
          return;
        }

        currentRow = nextGuesses.length;
        refreshDraftRow();
      }

      if (!gameOver && savedGuesses.length >= MAX_GUESSES) {
        const last = savedGuesses[MAX_GUESSES - 1];
        await endGame(last === targetWord ? "win" : "loss");
        return;
      }

      currentRow = savedGuesses.length;
      draft = "";
      refreshDraftRow();

      function onLetter(ch) {
        if (gameOver) return;
        if (draft.length >= wordLen) return;
        draft += ch;
        refreshDraftRow();
      }

      function onBackspace() {
        if (gameOver) return;
        draft = draft.slice(0, -1);
        refreshDraftRow();
      }

      function handleKeyToken(token) {
        if (token === "BACKSPACE") {
          onBackspace();
          return;
        }
        if (token === "ENTER") {
          void submitGuess();
          return;
        }
        if (token.length === 1 && /[A-Z]/.test(token)) {
          onLetter(token);
        }
      }

      if (keyboardEl) {
        keyboardEl.addEventListener("click", (e) => {
          const t = e.target;
          if (!(t instanceof HTMLElement)) return;
          const btn = t.closest("button[data-key]");
          if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
          const k = btn.dataset.key;
          if (!k) return;
          handleKeyToken(k);
        });
      }

      window.addEventListener("keydown", (e) => {
        if (gameOver) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Backspace") {
          e.preventDefault();
          onBackspace();
        } else if (e.key === "Enter") {
          e.preventDefault();
          void submitGuess();
        } else if (e.key.length === 1) {
          const u = e.key.toUpperCase();
          if (u >= "A" && u <= "Z") {
            e.preventDefault();
            onLetter(u);
          }
        }
      });

      refreshDraftRow();
    })();
  }

  init();
})();
