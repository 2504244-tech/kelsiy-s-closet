
"use strict";

/* =========================================================
   KELSIY'S CLOSET — CUSTOMER SHOPPING SYSTEM
   HTML file: customer.html
   JavaScript file: customer.js
   Backend: Supabase
   ========================================================= */

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

let allProducts = [];
let currentCustomer = null;
let cart = [];
let orderSubmitting = false;

/* =========================================================
   SHOPPING BAG
   ========================================================= */

try {
  cart = JSON.parse(localStorage.getItem("kc-shopping-cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

function safeText(parent, tag, value, className = "") {
  const element = document.createElement(tag);
  element.textContent = value == null ? "" : String(value);

  if (className) element.className = className;

  parent.appendChild(element);
  return element;
}

function showStatus(id, message, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#b42318" : "";
}

function updateBagCount() {
  const count = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if ($("bag-count")) {
    $("bag-count").textContent = count;
  }
}

function saveCart() {
  localStorage.setItem("kc-shopping-cart", JSON.stringify(cart));
  updateBagCount();
  renderCart();
}

function resolveProductImage(value) {
  const image = String(value || "").trim();

  if (!image) return "";

  if (/^(https?:|data:|blob:)/i.test(image)) {
    return image;
  }

  return image.startsWith("image/")
    ? image
    : "image/" + image.replace(/^\.?\//, "");
}

function parseOptions(value) {
  return String(value || "")
    .split(/[,;|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function makeSelect(options, label) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);

  options.forEach(option => {
    select.add(new Option(option, option));
  });

  return select;
}

/* =========================================================
   PRODUCTS AND CATEGORIES
   ========================================================= */

function productImage(product) {
  const image = document.createElement("img");

  image.className = "customer-product-image";
  image.alt = product.name || "Fashion product";
  image.loading = "lazy";

  const source = resolveProductImage(
    product.image_url || product.image || product.image_path
  );

  if (source) image.src = source;

  image.onerror = () => {
    image.removeAttribute("src");
    image.alt = "Product image unavailable";
  };

  return image;
}

function populateCategories() {
  const filter = $("category-filter");
  if (!filter) return;

  const currentValue = filter.value || "all";

  const categories = [
    ...new Set(
      allProducts
        .map(product => String(product.category || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  filter.replaceChildren();
  filter.add(new Option("All Categories", "all"));

  categories.forEach(category => {
    filter.add(new Option(category, category.toLowerCase()));
  });

  const matchingOption = [...filter.options].find(
    option => option.value === currentValue
  );

  filter.value = matchingOption ? currentValue : "all";
}

function displayProducts() {
  const container = $("customer-products");
  const message = $("catalogue-message");

  if (!container || !message) return;

  container.replaceChildren();

  const selectedCategory = (
    $("category-filter")?.value || "all"
  ).toLowerCase();

  const products = allProducts.filter(product => {
    return selectedCategory === "all" ||
      String(product.category || "").toLowerCase() === selectedCategory;
  });

  if (!products.length) {
    message.textContent = allProducts.length
      ? "There are no products in this category yet."
      : "No active products are available yet.";

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

    if (product.category) {
      safeText(details, "p", "Category: " + product.category);
    }

    const stock = Math.max(0, Number(product.stock) || 0);

    safeText(
      details,
      "p",
      stock ? stock + " item(s) available" : "SOLD OUT",
      "customer-product-stock" + (stock ? "" : " out-of-stock")
    );

    const options = document.createElement("div");
    options.className = "kc-product-options";

    const colors = parseOptions(product.color || product.colour);
    const sizes = parseOptions(product.size);

    let colorSelect = null;
    let sizeSelect = null;

    if (colors.length) {
      const label = safeText(options, "label", "Choose colour");
      colorSelect = makeSelect(colors, "Colour");
      label.appendChild(colorSelect);
    }

    if (sizes.length) {
      const label = safeText(options, "label", "Choose size");
      sizeSelect = makeSelect(sizes, "Size");
      label.appendChild(sizeSelect);
    }

    const quantityLabel = safeText(options, "label", "Quantity");

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(stock);
    quantity.value = "1";
    quantity.disabled = stock < 1;

    quantityLabel.appendChild(quantity);
    details.appendChild(options);

    const addButton = safeText(
      details,
      "button",
      stock ? "ADD TO BAG" : "SOLD OUT",
      "kc-button kc-add-button"
    );

    addButton.type = "button";
    addButton.disabled = stock < 1;

    addButton.addEventListener("click", () => {
      const amount = Number(quantity.value);

      if (!Number.isInteger(amount) || amount < 1 || amount > stock) {
        alert("Choose a quantity between 1 and " + stock + ".");
        return;
      }

      const color = colorSelect ? colorSelect.value : "";
      const size = sizeSelect ? sizeSelect.value : "";

      const key = String(product.id) + "|" + color + "|" + size;
      const existing = cart.find(item => item.key === key);

      if (existing) {
        if (existing.quantity + amount > stock) {
          alert("Only " + stock + " item(s) are currently available.");
          return;
        }

        existing.quantity += amount;
      } else {
        cart.push({
          key,
          product_id: product.id,
          name: product.name,
          image_url:
            product.image_url || product.image || product.image_path || "",
          color,
          size,
          quantity: amount,
          unit_price: Number(product.price) || 0,
          available_stock: stock
        });
      }

      saveCart();
      addButton.textContent = "ADDED TO BAG";
    });

    card.appendChild(details);
    container.appendChild(card);
  });
}

async function loadCustomerProducts() {
  const message = $("catalogue-message");
  if (!message) return;

  message.textContent = "Loading our collection...";

  try {
    const { data, error } = await customerDB
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allProducts = data || [];

    cart = cart.map(item => {
      const product = allProducts.find(
        entry => String(entry.id) === String(item.product_id)
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

    populateCategories();
    displayProducts();
    saveCart();
  } catch (error) {
    console.error("Products loading error:", error);
    message.textContent = "Products could not load: " + error.message;
  }
}

/* =========================================================
   CART TOTALS AND DISPLAY
   ========================================================= */

function cartTotals() {
  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * Number(item.quantity),
    0
  );

  const code = ($("discount-code")?.value || "")
    .trim()
    .toUpperCase();

  const discount = code === "KC10" ? subtotal * 0.10 : 0;

  const method = $("delivery-method")?.value || "pickup";
  const area = $("delivery-area")?.value || "";

  let fee = 0;

  if (method === "delivery") {
    if (area === "near_shop") fee = 200;
    else if (area === "nairobi") fee = 500;
    else if (area === "countrywide") fee = 700;
  }

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
    safeText(
      container,
      "p",
      "Your bag is empty. Add products from Our Collection to begin.",
      "kc-empty"
    );
  }

  cart.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "kc-cart-line";

    const image = document.createElement("img");
    image.alt = item.name || "Product";

    const source = resolveProductImage(item.image_url);
    if (source) image.src = source;

    image.onerror = () => image.removeAttribute("src");
    row.appendChild(image);

    const info = document.createElement("div");

    safeText(info, "h3", item.name || "Fashion item");

    if (item.color) safeText(info, "p", "Colour: " + item.color);
    if (item.size) safeText(info, "p", "Size: " + item.size);

    safeText(info, "p", money(item.unit_price) + " each");

    const quantityLabel = safeText(info, "label", "Quantity ");

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(Math.max(1, item.available_stock || 1));
    quantity.value = item.quantity;

    quantityLabel.appendChild(quantity);

    quantity.addEventListener("change", () => {
      const value = Number(quantity.value);
      const stock = Number(item.available_stock) || 0;

      if (!Number.isInteger(value) || value < 1 || value > stock) {
        alert("Quantity must be between 1 and the available stock (" + stock + ").");
        quantity.value = item.quantity;
        return;
      }

      cart[index].quantity = value;
      saveCart();
    });

    const removeButton = safeText(
      info,
      "button",
      "REMOVE",
      "kc-button kc-button-outline remove-item"
    );

    removeButton.type = "button";

    removeButton.addEventListener("click", () => {
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
      ? "−" + money(totals.discount) + " (KC10)"
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

/* =========================================================
   CUSTOMER ACCOUNT
   ========================================================= */

async function loadCustomerAccount() {
  const { data, error } = await customerDB.auth.getUser();

  if (error || !data?.user) {
    currentCustomer = null;
    return null;
  }

  currentCustomer = data.user;
  return currentCustomer;
}

function updateCustomerInfo() {
  if (!currentCustomer) return;

  if ($("order-email")) {
    $("order-email").value = currentCustomer.email || "";
  }

  if ($("contact-email")) {
    $("contact-email").value = currentCustomer.email || "";
  }

  if ($("contact-name")) {
    $("contact-name").value =
      currentCustomer.user_metadata?.full_name || "";
  }

  if ($("order-first-name")) {
    $("order-first-name").value =
      currentCustomer.user_metadata?.first_name || "";
  }

  if ($("order-last-name")) {
    $("order-last-name").value =
      currentCustomer.user_metadata?.last_name || "";
  }
}

/* =========================================================
   CHECKOUT FORM
   ========================================================= */

function setMinimumDates() {
  const now = new Date();

  const today = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  ["delivery-date", "pickup-date"].forEach(id => {
    const field = $(id);

    if (field) {
      field.min = today;
      if (!field.value) field.value = today;
    }
  });
}

function updateCheckoutFields() {
  const pickup = $("delivery-method")?.value === "pickup";

  if ($("delivery-fields")) {
    $("delivery-fields").hidden = pickup;
  }

  if ($("pickup-fields")) {
    $("pickup-fields").hidden = !pickup;
  }

  if ($("delivery-location")) {
    $("delivery-location").required = !pickup;
  }

  if ($("delivery-area")) {
    $("delivery-area").required = !pickup;
  }

  if ($("delivery-date")) {
    $("delivery-date").required = !pickup;
  }

  if ($("delivery-time")) {
    $("delivery-time").required = !pickup;
  }

  if ($("pickup-date")) {
    $("pickup-date").required = pickup;
  }

  if ($("pickup-time")) {
    $("pickup-time").required = pickup;
  }

  const mpesaSelected = $("payment-method")?.value === "mpesa";

  if ($("mpesa-fields")) {
    $("mpesa-fields").hidden = !mpesaSelected;
  }

  if ($("mpesa-phone")) {
    $("mpesa-phone").required = mpesaSelected;
  }

  renderCart();
}

function openCheckout() {
  if (!cart.length) {
    showStatus(
      "checkout-status",
      "Your bag is empty. Add a product before checking out.",
      true
    );
    return;
  }

  const form = $("checkout-form");
  if (!form) return;

  form.hidden = false;
  form.removeAttribute("hidden");
  form.style.display = "block";

  updateCheckoutFields();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCheckout() {
  const form = $("checkout-form");
  if (!form) return;

  form.hidden = true;
  form.style.display = "none";

  $("shopping-bag")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function normaliseKenyanPhone(value) {
  let phone = String(value || "").replace(/[\s-]/g, "");

  if (phone.startsWith("+254")) {
    phone = "0" + phone.slice(4);
  } else if (phone.startsWith("254")) {
    phone = "0" + phone.slice(3);
  }

  return phone;
}

function validKenyanPhone(value) {
  return /^0[17]\d{8}$/.test(normaliseKenyanPhone(value));
}

function selectedOrderDetails() {
  const method = $("delivery-method")?.value || "pickup";
  const payment = $("payment-method")?.value || "";
  const area = $("delivery-area")?.value || "";

  const location = method === "pickup"
    ? "Shop pickup"
    : ($("delivery-location")?.value || "").trim();

  const date = method === "pickup"
    ? $("pickup-date")?.value || ""
    : $("delivery-date")?.value || "";

  const time = method === "pickup"
    ? $("pickup-time")?.value || ""
    : $("delivery-time")?.value || "";

  return { method, payment, area, location, date, time };
}

function validateCheckout(details) {
  const firstName = ($("order-first-name")?.value || "").trim();
  const lastName = ($("order-last-name")?.value || "").trim();
  const phone = ($("order-phone")?.value || "").trim();
  const email = ($("order-email")?.value || "").trim();

  if (!firstName || !lastName || !phone || !email) {
    throw new Error("Please complete all customer details.");
  }

  if (!validKenyanPhone(phone)) {
    throw new Error(
      "Enter a valid Kenyan phone number, for example 0712345678 or 0112345678."
    );
  }

  if (!details.payment) {
    throw new Error("Please choose a payment method.");
  }

  if (details.method === "delivery") {
    if (!details.area) {
      throw new Error("Please choose your delivery area.");
    }

    if (!details.location) {
      throw new Error("Please enter your full delivery address.");
    }
  }

  if (!details.date || !details.time) {
    throw new Error("Please select your preferred date and time.");
  }

  const now = new Date();
  const today = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  if (details.date < today) {
    throw new Error("Please choose today or a future date.");
  }

  if (details.payment === "mpesa") {
    const mpesaPhone = $("mpesa-phone")?.value.trim() || "";

    if (!validKenyanPhone(mpesaPhone)) {
      throw new Error(
        "Enter a valid Kenyan M-Pesa phone number."
      );
    }
  }

  if (!cart.length) {
    throw new Error("Your bag is empty.");
  }
}

/* =========================================================
   ORDER HISTORY
   ========================================================= */

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

  try {
    const { data, error } = await customerDB
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

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
        " · Payment: " + (order.payment_method || "Not specified") +
        " · Status: " + (order.payment_status || "pending")
      );

      safeText(
        card,
        "p",
        "Order status: " + (order.order_status || "Awaiting confirmation")
      );

      const orderDate =
        order.scheduled_date_of_delivery ||
        order.schedule_date ||
        order.delivery_date ||
        "";

      const orderTime =
        order.schedule_slot ||
        order.delivery_time ||
        "";

      const fulfillment =
        order.fulfillment_type || order.delivery_method || "delivery";

      safeText(
        card,
        "p",
        (fulfillment === "pickup" ? "Pickup" : "Delivery") +
        ": " + (order.delivery_address || order.delivery_location || "Shop pickup") +
        " · " + orderDate + " " + orderTime
      );

      const itemLine = safeText(card, "p", "Loading items...");

      const result = await customerDB
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      if (result.error) {
        itemLine.textContent = "Items could not load: " + result.error.message;
      } else {
        itemLine.textContent = (result.data || []).map(item =>
          (item.product_name || "Product") +
          (item.color || item.colour ? " (" + (item.color || item.colour) + ")" : "") +
          (item.size ? " / " + item.size : "") +
          " × " + item.quantity + " — " + money(item.unit_price)
        ).join("; ") || "No item details.";
      }

      list.appendChild(card);
    }
  } catch (error) {
    console.error("Order history error:", error);
    status.textContent = "Orders could not load: " + error.message;
  }
}

/* =========================================================
   PLACE ORDER — REQUIRED DATABASE DATE INCLUDED
   ========================================================= */

async function placeOrder(event) {
  event.preventDefault();

  if (orderSubmitting) return;

  if (!cart.length) {
    showStatus(
      "checkout-status",
      "Your bag is empty. Add at least one product first.",
      true
    );
    return;
  }

  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    showStatus(
      "checkout-status",
      "Please sign in to your customer account before placing an order.",
      true
    );
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

  const firstName = ($("order-first-name")?.value || "").trim();
  const lastName = ($("order-last-name")?.value || "").trim();
  const name = (firstName + " " + lastName).trim();

  const phone = normaliseKenyanPhone(
    $("order-phone")?.value || ""
  );

  const email = ($("order-email")?.value || "").trim();
  const details = selectedOrderDetails();

  try {
    validateCheckout(details);
  } catch (error) {
    showStatus("checkout-status", error.message, true);
    return;
  }

  const button = $("place-order-button");
  orderSubmitting = true;

  if (button) button.disabled = true;

  showStatus("checkout-status", "Checking stock and saving your order...");

  let orderCreated = false;

  try {
    /* Confirm stock before creating the order. */
    for (const item of cart) {
      const { data, error } = await customerDB
        .from("products")
        .select("id,name,stock,active,price")
        .eq("id", item.product_id)
        .maybeSingle();

      if (error) throw error;

      if (!data || data.active === false) {
        throw new Error(
          "The product " + item.name + " is no longer available."
        );
      }

      if (Number(data.stock) < Number(item.quantity)) {
        throw new Error(
          "There is not enough stock for " + item.name +
          ". Please update your bag."
        );
      }

      if (Number(data.price) !== Number(item.unit_price)) {
        throw new Error(
          "The price of " + item.name +
          " has changed. Refresh the page and review your bag."
        );
      }
    }

    let fee = 0;

    if (details.method === "delivery") {
      if (details.area === "near_shop") fee = 200;
      else if (details.area === "nairobi") fee = 500;
      else if (details.area === "countrywide") fee = 700;
    }

    const total = Math.max(
      0,
      totals.subtotal - totals.discount + fee
    );

    const mpesaPhone = details.payment === "mpesa"
      ? normaliseKenyanPhone($("mpesa-phone")?.value || "")
      : null;

    /*
      IMPORTANT:
      scheduled_date_of_delivery is included because your
      orders table requires that column to have a value.
    */
    const orderPayload = {
      customer_id: user.id,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,

      fulfillment_type: details.method,
      delivery_method: details.method,
      delivery_area: details.method === "pickup"
        ? "pickup"
        : details.area,

      delivery_fee: fee,
      subtotal: totals.subtotal,
      discount_code: totals.discount ? totals.code : null,
      discount_amount: totals.discount,
      total: total,

      payment_method: details.payment,
      payment_status: "unpaid",
      mpesa_phone: mpesaPhone,

      delivery_address: details.location,
      delivery_location: details.location,

      /* Required database date plus existing date fields */
      scheduled_date_of_delivery: details.date,
      schedule_date: details.date,
      schedule_slot: details.time,
      delivery_date: details.date,
      delivery_time: details.time,

      order_status: "awaiting_confirmation",
      order_notes: ($("order-notes")?.value || "").trim() || null
    };

    const { data: order, error: orderError } = await customerDB
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError) throw orderError;

    orderCreated = true;

    /* Save each product in the order_items table. */
    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_id: String(item.product_id),
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
        "Order reference " +
        String(order.id).slice(0, 8).toUpperCase() +
        " was created, but the product details could not be saved. " +
        itemsError.message
      );
    }

    const reference = String(order.id).slice(0, 8).toUpperCase();

    const receipt = cart.map(item =>
      item.name +
      (item.color ? " (" + item.color + ")" : "") +
      (item.size ? " / " + item.size : "") +
      " × " + item.quantity
    ).join("; ");

    /* Clear the bag only after both database inserts succeed. */
    cart = [];
    saveCart();

    $("checkout-form")?.reset();

    setMinimumDates();
    updateCustomerInfo();
    updateCheckoutFields();

    showStatus(
      "checkout-status",
      "Order placed successfully! Reference: " + reference +
      ". Items: " + receipt +
      ". Your order is awaiting confirmation. Payment is unpaid until verified."
    );

    await loadMyOrders();

    $("my-orders")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    console.error("Order placement error:", error);

    const message = orderCreated
      ? "Your order was created, but saving the remaining details failed. "
      : "Order could not be placed. ";

    showStatus(
      "checkout-status",
      message + (error.message || "An unexpected error occurred."),
      true
    );
  } finally {
    orderSubmitting = false;
    if (button) button.disabled = false;
  }
}

/* =========================================================
   CUSTOMER CONTACT MESSAGES
   ========================================================= */

async function sendCustomerMessage(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = $("contact-status");
  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    if (status) {
      status.textContent = "Please sign in before sending a message.";
    }
    return;
  }

  const button = form.querySelector('button[type="submit"]');

  if (button) button.disabled = true;
  if (status) status.textContent = "Sending your message...";

  try {
    const { error } = await customerDB
      .from("messages")
      .insert({
        customer_name: ($("contact-name")?.value || "").trim(),
        customer_email: user.email,
        subject: "Customer enquiry",
        message: ($("contact-message")?.value || "").trim()
      });

    if (error) throw error;

    form.reset();
    updateCustomerInfo();

    if (status) {
      status.textContent = "Your message was sent successfully.";
    }

    await loadCustomerMessages();

  } catch (error) {
    console.error("Contact message error:", error);

    if (status) {
      status.textContent = "Could not send message: " + error.message;
    }
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadCustomerMessages() {
  const form = $("customer-contact-form");
  if (!form) return;

  let section = $("customer-messages-section");

  if (!section) {
    section = document.createElement("section");
    section.id = "customer-messages-section";
    section.className = "section";

    section.innerHTML = `
      <div class="section-heading">
        <h2>My Messages</h2>
        <p id="customer-messages-status" role="status"></p>
      </div>
      <div id="customer-messages-list" class="order-list"></div>
    `;

    form.insertAdjacentElement("afterend", section);
  }

  const user = currentCustomer || await loadCustomerAccount();
  const list = $("customer-messages-list");
  const status = $("customer-messages-status");

  if (!list || !status) return;

  list.replaceChildren();

  if (!user) {
    status.textContent = "Sign in to view your messages.";
    return;
  }

  try {
    const { data, error } = await customerDB
      .from("messages")
      .select("id,subject,message,created_at,reply,replied_at")
      .eq("customer_email", user.email)
      .order("created_at", { ascending: false });

    if (error) throw error;

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

  } catch (error) {
    console.error("Customer messages error:", error);
    status.textContent = "Messages unavailable: " + error.message;
  }
}

/* =========================================================
   SIGN OUT
   ========================================================= */

async function signOutCustomer() {
  const button = $("customer-signout");

  if (button) button.disabled = true;

  try {
    const { error } = await customerDB.auth.signOut();

    if (error) throw error;

    window.location.replace("index.html");

  } catch (error) {
    console.error("Sign-out error:", error);

    alert("Could not sign out: " + error.message);

    if (button) button.disabled = false;
  }
}

/* =========================================================
   INITIALISE CUSTOMER PAGE
   ========================================================= */

function connectCustomerEvents() {
  $("category-filter")?.addEventListener("change", displayProducts);

  $("delivery-method")?.addEventListener(
    "change",
    updateCheckoutFields
  );

  $("delivery-area")?.addEventListener("change", renderCart);

  $("discount-code")?.addEventListener("input", renderCart);

  $("payment-method")?.addEventListener(
    "change",
    updateCheckoutFields
  );

  $("checkout-toggle")?.addEventListener("click", openCheckout);

  $("back-to-bag")?.addEventListener("click", closeCheckout);

  $("checkout-form")?.addEventListener("submit", placeOrder);

  $("customer-contact-form")?.addEventListener(
    "submit",
    sendCustomerMessage
  );

  $("customer-signout")?.addEventListener(
    "click",
    signOutCustomer
  );
}

async function loadCustomerPage() {
  connectCustomerEvents();

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
  console.error("Customer page initialisation error:", error);

  showStatus(
    "catalogue-message",
    "The shopping page could not finish loading. Refresh and try again.",
    true
  );
});

/* Refresh product and order information when the customer returns. */
window.addEventListener("focus", () => {
  loadCustomerProducts();
  loadMyOrders();
});

/* Keep the catalogue updated when products change in Supabase. */
customerDB
  .channel("customer-product-updates")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products"
    },
    () => loadCustomerProducts()
  )
  .subscribe();
