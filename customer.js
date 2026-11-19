"use strict";

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const clean = value => String(value ?? "").trim();
const money = value => "KSh " + Number(value || 0).toLocaleString("en-KE", {
  maximumFractionDigits: 2
});

let products = [];
let cart = [];
let submitting = false;

function message(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function optionsFrom(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/[,/|]/).map(value => value.trim()).filter(Boolean);
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function productImage(product) {
  return product.image_url || product.image || product.image_path || "";
}

function productStock(product) {
  return Number(product.stock ?? product.quantity_in_stock ?? 0);
}

function productPrice(product) {
  return Number(product.price ?? 0);
}

function validKenyanPhone(value) {
  const phone = clean(value).replace(/[\s()-]/g, "");
  return /^(?:0[17]\d{8}|\+254[17]\d{8}|254[17]\d{8})$/.test(phone);
}

function paymentMethod() {
  const value = clean($("payment-method")?.value).toLowerCase();

  if (value.includes("mpesa") || value.includes("m-pesa")) return "M-Pesa";
  if (value.includes("cash")) return "Cash";

  return "";
}

async function loadProducts() {
  message("catalogue-message", "Loading our collection...");

  try {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    products = (data || []).filter(product =>
      product.is_active !== false && product.active !== false
    );

    populateCategories();
    renderProducts();

    message(
      "catalogue-message",
      products.length
        ? `${products.length} product(s) in our collection.`
        : "Our collection is currently empty. Please check back soon."
    );
  } catch (error) {
    console.error("Product loading error:", error);
    message(
      "catalogue-message",
      "We couldn't load the collection. Please refresh the page."
    );
  }
}

function populateCategories() {
  const select = $("category-filter");
  if (!select) return;

  const selected = select.value || "all";
  const categories = [...new Set(
    products.map(product => clean(product.category)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Categories";
  select.appendChild(allOption);

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (categories.includes(selected)) select.value = selected;
  else select.value = "all";
}

function renderProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.replaceChildren();

  const selectedCategory = clean($("category-filter")?.value || "all");
  const visibleProducts = products.filter(product =>
    selectedCategory === "all" ||
    clean(product.category) === selectedCategory
  );

  if (!visibleProducts.length) {
    const empty = document.createElement("p");
    empty.className = "kc-empty";
    empty.textContent = "No products are available in this category yet.";
    container.appendChild(empty);
    return;
  }

  visibleProducts.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";

    const image = productImage(product);
    const stock = productStock(product);
    const sizes = optionsFrom(product.size || product.sizes);
    const colours = optionsFrom(
      product.color || product.colour || product.colors
    );

    card.innerHTML = `
      <img class="customer-product-image"
           src="${escapeHtml(image)}"
           alt="${escapeHtml(product.name || "Clothing item")}"
           onerror="this.style.display='none'">

      <div class="customer-product-details">
        <h3>${escapeHtml(product.name || "Clothing item")}</h3>
        <p>${escapeHtml(product.description || "")}</p>
        <p class="customer-product-price">${money(productPrice(product))}</p>
        <p class="customer-product-stock ${stock < 1 ? "out-of-stock" : ""}">
          ${stock > 0 ? `${stock} in stock` : "Out of stock"}
        </p>

        <div class="kc-product-options">
          <label>Size
            <select class="choose-size">
              <option value="">Choose size</option>
              ${sizes.map(size =>
                `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`
              ).join("")}
            </select>
          </label>

          <label>Colour
            <select class="choose-color">
              <option value="">Choose colour</option>
              ${colours.map(colour =>
                `<option value="${escapeHtml(colour)}">${escapeHtml(colour)}</option>`
              ).join("")}
            </select>
          </label>

          <label>Quantity
            <input class="choose-quantity" type="number"
                   min="1" max="${Math.max(1, stock)}" value="1">
          </label>
        </div>

        <button class="kc-button kc-add-button" type="button"
                ${stock < 1 ? "disabled" : ""}>
          ${stock > 0 ? "ADD TO BAG" : "OUT OF STOCK"}
        </button>
      </div>`;

    card.querySelector(".kc-add-button").addEventListener("click", () => {
      const size = card.querySelector(".choose-size").value;
      const colour = card.querySelector(".choose-color").value;
      const quantity = Number(card.querySelector(".choose-quantity").value);

      if (sizes.length && !size) {
        alert("Please select a size.");
        return;
      }

      if (colours.length && !colour) {
        alert("Please select a colour.");
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
        alert("Please enter a valid quantity within available stock.");
        return;
      }

      const existing = cart.find(item =>
        String(item.id) === String(product.id) &&
        item.size === size &&
        item.color === colour
      );

      if (existing) {
        if (existing.quantity + quantity > stock) {
          alert("That quantity exceeds the available stock.");
          return;
        }
        existing.quantity += quantity;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: productPrice(product),
          image,
          size,
          color: colour,
          quantity,
          stock
        });
      }

      renderCart();
      message("checkout-status", "");
    });

    container.appendChild(card);
  });
}

function subtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function deliveryFee() {
  if ($("delivery-method")?.value === "pickup") return 0;

  switch ($("delivery-area")?.value) {
    case "near_shop": return 200;
    case "nairobi": return 500;
    case "countrywide": return 700;
    default: return 0;
  }
}

function discountAmount() {
  return clean($("discount-code")?.value).toUpperCase() === "KC10"
    ? subtotal() * 0.10
    : 0;
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    const empty = document.createElement("p");
    empty.className = "kc-empty";
    empty.textContent = "Your bag is empty. Explore our collection to get started.";
    container.appendChild(empty);
  }

  cart.forEach((item, index) => {
    const line = document.createElement("div");
    line.className = "kc-cart-line";

    line.innerHTML = `
      <img src="${escapeHtml(item.image)}"
           alt="${escapeHtml(item.name)}"
           onerror="this.style.display='none'">

      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>Size: ${escapeHtml(item.size || "Not specified")}</p>
        <p>Colour: ${escapeHtml(item.color || "Not specified")}</p>
        <p>${money(item.price)} each</p>

        <label>Quantity
          <input class="cart-quantity" type="number"
                 min="1" max="${item.stock}" value="${item.quantity}">
        </label>

        <p><strong>${money(item.price * item.quantity)}</strong></p>
        <button class="kc-button kc-button-outline remove-item" type="button">
          REMOVE
        </button>
      </div>`;

    line.querySelector(".cart-quantity").addEventListener("change", event => {
      const quantity = Number(event.target.value);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.stock) {
        alert("Please enter a valid quantity within available stock.");
        event.target.value = item.quantity;
        return;
      }

      cart[index].quantity = quantity;
      renderCart();
    });

    line.querySelector(".remove-item").addEventListener("click", () => {
      cart.splice(index, 1);
      renderCart();
    });

    container.appendChild(line);
  });

  const sub = subtotal();
  const discount = discountAmount();
  const fee = deliveryFee();

  message("bag-count", cart.reduce((sum, item) => sum + item.quantity, 0));
  message("cart-subtotal", money(sub));
  message("cart-discount", money(discount));
  message("cart-delivery", money(fee));
  message("cart-total", money(Math.max(0, sub - discount + fee)));
}

function updateFulfilmentFields() {
  const pickup = $("delivery-method")?.value === "pickup";

  if ($("delivery-fields")) $("delivery-fields").hidden = pickup;
  if ($("pickup-fields")) $("pickup-fields").hidden = !pickup;

  if ($("delivery-area")) $("delivery-area").required = !pickup;
  if ($("delivery-location")) $("delivery-location").required = !pickup;
  if ($("delivery-date")) $("delivery-date").required = !pickup;
  if ($("delivery-time")) $("delivery-time").required = !pickup;
  if ($("pickup-date")) $("pickup-date").required = pickup;
  if ($("pickup-time")) $("pickup-time").required = pickup;

  renderCart();
}

function updatePaymentFields() {
  const mpesa = paymentMethod() === "M-Pesa";

  if ($("mpesa-fields")) $("mpesa-fields").hidden = !mpesa;
  if ($("mpesa-phone")) $("mpesa-phone").required = mpesa;
}

function setDateLimits() {
  const today = todayLocal();

  ["delivery-date", "pickup-date"].forEach(id => {
    const field = $(id);
    if (!field) return;

    field.min = today;
    if (!field.value || field.value < today) field.value = today;
  });
}

