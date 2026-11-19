
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
let currentUser = null;
let submitting = false;

function show(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function getOptions(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/[,/|]/).map(x => x.trim()).filter(Boolean);
}

function imagePath(product) {
  return product.image_url || product.image_path || product.image || "";
}

function stockOf(product) {
  return Number(product.stock ?? product.quantity_in_stock ?? 0);
}

function priceOf(product) {
  return Number(product.price || 0);
}

function phoneIsValid(value) {
  return /^(?:(?:\+254|254)|0)?[17]\d{8}$/.test(
    clean(value).replace(/[\s()-]/g, "")
  );
}

function formatStatus(value) {
  return String(value || "Pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

/* ACCOUNT */
async function loadCustomerAccount() {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;

  currentUser = data.user;
  if (!currentUser) {
    show("catalogue-message", "Please sign in to shop.");
    return null;
  }

  return currentUser;
}

/* PRODUCT CATALOGUE */
async function loadProducts() {
  show("catalogue-message", "Loading our collection...");

  try {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    products = (data || []).filter(product =>
      product.active !== false && product.is_active !== false
    );

    buildCategoryFilter();
    renderProducts();

    show("catalogue-message", products.length
      ? products.length + " product(s) available."
      : "Our collection is being updated.");
  } catch (error) {
    console.error("Catalogue error:", error);
    show("catalogue-message", "Could not load products: " + error.message);
  }
}

function buildCategoryFilter() {
  const select = $("category-filter");
  if (!select) return;

  const previous = select.value || "all";
  const categories = [...new Set(products.map(p => clean(p.category)).filter(Boolean))];

  select.replaceChildren(new Option("All Categories", "all"));

  const standard = ["Women", "Men", "Accessories"];
  const ordered = [
    ...standard.filter(c => categories.some(x => x.toLowerCase() === c.toLowerCase())),
    ...categories.filter(c => !standard.some(x => x.toLowerCase() === c.toLowerCase()))
  ];

  ordered.forEach(category => select.add(new Option(category, category)));

  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}

function renderProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.replaceChildren();

  const category = clean($("category-filter")?.value || "all").toLowerCase();

  const visible = products.filter(product =>
    category === "all" || clean(product.category).toLowerCase() === category
  );

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "kc-empty";
    empty.textContent = "No products found in this category.";
    container.appendChild(empty);
    return;
  }

  visible.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";

    const sizes = getOptions(product.size || product.sizes);
    const colours = getOptions(
      product.color || product.colour || product.colors
    );
    const stock = stockOf(product);
    const image = imagePath(product);

    card.innerHTML = `
      <img class="customer-product-image"
        src="${escapeHTML(image)}"
        alt="${escapeHTML(product.name || "Clothing item")}"
        onerror="this.style.display='none'">

      <div class="customer-product-details">
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(product.description || "")}</p>
        <p class="customer-product-price">${money(priceOf(product))}</p>
        <p class="customer-product-stock ${stock <= 0 ? "out-of-stock" : ""}">
          ${stock > 0 ? stock + " available" : "Out of stock"}
        </p>

        <div class="kc-product-options">
          <label>Size
            <select class="choose-size">
              <option value="">Choose size</option>
              ${sizes.map(s =>
                `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`
              ).join("")}
            </select>
          </label>

          <label>Colour
            <select class="choose-colour">
              <option value="">Choose colour</option>
              ${colours.map(c =>
                `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
              ).join("")}
            </select>
          </label>

          <label>Quantity
            <input class="choose-quantity" type="number"
              min="1" max="${Math.max(stock, 1)}" value="1">
          </label>
        </div>

        <button class="kc-button kc-add-button" type="button"
          ${stock <= 0 ? "disabled" : ""}>
          ${stock > 0 ? "ADD TO BAG" : "OUT OF STOCK"}
        </button>
      </div>`;

    card.querySelector(".kc-add-button").addEventListener("click", () => {
      const size = card.querySelector(".choose-size").value;
      const colour = card.querySelector(".choose-colour").value;
      const quantity = Number(card.querySelector(".choose-quantity").value);

      if (sizes.length && !size) return alert("Please choose a size.");
      if (colours.length && !colour) return alert("Please choose a colour.");

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
        return alert("Choose a valid quantity within the available stock.");
      }

      const existing = cart.find(item =>
        String(item.id) === String(product.id) &&
        item.size === size && item.colour === colour
      );

      if (existing) {
        if (existing.quantity + quantity > stock) {
          return alert("That quantity exceeds available stock.");
        }
        existing.quantity += quantity;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: priceOf(product),
          image,
          size,
          colour,
          quantity,
          stock
        });
      }

      renderCart();
      show("checkout-status", "Added to your shopping bag.");
    });

    container.appendChild(card);
  });
}

/* BAG AND ORDER SUMMARY */
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
  // No discount is applied unless a discount code is configured.
  return 0;
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    const empty = document.createElement("p");
    empty.className = "kc-empty";
    empty.textContent = "Your bag is empty. Explore the collection to get started.";
    container.appendChild(empty);
  }

  cart.forEach((item, index) => {
    const line = document.createElement("div");
    line.className = "kc-cart-line";

    line.innerHTML = `
      <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}"
        onerror="this.style.display='none'">
      <div>
        <h3>${escapeHTML(item.name)}</h3>
        <p>Size: ${escapeHTML(item.size || "Not specified")}</p>
        <p>Colour: ${escapeHTML(item.colour || "Not specified")}</p>
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
      const quantity = Number(event.target.value);

      if (!Number.isInteger(quantity) || quantity < 1 ||
          quantity > item.stock) {
        alert("Choose a valid quantity within available stock.");
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

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const sub = subtotal();
  const discount = discountAmount();
  const fee = deliveryFee();

  show("bag-count", count);
  show("cart-subtotal", money(sub));
  show("cart-discount", money(discount));
  show("cart-delivery", money(fee));
  show("cart-total", money(Math.max(0, sub - discount + fee)));
}

