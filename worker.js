/* =====================================================================
   yamybake 金流 Worker（Cloudflare Workers）
   - 接收前端購物車 → 用商店密鑰做綠界 ECPay 簽章 → 回傳自動送往付款頁的表單
   - 金額一律由「後端的 PRICES」依商品 id 重算，前端傳來的價格一概不採信（防竄改）
   - 密鑰請用 wrangler secret 設定，不要寫進程式或上傳到 GitHub

   部署：
     npm i -g wrangler
     wrangler login
     wrangler deploy
   設定密鑰（正式上線時）：
     wrangler secret put ECPAY_MERCHANT_ID
     wrangler secret put ECPAY_HASH_KEY
     wrangler secret put ECPAY_HASH_IV
   未設定時，預設使用「綠界官方測試帳號」，可直接用測試卡刷不會真的扣款。
   ===================================================================== */

// ★ 商品價格表：請與 index.html 的 PRODUCTS 同步（id 與 price 要一致）
const PRICES = {
  p1: { name: "海鹽巧克力曲奇", price: 200 },
  p2: { name: "伯爵奶茶酥餅",   price: 180 },
  p3: { name: "開心果方塊酥",   price: 220 },
  p4: { name: "原味丹麥曲奇",   price: 160 },
  p5: { name: "焦糖瑪德蓮",     price: 150 },
  p6: { name: "原味達克瓦茲",   price: 160 },
  p7: { name: "檸檬磅蛋糕",     price: 260 },
  p8: { name: "綜合餅乾禮盒",   price: 560 },
  p9: { name: "彌月／節慶禮盒", price: 680 },
};

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // 綠界付款結果的「伺服器端通知」(ReturnURL) 會 POST 回來，這裡驗章後回 1|OK
    const url = new URL(request.url);
    if (url.searchParams.get("notify") === "1") {
      return handleNotify(request, env);
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    // 讀取前端送來的訂單
    let order;
    try {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        order = await request.json();
      } else {
        const form = await request.formData();
        order = JSON.parse(form.get("order") || "{}");
      }
    } catch (e) {
      return new Response("invalid order", { status: 400, headers: cors });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return new Response("empty cart", { status: 400, headers: cors });

    // 後端重算金額（只信任 PRICES）
    let total = 0;
    const names = [];
    for (const it of items) {
      const p = PRICES[it.id];
      const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 0));
      if (!p) continue;
      total += p.price * qty;
      names.push(`${p.name} x${qty}`);
    }
    if (total <= 0) return new Response("no valid items", { status: 400, headers: cors });

    // 設定值（未設密鑰時用綠界官方測試帳號）
    const isProd = env.ECPAY_ENV === "production";
    const MerchantID = env.ECPAY_MERCHANT_ID || "2000132";
    const HashKey    = env.ECPAY_HASH_KEY    || "5294y06JbISpM5x9";
    const HashIV     = env.ECPAY_HASH_IV     || "v77hoKGq4kWxNNIS";
    const ServiceURL = isProd
      ? "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
      : "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

    const c = order.customer || {};
    const tradeNo = "YB" + Date.now().toString(36).toUpperCase() + rand(4); // 英數 ≤20
    const tradeDate = nowTaipei();

    const params = {
      MerchantID,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: "aio",
      TotalAmount: String(total),
      TradeDesc: env.SHOP_NAME || "yamybake",
      ItemName: names.join("#").slice(0, 400) || "yamybake order",
      ReturnURL: selfNotifyUrl(request),       // 伺服器端付款結果通知（驗章）
      ChoosePayment: "ALL",                     // 信用卡 / ATM / 超商 全開
      ClientBackURL: env.CLIENT_BACK_URL || "", // 付款完成後「返回商店」按鈕（你的感謝頁）
      EncryptType: "1",                         // SHA256
    };
    if (c.name)  params.CustomField1 = String(c.name).slice(0, 50);
    if (c.phone) params.CustomField2 = String(c.phone).slice(0, 50);
    if (c.date)  params.CustomField3 = String(c.date).slice(0, 50);
    if (c.method)params.CustomField4 = String(c.method).slice(0, 50);
    Object.keys(params).forEach(k => { if (params[k] === "") delete params[k]; });

    params.CheckMacValue = await checkMacValue(params, HashKey, HashIV);

    const inputs = Object.entries(params)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
    const html =
      `<!doctype html><html lang="zh-Hant"><meta charset="utf-8">` +
      `<body style="font-family:system-ui;text-align:center;padding:60px;color:#2E211A">` +
      `<p>正在前往安全付款頁，請稍候…</p>` +
      `<form id="f" method="post" action="${ServiceURL}">${inputs}</form>` +
      `<script>document.getElementById("f").submit();</script></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...cors } });
  },
};

/* ---- 綠界付款結果通知：驗章後回 1|OK ---- */
async function handleNotify(request, env) {
  try {
    const form = await request.formData();
    const data = {};
    for (const [k, v] of form.entries()) data[k] = v;
    const HashKey = env.ECPAY_HASH_KEY || "5294y06JbISpM5x9";
    const HashIV  = env.ECPAY_HASH_IV  || "v77hoKGq4kWxNNIS";
    const mac = await checkMacValue(data, HashKey, HashIV);
    if (mac === data.CheckMacValue && data.RtnCode === "1") {
      // TODO：在這裡記錄訂單 / 寄通知（可串 KV、Email、LINE Notify 等）
      return new Response("1|OK");
    }
    return new Response("0|ERROR");
  } catch (e) {
    return new Response("0|ERROR");
  }
}

/* ---- 綠界 CheckMacValue（與官方 SDK 一致：encodeURIComponent→小寫→還原特定字元→SHA256→大寫）---- */
async function checkMacValue(params, HashKey, HashIV) {
  const keys = Object.keys(params)
    .filter(k => k !== "CheckMacValue")
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  let raw = `HashKey=${HashKey}`;
  for (const k of keys) raw += `&${k}=${params[k]}`;
  raw += `&HashIV=${HashIV}`;
  let enc = encodeURIComponent(raw).toLowerCase()
    .replace(/%20/g, "+").replace(/%2d/g, "-").replace(/%5f/g, "_")
    .replace(/%2e/g, ".").replace(/%21/g, "!").replace(/%2a/g, "*")
    .replace(/%28/g, "(").replace(/%29/g, ")");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(enc));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/* ---- 小工具 ---- */
function nowTaipei() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
function rand(n) { let s = ""; const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function selfNotifyUrl(request) { const u = new URL(request.url); u.search = "?notify=1"; return u.toString(); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
