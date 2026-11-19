
"use strict";

/* ==========================================
   KELSEY'S CLOSET - CUSTOMER SHOPPING SYSTEM
   ========================================== */

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const CART_KEY = "kc-shopping-cart";

let currentUser = null;
let products = [];
let cart = [];
let appliedDiscount = 0;
let appliedDiscountCode = "";

const money = (amount) =>
    new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);

function showMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.display = "block";
    element.style.color = isError ? "#b42318" : "#267347";
}

function clearMessage(id) {
    const element = $(id);
    if (element) element.textContent = "";
}

function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
}

function cartQuantity() {
    return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function cartSubtotal() {
    return cart.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0
    );
}

function getDeliveryFee() {
    const method = $("delivery-method")?.value || "pickup";
    if (method === "pickup") return 0;

    const area = $("delivery-area")?.value || "";
    if (area === "near_shop") return 150;
    if (area === "nairobi") return 250;
    if (area === "countrywide") return 400;

    return 0;
}

function cartDiscount() {
    return Math.min(Math.max(0, appliedDiscount), cartSubtotal());
}

function cartTotal() {
    return Math.max(0, cartSubtotal() - cartDiscount() + getDeliveryFee());
}

/* ==========================================
   LOAD CUSTOMER AND PRODUCTS
   ========================================== */

async function loadCustomer() {
    const { data, error } = await db.auth.getUser();

    if (error) {
        console.error("Customer login lookup failed:", error.message);
        return null;
    }

    currentUser = data?.user || null;
    return currentUser;
}

async function loadProducts() {
    const container = $("customer-products");
    const message = $("catalogue-message");

    if (container) {
        container.innerHTML = "<p>Loading products...</p>";
    }

    const { data, error } = await db
        .from("products")
        .select("id,name,category,description,size,color,price,stock,image_url,active,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Product loading failed:", error);
        if (container) {
            container.innerHTML = "<p>Products could not be loaded. Please refresh the page.</p>";
        }
        if (message) message.textContent = "Could not load products: " + error.message;
        return;
    }

    products = data || [];
    displayProducts();
}

function displayProducts() {
    const container = $("customer-products");
    if (!container) return;

    const filter = $("category-filter")?.value || "all";

    const filtered = products.filter((product) => {
        const category = String(product.category || "").toLowerCase();
        return filter === "all" || category === filter.toLowerCase();
    });

    if (!filtered.length) {
        container.innerHTML = "<p>No products are currently available in this category.</p>";
        return;
    }

    container.innerHTML = filtered.map((product) => {
        const image = product.image_url
            ? `<img src="${safeText(product.image_url)}"
                    alt="${safeText(product.name)}"
                    style="width:100%;height:220px;object-fit:cover;"
                    onerror="this.style.display='none'">`
            : "";

        const unavailable = Number(product.stock || 0) < 1;

        return `
            <article class="product-card">
                ${image}
                <div class="product-info">
                    <h3>${safeText(product.name)}</h3>
                    <p>${safeText(product.category || "")}</p>
                    <p>${safeText(product.description || "")}</p>
                    <p><strong>${money(product.price)}</strong></p>
                    <p>${unavailable ? "Out of stock" : "In stock: " + Number(product.stock)}</p>
                    <button type="button"
                        class="add-to-cart-button"
                        data-product-id="${safeText(product.id)}"
                        ${unavailable ? "disabled" : ""}>
                        ${unavailable ? "Out of Stock" : "Add to Bag"}
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function addProductToCart(productId) {
    const product = products.find((item) => String(item.id) === String(productId));

    if (!product) {
        alert("This product could not be found. Please refresh the page.");
        return;
    }

    const stock = Number(product.stock || 0);
    const existing = cart.find(
        (item) => String(item.product_id) === String(product.id)
    );

    if (existing) {
        if (Number(existing.quantity) >= stock) {
            alert("You cannot add more than the available stock.");
            return;
        }
        existing.quantity = Number(existing.quantity) + 1;
    } else {
        if (stock < 1) {
            alert("This product is out of stock.");
            return;
        }

        cart.push({
            key: String(product.id),
            product_id: product.id,
            name: product.name,
            image_url: product.image_url || "",
            color: product.color || "",
            size: product.size || "",
            quantity: 1,
            unit_price: Number(product.price),
            available_stock: stock
        });
    }

    saveCart();
}

/* ==========================================
   SHOPPING BAG
   ========================================== */

function renderCart() {
    const container = $("cart-items");

    if (container) {
        if (!cart.length) {
            container.innerHTML = "<p>Your shopping bag is empty.</p>";
        } else {
            container.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    ${item.image_url
                        ? `<img src="${safeText(item.image_url)}"
                                alt="${safeText(item.name)}"
                                style="width:75px;height:75px;object-fit:cover;"
                                onerror="this.style.display='none'">`
                        : ""}
                    <div>
                        <h4>${safeText(item.name)}</h4>
                        <p>${money(item.unit_price)} each</p>
                        ${item.size ? `<p>Size: ${safeText(item.size)}</p>` : ""}
                        ${item.color ? `<p>Colour: ${safeText(item.color)}</p>` : ""}
                        <label>
                            Quantity:
                            <input type="number"
                                min="1"
                                max="${Number(item.available_stock)}"
                                value="${Number(item.quantity)}"
                                data-cart-quantity="${index}"
                                style="width:65px">
                        </label>
                        <p>Line total: ${money(item.unit_price * item.quantity)}</p>
                        <button type="button" data-remove-cart="${index}">
                            Remove
                        </button>
                    </div>
                </div>
            `).join("");
        }
    }

    if ($("cart-subtotal")) $("cart-subtotal").textContent = money(cartSubtotal());
    if ($("cart-discount")) $("cart-discount").textContent = money(cartDiscount());
    if ($("cart-delivery")) $("cart-delivery").textContent = money(getDeliveryFee());
    if ($("cart-total")) $("cart-total").textContent = money(cartTotal());
    if ($("checkout-total")) $("checkout-total").textContent = money(cartTotal());

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
        element.textContent = String(cartQuantity());
    });
}