/* CHECKOUT DISPLAY */
function updateFulfilment() {
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

function updatePayment() {
  const isMpesa = $("payment-method")?.value === "mpesa";
  if ($("mpesa-fields")) $("mpesa-fields").hidden = !isMpesa;
  if ($("mpesa-phone")) $("mpesa-phone").required = isMpesa;
}

function setDateLimits() {
  const today = todayLocal();

  ["delivery-date", "pickup-date"].forEach(id => {
    const field = $(id);
    if (!field) return;

    field.min = today;

    if (!field.value || field.value < today) {
      field.value = today;
    }
  });
}

function setCheckoutVisible(visible) {
  const form = $("checkout-form");
  if (!form) return;

  form.hidden = !visible;

  if (visible) {
    setDateLimits();
    updateFulfilment();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    $("shopping-bag")?.scrollIntoView({ behavior: "smooth" });
  }
}

/* ORDER SUBMISSION */
function orderPayloadVariants(details) {
  const common = {
    customer_id: details.user.id,
    customer_name: details.name,
    customer_email: details.email,
    fulfillment_type: details.method,
    delivery_area: details.area,
    county: details.county,
    town: details.town,
    delivery_address: details.address,
    delivery_fee: details.fee,
    subtotal: details.subtotal,
    discount_code: null,
    discount_amount: 0,
    total: details.total,
    payment_method: details.paymentMethod,
    payment_status: "unpaid",
    order_status: "awaiting_confirmation",
    order_notes: details.notes || null
  };

  // The project has had both newer and older column names.
  // Each variant includes a real date and time, never null.
  return [
    {
      ...common,
      customer_phone_number: details.phone,
      schedule_date: details.date,
      schedule_slot: details.slot,
      mpesa_phone_number: details.mpesaPhone
    },
    {
      ...common,
      customer_phone: details.phone,
      scheduled_date: details.date,
      scheduled_slot: details.slot,
      mpesa_phone: details.mpesaPhone
    },
    {
      ...common,
      customer_phone: details.phone,
      customer_phone_number: details.phone,
      schedule_date: details.date,
      scheduled_date: details.date,
      schedule_slot: details.slot,
      scheduled_slot: details.slot,
      delivery_date: details.date,
      delivery_time: details.slot,
      mpesa_phone: details.mpesaPhone,
      mpesa_phone_number: details.mpesaPhone
    }
  ];
}

function canRetrySchema(error) {
  const text = String(error?.message || "").toLowerCase();
  return error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.code === "23502" ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find") ||
    text.includes("not-null constraint") ||
    text.includes("violates not-null");
}

async function insertOrder(details) {
  const variants = orderPayloadVariants(details);
  let lastError = null;

  for (const payload of variants) {
    const result = await db.from("orders")
      .insert(payload)
      .select("id,created_at")
      .single();

    if (!result.error) return result.data;

    lastError = result.error;
    console.error("Order insert attempt failed:", result.error);

    if (!canRetrySchema(result.error)) break;
  }

  throw lastError || new Error("Could not save your order.");
}

async function placeOrder(event) {
  event.preventDefault();
  if (submitting) return;

  if (!cart.length) {
    show("checkout-status", "Your bag is empty. Add a product first.");
    return;
  }

  try {
    const user = currentUser || await loadCustomerAccount();

    if (!user) {
      show("checkout-status", "Please sign in before placing an order.");
      return;
    }

    const firstName = clean($("order-first-name")?.value);
    const lastName = clean($("order-last-name")?.value);
    const name = [firstName, lastName].filter(Boolean).join(" ");
    const phone = clean($("order-phone")?.value);
    const email = clean($("order-email")?.value);
    const pickup = $("delivery-method")?.value === "pickup";
    const method = pickup ? "pickup" : "delivery";
    const area = pickup ? "pickup" : clean($("delivery-area")?.value);
    const address = pickup ? "Shop pickup" : clean($("delivery-location")?.value);
    const dateField = pickup ? $("pickup-date") : $("delivery-date");
    const timeField = pickup ? $("pickup-time") : $("delivery-time");
    const date = clean(dateField?.value);
    const slot = clean(timeField?.value);
    const paymentChoice = clean($("payment-method")?.value);
    const mpesaPhone = paymentChoice === "mpesa"
      ? clean($("mpesa-phone")?.value) : null;

    if (!name || !phone || !email) {
      show("checkout-status", "Complete your name, phone number and email.");
      return;
    }

    if (!phoneIsValid(phone)) {
      show("checkout-status",
        "Enter a valid Kenyan phone number, such as 0712345678.");
      return;
    }

    if (!date || date < todayLocal()) {
      show("checkout-status", "Choose today or a future date.");
      return;
    }

    if (!slot) {
      show("checkout-status", "Choose a date and time slot.");
      return;
    }

    if (!paymentChoice) {
      show("checkout-status", "Choose a payment method.");
      return;
    }

    if (!pickup && (!area || !address)) {
      show("checkout-status", "Complete your delivery area and address.");
      return;
    }

    if (paymentChoice === "mpesa" && !phoneIsValid(mpesaPhone)) {
      show("checkout-status", "Enter a valid M-Pesa phone number.");
      return;
    }

    // Do not claim that an online payment has been received.
    // Map the form's values to the allowed values in the original schema.
    const paymentMethod = paymentChoice === "mpesa"
      ? "demo_mpesa" : "cash_on_delivery";

    const fee = pickup ? 0 : deliveryFee();
    const sub = subtotal();
    const discount = discountAmount();
    const total = Math.max(0, sub - discount + fee);

    const details = {
      user, name, phone, email, method, area, address, date, slot,
      paymentMethod, mpesaPhone,
      county: pickup ? null : address.split(",")[0]?.trim() || null,
      town: pickup ? null : address.split(",")[1]?.trim() || null,
      fee, subtotal: sub, total, notes: clean($("order-notes")?.value)
    };

    submitting = true;
    if ($("place-order-button")) $("place-order-button").disabled = true;
    show("checkout-status", "Saving your order...");

    // Check stock again before accepting the order.
    for (const item of cart) {
      const { data, error } = await db.from("products")
        .select("*").eq("id", item.id).maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(item.name + " is no longer available.");

      const currentStock = stockOf(data);
      if (data.active === false || currentStock < item.quantity) {
        throw new Error("Stock changed for " + item.name +
          ". Refresh the collection and update your bag.");
      }
    }

    const order = await insertOrder(details);

    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_id: String(item.id),
      product_name: item.name,
      size: item.size || null,
      color: item.colour || null,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity
    }));

    const { error: itemsError } = await db.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Order items error:", itemsError);
      show("checkout-status",
        "Your order was saved, but the items could not be attached. " +
        "Please contact the shop with reference " +
        String(order.id).slice(0, 8).toUpperCase() + ". Do not submit again.");
      return;
    }

    cart = [];
    renderCart();
    $("checkout-form")?.reset();
    setDateLimits();
    updateFulfilment();
    updatePayment();
    setCheckoutVisible(false);

    show("checkout-status",
      "Thank you! Your order reference is " +
      String(order.id).slice(0, 8).toUpperCase() +
      ". Your order is awaiting confirmation; payment has not been marked as received.");

    await loadMyOrders();
  } catch (error) {
    console.error("Checkout error:", error);
    show("checkout-status", "Order could not be placed: " + error.message);
  } finally {
    submitting = false;
    if ($("place-order-button")) $("place-order-button").disabled = false;
  }
}

