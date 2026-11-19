
"use strict";

/* =========================================================
   KELSEY'S CLOSET - CUSTOMER SHOPPING AND CHECKOUT
   ========================================================= */

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

if (!window.supabase) {
  throw new Error("Supabase library did not load. Check your internet connection.");
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
let discountAmount = 0;
let deliveryFee = 0;
let isSubmittingOrder = false;
let isSendingMessage = false;

/* -------------------------
   CART STORAGE
------------------------- */

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Could not load shopping bag:", error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function getProductId(product) {
  return String(product.id ?? product.product_id ?? "");
}

function getProductName(product) {
  return product.product_name ?? product.name ?? product.title ?? "Product";
}

function getProductPrice(product) {
  return Number(
    product.selling_price ??
    product.unit_price ??
    product.price ??
    product.sellingPrice ??
    0
  );
}

function getProductImage(product) {
  return product.image_url ??
    product.image ??
    product.image_path ??
    product.photo_url ??
    "";
}

function getProductCategory(product) {
  const category = String(product.category ?? product.product_category ?? "").toLowerCase();

  if (category.includes("shoe") || category.includes("heel") ||
      category.includes("converse") || category.includes("sneaker")) {
    return "shoes";
  }

  if (category.includes("accessor") || category.includes("jewel") ||
      category.includes("necklace") || category.includes("bracelet") ||
      category.includes("earring") || category.includes("ring") ||
      category.includes("clip")) {
    return "accessories";
  }

  return category || "clothing";
}

