/* =========================================================
   KELSEY'S CLOSET - CUSTOMER JAVASCRIPT
   ========================================================= */

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

if (!window.supabase) {
  throw new Error("Supabase failed to load. Check your internet connection.");
}

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const money = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

const CART_KEY = "kc-shopping-cart";

let products = [];
let cart = loadCart();
let activeCategory = "all";
let discountCode = "";
let deliveryFee = 0;
let isSubmittingOrder = false;
let isSendingMessage = false;

/* =========================
   SHOPPING BAG STORAGE
========================= */

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Shopping bag loading error:", error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function productId(product) {
  return String(product.id ?? product.product_id ?? "");
}

function productName(product) {
  return product.product_name ?? product.name ?? product.title ?? "Product";
}

function productPrice(product) {
  return Number(
    product.selling_price ??
    product.unit_price ??
    product.price ??
    product.sellingPrice ??
    0
  );
}

function productImage(product) {
  return product.image_url ??
    product.image ??
    product.image_path ??
    product.photo_url ??
    "";
}

function productCategory(product) {
  const category = String(
    product.category ?? product.product_category ?? ""
  ).toLowerCase();

  if (
    category.includes("shoe") ||
    category.includes("heel") ||
    category.includes("converse") ||
    category.includes("sneaker")
  ) return "shoes";

  if (
    category.includes("accessor") ||
    category.includes("jewel") ||
    category.includes("necklace") ||
    category.includes("bracelet") ||
    category.includes("earring") ||
    category.includes("ring") ||
    category.includes("clip")
  ) return "accessories";

  return category || "clothing";
}

function productStock(product) {
  const value = product.stock_quantity ??
    product.quantity_in_stock ??
    product.stock ??
    product.quantity ??
    999999;

  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function getSubtotal() {
  return cart.reduce(
    (total, item) =>
      total + Number(item.unit_price) * Number(item.quantity),
    0
  );
}

function getDiscount() {
  return discountCode === "KC10"
    ? Math.min(getSubtotal() * 0.10, getSubtotal())
    : 0;
}

function getTotal() {
  return Math.max(0, getSubtotal() + deliveryFee - getDiscount());
}

/* =========================
   STATUS MESSAGES
========================= */

function showStatus(id, message, type = "info") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = "status-message status-" + type;
}

function clearStatus(id) {
  const element = $(id);
  if (!element) return;

  element.textContent = "";
  element.className = "";
}

/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.innerHTML =
    '<p class="empty-message">Loading collection...</p>';

  try {
    const { data, error } = await db.from("products").select("*");
    if (error) throw error;

    products = (data || []).filter((item) =>
      item.is_active !== false &&
      item.active !== false &&
      item.deleted_at == null
    );

    renderProducts();
  } catch (error) {
    console.error("Products loading error:", error);
    container.innerHTML =
      '<p class="empty-message">The collection could not be loaded. Please refresh the page.</p>';
  }
}

