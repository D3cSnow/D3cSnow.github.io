/* Elixir — spaced repetition session.
   Pure recall: the question is shown, you say the answer out loud, then you
   grade yourself honestly. Multiple-choice entries are shown without their
   options here on purpose — recognising the right option is not the same as
   knowing the answer. */
window.Elixir = window.Elixir || {};

Elixir.cards = (function () {
  "use strict";

  var ui = Elixir.ui, state = Elixir.state, sched = Elixir.scheduler;
  var $ = ui.$;

  var byId = null;
  function question(id) {
    if (!byId) {
      byId = {};
      Elixir.BANK.forEach(function (q) { byId[q.id] = q; });
    }
    return byId[id];
  }

  var run = { ids: [], i: 0, shown: false };

  function refreshHeader() {
    var due = sched.due(Elixir.BANK).length;
    var unseen = sched.unseen(Elixir.BANK).length;
    $("due-count").textContent = due + " due";
    $("new-count").textContent = unseen + " unseen";
  }

  function start(mode) {
    var ids;
    if (mode === "due")      ids = sched.due(Elixir.BANK);
    else if (mode === "new") ids = sched.unseen(Elixir.BANK).slice(0, 20);
    else                     ids = Elixir.BANK.filter(function (q) { return q.df !== 9; })
                                              .map(function (q) { return q.id; });

    var host = $("card-run");
    host.classList.remove("hide");

    if (!ids.length) {
      host.innerHTML = '<div class="empty">' + (
        mode === "due" ? "Nothing due today. Learn new cards, or cram the whole bank."
                       : "Nothing left in that queue."
      ) + "</div>";
      return;
    }

    run = { ids: ui.shuffle(ids), i: 0, shown: false };
    render();
  }

  function render() {
    var host = $("card-run");

    if (run.i >= run.ids.length) {
      state.bumpStreak();
      Elixir.app.refreshCounters();
      refreshHeader();
      host.innerHTML =
        '<div class="empty">Session done — ' + run.ids.length + " cards reviewed. Streak " +
        state.data.streak + ".</div>" +
        '<div class="row" style="justify-content:center">' +
          '<button class="btn" type="button" data-m="due">More due</button>' +
          '<button class="btn quiet" type="button" data-go="drill">Go drill</button>' +
        "</div>";
      return;
    }

    var q = question(run.ids[run.i]);
    run.shown = false;

    var right = "card " + (run.i + 1) + "/" + run.ids.length + " · box " + sched.boxOf(q.id);
    var html = ui.metaLine(q, right);
    html += '<div class="q-text">' + q.q + "</div>";
    html += '<div id="c-body"><div class="reveal" id="c-reveal" role="button" tabindex="0">' +
            "Recall it out loud — then check.</div></div>";

    host.innerHTML = html;
    var reveal = $("c-reveal");
    reveal.addEventListener("click", show);
    reveal.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); }
    });
  }

  function show() {
    var q = question(run.ids[run.i]);
    run.shown = true;
    var answer = q.ty === "mcq" ? q.opts[q.ans] : q.ans;

    $("c-body").innerHTML =
      '<div class="answer">' + ui.esc(answer) + "</div>" +
      (q.exp ? ui.explanationHtml(q, null) : "") +
      ui.gradeRowHtml();

    $("grade-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-g]");
      if (btn) grade(+btn.dataset.g);
    });
  }

  function grade(g) {
    var q = question(run.ids[run.i]);
    sched.grade(q.id, g);
    state.recordAnswer(q.dm, g > 0);
    run.i++;
    render();
  }

  function handleKey(e) {
    if ($("card-run").classList.contains("hide")) return false;
    if (!run.ids.length || run.i >= run.ids.length) return false;

    if (!run.shown && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); show(); return true; }

    if (run.shown) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) { grade(n - 1); return true; }
    }
    return false;
  }

  function init() {
    $("cards").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-m], [data-go]");
      if (!btn) return;
      if (btn.dataset.m) start(btn.dataset.m);
      else Elixir.app.go(btn.dataset.go);
    });
  }

  return { init: init, start: start, refreshHeader: refreshHeader, handleKey: handleKey };
})();
