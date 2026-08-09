# D3cSnow.github.io

個人站台（GitHub Pages **user site**）。

```
D3cSnow.github.io/          →  https://d3csnow.github.io/
├── index.html                  首頁（連到各個 app）
├── .nojekyll                   關掉 Jekyll，直接當靜態檔案服務
├── README.md
└── elixir/                 →  https://d3csnow.github.io/elixir/
    ├── index.html              Elixir 主程式
    ├── manifest.webmanifest    可加到主畫面
    ├── sw.js                   Service Worker（離線可用）
    └── icon.svg / icon-180 / icon-192 / icon-512 / icon-maskable-512
```

---

## 🔴 第一次上線前，先做這件事：把進度搬過去

**這一步跳過的話，你的 streak 和五個月的卡片排程會歸零。**

瀏覽器的 localStorage 是**按「來源（origin）」隔離**的。你以前用 `file:///C:/Users/.../NTU_115-1_WarRoom.html` 開，那是一個來源；`https://d3csnow.github.io` 是另一個完全不同的來源。**兩邊的資料互相看不到，也不會自動搬移。**

（我在程式裡寫的 `warroom_v1 → elixir_v1` 自動搬移，只在**同一個來源內**有效，跨 origin 幫不上忙。）

### 搬家步驟

1. 用**原本的方式**打開舊的 `Elixir/NTU_115-1_WarRoom.html`（或 `Elixir/elixir-web/index.html`）
2. **Progress 分頁 → Export progress (JSON)** → 存下 `elixir_progress_YYYY-MM-DD.json`
3. 網站上線後，開 `https://d3csnow.github.io/elixir/`
4. **Progress 分頁 → Import progress (JSON)** → 選剛剛那個檔
5. 確認 streak、卡片數、答題統計都對 → 之後只用網站版

---

## 部署（第一次）

> ⚠️ **先清 4 個殘留的 lock 檔。**
> 這個 repo 的 `git init` 與第一次 commit 已經幫你做好了（commit `Site + Elixir web app`，檔案都已加入版控），
> 但當時的執行環境沒有刪檔權限，留下了 4 個 `.lock` 檔會擋住後續操作。**在 Windows 上刪掉就沒事了。**

在 `D3cSnow.github.io` 資料夾開 PowerShell（按住 Shift 右鍵 →「在此處開啟 PowerShell 視窗」）：

```powershell
cd C:\Users\User\Desktop\D3cSnow.github.io

# ① 清掉殘留的 lock 檔
Remove-Item .git\HEAD.lock, .git\index.lock, .git\objects\maintenance.lock, .git\refs\heads\master.lock -Force -ErrorAction SilentlyContinue

# ② 確認狀態正常（應該顯示 nothing to commit, working tree clean）
git status

# ③ 設定身分（只有第一次需要）
git config --global user.name  "D3cSnow"
git config --global user.email "brianbrian1018@gmail.com"

# ④ 分支改名並推送
git branch -M main
git push -u origin main
```

remote 已經設好指向 `https://github.com/D3cSnow/D3cSnow.github.io.git`，不用再 `git remote add`。

### 如果哪一步出錯

| 訊息 | 處理 |
|---|---|
| `remote origin already exists` | 正常，remote 已設好，跳過該步 |
| 遠端已有 commit（建 repo 時勾了 README / LICENSE） | `git pull --rebase origin main` 之後再 `git push` |
| `git status` 顯示一堆奇怪的東西 | 見下方「完全重來」 |
| 推送時要求登入 | 用 GitHub 帳號登入；若要求密碼，那需要 **Personal Access Token**（Settings → Developer settings → Tokens），不是 GitHub 密碼 |

**完全重來**（最保險，也順便自己練一次完整流程）：
在檔案總管刪掉 `D3cSnow.github.io\.git` 這個隱藏資料夾（檢視 → 勾「隱藏的項目」），然後：

```powershell
cd C:\Users\User\Desktop\D3cSnow.github.io
git init
git add .
git commit -m "Site + Elixir web app"
git branch -M main
git remote add origin https://github.com/D3cSnow/D3cSnow.github.io.git
git push -u origin main
```

推上去之後到 GitHub：**Settings → Pages**，確認 Source 是 `Deploy from a branch`、branch `main` / `(root)`。
User site 通常會自動啟用。等 1–2 分鐘。

| 網址 | 內容 |
|---|---|
| `https://d3csnow.github.io/` | 首頁 |
| `https://d3csnow.github.io/elixir/` | **Elixir** |

---

## 之後要改東西

改完檔案之後：

```powershell
cd C:\Users\User\Desktop\D3cSnow.github.io
git add .
git commit -m "說明你改了什麼"
git push
```

1–2 分鐘後生效。

**如果手機上還是舊版**：Service Worker 是 network-first，有網路就會抓新版。若真的卡住，打開 `elixir/sw.js` 把第一行

```js
const CACHE = "elixir-v1";
```

改成 `"elixir-v2"`（每次改版 +1），再 push 一次。這會強制清掉舊快取。

---

## 加到主畫面

### iPhone（**必須用 Safari**，Chrome 不行）
1. 開 `https://d3csnow.github.io/elixir/`
2. 底部**分享**鈕 → **加入主畫面** → 名稱會帶入 **Elixir**

### Android（Chrome）
1. 開同一個網址
2. 右上 **⋮** → **安裝應用程式**

> ⚠️ **iOS 的坑**：從主畫面開的 Web App，儲存空間**獨立於 Safari**。
> 所以加到主畫面後第一次打開，streak 會是 0。
> **正確順序**：先加到主畫面 → **在主畫面那個 App 裡**做一次 Import → 之後固定只用主畫面入口。

---

## 電腦上

直接開 `https://d3csnow.github.io/elixir/` 就好，版面跟以前一樣（手機版樣式只在寬度 ≤720px 時才套用）。
Chrome 也可以：網址列右側 **安裝圖示** → 變成獨立視窗的桌面 App。

---

## ⚠️ 這個 repo 是 public，注意兩件事

1. **不要**把 `Elixir/01_Textbooks/`、`02_人概_共筆考古/`、`05_Archives_zip/` 放進來 —— 教科書與系上共筆考古有版權。
2. `elixir/index.html` 裡的題庫（`BANK`）會完全公開。確認那些題目是你自己出的，沒有整段抄共筆原文。

---

## 每週備份（30 秒，建議排進週日）

localStorage 是會消失的東西 —— 清瀏覽器資料、iOS 儲存空間回收、換手機、瀏覽器更新出錯，任何一個都能讓五個月的 SR 排程歸零。

**每週日匯出一次 JSON 丟雲端。** 那個排程是 GPA 4.3 計畫的核心資產，值得這 30 秒。
