/* Elixir — cross-device sync.
   ---------------------------------------------------------------------------
   Offline-first. localStorage stays the source of truth; the server is a
   mirror. Every feature works with the network off, and always did — sync only
   ever adds. If the server is unreachable, unconfigured, or the project is
   asleep, nothing here surfaces an error into the study flow.

   Pairing: the first device generates a 16-character vault key (80 bits from
   crypto.getRandomValues). Typing that key on a second device points it at the
   same vault. There is no account and no email; the key IS the credential, and
   the server only ever stores its hash.

   Merging is per card, and the rule that matters is this one: a review is never
   silently dropped. When two devices have both graded the same card, the more
   recent grading wins. When only one has touched it, that one wins. The failure
   mode of the obvious alternative — last writer replaces the whole blob — is
   that a morning of phone reviews vanishes the moment you open the laptop, with
   nothing on screen to tell you it happened.
   --------------------------------------------------------------------------- */
window.Elixir = window.Elixir || {};

Elixir.sync = (function () {
  "use strict";

  var state = Elixir.state;

  var VAULT_KEY_STORAGE = "elixir_vault_key";
  var LAST_SYNC_STORAGE = "elixir_last_sync";
  var PUSH_DEBOUNCE = 4000;

  /* Crockford base32, minus the letters that get misread when typed off a
     screen. 16 characters of this is 80 bits — far past guessing. */
  var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var KEY_LENGTH = 16;

  var listeners = [];
  var status = { state: "off", detail: "", at: null };
  var pushTimer = null;
  var inFlight = false;
  var suspended = false;      // set while applying a merge, so we do not echo

  /* configuration ---------------------------------------------------------- */

  function config() {
    var c = Elixir.SYNC_CONFIG || {};
    return (c.url && c.anonKey) ? c : null;
  }

  function configured() { return !!config(); }

  /* vault key -------------------------------------------------------------- */

  function generateKey() {
    var bytes = new Uint8Array(KEY_LENGTH);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < KEY_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }

  /* Accept whatever the user actually typed: spaces, dashes, lower case, and
     the classic confusions between O/0 and I/L/1. */
  function normalizeKey(input) {
    return String(input || "")
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .replace(/O/g, "0")
      .replace(/[IL]/g, "1");
  }

  function formatKey(key) {
    return (key || "").replace(/(.{4})(?=.)/g, "$1-");
  }

  function vaultKey() {
    try { return localStorage.getItem(VAULT_KEY_STORAGE) || null; } catch (e) { return null; }
  }

  function setVaultKey(key) {
    try {
      if (key) localStorage.setItem(VAULT_KEY_STORAGE, key);
      else localStorage.removeItem(VAULT_KEY_STORAGE);
    } catch (e) {}
  }

  function lastSync() {
    try { return localStorage.getItem(LAST_SYNC_STORAGE) || null; } catch (e) { return null; }
  }

  function setLastSync(iso) {
    try { localStorage.setItem(LAST_SYNC_STORAGE, iso); } catch (e) {}
  }

  function enabled() { return configured() && !!vaultKey(); }

  /* status ----------------------------------------------------------------- */

  function setStatus(next, detail) {
    status = { state: next, detail: detail || "", at: lastSync() };
    listeners.forEach(function (fn) { try { fn(status); } catch (e) {} });
  }

  function onStatus(fn) { listeners.push(fn); fn(status); }

  /* merge ------------------------------------------------------------------ */

  /* Which of two records for the same card is the real one.
     A record carrying a review timestamp always beats one without: the
     unstamped record predates sync, so it is older by definition. */
  function newerCard(a, b) {
    var ta = typeof a.t === "number" ? a.t : null;
    var tb = typeof b.t === "number" ? b.t : null;

    if (ta !== null && tb !== null) return ta >= tb ? a : b;
    if (ta !== null) return a;
    if (tb !== null) return b;

    /* Neither is stamped, so both predate sync. A higher box means more correct
       answers, and — at the same box, where the interval is identical — a later
       due date can only have come from a later review. */
    var ba = a.box || 0, bb = b.box || 0;
    if (ba !== bb) return ba > bb ? a : b;
    return (a.due || 0) >= (b.due || 0) ? a : b;
  }

  function mergeSchedules(local, remote) {
    var out = {};
    var ids = Object.keys(local);
    Object.keys(remote).forEach(function (id) {
      if (ids.indexOf(id) === -1) ids.push(id);
    });

    ids.forEach(function (id) {
      var a = local[id], b = remote[id];
      if (a && b)      out[id] = newerCard(a, b);
      else             out[id] = a || b;
    });
    return out;
  }

  /* Lifetime counters cannot be reconciled exactly — we cannot know how much of
     each device's total was already counted on the other. Taking the maximum
     under-reports when both devices worked offline; summing would double-count
     everything they shared. Under-reporting a vanity number is the lesser evil,
     and it never inflates a statistic you might act on. */
  function mergeCounters(local, remote) {
    var out = Object.assign({}, local);

    out.answered = Math.max(local.answered || 0, remote.answered || 0);
    out.correct  = Math.max(local.correct  || 0, remote.correct  || 0);
    out.xp       = Math.max(local.xp       || 0, remote.xp       || 0);
    out.streak   = Math.max(local.streak   || 0, remote.streak   || 0);

    out.lastStudy = [local.lastStudy, remote.lastStudy]
      .filter(Boolean).sort().pop() || null;

    out.startDate = [local.startDate, remote.startDate]
      .filter(Boolean).sort().shift() || local.startDate;

    var byDom = {};
    [local.byDom || {}, remote.byDom || {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) {
        if (!byDom[k]) byDom[k] = { a: 0, c: 0 };
        byDom[k].a = Math.max(byDom[k].a, src[k].a || 0);
        byDom[k].c = Math.max(byDom[k].c, src[k].c || 0);
      });
    });
    out.byDom = byDom;

    return out;
  }

  function merge(local, remote) {
    if (!remote || typeof remote !== "object" || Array.isArray(remote)) return local;

    var out = mergeCounters(local, remote);
    out.sr = mergeSchedules(local.sr || {}, remote.sr || {});
    out.schema = Math.max(local.schema || 1, remote.schema || 1);

    /* Theme is a property of the device you are looking at, not of the study
       record. A dark laptop must not force a bright phone into dark mode. */
    out.theme = local.theme;

    return out;
  }

  /* transport -------------------------------------------------------------- */

  function rpc(fn, body) {
    var c = config();
    return fetch(c.url.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        "apikey": c.anonKey,
        "Authorization": "Bearer " + c.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("HTTP " + res.status + (t ? " — " + t.slice(0, 140) : ""));
        });
      }
      return res.status === 204 ? null : res.json();
    });
  }

  /* The vault key never travels inside the payload, and neither does the theme.
     What goes up is the study record and nothing else. */
  function payload() {
    var d = state.data;
    var copy = JSON.parse(JSON.stringify(d));
    delete copy.theme;
    return copy;
  }

  /* the sync cycle --------------------------------------------------------- */

  function run(reason) {
    if (!enabled() || inFlight) return Promise.resolve(status);

    if (!navigator.onLine) {
      setStatus("offline", "Changes are saved here and will sync when you reconnect.");
      return Promise.resolve(status);
    }

    inFlight = true;
    setStatus("syncing", reason || "");

    var key = vaultKey();

    return rpc("vault_pull", { vault_key: key })
      .then(function (remote) {
        var local = state.data;
        var merged = merge(local, remote);

        /* Apply the merge without re-entering the save path, otherwise the
           write we just made would immediately queue another push. */
        suspended = true;
        try { state.replace(merged, true); } finally { suspended = false; }

        return rpc("vault_push", { vault_key: key, payload: payload() });
      })
      .then(function (stamp) {
        var iso = (typeof stamp === "string" ? stamp : new Date().toISOString());
        setLastSync(iso);
        setStatus("ok", "");
        if (Elixir.app) {
          Elixir.app.refreshCounters();
          Elixir.views.today();
        }
        return status;
      })
      .catch(function (err) {
        /* A failed sync is never fatal — the local copy is still authoritative
           and complete. Say so plainly instead of alarming mid-study. */
        setStatus("error", String(err.message || err).slice(0, 160));
        return status;
      })
      .then(function (s) { inFlight = false; return s; });
  }

  function schedulePush() {
    if (!enabled() || suspended) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { run("after changes"); }, PUSH_DEBOUNCE);
  }

  /* pairing ---------------------------------------------------------------- */

  function createVault() {
    var key = generateKey();
    setVaultKey(key);
    return run("first sync").then(function () { return key; });
  }

  /* Joining pulls first, so the device that types the code adopts everything
     already in the vault before contributing its own history. */
  function joinVault(input) {
    var key = normalizeKey(input);
    if (key.length !== KEY_LENGTH) {
      return Promise.reject(new Error("A pairing code is " + KEY_LENGTH + " characters."));
    }
    var previous = vaultKey();
    setVaultKey(key);
    return run("pairing").then(function (s) {
      if (s.state === "error") { setVaultKey(previous); throw new Error(s.detail); }
      return key;
    });
  }

  function disconnect() {
    setVaultKey(null);
    try { localStorage.removeItem(LAST_SYNC_STORAGE); } catch (e) {}
    setStatus(configured() ? "idle" : "off", "");
  }

  /* boot ------------------------------------------------------------------- */

  function init() {
    if (!configured()) { setStatus("off", ""); return; }
    if (!vaultKey())   { setStatus("idle", ""); return; }

    state.onSave(schedulePush);
    window.addEventListener("online", function () { run("back online"); });
    window.addEventListener("offline", function () {
      setStatus("offline", "Changes are saved here and will sync when you reconnect.");
    });

    /* Push anything still pending when the tab is hidden or closed — the
       debounce would otherwise lose the last few seconds of a session. */
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { clearTimeout(pushTimer); run("leaving"); }
    });

    run("startup");
  }

  return {
    init:         init,
    run:          run,
    configured:   configured,
    enabled:      enabled,
    vaultKey:     vaultKey,
    lastSync:     lastSync,
    createVault:  createVault,
    joinVault:    joinVault,
    disconnect:   disconnect,
    onStatus:     onStatus,
    formatKey:    formatKey,
    normalizeKey: normalizeKey,
    KEY_LENGTH:   KEY_LENGTH,

    /* exported for the test suite */
    _merge:       merge,
    _newerCard:   newerCard
  };
})();
