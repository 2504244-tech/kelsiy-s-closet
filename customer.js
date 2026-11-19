
"use strict";

/* KELSIY'S CLOSET — CUSTOMER SHOPPING SYSTEM */

const CUSTOMER_SUPABASE_URL =
  "https://zqvjaqpqtctnvylgtwjg.supabase.co";

const CUSTOMER_SUPABASE_KEY =
  "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

const $ = id => document.getElementById(id);

const money = value =>
  "KSh " + Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2
  });

const safeText = (parent, tag, value, className) => {
  const element = document.createElement(tag);
  element.textContent = value == null ? "" : String(value);
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
};

let allProducts = [];
let currentCustomer = null;
let cart = [];
let orderSubmitting = false;

try {
  cart = JSON.parse(localStorage.getItem("kc-shopping-cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

/* ---------------- SHOPPING BAG ---------------- */

function saveCart() {
  localStorage.setItem("kc-shopping-cart", JSON.stringify(cart));
  updateBagCount();
  renderCart();
}

function updateBagCount() {
  const count = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if ($("bag-count")) $("bag-count").textContent = count;
}

function resolveProductImage(value) {
  const path = String(value || "").trim();

  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  return path.startsWith("image/")
    ? path
    : "image/" + path.replace(/^\.?\//, "");
}

function parseOptions(value) {
  return String(value || "")
    .split(/[,;|]/)
    .map(value => value.trim())
    .filter(Boolean);
}

function makeSelect(options, label) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);

  const placeholder = new Option("Choose " + label.toLowerCase(), "");
  placeholder.disabled = true;
  placeholder.selected = true;
  select.add(placeholder);

  options.forEach(value => select.add(new Option(value, value)));
  return select;
}

function productImage(product) {
  const image = document.createElement("img");
  image.className = "customer-product-image";
  image.alt = product.name || "Fashion product";
  image.loading = "lazy";

  const path = resolveProductImage(
    product.image_url || product.image || product.image_path
  );

  if (path) image.src = path;

  image.onerror = () => {
    image.removeAttribute("src");
    image.alt = "Product image unavailable";
  };

  return image;
}

/* ---------------- PRODUCTS ---------------- */

function displayProducts() {
  const container = $("customer-products");
  const message = $("catalogue-message");

  if (!container || !message) return;

  container.replaceChildren();

  const category = ($("category-filter")?.value || "all").toLowerCase();

  const products = allProducts.filter(product =>
    category === "all" ||
    String(product.category || "").toLowerCase() === category
  );

  if (!products.length) {
    message.textContent = "No products are available in this category.";
    return;
  }

  message.textContent = products.length + " product(s) available.";

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";
    card.appendChild(productImage(product));

    const details = document.createElement("div");
    details.className = "customer-product-details";

    safeText(details, "h3", product.name || "Fashion item");
    safeText(details, "p", money(product.price), "customer-product-price");

    if (product.description) {
      safeText(details, "p", product.description);
    }

    const stock = Math.max(0, Number(product.stock) || 0);

    safeText(
      details,
      "p",
      stock ? stock + " item(s) available" : "SOLD OUT"
    );

    const options = document.createElement("div");
    options.className = "kc-product-options";

    const colors = parseOptions(product.color || product.colour);
    const sizes = parseOptions(product.size);

    let colorSelect = null;
    let sizeSelect = null;

    if (colors.length) {
      const label = safeText(options, "label", "Choose colour ");
      colorSelect = makeSelect(colors, "Colour");
      label.appendChild(colorSelect);
    }

    if (sizes.length) {
      const label = safeText(options, "label", "Choose size ");
      sizeSelect = makeSelect(sizes, "Size");
      label.appendChild(sizeSelect);
    }

    const quantityLabel = safeText(options, "label", "Quantity ");
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(Math.max(1, stock));
    quantity.value = "1";
    quantity.disabled = stock < 1;
    quantityLabel.appendChild(quantity);

    details.appendChild(options);

    const add = safeText(
      details,
      "button",
      stock ? "ADD TO BAG" : "SOLD OUT",
      "kc-button kc-add-button"
    );

    add.type = "button";
    add.disabled = stock < 1;

    add.addEventListener("click", () => {
      const qty = Number(quantity.value);

      if (!Number.isInteger(qty) || qty < 1 || qty > stock) {
        alert("Choose a valid quantity within the available stock.");
        return;
      }

      if (colors.length && !colorSelect.value) {
        alert("Please choose a colour.");
        return;
      }

      if (sizes.length && !sizeSelect.value) {
        alert("Please choose a size.");
        return;
      }

      const color = colorSelect?.value || "";
      const size = sizeSelect?.value || "";
      const key = product.id + "|" + color + "|" + size;
      const existing = cart.find(item => item.key === key);

      if (existing) {
        if (existing.quantity + qty > stock) {
          alert("Only " + stock + " item(s) are available.");
          return;
        }
        existing.quantity += qty;
      } else {
        cart.push({
          key,
          product_id: product.id,
          name: product.name,
          image_url:
            product.image_url || product.image || product.image_path || "",
          color,
          size,
          quantity: qty,
          unit_price: Number(product.price) || 0,
          available_stock: stock
        });
      }

      saveCart();
      add.textContent = "ADDED TO BAG";
    });

    card.appendChild(details);
    container.appendChild(card);
  });
}

