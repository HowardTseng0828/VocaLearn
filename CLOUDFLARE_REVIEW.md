# Cloudflare 免費額度盤點與 VocaLearn 優化

盤點日期：2026-10-19。範圍是本次提供的 Token 可存取、持有 VocaLearn 的 Cloudflare 帳號。分析區間為 2026-10-12 00:00 UTC 至 10-19 約 03:32 UTC；今天尚未結束，Analytics 也有彙整延遲。以下請求數是 Cloudflare 回傳的監測數值，不是壓測容量。

| 專案 | 可取得的用量與資源 | 評估 |
|---|---|---|
| vocalearn | Pages Functions 約 50 次請求；使用帳號唯一的 D1，約 4.57 MB；10/19 約 187,528 筆寫入 | 寫入已超過免費每日 100,000 筆，主要來自外語題庫匯入與重排索引。這次優先優化此專案 |
| howardtseng | Pages Functions 約 3 次請求；CONTENT_KV 約 3 次讀取 | 已觀察到的用量很低 |
| shangciao | 平台標示未使用 Functions | 靜態資產請求不計入 Functions 額度；本次未取得完整靜態瀏覽流量 |
| line-stock-bot | Workers 約 217 次請求、2 次執行例外；KV 單日最高約 316 次讀取、250 次寫入；DO 單日最高約 146 次請求 | 請求、KV 與 DO 操作量低；兩次例外在 10/14、10/16，應另外查日誌，不能直接認定為額度問題 |
| thread-keyword-search | Workers 約 2 次請求，沒有回報執行錯誤 | 已觀察到的用量很低 |
| turnstile-siteverify-vocalearn | 有部署與驗證設定，此區間沒有回傳呼叫樣本 | 無樣本不能當作可承受大量流量的證明；登入量增加後會一起消耗 Workers 額度 |

上列 Workers 與 Pages Functions 合計的監測請求量，單日最高約 82 次，低於免費共用的每日 100,000 次。VocaLearn 是此帳號唯一查到的 D1 資料庫；股票機器人使用 KV 與 SQLite Durable Objects，其額度分別計算。

免費方案目前相關上限：D1 每日讀取 5,000,000 筆、寫入 100,000 筆；KV 每日讀取 100,000 個 key、寫入 1,000 個 key；Durable Objects 每日 100,000 次請求。帳號用量共用，不是每個專案各有一份免費額度。

VocaLearn 已實作的優化：

- 單字庫初次載入由兩個 effect 各送一次請求，改為一次；搜尋仍保留 300 ms 防抖，舊請求的結果不會覆蓋新搜尋。
- 無搜尋條件時，直接使用 languages.word_count，不再每次 COUNT 整個課程。
- 搜尋使用視窗計數，將同一批符合資料的掃描由兩次合成一次；空頁仍會正確回傳總筆數。
- 公開詞條在各邊緣節點快取 5 分鐘。快取鍵包含課程、介面語言、搜尋字串、頁數、頁大小與課程字數。
- 登入驗證與個人熟練度仍每次查詢；共享快取不含個人紀錄，最終 API 回應使用 private, no-store。
- 新增單字使課程字數改變時立即切換快取鍵；管理員在介面匯入後會強制刷新當前頁。既有詞條的其他頁面可能延遲最多 5 分鐘更新。
- 匯入先篩除內容未變的詞條與翻譯；索引、課程字數也只在值改變時寫入。重跑仍需讀取資料，並非完全沒有資料庫消耗。
- 產生題庫腳本新增 --lang，可按語言安排分批、分日匯入。初次新增所有外語內容仍需超過一天的免費寫入額度。

以相同的本機 6,170 字英文題庫、隔離的 Miniflare D1、相同使用者與頁大小，直接執行改動前後的 API 處理程式。包含驗證與個人進度查詢，結果如下：

| 情境 | 優化前讀取筆數 | 優化後首次 | 命中快取後 |
|---|---:|---:|---:|
| 瀏覽第一頁 50 字 | 6,223 | 54 | 4 |
| 搜尋 school | 12,344 | 6,178 | 3 |

快取命中與實際讀取筆數會因節點、命中詞數、使用者進度而異。正式站有 7,207 個英文字，本機比較不是正式壓測或整站頻寬節省百分比。

本機完整外語題庫測試：首次新增約 140,636 筆寫入；同一題庫重跑 0 筆寫入；索引與課程字數未變時再重排也為 0 筆寫入。沒有為了測試在正式庫重跑匯入。

已驗證分頁、空結果、超出頁數、size=100 參數上限、% 與 _ 的字面搜尋、個人進度即時性、跨帳號／語言隔離、管理員刷新及課程字數變動失效。TypeScript 型別檢查與 Next.js 正式建置通過。

本次限制：Token 無法讀取 R2、KV 儲存容量清單及帳單訂閱；DO 儲存容量指標沒有回傳樣本，因此這些項目不能宣稱已完整確認。CPU 高分位偶爾高於免費單次預算，但所查區間沒有回傳 exceededCpu／exceededResources 事件，仍需在流量成長時監控。Google Gemini、LINE、Threads 的外部 API 額度不包含在 Cloudflare 免費額度內，本次未查其帳單或方案。

建議先維持目前方案，監控帳號整體額度；批次匯入前確認剩餘寫入量並保留日常使用餘裕。使用者增加後，再評估全站 AI 呼叫總額限制、包含詞搜尋的索引方案與章節紀錄合併請求。這次已保留逐題儲存行為，避免犧牲續作進度。

官方依據：[Pages Functions 計價](https://developers.cloudflare.com/pages/functions/pricing/)、[D1 計價與重置時間](https://developers.cloudflare.com/d1/platform/pricing/)、[KV 計價](https://developers.cloudflare.com/kv/platform/pricing/)、[Durable Objects 計價](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Workers 執行限制](https://developers.cloudflare.com/workers/platform/limits/)、[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)。