function getProductStock(product) {
  const value = product.stock_quantity ??
    product.quantity_in_stock ??
    product.stock ??
    product.quantity ??
    999999;

  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cartKey(productId, size, color) {
  return `${productId}::${size || ""}::${color || ""}`;
}

function getCartQuantity(productId) {
  return cart
    .filter((item) => String(item.product_id) === String(productId))
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function getSubtotal() {
  return cart.reduce(
    (total, item) => total + Number(item.unit_price) * Number(item.quantity),
    0
  );
}

function getDiscount() {
  if (discountCode === "KC10") {
    return Math.min(getSubtotal() * 0.10, getSubtotal());
  }

  return 0;
}

function getTotal() {
  return Math.max(0, getSubtotal() + deliveryFee - getDiscount());
}

/* -------------------------
   STATUS MESSAGES
------------------------- */

function showStatus(elementId, message, type = "info") {
  const element = $(elementId);
  if (!element) return;

  element.className = "status-message status-" + type;
  element.textContent = message;
  element.hidden = false;
}

function clearStatus(elementId) {
  const element = $(elementId);
  if (!element) return;

  element.textContent = "";
  element.className = "";
}

/* -------------------------
   PRODUCT CATALOGUE
------------------------- */

async function loadProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.innerHTML = '<p class="empty-message">Loading collection...</p>';

  try {
    const { data, error } = await db
      .from("products")
      .select("*");

    if (error) throw error;

    products = (data || []).filter((product) => {
      return product.is_active !== false &&
        product.active !== false &&
        product.deleted_at == null;
    });

    renderProducts();
  } catch (error) {
    console.error("Product loading error:", error);

    container.innerHTML =
      '<p class="empty-message">The collection could not be loaded. Please refresh the page.</p>';
  }
}

function renderProducts() {
  const container = $("customer-products");
  if (!container) return;

  const filtered = products.filter((product) => {
    return activeCategory === "all" ||
      getProductCategory(product) === activeCategory;
  });

  if (!filtered.length) {
    container.innerHTML =
      '<p class="empty-message">No products are available in this category right now.</p>';
    return;
  }

  container.innerHTML = filtered.map((product) => {
    const id = getProductId(product);
    const name = getProductName(product);
    const price = getProductPrice(product);
    const image = getProductImage(product);
    const category = getProductCategory(product);
    const stock = getProductStock(product);

    const sizes = Array.isArray(product.sizes)
      ? product.sizes
      : typeof product.sizes === "string"
        ? product.sizes.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const colors = Array.isArray(product.colors)
      ? product.colors
      : typeof product.colors === "string"
        ? product.colors.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const sizeField = sizes.length
      ? `<label for="size-${escapeHTML(id)}">Size</label>
         <select id="size-${escapeHTML(id)}">
           <option value="">Select size</option>
           ${sizes.map((size) =>
             `<option value="${escapeHTML(size)}">${escapeHTML(size)}</option>`
           ).join("")}
         </select>`
      : "";

    const colorField = colors.length
      ? `<label for="color-${escapeHTML(id)}">Colour</label>
         <select id="color-${escapeHTML(id)}">
           <option value="">Select colour</option>
           ${colors.map((color) =>
             `<option value="${escapeHTML(color)}">${escapeHTML(color)}</option>`
           ).join("")}
         </select>`
      : "";

    const imageMarkup = image
      ? `<img src="${escapeHTML(image)}"
              alt="${escapeHTML(name)}"
              loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <div class="no-image" style="display:none">Image unavailable</div>`
      : '<div class="no-image">Product image unavailable</div>';

    return `
      <article class="product-card">
        <div class="product-image">${imageMarkup}</div>
        <div class="product-info">
          <span class="product-category">${escapeHTML(category)}</span>
          <h3>${escapeHTML(name)}</h3>
          <div class="product-price">${money(price)}</div>
          <p class="stock-note">
            ${stock > 0 ? "Available" : "Currently out of stock"}
          </p>
          ${sizeField}
          ${colorField}
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

function addProductToCart(productId) {
  const product = products.find(
    (item) => getProductId(item) === String(productId)
  );

  if (!product) {
    alert("This product could not be found. Please refresh the collection.");
    return;
  }

  const sizeSelect = $("size-" + productId);
  const colorSelect = $("color-" + productId);

  const size = sizeSelect ? sizeSelect.value : "";
  const color = colorSelect ? colorSelect.value : "";

  if (sizeSelect && !size) {
    alert("Please select a size first.");
    sizeSelect.focus();
    return;
  }

  if (colorSelect && !color) {
    alert("Please select a colour first.");
    colorSelect.focus();
    return;
  }

  const stock = getProductStock(product);

  if (getCartQuantity(productId) >= stock) {
    alert("You cannot add more than the available stock.");
    return;
  }

  const key = cartKey(productId, size, color);
  const existing = cart.find((item) => item.key === key);

  if (existing) {
    if (getCartQuantity(productId) >= stock) {
      alert("You have reached the available stock for this product.");
      return;
    }

    existing.quantity += 1;
  } else {
    cart.push({
      key,
      product_id: productId,
      product_name: getProductName(product),
      image_url: getProductImage(product),
      size,
      color,
      quantity: 1,
      unit_price: getProductPrice(product)
    });
  }

  saveCart();
  alert("Added to your shopping bag.");
}

/* -------------------------
   SHOPPING BAG
------------------------- */

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  const itemCount = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0), 0
  );

  if ($("cart-count")) $("cart-count").textContent = String(itemCount);

  if (!cart.length) {
    container.innerHTML = "<p>Your shopping bag is empty.</p>";
  } else {
    container.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        ${
          item.image_url
            ? `<img src="${escapeHTML(item.image_url)}"
                    alt="${escapeHTML(item.product_name)}"
                    onerror="this.style.visibility='hidden'">`
            : '<div></div>'
        }
        <div>
          <h4>${escapeHTML(item.product_name)}</h4>
          ${item.size ? `<p>Size: ${escapeHTML(item.size)}</p>` : ""}
          ${item.color ? `<p>Colour: ${escapeHTML(item.color)}</p>` : ""}
          <p>${money(item.unit_price)} each</p>
          <label for="cart-quantity-${index}">Quantity</label>
          <input id="cart-quantity-${index}" type="number"
            min="1" step="1" value="${Number(item.quantity)}"
            data-cart-index="${index}" class="cart-quantity">
          <br>
          <button type="button" class="remove-btn"
            data-remove-index="${index}">Remove</button>
        </div>
        <strong>${money(Number(item.unit_price) * Number(item.quantity))}</strong>
      </div>
    `).join("");
  }

  updateSummary();
}

function updateSummary() {
  const subtotal = getSubtotal();
  discountAmount = getDiscount();

  if ($("cart-subtotal")) $("cart-subtotal").textContent = money(subtotal);
  if ($("cart-delivery-fee")) $("cart-delivery-fee").textContent = money(deliveryFee);
  if ($("cart-discount")) $("cart-discount").textContent = money(discountAmount);
  if ($("cart-total")) $("cart-total").textContent = money(getTotal());
  if ($("checkout-total")) $("checkout-total").textContent = money(getTotal());
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
    (entry) => getProductId(entry) === String(item.product_id)
  );

  if (product && amount + getCartQuantity(item.product_id) -
      Number(item.quantity) > getProductStock(product)) {
    alert("The quantity exceeds the available stock.");
    renderCart();
    return;
  }

  item.quantity = amount;
  saveCart();
}

function removeCartItem(index) {
  if (index < 0 || index >= cart.length) return;

  cart.splice(index, 1);
  saveCart();
}

