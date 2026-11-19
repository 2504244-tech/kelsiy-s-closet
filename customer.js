"use strict";

const CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

const $ = id => document.getElementById(id);
const money = n => "KSh " + Number(n || 0).toLocaleString("en-KE", {
  maximumFractionDigits: 2
});

let allProducts = [];
let currentCustomer = null;
let cart = [];

try {
  cart = JSON.parse(localStorage.getItem("kc-shopping-cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

function status(id, message, error = false) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "";
}

function addText(parent, tag, value, className = "") {
  const node = document.createElement(tag);
  node.textContent = value == null ? "" : String(value);
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}

function productImagePath(value) {
  const path = String(value || "").trim();
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path.startsWith("image/")
    ? path
    : "image/" + path.replace(/^\.\//, "");
}

function optionsFrom(value) {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function updateBagCount() {
  const count = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0), 0
  );
  if ($("bag-count")) $("bag-count").textContent = count;
}

function saveCart() {
  localStorage.setItem("kc-shopping-cart", JSON.stringify(cart));
  updateBagCount();
  renderCart();
}

function currentCategory() {
  return String($("category-filter")?.value || "all")
    .trim().toLowerCase();
}

function categoryMatches(product, selected) {
  if (!selected || selected === "all" || selected === "all items") {
    return true;
  }

  const category = String(product.category || "").toLowerCase();

  const groups = {
    "women's clothes": ["women", "women's clothes", "clothing", "clothes", "female"],
    "women": ["women", "women's clothes", "clothing", "clothes", "female"],
    "men's clothes": ["men", "men's clothes", "male"],
    "men": ["men", "men's clothes", "male"],
    "kids' clothes": ["kids", "kid", "children", "kids' clothes"],
    "kids": ["kids", "kid", "children", "kids' clothes"],
    "shoes": ["shoes", "shoe", "footwear", "heels", "sneakers", "converse"],
    "accessories": ["accessories", "accessory", "jewellery", "jewelry", "rings", "necklaces", "earrings"]
  };

  return (groups[selected] || [selected]).some(
    word => category === word || category.includes(word)
  );
}

function displayProducts() {
  const container = $("customer-products");
  if (!container) return;

  container.replaceChildren();

  const products = allProducts.filter(
    product => categoryMatches(product, currentCategory())
  );

  if (!products.length) {
    addText(container, "p", allProducts.length
      ? "There are no products in this category yet."
      : "No products are available right now.");
    return;
  }

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";

    const image = document.createElement("img");
    image.className = "customer-product-image";
    image.alt = product.name || "Fashion product";
    image.loading = "lazy";

    const path = productImagePath(
      product.image_url || product.image || product.image_path
    );

    if (path) image.src = path;
    image.onerror = () => image.removeAttribute("src");
    card.appendChild(image);

    const details = document.createElement("div");
    details.className = "customer-product-details";

    addText(details, "h3", product.name || "Fashion item");
    addText(details, "p", money(product.price), "customer-product-price");

    if (product.description) {
      addText(details, "p", product.description);
    }

    const stock = Math.max(0, Number(product.stock) || 0);
    addText(details, "p", stock ? stock + " item(s) available" : "SOLD OUT");

    const colors = optionsFrom(product.color || product.colour);
    const sizes = optionsFrom(product.size);

    let colorSelect = null;
    let sizeSelect = null;

    if (colors.length) {
      const label = addText(details, "label", "Choose colour ");
      colorSelect = document.createElement("select");
      colorSelect.setAttribute("aria-label", "Choose colour");
      colors.forEach(color => colorSelect.add(new Option(color, color)));
      label.appendChild(colorSelect);
    }

    if (sizes.length) {
      const label = addText(details, "label", "Choose size ");
      sizeSelect = document.createElement("select");
      sizeSelect.setAttribute("aria-label", "Choose size");
      sizes.forEach(size => sizeSelect.add(new Option(size, size)));
      label.appendChild(sizeSelect);
    }

    const quantityLabel = addText(details, "label", "Quantity ");
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.max = String(stock);
    quantityInput.value = "1";
    quantityInput.required = true;
    quantityInput.disabled = stock < 1;
    quantityLabel.appendChild(quantityInput);

    const add = addText(
      details,
      "button",
      stock ? "ADD TO BAG" : "SOLD OUT",
      "kc-button kc-add-button"
    );
    add.type = "button";
    add.disabled = stock < 1;

    add.addEventListener("click", () => {
      const quantity = Number(quantityInput.value);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
        alert("Choose a whole-number quantity from 1 to " + stock + ".");
        return;
      }

      const color = colorSelect ? colorSelect.value : "";
      const size = sizeSelect ? sizeSelect.value : "";
      const key = String(product.id) + "|" + color + "|" + size;
      const existing = cart.find(item => item.key === key);

      if (existing) {
        if (existing.quantity + quantity > stock) {
          alert("Only " + stock + " item(s) are available.");
          return;
        }
        existing.quantity += quantity;
      } else {
        cart.push({
          key,
          product_id: product.id,
          name: product.name,
          image_url: product.image_url || product.image || product.image_path || "",
          color,
          size,
          quantity,
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
  const container = $("customer-products");
  if (!container) return;

  status("catalogue-message", "Loading our collection...");

  const { data, error } = await customerDB
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products:", error);
    status("catalogue-message", "Products could not load: " + error.message, true);
    return;
  }

  allProducts = data || [];

  cart = cart.filter(item =>
    allProducts.some(p => String(p.id) === String(item.product_id))
  ).map(item => {
    const product = allProducts.find(
      p => String(p.id) === String(item.product_id)
    );

    return {
      ...item,
      name: product.name,
      image_url: product.image_url || product.image || product.image_path || "",
      unit_price: Number(product.price) || 0,
      available_stock: Number(product.stock) || 0
    };
  });

  displayProducts();
  saveCart();
  status("catalogue-message", allProducts.length + " product(s) available.");
}

function calculateTotals() {
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0
  );

  const code = ($("discount-code")?.value || "").trim().toUpperCase();
  const discount = code === "KC10" ? subtotal * 0.10 : 0;
  const method = $("delivery-method")?.value || "delivery";
  const area = $("delivery-area")?.value || "near_shop";

  const fee = method === "pickup" ? 0 :
    area === "near_shop" ? 200 :
    area === "nairobi" ? 500 : 800;

  return {
    subtotal,
    discount,
    fee,
    total: Math.max(0, subtotal - discount + fee),
    code,
    method,
    area
  };
}

function renderCart() {
  const container = $("cart-items");
  if (!container) return;

  container.replaceChildren();

  if (!cart.length) {
    addText(container, "p", "Your bag is empty. Add products from Our Collection to begin.");
  }

  cart.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "kc-cart-line";

    const image = document.createElement("img");
    image.alt = item.name || "Product";
    const path = productImagePath(item.image_url);
    if (path) image.src = path;
    image.onerror = () => image.removeAttribute("src");
    row.appendChild(image);

    const details = document.createElement("div");
    addText(details, "h3", item.name);

    if (item.color) addText(details, "p", "Colour: " + item.color);
    if (item.size) addText(details, "p", "Size: " + item.size);

    addText(details, "p", money(item.unit_price) + " each");

    const label = addText(details, "label", "Quantity ");
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(Math.max(1, Number(item.available_stock) || 1));
    quantity.value = String(item.quantity);
    label.appendChild(quantity);

    quantity.addEventListener("change", () => {
      const value = Number(quantity.value);
      const stock = Number(item.available_stock) || 0;

      if (!Number.isInteger(value) || value < 1 || value > stock) {
        alert("Quantity must be between 1 and " + stock + ".");
        quantity.value = String(item.quantity);
        return;
      }

      cart[index].quantity = value;
      saveCart();
    });

    const remove = addText(
      details, "button", "REMOVE", "kc-button kc-button-outline"
    );
    remove.type = "button";
    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      saveCart();
    });

    row.appendChild(details);
    container.appendChild(row);
  });

  const totals = calculateTotals();

  if ($("cart-subtotal")) $("cart-subtotal").textContent = money(totals.subtotal);
  if ($("cart-discount")) {
    $("cart-discount").textContent = totals.discount
      ? "−" + money(totals.discount) + " (KC10)"
      : money(0);
  }
  if ($("cart-delivery")) {
    $("cart-delivery").textContent = totals.method === "pickup"
      ? "Free pickup" : money(totals.fee);
  }
  if ($("cart-total")) $("cart-total").textContent = money(totals.total);

  updateBagCount();
}

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

  if ($("order-email") && !$("order-email").value) {
    $("order-email").value = currentCustomer.email || "";
  }

  if ($("contact-email") && !$("contact-email").value) {
    $("contact-email").value = currentCustomer.email || "";
  }
}

