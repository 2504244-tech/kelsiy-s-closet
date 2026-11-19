"use strict";

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

let ownerUser = null;
let allOrders = [];
let allProducts = [];
let allSales = [];

const money = value =>
  "KES " + Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function message(id, text, type = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
}

function addCell(row, value) {
  const td = row.insertCell();
  td.textContent = value == null ? "" : String(value);
  return td;
}

function multilineCell(row, values) {
  const td = row.insertCell();
  td.style.whiteSpace = "pre-line";
  td.textContent = values.filter(v => v !== null && v !== undefined && v !== "")
    .join("\n");
  return td;
}

function showError(id, error) {
  console.error(error);
  message(id, error.message || String(error), "error");
}

function button(text, action) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", action);
  return b;
}

function field(labelText, value = "", type = "text") {
  const label = document.createElement("label");
  label.textContent = labelText;
  label.style.display = "block";
  label.style.margin = "8px 0";

  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.style.display = "block";
  input.style.width = "100%";

  label.appendChild(input);
  return { label, input };
}

function selectField(labelText, values, selected = "") {
  const label = document.createElement("label");
  label.textContent = labelText;
  label.style.display = "block";
  label.style.margin = "8px 0";

  const select = document.createElement("select");
  select.style.display = "block";
  select.style.width = "100%";

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value || "Select";
    select.appendChild(option);
  });

  select.value = selected;
  label.appendChild(select);
  return { label, input: select };
}

/* NAVIGATION */

document.querySelectorAll("nav [data-view]").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $("view-" + name)?.classList.remove("hidden");

  if (name === "overview") loadOverview();
  if (name === "orders") loadOrders();
  if (name === "inventory") loadProducts();
  if (name === "sales") loadSales();
}

/* AUTHENTICATION AND OWNER ROLE */

async function verifyOwner(user) {
  const { data, error } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data || String(data.role).toLowerCase() !== "owner") {
    await db.auth.signOut();
    throw new Error(
      "This account is not registered with the owner role. Please use the correct owner account."
    );
  }
}

async function openDashboard(user) {
  await verifyOwner(user);

  ownerUser = user;
  $("login-section").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logout-button").classList.remove("hidden");

  await loadOverview();
}

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();

  const btn = $("login-button");
  btn.disabled = true;
  message("login-message", "Signing in...");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("login-email").value.trim(),
      password: $("login-password").value
    });

    if (error) throw error;
    await openDashboard(data.user);
  } catch (error) {
    ownerUser = null;
    $("dashboard").classList.add("hidden");
    $("login-section").classList.remove("hidden");
    showError("login-message", error);
  } finally {
    btn.disabled = false;
  }
});

$("logout-button").addEventListener("click", async () => {
  await db.auth.signOut();
  ownerUser = null;
  allOrders = [];
  allProducts = [];
  allSales = [];

  $("dashboard").classList.add("hidden");
  $("logout-button").classList.add("hidden");
  $("login-section").classList.remove("hidden");
  $("login-password").value = "";

  message("login-message", "You have signed out.", "success");
});

(async function restoreSession() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await openDashboard(data.session.user);
    }
  } catch (error) {
    console.error("Session restore:", error);
    message("login-message", error.message, "error");
  }
})();

/* OVERVIEW */

async function loadOverview() {
  if (!ownerUser) return;

  message("overview-message", "Loading dashboard...");

  try {
    const [products, orders, sales, pending] = await Promise.all([
      db.from("products").select("id", { count: "exact", head: true }),
      db.from("orders").select("id", { count: "exact", head: true }),
      db.from("sales").select("id", { count: "exact", head: true }),
      db.from("orders")
        .select("id", { count: "exact", head: true })
        .eq("order_status", "awaiting confirmation")
    ]);

    if (products.error) throw products.error;
    if (orders.error) throw orders.error;
    if (sales.error) throw sales.error;
    if (pending.error) throw pending.error;

    $("product-count").textContent = products.count ?? 0;
    $("order-count").textContent = orders.count ?? 0;
    $("sales-count").textContent = sales.count ?? 0;
    $("pending-count").textContent = pending.count ?? 0;

    message("overview-message", "Dashboard refreshed successfully.", "success");
  } catch (error) {
    showError("overview-message", error);
  }
}

$("refresh-all").addEventListener("click", async () => {
  await loadOverview();
  await loadOrders();
  await loadProducts();
  await loadSales();
});

/* INVENTORY */