async function loadCustomerProducts() {
  const message = $("catalogue-message");
  if (message) message.textContent = "Loading our collection...";

  const { data, error } = await customerDB
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products error:", error);
    showStatus("catalogue-message", "Products could not load: " + error.message, true);
    return;
  }

  allProducts = data || [];

  cart = cart.map(item => {
    const product = allProducts.find(
      product => String(product.id) === String(item.product_id)
    );

    if (!product) return item;

    return {
      ...item,
      name: product.name,
      image_url:
        product.image_url || product.image || product.image_path || "",
      unit_price: Number(product.price) || 0,
      available_stock: Number(product.stock) || 0
    };
  });

  displayProducts();
  saveCart();
}

/* ---------------- TOTALS AND CART ---------------- */

function cartTotals() {
  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * Number(item.quantity),
    0
  );

  const code = ($("discount-code")?.value || "").trim().toUpperCase();
  const discount = code === "KC10" ? subtotal * 0.10 : 0;
  const method = $("delivery-method")?.value || "delivery";
  const area = $("delivery-area")?.value || "near_shop";

  const fee = method === "pickup"
    ? 0
    : area === "near_shop" ? 200
    : area === "nairobi" ? 500
    : 800;

  return {
    subtotal,
    discount,
    fee,
    total: Math.max(0, subtotal - discount + fee),
    code,
    area,
    method
  };
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    safeText(container, "p", "Your shopping bag is empty.");
  }

  cart.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "kc-cart-line";

    const image = document.createElement("img");
    image.alt = item.name || "Product";
    const path = resolveProductImage(item.image_url);
    if (path) image.src = path;
    image.onerror = () => image.removeAttribute("src");
    row.appendChild(image);

    const info = document.createElement("div");
    safeText(info, "h3", item.name);
    if (item.color) safeText(info, "p", "Colour: " + item.color);
    if (item.size) safeText(info, "p", "Size: " + item.size);
    safeText(info, "p", money(item.unit_price) + " each");

    const label = safeText(info, "label", "Quantity ");
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(Math.max(1, Number(item.available_stock) || 1));
    quantity.value = item.quantity;
    label.appendChild(quantity);

    quantity.addEventListener("change", () => {
      const value = Number(quantity.value);
      const stock = Number(item.available_stock) || 0;

      if (!Number.isInteger(value) || value < 1 || value > stock) {
        alert("Choose a quantity within the available stock.");
        quantity.value = item.quantity;
        return;
      }

      cart[index].quantity = value;
      saveCart();
    });

    const remove = safeText(
      info,
      "button",
      "REMOVE",
      "kc-button kc-button-outline"
    );
    remove.type = "button";
    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      saveCart();
    });

    row.appendChild(info);
    container.appendChild(row);
  });

  const totals = cartTotals();

  if ($("cart-subtotal")) {
    $("cart-subtotal").textContent = money(totals.subtotal);
  }

  if ($("cart-discount")) {
    $("cart-discount").textContent = totals.discount
      ? "−" + money(totals.discount)
      : money(0);
  }

  if ($("cart-delivery")) {
    $("cart-delivery").textContent =
      totals.method === "pickup" ? "Free pickup" : money(totals.fee);
  }

  if ($("cart-total")) {
    $("cart-total").textContent = money(totals.total);
  }

  updateBagCount();
}

