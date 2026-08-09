/* Elixir — drill.
   A timed-feeling run through a filtered slice of the bank. Multiple-choice
   questions are graded automatically; recall questions are self-graded and feed
   the spaced-repetition queue, so a drill doubles as a review session. */
window.Elixir = window.Elixir || {};

Elixir.drill = (function () {
  "use strict";

  var ui = Elixir.ui, state = Elixir.state, sched = Elixir.scheduler;
  var $ = ui.$;

  var run = { items: [], i: 0, correct: 0, answered: false };

  function renderDomainChips() {
    var host = $("dom-chips");
    host.innerHTML = "";
    Object.keys(Elixir.DOMAINS).forEach(function (key) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "chip on";
      el.textContent = Elixir.DOMAINS[key].n;
      el.dataset.k = key;
      el.setAttribute("aria-pressed", "true");
      el.onclick = function () {
        var on = el.classList.toggle("on");
        el.setAttribute("aria-pressed", on ? "true" : "false");
      };
      host.appendChild(el);
    });
  }

  function selectedDomains() {
    return Array.prototype.map.call(
      document.querySelectorAll("#dom-chips .chip.on"),
      function (el) { return el.dataset.k; }
    );
  }

  function poolFor(domains, difficulty) {
    return Elixir.BANK.filter(function (q) {
      if (q.df === 9) return false;                       // retired
      if (domains.indexOf(q.dm) === -1) return false;
      return difficulty === 0 || q.df === difficulty;
    });
  }

  /* Live count under the controls, so you know the filter is too narrow before
     you press Start rather than after. */
  function updateAvailable() {
    var el = $("d-available");
    if (!el) return;
    var n = poolFor(selectedDomains(), +$("d-diff").value).length;
    el.textContent = n + (n === 1 ? " question matches" : " questions match");
  }

  function start() {
    var domains = selectedDomains();
    if (!domains.length) { updateAvailable(); $("d-available").textContent = "Pick at least one domain."; return; }

    var difficulty = +$("d-diff").value;
    var wanted = Math.max(3, Math.min(60, +$("d-count").value || 20));
    var pool = poolFor(domains, difficulty);
    if (!pool.length) { $("d-available").textContent = "Nothing matches — loosen the difficulty."; return; }

    run = {
      items: ui.shuffle(pool).slice(0, wanted).map(function (q) {
        var item = { q: q };
        if (q.ty === "mcq") {
          var order = ui.shuffle(q.opts.map(function (_, i) { return i; }));
          item.options = order.map(function (i) { return q.opts[i]; });
          item.answer  = order.indexOf(q.ans);
        }
        return item;
      }),
      i: 0, correct: 0, answered: false
    };

    $("drill-setup").classList.add("hide");
    $("drill-done").classList.add("hide");
    $("drill-run").classList.remove("hide");
    renderQuestion();
  }

  function renderQuestion() {
    var item = run.items[run.i], q = item.q;
    run.answered = false;

    $("drill-bar").style.width = (100 * run.i / run.items.length) + "%";
    $("drill-next").disabled = true;

    var html = ui.metaLine(q, (run.i + 1) + " / " + run.items.length + " · " + run.correct + " right");
    html += '<div class="q-text">' + q.q + "</div>";
    html += q.ty === "mcq"
      ? ui.optionsHtml(item.options)
      : '<div class="reveal" id="reveal" role="button" tabindex="0">Recall it out loud first — then reveal.</div>';
    html += '<div id="exp"></div>';

    $("drill-q").innerHTML = html;

    if (q.ty === "mcq") {
      $("opts").addEventListener("click", function (e) {
        var btn = e.target.closest(".opt");
        if (btn) answer(+btn.dataset.i);
      });
    } else {
      var reveal = $("reveal");
      reveal.addEventListener("click", revealRecall);
      reveal.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); revealRecall(); }
      });
    }
  }

  function answer(chosen) {
    if (run.answered) return;
    run.answered = true;

    var item = run.items[run.i], q = item.q;
    var ok = chosen === item.answer;
    if (ok) run.correct++;

    ui.markOptions($("opts"), item.answer, chosen);
    state.recordAnswer(q.dm, ok);

    /* A drilled multiple-choice question also enters the review queue: right
       answers advance it, wrong ones send it back to tomorrow. */
    sched.grade(q.id, ok ? sched.GRADE.GOOD : sched.GRADE.MISSED);

    $("exp").innerHTML = ui.explanationHtml(q, ok ? "ok" : "no");
    $("drill-next").disabled = false;
    $("drill-next").focus();
  }

  function revealRecall() {
    if (run.answered) return;
    run.answered = true;

    var q = run.items[run.i].q;
    $("reveal").outerHTML = '<div class="answer">' + q.ans + "</div>";
    $("exp").innerHTML = (q.exp ? ui.explanationHtml(q, null) : "") + ui.gradeRowHtml();
    $("grade-row").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-g]");
      if (btn) gradeRecall(+btn.dataset.g);
    });
    $("drill-next").disabled = false;
  }

  function gradeRecall(g) {
    var q = run.items[run.i].q;
    if (g > 0) run.correct++;
    state.recordAnswer(q.dm, g > 0);
    sched.grade(q.id, g);
    $("grade-row").outerHTML = '<p class="faint" style="font-size:14px">Logged — next question.</p>';
    next();
  }

  function next() {
    run.i++;
    if (run.i >= run.items.length) { finish(); return; }
    renderQuestion();
  }

  function finish() {
    $("drill-run").classList.add("hide");
    var total = run.items.length;
    var accuracy = ui.pct(run.correct, total);

    state.bumpStreak();
    state.data.xp += run.correct * 10;
    state.save();

    var verdict =
      accuracy >= 95 ? "Near-perfect. Raise the difficulty." :
      accuracy >= 80 ? "Strong — but 80% is not the standard. Hunt every miss." :
      accuracy >= 60 ? "Passable. Drill the weak domains until they are automatic." :
                       "Below standard. This is the work — run it again.";

    $("drill-done").innerHTML =
      '<h2>Drill complete</h2>' +
      '<div class="stat-grid" style="margin-top:22px">' +
        ui.statCell(run.correct + "/" + total, "score") +
        ui.statCell(accuracy + "%", "accuracy") +
        ui.statCell("+" + (run.correct * 10), "XP") +
      "</div>" +
      '<p class="note">' + ui.esc(verdict) + "</p>" +
      '<div class="row" style="margin-top:22px">' +
        '<button class="btn" type="button" data-go="drill-again">New drill</button>' +
        '<button class="btn quiet" type="button" data-go="cards">Review due cards</button>' +
      "</div>";

    $("drill-done").classList.remove("hide");
    $("drill-done").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-go]");
      if (!btn) return;
      if (btn.dataset.go === "drill-again") reset();
      else Elixir.app.go("cards");
    });
    Elixir.app.refreshCounters();
  }

  function reset() {
    $("drill-done").classList.add("hide");
    $("drill-run").classList.add("hide");
    $("drill-setup").classList.remove("hide");
    updateAvailable();
  }

  /* Keyboard: number keys pick an option or a grade, Enter advances, Escape
     quits. Only active while a drill is actually on screen. */
  function handleKey(e) {
    if ($("drill-run").classList.contains("hide")) return false;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return false;

    if (e.key === "Escape") { reset(); return true; }

    if (e.key === "Enter" && !$("drill-next").disabled) { next(); return true; }

    var n = parseInt(e.key, 10);
    if (!n || n < 1 || n > 4) return false;

    if (!run.answered) {
      var item = run.items[run.i];
      if (item.q.ty === "mcq" && n <= item.options.length) { answer(n - 1); return true; }
      if (item.q.ty === "flash") { revealRecall(); return true; }
    } else if ($("grade-row") && n <= 3) {
      gradeRecall(n - 1);
      return true;
    }
    return false;
  }

  function init() {
    renderDomainChips();
    $("dom-chips").addEventListener("click", updateAvailable);
    $("d-diff").addEventListener("change", updateAvailable);
    $("d-start").addEventListener("click", start);
    $("drill-next").addEventListener("click", next);
    $("drill-quit").addEventListener("click", reset);
    updateAvailable();
  }

  return { init: init, reset: reset, handleKey: handleKey, updateAvailable: updateAvailable };
})();