function renderProducts() {
  const container = $("customer-products");
  if (!container) return;

  const filtered = products.filter((item) =>
    activeCategory === "all" ||
    productCategory(item) === activeCategory
  );

  if (!filtered.length) {
    container.innerHTML =
      '<p class="empty-message">No products are available in this category.</p>';
    return;
  }

  container.innerHTML = filtered.map((item) => {
    const id = productId(item);
    const name = productName(item);
    const price = productPrice(item);
    const image = productImage(item);
    const category = productCategory(item);
    const stock = productStock(item);

    const sizes = Array.isArray(item.sizes)
      ? item.sizes
      : typeof item.sizes === "string"
        ? item.sizes.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

    const colors = Array.isArray(item.colors)
      ? item.colors
      : typeof item.colors === "string"
        ? item.colors.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

    const sizeHTML = sizes.length
      ? `<label for="size-${escapeHTML(id)}">Size</label>
         <select id="size-${escapeHTML(id)}">
           <option value="">Select size</option>
           ${sizes.map((v) =>
             `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
           ).join("")}
         </select>`
      : "";

    const colorHTML = colors.length
      ? `<label for="color-${escapeHTML(id)}">Colour</label>
         <select id="color-${escapeHTML(id)}">
           <option value="">Select colour</option>
           ${colors.map((v) =>
             `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
           ).join("")}
         </select>`
      : "";

    const imageHTML = image
      ? `<img src="${escapeHTML(image)}"
              alt="${escapeHTML(name)}"
              loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <div class="no-image" style="display:none">Image unavailable</div>`
      : '<div class="no-image">Product image unavailable</div>';

    return `
      <article class="product-card">
        <div class="product-image">${imageHTML}</div>
        <div class="product-info">
          <span class="product-category">${escapeHTML(category)}</span>
          <h3>${escapeHTML(name)}</h3>
          <div class="product-price">${money(price)}</div>
          <p class="stock-note">${stock > 0 ? "Available" : "Out of stock"}</p>
          ${sizeHTML}
          ${colorHTML}
          <button type="button"
            class="btn add-to-cart"
            data-product-id="${escapeHTML(id)}"
            ${stock <= 0 ? "disabled" : ""}>
            ${stock > 0 ? "Add to Bag" : "Out of Stock"}
          </button>
        </div>
      </article>`;
  }).join("");
}

/* =========================
   ADD PRODUCTS TO BAG
========================= */

function addProductToCart(id) {
  const product = products.find((item) => productId(item) === String(id));

  if (!product) {
    alert("Product not found. Please refresh the page.");
    return;
  }

  const sizeElement = $("size-" + id);
  const colorElement = $("color-" + id);

  const size = sizeElement?.value || "";
  const color = colorElement?.value || "";

  if (sizeElement && !size) {
    alert("Please select a size.");
    sizeElement.focus();
    return;
  }

  if (colorElement && !color) {
    alert("Please select a colour.");
    colorElement.focus();
    return;
  }

  if (getCartQuantity(id) >= productStock(product)) {
    alert("The available stock limit has been reached.");
    return;
  }

  const key = `${id}::${size}::${color}`;
  const existing = cart.find((item) => item.key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      key,
      product_id: id,
      product_name: productName(product),
      image_url: productImage(product),
      size,
      color,
      quantity: 1,
      unit_price: productPrice(product)
    });
  }

  saveCart();
  alert("Product added to your shopping bag.");
}

function getCartQuantity(id) {
  return cart
    .filter((item) => String(item.product_id) === String(id))
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
}

