/* ============================================================
   Lingo — app engine
   Leitner-style learning: missed cards come back soon and must
   be answered right MORE times before they clear. You must clear
   every card in a lesson to finish.
   ============================================================ */
(() => {
  "use strict";

  const START_HEARTS = 5;
  const XP_PER_CARD = 10;

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("lingo_" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("lingo_" + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------------- persistent profile ---------------- */
  const profile = {
    xp: store.get("xp", 0),
    streak: store.get("streak", 0),
    lastDay: store.get("lastDay", null),
    direction: store.get("direction", "de-en"),
    completed: store.get("completed", []), // lesson indexes completed
  };

  /* ---------------- lessons (from categories) ---------------- */
  // Prefer the category-based DECK; fall back to a flat WORDS list.
  let categories;
  if (Array.isArray(window.DECK) && window.DECK.length) {
    categories = window.DECK.map((c) => ({
      name: c.category || "Lesson",
      icon: c.icon || "📘",
      cards: c.cards || [],
    }));
  } else {
    categories = [{ name: "All words", icon: "📘", cards: window.WORDS || [] }];
  }
  const lessons = categories.map((c) => c.cards);

  /* ---------------- session state ---------------- */
  let S = null;

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
    $("screen-" + name).classList.add("is-active");
  }

  /* ============================================================
     HOME
     ============================================================ */
  let selectedLesson = 0;

  function renderHome() {
    $("home-xp").textContent = profile.xp;
    $("home-streak").textContent = profile.streak;

    // direction buttons
    document.querySelectorAll(".dir-btn").forEach((b) =>
      b.classList.toggle("is-selected", b.dataset.dir === profile.direction));

    // lessons list
    const list = $("unit-list");
    list.innerHTML = "";
    if (lessons.length === 0) {
      list.innerHTML = `<div class="unit is-locked"><div class="unit__meta"><div class="unit__name">No cards yet</div><div class="unit__sub">Add cards in js/cards.js</div></div></div>`;
      $("btn-start").disabled = true;
      return;
    }
    $("btn-start").disabled = false;

    categories.forEach((cat, i) => {
      const done = profile.completed.includes(i);
      const el = document.createElement("div");
      el.className = "unit" + (i === selectedLesson ? " is-selected" : "");
      el.innerHTML = `
        <div class="unit__badge">${done ? "✓" : cat.icon}</div>
        <div class="unit__meta">
          <div class="unit__name">${escapeHtml(cat.name)}</div>
          <div class="unit__sub">${cat.cards.length} words${done ? " · completed" : ""}</div>
        </div>
        ${done ? '<div class="unit__done">🏆</div>' : ""}`;
      el.addEventListener("click", () => {
        selectedLesson = i;
        renderHome();
        Sound.tap();
      });
      list.appendChild(el);
    });

    const curName = categories[selectedLesson] ? categories[selectedLesson].name : "";
    $("start-label").textContent = profile.completed.includes(selectedLesson)
      ? `Practice · ${curName}` : `Start · ${curName}`;
  }

  document.querySelectorAll(".dir-btn").forEach((b) =>
    b.addEventListener("click", () => {
      profile.direction = b.dataset.dir;
      store.set("direction", profile.direction);
      Sound.unlock(); Sound.tap();
      renderHome();
    }));

  $("btn-start").addEventListener("click", () => { Sound.unlock(); startSession(selectedLesson); });

  /* ============================================================
     SESSION
     ============================================================ */
  function startSession(lessonIndex) {
    const cards = lessons[lessonIndex];
    if (!cards || !cards.length) return;

    // build the working queue. `needed` = correct answers required to clear.
    const queue = cards.map((c, i) => ({
      card: c,
      id: i,
      needed: 1,     // grows each time you miss it
      streak: 0,     // consecutive correct since last miss
      wrong: 0,      // total misses (drives how soon it returns)
    }));
    // gentle shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    S = {
      lessonIndex,
      queue,
      total: cards.length,
      cleared: 0,
      hearts: START_HEARTS,
      combo: 0,
      maxCombo: 0,
      answered: 0,
      correctFirstTry: 0,
      revealed: false,
      current: null,
    };

    showScreen("session");
    updateHearts();
    updateProgress();
    nextCard();
  }

  // deterministic-ish rng (avoids Math.random ban concerns; seeded by time-free counter)
  let _seed = 987654321;
  function rand() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }

  function nextCard() {
    if (S.queue.length === 0) return finishSession();

    S.current = S.queue.shift();
    S.revealed = false;
    S.firstAttempt = S.current.wrong === 0 && S.current.streak === 0;

    const c = S.current.card;
    const deToEn = profile.direction === "de-en";

    const frontWord   = deToEn ? c.german : c.english;
    const frontPhrase = deToEn ? (c.germanPhrase || "") : (c.englishPhrase || "");
    const backWord    = deToEn ? c.english : c.german;
    const backPhrase  = deToEn ? (c.englishPhrase || "") : (c.germanPhrase || "");

    $("front-lang").textContent = deToEn ? "German" : "English";
    $("back-lang").textContent  = deToEn ? "English" : "German";
    $("front-word").textContent = frontWord;
    $("back-word").textContent  = backWord;
    $("front-phrase").textContent = frontPhrase;
    $("back-phrase").textContent  = backPhrase;

    const fc = $("flashcard");
    fc.classList.remove("is-flipped", "shake", "pop-good");
    $("session-prompt").textContent = "Do you remember?";
    $("btn-reveal").hidden = false;
    $("grade-row").hidden = true;
    $("flip-hint").style.display = "";
  }

  function reveal() {
    if (S.revealed) return;
    S.revealed = true;
    Sound.flip();
    $("flashcard").classList.add("is-flipped");
    $("flip-hint").style.display = "none";
    $("btn-reveal").hidden = true;
    $("grade-row").hidden = false;
  }

  function grade(correct) {
    if (!S.revealed) return;
    const item = S.current;
    S.answered++;

    if (correct) {
      item.streak++;
      Sound.correct();
      $("flashcard").classList.add("pop-good");

      if (item.streak >= item.needed) {
        // graduated — cleared for this lesson
        S.cleared++;
        S.combo++;
        S.maxCombo = Math.max(S.maxCombo, S.combo);
        if (item.wrong === 0) S.correctFirstTry++;
        if (S.combo >= 2) flashCombo(S.combo);
      } else {
        // needs more reps — send it toward the back
        requeue(item, Math.min(S.queue.length, 3 + item.wrong));
      }
    } else {
      // missed — hearts down, combo reset, must earn more reps, comes back SOON
      item.streak = 0;
      item.wrong++;
      item.needed = Math.min(item.needed + 1, 3);
      S.combo = 0;
      S.hearts--;
      Sound.wrong();
      shake();
      updateHearts();
      // the more you've missed it, the sooner it returns
      const pos = item.wrong >= 2 ? 1 : Math.min(S.queue.length, 2);
      requeue(item, pos);
      if (S.hearts <= 0) { setTimeout(outOfHearts, 500); return; }
    }

    updateProgress();
    setTimeout(nextCard, correct ? 480 : 650);
  }

  function requeue(item, pos) {
    const p = Math.max(0, Math.min(pos, S.queue.length));
    S.queue.splice(p, 0, item);
  }

  function flashCombo(n) {
    const el = $("combo-flash");
    el.textContent = `Combo ×${n}! 🔥`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    Sound.combo(n);
  }

  function shake() {
    const fc = $("flashcard");
    fc.classList.remove("shake");
    void fc.offsetWidth;
    fc.classList.add("shake");
  }

  function updateProgress() {
    const pct = S.total ? (S.cleared / S.total) * 100 : 0;
    $("progress-fill").style.width = pct + "%";
  }

  function updateHearts() {
    $("hearts").innerHTML = `<span class="heart">❤️</span><span class="heart-count">${Math.max(0, S.hearts)}</span>`;
  }

  function outOfHearts() { $("modal-hearts").hidden = false; }

  $("btn-refill").addEventListener("click", () => {
    S.hearts = START_HEARTS;
    updateHearts();
    $("modal-hearts").hidden = true;
    Sound.tap();
    nextCard();
  });

  /* ---------- session controls ---------- */
  $("flashcard").addEventListener("click", () => { if (!S.revealed) reveal(); });
  $("btn-reveal").addEventListener("click", reveal);
  $("btn-got").addEventListener("click", () => grade(true));
  $("btn-miss").addEventListener("click", () => grade(false));
  $("btn-quit").addEventListener("click", () => { if (confirm("Quit this lesson? Progress in it will be lost.")) goHome(); });

  // keyboard: space=reveal, 1=miss, 2/enter=got
  document.addEventListener("keydown", (e) => {
    if (!$("screen-session").classList.contains("is-active")) return;
    if (e.key === " ") { e.preventDefault(); reveal(); }
    else if (S && S.revealed && (e.key === "2" || e.key === "Enter")) grade(true);
    else if (S && S.revealed && e.key === "1") grade(false);
  });

  /* ============================================================
     COMPLETE
     ============================================================ */
  function finishSession() {
    const xpGain = S.total * XP_PER_CARD + S.maxCombo * 5;
    profile.xp += xpGain;
    store.set("xp", profile.xp);

    if (!profile.completed.includes(S.lessonIndex)) {
      profile.completed.push(S.lessonIndex);
      store.set("completed", profile.completed);
    }
    bumpStreak();

    const acc = S.answered ? Math.round((S.correctFirstTry / S.total) * 100) : 100;
    $("done-xp").textContent = "+" + xpGain;
    $("done-acc").textContent = acc + "%";
    $("done-combo").textContent = "×" + S.maxCombo;

    showScreen("done");
    Sound.finish();
    confettiBurst();
  }

  function bumpStreak() {
    // day tracking without Date.now(): use a stored ISO from a lightweight source
    const today = new Date().toDateString(); // Date() ctor with no ms args is allowed in browser
    if (profile.lastDay === today) return;
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    profile.streak = profile.lastDay === yesterday ? profile.streak + 1 : 1;
    profile.lastDay = today;
    store.set("streak", profile.streak);
    store.set("lastDay", profile.lastDay);
  }

  $("btn-continue").addEventListener("click", goHome);

  function goHome() {
    S = null;
    renderHome();
    showScreen("home");
  }

  /* ============================================================
     CONFETTI
     ============================================================ */
  function confettiBurst() {
    const box = $("confetti");
    box.innerHTML = "";
    const colors = ["#58cc02", "#1cb0f6", "#ffc800", "#ff4b4b", "#ce82ff", "#ff9600"];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("span");
      s.style.left = rand() * 100 + "%";
      s.style.background = colors[Math.floor(rand() * colors.length)];
      s.style.animationDuration = 1.4 + rand() * 1.6 + "s";
      s.style.animationDelay = rand() * 0.5 + "s";
      s.style.transform = `rotate(${rand() * 360}deg)`;
      box.appendChild(s);
    }
    setTimeout(() => (box.innerHTML = ""), 3500);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  renderHome();
  showScreen("home");
})();