/* -------------------------
   CATEGORY FILTERS
------------------------- */

function setupCategoryFilters() {
  const filters = $("category-filters");
  if (!filters) return;

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    activeCategory = button.dataset.category || "all";

    filters.querySelectorAll(".filter-btn").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderProducts();
  });
}

/* -------------------------
   DELIVERY AND CHECKOUT
------------------------- */

function setMinimumDate(inputId) {
  const input = $(inputId);
  if (!input) return;

  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  input.min = localDate;
}

function updateDeliveryFee() {
  const method = $("delivery-method")?.value || "";
  const area = $("delivery-area")?.value || "";

  if (method === "pickup") {
    deliveryFee = 0;
  } else if (method === "delivery") {
    const fees = {
      near_shop: 200,
      nairobi: 500,
      countrywide: 700
    };

    deliveryFee = fees[area] ?? 0;
  } else {
    deliveryFee = 0;
  }

  updateSummary();
}

function updateFulfilmentFields() {
  const method = $("delivery-method")?.value || "";
  const pickupFields = $("pickup-fields");
  const deliveryFields = $("delivery-fields");

  if (pickupFields) {
    pickupFields.classList.toggle("hidden", method !== "pickup");
  }

  if (deliveryFields) {
    deliveryFields.classList.toggle("hidden", method !== "delivery");
  }

  const pickupDate = $("pickup-date");
  const pickupTime = $("pickup-time");
  const deliveryArea = $("delivery-area");
  const deliveryDate = $("delivery-date");
  const deliveryTime = $("delivery-time");
  const deliveryLocation = $("delivery-location");
  const deliveryAddress = $("delivery-address");

  if (pickupDate) pickupDate.required = method === "pickup";
  if (pickupTime) pickupTime.required = method === "pickup";

  if (deliveryArea) deliveryArea.required = method === "delivery";
  if (deliveryDate) deliveryDate.required = method === "delivery";
  if (deliveryTime) deliveryTime.required = method === "delivery";
  if (deliveryLocation) deliveryLocation.required = method === "delivery";
  if (deliveryAddress) deliveryAddress.required = method === "delivery";

  updateDeliveryFee();
}

function updatePaymentFields() {
  const method = $("payment-method")?.value || "";
  const fields = $("mpesa-fields");
  const phone = $("mpesa-phone");

  if (fields) {
    fields.classList.toggle("hidden", method !== "mpesa");
  }

  if (phone) {
    phone.required = method === "mpesa";
  }
}

function normalizeKenyanPhone(value) {
  let phone = String(value || "").replace(/[\s\-()]/g, "");

  if (phone.startsWith("+254")) {
    phone = "254" + phone.slice(4);
  } else if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  }

  if (!/^254[17]\d{8}$/.test(phone)) {
    return null;
  }

  return phone;
}

function getSelectedSchedule() {
  const method = $("delivery-method")?.value || "";

  const dateInput = method === "pickup"
    ? $("pickup-date")
    : $("delivery-date");

  const timeInput = method === "pickup"
    ? $("pickup-time")
    : $("delivery-time");

  const date = String(dateInput?.value || "").trim();
  const time = String(timeInput?.value || "").trim();

  return { method, date, time };
}

function validateCheckout() {
  if (!cart.length) {
    showStatus("checkout-status", "Your shopping bag is empty.", "error");
    return false;
  }

  const firstName = $("order-first-name")?.value.trim() || "";
  const lastName = $("order-last-name")?.value.trim() || "";
  const phone = normalizeKenyanPhone($("order-phone")?.value);
  const method = $("delivery-method")?.value || "";
  const payment = $("payment-method")?.value || "";

  if (!firstName || !lastName) {
    showStatus("checkout-status", "Enter your first name and last name.", "error");
    return false;
  }

  if (!phone) {
    showStatus(
      "checkout-status",
      "Enter a valid Kenyan phone number, such as 0712345678 or 254712345678.",
      "error"
    );
    return false;
  }

  if (!["pickup", "delivery"].includes(method)) {
    showStatus("checkout-status", "Choose pickup or delivery.", "error");
    return false;
  }

  const schedule = getSelectedSchedule();

  if (!schedule.date || !schedule.time) {
    showStatus(
      "checkout-status",
      "Please select both your preferred date and time.",
      "error"
    );
    return false;
  }

  const today = new Date();
  const selected = new Date(schedule.date + "T00:00:00");
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (Number.isNaN(selected.getTime()) || selected < todayDate) {
    showStatus(
      "checkout-status",
      "Please choose today or a future date.",
      "error"
    );
    return false;
  }

  if (method === "delivery") {
    if (!$("delivery-area")?.value) {
      showStatus("checkout-status", "Choose a delivery area.", "error");
      return false;
    }

    if (!$("delivery-location")?.value.trim() ||
        !$("delivery-address")?.value.trim()) {
      showStatus(
        "checkout-status",
        "Enter your county or town and your delivery address.",
        "error"
      );
      return false;
    }
  }

  if (!["mpesa", "cash"].includes(payment)) {
    showStatus("checkout-status", "Choose a payment method.", "error");
    return false;
  }

  if (payment === "mpesa" && !normalizeKenyanPhone($("mpesa-phone")?.value)) {
    showStatus(
      "checkout-status",
      "Enter a valid Kenyan M-Pesa phone number.",
      "error"
    );
    return false;
  }

  return true;
}

