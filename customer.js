"use strict";

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const money = (value) =>
    new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES"
    }).format(Number(value) || 0);

let currentUser = null;
let products = [];
let cart = [];
let discountAmount = 0;
let discountCode = "";
let submittingOrder = false;

function message(id, text, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? "#b42318" : "#267347";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[ch]);
}

function saveCart() {
    localStorage.setItem("kc-shopping-cart", JSON.stringify(cart));
    renderCart();
}

function subtotal() {
    return cart.reduce(
        (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
        0
    );
}

function deliveryFee() {
    if (($("delivery-method")?.value || "pickup") !== "delivery") return 0;

    const area = $("delivery-area")?.value;
    if (area === "near_shop") return 150;
    if (area === "nairobi") return 250;
    if (area === "countrywide") return 400;

    return 0;
}

function total() {
    return Math.max(0, subtotal() - discountAmount + deliveryFee());
}

async function loadUser() {
    const { data, error } = await db.auth.getUser();

    if (error) {
        console.error("Customer account:", error.message);
        currentUser = null;
        return;
    }

    currentUser = data?.user || null;
}

async function loadProducts() {
    const container = $("customer-products");
    if (!container) return;

    container.innerHTML = "<p>Loading products...</p>";

    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Products:", error);
        container.innerHTML = "<p>Products could not be loaded.</p>";
        return;
    }

    products = (data || []).filter(product =>
        product.active !== false
    );

    displayProducts();
}