/* ---------------- CUSTOMER ACCOUNT ---------------- */

async function loadCustomerAccount() {
  const { data, error } = await customerDB.auth.getUser();

  if (error || !data?.user) {
    currentCustomer = null;
    return null;
  }

  currentCustomer = data.user;
  return currentCustomer;
}

function showStatus(id, message, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#b42318" : "";
}

function updateCustomerInfo() {
  if (!currentCustomer) return;

  if ($("order-email")) {
    $("order-email").value = currentCustomer.email || "";
  }

  if ($("contact-email")) {
    $("contact-email").value = currentCustomer.email || "";
  }

  const fullName = String(
    currentCustomer.user_metadata?.full_name || ""
  ).trim();

  const parts = fullName ? fullName.split(/\s+/) : [];

  if ($("order-first-name") && !$("order-first-name").value) {
    $("order-first-name").value =
      currentCustomer.user_metadata?.first_name || parts.shift() || "";
  }

  if ($("order-last-name") && !$("order-last-name").value) {
    $("order-last-name").value =
      currentCustomer.user_metadata?.last_name || parts.join(" ");
  }
}

function setMinimumDates() {
  const now = new Date();
  const today = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  ["delivery-date", "pickup-date"].forEach(id => {
    const field = $(id);
    if (!field) return;

    field.min = today;
    if (!field.value) field.value = today;
  });
}

function updateCheckoutFields() {
  const pickup = $("delivery-method")?.value === "pickup";

  if ($("delivery-fields")) $("delivery-fields").hidden = pickup;
  if ($("pickup-fields")) $("pickup-fields").hidden = !pickup;

  ["delivery-area", "delivery-location", "delivery-date", "delivery-time"]
    .forEach(id => {
      const field = $(id);
      if (!field) return;
      field.disabled = pickup;
      field.required = !pickup;
    });

  ["pickup-date", "pickup-time"].forEach(id => {
    const field = $(id);
    if (!field) return;
    field.disabled = !pickup;
    field.required = pickup;
  });

  if ($("mpesa-fields")) {
    $("mpesa-fields").hidden = $("payment-method")?.value !== "mpesa";
  }

  if ($("mpesa-phone")) {
    $("mpesa-phone").required = $("payment-method")?.value === "mpesa";
    $("mpesa-phone").disabled = $("payment-method")?.value !== "mpesa";
  }

  renderCart();
}

function normaliseKenyanPhone(value) {
  let phone = String(value || "").replace(/[\s-]/g, "");

  if (phone.startsWith("+254")) phone = "0" + phone.slice(4);
  else if (phone.startsWith("254")) phone = "0" + phone.slice(3);

  return phone;
}

function validKenyanPhone(value) {
  return /^0[17]\d{8}$/.test(normaliseKenyanPhone(value));
}

/* ---------------- ORDER HISTORY ---------------- */