function ensureInventoryForm() {
  if ($("product-form")) return;

  const panel = $("view-inventory").querySelector(".panel");
  const form = document.createElement("form");
  form.id = "product-form";
  form.className = "panel";
  form.style.marginTop = "15px";

  const heading = document.createElement("h3");
  heading.textContent = "Add a Product";
  form.appendChild(heading);

  const inputs = {};
  [
    ["name", "Product name", "text"],
    ["category", "Category (Women, Men, Accessories)", "text"],
    ["description", "Description", "text"],
    ["size", "Size", "text"],
    ["color", "Colour", "text"],
    ["price", "Price (KES)", "number"],
    ["stock", "Opening stock", "number"],
    ["image_url", "Image path (e.g. image/dress.jpg)", "text"]
  ].forEach(([key, label, type]) => {
    const item = field(label, "", type);
    item.input.name = key;

    if (key === "price") {
      item.input.min = "0";
      item.input.step = "0.01";
    }
    if (key === "stock") {
      item.input.min = "0";
      item.input.step = "1";
    }

    inputs[key] = item.input;
    form.appendChild(item.label);
  });

  const active = document.createElement("label");
  active.style.display = "block";
  const activeInput = document.createElement("input");
  activeInput.type = "checkbox";
  activeInput.checked = true;
  active.append(activeInput, document.createTextNode(" Available for sale"));
  form.appendChild(active);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "ADD PRODUCT";
  form.appendChild(submit);

  const cancel = button("CLEAR FORM", () => form.reset());
  cancel.style.marginLeft = "8px";
  form.appendChild(cancel);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const name = inputs.name.value.trim();
    const price = Number(inputs.price.value);
    const stock = Number(inputs.stock.value);

    if (!name || inputs.price.value === "" || inputs.stock.value === "") {
      message("inventory-status", "Enter the product name, price and stock.", "error");
      return;
    }

    if (!Number.isFinite(price) || price < 0 ||
        !Number.isInteger(stock) || stock < 0) {
      message("inventory-status", "Price must be non-negative and stock must be a whole number.", "error");
      return;
    }

    submit.disabled = true;

    try {
      const payload = {
        name,
        category: inputs.category.value.trim() || "Women",
        description: inputs.description.value.trim(),
        size: inputs.size.value.trim(),
        color: inputs.color.value.trim(),
        price,
        stock,
        image_url: inputs.image_url.value.trim() || null,
        active: activeInput.checked,
        updated_at: new Date().toISOString()
      };

      const { error } = await db.from("products").insert(payload);
      if (error) throw error;

      form.reset();
      activeInput.checked = true;
      message("inventory-status", "Product added successfully.", "success");
      await loadProducts();
      await loadOverview();
    } catch (error) {
      showError("inventory-status", error);
    } finally {
      submit.disabled = false;
    }
  });

  panel.insertBefore(form, panel.querySelector(".table-wrap"));
}

