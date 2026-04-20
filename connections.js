(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  const GAME_TYPE = "connections";

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

  // Columns eligible to serve as the shared trait AND as ABCD options.
  // Name / professor columns are excluded because they're too personal to be a
  // reasonable "three-person match" and too revealing of the student's identity.
  const PROFILE_COLUMNS = [
    { key: "year", label: "Year" },
    { key: "major", label: "Major" },
    { key: "high_school", label: "High school" },
    { key: "freshman_dorm", label: "Freshman dorm" },
    { key: "favorite_sport", label: "Favorite sport" },
    { key: "home_county", label: "Home county" },
    { key: "campus_job", label: "Campus job" },
    { key: "favorite_floor_of_cathy", label: "Favorite Cathy floor" },
    { key: "most_used_bus_number", label: "Most used bus" },
    { key: "favorite_dining_option", label: "Favorite dining" },
    { key: "frat_sorority", label: "Frat / sorority" },
    { key: "favorite_pitt_club", label: "Favorite Pitt club" },
  ];

  const CHOICE_LETTERS = ["A", "B", "C", "D"];

  const errorEl = document.getElementById("connections-error");
  const trioEl = document.getElementById("connections-trio");
  const optionsEl = document.getElementById("connections-options");
  const statsBarEl = document.getElementById("connections-stats");
  const scoreNumEl = document.getElementById("connections-score");
  const streakNumEl = document.getElementById("connections-streak");
  const modalEl = document.getElementById("results-modal");
  const modalTitleEl = document.getElementById("results-modal-title");
  const modalTargetEl = document.getElementById("results-modal-target");
  const modalExplanationEl = document.getElementById(
    "results-modal-explanation"
  );
  const modalStatsEl = document.getElementById("results-modal-stats");

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

  /**
   * Trim + null-check helper. Empty strings / whitespace / null / undefined
   * all collapse to null so we can treat "has a value" uniformly.
   * @param {unknown} value
   * @returns {string | null}
   */
  function cleanValue(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    return s;
  }

  /** Case/whitespace-insensitive key used for grouping-by-value. */
  function normValue(value) {
    const v = cleanValue(value);
    return v ? v.toLowerCase() : null;
  }

  function fullNameFromParts(first, last) {
    return `${first || ""} ${last || ""}`.trim();
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

  /** @param {unknown} raw */
  function normalizeGuessList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => typeof x === "string");
  }

  // Deterministic PRNG. Given the same seed we always produce the same
  // sequence, so every user (and every reload) sees today's puzzle identically.
  function seededRng(seed) {
    let t = seed >>> 0;
    return function rng() {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** In-place Fisher-Yates using the provided rng. */
  function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Build today's puzzle from all profiles + a date seed.
   *
   * Strategy:
   *   1. For every eligible column, group profiles by the normalized value.
   *   2. Collect every group with ≥ 3 members — those are valid "trios".
   *   3. Seed-pick one trio.
   *   4. Shuffle that group and take 3 profiles.
   *   5. Build 3 decoy column options by taking other columns where the trio
   *      does NOT all share a value (so the correct answer stays unambiguous).
   *   6. Shuffle the 4 options.
   *
   * @param {Array<Record<string, unknown>>} profiles
   * @param {number} seed
   * @returns {{
   *   profiles: Array<Record<string, unknown>>,
   *   answerKey: string,
   *   answerValue: string,
   *   options: Array<{ key: string, label: string }>,
   * } | null}
   */
  function buildPuzzle(profiles, seed) {
    const rng = seededRng(seed);

    /** @type {Array<{ col: { key: string, label: string }, value: string, members: Array<Record<string, unknown>> }>} */
    const groups = [];

    for (const col of PROFILE_COLUMNS) {
      /** @type {Map<string, { display: string, members: Array<Record<string, unknown>> }>} */
      const byValue = new Map();
      for (const p of profiles) {
        const norm = normValue(p[col.key]);
        if (!norm) continue;
        const display = cleanValue(p[col.key]) || "";
        if (!byValue.has(norm)) {
          byValue.set(norm, { display, members: [] });
        }
        byValue.get(norm).members.push(p);
      }
      for (const entry of byValue.values()) {
        if (entry.members.length >= 3) {
          groups.push({
            col,
            value: entry.display,
            members: entry.members,
          });
        }
      }
    }

    if (groups.length === 0) return null;

    // Sort groups for a stable ordering before seeded selection so the choice
    // is fully reproducible across clients regardless of map iteration order.
    groups.sort((a, b) => {
      if (a.col.key !== b.col.key) return a.col.key < b.col.key ? -1 : 1;
      return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
    });

    const chosen = groups[Math.floor(rng() * groups.length)];

    // Sort members by id (or name fallback) for stability, then shuffle.
    const memberPool = [...chosen.members].sort((a, b) => {
      const ak = String(a.id ?? fullNameFromParts(a.first_name, a.last_name));
      const bk = String(b.id ?? fullNameFromParts(b.first_name, b.last_name));
      return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
    shuffleInPlace(memberPool, rng);
    const trio = memberPool.slice(0, 3);

    // Decoys: columns where the trio does NOT trivially all share a value.
    // Otherwise the question could have two correct answers.
    const decoys = PROFILE_COLUMNS.filter((col) => {
      if (col.key === chosen.col.key) return false;
      const vals = trio.map((p) => normValue(p[col.key]));
      const first = vals[0];
      const allSame = first !== null && vals.every((v) => v === first);
      return !allSame;
    });

    if (decoys.length < 3) return null;

    shuffleInPlace(decoys, rng);
    const threeDecoys = decoys.slice(0, 3);

    const options = shuffleInPlace([chosen.col, ...threeDecoys], rng);

    return {
      profiles: trio,
      answerKey: chosen.col.key,
      answerValue: chosen.value,
      options,
    };
  }

  /** Renders the three student name cards. No profile details are shown —
   *  the player has to pick the shared field based only on the names. */
  function renderTrio(trio) {
    if (!trioEl) return;
    trioEl.innerHTML = "";
    trio.forEach((profile, index) => {
      const fullName =
        fullNameFromParts(profile.first_name, profile.last_name) || "—";

      const card = document.createElement("article");
      card.className = "connections-student";
      card.setAttribute(
        "aria-label",
        `Panther ${index + 1} of 3: ${fullName}`
      );

      const avatar = document.createElement("span");
      avatar.className = "connections-student__avatar";
      avatar.setAttribute("aria-hidden", "true");
      const initials = `${String(profile.first_name || "")
        .charAt(0)
        .toUpperCase()}${String(profile.last_name || "")
        .charAt(0)
        .toUpperCase()}`;
      avatar.textContent = initials || "P";

      const indexEl = document.createElement("span");
      indexEl.className = "connections-student__index";
      indexEl.textContent = `Panther ${index + 1}`;

      const nameEl = document.createElement("span");
      nameEl.className = "connections-student__name";
      nameEl.textContent = fullName;

      card.appendChild(avatar);
      card.appendChild(indexEl);
      card.appendChild(nameEl);

      trioEl.appendChild(card);
    });
  }

  /** @param {number} wins @param {number} streak */
  function updateStatsBar(wins, streak) {
    if (scoreNumEl) scoreNumEl.textContent = String(wins);
    if (streakNumEl) streakNumEl.textContent = String(streak);
    if (statsBarEl) statsBarEl.hidden = false;
  }

  /**
   * @param {"win" | "loss"} outcome
   * @param {string} answerLabel
   * @param {string} answerValue
   * @param {{ totalWins: number, currentStreak: number }} stats
   */
  function showResultsModal(outcome, answerLabel, answerValue, stats) {
    if (!modalEl || !modalTitleEl || !modalTargetEl) return;
    const win = outcome === "win";
    modalTitleEl.textContent = win
      ? "Nice connection!"
      : "Not quite — better luck tomorrow.";
    modalTargetEl.textContent = `Shared field: ${answerLabel}`;
    if (modalExplanationEl) {
      modalExplanationEl.textContent = `All three Panthers share this ${answerLabel.toLowerCase()}: ${answerValue}.`;
      modalExplanationEl.hidden = false;
    }
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
  async function ensureConnectionsStats(client, userId, todayStr) {
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
          "Log in on the Pitty Games hub to play Connections and save your progress."
        );
        return;
      }

      /** @type {Record<string, unknown>} */
      let gameStats;
      try {
        gameStats = await ensureConnectionsStats(supabase, user.id, todayStr);
      } catch (e) {
        console.error(e);
        showError("Could not load your game stats. Please try again later.");
        return;
      }

      updateStatsBar(
        Number(gameStats.total_wins) || 0,
        Number(gameStats.current_streak) || 0
      );

      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select("*");

      if (profilesErr) {
        console.error(profilesErr);
        showError("Could not load the profile pool for today's puzzle.");
        return;
      }

      const profiles = Array.isArray(profilesData) ? profilesData : [];
      if (profiles.length < 3) {
        showError(
          "Not enough Panthers have filled out their profile yet to build a Connections puzzle. Check back soon."
        );
        return;
      }

      const seed = hashString(`${GAME_TYPE}:${todayStr}`);
      const puzzle = buildPuzzle(profiles, seed);
      if (!puzzle) {
        showError(
          "Today's puzzle could not be built — profile data is still too sparse. Check back soon."
        );
        return;
      }

      renderTrio(puzzle.profiles);

      const answerCol = puzzle.options.find(
        (o) => o.key === puzzle.answerKey
      );
      const answerLabel = answerCol ? answerCol.label : puzzle.answerKey;

      const prevGuesses = normalizeGuessList(gameStats.today_guesses);
      const status = String(gameStats.today_status || "in_progress");
      const alreadyDone = status === "won" || status === "lost";

      /** @type {HTMLButtonElement[]} */
      const optionButtons = [];

      function paintFinalState() {
        optionButtons.forEach((btn) => {
          btn.disabled = true;
          const key = btn.dataset.key || "";
          if (key === puzzle.answerKey) {
            btn.classList.add("is-correct");
          } else if (prevGuesses.includes(key)) {
            btn.classList.add("is-incorrect");
          }
        });
      }

      function renderOptions() {
        if (!optionsEl) return;
        optionsEl.innerHTML = "";
        puzzle.options.forEach((opt, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "connections-option";
          btn.dataset.key = opt.key;
          btn.setAttribute(
            "aria-label",
            `Option ${CHOICE_LETTERS[i]}: ${opt.label}`
          );

          const letter = document.createElement("span");
          letter.className = "connections-option__letter";
          letter.setAttribute("aria-hidden", "true");
          letter.textContent = CHOICE_LETTERS[i];

          const label = document.createElement("span");
          label.className = "connections-option__label";
          label.textContent = opt.label;

          btn.appendChild(letter);
          btn.appendChild(label);
          btn.addEventListener("click", () => void onGuess(opt.key, btn));
          optionsEl.appendChild(btn);
          optionButtons.push(btn);
        });
      }

      renderOptions();

      if (alreadyDone) {
        paintFinalState();
        showResultsModal(
          status === "won" ? "win" : "loss",
          answerLabel,
          puzzle.answerValue,
          {
            totalWins: Number(gameStats.total_wins) || 0,
            currentStreak: Number(gameStats.current_streak) || 0,
          }
        );
        return;
      }

      async function onGuess(key, btn) {
        if (!optionsEl) return;
        optionButtons.forEach((b) => (b.disabled = true));

        const wins = Number(gameStats.total_wins) || 0;
        const streak = Number(gameStats.current_streak) || 0;
        const isWin = key === puzzle.answerKey;

        if (isWin) {
          gameStats.total_wins = wins + 1;
          gameStats.current_streak = streak + 1;
          gameStats.today_status = "won";
          btn.classList.add("is-correct");
        } else {
          gameStats.current_streak = 0;
          gameStats.today_status = "lost";
          btn.classList.add("is-incorrect");
          // Also reveal the correct answer button.
          optionButtons.forEach((b) => {
            if (b.dataset.key === puzzle.answerKey) {
              b.classList.add("is-correct");
            }
          });
        }
        gameStats.today_guesses = [key];
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

        showResultsModal(
          isWin ? "win" : "loss",
          answerLabel,
          puzzle.answerValue,
          {
            totalWins: Number(gameStats.total_wins) || 0,
            currentStreak: Number(gameStats.current_streak) || 0,
          }
        );
      }
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
