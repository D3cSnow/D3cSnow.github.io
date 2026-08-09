# D3cSnow.github.io

Static personal site. No build step, no dependencies, no framework — plain HTML, CSS and JS
served exactly as it sits in the repo.

```
/                          →  https://d3csnow.github.io/
├── index.html                 index page
├── .nojekyll                  serve files as-is, skip Jekyll
└── elixir/                →  https://d3csnow.github.io/elixir/
    ├── index.html             markup only — no logic, no styles
    ├── css/
    │   ├── tokens.css         design tokens (colour, type, space) + dark mode
    │   └── app.css            components
    ├── js/
    │   ├── state.js           localStorage, schema migrations
    │   ├── scheduler.js       Leitner spaced repetition
    │   ├── plan.js            term dates, phases, topic cycle, roadmap
    │   ├── ui.js              shared render helpers
    │   ├── views.js           Today · Roadmap · Progress
    │   ├── drill.js           drill sessions
    │   ├── cards.js           review sessions
    │   ├── app.js             routing, counters, theme, keyboard, bootstrap
    │   ├── sync.js            cross-device sync client
    │   └── sync-config.js     your Supabase URL + anon key (blank = sync off)
    ├── data/
    │   └── bank.js            the question bank
    ├── supabase/
    │   └── schema.sql         run once in the Supabase SQL editor
    ├── test/
    │   └── app.test.js        behaviour tests (dev only, never deployed)
    ├── sw.js                  service worker
    ├── manifest.webmanifest
    └── icon.svg · icon-180 · icon-192 · icon-512 · icon-maskable-512
```

**Elixir** — spaced-repetition study tool. Daily drills, a Leitner queue, the term roadmap.