function setMinimumDates() {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  ["delivery-date", "pickup-date"].forEach(id => {
    const input = $(id);
    if (input) {
      input.min = today;
      if (!input.value) input.value = today;
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

async function loadMyOrders() {
  const list = $("my-orders-list");
  if (!list) return;

  list.replaceChildren();
  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    status("my-orders-status", "Please sign in to view your orders.");
    return;
  }

  status("my-orders-status", "Loading your orders...");

  const { data, error } = await customerDB
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    status("my-orders-status", "Orders could not load: " + error.message, true);
    return;
  }

  if (!data?.length) {
    status("my-orders-status", "You have not placed any orders yet.");
    return;
  }

  status("my-orders-status", data.length + " order(s) found.");

  for (const order of data) {
    const card = document.createElement("article");
    card.className = "kc-order-card";

    addText(card, "h3", "Order " + String(order.id).slice(0, 8).toUpperCase());
    addText(card, "p", "Placed: " + new Date(order.created_at).toLocaleString("en-KE"));
    addText(card, "p", "Total: " + money(order.total));
    addText(card, "p", "Payment: " + (order.payment_method || "Not specified") +
      " — " + (order.payment_status || "unpaid"));
    addText(card, "p", "Order status: " +
      (order.order_status || "awaiting confirmation"));

    const destination = order.fulfillment_type === "pickup"
      ? "Shop pickup"
      : [order.delivery_address, order.town, order.county].filter(Boolean).join(", ");

    addText(card, "p",
      (order.fulfillment_type || "delivery") + ": " +
      (destination || "Address not provided") + " · " +
      (order.scheduled_date || "Date not set") + " " +
      (order.scheduled_slot || order.schedule_slot || "Time not set")
    );

    const { data: items, error: itemError } = await customerDB
      .from("order_items")
      .select("product_name,color,size,quantity,unit_price,line_total")
      .eq("order_id", order.id);

    if (itemError) {
      addText(card, "p", "Order items could not load: " + itemError.message);
    } else {
      (items || []).forEach(item => {
        addText(card, "p",
          item.product_name +
          (item.color ? " (" + item.color + ")" : "") +
          (item.size ? " / " + item.size : "") +
          " × " + item.quantity + " — " +
          money(item.line_total ?? Number(item.unit_price) * Number(item.quantity))
        );
      });
    }

    list.appendChild(card);
  }
}

async function placeOrder(event) {
  event.preventDefault();

  if (!cart.length) {
    status("checkout-status", "Your bag is empty. Add a product first.", true);
    return;
  }

  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    status("checkout-status",
      "Please sign in to your customer account before placing an order.", true);
    return;
  }

  const totals = calculateTotals();

  if (totals.code && totals.code !== "KC10") {
    status("checkout-status",
      "That discount code is not valid. Use KC10 or remove the code.", true);
    return;
  }

  const name = (
    ($("order-first-name")?.value.trim() || "") + " " +
    ($("order-last-name")?.value.trim() || "")
  ).trim();

  const phone = $("order-phone")?.value.trim() || "";
  const email = $("order-email")?.value.trim() || user.email || "";
  const fulfillment = $("delivery-method")?.value || "delivery";
  const paymentChoice = ($("payment-method")?.value || "cash").toLowerCase();
  const area = $("delivery-area")?.value || "near_shop";
  const pickup = fulfillment === "pickup";

  const date = pickup ? $("pickup-date")?.value : $("delivery-date")?.value;
  const time = pickup ? $("pickup-time")?.value : $("delivery-time")?.value;
  const address = pickup ? null : ($("delivery-location")?.value.trim() || "");

  if (!name || !phone || !email) {
    status("checkout-status", "Enter your name, phone number and email.", true);
    return;
  }

  if (!date || !time) {
    status("checkout-status", "Choose your preferred date and time.", true);
    return;
  }

  if (!pickup && !address) {
    status("checkout-status", "Enter your delivery address or location.", true);
    return;
  }

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  if (date < today) {
    status("checkout-status", "Choose today or a future date.", true);
    return;
  }

  const button = $("place-order-button");
  if (button) button.disabled = true;
  status("checkout-status", "Checking stock and saving your order...");

  let savedOrder = null;

  try {
    for (const item of cart) {
      const { data: product, error } = await customerDB
        .from("products")
        .select("id,name,stock,active,price")
        .eq("id", item.product_id)
        .maybeSingle();

      if (error) throw error;

      if (!product || product.active === false ||
          Number(product.stock) < Number(item.quantity)) {
        throw new Error("Stock changed for " + item.name +
          ". Refresh the collection and review your bag.");
      }
    }

    const fee = pickup ? 0 :
      area === "near_shop" ? 200 :
      area === "nairobi" ? 500 : 800;

    const total = Math.max(0, totals.subtotal - totals.discount + fee);
    const mpesa = paymentChoice === "mpesa" || paymentChoice === "demo mpesa";

    const payload = {
      customer_id: user.id,
      customer_name: name,
      customer_email: email,
      customer_phone_number: phone,
      fulfillment_type: fulfillment,
      delivery_area: pickup ? "pickup" : area,
      county: null,
      town: null,
      delivery_address: address,
      delivery_fee: fee,
      scheduled_date: date,
      scheduled_slot: time,
      schedule_slot: time,
      subtotal: totals.subtotal,
      discount_code: totals.discount ? totals.code : null,
      discount_amount: totals.discount,
      total,
      payment_method: mpesa ? "demo mpesa" : "cash on delivery",
      payment_status: mpesa ? "simulated" : "unpaid",
      mpesa_phone: mpesa ? phone : null,
      order_status: "awaiting confirmation"
    };

    const { data: order, error: orderError } = await customerDB
      .from("orders")
      .insert(payload)
      .select("*")
      .single();

    if (orderError) throw orderError;
    savedOrder = order;

    const items = cart.map(item => ({
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
      .insert(items);

    if (itemsError) {
      throw new Error("Order " + String(order.id).slice(0, 8).toUpperCase() +
        " was created, but item details failed to save: " + itemsError.message);
    }

    cart = [];
    saveCart();

    if ($("checkout-form")) $("checkout-form").reset();

    setMinimumDates();
    updateCheckoutFields();
    updateCustomerInfo();

    status("checkout-status",
      "Order placed successfully! Reference: " +
      String(order.id).slice(0, 8).toUpperCase() +
      ". Payment status: " + order.payment_status +
      ". The owner will confirm your order.");

    await loadMyOrders();
  } catch (error) {
    console.error("Checkout error:", error);
    status("checkout-status",
      (savedOrder
        ? "Order was created, but a later step failed: "
        : "Order could not be placed: ") +
      (error.message || "Unknown error"), true);
  } finally {
    if (button) button.disabled = false;
  }
}

/* Checkout and category controls */
$("category-filter")?.addEventListener("change", displayProducts);

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    const filter = $("category-filter");
    if (filter) filter.value = button.dataset.category;
    displayProducts();
  });
});