function updateCartQuantity(index, quantity) {
    const item = cart[index];
    if (!item) return;

    const newQuantity = Number(quantity);

    if (!Number.isInteger(newQuantity) || newQuantity < 1) {
        alert("Please enter a quantity of at least 1.");
        renderCart();
        return;
    }

    if (newQuantity > Number(item.available_stock)) {
        alert("Only " + item.available_stock + " item(s) are available.");
        renderCart();
        return;
    }

    item.quantity = newQuantity;
    saveCart();
}

function removeCartItem(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    saveCart();
}

/* ==========================================
   CHECKOUT FIELDS
   ========================================== */

function updateCheckoutFields() {
    const method = $("delivery-method")?.value || "pickup";
    const deliveryFields = $("delivery-fields");
    const pickupFields = $("pickup-fields");
    const deliveryArea = $("delivery-area");

    if (deliveryFields) deliveryFields.style.display = method === "delivery" ? "" : "none";
    if (pickupFields) pickupFields.style.display = method === "pickup" ? "" : "none";

    if (deliveryArea) deliveryArea.required = method === "delivery";

    const address = $("delivery-location");
    const deliveryDate = $("delivery-date");
    const deliveryTime = $("delivery-time");
    const pickupDate = $("pickup-date");
    const pickupTime = $("pickup-time");

    if (address) address.required = method === "delivery";
    if (deliveryDate) deliveryDate.required = method === "delivery";
    if (deliveryTime) deliveryTime.required = false;
    if (pickupDate) pickupDate.required = method === "pickup";
    if (pickupTime) pickupTime.required = false;

    renderCart();
}

function updatePaymentFields() {
    const payment = $("payment-method")?.value || "cash";
    const mpesaFields = $("mpesa-fields");

    if (mpesaFields) {
        mpesaFields.style.display = payment === "mpesa" ? "" : "none";
    }

    const phone = $("mpesa-phone");
    if (phone) phone.required = payment === "mpesa";
}