async function loadMyOrders() {
  const list = $("my-orders-list");
  const status = $("my-orders-status");
  if (!list || !status) return;

  list.replaceChildren();

  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    status.textContent = "Please sign in to view your orders.";
    return;
  }

  status.textContent = "Loading your orders...";

  const { data, error } = await customerDB
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    status.textContent = "Orders could not load: " + error.message;
    return;
  }

  if (!data?.length) {
    status.textContent = "You have not placed any orders yet.";
    return;
  }

  status.textContent = data.length + " order(s) found.";

  for (const order of data) {
    const card = document.createElement("article");
    card.className = "kc-order-card";

    safeText(
      card,
      "h3",
      "Order " + String(order.id).slice(0, 8).toUpperCase()
    );

    if (order.created_at) {
      safeText(
        card,
        "p",
        "Placed: " + new Date(order.created_at).toLocaleString("en-KE")
      );
    }

    safeText(
      card,
      "p",
      "Total: " + money(order.total) +
      " · Payment: " + (order.payment_status || "unpaid") +
      " · Order status: " + (order.order_status || "Awaiting confirmation")
    );

    safeText(
      card,
      "p",
      "Preferred date: " + (order.scheduled_date || "") +
      " · Preferred time: " + (order.schedule_slot || order.delivery_time || "")
    );

    const itemStatus = safeText(card, "p", "Loading order items...");

    const result = await customerDB
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (result.error) {
      itemStatus.textContent = "Order items could not load.";
    } else {
      itemStatus.textContent = (result.data || []).map(item =>
        (item.product_name || "Product") +
        " × " + item.quantity +
        " — " + money(item.unit_price)
      ).join("; ") || "No item details.";
    }

    list.appendChild(card);
  }
}

/* ---------------- PLACE ORDER ---------------- */