/* =========================
   RENDER SHOPPING BAG
========================= */

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  const count = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if ($("cart-count")) $("cart-count").textContent = String(count);

  if (!cart.length) {
    container.innerHTML = "<p>Your shopping bag is empty.</p>";
  } else {
    container.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        ${item.image_url
          ? `<img src="${escapeHTML(item.image_url)}"
                  alt="${escapeHTML(item.product_name)}"
                  onerror="this.style.visibility='hidden'">`
          : "<div></div>"}
        <div>
          <h4>${escapeHTML(item.product_name)}</h4>
          ${item.size ? `<p>Size: ${escapeHTML(item.size)}</p>` : ""}
          ${item.color ? `<p>Colour: ${escapeHTML(item.color)}</p>` : ""}
          <p>${money(item.unit_price)} each</p>
          <label for="cart-quantity-${index}">Quantity</label>
          <input id="cart-quantity-${index}"
            class="cart-quantity"
            data-cart-index="${index}"
            type="number" min="1" step="1"
            value="${Number(item.quantity)}">
          <br>
          <button type="button" class="remove-btn"
            data-remove-index="${index}">Remove</button>
        </div>
        <strong>${money(item.unit_price * item.quantity)}</strong>
      </div>
    `).join("");
  }

  updateSummary();
}

function updateSummary() {
  if ($("cart-subtotal")) {
    $("cart-subtotal").textContent = money(getSubtotal());
  }

  if ($("cart-delivery-fee")) {
    $("cart-delivery-fee").textContent = money(deliveryFee);
  }

  if ($("cart-discount")) {
    $("cart-discount").textContent = money(getDiscount());
  }

  if ($("cart-total")) {
    $("cart-total").textContent = money(getTotal());
  }

  if ($("checkout-total")) {
    $("checkout-total").textContent = money(getTotal());
  }
}

function changeCartQuantity(index, quantity) {
  const item = cart[index];
  if (!item) return;

  const amount = Number(quantity);

  if (!Number.isInteger(amount) || amount < 1) {
    renderCart();
    return;
  }

  const product = products.find(
    (entry) => productId(entry) === String(item.product_id)
  );

  if (product) {
    const otherQuantity = getCartQuantity(item.product_id) - item.quantity;

    if (otherQuantity + amount > productStock(product)) {
      alert("The requested quantity exceeds the available stock.");
      renderCart();
      return;
    }
  }

  item.quantity = amount;
  saveCart();
}

function removeCartItem(index) {
  if (index < 0 || index >= cart.length) return;
  cart.splice(index, 1);
  saveCart();
}

/* =========================
   CATEGORY FILTERS
========================= */

function setupCategoryFilters() {
  $("category-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    activeCategory = button.dataset.category || "all";

    document.querySelectorAll(".filter-btn").forEach((element) => {
      element.classList.toggle("active", element === button);
    });

    renderProducts();
  });
}

/* =========================
   DATES, DELIVERY AND PAYMENT
========================= */

function setMinimumDate(id) {
  const input = $(id);
  if (!input) return;

  const now = new Date();
  input.min = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

function updateDeliveryFee() {
  const method = $("delivery-method")?.value || "";
  const area = $("delivery-area")?.value || "";

  const fees = {
    near_shop: 200,
    nairobi: 500,
    countrywide: 700
  };

  deliveryFee = method === "delivery" ? (fees[area] ?? 0) : 0;
  updateSummary();
}

function updateFulfilmentFields() {
  const method = $("delivery-method")?.value || "";

  $("pickup-fields")?.classList.toggle("hidden", method !== "pickup");
  $("delivery-fields")?.classList.toggle("hidden", method !== "delivery");

  const pickup = method === "pickup";
  const delivery = method === "delivery";

  if ($("pickup-date")) $("pickup-date").required = pickup;
  if ($("pickup-time")) $("pickup-time").required = pickup;

  if ($("delivery-area")) $("delivery-area").required = delivery;
  if ($("delivery-date")) $("delivery-date").required = delivery;
  if ($("delivery-time")) $("delivery-time").required = delivery;
  if ($("delivery-location")) $("delivery-location").required = delivery;
  if ($("delivery-address")) $("delivery-address").required = delivery;

  updateDeliveryFee();
}

function updatePaymentFields() {
  const method = $("payment-method")?.value || "";
  const isMpesa = method === "mpesa";

  $("mpesa-fields")?.classList.toggle("hidden", !isMpesa);

  if ($("mpesa-phone")) {
    $("mpesa-phone").required = isMpesa;
  }
}

function normalizeKenyanPhone(value) {
  let phone = String(value || "").replace(/[\s\-()]/g, "");

  if (phone.startsWith("+254")) {
    phone = "254" + phone.slice(4);
  } else if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  }

  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

function getSelectedSchedule() {
  const method = $("delivery-method")?.value || "";

  const date = String(
    (method === "pickup" ? $("pickup-date") : $("delivery-date"))?.value || ""
  ).trim();

  const time = String(
    (method === "pickup" ? $("pickup-time") : $("delivery-time"))?.value || ""
  ).trim();

  return { method, date, time };
}

/* =========================
   VALIDATE CHECKOUT
========================= */

function validateCheckout() {
  if (!cart.length) {
    showStatus("checkout-status", "Your shopping bag is empty.", "error");
    return false;
  }

  if (!$("order-first-name")?.value.trim() ||
      !$("order-last-name")?.value.trim()) {
    showStatus("checkout-status", "Enter your first and last name.", "error");
    return false;
  }

  if (!normalizeKenyanPhone($("order-phone")?.value)) {
    showStatus(
      "checkout-status",
      "Enter a valid Kenyan phone number, such as 0712345678.",
      "error"
    );
    return false;
  }

  const { method, date, time } = getSelectedSchedule();

  if (!["pickup", "delivery"].includes(method)) {
    showStatus("checkout-status", "Select pickup or delivery.", "error");
    return false;
  }

  if (!date || !time) {
    showStatus("checkout-status", "Select your preferred date and time.", "error");
    return false;
  }

  const selectedDate = new Date(date + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
    showStatus("checkout-status", "Choose today or a future date.", "error");
    return false;
  }

  if (method === "delivery") {
    if (!$("delivery-area")?.value ||
        !$("delivery-location")?.value.trim() ||
        !$("delivery-address")?.value.trim()) {
      showStatus(
        "checkout-status",
        "Complete your delivery area, county or town, and address.",
        "error"
      );
      return false;
    }
  }

  const payment = $("payment-method")?.value || "";

  if (!["mpesa", "cash"].includes(payment)) {
    showStatus("checkout-status", "Choose a payment method.", "error");
    return false;
  }

  if (payment === "mpesa" &&
      !normalizeKenyanPhone($("mpesa-phone")?.value)) {
    showStatus("checkout-status", "Enter a valid M-Pesa phone number.", "error");
    return false;
  }

  return true;
}

/* =========================
   CUSTOMER SESSION
========================= */

async function getCurrentCustomerId() {
  try {
    const { data, error } = await db.auth.getUser();

    if (error) {
      console.warn("Customer session lookup:", error.message);
      return null;
    }

    return data?.user?.id || null;
  } catch (error) {
    console.warn("Customer session unavailable:", error);
    return null;
  }
}

/* =========================
   BUILD ORDER PAYLOAD
========================= */

function buildOrderPayload(customerId) {
  const firstName = $("order-first-name").value.trim();
  const lastName = $("order-last-name").value.trim();
  const phone = normalizeKenyanPhone($("order-phone").value);
  const email = $("order-email")?.value.trim() || null;

  const { method, date, time } = getSelectedSchedule();
  const payment = $("payment-method").value;

  const area = method === "delivery"
    ? $("delivery-area").value
    : null;

  const location = method === "delivery"
    ? $("delivery-location").value.trim()
    : null;

  const address = method === "delivery"
    ? $("delivery-address").value.trim()
    : null;

  const mpesaPhone = payment === "mpesa"
    ? normalizeKenyanPhone($("mpesa-phone").value)
    : null;

  const subtotal = Number(getSubtotal().toFixed(2));
  const fee = Number(deliveryFee.toFixed(2));
  const discount = Number(getDiscount().toFixed(2));
  const total = Number((subtotal + fee - discount).toFixed(2));

  return {
    customer_id: customerId,
    customer_name: `${firstName} ${lastName}`,
    customer_email: email,
    customer_phone_number: phone,
    fulfillment_type: method,
    delivery_area: area,
    county: location,
    town: location,
    delivery_address: address,
    delivery_fee: fee,

    // REQUIRED DATABASE COLUMN: scheduled_slot
    scheduled_date: date,
    scheduled_slot: time || "Time to be confirmed",

    // Retained for compatibility with your other columns
    schedule_slot: time || "Time to be confirmed",
    delivery_time: time || "Time to be confirmed",

    subtotal,
    discount_code: discountCode || null,
    discount_amount: discount,
    total,
    payment_method: payment,
    payment_status: "pending",
    mpesa_phone: mpesaPhone,
    order_status: "pending"
  };
}

/* =========================
   PLACE ORDER
========================= */

async function placeOrder(event) {
  event.preventDefault();

  if (isSubmittingOrder) return;

  clearStatus("checkout-status");

  if (!validateCheckout()) return;

  isSubmittingOrder = true;

  const button = $("place-order-button");
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Placing Order...";

  try {
    const customerId = await getCurrentCustomerId();
    const payload = buildOrderPayload(customerId);

    console.log("Checkout payload:", payload);

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert(payload)
      .select("*")
      .single();

    if (orderError) {
      console.error("Order insert failed:", orderError);
      throw orderError;
    }

    if (!order?.id) {
      throw new Error("Supabase did not return the created order ID.");
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      size: item.size || null,
      color: item.color || null,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(
        (Number(item.unit_price) * Number(item.quantity)).toFixed(2)
      )
    }));

    const { error: itemError } = await db
      .from("order_items")
      .insert(items);

    if (itemError) {
      console.error("Order items insert failed:", itemError);

      showStatus(
        "checkout-status",
        `Order ${order.id} was created, but its items could not be saved. Please contact the shop with this order number.`,
        "error"
      );

      await loadCustomerOrders();
      return;
    }

    const orderNumber = order.receipt_number || order.id;

    cart = [];
    discountCode = "";
    deliveryFee = 0;

    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    if ($("discount-code")) $("discount-code").value = "";
    if ($("discount-status")) $("discount-status").textContent = "";

    renderCart();

    $("checkout-form").reset();
    updateFulfilmentFields();
    updatePaymentFields();

    showStatus(
      "checkout-status",
      `Your order has been placed successfully. Order number: ${orderNumber}. Payment status: Pending.`,
      "success"
    );

    await loadCustomerOrders();

    $("my-orders")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    console.error("Checkout error:", error);

    showStatus(
      "checkout-status",
      "Your order could not be placed: " +
        (error?.message || error?.details || "Unexpected error."),
      "error"
    );
  } finally {
    isSubmittingOrder = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

/* =========================
   CUSTOMER ORDER HISTORY
========================= */

async function loadCustomerOrders() {
  const container = $("customer-orders");
  if (!container) return;

  try {
    const customerId = await getCurrentCustomerId();

    if (!customerId) {
      container.innerHTML =
        "<p>Sign in to your customer account to view your order history.</p>";
      return;
    }

    const { data, error } = await db
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = "<p>You have not placed any orders yet.</p>";
      return;
    }

    container.innerHTML = data.map((order) => `
      <article class="order-card">
        <h4>Order: ${escapeHTML(order.receipt_number || order.id)}</h4>
        <p><strong>Date placed:</strong>
          ${escapeHTML(order.created_at
            ? new Date(order.created_at).toLocaleString("en-KE")
            : "Not available")}
        </p>
        <p><strong>Total:</strong> ${money(order.total)}</p>
        <p><strong>Payment method:</strong>
          ${escapeHTML(order.payment_method || "Not specified")}
        </p>
        <p><strong>Payment status:</strong>
          ${escapeHTML(order.payment_status || "Pending")}
        </p>
        <p><strong>Order status:</strong>
          ${escapeHTML(order.order_status || "Pending")}
        </p>
        <p><strong>Collection / delivery:</strong>
          ${escapeHTML(order.fulfillment_type || "Not specified")}
        </p>
        <p><strong>Scheduled date:</strong>
          ${escapeHTML(order.scheduled_date || "Not specified")}
        </p>
        <p><strong>Scheduled time:</strong>
          ${escapeHTML(order.scheduled_slot || order.schedule_slot ||
            order.delivery_time || "To be confirmed")}
        </p>
      </article>
    `).join("");

  } catch (error) {
    console.error("Order history error:", error);
    container.innerHTML =
      "<p>Your order history could not be loaded. Please refresh the page.</p>";
  }
}

/* =========================
   DISCOUNT CODE
========================= */

function applyDiscount() {
  const entered = String($("discount-code")?.value || "")
    .trim()
    .toUpperCase();

  const status = $("discount-status");

  if (entered === "KC10") {
    discountCode = entered;

    if (status) {
      status.textContent = `Discount applied: ${money(getDiscount())} off.`;
      status.className = "status-message status-success";
    }
  } else {
    discountCode = "";

    if (status) {
      status.textContent = entered
        ? "That discount code is not valid."
        : "Enter a discount code first.";

      status.className = "status-message status-error";
    }
  }

  updateSummary();
}

/* =========================
   CONTACT FORM
========================= */

async function sendContactMessage(event) {
  event.preventDefault();

  if (isSendingMessage) return;

  const name = $("contact-name")?.value.trim() || "";
  const email = $("contact-email")?.value.trim() || "";
  const message = $("contact-message")?.value.trim() || "";

  if (!name || !email || !message) {
    showStatus("contact-status", "Complete all contact fields.", "error");
    return;
  }

  isSendingMessage = true;

  const button = $("contact-submit");
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Sending...";

  try {
    const { error } = await db
      .from("messages")
      .insert({ name, email, message });

    if (error) throw error;

    showStatus("contact-status", "Your message has been sent.", "success");
    $("contact-form").reset();

  } catch (error) {
    console.error("Contact form error:", error);

    showStatus(
      "contact-status",
      "Your message could not be sent: " +
        (error?.message || "Please try again."),
      "error"
    );
  } finally {
    isSendingMessage = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

/* =========================
   SIGN OUT
========================= */

async function signOutCustomer(event) {
  event.preventDefault();

  try {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    window.location.href = "login.html";
  } catch (error) {
    console.error("Sign-out error:", error);
    alert("Could not sign out: " + (error?.message || "Please try again."));
  }
}

/* =========================
   CONNECT PAGE EVENTS
========================= */

function setupPageEvents() {
  if ($("current-year")) {
    $("current-year").textContent = String(new Date().getFullYear());
  }

  $("menu-toggle")?.addEventListener("click", () => {
    $("main-nav")?.classList.toggle("open");
  });

  $("main-nav")?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      $("main-nav")?.classList.remove("open");
    }
  });

  $("customer-products")?.addEventListener("click", (event) => {
    const button = event.target.closest(".add-to-cart");
    if (button) addProductToCart(button.dataset.productId);
  });

  $("cart-items")?.addEventListener("change", (event) => {
    const input = event.target.closest(".cart-quantity");
    if (!input) return;

    changeCartQuantity(Number(input.dataset.cartIndex), input.value);
  });

  $("cart-items")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-index]");
    if (button) removeCartItem(Number(button.dataset.removeIndex));
  });

  $("checkout-button")?.addEventListener("click", () => {
    if (!cart.length) {
      alert("Your shopping bag is empty. Add a product first.");
      return;
    }

    $("checkout-form")?.classList.remove("hidden");
    $("checkout-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("back-to-bag")?.addEventListener("click", () => {
    $("checkout-form")?.classList.add("hidden");
    $("shopping-bag")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("delivery-method")?.addEventListener("change", updateFulfilmentFields);
  $("delivery-area")?.addEventListener("change", updateDeliveryFee);
  $("payment-method")?.addEventListener("change", updatePaymentFields);

  $("checkout-form")?.addEventListener("submit", placeOrder);
  $("apply-discount")?.addEventListener("click", applyDiscount);
  $("contact-form")?.addEventListener("submit", sendContactMessage);
  $("customer-signout")?.addEventListener("click", signOutCustomer);

  setupCategoryFilters();

  setMinimumDate("pickup-date");
  setMinimumDate("delivery-date");

  updateFulfilmentFields();
  updatePaymentFields();
  renderCart();
}

/* =========================
   START PAGE
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  setupPageEvents();
  await loadProducts();
  await loadCustomerOrders();
});
