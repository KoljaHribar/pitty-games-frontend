(function () {
  "use strict";

  const SUPABASE_URL = "https://ydbivwgowrzrkntiasef.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA";

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

  // Which profile columns end up on which card section, and the human label
  // to use in the UI. Order in each array is the display order on the card.
  const SECTIONS = [
    {
      id: "about",
      fields: [
        { key: "home_county", label: "Home county" },
        { key: "favorite_sport", label: "Favorite sport" },
      ],
    },
    {
      id: "academics",
      fields: [
        { key: "year", label: "Year" },
        { key: "major", label: "Major" },
        { key: "high_school", label: "High school" },
        { key: "best_professor_taken", label: "Best professor" },
        { key: "worst_professor_taken", label: "Worst professor" },
      ],
    },
    {
      id: "campus",
      fields: [
        { key: "freshman_dorm", label: "Freshman dorm" },
        { key: "campus_job", label: "Campus job" },
        { key: "favorite_floor_of_cathy", label: "Favorite Cathy floor" },
        { key: "most_used_bus_number", label: "Most used bus" },
        { key: "favorite_dining_option", label: "Favorite dining" },
        { key: "frat_sorority", label: "Frat / sorority" },
        { key: "favorite_pitt_club", label: "Favorite Pitt club" },
      ],
    },
  ];

  const errorEl = document.getElementById("sotd-error");
  const cardEl = document.getElementById("sotd-card");
  const loadingEl = document.getElementById("sotd-loading");
  const dateEl = document.getElementById("sotd-date");
  const nameEl = document.getElementById("sotd-name");
  const sublineEl = document.getElementById("sotd-subline");

  function localDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatPrettyDate(d) {
    try {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch (err) {
      return localDateKey(d);
    }
  }

  function showError(message) {
    if (loadingEl) loadingEl.hidden = true;
    if (cardEl) cardEl.hidden = true;
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  /**
   * A value counts as "missing" if it's null/undefined, an empty string, or a
   * string of just whitespace. Otherwise we stringify for display.
   * @param {unknown} value
   * @returns {string | null}
   */
  function cleanValue(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    return s;
  }

  function fullNameFromParts(first, last) {
    return `${first || ""} ${last || ""}`.trim();
  }

  /**
   * @param {Record<string, unknown>} profile
   */
  function renderSubline(profile) {
    if (!sublineEl) return;
    const parts = [];
    const year = cleanValue(profile.year);
    const major = cleanValue(profile.major);
    if (year) parts.push(year);
    if (major) parts.push(major);
    sublineEl.textContent = parts.join(" · ");
    sublineEl.hidden = parts.length === 0;
  }

  /**
   * @param {Record<string, unknown>} profile
   */
  function renderFacts(profile) {
    SECTIONS.forEach((section) => {
      const listEl = document.getElementById(`sotd-facts-${section.id}`);
      const sectionEl = document.getElementById(
        `sotd-section-${section.id}`
      );
      if (!listEl || !sectionEl) return;
      listEl.innerHTML = "";

      let shown = 0;
      section.fields.forEach((field) => {
        const val = cleanValue(profile[field.key]);
        if (!val) return;
        const li = document.createElement("li");
        li.className = "sotd-fact";
        const labelEl = document.createElement("span");
        labelEl.className = "sotd-fact__label";
        labelEl.textContent = field.label;
        const valueEl = document.createElement("span");
        valueEl.className = "sotd-fact__value";
        valueEl.textContent = val;
        li.appendChild(labelEl);
        li.appendChild(valueEl);
        listEl.appendChild(li);
        shown += 1;
      });

      sectionEl.hidden = shown === 0;
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
      const today = new Date();
      const todayStr = localDateKey(today);
      if (dateEl) {
        dateEl.dateTime = todayStr;
        dateEl.textContent = formatPrettyDate(today);
      }

      const { data: puzzleRow, error: puzzleErr } = await supabase
        .from("daily_puzzles")
        .select("target_profile_id")
        .eq("puzzle_date", todayStr)
        .maybeSingle();

      if (puzzleErr) {
        console.error(puzzleErr);
        showError("Could not load today’s student. Please try again later.");
        return;
      }
      if (!puzzleRow || !puzzleRow.target_profile_id) {
        showError("No student has been selected for today yet — check back soon.");
        return;
      }

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", puzzleRow.target_profile_id)
        .maybeSingle();

      if (profileErr) {
        console.error(profileErr);
        showError("Could not load today’s Panther profile.");
        return;
      }
      if (!profileRow) {
        showError("Today’s Panther could not be found.");
        return;
      }

      const fullName =
        fullNameFromParts(profileRow.first_name, profileRow.last_name) ||
        "A mystery Panther";

      if (nameEl) nameEl.textContent = fullName;
      renderSubline(profileRow);
      renderFacts(profileRow);

      if (loadingEl) loadingEl.hidden = true;
      if (cardEl) cardEl.hidden = false;
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