async function placeOrder(event) {
  event.preventDefault();

  if (orderSubmitting) return;

  if (!cart.length) {
    showStatus("checkout-status", "Your shopping bag is empty.", true);
    return;
  }

  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    showStatus("checkout-status", "Please sign in before placing your order.", true);
    return;
  }

  const firstName = ($("order-first-name")?.value || "").trim();
  const lastName = ($("order-last-name")?.value || "").trim();
  const name = (firstName + " " + lastName).trim();
  const phone = normaliseKenyanPhone($("order-phone")?.value || "");
  const email = ($("order-email")?.value || "").trim();

  const method = $("delivery-method")?.value || "delivery";
  const payment = $("payment-method")?.value || "";
  const area = $("delivery-area")?.value || null;

  const location = method === "pickup"
    ? null
    : ($("delivery-location")?.value || "").trim();

  const dateField = method === "pickup"
    ? $("pickup-date")
    : $("delivery-date");

  const timeField = method === "pickup"
    ? $("pickup-time")
    : $("delivery-time");

  const date = String(dateField?.value || "").trim();
  const time = String(timeField?.value || "").trim();

  if (!firstName || !lastName || !phone || !email) {
    showStatus(
      "checkout-status",
      "Complete your first name, last name, phone number and email.",
      true
    );
    return;
  }

  if (!validKenyanPhone(phone)) {
    showStatus(
      "checkout-status",
      "Enter a valid Kenyan phone number, for example 0712345678.",
      true
    );
    return;
  }

  if (!payment) {
    showStatus("checkout-status", "Please choose a payment method.", true);
    return;
  }

  if (method === "delivery" && (!area || !location)) {
    showStatus(
      "checkout-status",
      "Select your delivery area and enter your delivery address.",
      true
    );
    return;
  }

  if (!date || !time) {
    showStatus(
      "checkout-status",
      "Please select your preferable delivery date and time.",
      true
    );
    return;
  }

  const now = new Date();
  const today = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  if (date < today) {
    showStatus("checkout-status", "Choose today or a future date.", true);
    return;
  }

  const totals = cartTotals();

  if (totals.code && totals.code !== "KC10") {
    showStatus(
      "checkout-status",
      "That discount code is not valid. Remove it or use KC10.",
      true
    );
    return;
  }

  let mpesaPhone = null;

  if (payment === "mpesa") {
    mpesaPhone = normaliseKenyanPhone($("mpesa-phone")?.value || "");

    if (!validKenyanPhone(mpesaPhone)) {
      showStatus(
        "checkout-status",
        "Enter a valid Kenyan M-Pesa phone number.",
        true
      );
      return;
    }
  }

  const button = $("place-order-button");
  orderSubmitting = true;
  if (button) button.disabled = true;

  let orderCreated = false;

  try {
    showStatus("checkout-status", "Checking stock and placing your order...");

    for (const item of cart) {
      const { data, error } = await customerDB
        .from("products")
        .select("id,name,stock,active,price")
        .eq("id", item.product_id)
        .maybeSingle();

      if (error) throw error;

      if (!data || data.active === false) {
        throw new Error(item.name + " is no longer available.");
      }

      if (Number(data.stock) < Number(item.quantity)) {
        throw new Error("Insufficient stock for " + item.name + ".");
      }

      if (Number(data.price) !== Number(item.unit_price)) {
        throw new Error("The price of " + item.name + " has changed. Refresh your bag.");
      }
    }

    const fee = method === "pickup"
      ? 0
      : area === "near_shop" ? 200
      : area === "nairobi" ? 500
      : 800;

    const total = Math.max(
      0,
      totals.subtotal - totals.discount + fee
    );

    /*
      IMPORTANT:
      Use the exact order table columns.
      scheduled_date receives the selected date.
      schedule_slot receives the selected time.
    */
    const orderPayload = {
      customer_id: user.id,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,
      fulfillment_type: method,
      delivery_area: method === "pickup" ? null : area,
      delivery_address: location,
      delivery_fee: fee,
      scheduled_date: date,
      schedule_slot: time,
      subtotal: totals.subtotal,
      discount_code: totals.discount ? totals.code : null,
      discount_amount: totals.discount,
      total: total,
      payment_method: payment,
      payment_status: "unpaid",
      mpesa_phone: mpesaPhone,
      order_status: "awaiting_confirmation"
    };

    console.log("Submitting order date:", date);
    console.log("Submitting order time:", time);
    console.log("Order data:", orderPayload);

    const { data: order, error: orderError } = await customerDB
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError) throw orderError;

    orderCreated = true;

    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.name,
      size: item.size || null,
      color: item.color || null,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.unit_price) * Number(item.quantity)
    }));

    const { error: itemsError } = await customerDB
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      throw new Error(
        "The order was created, but its item details could not be saved: " +
        itemsError.message
      );
    }

    const reference = String(order.id).slice(0, 8).toUpperCase();

    cart = [];
    saveCart();

    $("checkout-form")?.reset();
    setMinimumDates();
    updateCheckoutFields();
    updateCustomerInfo();

    showStatus(
      "checkout-status",
      "Order placed successfully! Reference: " + reference +
      ". Payment remains unpaid until verified."
    );

    await loadMyOrders();

  } catch (error) {
    console.error("Order placement error:", error);

    showStatus(
      "checkout-status",
      (orderCreated
        ? "Your order was created, but another step failed: "
        : "Order could not be placed: ") + error.message,
      true
    );

  } finally {
    orderSubmitting = false;
    if (button) button.disabled = false;
  }
}

/* ---------------- CHECKOUT EVENTS ---------------- */

$("category-filter")?.addEventListener("change", displayProducts);
$("delivery-method")?.addEventListener("change", updateCheckoutFields);
$("delivery-area")?.addEventListener("change", renderCart);
$("discount-code")?.addEventListener("input", renderCart);
$("payment-method")?.addEventListener("change", updateCheckoutFields);

