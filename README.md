# yamybake 手作烘焙 — 商品網站（含線上金流）

餅乾／常溫點心的線上商店。前端是純靜態網站，放在 **GitHub Pages**；線上刷卡透過一支免費的 **Cloudflare Worker** 串接 **綠界 ECPay**。

```
顧客 → GitHub Pages（購物車）→ Cloudflare Worker（用密鑰簽章）→ 綠界付款頁 → 刷完導回感謝頁
```

檔案：
- `index.html`：商店主頁（商品、購物車、結帳）
- `thanks.html`：付款完成的返回頁
- `worker.js`：金流後端（Cloudflare Worker）
- `wrangler.toml`：Worker 設定

---

## 一、先把網站放上 GitHub Pages

1. 建一個 repo（例如 `yamybake`），上傳 `index.html` 和 `thanks.html`。
2. Settings → Pages → Source 選 `Deploy from a branch`，分支 `main`、目錄 `/(root)`，Save。
3. 約 1 分鐘後網址為 `https://<你的帳號>.github.io/yamybake/`。

此時就能瀏覽、加入購物車、用 LINE／複製訂單。線上刷卡需要再完成第二步。

## 二、部署金流 Worker（線上刷卡）

1. 安裝工具並登入（需要 Node.js）：
   ```bash
   npm i -g wrangler
   wrangler login
   ```
2. 在含 `worker.js`、`wrangler.toml` 的資料夾執行：
   ```bash
   wrangler deploy
   ```
   完成後會得到一個網址，例如 `https://yamybake-pay.<你的子網域>.workers.dev`。
3. 打開 `index.html`，把 `SHOP.payEndpoint` 改成上面那個 Worker 網址。
4. 打開 `wrangler.toml`，把 `CLIENT_BACK_URL` 改成你的 `thanks.html` 網址，再 `wrangler deploy` 一次。

### 先用測試模式刷刷看（不會真的扣款）
未設定密鑰時，Worker 預設使用綠界官方測試帳號。直接到網站結帳 → 前往付款 → 用測試卡：
- 卡號 `4311-9522-2222-2222`
- 安全碼 `222`
- 有效期限：任何「未過期」的年月

### 正式收款（接你自己的綠界帳號）
1. 到綠界 ECPay 申請廠商帳號並開通金流，取得正式的 **MerchantID／HashKey／HashIV**。
2. 設定密鑰（這些值只存在 Cloudflare，不會進到程式碼或 GitHub）：
   ```bash
   wrangler secret put ECPAY_MERCHANT_ID
   wrangler secret put ECPAY_HASH_KEY
   wrangler secret put ECPAY_HASH_IV
   ```
3. 把 `wrangler.toml` 的 `ECPAY_ENV` 改成 `production`，再 `wrangler deploy`。

> 安全提醒：HashKey／HashIV 等同你的收款密鑰，**絕對不要**寫進 `index.html` 或上傳 GitHub。金額一律由 `worker.js` 依商品 id 重算，前端送來的價格不會被採信。

---

## 三、把佔位內容換成你的真實資料

打開 `index.html`：

1. **商品清單**：`PRODUCTS` 陣列（名稱、價格、分類、描述）。有照片時把 `img:""` 改成 `img:"images/xxx.jpg"`，並建 `images/` 資料夾放圖。
2. **聯絡與金流**：`SHOP` 物件（`lineUrl`、`email`、`payEndpoint`）。
3. **重要：金額同步**。改了商品價格後，**`worker.js` 最上方的 `PRICES` 也要改成一樣**（id 與 price 必須一致），否則結帳金額會對不上。
4. **文字**：主視覺照片、品牌故事（`#story`）、訂購須知（`#info`）、頁尾（`#contact`）。

---

## 之後可再加強
- 用 Cloudflare KV 或寄信／LINE 通知，把每筆成立訂單記錄下來（`worker.js` 的 `handleNotify` 已預留位置）。
- 加上運費、滿額免運、折扣碼。
- 商品較多時改成可後台管理的清單。

需要哪一塊我都可以幫你接上。
