(function () {
  "use strict";

  var HABITS = [
    { id: "reading", name: "Reading", emoji: "📖" },
    { id: "sleeping", name: "Sleeping", emoji: "😴" },
    { id: "exercise", name: "Exercise", emoji: "🏃" },
    { id: "meditation", name: "Meditation", emoji: "🧘" },
    { id: "eating", name: "Eating Healthy", emoji: "🥗" }
  ];

  var STORAGE_KEY = "habit-tracker-v1";
  var RING_CIRCUMFERENCE = 2 * Math.PI * 34; // matches r=34 in the SVG

  // ---- Date helpers (local time, YYYY-MM-DD keys) ----
  function dateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function addDays(d, n) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  // ---- Persistence ----
  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { completions: {} };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { completions: {} };
      if (!parsed.completions) parsed.completions = {};
      return parsed;
    } catch (e) {
      return { completions: {} };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage full or unavailable — ignore */
    }
  }

  var data = loadData();

  function isDone(key, habitId) {
    return !!(data.completions[key] && data.completions[key][habitId]);
  }

  function toggle(key, habitId) {
    if (!data.completions[key]) data.completions[key] = {};
    if (data.completions[key][habitId]) {
      delete data.completions[key][habitId];
      if (Object.keys(data.completions[key]).length === 0) delete data.completions[key];
    } else {
      data.completions[key][habitId] = true;
    }
    saveData(data);
  }

  // Consecutive-day streak for a habit, counting back from today.
  // Today not being done yet doesn't break a streak that ran through yesterday.
  function streakFor(habitId) {
    var today = new Date();
    var start = isDone(dateKey(today), habitId) ? 0 : -1;
    if (start === -1 && !isDone(dateKey(addDays(today, -1)), habitId)) return 0;
    var count = 0;
    for (var i = start; i > -3650; i--) {
      if (isDone(dateKey(addDays(today, i)), habitId)) count++;
      else break;
    }
    return count;
  }

  function countDone(key) {
    var rec = data.completions[key];
    if (!rec) return 0;
    var n = 0;
    HABITS.forEach(function (h) {
      if (rec[h.id]) n++;
    });
    return n;
  }

  // ---- Rendering ----
  var els = {
    greeting: document.getElementById("greeting"),
    todayDate: document.getElementById("today-date"),
    summary: document.getElementById("summary"),
    ringFg: document.getElementById("ring-fg"),
    ringLabel: document.getElementById("ring-label"),
    list: document.getElementById("habit-list"),
    history: document.getElementById("history"),
    footer: document.getElementById("footer-streak")
  };

  els.ringFg.style.strokeDasharray = RING_CIRCUMFERENCE;
  els.ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE;

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  function renderHeader() {
    var now = new Date();
    var hour = now.getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    els.greeting.textContent = greet;
    els.todayDate.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  function renderProgress() {
    var todayKey = dateKey(new Date());
    var done = countDone(todayKey);
    var total = HABITS.length;
    var pct = Math.round((done / total) * 100);
    els.ringLabel.textContent = pct + "%";
    els.ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - done / total);

    if (done === 0) els.summary.textContent = "Let's build some good habits today.";
    else if (done === total) els.summary.textContent = "Perfect day — all " + total + " habits done! 🎉";
    else els.summary.textContent = done + " of " + total + " habits done. Keep it up!";
  }

  function renderHabits() {
    var todayKey = dateKey(new Date());
    els.list.innerHTML = "";
    HABITS.forEach(function (h) {
      var done = isDone(todayKey, h.id);
      var streak = streakFor(h.id);

      var row = document.createElement("div");
      row.className = "habit" + (done ? " done" : "");
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-pressed", done ? "true" : "false");
      row.setAttribute("aria-label", h.name + (done ? ", done" : ", not done"));

      var streakText = streak > 0 ? "🔥 " + streak + " day streak" : "Tap to mark done";

      row.innerHTML =
        '<div class="habit-emoji">' + h.emoji + "</div>" +
        '<div class="habit-info">' +
        '<p class="habit-name">' + h.name + "</p>" +
        '<p class="habit-streak">' + streakText + "</p>" +
        "</div>" +
        '<div class="check">' + CHECK_SVG + "</div>";

      function activate() {
        toggle(todayKey, h.id);
        renderAll();
      }
      row.addEventListener("click", activate);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });

      els.list.appendChild(row);
    });
  }

  function renderHistory() {
    var today = new Date();
    var todayKey = dateKey(today);
    els.history.innerHTML = "";
    for (var i = 6; i >= 0; i--) {
      var d = addDays(today, -i);
      var key = dateKey(d);
      var done = countDone(key);
      var total = HABITS.length;

      var col = document.createElement("div");
      col.className = "day-col" + (key === todayKey ? " is-today" : "");

      var label = d.toLocaleDateString(undefined, { weekday: "short" }).charAt(0);

      var bubbleClass = "day-bubble";
      if (done === total) bubbleClass += " full";
      else if (done > 0) bubbleClass += " partial";

      col.innerHTML =
        '<span class="day-label">' + label + "</span>" +
        '<span class="' + bubbleClass + '">' + (done > 0 ? done : "") + "</span>";

      els.history.appendChild(col);
    }
  }

  function renderFooter() {
    var best = 0;
    HABITS.forEach(function (h) {
      var s = streakFor(h.id);
      if (s > best) best = s;
    });
    els.footer.textContent =
      best > 0 ? "Best active streak: " + best + " days 🔥" : "Tap a habit to get started.";
  }

  function renderAll() {
    renderProgress();
    renderHabits();
    renderHistory();
    renderFooter();
  }

  renderHeader();
  renderAll();

  // Re-render if the app is reopened on a new day.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      renderHeader();
      renderAll();
    }
  });

  // Register service worker for offline / installable PWA.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
