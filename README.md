# VocaLearn — 多語言單字學習 Web App

多語言單字學習 App。預設課程為高中英文 7000 單字，可由管理員匯入其他學習語言（日文、韓文、西班牙文…）的課程。支援隨機抽考、單字選意思、意思選單字、拼字測驗、口說練習、AI 例句填空、錯題本、學習進度與排行榜。介面支援繁體中文、English、日本語，並支援深色模式。

- **前端**：Next.js（App Router，靜態匯出）+ Tailwind CSS
- **後端**：Cloudflare Pages Functions（`/functions`）
- **資料庫**：Cloudflare D1（SQLite）
- **AI**：Google Gemini（預設 `gemini-3.1-flash-lite`）— *未設定金鑰時自動以示範模式運作*

---

## 功能

| 功能 | 說明 |
|------|------|
| 🌐 多語言 | 介面：繁中／English／日本語；學習語言：每個課程一份題庫（`languages` 表） |
| 🎲 隨機抽考 | 混合所有題型出題 |
| 🔤 單字選意思 / 💬 意思選單字 | 四選一卡片式選擇題 |
| ⌨️ 拼字測驗 | 看意思拼出單字 |
| 🎤 口說練習 | 依課程語言發音與語音辨識 |
| 🤖 AI 例句填空 | Gemini 生成例句，挖空讓你填入單字 |
| 📕 錯題本 | 答錯自動收錄，答對自動訂正 |
| 📊 學習進度 | 精熟度、正確率、連續天數、90 天練習熱力圖 |
| 📚 單字庫 | 瀏覽 / 搜尋題庫，管理員可 **CSV 匯入** 單字或其他語言的釋義 |
| 🏆 排行榜 | 每個課程一份；預設不公開，使用者自行開啟 |
| 👤 帳號系統 | Email / 密碼或 Google 登入，進度跨裝置同步，可自行刪除帳號 |
| 🌙 深色模式 | 一鍵切換，記住偏好 |

出題優先挑選未精熟、未練習的單字；連續答對 3 次即標記為「已精熟」。

---

## 快速開始（本機開發）

### 1. 安裝相依套件

```bash
npm install
```

### 2. 建立並初始化本機 D1 資料庫

```bash
# 建立 D1 資料庫（會輸出一個 database_id，正式部署時需填入 wrangler.toml）
npx wrangler d1 create vocalearn-db

# 套用所有 migrations（wrangler 會記錄已套用的版本）+ 匯入 6,170 個官方拼字詞條（本機）
npm run db:migrate:local
npm run db:seed:local
```

> 正式題庫依大考中心「高中英文參考詞彙表（111 學年度起適用）」整理，共 6,170 個拼字詞條及六級分級。
> 現有繁中釋義不足的項目會由 Gemini 補充；若金鑰不可用，則以 MIT 授權 ECDICT 釋義轉為台灣繁體。重新產生：`npm run seed:ceec`。
> 本專案僅供個人、非營利學術訓練使用。原表著作權屬大考中心基金會；轉載已註明來源，營利用途須另取得書面授權。

### 3. 啟動

開發時前端與 API 分屬兩套執行環境，建議用 `preview`（Pages 模式）一次跑起前端 + Functions + D1：

```bash
npm run preview
```

開啟 http://localhost:8788 。

> 只想看純前端介面（無 API）可用 `npm run dev`（http://localhost:3000），但登入與練習需要 API，請用 `preview`。

---

## 啟用 AI 例句（選用）

未設定金鑰時，AI 填空題會以**示範模式**運作（固定示範例句），App 全功能仍可正常使用。

要啟用真正的 Gemini 生成例句：

**本機**：在專案根目錄建立 `.dev.vars`

```
GEMINI_API_KEY=AIzaSy...
```

**正式部署**：

```bash
npx wrangler pages secret put GEMINI_API_KEY
```

金鑰可於 Google AI Studio 取得。預設模型為 `gemini-3.1-flash-lite`，也可用 `GEMINI_MODEL` 覆寫。

---

## 部署到 Cloudflare Pages

### 1. 設定 `wrangler.toml`

把步驟 2 取得的 `database_id` 填入 `wrangler.toml` 的 `[[d1_databases]]`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "vocalearn-db"
database_id = "你的-database-id"
```

`AUTH_SECRET` 不可寫入設定檔，請用 `wrangler pages secret put AUTH_SECRET` 設為 Pages Secret。

管理員以 `ADMIN_EMAILS`（逗號分隔的 email，Pages 環境變數）指定，不必改資料庫。

### 2. 初始化正式資料庫

新資料庫：

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

既有資料庫（0001–0008 是手動用 `d1 execute` 套用的）請看 `DEPLOY.md` 的「升級到多語言版本」。

### 3. 部署

```bash
npm run deploy
```

或在 Cloudflare Dashboard 連結 Git repo，設定：

- **Build command**：`npm run build`
- **Build output directory**：`out`
- 在 Pages 專案的 **Settings → Functions → D1 database bindings** 綁定 `DB` → `vocalearn-db`
- 在 **Settings → Environment variables** 設定 `AUTH_SECRET`（必填）與 `GEMINI_API_KEY`（選填）

### 社群登入與忘記密碼

Google OAuth Redirect URI：`https://vocalearn.pages.dev/api/auth/oauth-callback?provider=google`

