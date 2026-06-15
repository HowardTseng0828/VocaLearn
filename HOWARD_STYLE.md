# Howard 的代碼風格 (HOWARD_STYLE.md)

> **一句話定位**：這份文件會被放進每個新專案的根目錄，告訴任何協助寫代碼的 AI 助手（Claude、Cursor、Copilot、Gemini 等）Howard 是怎麼寫代碼的。請當作這個專案的代碼風格依據。
> **In one line**: This file is copied into the root of every new project. It tells any AI coding assistant (Claude, Cursor, Copilot, Gemini, etc.) how Howard writes code — treat it as the coding-style source of truth for this project.

讀法：**第 0～8 節**是不分語言的通用原則，任何專案都適用；**第 9 節**是各技術棧的個別約定。
How to read: **Sections 0–8** are language-agnostic principles that apply to every project; **Section 9** holds per-stack conventions.

---

## 0. 怎麼跟我協作（最重要，先看這節）/ How to work with me (read this first)

這節比後面任何規則都重要。寧可多問一句，也不要默默做錯。
This section matters more than any rule below. Ask one extra question rather than silently guessing wrong.

- **動手前先想，不確定就先問。** 不要默默假設。如果需求有多種解讀，把它們列出來，別自己挑一個就做。
  *Think before coding. If unsure, ask. If a request has multiple interpretations, list them — don't silently pick one.*
- **有更簡單的做法就講出來。** 該 push back 的時候要 push back，不要照單全收一個過度複雜的方案。
  *If a simpler approach exists, say so. Push back when warranted instead of building something overcomplicated.*
- **複雜 / 動到多個檔案 / 會改變既有行為的任務 → 先給我 plan，等我同意再動手。** 小修小改（錯字、明顯 bug、一兩行）可以直接做。
  *For complex, multi-file, or behavior-changing tasks, give me a plan and wait for approval first. Trivial fixes (typos, obvious bugs, one or two lines) can be done directly.*
- **用「超新手」的口吻跟我溝通、寫說明。** 簡單、口語、照步驟，少堆術語。假設讀的人可能是第一次碰程式。
  *Communicate and write docs in a beginner-friendly tone: simple, conversational, step-by-step, minimal jargon. Assume the reader may be touching code for the first time.*

---

## 1. 核心哲學：務實、簡單優先 / Core philosophy: pragmatic, simplicity first

- **解決問題的最小代碼。** 不做沒被要求的功能、抽象、彈性或設定項。
  *Minimum code that solves the problem. No unrequested features, abstractions, flexibility, or config.*
- **200 行能寫成 50 行就重寫。** 寫完問自己：「資深工程師會不會覺得這太複雜？」會的話就簡化。
  *If 200 lines could be 50, rewrite it. Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.*
- **改既有代碼只動「必須動的」。** 不順手重構、不改格式、不美化旁邊的註解；配合現有風格，即使我自己會寫得不一樣。
  *When editing existing code, touch only what you must. Don't refactor, reformat, or "improve" adjacent code. Match the existing style even if you'd do it differently.*
- **每一行改動都要能追溯到需求。** 你的改動造成的孤兒（沒用到的 import / 變數）要清掉；但既有的死代碼只「提到」、不擅自刪。
  *Every changed line should trace to the request. Remove orphans your change created (unused imports/vars). Mention pre-existing dead code — don't delete it unasked.*

---

## 2. 命名規範 / Naming

- **依語言慣例。** C# 類別/方法用 `PascalCase`，TS 變數/函式用 `camelCase`，常數用 `UPPER_SNAKE_CASE`。
  *Follow each language's convention: C# types/methods `PascalCase`, TS vars/functions `camelCase`, constants `UPPER_SNAKE_CASE`.*
- **名稱語意清楚，不用無謂縮寫。** 避免 `a` / `b` / `tmp` / `data` 這種看不出意思的名字。
  *Names should read clearly. Avoid vague names like `a`, `b`, `tmp`, `data`.*
- **布林值用 `is` / `has` / `can` 開頭。** 例如 `isAdmin`、`hasPermission`、`canEdit`。
  *Boolean vars/properties start with `is` / `has` / `can`, e.g. `isAdmin`, `hasPermission`, `canEdit`.*