async function loadProducts() {
  if (!ownerUser) return;

  ensureInventoryForm();
  $("refresh-products").disabled = true;
  message("inventory-status", "Loading inventory...");

  try {
    const { data, error } = await db
      .from("products")
      .select("id,name,category,description,size,color,price,stock,image_url,active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allProducts = data || [];
    renderProducts();
    message("inventory-status", `${allProducts.length} product(s) loaded.`, "success");
  } catch (error) {
    showError("inventory-status", error);
  } finally {
    $("refresh-products").disabled = false;
  }
}

function renderProducts() {
  const body = $("products-table");
  body.replaceChildren();

  const query = $("product-search").value.trim().toLowerCase();
  const products = allProducts.filter(p =>
    [p.name, p.category, p.description, p.size, p.color]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  if (!products.length) {
    addCell(body.insertRow(), "No products found.").colSpan = 4;
    return;
  }

  products.forEach(product => {
    const row = body.insertRow();

    const productCell = row.insertCell();
    productCell.textContent = product.name || "Unnamed product";

    if (product.image_url) {
      const image = document.createElement("img");
      image.src = product.image_url;
      image.alt = product.name || "Product image";
      image.style.width = "75px";
      image.style.height = "75px";
      image.style.objectFit = "cover";
      image.style.display = "block";
      image.onerror = () => {
        image.alt = "Image unavailable: check image path";
        image.removeAttribute("src");
      };
      productCell.appendChild(image);
    }

    const details = document.createElement("small");
    details.textContent =
      `${product.category || ""} | Size: ${product.size || "—"} | Colour: ${product.color || "—"} | ${product.active ? "Active" : "Hidden"}`;
    productCell.appendChild(document.createElement("br"));
    productCell.appendChild(details);

    addCell(row, money(product.price));

    const stockCell = row.insertCell();
    const stockInput = document.createElement("input");
    stockInput.type = "number";
    stockInput.min = "0";
    stockInput.step = "1";
    stockInput.value = product.stock ?? 0;
    stockCell.appendChild(stockInput);
    stockCell.appendChild(button("RESTOCK", async () => {
      const amount = Number(stockInput.value);
      if (!Number.isInteger(amount) || amount < 0) {
        message("inventory-status", "Stock must be a whole number of zero or more.", "error");
        return;
      }

      try {
        const { error } = await db.from("products")
          .update({ stock: amount, updated_at: new Date().toISOString() })
          .eq("id", product.id);

        if (error) throw error;
        message("inventory-status", "Stock updated.", "success");
        await loadProducts();
      } catch (error) {
        showError("inventory-status", error);
      }
    }));

    const detailsCell = row.insertCell();
    detailsCell.appendChild(button("EDIT", () => editProduct(product)));
    detailsCell.appendChild(document.createElement("br"));

    detailsCell.appendChild(button("DELETE", async () => {
      if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

      try {
        const { error } = await db.from("products").delete().eq("id", product.id);
        if (error) throw error;
        message("inventory-status", "Product deleted.", "success");
        await loadProducts();
        await loadOverview();
      } catch (error) {
        showError("inventory-status", error);
      }
    }));
  });
}

async function editProduct(product) {
  const name = prompt("Product name:", product.name || "");
  if (name === null) return;

  const priceText = prompt("Price (KES):", String(product.price ?? 0));
  if (priceText === null) return;

  const stockText = prompt("Stock quantity:", String(product.stock ?? 0));
  if (stockText === null) return;

  const category = prompt("Category:", product.category || "");
  if (category === null) return;

  const description = prompt("Description:", product.description || "");
  if (description === null) return;

  const size = prompt("Size:", product.size || "");
  if (size === null) return;

  const color = prompt("Colour:", product.color || "");
  if (color === null) return;

  const image = prompt("Image path:", product.image_url || "");
  if (image === null) return;

  const price = Number(priceText);
  const stock = Number(stockText);

  if (!name.trim() || priceText.trim() === "" || !Number.isFinite(price) ||
      price < 0 || !Number.isInteger(stock) || stock < 0) {
    message("inventory-status", "Enter a name, valid price and whole-number stock.", "error");
    return;
  }

  try {
    const { error } = await db.from("products").update({
      name: name.trim(),
      price,
      stock,
      category: category.trim(),
      description: description.trim(),
      size: size.trim(),
      color: color.trim(),
      image_url: image.trim() || null,
      updated_at: new Date().toISOString()
    }).eq("id", product.id);

    if (error) throw error;

    message("inventory-status", "Product updated.", "success");
    await loadProducts();
  } catch (error) {
    showError("inventory-status", error);
  }
}

$("refresh-products").addEventListener("click", loadProducts);
$("product-search").addEventListener("input", renderProducts);

/* CUSTOMER ORDERS */

async function loadOrders() {
  if (!ownerUser) return;

  message("orders-status", "Loading customer orders...");

  try {
    const { data, error } = await db.from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    allOrders = data || [];
    renderOrders();
    message("orders-status", `${allOrders.length} order(s) loaded.`, "success");
  } catch (error) {
    showError("orders-status", error);
  }
}

async function renderOrders() {
  const body = $("orders-table");
  body.replaceChildren();

  const query = $("order-search").value.trim().toLowerCase();
  const orders = allOrders.filter(o =>
    [o.id, o.customer_name, o.customer_email, o.customer_phone_number]
      .some(v => String(v || "").toLowerCase().includes(query))
  );

  if (!orders.length) {
    addCell(body.insertRow(), "No customer orders found.").colSpan = 8;
    return;
  }

  for (const order of orders) {
    const row = body.insertRow();

    multilineCell(row, [
      String(order.id).slice(0, 8).toUpperCase(),
      order.created_at ? new Date(order.created_at).toLocaleString("en-KE") : ""
    ]);

    multilineCell(row, [
      order.customer_name,
      order.customer_email,
      order.customer_phone_number
    ]);

    const itemsCell = row.insertCell();
    itemsCell.textContent = "Loading items...";

    try {
      const { data, error } = await db.from("order_items")
        .select("product_name,quantity,unit_price,size,color,line_total")
        .eq("order_id", order.id);

      if (error) throw error;

      itemsCell.style.whiteSpace = "pre-line";
      itemsCell.textContent = (data || []).map(item =>
        `${item.product_name || "Product"} | Size: ${item.size || "—"} | Colour: ${item.color || "—"} | Qty: ${item.quantity} | ${money(item.line_total ?? Number(item.unit_price || 0) * Number(item.quantity || 0))}`
      ).join("\n") || "No items found";
    } catch (error) {
      itemsCell.textContent = "Could not load items";
      console.error("Order items:", error);
    }

    const pickup = (order.fulfillment_type || order.delivery_method || order.customer_fulfillment_type) === "pickup";
    multilineCell(row, [
      pickup ? "Pickup" : "Delivery",
      order.delivery_address || order.delivery_location || order.town || order.delivery_area || "",
      "Date: " + (order.schedule_date || order.delivery_date || "Not specified"),
      "Time: " + (order.schedule_slot || order.delivery_time || order.fulfillment_time || "Not specified"),
      "Fee: " + money(order.delivery_fee)
    ]);

    addCell(row, money(order.total));

    multilineCell(row, [
      "Method: " + (order.payment_method || "Not specified"),
      "Status: " + (order.payment_status || "unpaid")
    ]);

    addCell(row, order.order_status || "awaiting confirmation");

    const actionCell = row.insertCell();

    const status = selectField("Order status", [
      "awaiting confirmation", "confirmed", "completed", "cancelled"
    ], order.order_status || "awaiting confirmation");

    const payment = selectField("Payment status", [
      "unpaid", "paid", "pending", "paid_simulated", "refunded"
    ], order.payment_status || "unpaid");

    const fee = field("Delivery fee (KES)", String(order.delivery_fee || 0), "number");
    fee.input.min = "0";
    fee.input.step = "1";
    fee.input.disabled = pickup;

    actionCell.append(status.label, payment.label, fee.label);

    actionCell.appendChild(button("SAVE CHANGES", async () => {
      const deliveryFee = pickup ? 0 : Number(fee.input.value);

      if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
        message("orders-status", "Enter a valid delivery fee.", "error");
        return;
      }

      if (payment.input.value === "paid" &&
          order.payment_status !== "paid") {
        if (!confirm("Have you actually received and verified this payment?")) return;
      }

      if (status.input.value === "confirmed" &&
          order.order_status !== "confirmed") {
        if (!confirm("Confirm this order? This does not confirm that payment has been received.")) return;
      }

      const subtotal = Number(order.subtotal || 0);
      const discount = Number(order.discount_amount || 0);
      const total = Math.max(0, subtotal - discount + deliveryFee);

      try {
        const { data, error } = await db.from("orders")
          .update({
            order_status: status.input.value,
            payment_status: payment.input.value,
            delivery_fee: deliveryFee,
            total
          })
          .eq("id", order.id)
          .select("id");

        if (error) throw error;
        if (!data?.length) {
          throw new Error("No order updated. Check the Supabase permissions.");
        }

        message("orders-status", "Order updated. Payment was not marked received unless you selected and verified 'paid'.", "success");
        await loadOrders();
        await loadOverview();
      } catch (error) {
        showError("orders-status", error);
      }
    }));
  }
}

$("refresh-orders").addEventListener("click", loadOrders);
$("order-search").addEventListener("input", renderOrders);

/* SALES */

async function loadSales() {
  if (!ownerUser) return;

  message("sales-status", "Loading sales...");
  $("refresh-sales").disabled = true;

  try {
    const { data, error } = await db.from("sales")
      .select("*")
      .order("sales_date", { ascending: false })
      .limit(500);

    if (error) throw error;

    allSales = data || [];
    renderSales();
    message("sales-status", `${allSales.length} sale(s) loaded.`, "success");
  } catch (error) {
    showError("sales-status", error);
  } finally {
    $("refresh-sales").disabled = false;
  }
}

function renderSales() {
  const body = $("sales-table");
  body.replaceChildren();

  if (!allSales.length) {
    addCell(body.insertRow(), "No sales records found.").colSpan = 6;
    return;
  }

  allSales.forEach(sale => {
    const row = body.insertRow();
    addCell(row, sale.receipt_number || sale.receipt_no || sale.id || "—");
    addCell(row, sale.customer_name || sale.customer_id || "Customer");
    addCell(row, money(sale.total ?? sale.total_amount));
    addCell(row, sale.payment_method || "—");
    addCell(row, sale.payment_status || "—");
    addCell(row, sale.sales_date
      ? new Date(sale.sales_date).toLocaleString("en-KE")
      : "—");
  });
}

$("refresh-sales").addEventListener("click", loadSales);
