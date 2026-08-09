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

  /* sync ------------------------------------------------------------------- */

  var STATUS_TEXT = {
    off:     "",
    idle:    "Not paired yet.",
    syncing: "Syncing…",
    ok:      "In sync.",
    offline: "Offline — changes are saved here and will sync when you reconnect.",
    error:   "Could not sync."
  };

  function relative(iso) {
    if (!iso) return "never";
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1)    return "just now";
    if (mins < 60)   return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24)    return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hrs / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }

  function syncPanel() {
    var sync = Elixir.sync;
    var host = $("sync-panel");

    if (!sync.configured()) {
      host.innerHTML =
        '<p class="note">Sync is not set up. Without it, this browser keeps its own copy and ' +
        "nothing moves between your phone and your laptop on its own — use Export and Import " +
        "below.</p>" +
        '<p class="note faint" style="font-size:14px">To switch it on: create a free Supabase ' +
        "project, run <span class=\"mono\">supabase/schema.sql</span>, then paste the project URL " +
        "and anon key into <span class=\"mono\">js/sync-config.js</span>. Setup notes are in the README.</p>";
      return;
    }

    if (!sync.enabled()) {
      host.innerHTML =
        '<p class="note">Pair this device to keep every device on the same queue. Start on the ' +
        "device that already has your progress — create a code there, then enter it everywhere else.</p>" +
        '<div class="row" style="margin-top:22px">' +
          '<button class="btn" type="button" id="sync-create">Create a pairing code</button>' +
          '<button class="btn quiet" type="button" id="sync-join-open">I have a code</button>' +
        "</div>" +
        '<div id="sync-join" class="hide" style="margin-top:22px">' +
          '<label class="f" for="sync-code">Pairing code</label>' +
          '<div class="row">' +
            '<input type="text" id="sync-code" class="mono" placeholder="XXXX-XXXX-XXXX-XXXX" ' +
                   'autocomplete="off" autocapitalize="characters" spellcheck="false" style="width:15em">' +
            '<button class="btn" type="button" id="sync-join-go">Pair</button>' +
          "</div>" +
        "</div>";
      return;
    }

    host.innerHTML =
      '<p class="note">This device is paired. Reviews merge card by card, so studying on your ' +
      "phone and then opening your laptop never loses either side.</p>" +
      '<div class="vault-key" id="vault-key" title="Click to reveal">' +
        '<span class="masked">•••• •••• •••• ••••</span>' +
      "</div>" +
      '<p class="note faint" style="font-size:14px">Anyone with this code can read and change ' +
      "your progress, and it cannot be recovered if you lose every paired device. Keep a copy " +
      "somewhere safe.</p>" +
      '<div class="row" style="margin-top:22px">' +
        '<button class="btn" type="button" id="sync-now">Sync now</button>' +
        '<button class="btn quiet" type="button" id="sync-copy">Copy code</button>' +
        '<button class="btn quiet" type="button" id="sync-off">Unpair this device</button>' +
      "</div>";
  }

  function syncStatus(s) {
    var el = $("sync-status");
    if (!el) return;
    if (!Elixir.sync.configured() || s.state === "off") { el.textContent = ""; return; }

    var text = STATUS_TEXT[s.state] || "";
    if (s.state === "ok")    text += " Last synced " + relative(Elixir.sync.lastSync()) + ".";
    if (s.state === "error") text += " " + s.detail + " Your progress on this device is safe.";

    el.textContent = text;
    el.className = "sync-status" + (s.state === "error" ? " bad" : "");
  }

  return { today: today, roadmap: roadmap, progress: progress,
           syncPanel: syncPanel, syncStatus: syncStatus };
})();
