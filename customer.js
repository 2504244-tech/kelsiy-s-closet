"use strict";

/* KELSIY'S CLOSET — CUSTOMER SHOPPING SYSTEM
   Uses the existing Supabase project and products table.
*/

const CUSTOMER_SUPABASE_URL =
  "https://zqvjaqpqtctnvylgtwjg.supabase.co";

const CUSTOMER_SUPABASE_KEY =
  "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

let allProducts = [];
let currentCustomer = null;
let shoppingCart = [];
let selectedCategory = "all";
let checkoutBusy = false;

const money = (amount) =>
  "KSh " + Number(amount || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2
  });

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#286749";
}

function splitOptions(value) {
  if (!value) return [];
  return [...new Set(
    String(value)
      .split(/[,;/|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function categoryName(value) {
  return String(value || "Other").trim();
}

function productImage(product) {
  return product.image_url || "";
}

/* Add the shopping design without requiring another CSS file. */
function installShoppingStyles() {
  if ($("kc-shopping-styles")) return;

  const style = document.createElement("style");
  style.id = "kc-shopping-styles";
  style.textContent = `
    :root {
      --kc-burgundy:#701b39;
      --kc-dark:#3e1023;
      --kc-cream:#faf5ed;
      --kc-gold:#c49a58;
    }
    .kc-shop-tools {
      display:flex;flex-wrap:wrap;align-items:center;
      justify-content:space-between;gap:14px;margin:24px 0;
    }
    .kc-category-list {
      display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 24px;
    }
    .kc-category-chip {
      border:1px solid #d8c3c5;border-radius:999px;
      padding:9px 16px;background:#fff;color:var(--kc-dark);
      cursor:pointer;font-weight:700;
    }
    .kc-category-chip.active,.kc-category-chip:hover {
      background:var(--kc-burgundy);color:#fff;border-color:var(--kc-burgundy);
    }
    #customer-products {
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;
    }
    .customer-product-card {
      overflow:hidden;background:#fff;border:1px solid #eadbd5;
      border-radius:12px;box-shadow:0 5px 20px #3e10230c;
      display:flex;flex-direction:column;min-width:0;
    }
    .customer-product-image {
      width:100%;height:270px;object-fit:cover;background:#f1e7df;
    }
    .customer-product-details {padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
    .customer-product-details h3 {margin:0;color:var(--kc-dark);font-size:18px}
    .customer-product-price {font-size:19px;font-weight:800;color:var(--kc-burgundy);margin:0}
    .customer-product-description {font-size:14px;color:#70636a;margin:0}
    .customer-product-stock {font-size:13px;color:#286749;font-weight:700;margin:0}
    .customer-product-stock.out-of-stock {color:#b42318}
    .kc-product-options {display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .kc-product-options label,.kc-checkout-form label {
      display:grid;gap:5px;font-size:12px;font-weight:800;color:var(--kc-dark);
    }
    .kc-product-options select,.kc-product-options input,
    .kc-checkout-form input,.kc-checkout-form select,.kc-checkout-form textarea {
      width:100%;min-width:0;padding:10px;border:1px solid #d9c8c4;
      border-radius:6px;background:#fff;font:inherit;
    }
    .kc-add-cart,.kc-cart-open,.kc-checkout-submit {
      border:0;border-radius:6px;background:var(--kc-burgundy);color:#fff;
      padding:12px 16px;font-weight:800;cursor:pointer;
    }
    .kc-add-cart:disabled,.kc-checkout-submit:disabled {opacity:.5;cursor:not-allowed}
    .kc-cart-open {white-space:nowrap}
    .kc-cart-count {display:inline-grid;place-items:center;min-width:23px;height:23px;
      margin-left:5px;border-radius:50%;background:var(--kc-gold);color:#2c1720}
    .kc-dialog-backdrop {
      position:fixed;inset:0;background:#1b0b13a8;z-index:5000;
      display:flex;align-items:flex-start;justify-content:center;
      padding:20px;overflow:auto;
    }
    .kc-dialog {
      background:var(--kc-cream);color:#292126;width:min(760px,100%);
      margin:auto;border-radius:14px;padding:22px;box-shadow:0 20px 70px #0004;
    }
    .kc-dialog-header {display:flex;align-items:center;justify-content:space-between;gap:12px}
    .kc-dialog-header h2 {margin:0;color:var(--kc-burgundy)}
    .kc-close {border:0;background:transparent;font-size:28px;cursor:pointer}
    .kc-cart-row {display:grid;grid-template-columns:1fr auto;gap:12px;
      border-bottom:1px solid #e5d4d9;padding:14px 0}
    .kc-cart-actions {display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .kc-cart-actions input {width:75px;padding:7px}
    .kc-small-button {padding:7px 10px;border:1px solid #d9c8c4;border-radius:5px;
      background:#fff;cursor:pointer}
    .kc-total-row {display:flex;justify-content:space-between;gap:12px;margin:9px 0}
    .kc-checkout-form {display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}
    .kc-checkout-form .full {grid-column:1/-1}
    .kc-checkout-form textarea {min-height:85px;resize:vertical}
    .kc-notice {padding:12px;background:#f1e6d8;border-radius:7px;font-size:13px}
    .kc-order-status {padding:12px;border-radius:6px;margin-top:12px;white-space:pre-wrap}
    .kc-empty {padding:24px;background:#fff;border-radius:8px;text-align:center}
    #customer-contact-form,#customer-messages-section {display:none!important}
    @media(max-width:850px) {
      #customer-products {grid-template-columns:repeat(2,minmax(0,1fr))}
      .customer-product-image {height:230px}
    }
    @media(max-width:520px) {
      #customer-products {grid-template-columns:1fr 1fr;gap:10px}
      .customer-product-image {height:175px}
      .customer-product-details {padding:11px}
      .customer-product-details h3 {font-size:15px}
      .kc-product-options {grid-template-columns:1fr}
      .kc-dialog-backdrop {padding:8px}
      .kc-dialog {padding:15px}
      .kc-checkout-form {grid-template-columns:1fr}
      .kc-checkout-form .full {grid-column:auto}
      .kc-cart-row {grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);
}

/* Build the shopping bag and checkout window. */
function installShoppingInterface() {
  installShoppingStyles();

  const nav = $("customer-navigation");
  if (nav && !$("kc-cart-button")) {
    const cartButton = document.createElement("button");
    cartButton.id = "kc-cart-button";
    cartButton.type = "button";
    cartButton.className = "kc-cart-open";
    cartButton.innerHTML = 'BAG <span class="kc-cart-count" id="kc-cart-count">0</span>';
    cartButton.addEventListener("click", openCart);
    nav.insertBefore(cartButton, $("customer-signout"));
  }

  const categoryFilter = $("category-filter");
  if (categoryFilter) {
    categoryFilter.hidden = true;
    const categoryBar = document.createElement("div");
    categoryBar.id = "kc-category-list";
    categoryBar.className = "kc-category-list";
    categoryFilter.parentElement.appendChild(categoryBar);
  }

  const oldContactLink = nav?.querySelector('a[href="#contacts"]');
  if (oldContactLink) oldContactLink.remove();

  const oldContactSection = $("contacts");
  if (oldContactSection) oldContactSection.hidden = true;

  if (!$("kc-dialog-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "kc-dialog-backdrop";
    backdrop.className = "kc-dialog-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="kc-dialog" role="dialog" aria-modal="true"
        aria-labelledby="kc-dialog-title">
        <div class="kc-dialog-header">
          <h2 id="kc-dialog-title">Your Shopping Bag</h2>
          <button type="button" class="kc-close" id="kc-close-dialog"
            aria-label="Close">×</button>
        </div>
        <div id="kc-dialog-content"></div>
      </section>`;
    document.body.appendChild(backdrop);

    $("kc-close-dialog").addEventListener("click", closeDialog);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeDialog();
    });
  }
}

function openDialog(title) {
  $("kc-dialog-title").textContent = title;
  $("kc-dialog-backdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDialog() {
  $("kc-dialog-backdrop").hidden = true;
  document.body.style.overflow = "";
}

function updateCartCount() {
  const count = shoppingCart.reduce((sum, item) => sum + item.quantity, 0);
  const target = $("kc-cart-count");
  if (target) target.textContent = String(count);
}

function cartKey(item) {
  return [item.product_id, item.colour || "", item.size || ""].join("::");
}

function addToCart(product, colour, size, quantity) {
  const stock = Number(product.stock || 0);
  if (!Number.isInteger(quantity) || quantity < 1) {
    alert("Choose a valid quantity.");
    return;
  }
  if (stock < 1) {
    alert("Sorry, this item is out of stock.");
    return;
  }

  const item = {
    product_id: String(product.id),
    product_name: product.name,
    colour: colour || null,
    size: size || null,
    quantity,
    unit_price: Number(product.price || 0),
    stock
  };

  const existing = shoppingCart.find((line) => cartKey(line) === cartKey(item));
  const requested = quantity + (existing?.quantity || 0);

  if (requested > stock) {
    alert(`Only ${stock} item(s) are currently available.`);
    return;
  }

  if (existing) existing.quantity = requested;
  else shoppingCart.push(item);

  updateCartCount();
  alert(`${product.name} added to your bag.`);
}

function renderProducts() {
  const container = $("customer-products");
  const message = $("catalogue-message");
  if (!container) return;

  container.replaceChildren();

  const filtered = allProducts.filter((product) => {
    if (selectedCategory === "all") return true;
    return categoryName(product.category).toLowerCase() === selectedCategory;
  });

  if (!filtered.length) {
    if (message) message.textContent = "No products are available in this category yet.";
    container.innerHTML = '<p class="kc-empty">Please check back soon.</p>';
    return;
  }

  if (message) {
    message.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"} in our collection`;
  }

  filtered.forEach((product) => {
    const stock = Math.max(0, Number(product.stock || 0));
    const colours = splitOptions(product.color);
    const sizes = splitOptions(product.size);

    const card = document.createElement("article");
    card.className = "customer-product-card";

    if (productImage(product)) {
      const image = document.createElement("img");
      image.className = "customer-product-image";
      image.src = productImage(product);
      image.alt = product.name || "Fashion item";
      image.loading = "lazy";
      image.onerror = () => {
        image.style.visibility = "hidden";
        image.alt = "Product image unavailable";
      };
      card.appendChild(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "customer-product-image";
      placeholder.style.display = "grid";
      placeholder.style.placeItems = "center";
      placeholder.textContent = "KELSIY'S CLOSET";
      card.appendChild(placeholder);
    }

    const details = document.createElement("div");
    details.className = "customer-product-details";

    const title = document.createElement("h3");
    title.textContent = product.name || "Fashion item";
    details.appendChild(title);

    const price = document.createElement("p");
    price.className = "customer-product-price";
    price.textContent = money(product.price);
    details.appendChild(price);

    if (product.description) {
      const description = document.createElement("p");
      description.className = "customer-product-description";
      description.textContent = product.description;
      details.appendChild(description);
    }

    const category = document.createElement("small");
    category.textContent = categoryName(product.category);
    details.appendChild(category);

    const stockLabel = document.createElement("p");
    stockLabel.className = "customer-product-stock" + (stock < 1 ? " out-of-stock" : "");
    stockLabel.textContent = stock > 0 ? `${stock} available` : "SOLD OUT";
    details.appendChild(stockLabel);

    const options = document.createElement("div");
    options.className = "kc-product-options";

    const colourLabel = document.createElement("label");
    colourLabel.textContent = colours.length ? "Colour" : "Colour (if applicable)";
    const colourSelect = document.createElement("select");
    colourSelect.setAttribute("aria-label", `Colour for ${product.name}`);
    colourSelect.add(new Option(
      colours.length ? "Choose colour" : "No colour option",
      ""
    ));
    colours.forEach((colour) => colourSelect.add(new Option(colour, colour)));
    if (colours.length === 1) colourSelect.value = colours[0];
    colourLabel.appendChild(colourSelect);

    const sizeLabel = document.createElement("label");
    sizeLabel.textContent = sizes.length ? "Size" : "Size (if applicable)";
    const sizeSelect = document.createElement("select");
    sizeSelect.setAttribute("aria-label", `Size for ${product.name}`);
    sizeSelect.add(new Option(sizes.length ? "Choose size" : "No size option", ""));
    sizes.forEach((size) => sizeSelect.add(new Option(size, size)));
    if (sizes.length === 1) sizeSelect.value = sizes[0];
    sizeLabel.appendChild(sizeSelect);

    options.append(colourLabel, sizeLabel);
    details.appendChild(options);

    const quantityLabel = document.createElement("label");
    quantityLabel.textContent = "Quantity";
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.max = String(Math.max(1, stock));
    quantityInput.value = "1";
    quantityInput.step = "1";
    quantityInput.disabled = stock < 1;
    quantityLabel.appendChild(quantityInput);
    details.appendChild(quantityLabel);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "kc-add-cart";
    addButton.textContent = stock > 0 ? "ADD TO BAG" : "SOLD OUT";
    addButton.disabled = stock < 1;

    addButton.addEventListener("click", () => {
      const colour = colourSelect.value || (colours.length === 1 ? colours[0] : "");
      const size = sizeSelect.value || (sizes.length === 1 ? sizes[0] : "");
      const quantity = Number(quantityInput.value);

      if (colours.length > 1 && !colour) {
        alert("Please choose a colour first.");
        return;
      }
      if (sizes.length > 1 && !size) {
        alert("Please choose a size first.");
        return;
      }

      addToCart(product, colour, size, quantity);
    });

    details.appendChild(addButton);
    card.appendChild(details);
    container.appendChild(card);
  });
}

function renderCategories() {
  const categoryBar = $("kc-category-list");
  if (!categoryBar) return;

  categoryBar.replaceChildren();

  const categories = [
    { label: "All Products", value: "all" },
    ...[...new Set(allProducts.map((p) =>
      categoryName(p.category).toLowerCase()
    ))].sort().map((value) => ({
      label: allProducts.find((p) =>
        categoryName(p.category).toLowerCase() === value
      )?.category || value,
      value
    }))
  ];

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kc-category-chip" +
      (selectedCategory === category.value ? " active" : "");
    button.textContent = category.label;
    button.addEventListener("click", () => {
      selectedCategory = category.value;
      renderCategories();
      renderProducts();
    });
    categoryBar.appendChild(button);
  });
}

async function loadCustomerProducts() {
  const message = $("catalogue-message");
  if (message) message.textContent = "Loading our collection…";

  const { data, error } = await customerDB
    .from("products")
    .select("id,name,category,description,size,color,price,stock,image_url,active,created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product loading error:", error);
    if (message) {
      message.textContent = "We could not load products. Please refresh and try again.";
    }
    return;
  }

  allProducts = data || [];
  renderCategories();
  renderProducts();
}

async function loadSignedInCustomer() {
  const { data, error } = await customerDB.auth.getUser();
  if (error || !data?.user) {
    currentCustomer = null;
    window.location.replace("index.html");
    return null;
  }

  currentCustomer = data.user;
  return currentCustomer;
}

/* SHOPPING BAG */
function openCart() {
  renderCart();
  openDialog("Your Shopping Bag");
}

function renderCart() {
  const content = $("kc-dialog-content");
  if (!content) return;

  if (!shoppingCart.length) {
    content.innerHTML = `
      <div class="kc-empty">
        <p>Your shopping bag is empty.</p>
        <button type="button" class="kc-add-cart" id="kc-continue-shopping">
          CONTINUE SHOPPING
        </button>
      </div>`;
    $("kc-continue-shopping").addEventListener("click", closeDialog);
    return;
  }

  content.innerHTML = shoppingCart.map((item, index) => `
    <article class="kc-cart-row">
      <div>
        <strong>${escapeHTML(item.product_name)}</strong>
        <p>${item.colour ? `Colour: ${escapeHTML(item.colour)}` : ""}
        ${item.size ? ` · Size: ${escapeHTML(item.size)}` : ""}</p>
        <p>${money(item.unit_price)} each</p>
        <div class="kc-cart-actions">
          <label>Quantity
            <input type="number" min="1" max="${item.stock}"
              value="${item.quantity}" data-cart-quantity="${index}">
          </label>
          <button type="button" class="kc-small-button"
            data-remove-cart="${index}">Remove</button>
        </div>
      </div>
      <strong>${money(item.unit_price * item.quantity)}</strong>
    </article>
  `).join("") + `
    <div class="kc-total-row"><span>Subtotal</span>
      <strong>${money(cartSubtotal())}</strong></div>
    <div class="kc-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
      <button type="button" class="kc-small-button" id="kc-keep-shopping">
        Keep Shopping
      </button>
      <button type="button" class="kc-add-cart" id="kc-go-checkout">
        PROCEED TO CHECKOUT
      </button>
    </div>`;

  content.querySelectorAll("[data-cart-quantity]").forEach((input) => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.cartQuantity);
      const quantity = Number(input.value);
      if (!Number.isInteger(quantity) || quantity < 1 ||
          quantity > shoppingCart[index].stock) {
        alert(`Choose a quantity from 1 to ${shoppingCart[index].stock}.`);
        input.value = shoppingCart[index].quantity;
        return;
      }
      shoppingCart[index].quantity = quantity;
      updateCartCount();
      renderCart();
    });
  });

  content.querySelectorAll("[data-remove-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      shoppingCart.splice(Number(button.dataset.removeCart), 1);
      updateCartCount();
      renderCart();
    });
  });

  $("kc-keep-shopping").addEventListener("click", closeDialog);
  $("kc-go-checkout").addEventListener("click", renderCheckout);
}

