/* Elixir — shared rendering helpers.
   Question text and explanations are first-party content and may contain
   inline markup such as <b>, so they are written as HTML. Anything that could
   vary — option text, answers, counts — is escaped. */
window.Elixir = window.Elixir || {};

Elixir.ui = (function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pct(n, d) { return d ? Math.round(100 * n / d) : 0; }

  function domainLabel(q) {
    var d = Elixir.DOMAINS[q.dm];
    return d ? d.n : q.dm;
  }

  var DIFF_NAME = { 1: "core", 2: "applied", 3: "hard", 9: "retired" };

  /* The line above every question: what it is and where you are. Deliberately
     mono and quiet — it is metadata, not part of the question. */
  function metaLine(q, right) {
    return '<div class="q-meta"><span>' + esc(domainLabel(q)) + " · " +
           esc(DIFF_NAME[q.df] || q.df) + " · " +
           (q.ty === "mcq" ? "multiple choice" : "recall") +
           '</span><span>' + esc(right) + "</span></div>";
  }

  function optionsHtml(options) {
    return '<div class="opts" id="opts">' + options.map(function (text, i) {
      return '<button class="opt" type="button" data-i="' + i + '">' +
             '<span class="ltr">' + "ABCD".charAt(i) + "</span>" +
             "<span>" + esc(text) + "</span></button>";
    }).join("") + "</div>";
  }

  /* Paint the result of an answered multiple-choice question: the correct
     option is marked, a wrong pick is marked, everything else recedes. */
  function markOptions(container, correctIndex, chosenIndex) {
    var opts = container.querySelectorAll(".opt");
    Array.prototype.forEach.call(opts, function (el, i) {
      el.disabled = true;
      if (i === correctIndex)                      el.classList.add("correct");
      else if (i === chosenIndex)                  el.classList.add("wrong");
      else                                         el.classList.add("spent");
    });
  }

  function explanationHtml(q, verdict) {
    if (!verdict && !q.exp) return "";
    var head = verdict
      ? '<span class="verdict ' + (verdict === "ok" ? "ok" : "no") + '">' +
        (verdict === "ok" ? "Correct" : "Not quite") + "</span> "
      : "";
    return '<div class="exp">' + head + (q.exp || "") + "</div>";
  }

  function gradeRowHtml() {
    return '<div class="grade-row" id="grade-row">' +
           '<button class="btn" type="button" data-g="0">Missed it</button>' +
           '<button class="btn" type="button" data-g="1">Got it</button>' +
           '<button class="btn" type="button" data-g="2">Easy</button></div>';
  }

  function barRow(label, right, percent, weak) {
    return '<div class="bar-row' + (weak ? " weak" : "") + '">' +
             '<div class="lab"><span>' + esc(label) + "</span>" +
             '<span class="pct">' + esc(right) + "</span></div>" +
             '<div class="progress-bar"><i style="width:' + percent + '%"></i></div>' +
           "</div>";
  }

  function statCell(value, key) {
    return '<div class="stat"><div class="v">' + esc(value) + "</div>" +
           '<div class="k">' + esc(key) + "</div></div>";
  }

  return {
    $: $, esc: esc, shuffle: shuffle, pct: pct,
    domainLabel: domainLabel,
    metaLine: metaLine,
    optionsHtml: optionsHtml,
    markOptions: markOptions,
    explanationHtml: explanationHtml,
    gradeRowHtml: gradeRowHtml,
    barRow: barRow,
    statCell: statCell
  };
})();
