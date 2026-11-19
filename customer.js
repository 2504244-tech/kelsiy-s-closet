"use strict";

const CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";
const customerDB = window.supabase.createClient(CUSTOMER_SUPABASE_URL, CUSTOMER_SUPABASE_KEY);

const $ = id => document.getElementById(id);
const money = n => "KSh " + Number(n || 0).toLocaleString("en-KE", {maximumFractionDigits: 2});
const safeText = (parent, tag, text, cls) => {
  const node = document.createElement(tag);
  node.textContent = text == null ? "" : String(text);
  if (cls) node.className = cls;
  parent.appendChild(node);
  return node;
};

let allProducts = [];
let currentCustomer = null;
let cart = [];

try {
  cart = JSON.parse(localStorage.getItem("kc-shopping-cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

function saveCart() {
  localStorage.setItem("kc-shopping-cart", JSON.stringify(cart));
  updateBagCount();
  renderCart();
}

function updateBagCount() {
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if ($("bag-count")) $("bag-count").textContent = count;
}

function resolveProductImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return raw.startsWith("image/") ? raw : "image/" + raw.replace(/^\.\//, "");
}

function parseOptions(value) {
  return String(value || "").split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}

function makeSelect(options, label, selected) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  if (!options.length) options = ["Not specified"];
  options.forEach(value => select.add(new Option(value, value)));
  if (selected && options.includes(selected)) select.value = selected;
  return select;
}

function productImage(product) {
  const img = document.createElement("img");
  img.className = "customer-product-image";
  img.alt = product.name || "Fashion product";
  img.loading = "lazy";
  const src = resolveProductImage(product.image_url || product.image || product.image_path);
  if (src) img.src = src;
  img.onerror = () => {
    img.removeAttribute("src");
    img.alt = "Product image unavailable";
  };
  return img;
}

function displayProducts() {
  const container = $("customer-products");
  const message = $("catalogue-message");
  if (!container || !message) return;

  container.replaceChildren();
  const selected = ($("category-filter")?.value || "all").toLowerCase();
  const products = allProducts.filter(p =>
    selected === "all" || String(p.category || "").toLowerCase() === selected
  );

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
    if (product.description) safeText(details, "p", product.description);
    if (product.category) safeText(details, "p", "Category: " + product.category);

    const stock = Math.max(0, Number(product.stock) || 0);
    safeText(
      details, "p",
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
    quantity.max = String(Math.max(1, stock));
    quantity.value = "1";
    quantity.disabled = stock < 1;
    quantityLabel.appendChild(quantity);
    details.appendChild(options);

    const add = safeText(
      details, "button", stock ? "ADD TO BAG" : "SOLD OUT",
      "kc-button kc-add-button"
    );
    add.type = "button";
    add.disabled = stock < 1;

    add.addEventListener("click", () => {
      const qty = Number(quantity.value);
      if (!Number.isInteger(qty) || qty < 1 || qty > stock) {
        alert("Please choose a quantity between 1 and " + stock + ".");
        return;
      }

      const color = colorSelect ? colorSelect.value : "";
      const size = sizeSelect ? sizeSelect.value : "";
      const key = product.id + "|" + color + "|" + size;
      const existing = cart.find(i => i.key === key);

      if (existing) {
        if (existing.quantity + qty > stock) {
          alert("Only " + stock + " item(s) are currently available.");
          return;
        }
        existing.quantity += qty;
      } else {
        cart.push({
          key,
          product_id: product.id,
          name: product.name,
          image_url: product.image_url || product.image || product.image_path || "",
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
  if (!message) return;

  message.textContent = "Loading our collection...";

  const {data, error} = await customerDB.from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", {ascending: false});

  if (error) {
    console.error("Products error:", error);
    message.textContent = "Products could not load: " + error.message;
    return;
  }

  allProducts = data || [];

  cart = cart.map(item => {
    const p = allProducts.find(x => String(x.id) === String(item.product_id));
    return p ? {
      ...item,
      name: p.name,
      image_url: p.image_url || p.image || p.image_path || "",
      unit_price: Number(p.price) || 0,
      available_stock: Number(p.stock) || 0
    } : item;
  });

  displayProducts();
  saveCart();
}

function cartTotals() {
  const subtotal = cart.reduce(
    (sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0
  );
  const code = ($("discount-code")?.value || "").trim().toUpperCase();
  const discount = code === "KC10" ? subtotal * 0.10 : 0;
  const method = $("delivery-method")?.value || "delivery";
  const area = $("delivery-area")?.value || "near_shop";

  let fee = 0;
  if (method === "delivery") {
    fee = area === "near_shop" ? 200 : area === "nairobi" ? 500 : 800;
  }

  return {subtotal, discount, fee, total: Math.max(0, subtotal - discount + fee), code, area, method};
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    safeText(container, "p", "Your bag is empty. Add products from Our Collection to begin.", "kc-empty");
  }

  cart.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "kc-cart-line";

    const img = document.createElement("img");
    img.alt = item.name || "Product";
    const src = resolveProductImage(item.image_url);
    if (src) img.src = src;
    img.onerror = () => img.removeAttribute("src");
    row.appendChild(img);

    const info = document.createElement("div");
    safeText(info, "h3", item.name);
    if (item.color) safeText(info, "p", "Colour: " + item.color);
    if (item.size) safeText(info, "p", "Size: " + item.size);
    safeText(info, "p", money(item.unit_price) + " each");

    const qtyLabel = safeText(info, "label", "Quantity ");
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.max = String(Math.max(1, item.available_stock || 1));
    qty.value = item.quantity;
    qtyLabel.appendChild(qty);

    qty.addEventListener("change", () => {
      const value = Number(qty.value);
      const stock = Number(item.available_stock) || 0;
      if (!Number.isInteger(value) || value < 1 || value > stock) {
        alert("Quantity must be between 1 and the available stock (" + stock + ").");
        qty.value = item.quantity;
        return;
      }
      cart[index].quantity = value;
      saveCart();
    });

    const remove = safeText(info, "button", "REMOVE", "kc-button kc-button-outline");
    remove.type = "button";
    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      saveCart();
    });

    row.appendChild(info);
    container.appendChild(row);
  });

  const totals = cartTotals();
  if ($("cart-subtotal")) $("cart-subtotal").textContent = money(totals.subtotal);
  if ($("cart-discount")) $("cart-discount").textContent = totals.discount ? "−" + money(totals.discount) + " (KC10)" : money(0);
  if ($("cart-delivery")) $("cart-delivery").textContent = totals.method === "pickup" ? "Free pickup" : money(totals.fee);
  if ($("cart-total")) $("cart-total").textContent = money(totals.total);
  updateBagCount();
}

async function loadCustomerAccount() {
  const {data, error} = await customerDB.auth.getUser();
  if (error || !data?.user) {
    currentCustomer = null;
    return null;
  }
  currentCustomer = data.user;
  return currentCustomer;
}

function showStatus(id, text, isError = false) {
  const element = $(id);
  if (element) {
    element.textContent = text;
    element.style.color = isError ? "#b42318" : "";
  }
}

function setMinimumDates() {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  ["delivery-date", "pickup-date"].forEach(id => {
    const element = $(id);
    if (element) {
      element.min = today;
      if (!element.value) element.value = today;
    }
  });
}

function updateCheckoutFields() {
  const pickup = $("delivery-method")?.value === "pickup";
  if ($("delivery-fields")) $("delivery-fields").hidden = pickup;
  if ($("pickup-fields")) $("pickup-fields").hidden = !pickup;
  if ($("delivery-location")) $("delivery-location").required = !pickup;
  if ($("delivery-date")) $("delivery-date").required = !pickup;
  if ($("delivery-time")) $("delivery-time").required = !pickup;
  if ($("pickup-date")) $("pickup-date").required = pickup;
  if ($("pickup-time")) $("pickup-time").required = pickup;
  renderCart();
}

function updateCustomerInfo() {
  if (!currentCustomer) return;
  if ($("order-email")) $("order-email").value = currentCustomer.email || "";
  if ($("contact-email")) $("contact-email").value = currentCustomer.email || "";
}

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
  const {data, error} = await customerDB.from("orders")
    .select("*").eq("customer_id", user.id).order("created_at", {ascending: false});

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
    safeText(card, "h3", "Order " + String(order.id).slice(0, 8).toUpperCase());
    safeText(card, "p", "Placed: " + new Date(order.created_at).toLocaleString("en-KE"));
    safeText(card, "p", "Total: " + money(order.total) + " · Payment: " + order.payment_method + " · Status: " + order.payment_status);
    safeText(card, "p", "Order status: " + order.order_status);
    safeText(card, "p", ((order.fulfillment_type || order.delivery_method) === "pickup" ? "Pickup" : "Delivery") + ": " + (order.delivery_address || order.delivery_location || "Shop pickup") + " · " + (order.schedule_date || order.delivery_date || "") + " " + (order.schedule_slot || order.delivery_time || ""));

    const itemLine = safeText(card, "p", "Loading items...");
    const result = await customerDB.from("order_items").select("*").eq("order_id", order.id);
    if (result.error) itemLine.textContent = "Items could not load: " + result.error.message;
    else itemLine.textContent = (result.data || []).map(i =>
      i.product_name + (i.color || i.colour ? " (" + (i.color || i.colour) + ")" : "") +
      (i.size ? " / " + i.size : "") + " × " + i.quantity + " — " + money(i.unit_price)
    ).join("; ") || "No item details.";

    list.appendChild(card);
  }
}

async function placeOrder(event) {
  event.preventDefault();

  if (!cart.length) {
    showStatus("checkout-status", "Your bag is empty. Add at least one product first.", true);
    return;
  }

  const user = currentCustomer || await loadCustomerAccount();
  if (!user) {
    showStatus("checkout-status", "Please sign in to your customer account before placing an order.", true);
    return;
  }

  const totals = cartTotals();
  if (totals.code && totals.code !== "KC10") {
    showStatus("checkout-status", "That discount code is not valid. Remove it or try KC10.", true);
    return;
  }

  const name = $("order-name").value.trim();
  const phone = $("order-phone").value.trim();
  const email = $("order-email").value.trim();
  const method = $("delivery-method").value;
  const payment = $("payment-method").value;
  const area = $("delivery-area")?.value || "near_shop";
  const location = method === "pickup" ? "Shop pickup" : $("delivery-location").value.trim();
  const date = method === "pickup" ? $("pickup-date").value : $("delivery-date").value;
  const time = method === "pickup" ? $("pickup-time").value : $("delivery-time").value;

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (date && date < today) {
    showStatus("checkout-status", "Please choose today or a future date.", true);
    return;
  }

  const button = $("place-order-button");
  button.disabled = true;
  showStatus("checkout-status", "Saving your order...");

  let orderCreated = false;

  try {
    for (const item of cart) {
      const {data, error} = await customerDB.from("products")
        .select("id,name,stock,active,price").eq("id", item.product_id).maybeSingle();

      if (error) throw error;
      if (!data || data.active === false || Number(data.stock) < item.quantity) {
        throw new Error("Stock changed for " + item.name + ". Refresh the page and review your bag.");
      }
    }

    const fee = method === "pickup" ? 0 : area === "near_shop" ? 200 : area === "nairobi" ? 500 : 800;
    const total = Math.max(0, totals.subtotal - totals.discount + fee);

    const orderPayload = {
      customer_id: user.id,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,
      fulfillment_type: method,
      delivery_method: method,
      delivery_area: method === "pickup" ? "pickup" : area,
      delivery_fee: fee,
      subtotal: totals.subtotal,
      discount_code: totals.discount ? totals.code : null,
      discount_amount: totals.discount,
      total,
      payment_method: payment,
      payment_status: "unpaid",
      delivery_address: location,
      delivery_location: location,
      schedule_date: date || null,
      schedule_slot: time || null,
      delivery_date: date || null,
      delivery_time: time || null,
      order_status: "awaiting_confirmation",
      order_notes: $("order-notes")?.value.trim() || null
    };

    const {data: order, error: orderError} = await customerDB
      .from("orders").insert(orderPayload).select("*").single();

    if (orderError) throw orderError;
    orderCreated = true;

    const items = cart.map(item => ({
      order_id: order.id,
      product_id: String(item.product_id),
      product_name: item.name,
      size: item.size || null,
      color: item.color || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.unit_price * item.quantity
    }));

    const {error: itemsError} = await customerDB.from("order_items").insert(items);
    if (itemsError) {
      throw new Error("Order reference " + String(order.id).slice(0, 8).toUpperCase() +
        " was created, but the item details could not be saved. " + itemsError.message);
    }

    const receipt = cart.map(i => i.name + (i.color ? " (" + i.color + ")" : "") +
      (i.size ? " / " + i.size : "") + " × " + i.quantity).join("; ");

    cart = [];
    saveCart();
    $("checkout-form").reset();
    setMinimumDates();
    updateCheckoutFields();
    updateCustomerInfo();

    showStatus("checkout-status", "Order placed successfully! Reference: " +
      String(order.id).slice(0, 8).toUpperCase() + ". Items: " + receipt +
      ". Your order is awaiting confirmation. Payment remains unpaid until verified.");
    await loadMyOrders();

  } catch (error) {
    console.error("Order placement error:", error);
    showStatus("checkout-status",
      (orderCreated ? "Your order was created, but another step failed. " : "Order could not be placed. ") +
      error.message, true);
  } finally {
    button.disabled = false;
  }
}

$("category-filter")?.addEventListener("change", displayProducts);
$("delivery-method")?.addEventListener("change", updateCheckoutFields);
$("delivery-area")?.addEventListener("change", renderCart);
$("discount-code")?.addEventListener("input", renderCart);
$("payment-method")?.addEventListener("change", updateCheckoutFields);
$("checkout-form")?.addEventListener("submit", placeOrder);

$("customer-contact-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("contact-status");
  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    status.textContent = "Please sign in before sending a message.";
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  status.textContent = "Sending...";

  try {
    const {error} = await customerDB.from("messages").insert({
      customer_name: $("contact-name").value.trim(),
      customer_email: user.email,
      subject: "Customer enquiry",
      message: $("contact-message").value.trim()
    });

    if (error) throw error;
    event.currentTarget.reset();
    updateCustomerInfo();
    status.textContent = "Your message was sent successfully.";
  } catch (error) {
    status.textContent = "Could not send message: " + error.message;
  } finally {
    if (button) button.disabled = false;
  }
});

$("customer-signout")?.addEventListener("click", async () => {
  const button = $("customer-signout");
  button.disabled = true;
  const {error} = await customerDB.auth.signOut();
  if (error) {
    button.disabled = false;
    alert("Could not sign out: " + error.message);
    return;
  }
  window.location.replace("index.html");
});

async function loadCustomerMessages() {
  const form = $("customer-contact-form");
  if (!form) return;

  let section = $("customer-messages-section");
  if (!section) {
    section = document.createElement("section");
    section.id = "customer-messages-section";
    section.className = "kc-section";
    section.innerHTML = '<div class="kc-section-inner"><h2 class="kc-section-heading">MY MESSAGES</h2><p id="customer-messages-status"></p><div id="customer-messages-list"></div></div>';
    form.insertAdjacentElement("afterend", section);
  }

  const user = currentCustomer || await loadCustomerAccount();
  const list = $("customer-messages-list");
  if (!list) return;
  if (!user) {
    $("customer-messages-status").textContent = "Sign in to view messages.";
    return;
  }

  const {data, error} = await customerDB.from("messages")
    .select("id,subject,message,created_at,reply,replied_at")
    .eq("customer_email", user.email).order("created_at", {ascending: false});

  list.replaceChildren();
  if (error) {
    $("customer-messages-status").textContent = "Messages unavailable: " + error.message;
    return;
  }

  $("customer-messages-status").textContent = data?.length ? data.length + " message(s)" : "No messages yet.";
  (data || []).forEach(m => {
    const card = document.createElement("article");
    card.className = "kc-order-card";
    safeText(card, "h3", m.subject || "Enquiry");
    safeText(card, "p", m.message);
    safeText(card, "p", m.reply ? "Owner reply: " + m.reply : "Awaiting owner reply.");
    list.appendChild(card);
  });
}

async function loadCustomerPage() {
  await loadCustomerAccount();
  updateCustomerInfo();
  setMinimumDates();
  updateCheckoutFields();
  if ($("order-name") && currentCustomer) {
    $("order-name").value = currentCustomer.user_metadata?.full_name || "";
  }
  await loadCustomerProducts();
  renderCart();
  await loadMyOrders();
  await loadCustomerMessages();
}

loadCustomerPage();
window.addEventListener("focus", () => {
  loadCustomerProducts();
  loadMyOrders();
});
customerDB.channel("customer-product-updates")
  .on("postgres_changes", {event: "*", schema: "public", table: "products"}, loadCustomerProducts)
  .subscribe();
