(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

  const GAME_TYPE = "impostor";

  /**
   * Order matters: first match wins (deterministic across clients).
   * Includes Guess Who–style fields so small pools can still form a cluster.
   */
  const CONNECTION_ATTRS = [
    "year",
    "major",
    "freshman_dorm",
    "favorite_dining_option",
    "favorite_pitt_club",
    "high_school",
    "home_county",
    "favorite_sport",
    "frat_sorority",
  ];

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

  const choicesEl = document.getElementById("impostor-choices");
  const errorEl = document.getElementById("impostor-error");
  const modalEl = document.getElementById("results-modal");
  const modalTitleEl = document.getElementById("results-modal-title");
  const modalTargetEl = document.getElementById("results-modal-target");
  const modalExplanationEl = document.getElementById(
    "results-modal-explanation"
  );
  const modalStatsEl = document.getElementById("results-modal-stats");
  const statsBarEl = document.getElementById("impostor-stats");
  const scoreNumEl = document.getElementById("impostor-score");
  const streakNumEl = document.getElementById("impostor-streak");

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

  /**
   * Grouping key: trim, lowercase, stringify so " CS " and "cs" match; null/"" → empty bucket.
   * @param {unknown} v
   */
  function attrGroupKey(v) {
    if (v == null || v === "") return "\0__EMPTY__\0";
    const s = String(v).trim();
    if (s === "") return "\0__EMPTY__\0";
    return s.toLowerCase();
  }

  /**
   * @param {Record<string, unknown>} profile
   * @param {string} attr
   */
  function impostorGroupKey(profile, attr) {
    return attrGroupKey(profile[attr]);
  }

  /**
   * Human-readable value from a profile (preserves casing for display).
   * @param {Record<string, unknown>} profile
   * @param {string} attr
   */
  function displayAttrValue(profile, attr) {
    const v = profile[attr];
    if (v == null || v === "") return "";
    const s = String(v).trim();
    return s;
  }

  /**
   * @param {Record<string, unknown>} impostor
   * @param {Record<string, unknown>[]} allProfiles
   * @returns {{ attr: string, value: string, cluster: Record<string, unknown>[], roster: Record<string, unknown>[] } | null}
   */
  function buildDailyPuzzleStrict(impostor, allProfiles) {
    const impId = impostor.id;
    const others = allProfiles.filter(
      (p) => p && String(p.id) !== String(impId)
    );
    if (!impId) return null;

    for (const attr of CONNECTION_ATTRS) {
      const impKey = impostorGroupKey(impostor, attr);
      /** @type {Map<string, Record<string, unknown>[]>} */
      const byKey = new Map();
      for (const p of others) {
        const k = impostorGroupKey(p, attr);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(p);
      }

      /** @type {{ key: string, list: Record<string, unknown>[] }[]} */
      const candidates = [];
      for (const [key, list] of byKey) {
        if (list.length < 4) continue;
        if (key === impKey) continue;
        candidates.push({ key, list });
      }
      if (!candidates.length) continue;

      candidates.sort((a, b) => a.key.localeCompare(b.key));
      const chosen = candidates[0];
      const sortedCluster = [...chosen.list].sort((a, b) =>
        String(a.first_name || "").localeCompare(
          String(b.first_name || ""),
          undefined,
          { sensitivity: "base" }
        )
      );
      const cluster = sortedCluster.slice(0, 4);
      const displayValue = displayAttrValue(cluster[0], attr);
      const roster = [...cluster, impostor].sort((a, b) =>
        String(a.first_name || "").localeCompare(
          String(b.first_name || ""),
          undefined,
          { sensitivity: "base" }
        )
      );
      return {
        attr,
        value: displayValue,
        cluster,
        roster,
      };
    }
    return null;
  }

  /**
   * When exactly five profiles are visible, the non-impostors are always four people.
   * If no attribute separates a 4-cluster from the impostor, still ship a playable round.
   * @param {Record<string, unknown>} impostor
   * @param {Record<string, unknown>[]} allProfiles
   */
  function buildDailyPuzzleFivePersonPool(impostor, allProfiles) {
    if (allProfiles.length !== 5) return null;
    const impId = impostor.id;
    const others = allProfiles.filter(
      (p) => p && String(p.id) !== String(impId)
    );
    if (others.length !== 4) return null;
    const cluster = [...others].sort((a, b) =>
      String(a.first_name || "").localeCompare(
        String(b.first_name || ""),
        undefined,
        { sensitivity: "base" }
      )
    );
    const roster = [...cluster, impostor].sort((a, b) =>
      String(a.first_name || "").localeCompare(
        String(b.first_name || ""),
        undefined,
        { sensitivity: "base" }
      )
    );
    return {
      attr: "__pool__",
      value: "",
      cluster,
      roster,
    };
  }

  /**
   * @param {Record<string, unknown>} impostor
   * @param {Record<string, unknown>[]} allProfiles
   */
  function buildDailyPuzzle(impostor, allProfiles) {
    return (
      buildDailyPuzzleStrict(impostor, allProfiles) ||
      buildDailyPuzzleFivePersonPool(impostor, allProfiles)
    );
  }

  /**
   * @param {string} attr
   * @param {string} value
   */
  function connectionPhrase(attr, value) {
    const blank = value.trim() === "";
    switch (attr) {
      case "year":
        return blank
          ? "The other 4 students share the same year (left blank on their profiles)."
          : `The other 4 students share the same year: ${value}.`;
      case "major":
        return blank
          ? "The other 4 students share the same major (left blank on their profiles)."
          : `The other 4 students are all ${value} majors.`;
      case "freshman_dorm":
        return blank
          ? "The other 4 students share the same freshman dorm (left blank on their profiles)."
          : `The other 4 students all lived in ${value} as freshmen.`;
      case "high_school":
        return blank
          ? "The other 4 students share the same high school (left blank on their profiles)."
          : `The other 4 students all attended ${value}.`;
      case "favorite_dining_option":
        return blank
          ? "The other 4 students share the same favorite dining option (left blank on their profiles)."
          : `The other 4 students share the same favorite dining option: ${value}.`;
      case "favorite_pitt_club":
        return blank
          ? "The other 4 students share the same favorite Pitt club (left blank on their profiles)."
          : `The other 4 students share the same favorite Pitt club: ${value}.`;
      case "home_county":
        return blank
          ? "The other 4 students share the same home county (left blank on their profiles)."
          : `The other 4 students are all from ${value}.`;
      case "favorite_sport":
        return blank
          ? "The other 4 students share the same favorite sport (left blank on their profiles)."
          : `The other 4 students all chose the same favorite sport: ${value}.`;
      case "frat_sorority":
        return blank
          ? "The other 4 students match on Greek life (left blank on their profiles)."
          : `The other 4 students all listed the same frat or sorority: ${value}.`;
      case "__pool__":
        return "The other 4 students are everyone else on today’s roster—the daily puzzle couldn’t find one profile field they all share that differs from the impostor’s.";
      default:
        return `The other 4 students all match on ${attr}.`;
    }
  }

  /**
   * @param {string} firstName
   * @param {string} impostorFullName
   * @param {string} attr
   * @param {string} value
   */
  function buildExplanationText(firstName, impostorFullName, attr, value) {
    const first = (firstName || "").trim() || impostorFullName;
    const lead = `${first} was the Impostor!`;
    const rest = connectionPhrase(attr, value);
    return `${lead} ${rest}`;
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
   * @param {string} impostorFullName
   * @param {string} explanation
   * @param {{ totalWins: number, currentStreak: number }} stats
   */
  function showResultsModal(outcome, impostorFullName, explanation, stats) {
    if (!modalEl || !modalTitleEl || !modalTargetEl) return;
    const win = outcome === "win";
    modalTitleEl.textContent = win
      ? "You won!"
      : "Nice try — better luck tomorrow.";
    modalTargetEl.textContent = `The impostor was: ${impostorFullName}`;
    if (modalExplanationEl) {
      modalExplanationEl.textContent = explanation;
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
  async function ensureImpostorStats(client, userId, todayStr) {
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
   * @param {Record<string, unknown>[]} roster
   * @param {(id: string) => void} onPick
   * @param {boolean} disabled
   */
  function renderChoiceButtons(roster, onPick, disabled) {
    if (!choicesEl) return;
    choicesEl.innerHTML = "";
    for (const p of roster) {
      const id = String(p.id || "");
      const name = fullNameFromParts(
        /** @type {string} */ (p.first_name),
        /** @type {string} */ (p.last_name)
      );
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "impostor-choice";
      btn.textContent = name;
      btn.dataset.profileId = id;
      btn.disabled = disabled;
      btn.addEventListener("click", () => {
        if (disabled) return;
        onPick(id, name);
      });
      choicesEl.appendChild(btn);
    }
  }

  function setChoicesDisabled(disabled) {
    if (!choicesEl) return;
    choicesEl.querySelectorAll("button.impostor-choice").forEach((b) => {
      if (b instanceof HTMLButtonElement) b.disabled = disabled;
    });
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
          "Log in on the Pitty Games hub to play Impostor and save your progress."
        );
        return;
      }

      /** @type {Record<string, unknown>} */
      let gameStats;
      try {
        gameStats = await ensureImpostorStats(supabase, user.id, todayStr);
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

      const { data: allRows, error: allErr } = await supabase
        .from("profiles")
        .select("*");

      if (allErr || !allRows || !allRows.length) {
        console.error(allErr);
        showError("Could not load profiles.");
        return;
      }

      /** @type {Record<string, unknown>[]} */
      const allProfiles = allRows;
      const impostor = allProfiles.find(
        (p) => String(p.id) === String(targetId)
      );
      if (!impostor) {
        showError("Could not load the impostor’s profile.");
        return;
      }

      const puzzle = buildDailyPuzzle(impostor, allProfiles);
      if (!puzzle) {
        showError(
          "Today’s puzzle could not be built from profile data. Check back later."
        );
        return;
      }

      const impostorFullName = fullNameFromParts(
        impostor.first_name,
        impostor.last_name
      );
      const explanationText = buildExplanationText(
        String(impostor.first_name || ""),
        impostorFullName,
        puzzle.attr,
        puzzle.value
      );

      const todayStatus = String(gameStats.today_status || "in_progress");
      const gameOver = todayStatus === "won" || todayStatus === "lost";

      if (gameOver) {
        renderChoiceButtons(puzzle.roster, () => {}, true);
        showResultsModal(
          todayStatus === "won" ? "win" : "loss",
          impostorFullName,
          explanationText,
          {
            totalWins,
            currentStreak,
          }
        );
        return;
      }

      let finished = false;

      async function finalizeRound(
        outcome,
        /** @type {Record<string, unknown>} */ statsRef
      ) {
        finished = true;
        setChoicesDisabled(true);

        const wins = Number(statsRef.total_wins) || 0;
        const streak = Number(statsRef.current_streak) || 0;

        if (outcome === "win") {
          statsRef.total_wins = wins + 1;
          statsRef.current_streak = streak + 1;
          statsRef.today_status = "won";
        } else {
          statsRef.current_streak = 0;
          statsRef.today_status = "lost";
        }
        statsRef.last_played_date = todayStr;

        try {
          await upsertGameStats(supabase, statsRef);
        } catch (e) {
          console.error(e);
          showError("Could not save your result. Check your connection.");
        }

        updateStatsBar(
          Number(statsRef.total_wins) || 0,
          Number(statsRef.current_streak) || 0
        );

        showResultsModal(outcome, impostorFullName, explanationText, {
          totalWins: Number(statsRef.total_wins) || 0,
          currentStreak: Number(statsRef.current_streak) || 0,
        });
      }

      renderChoiceButtons(puzzle.roster, async (profileId, name) => {
        if (finished) return;

        const nextGuesses = normalizeGuessList(gameStats.today_guesses).concat(
          name
        );
        gameStats.today_guesses = nextGuesses;

        const correct = profileId === String(targetId);
        if (correct) {
          await finalizeRound("win", gameStats);
        } else {
          await finalizeRound("loss", gameStats);
        }
      }, false);
    })();
  }

  init();
})();