$("checkout-toggle")?.addEventListener("click", () => {
  const form = $("checkout-form");

  if (!form) return;

  if (!cart.length) {
    showStatus("checkout-status", "Add a product before checking out.", true);
    return;
  }

  form.hidden = false;
  form.style.display = "block";
  updateCheckoutFields();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("back-to-bag")?.addEventListener("click", () => {
  const form = $("checkout-form");
  if (form) {
    form.hidden = true;
    form.style.display = "none";
  }

  $("shopping-bag")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

$("checkout-form")?.addEventListener("submit", placeOrder);

/* ---------------- CONTACT FORM ---------------- */

$("customer-contact-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const status = $("contact-status");
  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    if (status) status.textContent = "Please sign in before sending a message.";
    return;
  }

  const message = ($("contact-message")?.value || "").trim();

  if (!message) {
    if (status) status.textContent = "Please enter your message.";
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  if (status) status.textContent = "Sending your message...";

  try {
    const { error } = await customerDB.from("messages").insert({
      customer_name: $("contact-name")?.value.trim() || "",
      customer_email: user.email,
      subject: "Customer enquiry",
      message
    });

    if (error) throw error;

    event.currentTarget.reset();
    updateCustomerInfo();

    if (status) status.textContent = "Your message was sent successfully.";
    await loadCustomerMessages();

  } catch (error) {
    console.error("Contact message error:", error);
    if (status) status.textContent = "Could not send message: " + error.message;
  } finally {
    if (button) button.disabled = false;
  }
});

/* ---------------- CUSTOMER MESSAGES ---------------- */

async function loadCustomerMessages() {
  const form = $("customer-contact-form");
  if (!form) return;

  let section = $("customer-messages-section");

  if (!section) {
    section = document.createElement("section");
    section.id = "customer-messages-section";
    section.className = "kc-section";

    section.innerHTML =
      '<div class="kc-section-inner">' +
      '<h2 class="kc-section-heading">MY MESSAGES</h2>' +
      '<p id="customer-messages-status"></p>' +
      '<div id="customer-messages-list"></div>' +
      '</div>';

    form.insertAdjacentElement("afterend", section);
  }

  const user = currentCustomer || await loadCustomerAccount();
  const list = $("customer-messages-list");
  const status = $("customer-messages-status");

  if (!list || !status) return;

  if (!user) {
    status.textContent = "Sign in to view your messages.";
    return;
  }

  const { data, error } = await customerDB
    .from("messages")
    .select("id,subject,message,created_at,reply,replied_at")
    .eq("customer_email", user.email)
    .order("created_at", { ascending: false });

  list.replaceChildren();

  if (error) {
    status.textContent = "Messages unavailable: " + error.message;
    return;
  }

  status.textContent = data?.length
    ? data.length + " message(s)"
    : "No messages yet.";

  (data || []).forEach(message => {
    const card = document.createElement("article");
    card.className = "kc-order-card";

    safeText(card, "h3", message.subject || "Enquiry");
    safeText(card, "p", message.message || "");
    safeText(
      card,
      "p",
      message.reply
        ? "Owner reply: " + message.reply
        : "Awaiting owner reply."
    );

    list.appendChild(card);
  });
}

/* ---------------- SIGN OUT ---------------- */

$("customer-signout")?.addEventListener("click", async () => {
  const button = $("customer-signout");
  if (button) button.disabled = true;

  const { error } = await customerDB.auth.signOut();

  if (error) {
    if (button) button.disabled = false;
    alert("Could not sign out: " + error.message);
    return;
  }

  window.location.replace("index.html");
});

/* ---------------- START CUSTOMER PAGE ---------------- */

async function loadCustomerPage() {
  await loadCustomerAccount();

  updateCustomerInfo();
  setMinimumDates();
  updateCheckoutFields();

  await loadCustomerProducts();
  renderCart();
  await loadMyOrders();
  await loadCustomerMessages();
}

loadCustomerPage().catch(error => {
  console.error("Customer page error:", error);
  showStatus(
    "catalogue-message",
    "The shopping page could not finish loading. Refresh and try again.",
    true
  );
});

window.addEventListener("focus", () => {
  loadCustomerProducts();
  loadMyOrders();
});

customerDB
  .channel("customer-product-updates")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products"
    },
    loadCustomerProducts
  )
  .subscribe();