function openCheckout() {
    const form = $("checkout-form");
    if (form) form.style.display = "";

    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCheckout() {
    const form = $("checkout-form");
    if (form) form.style.display = "none";
}

/* ==========================================
   DISCOUNT CODE
   ========================================== */

function applyDiscountCode() {
    const input = $("discount-code");
    if (!input) return;

    const code = input.value.trim().toUpperCase();

    if (!code) {
        appliedDiscount = 0;
        appliedDiscountCode = "";
        showMessage("checkout-status", "Enter a discount code first.", true);
        renderCart();
        return;
    }

    // Discount codes can be configured here.
    // This default list does not create or alter database records.
    const discounts = {
        "KELSEY10": 0.10,
        "WELCOME10": 0.10
    };

    if (!Object.prototype.hasOwnProperty.call(discounts, code)) {
        appliedDiscount = 0;
        appliedDiscountCode = "";
        showMessage("checkout-status", "That discount code is not valid.", true);
        renderCart();
        return;
    }

    appliedDiscount = Math.round(cartSubtotal() * discounts[code] * 100) / 100;
    appliedDiscountCode = code;

    showMessage("checkout-status", "Discount applied successfully.");
    renderCart();
}

/* ==========================================
   ORDER DATA
   ========================================== */

function buildOrderPayload() {
    const firstName = $("order-first-name")?.value.trim() || "";
    const lastName = $("order-last-name")?.value.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = $("order-email")?.value.trim() || currentUser?.email || "";
    const phone = $("order-phone")?.value.trim() || "";

    const method = $("delivery-method")?.value || "pickup";
    const payment = $("payment-method")?.value || "cash";

    const area = method === "delivery"
        ? ($("delivery-area")?.value || "")
        : null;

    const address = method === "delivery"
        ? ($("delivery-location")?.value.trim() || "")
        : null;

    const scheduledDate = method === "delivery"
        ? ($("delivery-date")?.value || "")
        : ($("pickup-date")?.value || "");

    const selectedTime = method === "delivery"
        ? ($("delivery-time")?.value || "")
        : ($("pickup-time")?.value || "");

    if (!fullName) throw new Error("Please enter your first and last name.");
    if (!phone) throw new Error("Please enter your phone number.");
    if (!scheduledDate) throw new Error("Please select your delivery or pickup date.");

    if (method === "delivery" && !area) {
        throw new Error("Please select a delivery area.");
    }

    if (method === "delivery" && !address) {
        throw new Error("Please enter your delivery location or address.");
    }

    if (scheduledDate < new Date().toLocaleDateString("en-CA")) {
        throw new Error("Please select today or a future date.");
    }

    if (payment === "mpesa") {
        const mpesaPhone = $("mpesa-phone")?.value.trim() || "";
        if (!mpesaPhone) throw new Error("Please enter the M-Pesa phone number.");
    }

    const deliveryFee = Math.max(0, getDeliveryFee());
    const subtotal = Math.max(0, cartSubtotal());
    const discount = Math.max(0, cartDiscount());
    const total = Math.max(0, subtotal - discount + deliveryFee);

    return {
        customer_id: currentUser?.id || null,
        customer_name: fullName,
        customer_email: email || null,
        customer_phone_number: phone,

        fulfillment_type: method,
        delivery_area: area,
        county: null,
        town: null,
        delivery_address: address,
        delivery_fee: deliveryFee,

        scheduled_date: scheduledDate,

        // Both scheduling columns are populated to satisfy the database.
        scheduled_slot: selectedTime || "Time to be confirmed",
        schedule_slot: selectedTime || null,
        delivery_time: selectedTime || null,

        subtotal: subtotal,
        discount_code: appliedDiscountCode || null,
        discount_amount: discount,
        total: total,

        // Values must match the allowed Supabase check constraints.
        payment_method: payment === "cash"
            ? "cash on delivery"
            : "demo mpesa",

        // The owner confirms payment after checking the order.
        payment_status: "unpaid",
        order_status: "awaiting confirmation",

        mpesa_phone: payment === "mpesa"
            ? ($("mpesa-phone")?.value.trim() || null)
            : null
    };
}

/* ==========================================
   PLACE ORDER
   ========================================== */

async function placeOrder(event) {
    if (event) event.preventDefault();

    const button = $("place-order-button");
    if (button) {
        button.disabled = true;
        button.textContent = "Placing Order...";
    }

    try {
        clearMessage("checkout-status");

        if (!cart.length) {
            throw new Error("Your shopping bag is empty.");
        }

        await loadCustomer();

        const payload = buildOrderPayload();

        // Refresh stock before placing the order.
        for (const item of cart) {
            const product = products.find(
                (p) => String(p.id) === String(item.product_id)
            );

            if (product && Number(item.quantity) > Number(product.stock)) {
                throw new Error(
                    `${item.name} no longer has enough stock. Please update your bag.`
                );
            }
        }

        // Insert the order with the exact allowed status values.
        const { data: order, error: orderError } = await db
            .from("orders")
            .insert(payload)
            .select()
            .single();

        if (orderError) {
            console.error("Order insert failed:", orderError);
            throw new Error("Order could not be placed: " + orderError.message);
        }

        const orderItems = cart.map((item) => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.name,
            size: item.size || null,
            color: item.color || null,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            line_total: Number(item.unit_price) * Number(item.quantity)
        }));

        const { error: itemsError } = await db
            .from("order_items")
            .insert(orderItems);

        if (itemsError) {
            console.error("Order items insert failed:", itemsError);

            showMessage(
                "checkout-status",
                "The order record was created, but its items could not be saved. Please contact the store owner and do not place the order again yet.",
                true
            );

            throw new Error("Order items could not be saved: " + itemsError.message);
        }

        const orderNumber = order.id;

        cart = [];
        appliedDiscount = 0;
        appliedDiscountCode = "";
        saveCart();

        const form = $("checkout-form");
        if (form) form.reset();

        updateCheckoutFields();
        updatePaymentFields();

        showMessage(
            "checkout-status",
            `Your order has been placed successfully. Order number: ${orderNumber}. The store will confirm your order and payment.`
        );

        await loadMyOrders();

    } catch (error) {
        console.error("Checkout error:", error);

        showMessage(
            "checkout-status",
            error.message || "An unexpected error occurred while placing your order.",
            true
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Place Order";
        }
    }
}

