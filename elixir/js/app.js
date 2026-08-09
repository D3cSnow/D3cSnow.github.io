/* Elixir — bootstrap: routing, counters, theme, keyboard, service worker. */
window.Elixir = window.Elixir || {};

Elixir.app = (function () {
  "use strict";

  var ui = Elixir.ui, state = Elixir.state, plan = Elixir.plan, sched = Elixir.scheduler;
  var $ = ui.$;

  var SECTIONS = ["today", "drill", "cards", "roadmap", "progress"];

  function go(name) {
    if (SECTIONS.indexOf(name) === -1) name = "today";

    SECTIONS.forEach(function (s) {
      $(s).classList.toggle("hide", s !== name);
    });
    document.querySelectorAll("#nav button").forEach(function (b) {
      var on = b.dataset.t === name;
      b.classList.toggle("on", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });

    if (name === "today")    Elixir.views.today();
    if (name === "roadmap")  Elixir.views.roadmap();
    if (name === "progress") Elixir.views.progress();
    if (name === "cards")    Elixir.cards.refreshHeader();

    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* Counters. A date that has already passed reads 0 and is dimmed rather than
     removed, so the header never reflows mid-term. */
  function refreshCounters() {
    [["cd-term", plan.CALENDAR.termStart],
     ["cd-mid",  plan.CALENDAR.midStart],
     ["cd-fin",  plan.CALENDAR.finStart]].forEach(function (pair) {
      var left = plan.daysTo(pair[1]);
      var el = $(pair[0]);
      el.textContent = Math.max(0, left);
      el.parentNode.classList.toggle("spent", left <= 0);
    });

    $("st-streak").textContent = state.data.streak || 0;
    $("bank-n").textContent = Elixir.BANK.length;
    $("due-inline").textContent = sched.due(Elixir.BANK).length;
  }

  /* theme ------------------------------------------------------------------
     Three states: follow the system, force light, force dark. The choice is
     stored with the rest of the state so an export carries it too. */
  function applyTheme() {
    var t = state.data.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");

    var label = t === "light" ? "Light" : t === "dark" ? "Dark" : "Auto";
    $("theme-btn").textContent = "Theme: " + label;
    $("theme-btn").setAttribute("aria-label", "Theme, currently " + label + ". Click to change.");

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = t === "dark" ||
        (!t && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#171614" : "#FAF9F5");
    }
  }

  function cycleTheme() {
    var order = [null, "light", "dark"];
    var i = order.indexOf(state.data.theme || null);
    state.data.theme = order[(i + 1) % order.length];
    state.save();
    applyTheme();
  }

  function markStudied() {
    var advanced = state.bumpStreak();
    refreshCounters();
    $("study-note").textContent = advanced
      ? "Logged — streak " + state.data.streak + "."
      : "Already logged today — streak " + state.data.streak + ".";
  }

  function keyboard(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Elixir.drill.handleKey(e)) return;
    if (Elixir.cards.handleKey(e)) return;
  }

  function init() {
    applyTheme();

    document.querySelectorAll("#nav button").forEach(function (b) {
      b.onclick = function () { go(b.dataset.t); };
    });

    $("today").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-go], [data-act]");
      if (!btn) return;
      if (btn.dataset.act === "studied") markStudied();
      else if (btn.dataset.go === "drill") { go("drill"); Elixir.drill.reset(); }
      else go(btn.dataset.go);
    });

    $("theme-btn").addEventListener("click", cycleTheme);
    $("export-btn").addEventListener("click", state.exportFile);
    $("import-btn").addEventListener("click", function () {
      state.importFile(function () { refreshCounters(); Elixir.views.progress(); Elixir.views.today(); });
    });
    $("reset-btn").addEventListener("click", function () {
      state.reset(function () { refreshCounters(); Elixir.views.progress(); Elixir.views.today(); });
    });

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        if (!state.data.theme) applyTheme();
      });
    }

    document.addEventListener("keydown", keyboard);
    window.addEventListener("hashchange", function () { go(location.hash.slice(1)); });

    Elixir.drill.init();
    Elixir.cards.init();

    refreshCounters();
    go(location.hash.slice(1) || "today");
  }

  return { init: init, go: go, refreshCounters: refreshCounters };
})();

/* The service worker only registers over http(s). Opened straight off the disk
   as a file:// page the app still works — it simply has nothing to cache. */
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}

document.addEventListener("DOMContentLoaded", Elixir.app.init);