/* CUSTOMER ORDER HISTORY */
async function loadMyOrders() {
  const container = $("my-orders-list");
  if (!container) return;
  container.replaceChildren();

  try {
    const user = currentUser || await loadCustomerAccount();
    if (!user) {
      show("my-orders-status", "Please sign in to view your orders.");
      return;
    }

    const { data: orders, error } = await db.from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!orders?.length) {
      show("my-orders-status", "You have no orders yet.");
      return;
    }

    for (const order of orders) {
      const card = document.createElement("article");
      card.className = "kc-order-card";

      const heading = document.createElement("h3");
      heading.textContent =
        "Order " + String(order.id).slice(0, 8).toUpperCase();

      const status = document.createElement("p");
      status.textContent =
        "Order status: " + formatStatus(order.order_status);

      const payment = document.createElement("p");
      payment.textContent =
        "Payment: " + formatStatus(order.payment_status);

      const total = document.createElement("p");
      total.textContent = "Total: " + money(order.total);

      const schedule = document.createElement("p");
      schedule.textContent =
        (order.fulfillment_type || order.delivery_method || "delivery") +
        " · " +
        (order.schedule_date || order.scheduled_date || order.delivery_date || "") +
        " · " +
        (order.schedule_slot || order.scheduled_slot || order.delivery_time || "");

      card.append(heading, status, payment, total, schedule);

      const itemLine = document.createElement("p");
      itemLine.textContent = "Loading items...";
      card.appendChild(itemLine);

      container.appendChild(card);

      const { data: items, error: itemsError } = await db.from("order_items")
        .select("*").eq("order_id", order.id);

      if (itemsError) {
        itemLine.textContent = "Order items could not load.";
      } else {
        itemLine.textContent = (items || []).map(item =>
          item.product_name +
          (item.color || item.colour ? " (" + (item.color || item.colour) + ")" : "") +
          (item.size ? " / " + item.size : "") +
          " × " + item.quantity + " — " + money(item.unit_price)
        ).join("; ") || "No item details.";
      }
    }

    show("my-orders-status", "Your order history is up to date.");
  } catch (error) {
    console.error("My Orders error:", error);
    show("my-orders-status", "Could not load orders: " + error.message);
  }
}

