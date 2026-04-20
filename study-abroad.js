(function () {
  "use strict";

  const SWIPE_THRESHOLD_PX = 120;
  const SWIPE_VELOCITY = 0.4;
  const FLY_DISTANCE = 1500;
  const ROTATION_FACTOR = 0.08;
  const STAMP_FADE_DISTANCE = 100;

  const PLACEHOLDER_PROGRAMS = [
    {
      id: "placeholder-1",
      name: "Program name",
      location: "Location",
      pro: "A reason this program could be a great fit for you.",
      con: "A potential drawback to keep in mind.",
    },
    {
      id: "placeholder-2",
      name: "Program name",
      location: "Location",
      pro: "A reason this program could be a great fit for you.",
      con: "A potential drawback to keep in mind.",
    },
    {
      id: "placeholder-3",
      name: "Program name",
      location: "Location",
      pro: "A reason this program could be a great fit for you.",
      con: "A potential drawback to keep in mind.",
    },
    {
      id: "placeholder-4",
      name: "Program name",
      location: "Location",
      pro: "A reason this program could be a great fit for you.",
      con: "A potential drawback to keep in mind.",
    },
    {
      id: "placeholder-5",
      name: "Program name",
      location: "Location",
      pro: "A reason this program could be a great fit for you.",
      con: "A potential drawback to keep in mind.",
    },
  ];

  const deck = document.getElementById("study-abroad-deck");
  const emptyState = document.getElementById("study-abroad-empty");
  const passBtn = document.getElementById("study-abroad-pass");
  const likeBtn = document.getElementById("study-abroad-like");

  if (!deck) return;

  let programs = PLACEHOLDER_PROGRAMS.slice();

  function buildCard(program) {
    const card = document.createElement("article");
    card.className = "program-card";
    card.dataset.programId = program.id;

    card.innerHTML = `
      <div class="program-card__image" aria-hidden="true">
        <span class="program-card__image-placeholder">Program image</span>
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
    aiTexts[0].textContent = program.pro;
    aiTexts[1].textContent = program.con;

    return card;
  }

  function render() {
    deck.innerHTML = "";

    if (programs.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    // Render bottom-up so the top card appears last in DOM order — but we
    // also use stack-index for explicit z-ordering and offsets in CSS.
    programs.slice(0, 4).forEach((program, index) => {
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

  function flyOff(card, direction) {
    if (!card) return;

    const program = programs[0];
    const isLike = direction === "like";
    const targetX = isLike ? FLY_DISTANCE : -FLY_DISTANCE;
    const rotation = isLike ? 25 : -25;

    if (isLike) {
      console.log("Like", program);
    } else {
      console.log("Pass", program);
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

    const cleanup = function () {
      card.removeEventListener("transitionend", cleanup);
      programs.shift();
      render();
    };
    card.addEventListener("transitionend", cleanup);
    setTimeout(cleanup, 600);
  }

  function programmaticSwipe(direction) {
    const topCard = deck.querySelector('.program-card[data-stack-index="0"]');
    if (!topCard) return;
    flyOff(topCard, direction);
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

  render();
})();