$("delivery-method")?.addEventListener("change", updateCheckoutFields);
$("delivery-area")?.addEventListener("change", renderCart);
$("discount-code")?.addEventListener("input", renderCart);

$("checkout-toggle")?.addEventListener("click", () => {
  if (!cart.length) {
    status("checkout-status", "Your shopping bag is empty. Add a product first.", true);
    $("shopping-bag")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const form = $("checkout-form");

  if (!form) {
    status("checkout-status", "Checkout form is missing from customer.html.", true);
    return;
  }

  form.hidden = false;
  updateCheckoutFields();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("back-to-bag")?.addEventListener("click", () => {
  if ($("checkout-form")) $("checkout-form").hidden = true;
  $("shopping-bag")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("checkout-form")?.addEventListener("submit", placeOrder);

/* Customer messages */
$("customer-contact-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const user = currentCustomer || await loadCustomerAccount();

  if (!user) {
    status("contact-status", "Please sign in before sending a message.", true);
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  status("contact-status", "Sending message...");

  try {
    const { error } = await customerDB.from("messages").insert({
      customer_name: $("contact-name")?.value.trim() || "",
      customer_email: user.email,
      subject: "Customer enquiry",
      message: $("contact-message")?.value.trim() || ""
    });

    if (error) throw error;

    event.currentTarget.reset();
    status("contact-status", "Your message was sent successfully.");
  } catch (error) {
    status("contact-status", "Message could not be sent: " + error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
});

/* FIXED CUSTOMER SIGN OUT */
document.addEventListener("click", async event => {
  const button = event.target.closest("#customer-signout");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  if (button.dataset.signingOut === "true") return;

  button.dataset.signingOut = "true";
  button.disabled = true;

  const originalText = button.textContent;
  button.textContent = "Signing out...";

  try {
    const { error } = await customerDB.auth.signOut();
    if (error) throw error;

    localStorage.removeItem("kc-shopping-cart");
    window.location.replace("index.html");
  } catch (error) {
    console.error("Customer sign-out failed:", error);
    button.disabled = false;
    button.dataset.signingOut = "false";
    button.textContent = originalText;
    alert("Could not sign out: " + (error.message || "Please try again."));
  }
});

async function loadCustomerPage() {
  await loadCustomerAccount();
  updateCustomerInfo();
  setMinimumDates();
  updateCheckoutFields();

  if (currentCustomer) {
    const fullName = String(
      currentCustomer.user_metadata?.full_name || ""
    ).trim();

    const parts = fullName ? fullName.split(/\s+/) : [];

    if ($("order-first-name") && !$("order-first-name").value) {
      $("order-first-name").value = parts.shift() || "";
    }

    if ($("order-last-name") && !$("order-last-name").value) {
      $("order-last-name").value = parts.join(" ");
    }
  }

  await loadCustomerProducts();
  renderCart();
  await loadMyOrders();
}

loadCustomerPage();

window.addEventListener("focus", () => {
  loadCustomerProducts();
  loadMyOrders();
});

customerDB.channel("kc-customer-product-updates")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "products"
  }, loadCustomerProducts)
  .subscribe();