function openCheckout() {
  if (!cart.length) {
    message("checkout-status", "Add an item to your bag before checking out.");
    return;
  }

  if ($("checkout-form")) $("checkout-form").hidden = false;

  $("checkout-form")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function setupCheckoutNavigation() {
  $("checkout-toggle")?.addEventListener("click", openCheckout);

  $("back-to-bag")?.addEventListener("click", () => {
    if ($("checkout-form")) $("checkout-form").hidden = true;

    $("shopping-bag")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

async function placeOrder(event) {
  event.preventDefault();

  if (submitting) return;

  if (!cart.length) {
    message("checkout-status", "Your bag is empty.");
    return;
  }

  const firstName = clean($("order-first-name")?.value);
  const lastName = clean($("order-last-name")?.value);
  const name = `${firstName} ${lastName}`.trim();
  const phone = clean($("order-phone")?.value);
  const email = clean($("order-email")?.value);
  const pickup = $("delivery-method")?.value === "pickup";
  const area = pickup ? "pickup" : clean($("delivery-area")?.value);
  const location = pickup ? "Shop pickup" : clean($("delivery-location")?.value);
  const method = paymentMethod();

  const dateField = pickup ? $("pickup-date") : $("delivery-date");
  const timeField = pickup ? $("pickup-time") : $("delivery-time");
  const date = clean(dateField?.value);
  const slot = clean(timeField?.value);
  const mpesaPhone = clean($("mpesa-phone")?.value);

  if (!firstName || !lastName) {
    message("checkout-status", "Enter your first name and last name.");
    return;
  }

  if (!validKenyanPhone(phone)) {
    message("checkout-status", "Enter a valid Kenyan phone number starting with 01 or 07.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message("checkout-status", "Enter a valid email address.");
    return;
  }

  if (!method) {
    message("checkout-status", "Choose M-Pesa or Cash.");
    return;
  }

  if (method === "M-Pesa" && !validKenyanPhone(mpesaPhone)) {
    message("checkout-status", "Enter a valid M-Pesa number starting with 01 or 07.");
    return;
  }

  if (!pickup && (!area || !location)) {
    message("checkout-status", "Complete your delivery area and address.");
    return;
  }

  if (!date || date < todayLocal()) {
    message("checkout-status", "Choose today or a future date.");
    return;
  }

  if (!slot) {
    message("checkout-status", "Choose a pickup or delivery time.");
    return;
  }

  const sub = subtotal();
  const discount = discountAmount();
  const fee = deliveryFee();
  const total = Math.max(0, sub - discount + fee);

  submitting = true;
  if ($("place-order-button")) $("place-order-button").disabled = true;
  message("checkout-status", "Submitting your order...");

  let orderId = null;

  try {
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError) throw authError;

    const user = authData?.user || null;

    const orderPayload = {
      customer_id: user?.id || null,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,
      fulfillment_type: pickup ? "pickup" : "delivery",
      delivery_method: pickup ? "pickup" : "delivery",
      delivery_area: area,
      county: pickup ? null : location.split(",")[0].trim(),
      town: pickup ? null : (location.split(",")[1] || "").trim() || null,
      delivery_address: location,
      delivery_location: location,
      delivery_fee: fee,
      schedule_date: date,
      schedule_slot: slot,
      delivery_date: date,
      delivery_time: slot,
      subtotal: sub,
      discount_code: clean($("discount-code")?.value).toUpperCase() || null,
      discount_amount: discount,
      total,
      payment_method: method,
      payment_status: "pending",
      mpesa_phone: method === "M-Pesa" ? mpesaPhone : null,
      order_status: "awaiting confirmation",
      order_notes: clean($("order-notes")?.value) || null
    };

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError) throw orderError;
    orderId = order.id;

    const items = cart.map(item => ({
      order_id: orderId,
      product_id: String(item.id),
      product_name: item.name,
      size: item.size || "",
      color: item.color || "",
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity
    }));

    const { error: itemsError } = await db.from("order_items").insert(items);

    if (itemsError) {
      console.error("Order items error:", itemsError);
      message(
        "checkout-status",
        "Order reference " + orderId.slice(0, 8).toUpperCase() +
        " was created, but its item details could not be saved. Please contact the shop."
      );
      return;
    }

    cart = [];
    renderCart();

    $("checkout-form")?.reset();
    if ($("checkout-form")) $("checkout-form").hidden = true;

    setDateLimits();
    updateFulfilmentFields();
    updatePaymentFields();

    message(
      "checkout-status",
      "Your order has been received. Reference: " +
      orderId.slice(0, 8).toUpperCase() +
      ". Payment is pending confirmation."
    );

    await loadMyOrders();

  } catch (error) {
    console.error("Order submission error:", error);

    message(
      "checkout-status",
      orderId
        ? "Your order reference is " + orderId.slice(0, 8).toUpperCase() +
          ". Please contact the shop to confirm the order."
        : "We couldn't place your order. Please try again."
    );
  } finally {
    submitting = false;
    if ($("place-order-button")) $("place-order-button").disabled = false;
  }
}

async function loadMyOrders() {
  const container = $("my-orders-list");
  if (!container) return;

  container.replaceChildren();

  try {
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError) throw authError;

    const user = authData?.user;

    if (!user) {
      message("my-orders-status", "Sign in to view your order history.");
      return;
    }

    const { data, error } = await db.from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data?.length) {
      message("my-orders-status", "You have no orders yet.");
      return;
    }

    data.forEach(order => {
      const card = document.createElement("article");
      card.className = "kc-order-card";

      const heading = document.createElement("h3");
      heading.textContent = "Order " + String(order.id).slice(0, 8).toUpperCase();

      const details = document.createElement("p");
      details.textContent =
        "Placed: " + new Date(order.created_at).toLocaleString() +
        " | Total: " + money(order.total) +
        " | Payment method: " + (order.payment_method || "Not specified") +
        " | Payment status: " + (order.payment_status || "pending") +
        " | Order status: " + (order.order_status || "pending");

      const fulfilment = document.createElement("p");
      fulfilment.textContent =
        (order.fulfillment_type || order.delivery_method || "delivery") +
        " | " + (order.schedule_date || order.delivery_date || "") +
        " | " + (order.schedule_slot || order.delivery_time || "");

      card.append(heading, details, fulfilment);
      container.appendChild(card);
    });

    message("my-orders-status", "Your order history is up to date.");
  } catch (error) {
    console.error("Order history error:", error);
    message("my-orders-status", "Could not load your order history. Please try again.");
  }
}

async function signOutCustomer(event) {
  event?.preventDefault();

  const button = $("customer-signout");
  if (button) button.disabled = true;

  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;

    window.location.replace("index.html");
  } catch (error) {
    console.error("Sign-out error:", error);
    message("my-orders-status", "Sign out failed. Please try again.");
    if (button) button.disabled = false;
  }
}