function displayProducts() {
    const container = $("customer-products");
    if (!container) return;

    const filter = $("category-filter")?.value || "all";

    const visible = products.filter(product =>
        filter === "all" ||
        String(product.category || "").toLowerCase() === filter.toLowerCase()
    );

    if (!visible.length) {
        container.innerHTML = "<p>No products are currently available.</p>";
        return;
    }

    container.innerHTML = visible.map(product => {
        const stock = Number(product.stock ?? 0);

        return `
            <article class="product-card">
                ${product.image_url ? `
                    <img src="${escapeHTML(product.image_url)}"
                         alt="${escapeHTML(product.name)}"
                         style="width:100%;height:220px;object-fit:cover"
                         onerror="this.style.display='none'">
                ` : ""}
                <div class="product-info">
                    <h3>${escapeHTML(product.name)}</h3>
                    <p>${escapeHTML(product.category || "")}</p>
                    <p>${escapeHTML(product.description || "")}</p>
                    <p><strong>${money(product.price)}</strong></p>
                    <p>${stock > 0 ? "In stock: " + stock : "Out of stock"}</p>
                    <button type="button"
                            data-add-product="${escapeHTML(product.id)}"
                            ${stock < 1 ? "disabled" : ""}>
                        Add to Bag
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function addToCart(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    const stock = Number(product.stock ?? 0);
    const existing = cart.find(
        item => String(item.product_id) === String(product.id)
    );

    if (existing) {
        if (existing.quantity >= stock) {
            alert("You have reached the available stock for this product.");
            return;
        }
        existing.quantity++;
    } else {
        if (stock < 1) {
            alert("This product is out of stock.");
            return;
        }

        cart.push({
            product_id: product.id,
            name: product.name,
            size: product.size || null,
            color: product.color || null,
            image_url: product.image_url || "",
            unit_price: Number(product.price),
            quantity: 1,
            available_stock: stock
        });
    }

    saveCart();
}

function renderCart() {
    const container = $("cart-items");

    if (container) {
        container.innerHTML = cart.length ? cart.map((item, index) => `
            <div class="cart-item">
                ${item.image_url ? `
                    <img src="${escapeHTML(item.image_url)}"
                         alt="${escapeHTML(item.name)}"
                         style="width:75px;height:75px;object-fit:cover">
                ` : ""}
                <div>
                    <h4>${escapeHTML(item.name)}</h4>
                    <p>${money(item.unit_price)} each</p>
                    <label>
                        Quantity:
                        <input type="number"
                               min="1"
                               max="${item.available_stock}"
                               value="${item.quantity}"
                               data-quantity="${index}">
                    </label>
                    <p>Line total: ${money(item.unit_price * item.quantity)}</p>
                    <button type="button" data-remove="${index}">Remove</button>
                </div>
            </div>
        `).join("") : "<p>Your shopping bag is empty.</p>";
    }

    if ($("cart-subtotal")) $("cart-subtotal").textContent = money(subtotal());
    if ($("cart-discount")) $("cart-discount").textContent = money(discountAmount);
    if ($("cart-delivery")) $("cart-delivery").textContent = money(deliveryFee());
    if ($("cart-total")) $("cart-total").textContent = money(total());
    if ($("checkout-total")) $("checkout-total").textContent = money(total());

    document.querySelectorAll("[data-cart-count]").forEach(el => {
        el.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    });
}

function updateCheckoutFields() {
    const method = $("delivery-method")?.value || "pickup";

    if ($("delivery-fields")) {
        $("delivery-fields").style.display = method === "delivery" ? "" : "none";
    }

    if ($("pickup-fields")) {
        $("pickup-fields").style.display = method === "pickup" ? "" : "none";
    }

    if ($("delivery-area")) $("delivery-area").required = method === "delivery";
    if ($("delivery-location")) $("delivery-location").required = method === "delivery";
    if ($("delivery-date")) $("delivery-date").required = method === "delivery";
    if ($("pickup-date")) $("pickup-date").required = method === "pickup";

    renderCart();
}

function updatePaymentFields() {
    const payment = $("payment-method")?.value || "cash";

    if ($("mpesa-fields")) {
        $("mpesa-fields").style.display = payment === "mpesa" ? "" : "none";
    }

    if ($("mpesa-phone")) {
        $("mpesa-phone").required = payment === "mpesa";
    }
}

function openCheckout() {
    const form = $("checkout-form");
    if (form) {
        form.style.display = "";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function closeCheckout() {
    if ($("checkout-form")) $("checkout-form").style.display = "none";
}

function buildOrderPayload() {
    const first = $("order-first-name")?.value.trim() || "";
    const last = $("order-last-name")?.value.trim() || "";
    const name = `${first} ${last}`.trim();
    const phone = $("order-phone")?.value.trim() || "";
    const email = $("order-email")?.value.trim() || currentUser?.email || "";

    const method = $("delivery-method")?.value || "pickup";
    const payment = $("payment-method")?.value || "cash";

    const date = method === "delivery"
        ? $("delivery-date")?.value
        : $("pickup-date")?.value;

    const time = method === "delivery"
        ? $("delivery-time")?.value
        : $("pickup-time")?.value;

    const area = method === "delivery"
        ? $("delivery-area")?.value || null
        : null;

    const address = method === "delivery"
        ? $("delivery-location")?.value.trim() || ""
        : null;

    if (!name) throw new Error("Enter your first and last name.");
    if (!phone) throw new Error("Enter your phone number.");
    if (!date) throw new Error("Select your delivery or pickup date.");

    if (method === "delivery" && !area) {
        throw new Error("Select your delivery area.");
    }

    if (method === "delivery" && !address) {
        throw new Error("Enter your delivery address.");
    }

    let mpesaPhone = null;

    if (payment === "mpesa") {
        mpesaPhone = $("mpesa-phone")?.value.trim() || "";
        if (!mpesaPhone) throw new Error("Enter the M-Pesa phone number.");
    }

    const sub = Math.max(0, subtotal());
    const discount = Math.min(Math.max(0, discountAmount), sub);
    const fee = Math.max(0, deliveryFee());

    return {
        customer_id: currentUser?.id || null,
        customer_name: name,
        customer_email: email || null,
        customer_phone_number: phone,

        fulfillment_type: method,
        delivery_area: area,
        delivery_address: address,
        delivery_fee: fee,

        scheduled_date: date,
        scheduled_slot: time || "Time to be confirmed",
        schedule_slot: time || null,
        delivery_time: time || null,

        subtotal: sub,
        discount_code: discountCode || null,
        discount_amount: discount,
        total: Math.max(0, sub - discount + fee),

        payment_method: payment === "cash"
            ? "cash on delivery"
            : "demo mpesa",

        payment_status: "unpaid",

        // IMPORTANT: use a SPACE, not an underscore.
        order_status: "awaiting confirmation",

        mpesa_phone: mpesaPhone
    };
}

async function placeOrder(event) {
    event.preventDefault();

    if (submittingOrder) return;

    const button = $("place-order-button");

    try {
        if (!cart.length) throw new Error("Your shopping bag is empty.");

        submittingOrder = true;
        if (button) {
            button.disabled = true;
            button.textContent = "Placing Order...";
        }

        await loadUser();

        const payload = buildOrderPayload();

        for (const item of cart) {
            const product = products.find(
                p => String(p.id) === String(item.product_id)
            );

            if (product && item.quantity > Number(product.stock ?? 0)) {
                throw new Error(
                    `${item.name} does not have enough stock. Please update your bag.`
                );
            }
        }

        // Explicitly check the exact value before sending it.
        if (!["awaiting confirmation", "confirmed"].includes(payload.order_status)) {
            throw new Error("Invalid order status.");
        }

        const { data: order, error: orderError } = await db
            .from("orders")
            .insert(payload)
            .select("id")
            .single();

        if (orderError) {
            console.error("Order creation failed:", orderError);
            throw new Error("Order could not be placed: " + orderError.message);
        }

        const items = cart.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.name,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.unit_price * item.quantity
        }));

        const { error: itemsError } = await db
            .from("order_items")
            .insert(items);

        if (itemsError) {
            console.error("Order items could not be saved:", itemsError);
            throw new Error(
                "The order was created, but its items could not be saved. Contact the store owner with order number " +
                order.id + ". Do not place the order again."
            );
        }

        cart = [];
        discountAmount = 0;
        discountCode = "";
        saveCart();

        $("checkout-form")?.reset();
        updateCheckoutFields();
        updatePaymentFields();

        message(
            "checkout-status",
            "Your order has been placed successfully. Order number: " +
            order.id + ". Your order is awaiting confirmation."
        );

        await loadMyOrders();

    } catch (error) {
        console.error("Checkout error:", error);
        message(
            "checkout-status",
            error.message || "Something went wrong while placing your order.",
            true
        );
    } finally {
        submittingOrder = false;
        if (button) {
            button.disabled = false;
            button.textContent = "Place Order";
        }
    }
}

async function loadMyOrders() {
    const container = $("my-orders-list");
    if (!container) return;

    if (!currentUser) await loadUser();

    if (!currentUser) {
        container.innerHTML = "<p>Please sign in to view your orders.</p>";
        return;
    }

    const { data, error } = await db
        .from("orders")
        .select("id,total,payment_method,payment_status,order_status,fulfillment_type,scheduled_date,scheduled_slot,created_at")
        .eq("customer_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Order history:", error);
        container.innerHTML = "<p>Orders could not be loaded.</p>";
        return;
    }

    if (!data?.length) {
        container.innerHTML = "<p>You have not placed any orders yet.</p>";
        return;
    }

    container.innerHTML = data.map(order => `
        <article class="customer-order">
            <h3>Order #${escapeHTML(order.id)}</h3>
            <p>Total: ${money(order.total)}</p>
            <p>Payment method: ${escapeHTML(order.payment_method)}</p>
            <p>Payment status: ${escapeHTML(order.payment_status)}</p>
            <p>Order status: ${escapeHTML(order.order_status)}</p>
            <p>Method: ${escapeHTML(order.fulfillment_type)}</p>
            <p>Date: ${escapeHTML(order.scheduled_date || "Not set")}</p>
            <p>Time: ${escapeHTML(order.scheduled_slot || "To be confirmed")}</p>
        </article>
    `).join("");
}

function applyDiscount() {
    const code = $("discount-code")?.value.trim().toUpperCase() || "";
    const discounts = { KELSEY10: 0.10, WELCOME10: 0.10 };

    if (!discounts[code]) {
        discountAmount = 0;
        discountCode = "";
        message("checkout-status", "Invalid discount code.", true);
    } else {
        discountCode = code;
        discountAmount = Math.round(subtotal() * discounts[code] * 100) / 100;
        message("checkout-status", "Discount applied successfully.");
    }

    renderCart();
}

function attachEvents() {
    $("customer-products")?.addEventListener("click", event => {
        const button = event.target.closest("[data-add-product]");
        if (button) addToCart(button.dataset.addProduct);
    });

    $("category-filter")?.addEventListener("change", displayProducts);

    $("cart-items")?.addEventListener("change", event => {
        const input = event.target.closest("[data-quantity]");
        if (!input) return;

        const item = cart[Number(input.dataset.quantity)];
        if (!item) return;

        const quantity = Number(input.value);

        if (!Number.isInteger(quantity) || quantity < 1 ||
            quantity > item.available_stock) {
            alert("Please enter a valid quantity within the available stock.");
            renderCart();
            return;
        }

        item.quantity = quantity;
        saveCart();
    });

    $("cart-items")?.addEventListener("click", event => {
        const button = event.target.closest("[data-remove]");
        if (!button) return;

        cart.splice(Number(button.dataset.remove), 1);
        saveCart();
    });

    $("checkout-toggle")?.addEventListener("click", openCheckout);
    $("checkout-form")?.addEventListener("submit", placeOrder);
    $("delivery-method")?.addEventListener("change", updateCheckoutFields);
    $("delivery-area")?.addEventListener("change", renderCart);
    $("payment-method")?.addEventListener("change", updatePaymentFields);
    $("discount-apply")?.addEventListener("click", applyDiscount);

    $("back-to-bag")?.addEventListener("click", () => {
        closeCheckout();
        $("cart-items")?.scrollIntoView({ behavior: "smooth" });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const saved = JSON.parse(
            localStorage.getItem("kc-shopping-cart") || "[]"
        );
        cart = Array.isArray(saved) ? saved : [];
    } catch {
        cart = [];
    }

    attachEvents();
    updateCheckoutFields();
    updatePaymentFields();
    renderCart();

    await loadUser();
    await loadProducts();
    await loadMyOrders();
});

window.addEventListener("focus", loadMyOrders);