/* ==========================================
   CUSTOMER ORDER HISTORY
   ========================================== */

async function loadMyOrders() {
    const container = $("customer-orders");
    if (!container) return;

    if (!currentUser) {
        await loadCustomer();
    }

    if (!currentUser) {
        container.innerHTML = "<p>Please sign in to view your orders.</p>";
        return;
    }

    const { data, error } = await db
        .from("orders")
        .select("id,customer_name,total,payment_method,payment_status,order_status,fulfillment_type,scheduled_date,scheduled_slot,created_at")
        .eq("customer_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Order history failed:", error);
        container.innerHTML = "<p>Your orders could not be loaded.</p>";
        return;
    }

    if (!data || !data.length) {
        container.innerHTML = "<p>You have not placed any orders yet.</p>";
        return;
    }

    container.innerHTML = data.map((order) => `
        <article class="customer-order">
            <h3>Order #${safeText(order.id)}</h3>
            <p><strong>Total:</strong> ${money(order.total)}</p>
            <p><strong>Payment:</strong> ${safeText(order.payment_method)}</p>
            <p><strong>Payment status:</strong> ${safeText(order.payment_status)}</p>
            <p><strong>Order status:</strong> ${safeText(order.order_status)}</p>
            <p><strong>Collection/delivery:</strong> ${safeText(order.fulfillment_type)}</p>
            <p><strong>Scheduled date:</strong> ${safeText(order.scheduled_date || "Not set")}</p>
            <p><strong>Scheduled time:</strong> ${safeText(order.scheduled_slot || "To be confirmed")}</p>
        </article>
    `).join("");
}

/* ==========================================
   CUSTOMER MESSAGES / REPLIES
   ========================================== */