Facebook OAuth Redirect URI：`https://vocalearn.pages.dev/api/auth/oauth-callback?provider=facebook`

以下值必須透過 Pages Secret 設定，不可提交到 Git：

- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`、`FACEBOOK_CLIENT_SECRET`
- `RESEND_API_KEY`、`RESET_EMAIL_FROM`

Turnstile 驗證端點與網站網址分別使用 `TURNSTILE_VERIFY_URL`、`APP_BASE_URL`。忘記密碼連結有效 30 分鐘，使用後會使現有工作階段失效。

---

## 多語言

- **介面語言**：`src/lib/i18n.ts`。`zh-Hant` 是基準字典，`en`、`ja` 必須有完全相同的 key（TypeScript 會檢查）。新增語言：加一份字典、加進 `LOCALES`，並在 `functions/_lib/i18n.ts` 加上 AI 提示詞名稱與重設密碼信件範本。
- **API 錯誤**：後端只回傳錯誤碼（如 `{"error":"RATE_LIMITED"}`），前端用 `error.<CODE>` 翻譯。
- **學習語言（課程）**：`languages` 表，每個語言有發音 locale、是否以空白分詞、釋義語言。預設已建立 en / ja / ko / es / fr / de，只有有單字的課程才能選。
- **釋義語言**：`words.meaning` 是課程預設釋義；其他介面語言的釋義放在 `word_meanings`，沒有翻譯時退回預設釋義。
- **時區**：使用者時區由瀏覽器自動同步，連續天數與熱力圖依使用者當地日期計算。

## CSV 匯入格式

於 App 內「單字庫 → 匯入 CSV」上傳，或貼上文字（僅管理員）。先選課程與內容類型。自動跳過重複單字、自動略過標題列：

```csv
# 新單字（三欄以上；level 決定學習歷程順序）
word,pos,meaning,level
resilient,adj.,有彈性的；適應力強的,5

# 兩欄格式（詞性與意思相連，會自動拆分）
resilient,adj.有彈性的；適應力強的

# 其他語言的釋義（內容選「English 翻譯」等）：只補現有單字
word,meaning
resilient,able to recover quickly
```

題庫資料清理：`npm run words:clean` 會移除 `\r`、`[計]` 之類的領域標籤，並把過長的釋義縮成前三個義項，然後重新產生 `data/seed-words.sql`。

---

## 專案結構

```
├── 7000vocs.csv             # 原始題庫（Big5）
├── data/
│   ├── words.utf8.csv       # 轉檔後的乾淨 UTF-8 題庫
│   └── seed-words.sql       # D1 seed（自動產生）
├── migrations/              # D1 schema（wrangler d1 migrations）
├── scripts/                 # 題庫產生、清理、reindex、migration baseline
├── functions/               # Cloudflare Pages Functions（後端 API）
│   ├── _lib/                # auth / quiz / ai / csv 共用模組
│   └── api/                 # 路由：auth, quiz, ai, stats, leaderboard, words, wrong-answers
├── src/
│   ├── app/                 # Next.js 頁面（首頁 / 練習 / 錯題本 / 進度 / 排行榜 / 單字庫）
│   ├── components/          # Shell / AuthScreen / Quiz / Controls
│   └── lib/                 # API client、全域狀態、i18n 字典
└── wrangler.toml
```

---

## 技術備註

- 密碼以 **PBKDF2-SHA256（100k 迭代）** 雜湊，Session 採 HttpOnly Cookie。
- 登入、註冊與忘記密碼由 Cloudflare Turnstile 前後端雙重流程保護。
- 出題時建立 **quiz session**（`quiz_sessions` / `quiz_items`），答案只存在伺服器。作答必須對應伺服器發出的題目，且每題只記錄第一次作答；拼字與填空題不會把答案送到前端（提示字母由伺服器給）。
- 登入、註冊、忘記密碼、出題、AI 生成都有 D1 計數的限流（`functions/_lib/rate-limit.ts`）。
- AI 例句依（單字, 語言）快取在 `ai_cards`，所有使用者共用；每人每天最多觸發 60 次新的 Gemini 呼叫。
- 統計與排行榜讀 `user_stats` 計數表；出題用 `words.word_index` 隨機取樣，不再對整張單字表 `ORDER BY RANDOM()`。
- AI 呼叫使用 Gemini REST API 的 **structured output**（JSON schema）確保回傳格式穩定；無金鑰時回退至示範例句。
- 靜態前端 + Pages Functions 的架構讓 D1 綁定可原生運作，部署簡單。
