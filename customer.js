"use strict";

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const money = (n) => "KSh " + Number(n || 0).toLocaleString("en-KE", {
  maximumFractionDigits: 2
});

let products = [];
let cart = [];
let mpesaDemoResult = null;
let submitting = false;

function message(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}

function clean(value) {
  return String(value ?? "").trim();
}

function optionsFrom(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/[,/|]/).map(x => x.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
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

async function loadProducts() {
  message("catalogue-message", "Loading our collection...");

  try {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    products = (data || []).filter(p =>
      p.is_active !== false && p.active !== false
    );

    renderProducts();
    message("catalogue-message", products.length
      ? products.length + " product(s) available."
      : "No products are currently available.");
  } catch (error) {
    console.error("Product loading error:", error);
    message("catalogue-message", "Could not load products: " + error.message);
  }
}

function renderProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.replaceChildren();

  const category = clean($("category-filter")?.value || "all").toLowerCase();

  const visible = products.filter(p =>
    category === "all" ||
    clean(p.category).toLowerCase() === category
  );

  if (!visible.length) {
    container.textContent = "No products found in this category.";
    return;
  }

  visible.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";

    const image = productImage(product);
    const stock = productStock(product);
    const sizes = optionsFrom(product.size || product.sizes);
    const colors = optionsFrom(product.color || product.colour || product.colors);

    card.innerHTML = `
      <img class="customer-product-image"
           src="${escapeHtml(image)}"
           alt="${escapeHtml(product.name || "Clothing item")}"
           onerror="this.style.display='none'">
      <div class="customer-product-details">
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "")}</p>
        <p class="customer-product-price">${money(productPrice(product))}</p>
        <p class="customer-product-stock ${stock < 1 ? "out-of-stock" : ""}">
          ${stock > 0 ? stock + " in stock" : "Out of stock"}
        </p>
        <div class="kc-product-options">
          <label>Size
            <select class="choose-size">
              <option value="">Choose size</option>
              ${sizes.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
            </select>
          </label>
          <label>Colour
            <select class="choose-color">
              <option value="">Choose colour</option>
              ${colors.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
            </select>
          </label>
          <label>Quantity
            <input class="choose-quantity" type="number" min="1"
                   max="${Math.max(1, stock)}" value="1">
          </label>
        </div>
        <button class="kc-button kc-add-button" type="button"
                ${stock < 1 ? "disabled" : ""}>
          ${stock > 0 ? "ADD TO BAG" : "OUT OF STOCK"}
        </button>
      </div>`;

    card.querySelector(".kc-add-button").addEventListener("click", () => {
      const size = card.querySelector(".choose-size").value;
      const color = card.querySelector(".choose-color").value;
      const quantity = Number(card.querySelector(".choose-quantity").value);

      if (sizes.length && !size) return alert("Please select a size.");
      if (colors.length && !color) return alert("Please select a colour.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
        return alert("Please enter a valid quantity within available stock.");
      }

      const existing = cart.find(item =>
        item.id === product.id && item.size === size && item.color === color
      );

      if (existing) {
        if (existing.quantity + quantity > stock) {
          return alert("That quantity exceeds the available stock.");
        }
        existing.quantity += quantity;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: productPrice(product),
          image,
          size,
          color,
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

  const area = $("delivery-area")?.value;
  if (area === "near_shop") return 200;
  if (area === "nairobi") return 500;
  return 700;
}

function discountAmount() {
  const code = clean($("discount-code")?.value).toUpperCase();
  return code === "KC10" ? subtotal() * 0.10 : 0;
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    const empty = document.createElement("p");
    empty.className = "kc-empty";
    empty.textContent = "Your bag is empty. Browse the collection to add items.";
    container.appendChild(empty);
  }

  cart.forEach((item, index) => {
    const line = document.createElement("div");
    line.className = "kc-cart-line";
    line.innerHTML = `
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"
           onerror="this.style.display='none'">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>Size: ${escapeHtml(item.size || "Not specified")}</p>
        <p>Colour: ${escapeHtml(item.color || "Not specified")}</p>
        <p>${money(item.price)} each</p>
        <label>Quantity
          <input class="cart-quantity" type="number" min="1"
                 max="${item.stock}" value="${item.quantity}">
        </label>
        <p><strong>${money(item.price * item.quantity)}</strong></p>
        <button class="kc-button kc-button-outline remove-item" type="button">
          REMOVE
        </button>
      </div>`;

    line.querySelector(".cart-quantity").addEventListener("change", event => {
      const qty = Number(event.target.value);
      if (!Number.isInteger(qty) || qty < 1 || qty > item.stock) {
        alert("Please enter a valid quantity within available stock.");
        event.target.value = item.quantity;
        return;
      }
      cart[index].quantity = qty;
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

  if ($("delivery-location")) $("delivery-location").required = !pickup;
  if ($("delivery-date")) $("delivery-date").required = !pickup;
  if ($("delivery-time")) $("delivery-time").required = !pickup;
  if ($("pickup-date")) $("pickup-date").required = pickup;
  if ($("pickup-time")) $("pickup-time").required = pickup;

  renderCart();
}

function updatePaymentFields() {
  const isMpesa = $("payment-method")?.value === "demo_mpesa";
  if ($("mpesa-fields")) $("mpesa-fields").hidden = !isMpesa;
  mpesaDemoResult = null;
  message("mpesa-demo-status", "");
}

function setDateLimits() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  ["delivery-date", "pickup-date"].forEach(id => {
    if ($(id)) {
      $(id).min = localDate;
      if (!$(id).value) $(id).value = localDate;
    }
  });
}

async function placeOrder(event) {
  event.preventDefault();
  if (submitting) return;

  if (!cart.length) {
    message("checkout-status", "Please add products to your bag first.");
    return;
  }

  const name = clean($("order-name")?.value);
  const phone = clean($("order-phone")?.value);
  const email = clean($("order-email")?.value);
  const pickup = $("delivery-method").value === "pickup";
  const area = pickup ? "pickup" : $("delivery-area").value;
  const location = pickup ? "Shop pickup" : clean($("delivery-location").value);
  const date = pickup ? $("pickup-date").value : $("delivery-date").value;
  const slot = pickup ? $("pickup-time").value : $("delivery-time").value;
  const method = $("payment-method").value;

  if (!name || !phone || !email) {
    message("checkout-status", "Please complete your name, phone number and email.");
    return;
  }

  if (method === "demo_mpesa" && mpesaDemoResult !== "success") {
    message("checkout-status", "Please complete the M-Pesa demo step or choose cash on delivery.");
    return;
  }

  const sub = subtotal();
  const discount = discountAmount();
  const fee = deliveryFee();
  const total = Math.max(0, sub - discount + fee);

  submitting = true;
  $("place-order-button").disabled = true;
  message("checkout-status", "Submitting your order...");

  let createdOrderId = null;

  try {
    const { data: authData } = await db.auth.getUser();
    const user = authData?.user || null;

    const orderPayload = {
      customer_id: user?.id || null,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,
      fulfillment_type: pickup ? "pickup" : "delivery",
      customer_fulfillment_type: pickup ? "pickup" : "delivery",
      delivery_method: pickup ? "pickup" : "delivery",
      delivery_area: area,
      county: pickup ? "" : location.split(",")[0].trim(),
      town: pickup ? "" : location.split(",").slice(1, 2).join(",").trim(),
      delivery_address: location,
      delivery_location: location,
      delivery_fee: fee,
      schedule_date: date,
      schedule_slot: slot,
      delivery_date: date,
      delivery_time: slot,
      fulfillment_time: slot,
      subtotal: sub,
      discount_code: clean($("discount-code").value).toUpperCase() || null,
      discount_amount: discount,
      total,
      payment_method: method,
      payment_status: "pending",
      mpesa_phone_number: method === "demo_mpesa" ? clean($("mpesa-phone").value) : null,
      order_status: "pending",
      order_notes: clean($("order-notes").value)
    };

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError) throw orderError;
    createdOrderId = order.id;

    const items = cart.map(item => ({
      order_id: createdOrderId,
      product_id: String(item.id),
      product_name: item.name,
      size: item.size || "",
      color: item.color || "",
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity
    }));

    const { error: itemError } = await db.from("order_items").insert(items);

    if (itemError) {
      message("checkout-status",
        "Order created, but its items could not be saved. Please contact the shop and provide order reference " +
        createdOrderId);
      console.error("Order items insert error:", itemError);
      return;
    }

    cart = [];
    renderCart();
    $("checkout-form").reset();
    setDateLimits();
    updateFulfilmentFields();
    updatePaymentFields();

    message("checkout-status",
      "Order placed successfully. Reference: " + createdOrderId.slice(0, 8).toUpperCase() +
      ". Payment is pending until confirmed by the shop.");

    await loadMyOrders();
  } catch (error) {
    console.error("Checkout error:", error);
    message("checkout-status", "Order could not be placed: " + error.message);
  } finally {
    submitting = false;
    $("place-order-button").disabled = false;
  }
}

async function loadMyOrders() {
  const container = $("my-orders-list");
  if (!container) return;

  container.replaceChildren();

  try {
    const { data: authData } = await db.auth.getUser();
    const user = authData?.user;

    if (!user) {
      message("my-orders-status",
        "Sign in to view your order history. Your order is still saved for the shop.");
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

    for (const order of data) {
      const card = document.createElement("article");
      card.className = "kc-order-card";

      const heading = document.createElement("h3");
      heading.textContent = "Order " + String(order.id).slice(0, 8).toUpperCase();
      const details = document.createElement("p");
      details.textContent =
        "Placed: " + new Date(order.created_at).toLocaleString() +
        " | Total: " + money(order.total) +
        " | Payment: " + (order.payment_status || "pending") +
        " | Order status: " + (order.order_status || "pending");

      const fulfilment = document.createElement("p");
      fulfilment.textContent =
        (order.fulfillment_type || order.delivery_method || "delivery") +
        " | " + (order.schedule_date || order.delivery_date || "") +
        " | " + (order.schedule_slot || order.delivery_time || "");

      card.append(heading, details, fulfilment);
      container.appendChild(card);
    }

    message("my-orders-status", "Your order history is up to date.");
  } catch (error) {
    console.error("Order history error:", error);
    message("my-orders-status", "Could not load order history: " + error.message);
  }
}

async function signOutCustomer() {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    window.location.href = "index.html";
  } catch (error) {
    message("my-orders-status", "Sign out failed: " + error.message);
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
        customer_name: clean($("contact-name").value),
        customer_email: clean($("contact-email").value),
        customer_phone: clean($("contact-phone").value),
        message: clean($("contact-message").value),
        subject: "Website enquiry",
        is_read: false
      };

      const { error } = await db.from("messages").insert(payload);
      if (error) throw error;

      form.reset();
      message("contact-status", "Your message has been sent.");
    } catch (error) {
      console.error("Contact form error:", error);
      message("contact-status", "Could not send your message: " + error.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  renderCart();
  setDateLimits();
  updateFulfilmentFields();
  updatePaymentFields();

  $("category-filter")?.addEventListener("change", renderProducts);
  $("delivery-method")?.addEventListener("change", updateFulfilmentFields);
  $("delivery-area")?.addEventListener("change", renderCart);
  $("discount-code")?.addEventListener("input", renderCart);
  $("payment-method")?.addEventListener("change", updatePaymentFields);
  $("checkout-form")?.addEventListener("submit", placeOrder);
  $("customer-signout")?.addEventListener("click", signOutCustomer);

  $("simulate-mpesa-success")?.addEventListener("click", () => {
    mpesaDemoResult = "success";
    message("mpesa-demo-status", "Demo marked successful. No real M-Pesa payment was received.");
  });

  $("simulate-mpesa-failure")?.addEventListener("click", () => {
    mpesaDemoResult = "failure";
    message("mpesa-demo-status", "Demo payment failed. You may choose cash on delivery.");
  });

  setupContactForm();
  await loadMyOrders();
});