async function loadCustomerMessages() {
    if (!currentUser) await loadCustomer();

    if (!currentUser) return;

    let section = $("customer-messages-section");

    if (!section) {
        const ordersSection = $("customer-orders");
        if (!ordersSection) return;

        section = document.createElement("section");
        section.id = "customer-messages-section";
        section.innerHTML = `
            <h2>Messages from Kelsey's Closet</h2>
            <div id="customer-messages-list">Loading messages...</div>
        `;
        ordersSection.insertAdjacentElement("afterend", section);
    }

    const list = $("customer-messages-list");
    if (!list) return;

    const email = currentUser.email || $("order-email")?.value.trim() || "";

    if (!email) {
        list.innerHTML = "<p>Sign in with your customer email to view replies.</p>";
        return;
    }

    const { data, error } = await db
        .from("messages")
        .select("id,customer_name,customer_email,subject,message,created_at,reply,replied_at")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Customer messages failed:", error);
        list.innerHTML = "<p>Messages could not be loaded right now.</p>";
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = "<p>You have no messages yet.</p>";
        return;
    }

    list.innerHTML = data.map((message) => `
        <article class="customer-message">
            <h3>${safeText(message.subject || "Message")}</h3>
            <p>${safeText(message.message || "")}</p>
            <p><small>${safeText(message.created_at || "")}</small></p>
            <h4>Store reply</h4>
            <p>${safeText(message.reply || "No reply yet.")}</p>
            ${message.replied_at
                ? `<small>Replied: ${safeText(message.replied_at)}</small>`
                : ""}
        </article>
    `).join("");
}

/* ==========================================
   CONTACT FORM
   ========================================== */

async function submitContactMessage(event) {
    event.preventDefault();

    const name = $("contact-name")?.value.trim() || "";
    const email = $("contact-email")?.value.trim() || currentUser?.email || "";
    const phone = $("contact-phone")?.value.trim() || "";
    const message = $("contact-message")?.value.trim() || "";

    if (!name || !email || !message) {
        showMessage("contact-status", "Please fill in your name, email and message.", true);
        return;
    }

    const { error } = await db.from("messages").insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        subject: "Customer enquiry",
        message: message
    });

    if (error) {
        console.error("Contact message failed:", error);
        showMessage("contact-status", "Your message could not be sent: " + error.message, true);
        return;
    }

    showMessage("contact-status", "Your message has been sent successfully.");
    $("customer-contact-form")?.reset();
}

/* ==========================================
   SIGN OUT
   ========================================== */

async function signOutCustomer() {
    const { error } = await db.auth.signOut();

    if (error) {
        alert("Could not sign out: " + error.message);
        return;
    }

    window.location.href = "login.html";
}

/* ==========================================
   EVENT HANDLERS
   ========================================== */

function attachCustomerEvents() {
    $("customer-products")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-product-id]");
        if (button) addProductToCart(button.dataset.productId);
    });

    $("category-filter")?.addEventListener("change", displayProducts);

    $("cart-items")?.addEventListener("change", (event) => {
        const input = event.target.closest("[data-cart-quantity]");
        if (input) {
            updateCartQuantity(Number(input.dataset.cartQuantity), input.value);
        }
    });

    $("cart-items")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-cart]");
        if (button) removeCartItem(Number(button.dataset.removeCart));
    });

    $("checkout-toggle")?.addEventListener("click", openCheckout);

    $("checkout-form")?.addEventListener("submit", placeOrder);

    $("delivery-method")?.addEventListener("change", updateCheckoutFields);
    $("delivery-area")?.addEventListener("change", renderCart);
    $("payment-method")?.addEventListener("change", updatePaymentFields);

    $("discount-apply")?.addEventListener("click", applyDiscountCode);

    $("customer-signout")?.addEventListener("click", signOutCustomer);

    $("customer-contact-form")?.addEventListener("submit", submitContactMessage);

    $("back-to-bag")?.addEventListener("click", () => {
        const bag = $("shopping-bag");
        if (bag) bag.scrollIntoView({ behavior: "smooth", block: "start" });
        closeCheckout();
    });

    document.querySelectorAll("[data-open-checkout]").forEach((button) => {
        button.addEventListener("click", openCheckout);
    });
}

/* ==========================================
   START CUSTOMER PAGE
   ========================================== */

async function loadCustomerPage() {
    cart = getCart();

    attachCustomerEvents();
    updateCheckoutFields();
    updatePaymentFields();
    renderCart();

    await loadCustomer();
    await loadProducts();
    await loadMyOrders();
    await loadCustomerMessages();
}

document.addEventListener("DOMContentLoaded", loadCustomerPage);

window.addEventListener("focus", () => {
    loadMyOrders();
    loadCustomerMessages();
});