State lives in `localStorage` on the device and the app is fully usable offline. Cross-device
sync is **optional and off by default**: with `js/sync-config.js` left blank, nothing is ever
sent anywhere. Switched on, the device stays the source of truth and the server is only a
mirror — see [Moving data between devices](#moving-data-between-devices).

Scripts load in dependency order as plain `<script>` tags, not ES modules, so the app also
runs when opened straight off the disk as a `file://` page. Modules would fail there on CORS.

---

## Repo visibility

GitHub Pages on a **free** account only publishes from **public** repositories.
Making this repo private takes the site offline.

| | Repo | Site | Cost |
|---|---|---|---|
| **A — current** | public | public | free |
| B — GitHub Pro | private | **still public** | free via Student Developer Pack |

Note that B hides the *source*, not the *site*. A Pages site is reachable by anyone who knows
the URL on every plan below Enterprise. If the site itself needs to be gated, GitHub Pages is
the wrong host — put it behind Cloudflare Access, or keep it local.

This repo therefore carries **no personal identifiers**: no name, no institution, no email,
no student ID. Keep it that way.

---

## Deploy

```powershell
git add .
git commit -m "describe the change"
git push
```

Live in 1–2 minutes. Settings → Pages → branch `main` / `(root)`.

**Bump the service-worker cache on every deploy.** In `elixir/sw.js`:

```js
const CACHE = "elixir-v5";   // → "elixir-v6"
```

The worker is network-first with a 3-second timeout, so a stale phone is rare even if you
forget — but bumping is what actually evicts the old files.

---

## Adding questions

The bank is `elixir/data/bank.js`, one JSON object per line.

```js
{"id":"q0118","dm":"AN","df":2,"ty":"mcq","q":"Question text?",
 "opts":["A","B","C","D"],"ans":1,"exp":"Explanation. <b>Bold</b> is allowed."},

{"id":"q0119","dm":"PH","df":1,"ty":"flash","q":"Prompt (front)",
 "ans":"Answer (back)","exp":"Optional note"},
```

| Field | Meaning |
|---|---|
| `id` | permanent, `qNNNN`. Give a new question the next unused number. **Never reuse one.** |
| `dm` | domain — `AN` `PH` `HI` `EM` `CV` `MI` `LLM` |
| `df` | difficulty — `1` core · `2` applied · `3` hard · `9` retired |
| `ty` | `mcq` (needs `opts` + `ans`) or `flash` (needs `ans`) |
| `ans` | for `mcq`, the index of the correct option, **0-based** |

### Reordering is now safe

Scheduling used to be stored as `S.sr[index]`, keyed by position in the array — inserting or
moving a single line silently repointed every schedule after it. It is now keyed by `id`, so
you can sort, group and insert freely.

To retire a question, set `"df":9` and no filter will select it. Deleting the line is also
safe now; keeping it just preserves the history.

---

## Tests

The site ships with no dependencies, but the test suite needs one:

```powershell
npm install jsdom
node elixir/test/app.test.js
```

It boots the real `index.html` in jsdom and drives it: routing, the daily plan, the Leitner
box maths, a full drill, every path through the state migration, and every path through the
sync merge. 77 assertions.

Run it after touching anything in `js/state.js`, `js/scheduler.js` or `js/sync.js`. Those three
are the files where a mistake destroys a review queue silently rather than throwing.

---

## Moving data between devices

`localStorage` is scoped per origin *and* per browser. A phone and a laptop never share state
on their own, and neither does Safari vs. an iOS home-screen install.

There are two ways across: sync, or a file.

### Sync (optional)

Off until configured. With `js/sync-config.js` left blank the app makes no network requests at
all and behaves exactly as it did before.

**Setup — once.**

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL editor → paste and run `elixir/supabase/schema.sql`.
3. Settings → API → copy **Project URL** and the **anon / public** key.
4. Paste both into `elixir/js/sync-config.js`, commit, push.

The anon key belongs in the repo — it is what every Supabase browser client ships with, and it
grants nothing by itself. **Never put the `service_role` key there.**

**Pairing.** Progress tab → *Create a pairing code* on the device that already has your
history. Enter that code on every other device. The code is 16 characters, 80 bits from
`crypto.getRandomValues`, and it is the only credential — there is no account and no email.

**How it merges.** Card by card, not blob by blob. When both devices have graded the same
card, the more recent grading wins; when only one has touched it, that one wins. A morning of
phone reviews therefore survives opening the laptop. Lifetime counters (answered, XP, streak)
take the larger of the two — they cannot be reconciled exactly, and under-reporting is better
than inflating. Theme is deliberately *not* synced; it belongs to the device.

**What is stored.** Box numbers, due dates, answer counts, a streak, an XP number. No name, no
email, no institution, no student id — the same promise the repo makes. The server holds only
the SHA-256 of your pairing code, the `vaults` table denies all direct access, and the two RPC
functions each require a key the server never hands out.

**Failure modes, all non-fatal.** Offline, server down, project asleep, wrong code — the local
copy stays authoritative and complete, and the app keeps working. Supabase pauses a free
project after a week of no requests; daily study keeps it awake, and if it does pause, resume
it from the dashboard and the next sync catches up.

**Losing the code.** If you lose every paired device and the code, the vault is unreachable —
that is the direct cost of storing no email. Keep a copy of the code somewhere, and keep taking
the occasional export.

### A file

Progress tab → **Export** a JSON → **Import** it on the other device. Still worth doing
occasionally even with sync on: it is the only copy that survives losing everything at once.
Exports from the old index-keyed build import correctly; exports from this build will not work
in the old one.

**Safety net.** The first launch after the id migration copies the pre-migration state to the
`elixir_backup_schema1` key. It is never touched again. If a queue ever looks wrong, that blob
is still in the browser's local storage.

---

## Design notes

Direction is *quiet*: soft paper, serif reading text, low contrast, hairline rules instead of
filled cards — built to be sat in for five hours a day rather than glanced at.

Two rules hold it together.

**Colour always means something.** Paper and ink are the whole palette. Green and red appear
only to say "you were right" or "you were wrong". Nothing is tinted for decoration.

**Prose is soft, data is sharp.** Questions and roadmap text are serif and deliberately
low-contrast. Every number is mono, tabular and a step darker, so the Progress tab still reads
as instrumentation instead of going mushy.

There are no webfonts. System stacks only — the app must paint instantly and look identical
with the network switched off. Corners are near-square, nothing moves on hover, and the only
animation in the system is a colour settling after an answer.

Dark mode is a warm dark, not a black one, and holds contrast below pure white — it is for
1am, when glare is the problem. It follows the OS by default; the toggle in the footer cycles
auto → light → dark and is carried in the export.
