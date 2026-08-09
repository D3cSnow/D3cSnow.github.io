/* Elixir — persistent state.
   ---------------------------------------------------------------------------
   Everything lives in localStorage on this device. There is no backend and
   nothing is ever sent anywhere.

   Schema history
     1  scheduling keyed by the question's POSITION in the bank array. Editing
        the bank silently repointed every schedule after the edit.
     2  scheduling keyed by the question's permanent id. Safe to reorder.

   The migration from 1 to 2 runs once, automatically, and keeps a copy of the
   old blob under a backup key first. Losing a review queue is the one failure
   this app cannot recover from — it is the only state that cannot be rebuilt.
   --------------------------------------------------------------------------- */
window.Elixir = window.Elixir || {};

Elixir.state = (function () {
  "use strict";

  var KEY        = "elixir_v1";
  var LEGACY_KEY = "warroom_v1";          // the pre-rename War Room build
  var BACKUP_KEY = "elixir_backup_schema1";
  var SCHEMA     = 2;

  /* Size of the bank at the moment ids were introduced. A schema-1 index at or
     beyond this never referred to a real question, so it is dropped. */
  var LEGACY_BANK_LENGTH = 117;

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  function dayNumber(s) {
    var p = String(s).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5;
  }

  function today0() { return dayNumber(todayStr()); }

  function defaults() {
    return {
      schema:    SCHEMA,
      streak:    0,
      lastStudy: null,
      xp:        0,
      answered:  0,
      correct:   0,
      byDom:     {},
      sr:        {},
      startDate: todayStr(),
      theme:     null            // null = follow the operating system
    };
  }

  /* Ids were handed out in the original bank order, so schema-1 index i is
     exactly id q(i+1), zero-padded to four digits. */
  function idAtLegacyIndex(i) {
    if (!Number.isInteger(i) || i < 0 || i >= LEGACY_BANK_LENGTH) return null;
    return "q" + String(i + 1).padStart(4, "0");
  }

  /* Merge a stored blob onto the defaults WITHOUT letting the defaults supply a
     schema number. State written before schemas existed has no `schema` key at
     all, and a plain Object.assign(defaults(), stored) would stamp the current
     version onto it — the migration would then decide there was nothing to do
     and the queue would be read as ids when it is still keyed by index. Version
     is therefore always read off the raw object, before merging. */
  function hydrate(stored) {
    var version = Number(stored.schema) || 1;
    var merged = Object.assign(defaults(), stored);
    merged.schema = version;
    return migrate(merged);
  }

  var didMigrate = false;

  function migrate(data) {
    if (data.schema >= SCHEMA) return data;
    didMigrate = true;

    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
    } catch (e) { /* a full quota must not block the migration */ }

    var oldSr = data.sr || {};
    var newSr = {};
    var moved = 0, dropped = 0;

    Object.keys(oldSr).forEach(function (k) {
      if (/^q\d{4}$/.test(k)) { newSr[k] = oldSr[k]; return; }   // already an id
      var id = idAtLegacyIndex(Number(k));
      if (id) { newSr[id] = oldSr[k]; moved++; } else { dropped++; }
    });

    data.sr = newSr;
    data.schema = SCHEMA;
    data.migratedAt = todayStr();

    if (window.console && console.info) {
      console.info("Elixir: migrated " + moved + " scheduled cards to stable ids" +
                   (dropped ? " (" + dropped + " stale entries dropped)" : "") +
                   ". Previous state kept at " + BACKUP_KEY + ".");
    }
    return data;
  }

  function load() {
    var raw;
    try {
      raw = localStorage.getItem(KEY);
      if (raw === null) {
        var old = localStorage.getItem(LEGACY_KEY);   // War Room → Elixir
        if (old !== null) { localStorage.setItem(KEY, old); raw = old; }
      }
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults();
      return hydrate(parsed);
    } catch (e) {
      return defaults();
    }
  }

  var S = load();

  var listeners = [];

  /* Anything that needs to react to a write registers here. Only the sync
     client uses it, and sync is optional — with no listener this is inert. */
  function onSave(fn) { listeners.push(fn); }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      if (window.console) console.warn("Elixir: could not save — storage full or blocked.", e);
    }
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { /* a listener must never break a save */ }
    }
  }

  /* Used by the sync client after a merge: swap in a whole new state without
     re-entering the save path that would immediately push it back again. */
  function replace(next, quiet) {
    S = hydrate(next);
    if (quiet) {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    } else {
      save();
    }
    return S;
  }

  /* Write a migration straight back to storage instead of waiting for the user
     to answer something. Otherwise every launch re-runs it against the same old
     blob — harmless in itself, but the backup key would be rewritten each time
     and the upgrade would never actually settle. */
  if (didMigrate) save();

  function recordAnswer(dm, ok) {
    S.answered++;
    if (ok) S.correct++;
    if (!S.byDom[dm]) S.byDom[dm] = { a: 0, c: 0 };
    S.byDom[dm].a++;
    if (ok) S.byDom[dm].c++;
    save();
  }

  /* A streak counts consecutive calendar days with any studying at all. Doing
     more on one day never advances it twice. */
  function bumpStreak() {
    var t = todayStr();
    if (S.lastStudy === t) return false;
    var yesterday = todayStr(new Date(Date.now() - 864e5));
    S.streak = (S.lastStudy === yesterday) ? S.streak + 1 : 1;
    S.lastStudy = t;
    save();
    return true;
  }

  function exportFile() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "elixir_progress_" + todayStr() + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importFile(onDone) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var incoming;
        try {
          incoming = JSON.parse(reader.result);
          if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
            throw new Error("shape");
          }
        } catch (e) {
          alert("That file could not be read as Elixir progress.");
          return;
        }
        var n = Object.keys(incoming.sr || {}).length;
        if (!confirm(
          "Replace this device's progress with the imported file?\n\n" +
          "Incoming: streak " + (incoming.streak || 0) + ", " + n + " scheduled cards.\n" +
          "This device's streak, scheduling and stats will be overwritten. " +
          "This cannot be undone."
        )) return;

        S = hydrate(incoming);          // exports from the old build still work
        save();
        if (onDone) onDone();
        alert("Import done.");
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function reset(onDone) {
    if (!confirm("Erase all progress, streak and card scheduling on this device? This cannot be undone.")) return;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(S)); } catch (e) {}
    localStorage.removeItem(KEY);
    S = defaults();
    save();
    if (onDone) onDone();
  }

  return {
    get data()  { return S; },
    save:         save,
    onSave:       onSave,
    replace:      replace,
    defaults:     defaults,
    recordAnswer: recordAnswer,
    bumpStreak:   bumpStreak,
    exportFile:   exportFile,
    importFile:   importFile,
    reset:        reset,
    todayStr:     todayStr,
    dayNumber:    dayNumber,
    today0:       today0,
    KEY:          KEY,
    BACKUP_KEY:   BACKUP_KEY
  };
})();
