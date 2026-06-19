# 壹月食陸 YAMYBAKE 商品網站

多頁式手作甜點網站，前端是純靜態 HTML/CSS/JS，可直接部署到 GitHub Pages。

目前結帳流程採用「購物車匯總 → 買家填寫收件資料 → 顯示匯款資料 → 買家匯款後填後五碼 → 複製訂單並開啟官方 LINE」。

## 檔案結構

- `index.html`：首頁與品牌主視覺
- `cookies.html`：巧克力餅乾頁
- `mooncakes.html`：月餅禮盒頁
- `snowq.html`：雪Q餅頁
- `checkout.html`：訂單確認、運費計算、匯款資訊與 LINE 回傳
- `assets/catalog.js`：商品、運費、匯款帳戶、LINE 連結
- `assets/site.js`：購物車與結帳互動
- `assets/site.css`：共用視覺樣式
- `worker.js`、`wrangler.toml`：舊版綠界金流 Worker 備案，目前新網站不會呼叫

## 修改商品

編輯 `assets/catalog.js` 的 `products` 陣列：

- `id`：商品唯一代碼
- `category`：`cookies`、`mooncakes`、`snowq`
- `name`：商品名稱
- `price`：單價
- `unit`：規格
- `image`：商品圖片路徑
- `description`：商品描述
- `featured`：是否出現在首頁精選

## 修改運費、匯款資料、LINE

編輯 `assets/catalog.js` 的 `shop` 物件。

目前設定：

- 711 店到店：NT$60
- 全家店到店：NT$60
- 宅配：NT$125
- 銀行：台新銀行
- 銀行代碼：812
- 戶名：黃郁婷
- 帳號：28881002417736
- 官方 LINE：https://lin.ee/LccUllm

## 部署到 GitHub Pages

1. 將 repo 推到 GitHub。
2. 到 GitHub repo 的 Settings → Pages。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，資料夾選 `/(root)`。
5. 儲存後等待 GitHub Pages 發布。

發布後可從 `https://<帳號>.github.io/yamybake/` 開啟網站。
