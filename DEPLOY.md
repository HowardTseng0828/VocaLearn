# 部署到 Cloudflare Pages（超新手版）

> 這份文件帶你把 VocaLearn 部署上線。**重點：這是 Cloudflare「Pages」專案，不是「Workers」。**
> 用 GitHub 自帶的 Cloudflare 整合（自動匯入按鈕）會建成 **Workers**，導致部署時跑 `wrangler deploy` 並報錯
> `Missing entry-point`。請務必照下面用 **Pages** 流程手動連接。

---

## 為什麼不能用 GitHub 自動匯入？

| | Pages（要用這個） | Workers（自動匯入預設，會出錯） |
|---|---|---|
| 適合 | 靜態網站 + Functions + D1 | 單一 script |
| 部署方式 | 自動部署輸出目錄 `out/` | 跑 `wrangler deploy` |
| 設定欄位 | 有「組建輸出目錄」 | 只有「部署命令」 |
| 本專案 | ✅ 為此設計 | ❌ 不相容 |

本專案是「靜態前端（Next.js export）+ `functions/` Pages Functions + D1」架構，只能用 Pages 部署。

---

## 步驟 0：刪掉誤建的 Workers 專案（如果有）

1. Cloudflare Dashboard → 左側 **Workers & Pages**
2. 點那個 `vocalearn`（Workers 的）→ **Settings** → 最下面 **Delete project**

> 安全：程式碼都在 GitHub，刪的只是設錯的部署設定。

---

## 步驟 1：用 Pages 流程連接 GitHub

1. Dashboard → **Workers & Pages** → 右上 **Create**
2. **選 `Pages` 分頁**（不是 Workers 分頁）
3. **Connect to Git** → 授權 GitHub → 選 **HowardTseng0828/VocaLearn** → **Begin setup**

---

## 步驟 2：建置設定

| 欄位 | 值 |
|------|-----|
| Project name | `vocalearn` |
| Production branch | `main` |
| Framework preset | **Next.js (Static HTML Export)** |
| Build command | `npm run build` |
| Build output directory | `out` |

按 **Save and Deploy**，等 build 完成。

---

## 步驟 3：綁定 D1 與環境變數

Build 成功後，進專案設定：

1. **Settings → Functions → D1 database bindings**
   - Variable name：`DB`
   - Database：`vocalearn-db`

2. **Settings → Environment variables and Secrets**（Production）
   - `AUTH_SECRET` = 一組你自己的隨機字串（**必填**，用來簽 session）
   - `GEMINI_API_KEY` = Gemini 金鑰（**選填**，要真 AI 例句才加；不填會用示範例句）

3. **Deployments** → 最新一筆 → **Retry deployment**（讓綁定生效）

---

## 步驟 4：初始化正式資料庫（重要，不做網站會壞）

部署成功後，正式 D1 資料庫還是**空的**（沒有表、沒有單字）。必須在**本機**跑一次下列指令把它建好。
這步 Cloudflare build 不會自動做。

前置：本機要能跑 `wrangler`，也就是先 `npm install`（若被防毒攔截 HTTPS 而裝不起來，見最下方「疑難排解」）。

```bash
# 1. 建立正式 D1 資料庫（只需做一次；會輸出一個 database_id）
npx wrangler d1 create vocalearn-db

# 2. 把上一步的 database_id 填進 wrangler.toml 的 [[d1_databases]] → database_id

# 3. 建表 + 匯入 5,548 個單字到正式資料庫
npm run db:migrate:remote
npm run db:seed:remote
```

完成後，打開 Cloudflare 給你的網址（`https://vocalearn.pages.dev` 或自訂網域），
就能註冊帳號、開始練習了。

---

## 疑難排解

- **部署報 `Missing entry-point` / 看到 `wrangler deploy`**：你建成 Workers 了，回步驟 0 重建成 Pages。
- **網站打得開但登入/練習失敗**：D1 沒初始化，回步驟 4。
- **`npm install` 失敗、出現 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`**：防毒軟體（如 Avast）攔截 HTTPS，
  Node 不信任它的憑證。到防毒設定關閉「網頁防護 / Web Shield 的 HTTPS 掃描」，再重跑 `npm install`。
- **AI 例句顯示「示範模式」**：正常，代表沒設 `GEMINI_API_KEY`。要真 AI 例句就到步驟 3 加上金鑰。