function setupContactForm() {
  const form = $("customer-contact-form");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message("contact-status", "Sending message...");

    try {
      const payload = {
        customer_name: clean($("contact-name")?.value),
        customer_email: clean($("contact-email")?.value),
        customer_phone: clean($("contact-phone")?.value),
        message: clean($("contact-message")?.value),
        subject: "Website enquiry",
        is_read: false
      };

      const { error } = await db.from("messages").insert(payload);
      if (error) throw error;

      form.reset();
      message("contact-status", "Your message has been sent.");
    } catch (error) {
      console.error("Contact form error:", error);
      message("contact-status", "We couldn't send your message. Please try again.");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();

  renderCart();
  setDateLimits();
  updateFulfilmentFields();
  updatePaymentFields();
  setupCheckoutNavigation();

  $("category-filter")?.addEventListener("change", renderProducts);
  $("delivery-method")?.addEventListener("change", updateFulfilmentFields);
  $("delivery-area")?.addEventListener("change", renderCart);
  $("discount-code")?.addEventListener("input", renderCart);
  $("payment-method")?.addEventListener("change", updatePaymentFields);
  $("checkout-form")?.addEventListener("submit", placeOrder);
  $("customer-signout")?.addEventListener("click", signOutCustomer);

  setupContactForm();
  await loadMyOrders();
});
