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
    │   └── app.js             routing, counters, theme, keyboard, bootstrap
    ├── data/
    │   └── bank.js            the question bank
    ├── test/
    │   └── app.test.js        behaviour tests (dev only, never deployed)
    ├── sw.js                  service worker
    ├── manifest.webmanifest
    └── icon.svg · icon-180 · icon-192 · icon-512 · icon-maskable-512
```

**Elixir** — spaced-repetition study tool. Daily drills, a Leitner queue, the term roadmap.
All state lives in `localStorage` on the device. Nothing is sent anywhere; there is no backend.

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
const CACHE = "elixir-v4";   // → "elixir-v5"
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
box maths, a full drill, and — the important part — every path through the state migration.
Run it after touching anything in `js/state.js` or `js/scheduler.js`.

---

## Moving data between devices

`localStorage` is scoped per origin *and* per browser. A phone and a laptop never share state,
and neither does Safari vs. an iOS home-screen install.

Progress tab → **Export** a JSON → **Import** it on the other device.

Worth doing weekly regardless: cleared site data, browser storage eviction and a new phone all
wipe the queue, and the queue is the only part that cannot be rebuilt.

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
