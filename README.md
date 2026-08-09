# D3cSnow.github.io

Static personal site. No build step, no dependencies — plain HTML/CSS/JS.

```
/                       →  https://d3csnow.github.io/
├── index.html              index page
├── .nojekyll               serve files as-is, skip Jekyll
└── elixir/             →  https://d3csnow.github.io/elixir/
    ├── index.html          the app (single file, question bank included)
    ├── manifest.webmanifest
    ├── sw.js               service worker · network-first, cache fallback
    └── icon.svg · icon-180 · icon-192 · icon-512 · icon-maskable-512
```

**Elixir** — spaced-repetition study tool. Daily drills, Leitner queue, term roadmap.
All state lives in `localStorage` on the device. Nothing is sent anywhere; there is no backend.

---

## Repo visibility

GitHub Pages on a **free** account only publishes from **public** repositories.
Making this repo private takes the site offline.

Two ways forward:

| | Repo | Site | Cost |
|---|---|---|---|
| **A — current** | public | public | free |
| B — GitHub Pro | private | **still public** | free via Student Developer Pack |

Note that B hides the *source*, not the *site*. A Pages site is reachable by anyone
who knows the URL on every plan below Enterprise. If the site itself needs to be
gated, GitHub Pages is the wrong host — put it behind Cloudflare Access, or keep it local.

This repo therefore carries **no personal identifiers**: no name, no institution,
no email, no student ID. Keep it that way.

---

## Deploy

```powershell
git add .
git commit -m "describe the change"
git push
```

Live in 1–2 minutes. Settings → Pages → branch `main` / `(root)`.

**If a phone keeps showing the old version:** the service worker is network-first, so
this is rare. When it happens, bump the cache name in `elixir/sw.js`:

```js
const CACHE = "elixir-v2";   // → "elixir-v3"
```

then commit and push. Old caches are evicted on activate.

---

## Adding questions

The bank is a plain array in `elixir/index.html`, between `const BANK=[` and the
matching `];`.

```js
m("AN", 2, "Question text?",
  ["Option A","Option B","Option C","Option D"], 1,
  "Explanation. <b>Bold</b> is allowed."),

f("PH", 1, "Prompt (front)", "Answer (back)", "Optional note"),
```

| Field | Meaning |
|---|---|
| 1 | domain — `AN` `PH` `HI` `EM` `CV` `MI` `LLM` |
| 2 | difficulty — `1` core · `2` applied · `3` hard |
| `m` 5th arg | index of the correct option, **0-based** |

### ⚠️ Append only

Scheduling state is stored as `S.sr[index]`, keyed by **position in the array**.
Inserting, deleting or reordering entries silently repoints every schedule after
that point — no error, just a quietly corrupted queue.

- **New questions go at the end**, immediately before `];`.
- To retire a bad question, set its difficulty to `9` so no filter selects it.
  Do not delete the line.

---

## Moving data between devices

`localStorage` is scoped per origin *and* per browser. A phone and a laptop never
share state, and neither does Safari vs. an iOS home-screen install.

Progress tab → **Export** a JSON → **Import** it on the other device.

Worth doing weekly regardless: cleared site data, browser storage eviction and a new
phone all wipe the queue, and the queue is the only part that can't be rebuilt.

---

## Design notes

Monochrome by default. Green and red appear only on answer feedback — colour in this
interface always means something, it is never decoration. Structure comes from
hairline rules rather than filled cards; corners are near-square; nothing moves on
hover. Monospace carries structure and metadata, serif carries the text you actually
read.