async function getCurrentCustomerId() {
  try {
    const { data, error } = await db.auth.getUser();

    if (error) {
      console.warn("Customer session could not be retrieved:", error.message);
      return null;
    }

    return data?.user?.id || null;
  } catch (error) {
    console.warn("Customer session unavailable:", error);
    return null;
  }
}

async function verifyStockBeforeOrder() {
  for (const item of cart) {
    const product = products.find(
      (entry) => getProductId(entry) === String(item.product_id)
    );

    if (!product) {
      throw new Error(
        `The product "${item.product_name}" is no longer available. Refresh the collection and try again.`
      );
    }

    if (getCartQuantity(item.product_id) > getProductStock(product)) {
      throw new Error(
        `The requested quantity for "${item.product_name}" is no longer available.`
      );
    }
  }
}

function buildOrderPayload(customerId) {
  const firstName = $("order-first-name").value.trim();
  const lastName = $("order-last-name").value.trim();
  const phone = normalizeKenyanPhone($("order-phone").value);
  const email = $("order-email").value.trim() || null;
  const method = $("delivery-method").value;
  const payment = $("payment-method").value;
  const schedule = getSelectedSchedule();

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
  const discount = Number(getDiscount().toFixed(2));
  const fee = Number(deliveryFee.toFixed(2));
  const total = Number((subtotal + fee - discount).toFixed(2));

  /*
    IMPORTANT:
    schedule_slot is sent as a non-empty string because your
    Supabase orders table requires this column.
    delivery_time is also populated for compatibility with your schema.
  */

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
    scheduled_date: schedule.date,
    schedule_slot: schedule.time || "Time to be confirmed",
    delivery_time: schedule.time || "Time to be confirmed",
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

async function placeOrder(event) {
  event.preventDefault();

  if (isSubmittingOrder) return;

  clearStatus("checkout-status");

  if (!validateCheckout()) return;

  isSubmittingOrder = true;

  const submitButton = $("place-order-button");
  const originalText = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Placing Order...";

  try {
    await verifyStockBeforeOrder();

    const customerId = await getCurrentCustomerId();
    const payload = buildOrderPayload(customerId);

    /*
      Send the complete order to Supabase.
      Do not omit schedule_slot or scheduled_date.
    */

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert(payload)
      .select("*")
      .single();

    if (orderError) {
      console.error("Order insertion failed:", orderError);
      throw orderError;
    }

    if (!order?.id) {
      throw new Error("The order was saved without returning an order ID.");
    }

    const orderItems = cart.map((item) => ({
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

    const { error: itemsError } = await db
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items insertion failed:", itemsError);

      showStatus(
        "checkout-status",
        `Order ${order.id} was created, but its items could not be saved. Please contact the shop and provide this order number: ${order.id}.`,
        "error"
      );

      await loadCustomerOrders();
      return;
    }

    const orderNumber = order.receipt_number || order.id;

    cart = [];
    discountCode = "";
    discountAmount = 0;
    deliveryFee = 0;

    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    if ($("discount-code")) $("discount-code").value = "";
    if ($("discount-status")) $("discount-status").textContent = "";

    renderCart();

    showStatus(
      "checkout-status",
      `Your order has been placed successfully. Order number: ${orderNumber}. Payment status: Pending. Please follow the payment arrangements for your selected method.`,
      "success"
    );

    $("checkout-form").reset();
    updateFulfilmentFields();
    updatePaymentFields();

    await loadCustomerOrders();

    $("my-orders").scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (error) {
    console.error("Checkout error:", error);

    const message = error?.message ||
      error?.details ||
      error?.hint ||
      "An unexpected error occurred.";

    showStatus(
      "checkout-status",
      "Your order could not be placed: " + message,
      "error"
    );
  } finally {
    isSubmittingOrder = false;
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

/* -------------------------
   CUSTOMER ORDER HISTORY
------------------------- */

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

    if (!data || !data.length) {
      container.innerHTML = "<p>You have not placed any orders yet.</p>";
      return;
    }

    container.innerHTML = data.map((order) => {
      const orderNumber = order.receipt_number || order.id;
      const date = order.created_at
        ? new Date(order.created_at).toLocaleString("en-KE")
        : "Date unavailable";

      return `
        <article class="order-card">
          <h4>Order: ${escapeHTML(orderNumber)}</h4>
          <p><strong>Date placed:</strong> ${escapeHTML(date)}</p>
          <p><strong>Total:</strong> ${money(order.total)}</p>
          <p><strong>Payment:</strong> ${escapeHTML(order.payment_method || "Not specified")}</p>
          <p><strong>Payment status:</strong> ${escapeHTML(order.payment_status || "Pending")}</p>
          <p><strong>Order status:</strong> ${escapeHTML(order.order_status || "Pending")}</p>
          <p><strong>Collection / delivery:</strong> ${escapeHTML(order.fulfillment_type || "Not specified")}</p>
          <p><strong>Scheduled date:</strong> ${escapeHTML(order.scheduled_date || "Not specified")}</p>
          <p><strong>Scheduled time:</strong> ${escapeHTML(order.schedule_slot || order.delivery_time || "To be confirmed")}</p>
        </article>`;
    }).join("");

  } catch (error) {
    console.error("Order history error:", error);
    container.innerHTML =
      "<p>Your orders could not be loaded. Please refresh the page.</p>";
  }
}

/* -------------------------
   DISCOUNT CODE
------------------------- */

function applyDiscount() {
  const input = $("discount-code");
  const status = $("discount-status");

  const entered = String(input?.value || "").trim().toUpperCase();

  if (entered === "KC10") {
    discountCode = entered;
    discountAmount = getDiscount();

    if (status) {
      status.textContent = `Discount applied: ${money(discountAmount)} off.`;
      status.className = "status-message status-success";
    }
  } else {
    discountCode = "";
    discountAmount = 0;

    if (status) {
      status.textContent = entered
        ? "That discount code is not valid."
        : "Enter a discount code first.";

      status.className = "status-message status-error";
    }
  }

  updateSummary();
}

/* -------------------------
   CONTACT FORM
------------------------- */

async function sendContactMessage(event) {
  event.preventDefault();

  if (isSendingMessage) return;

  clearStatus("contact-status");

  const name = $("contact-name")?.value.trim() || "";
  const email = $("contact-email")?.value.trim() || "";
  const message = $("contact-message")?.value.trim() || "";

  if (!name || !email || !message) {
    showStatus("contact-status", "Please complete all contact fields.", "error");
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
      .insert({
        name,
        email,
        message
      });

    if (error) throw error;

    showStatus(
      "contact-status",
      "Your message has been sent successfully.",
      "success"
    );

    $("contact-form").reset();

  } catch (error) {
    console.error("Contact message error:", error);

    showStatus(
      "contact-status",
      "Your message could not be sent: " +
        (error?.message || "Please try again later."),
      "error"
    );
  } finally {
    isSendingMessage = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

/* -------------------------
   SIGN OUT
------------------------- */

async function signOutCustomer(event) {
  event.preventDefault();

  try {
    const { error } = await db.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error);
      alert("Could not sign out: " + error.message);
      return;
    }

    window.location.href = "login.html";

  } catch (error) {
    console.error("Sign-out error:", error);
    alert("Sign-out failed. Please try again.");
  }
}

/* -------------------------
   PAGE INITIALISATION
------------------------- */

function setupPageEvents() {
  $("current-year").textContent = String(new Date().getFullYear());

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
    if (!button) return;

    addProductToCart(button.dataset.productId);
  });

  $("cart-items")?.addEventListener("change", (event) => {
    const input = event.target.closest(".cart-quantity");
    if (!input) return;

    changeCartQuantity(
      Number(input.dataset.cartIndex),
      input.value
    );
  });

  $("cart-items")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-index]");
    if (!button) return;

    removeCartItem(Number(button.dataset.removeIndex));
  });

  $("checkout-button")?.addEventListener("click", () => {
    if (!cart.length) {
      alert("Your shopping bag is empty. Add products before checkout.");
      return;
    }

    const form = $("checkout-form");
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
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

document.addEventListener("DOMContentLoaded", async () => {
  setupPageEvents();
  await loadProducts();
  await loadCustomerOrders();
});