/* CONTACT FORM */
function setupContactForm() {
  const form = $("customer-contact-form");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    show("contact-status", "Sending your message...");

    try {
      const user = currentUser || await loadCustomerAccount();
      if (!user) throw new Error("Please sign in again.");

      const payload = {
        customer_name: clean($("contact-name")?.value),
        customer_email: clean($("contact-email")?.value),
        subject: "Website enquiry",
        message: clean($("contact-message")?.value),
        is_read: false
      };

      const { error } = await db.from("messages").insert(payload);
      if (error) throw error;

      form.reset();
      show("contact-status", "Your message has been sent.");
    } catch (error) {
      console.error("Contact form error:", error);
      show("contact-status", "Could not send message: " + error.message);
    }
  });
}

/* SIGN OUT */
async function signOutCustomer() {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    window.location.replace("index.html");
  } catch (error) {
    show("my-orders-status", "Could not sign out: " + error.message);
  }
}

/* STARTUP */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    setDateLimits();
    updateFulfilment();
    updatePayment();
    renderCart();

    $("category-filter")?.addEventListener("change", renderProducts);
    $("delivery-method")?.addEventListener("change", updateFulfilment);
    $("delivery-area")?.addEventListener("change", renderCart);
    $("payment-method")?.addEventListener("change", updatePayment);

    $("checkout-toggle")?.addEventListener("click", () => {
      if (!cart.length) {
        show("checkout-status", "Add products to your bag first.");
        return;
      }
      setCheckoutVisible(true);
    });

    $("back-to-bag")?.addEventListener("click", () => setCheckoutVisible(false));
    $("checkout-form")?.addEventListener("submit", placeOrder);
    $("customer-signout")?.addEventListener("click", signOutCustomer);

    setupContactForm();

    await loadCustomerAccount();
    await loadProducts();
    await loadMyOrders();
  } catch (error) {
    console.error("Customer startup error:", error);
    show("catalogue-message", "Could not start the shop: " + error.message);
  }
});
