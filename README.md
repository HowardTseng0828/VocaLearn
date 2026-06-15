# VocaLearn — 高中 7000 單字學習 Web App

以高中 7000 單字為核心題庫的英文單字學習 App。支援隨機抽考、英翻中、中翻英、拼字測驗、AI 自動生成例句與填空題、錯題本與學習進度統計。介面採卡片式現代化設計，支援深色模式，手機與電腦皆可使用。

- **前端**：Next.js（App Router，靜態匯出）+ Tailwind CSS
- **後端**：Cloudflare Pages Functions（`/functions`）
- **資料庫**：Cloudflare D1（SQLite）
- **AI**：Google Gemini（`gemini-1.5-flash`）— *未設定金鑰時自動以示範模式運作*

---

## 功能

| 功能 | 說明 |
|------|------|
| 🎲 隨機抽考 | 混合四種題型出題 |
| 🇬🇧 英翻中 / 🇹🇼 中翻英 | 四選一卡片式選擇題 |
| ⌨️ 拼字測驗 | 看中文意思拼出英文 |
| 🤖 AI 例句填空 | Gemini 生成例句，挖空讓你填入單字 |
| 📕 錯題本 | 答錯自動收錄，答對自動訂正 |
| 📊 學習進度 | 精熟度、正確率、連續天數、90 天練習熱力圖 |
| 📚 單字庫 | 瀏覽 / 搜尋題庫，支援 **CSV 匯入** 擴充 |
| 👤 帳號系統 | Email / 密碼註冊登入，進度跨裝置同步 |
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

# 套用 schema + 匯入 5,548 個單字（本機）
npm run db:migrate:local
npm run db:seed:local
```

> `data/seed-words.sql` 由 `7000vocs.csv`（Big5）自動轉檔產生。
> 若要重新產生：`npm run seed:gen`。

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

金鑰可於 Google AI Studio 取得。模型固定使用 `gemini-1.5-flash`。

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

並把 `AUTH_SECRET` 改成一組隨機字串（或用 `wrangler pages secret put AUTH_SECRET`）。

### 2. 初始化正式資料庫

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

### 3. 部署

```bash
npm run deploy
```

或在 Cloudflare Dashboard 連結 Git repo，設定：

- **Build command**：`npm run build`
- **Build output directory**：`out`
- 在 Pages 專案的 **Settings → Functions → D1 database bindings** 綁定 `DB` → `vocalearn-db`
- 在 **Settings → Environment variables** 設定 `AUTH_SECRET`（必填）與 `GEMINI_API_KEY`（選填）

---

## CSV 匯入格式

於 App 內「單字庫 → 匯入 CSV」上傳，或貼上文字。支援兩種格式（自動跳過重複單字、自動略過標題列）：

```csv
# 三欄格式
word,pos,meaning
resilient,adj.,有彈性的；適應力強的

# 兩欄格式（詞性與中文意思相連，會自動拆分）
resilient,adj.有彈性的；適應力強的
```

---

## 專案結構

```
├── 7000vocs.csv             # 原始題庫（Big5）
├── data/
│   ├── words.utf8.csv       # 轉檔後的乾淨 UTF-8 題庫
│   └── seed-words.sql       # D1 seed（自動產生）
├── migrations/0001_init.sql # D1 schema
├── scripts/csv-to-utf8.mjs  # Big5 → UTF-8 / seed 產生器
├── functions/               # Cloudflare Pages Functions（後端 API）
│   ├── _lib/                # auth / quiz / ai / csv 共用模組
│   └── api/                 # 路由：auth, quiz, ai, stats, words, wrong-answers
├── src/
│   ├── app/                 # Next.js 頁面（首頁 / 練習 / 錯題本 / 進度 / 單字庫）
│   ├── components/          # Shell / AuthScreen / Quiz
│   └── lib/                 # API client + 全域狀態
└── wrangler.toml
```

---

## 技術備註

- 密碼以 **PBKDF2-SHA256（100k 迭代）** 雜湊，Session 採 HttpOnly Cookie。
- 作答正確與否由**伺服器端驗證**，前端無法作弊。
- AI 呼叫使用 Gemini REST API 的 **structured output**（JSON schema）確保回傳格式穩定；無金鑰時回退至示範例句。
- 靜態前端 + Pages Functions 的架構讓 D1 綁定可原生運作，部署簡單。
