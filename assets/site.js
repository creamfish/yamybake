(function () {
  const { shop, products } = window.YAMY;
  const cartKey = "yamybake_cart_v2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let cart = loadCart();
  let checkoutDraft = null;

  function money(value) {
    return shop.currency + Number(value || 0).toLocaleString("zh-Hant-TW");
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(cartKey)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }

  function productById(id) {
    return products.find((item) => item.id === id);
  }

  function cartItems() {
    return Object.keys(cart)
      .map((id) => ({ ...productById(id), qty: cart[id] }))
      .filter((item) => item.id && item.qty > 0);
  }

  function subtotal() {
    return cartItems().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function updateCartCount() {
    const count = cartItems().reduce((sum, item) => sum + item.qty, 0);
    $$("[data-cart-count]").forEach((node) => {
      node.textContent = count;
    });
  }

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    updateCartCount();
    renderCartDrawer();
    toast("已加入購物車");
  }

  function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    saveCart();
    updateCartCount();
    renderCartDrawer();
    if (document.body.dataset.page === "checkout") renderCheckout();
  }

  function renderProducts() {
    $$("[data-product-grid]").forEach((grid) => {
      const mode = grid.dataset.productGrid;
      const list = mode === "featured"
        ? products.filter((item) => item.featured)
        : products.filter((item) => item.category === mode);

      grid.innerHTML = list.map((item) => `
        <article class="product-card ${item.tone}">
          <div class="product-image">
            <img src="${item.image}" alt="${item.name}">
          </div>
          <div class="product-copy">
            <p>${item.unit}</p>
            <h3>${item.name}</h3>
            <span>${item.description}</span>
            <div class="product-foot">
              <strong>${money(item.price)}</strong>
              <button type="button" data-add="${item.id}">加入購物車</button>
            </div>
          </div>
        </article>
      `).join("");
    });
  }

  function createCartDrawer() {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="scrim" data-cart-close></div>
      <aside class="cart-drawer" aria-label="購物車" aria-hidden="true">
        <div class="drawer-head">
          <div>
            <p class="kicker">Cart</p>
            <h2>你的甜點籃</h2>
          </div>
          <button type="button" class="icon-btn" data-cart-close aria-label="關閉購物車">×</button>
        </div>
        <div class="drawer-body" data-cart-body></div>
        <div class="drawer-foot" data-cart-foot></div>
      </aside>
      <div class="toast" data-toast></div>
    `);
  }

  function openCart() {
    renderCartDrawer();
    $(".scrim").classList.add("open");
    $(".cart-drawer").classList.add("open");
    $(".cart-drawer").setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    $(".scrim").classList.remove("open");
    $(".cart-drawer").classList.remove("open");
    $(".cart-drawer").setAttribute("aria-hidden", "true");
  }

  function renderCartDrawer() {
    const items = cartItems();
    const body = $("[data-cart-body]");
    const foot = $("[data-cart-foot]");
    if (!body || !foot) return;

    if (!items.length) {
      body.innerHTML = `<div class="empty-state"><h3>購物車目前是空的</h3><p>先挑一份想分享的甜點吧。</p></div>`;
      foot.innerHTML = `<a class="btn primary full" href="index.html#selection">回到選品</a>`;
      return;
    }

    body.innerHTML = items.map((item) => `
      <div class="cart-item">
        <img src="${item.image}" alt="">
        <div>
          <h3>${item.name}</h3>
          <p>${money(item.price)} / ${item.unit}</p>
          <div class="qty-control">
            <button type="button" data-qty="${item.id}" data-delta="-1" aria-label="減少 ${item.name}">−</button>
            <span>${item.qty}</span>
            <button type="button" data-qty="${item.id}" data-delta="1" aria-label="增加 ${item.name}">＋</button>
          </div>
        </div>
        <strong>${money(item.price * item.qty)}</strong>
      </div>
    `).join("");

    foot.innerHTML = `
      <div class="sum-row"><span>商品小計</span><strong>${money(subtotal())}</strong></div>
      <a class="btn primary full" href="checkout.html">確認訂單</a>
    `;
  }

  function renderCheckout() {
    const root = $("#checkout-root");
    if (!root) return;
    const items = cartItems();
    if (!items.length) {
      root.innerHTML = `
        <div class="empty-checkout">
          <h2>目前沒有商品可以結帳</h2>
          <p>回到首頁挑選甜點後，這裡會自動整理訂單明細。</p>
          <a class="btn primary" href="index.html#selection">回到選品</a>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <section class="checkout-card">
        <p class="kicker">Order Summary</p>
        <h2>訂單明細</h2>
        <div class="checkout-items">
          ${items.map((item) => `
            <div class="checkout-item">
              <span>${item.name} × ${item.qty}</span>
              <strong>${money(item.price * item.qty)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="sum-row"><span>商品小計</span><strong data-subtotal>${money(subtotal())}</strong></div>
        <div class="sum-row"><span>運費</span><strong data-shipping-fee>${money(60)}</strong></div>
        <div class="sum-row total"><span>應匯款總金額</span><strong data-grand-total>${money(subtotal() + 60)}</strong></div>
      </section>

      <form class="checkout-card form-card" data-checkout-form>
        <p class="kicker">Shipping</p>
        <h2>收件資料</h2>
        <label>姓名<input name="name" autocomplete="name" required></label>
        <label>手機號碼<input name="phone" inputmode="tel" autocomplete="tel" required></label>
        <label>寄送方式
          <select name="shipping" required>
            <option value="711">711 店到店</option>
            <option value="family">全家店到店</option>
            <option value="home">宅配</option>
          </select>
        </label>
        <label><span data-shipping-detail-label>711 門市名稱或店號</span><textarea name="shippingDetail" rows="3" required></textarea></label>
        <button class="btn primary full" type="submit">確認結帳並查看匯款資料</button>
      </form>

      <section class="checkout-card bank-card" data-bank-card hidden>
        <p class="kicker">Transfer</p>
        <h2>匯款資料</h2>
        <dl class="bank-list">
          <div><dt>銀行</dt><dd>${shop.bank.bankName}</dd></div>
          <div><dt>銀行代碼</dt><dd>${shop.bank.bankCode}</dd></div>
          <div><dt>戶名</dt><dd>${shop.bank.accountName}</dd></div>
          <div><dt>帳號</dt><dd>${shop.bank.accountNumber}</dd></div>
        </dl>
        <label>匯款後五碼<input name="last5" inputmode="numeric" maxlength="5" data-last5 placeholder="例如 12345"></label>
        <button class="btn primary full" type="button" data-line-send>複製訂單並前往官方 LINE</button>
        <p class="helper">訊息會先複製到剪貼簿，打開 LINE 後請貼上送出。</p>
      </section>
    `;

    const form = $("[data-checkout-form]");
    const shippingSelect = form.elements.shipping;
    const bankCard = $("[data-bank-card]");
    const invalidateDraft = () => {
      checkoutDraft = null;
      bankCard.hidden = true;
    };
    const updateShipping = () => {
      const shipping = shop.shipping[shippingSelect.value];
      $("[data-shipping-detail-label]").textContent = shipping.detailLabel;
      $("[data-shipping-fee]").textContent = money(shipping.fee);
      $("[data-grand-total]").textContent = money(subtotal() + shipping.fee);
    };

    form.addEventListener("input", invalidateDraft);
    shippingSelect.addEventListener("change", () => {
      updateShipping();
      invalidateDraft();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const shipping = shop.shipping[formData.get("shipping")];
      checkoutDraft = {
        name: formData.get("name").trim(),
        phone: formData.get("phone").trim(),
        shippingKey: formData.get("shipping"),
        shippingLabel: shipping.label,
        shippingFee: shipping.fee,
        shippingDetail: formData.get("shippingDetail").trim()
      };

      if (!checkoutDraft.name || !checkoutDraft.phone || !checkoutDraft.shippingDetail) {
        toast("請先填完收件資料");
        return;
      }

      bankCard.hidden = false;
      bankCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("[data-line-send]").addEventListener("click", sendLineOrder);
    updateShipping();
  }

  function buildLineMessage(last5) {
    const items = cartItems();
    const lines = [
      "【壹月食陸 訂單與匯款回覆】",
      "",
      `姓名：${checkoutDraft.name}`,
      `手機：${checkoutDraft.phone}`,
      `寄送方式：${checkoutDraft.shippingLabel}`,
      `寄送資料：${checkoutDraft.shippingDetail}`,
      "",
      "商品明細：",
      ...items.map((item) => `・${item.name} x${item.qty} = ${money(item.price * item.qty)}`),
      "",
      `商品小計：${money(subtotal())}`,
      `運費：${money(checkoutDraft.shippingFee)}`,
      `應匯款總金額：${money(subtotal() + checkoutDraft.shippingFee)}`,
      `匯款後五碼：${last5}`,
      "",
      "匯款帳戶：",
      `${shop.bank.bankName}（${shop.bank.bankCode}）`,
      `戶名：${shop.bank.accountName}`,
      `帳號：${shop.bank.accountNumber}`
    ];
    return lines.join("\n");
  }

  async function sendLineOrder() {
    const last5 = ($("[data-last5]")?.value || "").trim();
    if (!checkoutDraft) {
      toast("請先確認結帳資料");
      return;
    }
    if (!/^[0-9]{5}$/.test(last5)) {
      toast("請填寫匯款後五碼");
      return;
    }

    const message = buildLineMessage(last5);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message)
        .then(() => toast("訂單訊息已複製，請到 LINE 貼上送出"))
        .catch(() => window.prompt("請複製以下訂單訊息後貼到 LINE：", message));
    } else {
      window.prompt("請複製以下訂單訊息後貼到 LINE：", message);
    }
    window.open(shop.lineUrl, "_blank", "noopener");
  }

  function toast(message) {
    const node = $("[data-toast]");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function initNav() {
    const toggle = $(".nav-toggle");
    const nav = $(".site-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("open"));
      $$(".site-nav a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("open")));
    }
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((node) => node.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    $$(".reveal").forEach((node) => observer.observe(node));
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) addToCart(add.dataset.add);

    const cartOpen = event.target.closest("[data-cart-open]");
    if (cartOpen) openCart();

    const cartClose = event.target.closest("[data-cart-close]");
    if (cartClose) closeCart();

    const qty = event.target.closest("[data-qty]");
    if (qty) changeQty(qty.dataset.qty, Number(qty.dataset.delta));
  });

  createCartDrawer();
  initNav();
  renderProducts();
  renderCartDrawer();
  renderCheckout();
  updateCartCount();
  initReveal();
})();