- **資料庫欄位/表名跟隨現有外部系統命名。** 例如 HMES 的 `PascalCase` 欄位就照用，不要為了「統一風格」擅自重命名。
  *Database columns/tables keep the existing external naming (e.g. HMES's `PascalCase`). Don't rename them just to "unify style".*

---

## 3. 註解 / Comments

- **只解釋「為什麼」，不複述「做什麼」。** 代碼本身讀得懂的就不要加註解。
  *Explain **why**, not **what**. If the code is self-explanatory, don't comment it.*
- **只在邏輯不直觀、有特殊理由時才加。** 註解用繁體中文。
  *Comment only where logic is non-obvious or there's a special reason. Write comments in Traditional Chinese.*

```csharp
// 不好：複述代碼在做什麼
i = i + 1; // i 加 1

// 好：解釋為什麼這樣做
// 力積電(PSMC)範本的小數位數和我們不同，這裡要代回原始值避免被四捨五入
value = rawValue;
```

---

## 4. 格式化與工具 / Formatting & tooling

- **預設沿用專案現有的 formatter / linter 與周圍代碼風格。** 跟著專案走，不要硬套自己的偏好。
  *By default, follow the project's existing formatter/linter and surrounding code style.*
- **專案沒設定時，用我偏好的預設：** TypeScript 用 Prettier + ESLint；C# 用 `dotnet format`。
  *When the project has no setup, use my defaults: Prettier + ESLint for TypeScript, `dotnet format` for C#.*

---

## 5. 錯誤處理 / Error handling

- **只處理真實可能發生的錯誤。** 不要為「不可能發生」的情境寫防禦性代碼。
  *Only handle errors that can realistically occur. Don't write defensive code for impossible scenarios.*
- **錯誤訊息要明確、可供前端顯示。** 該回明確錯誤就回，不要靜默吞掉。
  *Error messages should be clear and front-end-friendly. Return explicit errors instead of silently swallowing them.*
  - 範例 / Example：權限不足時明確回傳 `403` 並讓前端知道原因，而不是靜默彈回。
    *e.g. on insufficient permission, return a clear `403` with a reason rather than silently reverting.*

---

## 6. Git / Commit 規約（我的日常實際風格）/ Commit convention (my real day-to-day style)

- **標題用日期開頭：** `YYYY-MM-DD`。
  *Subject starts with the date: `YYYY-MM-DD`.*
- **內文用編號條列，每項用【中文模組名】標記，繁中描述：** `1.【模組】動作 2.【模組】動作 …`
  *Body is a numbered list, each item tagged with a 【module name】 in Traditional Chinese: `1.【Module】action 2.【Module】action …`*
- **常用動詞：** 新增 / 修正 / 優化 / 移除 / 協助 XXX。
  *Common verbs: 新增 (add) / 修正 (fix) / 優化 (improve) / 移除 (remove) / 協助 XXX (help XXX).*
- **不要加 `Co-Authored-By`（AI 標註）。**
  *Do not add a `Co-Authored-By` (AI) trailer.*

實際範例 / Real example：

```
2026-06-12 1.【eCOA 產出】紀錄解鎖到 MIS_SQL_LOG 2.【Fr_ErrLog】優化 Excel 未被釋放 or 跳錯 3.【IQC】點檢完畢 DGV_IQC 要整列反綠
```

```
2026-06-03 1.【eCOA 產出】新增 更多提示 建檔異常 2.【IQC】、【QC1】進出站時間 SQL => Getdate() 3.SQL 連線資料庫 寫死 => 動態讀取 config.ini
```

---

## 7. 測試：目標驅動 / Testing: goal-driven

- **把任務轉成可驗證的目標，再循環到通過。** 不強制滿版 TDD。
  *Turn the task into a verifiable goal, then loop until it passes. Full TDD is not required.*
  - 修 bug → 先寫一個能重現它的測試，再讓它過。
    *Fix a bug → first write a test that reproduces it, then make it pass.*
  - 加功能 → 先寫會失敗的測試，再讓它過。
    *Add a feature → first write a failing test, then make it pass.*
  - 重構 → 確保前後測試都過。
    *Refactor → ensure tests pass before and after.*
- **先定義「怎樣算成功」，再開始做。** 強的成功標準讓你能自己循環到完成，不用一直問我。
  *Define "what counts as done" up front. Strong success criteria let you loop to completion without constant clarification.*

---

## 8. 文檔 / Documentation

- **保持最小文檔。** 只寫必要的，避免文檔跟代碼脫鉤。
  *Keep docs minimal. Write only what's necessary; avoid docs that drift out of sync with code.*
- **每個專案要有一份「超新手版 README」。** 照步驟、含環境變數說明，讓第一次碰程式的人也能把專案跑起來。
  *Every project needs a beginner-friendly README: step-by-step, with environment-variable explanations, so even a first-timer can get it running.*

---

## 9. 分語言附錄 / Per-stack appendix

### 9.1 C# / .NET（ASP.NET Core, EF Core, WinForms）

- **Clean-ish 分層**：Infrastructure（資料庫、外部服務、背景處理）與 Web（Razor Pages / Controllers）分開；用介面 + 服務 + 強型別 Options。務實為主，不教條。
  *Clean-ish layering: split Infrastructure (DB, external services, background work) from Web (Razor Pages / Controllers); use interfaces + services + strongly-typed Options. Pragmatic, not dogmatic.*
- **雙資料庫策略可接受**：系統本身用 EF Core；需要高效能或動態表結構時直接用原生 ADO.NET（`Microsoft.Data.SqlClient`、`SqlTransaction`）。
  *Dual-database strategy is fine: EF Core for the app's own data; raw ADO.NET when you need performance or dynamic table structures.*
- **前端傾向 Vanilla JS + Razor**，不為了框架而引入框架。
  *Frontend leans Vanilla JS + Razor — don't pull in a framework just for the sake of it.*
- **重度 SQL 時的慣用寫法**：inline `$@"..."` verbatim 字串、用 `[DB].[dbo].[Table]` 全名、`WHERE 1=1` 起手方便接條件、需要時用 temp table（`#xxx`）。inline SQL 內可用繁中註解解釋每段在做什麼「為什麼」。
  *Heavy-SQL idioms: inline `$@"..."` verbatim strings, fully-qualified `[DB].[dbo].[Table]` names, `WHERE 1=1` to make appending conditions easy, temp tables (`#xxx`) when needed. Traditional-Chinese comments inside SQL are fine to explain the why.*

### 9.2 TypeScript / Node（Express + React）

- **後端 Express + 前端 React + MSSQL** 是常見組合。
  *Backend Express + frontend React + MSSQL is the common combo.*
- **`camelCase`、明確型別、避免 `any`。** 型別能標就標清楚。
  *`camelCase`, explicit types, avoid `any`. Type things clearly where you can.*

### 9.3 SQL / 資料庫

- **欄位 / 表名跟隨外部系統現有命名**（見第 2 節）。
  *Columns/tables follow the external system's existing naming (see Section 2).*
- **注意避免 N+1**；批次寫入用交易（`SqlTransaction`）確保一致性。
  *Watch out for N+1; wrap batch writes in a transaction (`SqlTransaction`) for consistency.*
- **明確寫入 `CreatedAt` 等時間欄位**，不要依賴資料表 default constraint，避免舊表缺 default 導致啟動失敗。
  *Explicitly write time columns like `CreatedAt` instead of relying on a table default, to avoid startup failures when old tables lack a default constraint.*

### 9.4 前端（Vanilla JS / React / CSS）

- **兩種都用**：求載入飛快、互動單純的頁面用 Vanilla JS 直接操作 DOM；較複雜、需要狀態管理的用 React。
  *Both are used: Vanilla JS (direct DOM) for fast, simple pages; React for more complex, stateful UIs.*
- **CSS 走現代化風格**：漸層、陰影、流暢的過渡效果，提升使用體驗。
  *CSS leans modern: gradients, shadows, smooth transitions for a better UX.*
