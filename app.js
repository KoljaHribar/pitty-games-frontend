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

  const ROUTES = {
    bingo: "/games/bingo",
    wordle: "/games/wordle",
    connections: "/games/connections",
  };

  const LABELS = {
    bingo: "Bingo",
    wordle: "Wordle",
    connections: "Connections",
  };

  const toastEl = document.getElementById("toast");
  const authModalEl = document.getElementById("auth-modal");
  const authEmailEl = document.getElementById("auth-email");
  const authPasswordEl = document.getElementById("auth-password");
  const authSignUpBtn = document.getElementById("auth-sign-up");
  const authLogInBtn = document.getElementById("auth-log-in");
  const headerGuestEl = document.querySelector(".header-auth__guest");
  const headerUserEl = document.getElementById("header-auth-user");
  const profileModalEl = document.getElementById("profile-modal");
  const profileFirstNameEl = document.getElementById("profile-first-name");
  const profileLastNameEl = document.getElementById("profile-last-name");
  const profileMajorEl = document.getElementById("profile-major");
  const profileYearEl = document.getElementById("profile-year");
  const profileFavoriteSportEl = document.getElementById("profile-favorite-sport");
  const profileHomeCountyEl = document.getElementById("profile-home-county");
  const profileOptInEl = document.getElementById("profile-opt-in-daily-puzzle");
  const profileHighSchoolEl = document.getElementById("profile-high-school");
  const profileFreshmanDormEl = document.getElementById("profile-freshman-dorm");
  const profileCampusJobEl = document.getElementById("profile-campus-job");
  const profileFavoriteFloorCathyEl = document.getElementById(
    "profile-favorite-floor-cathy"
  );
  const profileFavoriteDiningEl = document.getElementById(
    "profile-favorite-dining"
  );
  const profileMostUsedBusEl = document.getElementById("profile-most-used-bus");
  const profileWorstProfessorEl = document.getElementById(
    "profile-worst-professor"
  );
  const profileBestProfessorEl = document.getElementById("profile-best-professor");
  const profileFratSororityEl = document.getElementById("profile-frat-sorority");
  const profileFavoritePittClubEl = document.getElementById(
    "profile-favorite-pitt-club"
  );
  const profileSaveBtn = document.getElementById("profile-save-btn");
  let toastTimer = null;

  const authModalTitleEl = document.getElementById("auth-modal-title");

  /**
   * @param {"login" | "signup"} mode
   */
  function showAuthModal(mode) {
    const isLogin = mode === "login";
    if (authModalEl) {
      authModalEl.hidden = false;
      authModalEl.setAttribute("data-auth-mode", isLogin ? "login" : "signup");
    }
    if (authModalTitleEl) {
      authModalTitleEl.textContent = isLogin ? "Log in" : "Sign up";
    }
    if (authSignUpBtn) {
      authSignUpBtn.hidden = isLogin;
    }
    if (authLogInBtn) {
      authLogInBtn.hidden = !isLogin;
    }
    if (authPasswordEl) {
      authPasswordEl.setAttribute(
        "autocomplete",
        isLogin ? "current-password" : "new-password"
      );
    }
  }

  function hideAuthModal() {
    if (authModalEl) authModalEl.hidden = true;
  }

  function syncAccountNav(session) {
    const loggedIn = !!(session && session.user);
    if (headerGuestEl) headerGuestEl.hidden = loggedIn;
    if (headerUserEl) headerUserEl.hidden = !loggedIn;
  }

  /**
   * Hub scores load from Supabase `user_game_stats`, not localStorage.
   * Each entry: stable id + CSS fallback so the badge still resolves if ids drift.
   * @type {{ gameType: string, elId: string, fallbackSelector: string }[]}
   */
  const GAME_HUB_ENTRIES = [
    {
      gameType: "guess_who",
      elId: "guess-who-hub-score",
      fallbackSelector:
        'a.game-card--link[href$="guess-who.html"] .game-card__score',
    },
    {
      gameType: "impostor",
      elId: "impostor-hub-score",
      fallbackSelector:
        'a.game-card--link[href$="impostor.html"] .game-card__score',
    },
    {
      gameType: "wordle",
      elId: "wordle-hub-score",
      fallbackSelector:
        'a.game-card--link[href$="wordle.html"] .game-card__score',
    },
    {
      gameType: "connections",
      elId: "connections-hub-score",
      fallbackSelector:
        'button.game-card[data-game="connections"] .game-card__score',
    },
  ];

  /**
   * @param {unknown} raw
   */
  function hubWinsFromRow(raw) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * @param {{ elId: string, fallbackSelector: string }} entry
   * @returns {HTMLElement | null}
   */
  function resolveHubScoreEl(entry) {
    const byId = document.getElementById(entry.elId);
    if (byId) return byId;
    try {
      return document.querySelector(entry.fallbackSelector);
    } catch {
      return null;
    }
  }

  /**
   * @param {HTMLElement} el
   * @param {number} wins
   */
  function showHubScore(el, wins) {
    el.textContent = `Score: ${wins}`;
    el.removeAttribute("hidden");
    el.hidden = false;
  }

  /** @param {HTMLElement} el */
  function hideHubScore(el) {
    el.textContent = "";
    el.setAttribute("hidden", "");
    el.hidden = true;
  }

  /**
   * @param {{ user: { id: string } } | null} session
   * @param {{ gameType: string, elId: string, fallbackSelector: string }} entry
   */
  async function syncOneGameHubScore(session, entry) {
    const el = resolveHubScoreEl(entry);
    if (!el) return;
    if (!supabase || !session?.user) {
      hideHubScore(el);
      return;
    }
    showHubScore(el, 0);
    try {
      const { data, error } = await supabase
        .from("user_game_stats")
        .select("total_wins")
        .eq("user_id", session.user.id)
        .eq("game_type", entry.gameType)
        .maybeSingle();
      if (error) {
        console.error(`Hub score (${entry.gameType}):`, error);
        return;
      }
      showHubScore(el, hubWinsFromRow(data?.total_wins));
    } catch (e) {
      console.error(`Hub score (${entry.gameType}):`, e);
    }
  }

  /**
   * @param {{ user: { id: string } } | null} session
   */
  async function syncAllGameHubScores(session) {
    await Promise.all(
      GAME_HUB_ENTRIES.map((entry) => syncOneGameHubScore(session, entry))
    );
  }

  function hideProfileModal() {
    if (profileModalEl) profileModalEl.hidden = true;
  }

  function clearProfileForm() {
    if (profileFirstNameEl) profileFirstNameEl.value = "";
    if (profileLastNameEl) profileLastNameEl.value = "";
    if (profileMajorEl) profileMajorEl.value = "";
    if (profileYearEl) profileYearEl.value = "";
    if (profileFavoriteSportEl) profileFavoriteSportEl.value = "";
    if (profileHomeCountyEl) profileHomeCountyEl.value = "";
    if (profileHighSchoolEl) profileHighSchoolEl.value = "";
    if (profileFreshmanDormEl) profileFreshmanDormEl.value = "";
    if (profileCampusJobEl) profileCampusJobEl.value = "";
    if (profileFavoriteFloorCathyEl) profileFavoriteFloorCathyEl.value = "";
    if (profileFavoriteDiningEl) profileFavoriteDiningEl.value = "";
    if (profileMostUsedBusEl) profileMostUsedBusEl.value = "";
    if (profileWorstProfessorEl) profileWorstProfessorEl.value = "";
    if (profileBestProfessorEl) profileBestProfessorEl.value = "";
    if (profileFratSororityEl) profileFratSororityEl.value = "";
    if (profileFavoritePittClubEl) profileFavoritePittClubEl.value = "";
    if (profileOptInEl) profileOptInEl.checked = false;
  }

  function applyProfileRow(row) {
    if (!row) {
      clearProfileForm();
      return;
    }
    if (profileFirstNameEl) profileFirstNameEl.value = row.first_name ?? "";
    if (profileLastNameEl) profileLastNameEl.value = row.last_name ?? "";
    if (profileMajorEl) profileMajorEl.value = row.major ?? "";
    if (profileYearEl) profileYearEl.value = row.year ?? "";
    if (profileFavoriteSportEl) {
      profileFavoriteSportEl.value = row.favorite_sport ?? "";
    }
    if (profileHomeCountyEl) profileHomeCountyEl.value = row.home_county ?? "";
    if (profileOptInEl) {
      profileOptInEl.checked = !!row.is_opted_in;
    }
    if (profileHighSchoolEl) profileHighSchoolEl.value = row.high_school ?? "";
    if (profileFreshmanDormEl) {
      profileFreshmanDormEl.value = row.freshman_dorm ?? "";
    }
    if (profileCampusJobEl) profileCampusJobEl.value = row.campus_job ?? "";
    if (profileFavoriteFloorCathyEl) {
      const f = row.favorite_floor_of_cathy;
      profileFavoriteFloorCathyEl.value =
        f != null && f !== "" ? String(f) : "";
    }
    if (profileFavoriteDiningEl) {
      profileFavoriteDiningEl.value = row.favorite_dining_option ?? "";
    }
    if (profileMostUsedBusEl) {
      profileMostUsedBusEl.value = row.most_used_bus_number ?? "";
    }
    if (profileWorstProfessorEl) {
      profileWorstProfessorEl.value = row.worst_professor_taken ?? "";
    }
    if (profileBestProfessorEl) {
      profileBestProfessorEl.value = row.best_professor_taken ?? "";
    }
    if (profileFratSororityEl) {
      profileFratSororityEl.value = row.frat_sorority ?? "";
    }
    if (profileFavoritePittClubEl) {
      profileFavoritePittClubEl.value = row.favorite_pitt_club ?? "";
    }
  }

  async function showProfileModal() {
    if (!profileModalEl) return;
    profileModalEl.hidden = false;
    if (!supabase) return;
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      clearProfileForm();
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Profile load:", error);
      clearProfileForm();
      return;
    }
    applyProfileRow(data);
  }

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
        showAuthModal("login");
      } else if (action === "signup") {
        showAuthModal("signup");
      } else if (action === "profile") {
        void showProfileModal();
      } else if (action === "logout") {
        if (!supabase) {
          syncAccountNav(null);
          return;
        }
        void (async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            alert(error.message);
            const { data: sess } = await supabase.auth.getSession();
            syncAccountNav(sess.session);
          } else {
            syncAccountNav(null);
          }
        })();
      }
    });
  });

  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      syncAccountNav(session);
      void syncAllGameHubScores(session);
      if (!session?.user && profileModalEl && !profileModalEl.hidden) {
        hideProfileModal();
      }
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      syncAccountNav(session);
      void syncAllGameHubScores(session);
    });
  }

  document.querySelectorAll("[data-close-profile-modal]").forEach((el) => {
    el.addEventListener("click", () => hideProfileModal());
  });

  document.querySelectorAll("[data-close-auth-modal]").forEach((el) => {
    el.addEventListener("click", () => hideAuthModal());
  });

  if (authSignUpBtn) {
    authSignUpBtn.addEventListener("click", async () => {
      if (!supabase) {
        alert(
          "Sign up is unavailable because the auth library did not load. Check your connection or try another browser."
        );
        return;
      }
      const email = authEmailEl ? authEmailEl.value.trim() : "";
      const password = authPasswordEl ? authPasswordEl.value : "";
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert(error.message);
      } else {
        alert("Success! Check your email to confirm your account.");
        if (data.session) {
          const { data: sess } = await supabase.auth.getSession();
          syncAccountNav(sess.session);
          void syncAllGameHubScores(sess.session);
        }
      }
    });
  }

  if (authLogInBtn) {
    authLogInBtn.addEventListener("click", async () => {
      if (!supabase) {
        alert(
          "Log in is unavailable because the auth library did not load. Check your connection or try another browser."
        );
        return;
      }
      const email = authEmailEl ? authEmailEl.value.trim() : "";
      const password = authPasswordEl ? authPasswordEl.value : "";
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert(error.message);
      } else {
        alert("Logged in successfully!");
        hideAuthModal();
        const { data: sess } = await supabase.auth.getSession();
        syncAccountNav(sess.session);
        void syncAllGameHubScores(sess.session);
      }
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
      if (!supabase) {
        alert(
          "Profile save is unavailable because the auth library did not load."
        );
        return;
      }
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        alert(userError ? userError.message : "You must be logged in to save.");
        return;
      }
      const email = user.email ?? "";
      const str = (el) => (el && el.value ? el.value.trim() : "");
      const sel = (el) => (el && el.value ? el.value : null);
      const payload = {
        id: user.id,
        email,
        first_name: str(profileFirstNameEl) || null,
        last_name: str(profileLastNameEl) || null,
        major: str(profileMajorEl) || null,
        year: sel(profileYearEl),
        favorite_sport: str(profileFavoriteSportEl) || null,
        home_county: str(profileHomeCountyEl) || null,
        high_school: str(profileHighSchoolEl) || null,
        freshman_dorm: str(profileFreshmanDormEl) || null,
        campus_job: str(profileCampusJobEl) || null,
        favorite_floor_of_cathy: sel(profileFavoriteFloorCathyEl),
        favorite_dining_option: str(profileFavoriteDiningEl) || null,
        most_used_bus_number: sel(profileMostUsedBusEl),
        worst_professor_taken: str(profileWorstProfessorEl) || null,
        best_professor_taken: str(profileBestProfessorEl) || null,
        frat_sorority: str(profileFratSororityEl) || null,
        favorite_pitt_club: str(profileFavoritePittClubEl) || null,
        is_opted_in: !!(profileOptInEl && profileOptInEl.checked),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });
      if (error) {
        alert(error.message);
      } else {
        alert("Profile saved successfully.");
        hideProfileModal();
      }
    });
  }
})();
