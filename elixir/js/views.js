/* Elixir — the read-only screens: Today, Roadmap, Progress. */
window.Elixir = window.Elixir || {};

Elixir.views = (function () {
  "use strict";

  var ui = Elixir.ui, state = Elixir.state, plan = Elixir.plan, sched = Elixir.scheduler;
  var $ = ui.$;

  /* today ------------------------------------------------------------------ */

  function today() {
    var phase = plan.currentPhase();
    var topics = plan.topicsForToday();

    $("phase-pill").textContent = phase.name;
    $("phase-desc").textContent = phase.desc;
    $("today-date").textContent = new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    $("today-focus").innerHTML =
      '<div><span class="side">MED</span>' + ui.esc(topics.med) + "</div>" +
      '<div style="margin-top:6px"><span class="side">AI</span>' + ui.esc(topics.ai) + "</div>";

    $("schedule").innerHTML = plan.scheduleFor(phase, topics.med, topics.ai)
      .map(function (b) {
        return '<div class="block"><div class="t">' + ui.esc(b.t) + "</div>" +
               '<div><div class="k">' + ui.esc(b.k) + "</div>" +
               '<div class="d">' + ui.esc(b.d) + "</div></div></div>";
      }).join("");

    $("due-inline").textContent = sched.due(Elixir.BANK).length;
  }

  /* roadmap ---------------------------------------------------------------- */

  function roadmap() {
    var here = plan.currentPhase().id;
    $("rm-today").textContent = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    });

    $("rm-body").innerHTML = plan.ROADMAP.map(function (p) {
      return '<div class="rm-phase' + (p.id === here ? " now" : "") + '">' +
               '<div class="when">' + ui.esc(p.when) + (p.id === here ? " · you are here" : "") + "</div>" +
               "<h3>" + ui.esc(p.h) + "</h3>" +
               "<ul>" + p.items.map(function (x) { return "<li>" + ui.esc(x) + "</li>"; }).join("") + "</ul>" +
             "</div>";
    }).join("");
  }

  /* progress --------------------------------------------------------------- */

  function progress() {
    var S = state.data;
    var accuracy = ui.pct(S.correct, S.answered);
    var seen = Object.keys(S.sr).length;

    $("stat-grid").innerHTML =
      ui.statCell(S.streak, "day streak") +
      ui.statCell(S.answered, "questions answered") +
      ui.statCell(accuracy + "%", "overall accuracy") +
      ui.statCell(S.xp, "XP") +
      ui.statCell(seen + "/" + Elixir.BANK.length, "cards seen") +
      ui.statCell(sched.matureCount(), "mature cards");

    /* Accuracy by domain. Anything under 75% is flagged — that is the rule from
       the roadmap's weekly scoreboard, made visible instead of remembered. */
    $("dom-stats").innerHTML = Object.keys(Elixir.DOMAINS).map(function (k) {
      var d = S.byDom[k] || { a: 0, c: 0 };
      var p = ui.pct(d.c, d.a);
      return ui.barRow(
        Elixir.DOMAINS[k].n,
        d.a ? d.c + "/" + d.a + " · " + p + "%" : "no data",
        p,
        d.a >= 5 && p < 75
      );
    }).join("");

    var counts = sched.boxCounts();
    var max = Math.max(1, Math.max.apply(null, counts));
    $("box-stats").innerHTML = counts.map(function (n, i) {
      var label = "Box " + i + (i === 0 ? " · new" : i >= 4 ? " · mature" : "");
      var days = sched.BOX_DAYS[i];
      return ui.barRow(
        label,
        n + (n === 1 ? " card" : " cards") + (i > 0 ? " · " + days + "d" : ""),
        100 * n / max,
        false
      );
    }).join("");
  }

  return { today: today, roadmap: roadmap, progress: progress };
})();