function cartSubtotal() {
  return shoppingCart.reduce(
    (sum, item) => sum + item.unit_price * item.quantity, 0
  );
}

/* CHECKOUT AND DELIVERY */
function renderCheckout() {
  if (!shoppingCart.length) return;

  const content = $("kc-dialog-content");
  openDialog("Checkout");

  content.innerHTML = `
    <p class="kc-notice">
      Please check your details before confirming. Delivery is available
      within Kenya only. International delivery is not currently offered.
    </p>

    <div id="kc-checkout-items">
      ${shoppingCart.map((item) => `
        <div class="kc-total-row">
          <span>${escapeHTML(item.product_name)}
            ${item.colour ? `(${escapeHTML(item.colour)})` : ""}
            ${item.size ? `— ${escapeHTML(item.size)}` : ""}
            × ${item.quantity}
          </span>
          <strong>${money(item.unit_price * item.quantity)}</strong>
        </div>
      `).join("")}
    </div>

    <form class="kc-checkout-form" id="kc-checkout-form">
      <div>
        <label>Full name *
          <input name="customer_name" required autocomplete="name">
        </label>
      </div>
      <div>
        <label>Email *
          <input name="customer_email" type="email" required autocomplete="email">
        </label>
      </div>
      <div>
        <label>Phone number *
          <input name="customer_phone" type="tel" required autocomplete="tel">
        </label>
      </div>
      <div>
        <label>Order method *
          <select name="delivery_method" id="kc-delivery-method" required>
            <option value="delivery">Delivery</option>
            <option value="pickup">Pick up from the shop (Free)</option>
          </select>
        </label>
      </div>

      <div class="full" id="kc-delivery-fields">
        <label>Delivery area *
          <select name="delivery_area" id="kc-delivery-area">
            <option value="nearby">Near Mama Sita shops — KSh 200</option>
            <option value="nairobi">Other Nairobi locations — KSh 500</option>
            <option value="countrywide">Countrywide, outside Nairobi — KSh 700–800 (owner confirms)</option>
          </select>
        </label>
      </div>

      <div class="full" id="kc-location-field">
        <label>Estate, town, county and landmark *
          <textarea name="delivery_location" id="kc-delivery-location"
            placeholder="Enter your estate/town, county and a nearby landmark"></textarea>
        </label>
      </div>

      <div>
        <label>Delivery or pickup date *
          <input type="date" name="delivery_date" id="kc-delivery-date" required>
        </label>
      </div>
      <div>
        <label>Time slot *
          <select name="delivery_time" id="kc-delivery-time" required>
            <option value="">Choose a time slot</option>
            <option>Weekday daytime (11 AM–5 PM)</option>
            <option>Weekday evening (5 PM–8 PM)</option>
            <option>Weekend afternoon (1 PM–5 PM)</option>
            <option>Weekend evening (5 PM–8 PM)</option>
          </select>
        </label>
      </div>

      <div>
        <label>Discount code (optional)
          <input name="discount_code" id="kc-discount-code"
            placeholder="Enter discount code">
        </label>
      </div>
      <div>
        <label>Payment method *
          <select name="payment_method" id="kc-payment-method" required>
            <option value="cash_on_delivery">Cash on Delivery</option>
            <option value="demo_mpesa">Demo M-Pesa (simulation)</option>
          </select>
        </label>
      </div>

      <div class="full" id="kc-mpesa-field" hidden>
        <label>M-Pesa phone number for demo *
          <input name="mpesa_phone" id="kc-mpesa-phone" type="tel"
            placeholder="e.g. 07XXXXXXXX">
        </label>
        <p class="kc-notice">
          Demo only: no real M-Pesa payment will be sent and you must never
          enter your M-Pesa PIN here.
        </p>
      </div>

      <div class="full">
        <label>Extra instructions (optional)
          <textarea name="order_notes"
            placeholder="Anything else the owner should know?"></textarea>
        </label>
      </div>

      <div class="full">
        <label>Subtotal</label>
        <strong id="kc-checkout-subtotal">${money(cartSubtotal())}</strong>
      </div>
      <div>
        <label>Delivery fee</label>
        <strong id="kc-checkout-fee">KSh 200</strong>
      </div>
      <div>
        <label>Discount</label>
        <strong id="kc-checkout-discount">KSh 0</strong>
      </div>
      <div class="full">
        <label>Estimated total</label>
        <strong id="kc-checkout-total">${money(cartSubtotal() + 200)}</strong>
      </div>
      <div class="full">
        <button type="submit" class="kc-checkout-submit" id="kc-confirm-order">
          CONFIRM ORDER
        </button>
        <p id="kc-checkout-status" class="kc-order-status" role="status"></p>
      </div>
    </form>`;

  const form = $("kc-checkout-form");
  const method = $("kc-delivery-method");
  const area = $("kc-delivery-area");
  const payment = $("kc-payment-method");
  const discountInput = $("kc-discount-code");
  const dateInput = $("kc-delivery-date");

  const today = new Date();
  const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
  dateInput.min = localToday;

  function updateTotals() {
    const pickup = method.value === "pickup";
    const fee = pickup ? 0 :
      area.value === "nearby" ? 200 :
      area.value === "nairobi" ? 500 : 700;

    const code = discountInput.value.trim().toUpperCase();
    const discount = code === "KC10" ? cartSubtotal() * 0.10 : 0;

    $("kc-checkout-fee").textContent =
      pickup ? "Free" :
      area.value === "countrywide" ? "KSh 700–800 (owner confirms)" : money(fee);

    $("kc-checkout-discount").textContent = money(discount);
    $("kc-checkout-total").textContent =
      money(Math.max(0, cartSubtotal() + fee - discount));

    $("kc-delivery-fields").hidden = pickup;
    $("kc-location-field").hidden = pickup;
    $("kc-delivery-location").required = !pickup;
    $("kc-delivery-area").required = !pickup;
    $("kc-mpesa-field").hidden = payment.value !== "demo_mpesa";
    $("kc-mpesa-phone").required = payment.value === "demo_mpesa";

    return { fee, discount };
  }

  method.addEventListener("change", updateTotals);
  area.addEventListener("change", updateTotals);
  payment.addEventListener("change", updateTotals);
  discountInput.addEventListener("input", updateTotals);

  form.addEventListener("submit", submitCustomerOrder);
  updateTotals();
}

async function submitCustomerOrder(event) {
  event.preventDefault();
  if (checkoutBusy) return;

  const form = event.currentTarget;
  const status = $("kc-checkout-status");
  const submitButton = $("kc-confirm-order");
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  if (!shoppingCart.length) {
    showMessage(status, "Your shopping bag is empty.", true);
    return;
  }

  if (!currentCustomer) {
    showMessage(status, "Please sign in again before placing an order.", true);
    return;
  }

  if (values.delivery_date < $("kc-delivery-date").min) {
    showMessage(status, "Please choose today or a future date.", true);
    return;
  }

  if (values.delivery_method === "delivery" && !values.delivery_location.trim()) {
    showMessage(status, "Please enter your location and a nearby landmark.", true);
    return;
  }

  const { data: freshProducts, error: productError } = await customerDB
    .from("products")
    .select("id,name,price,stock,active")
    .in("id", shoppingCart.map((item) => item.product_id));

  if (productError) {
    showMessage(status, "We could not check current stock. Please try again.", true);
    return;
  }

  for (const item of shoppingCart) {
    const latest = freshProducts?.find((p) => String(p.id) === item.product_id);
    if (!latest || latest.active === false || Number(latest.stock) < item.quantity) {
      showMessage(
        status,
        `The available stock for "${item.product_name}" has changed. Please update your bag.`,
        true
      );
      return;
    }
  }

  const subtotal = cartSubtotal();
  const discountCode = String(values.discount_code || "").trim().toUpperCase();
  const discountAmount = discountCode === "KC10" ? subtotal * 0.10 : 0;
  const pickup = values.delivery_method === "pickup";
  const deliveryFee = pickup ? 0 :
    values.delivery_area === "nearby" ? 200 :
    values.delivery_area === "nairobi" ? 500 : 700;

  const paymentIsDemo = values.payment_method === "demo_mpesa";

  if (discountCode && discountCode !== "KC10") {
    showMessage(status, "That discount code is not valid. Remove it or use KC10.", true);
    return;
  }

  checkoutBusy = true;
  submitButton.disabled = true;
  submitButton.textContent = "SAVING ORDER…";
  showMessage(status, "Saving your order. Please wait…");

  let orderId = null;

  try {
    let paymentStatus = "unpaid";

    if (paymentIsDemo) {
      const simulateSuccess = window.confirm(
        "DEMO M-PESA PAYMENT\n\nPress OK to simulate payment success, or Cancel to simulate failure. No real payment will be made."
      );

      if (!simulateSuccess) {
        showMessage(
          status,
          "Demo payment failed or was cancelled. Your order has not been submitted.",
          true
        );
        return;
      }

      paymentStatus = "paid_simulated";
    }

    const deliveryFeeToSave =
      !pickup && values.delivery_area === "countrywide" ? 700 : deliveryFee;

    const total = Math.max(0, subtotal + deliveryFeeToSave - discountAmount);

    const order = {
      customer_id: currentCustomer.id,
      customer_name: values.customer_name.trim(),
      customer_email: currentCustomer.email,
      customer_phone: values.customer_phone.trim(),
      delivery_method: values.delivery_method,
      delivery_area: pickup ? "pickup" : values.delivery_area,
      delivery_location: pickup ? null : values.delivery_location.trim(),
      delivery_date: values.delivery_date,
      delivery_time: values.delivery_time,
      delivery_fee: deliveryFeeToSave,
      subtotal,
      discount_code: discountCode || null,
      discount_amount: discountAmount,
      total,
      payment_method: values.payment_method,
      payment_status: paymentStatus,
      order_status: "pending",
      mpesa_phone: paymentIsDemo ? values.mpesa_phone.trim() : null,
      order_notes: String(values.order_notes || "").trim() || null
    };

    const { data: savedOrder, error: orderError } = await customerDB
      .from("orders")
      .insert(order)
      .select("id")
      .single();

    if (orderError) throw orderError;
    orderId = savedOrder.id;

    const orderItems = shoppingCart.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      colour: item.colour,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.unit_price * item.quantity
    }));

    const { error: itemsError } = await customerDB
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      throw new Error(
        "The order was created, but its items could not be saved. Please contact the owner and give them order reference " +
        orderId + ". Details: " + itemsError.message
      );
    }

    shoppingCart = [];
    updateCartCount();

    showMessage(
      status,
      `Order submitted successfully!\nOrder reference: ${orderId}\n` +
      `Payment status: ${paymentStatus === "paid_simulated" ? "Paid (SIMULATED)" : "Unpaid — pay on delivery"}\n` +
      `Total: ${money(total)}\n\nThe owner must confirm the countrywide delivery fee if applicable.`
    );

    submitButton.textContent = "ORDER SUBMITTED";
    submitButton.disabled = true;

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "kc-small-button";
    backButton.textContent = "CLOSE";
    backButton.addEventListener("click", closeDialog);
    status.insertAdjacentElement("afterend", backButton);

  } catch (error) {
    console.error("Order submission error:", error);
    showMessage(
      status,
      error.message || "We could not submit your order. Please try again.",
      true
    );
  } finally {
    checkoutBusy = false;
    if (submitButton && submitButton.textContent !== "ORDER SUBMITTED") {
      submitButton.disabled = false;
      submitButton.textContent = "CONFIRM ORDER";
    }
  }
}

/* SIGN OUT */
async function signOutCustomer(event) {
  event?.preventDefault();

  const button = $("customer-signout");
  if (button) {
    button.disabled = true;
    button.textContent = "SIGNING OUT…";
  }

  try {
    const { error } = await customerDB.auth.signOut();
    if (error) throw error;
    window.location.replace("index.html");
  } catch (error) {
    console.error("Sign-out failed:", error);
    if (button) {
      button.disabled = false;
      button.textContent = "SIGN OUT";
    }
    alert("Sign-out failed. Check your internet connection and try again.");
  }
}

async function initialiseCustomerPage() {
  installShoppingInterface();

  const user = await loadSignedInCustomer();
  if (!user) return;

  const emailInput = $("contact-email");
  if (emailInput) emailInput.value = user.email || "";

  await loadCustomerProducts();
  updateCartCount();
}

document.addEventListener("DOMContentLoaded", () => {
  const signOutButton = $("customer-signout");
  if (signOutButton) {
    signOutButton.addEventListener("click", signOutCustomer);
  }

  initialiseCustomerPage();
});

customerDB
  .channel("kc-customer-product-updates")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "products" },
    () => loadCustomerProducts()
  )
  .subscribe();
