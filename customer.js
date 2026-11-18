onst CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";
const customerDB = window.supabase.createClient(CUSTOMER_SUPABASE_URL, CUSTOMER_SUPABASE_KEY);

const $ = id => document.getElementById(id);
const money = n => "KSh " + Number(n || 0).toLocaleString("en-KE", {maximumFractionDigits: 2});
const safeText = (parent, tag, text, cls) => {
  const el = document.createElement(tag); el.textContent = text == null ? "" : String(text);
  if (cls) el.className = cls; parent.appendChild(el); return el;
};
let allProducts = [], currentCustomer = null, cart = [];
let demoPaymentResult = null;
try { cart = JSON.parse(localStorage.getItem("kc-shopping-cart") || "[]"); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }

function saveCart() { localStorage.setItem("kc-shopping-cart", JSON.stringify(cart)); updateBagCount(); renderCart(); }
function updateBagCount() { const n = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0); if ($("bag-count")) $("bag-count").textContent = n; }
function parseOptions(value) {
  return String(value || "").split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}
function makeSelect(options, label, selected) {
  const select = document.createElement("select"); select.setAttribute("aria-label", label);
  if (!options.length) options = ["Not specified"];
  options.forEach(value => { const o = document.createElement("option"); o.value = value; o.textContent = value; select.appendChild(o); });
  if (selected && options.includes(selected)) select.value = selected;
  return select;
}
function productImage(product) {
  const img = document.createElement("img"); img.className = "customer-product-image";
  img.alt = product.name || "Fashion product"; img.loading = "lazy";
  if (product.image_url) img.src = product.image_url;
  img.onerror = () => { img.removeAttribute("src"); img.alt = "Product image unavailable"; };
  return img;
}
function displayProducts() {
  const container = $("customer-products"), message = $("catalogue-message");
  if (!container || !message) return;
  container.replaceChildren();
  const selected = ($("category-filter")?.value || "all").toLowerCase();
  const products = allProducts.filter(p => selected === "all" || String(p.category || "").toLowerCase() === selected);
  if (!products.length) { message.textContent = allProducts.length ? "There are no products in this category yet." : "No active products are available yet."; return; }
  message.textContent = `${products.length} product${products.length === 1 ? "" : "s"} available.`;
  products.forEach(product => {
    const card = document.createElement("article"); card.className = "customer-product-card";
    card.appendChild(productImage(product));
    const details = document.createElement("div"); details.className = "customer-product-details";
    safeText(details, "h3", product.name || "Fashion item");
    safeText(details, "p", money(product.price), "customer-product-price");
    if (product.description) safeText(details, "p", product.description);
    if (product.category) safeText(details, "p", "Category: " + product.category);
    const stock = Math.max(0, Number(product.stock) || 0);
    safeText(details, "p", stock ? `${stock} item${stock === 1 ? "" : "s"} available` : "SOLD OUT", `customer-product-stock${stock ? "" : " out-of-stock"}`);
    const options = document.createElement("div"); options.className = "kc-product-options";
    const colors = parseOptions(product.color), sizes = parseOptions(product.size);
    let colorSelect = null, sizeSelect = null;
    if (colors.length) { const label = safeText(options, "label", "Choose colour"); colorSelect = makeSelect(colors, "Colour"); label.appendChild(colorSelect); }
    if (sizes.length) { const label = safeText(options, "label", "Choose size"); sizeSelect = makeSelect(sizes, "Size"); label.appendChild(sizeSelect); }
    const quantityLabel = safeText(options, "label", "Quantity");
    const quantity = document.createElement("input"); quantity.type = "number"; quantity.min = "1"; quantity.max = String(Math.max(1, stock)); quantity.value = "1"; quantity.disabled = stock < 1; quantityLabel.appendChild(quantity);
    details.appendChild(options);
    const add = safeText(details, "button", stock ? "ADD TO BAG" : "SOLD OUT", "kc-button kc-add-button");
    add.type = "button"; add.disabled = stock < 1;
    add.addEventListener("click", () => {
      const qty = Number(quantity.value);
      if (!Number.isInteger(qty) || qty < 1 || qty > stock) return alert(`Please choose a quantity between 1 and ${stock}.`);
      const color = colorSelect ? colorSelect.value : "";
      const size = sizeSelect ? sizeSelect.value : "";
      const key = `${product.id}|${color}|${size}`;
      const existing = cart.find(i => i.key === key);
      if (existing) {
        if (existing.quantity + qty > stock) return alert(`Only ${stock} item(s) are currently available for this product.`);
        existing.quantity += qty;
      } else cart.push({key, product_id: product.id, name: product.name, image_url: product.image_url || "", color, size, quantity: qty, unit_price: Number(product.price) || 0, available_stock: stock});
      saveCart();
      add.textContent = "ADDED TO BAG ✓";
      setTimeout(() => { if (add.isConnected) add.textContent = "ADD TO BAG"; }, 1200);
    });
    card.appendChild(details); container.appendChild(card);
  });
}
async function loadCustomerProducts() {
  const message = $("catalogue-message"); if (!message) return;
  message.textContent = "Loading our collection...";
  const {data, error} = await customerDB.from("products")
    .select("id,name,category,description,size,color,price,stock,image_url,active,created_at")
    .eq("active", true).order("created_at", {ascending:false});
  if (error) { console.error(error); message.textContent = "Products could not load: " + error.message; return; }
  allProducts = data || [];
  // Refresh cart stock and prices from current inventory.
  cart = cart.map(item => { const p = allProducts.find(x => String(x.id) === String(item.product_id)); return p ? {...item, name:p.name, image_url:p.image_url||"", unit_price:Number(p.price)||0, available_stock:Number(p.stock)||0} : item; });
  displayProducts(); saveCart();
}
function cartTotals() {
  const subtotal = cart.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const code = ($("discount-code")?.value || "").trim().toUpperCase();
  const discount = code === "KC10" ? subtotal * .10 : 0;
  const method = $("delivery-method")?.value || "delivery";
  const area = $("delivery-area")?.value || "near_shop";
  let fee = 0;
  if (method === "delivery") fee = area === "near_shop" ? 200 : area === "nairobi" ? 500 : 700;
  const total = Math.max(0, subtotal - discount + fee);
  return {subtotal, discount, fee, total, code, area, method};
}
function renderCart() {
  const container = $("cart-items"); if (!container) return;
  container.replaceChildren();
  if (!cart.length) safeText(container, "p", "Your bag is empty. Add products from Our Collection to begin.", "kc-empty");
  cart.forEach((item, index) => {
    const row = document.createElement("article"); row.className = "kc-cart-line";
    const img = document.createElement("img"); img.alt = item.name || "Product"; if (item.image_url) img.src = item.image_url; img.onerror = () => img.removeAttribute("src");
    row.appendChild(img);
    const info = document.createElement("div"); safeText(info, "h3", item.name);
    if (item.color) safeText(info, "p", "Colour: " + item.color);
    if (item.size) safeText(info, "p", "Size: " + item.size);
    safeText(info, "p", `${money(item.unit_price)} each`);
    const qtyLabel = safeText(info, "label", "Quantity ");
    const qty = document.createElement("input"); qty.type = "number"; qty.min = "1"; qty.max = String(Math.max(1, item.available_stock || 1)); qty.value = item.quantity; qtyLabel.appendChild(qty);
    qty.addEventListener("change", () => {
      const value = Number(qty.value), stock = Number(item.available_stock) || 0;
      if (!Number.isInteger(value) || value < 1 || value > stock) { alert(`Quantity must be between 1 and the available stock (${stock}).`); qty.value = item.quantity; return; }
      cart[index].quantity = value; saveCart();
    });
    const remove = safeText(info, "button", "REMOVE", "kc-button kc-button-outline"); remove.type = "button";
    remove.addEventListener("click", () => { cart.splice(index, 1); saveCart(); });
    row.appendChild(info); container.appendChild(row);
  });
  const t = cartTotals();
  if ($("cart-subtotal")) $("cart-subtotal").textContent = money(t.subtotal);
  if ($("cart-discount")) $("cart-discount").textContent = t.discount ? `−${money(t.discount)} (KC10)` : money(0);
  if ($("cart-delivery")) $("cart-delivery").textContent = t.method === "pickup" ? "Free pickup" : (t.area === "countrywide" ? "KSh 700–800 (owner confirms)" : money(t.fee));
  if ($("cart-total")) $("cart-total").textContent = t.area === "countrywide" && t.method === "delivery" ? `${money(t.total)} (before final delivery adjustment)` : money(t.total);
  updateBagCount();
}
async function loadCustomerAccount() {
  const {data, error} = await customerDB.auth.getUser();
  if (error || !data?.user) { currentCustomer = null; return null; }
  currentCustomer = data.user; return currentCustomer;
}
function showStatus(id, text, error=false) { const e=$(id); if (e) { e.textContent=text; e.style.color=error?"#b42318":""; } }
function setMinimumDates() {
  const today = new Date(); const local = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  ["delivery-date","pickup-date"].forEach(id => { const e=$(id); if(e) { e.min=local; if(!e.value)e.value=local; } });
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
  if ($("mpesa-fields")) $("mpesa-fields").hidden = $("payment-method")?.value !== "demo_mpesa";
  renderCart();
}
function updateCustomerInfo() {
  if (!currentCustomer) return;
  if ($("order-email")) $("order-email").value = currentCustomer.email || "";
  if ($("contact-email")) $("contact-email").value = currentCustomer.email || "";
}
async function loadMyOrders() {
  const list = $("my-orders-list"), status = $("my-orders-status"); if (!list || !status) return;
  list.replaceChildren();
  const user = currentCustomer || await loadCustomerAccount();
  if (!user) { status.textContent = "Please sign in to view your orders."; return; }
  status.textContent = "Loading your orders...";
  const {data, error} = await customerDB.from("orders").select("*").eq("customer_id", user.id).order("created_at", {ascending:false});
  if (error) { status.textContent = "Orders could not load: " + error.message; return; }
  if (!data?.length) { status.textContent = "You have not placed any orders yet."; return; }
  status.textContent = `${data.length} order(s) found.`;
  for (const order of data) {
    const card = document.createElement("article"); card.className = "kc-order-card";
    safeText(card,"h3",`Order ${String(order.id).slice(0,8).toUpperCase()}`);
    safeText(card,"p",`Placed: ${new Date(order.created_at).toLocaleString("en-KE")}`);
    safeText(card,"p",`Total: ${money(order.total)} · Payment: ${order.payment_method} · Payment status: ${order.payment_status}`);
    safeText(card,"p",`Order status: ${order.order_status}`);
    safeText(card,"p",`${order.delivery_method === "pickup" ? "Pickup" : "Delivery"}: ${order.delivery_location || "Shop pickup"} · ${order.delivery_date || ""} ${order.delivery_time || ""}`);
    const itemLine = safeText(card,"p","Loading items...");
    const itemResult = await customerDB.from("order_items").select("product_name,colour,size,quantity,unit_price").eq("order_id",order.id);
    if (itemResult.error) itemLine.textContent = "Items could not load.";
    else itemLine.textContent = (itemResult.data || []).map(i => `${i.product_name}${i.colour ? " ("+i.colour+")" : ""}${i.size ? " / "+i.size : ""} × ${i.quantity} — ${money(i.unit_price)}`).join("; ") || "No item details.";
    list.appendChild(card);
  }
}
async function placeOrder(event) {
  event.preventDefault();
  if (!cart.length) return showStatus("checkout-status","Your bag is empty. Add at least one product first.",true);
  const user = currentCustomer || await loadCustomerAccount();
  if (!user) return showStatus("checkout-status","Please sign in to your customer account before placing an order.",true);
  const totals = cartTotals();
  if (totals.code && totals.code !== "KC10") return showStatus("checkout-status","That discount code is not valid. Remove it or try KC10.",true);
  const name=$("order-name").value.trim(), phone=$("order-phone").value.trim(), email=$("order-email").value.trim();
  const method=$("delivery-method").value, payment=$("payment-method").value;
  const area=$("delivery-area")?.value || "near_shop";
  const location=method==="pickup" ? "Shop pickup" : $("delivery-location").value.trim();
  const date=method==="pickup" ? $("pickup-date").value : $("delivery-date").value;
  const time=method==="pickup" ? $("pickup-time").value : $("delivery-time").value;
  const now = new Date(); const today = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  if (date && date < today) return showStatus("checkout-status","Please choose today or a future date.",true);
  if (method==="delivery" && area==="countrywide" && !confirm("Countrywide delivery costs KSh 700–800. The owner will confirm the final charge. Continue?")) return;
  if (payment==="demo_mpesa" && demoPaymentResult !== "success") return showStatus("checkout-status","For demo M-Pesa, use SIMULATE PAYMENT SUCCESS first. No real payment is processed.",true);
  const btn=$("place-order-button"); btn.disabled=true; showStatus("checkout-status","Saving your order...");
  try {
    // Verify current stock before saving.
    for (const item of cart) {
      const {data,error}=await customerDB.from("products").select("id,name,stock,active,price").eq("id",item.product_id).maybeSingle();
      if(error) throw error;
      if(!data || !data.active || Number(data.stock)<item.quantity) throw new Error(`Stock changed for ${item.name}. Refresh the page and review your bag.`);
    }
    const fee=method==="pickup"?0:area==="near_shop"?200:area==="nairobi"?500:800;
    const adjustedTotal=Math.max(0,totals.subtotal-totals.discount+fee);
    const payload={
      customer_id:user.id, customer_name:name, customer_email:email, customer_phone:phone,
      delivery_method:method, delivery_location:location, delivery_area:method==="pickup"?"pickup":area,
      delivery_date:date || null, delivery_time:time || null, delivery_fee:fee,
      subtotal:totals.subtotal, discount_code:totals.discount?totals.code:null, discount_amount:totals.discount,
      total:adjustedTotal, payment_method:payment==="demo_mpesa"?"demo_mpesa":"cash_on_delivery",
      payment_status:payment==="demo_mpesa"?"paid_simulated":"unpaid",
      order_status:"pending", mpesa_phone:payment==="demo_mpesa"?($("mpesa-phone").value.trim()||phone):null,
      order_notes:$("order-notes").value.trim() || null
    };
    const {data:order,error}=await customerDB.from("orders").insert(payload).select("*").single();
    if(error) throw error;
    const itemRows=cart.map(item=>({order_id:order.id,product_id:String(item.product_id),product_name:item.name,colour:item.color||null,size:item.size||null,quantity:item.quantity,unit_price:item.unit_price,line_total:item.unit_price*item.quantity}));
    const {error:itemError}=await customerDB.from("order_items").insert(itemRows);
    if(itemError) throw new Error("Order was created but its items could not be saved: "+itemError.message+". Please contact the owner before trying again.");
    const receiptItems=cart.map(i=>`${i.name}${i.color?" ("+i.color+")":""}${i.size?" / "+i.size:""} x${i.quantity}`).join("; ");
    cart=[]; saveCart(); demoPaymentResult=null; $("checkout-form").reset(); setMinimumDates(); updateCheckoutFields(); updateCustomerInfo();
    showStatus("checkout-status",`Order placed successfully! Reference: ${String(order.id).slice(0,8).toUpperCase()}. Items: ${receiptItems}. Your order is awaiting owner confirmation. ${payment==="demo_mpesa"?"Payment marked as simulated only.":"Cash on Delivery remains UNPAID until the owner confirms collection."}`);
    await loadMyOrders();
  } catch(error) {
    console.error("Order placement error",error);
    showStatus("checkout-status","Could not complete order: "+error.message,true);
  } finally { btn.disabled=false; }
}
$("category-filter")?.addEventListener("change",displayProducts);
$("delivery-method")?.addEventListener("change",updateCheckoutFields);
$("delivery-area")?.addEventListener("change",renderCart);
$("discount-code")?.addEventListener("input",renderCart);
$("payment-method")?.addEventListener("change",updateCheckoutFields);
$("checkout-form")?.addEventListener("submit",placeOrder);
$("simulate-mpesa-success")?.addEventListener("click",()=>{demoPaymentResult="success";showStatus("mpesa-demo-status","DEMO ONLY: simulated payment success. No real M-Pesa transaction occurred.");});
$("simulate-mpesa-failure")?.addEventListener("click",()=>{demoPaymentResult="failure";showStatus("mpesa-demo-status","DEMO ONLY: simulated payment failed. No order will be placed until you simulate success.",true);});
$("customer-contact-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const status=$("contact-status"); const user=currentCustomer||await loadCustomerAccount();
  if(!user) { status.textContent="Please sign in before sending a message."; return; }
  const typedEmail=$("contact-email").value.trim();
  if(typedEmail.toLowerCase()!==String(user.email).toLowerCase()) {status.textContent="Use the email linked to your signed-in account.";return;}
  const btn=event.currentTarget.querySelector('button[type="submit"]'); if(btn)btn.disabled=true;
  status.textContent="Sending...";
  const {error}=await customerDB.from("messages").insert({customer_name:$("contact-name").value.trim(),customer_email:user.email,subject:"Customer enquiry",message:$("contact-message").value.trim()});
  if(error) status.textContent="Could not send message: "+error.message;
  else {event.currentTarget.reset(); updateCustomerInfo(); status.textContent="Your message was sent successfully.";}
  if(btn)btn.disabled=false;
});
$("customer-signout")?.addEventListener("click",async()=>{
  const btn=$("customer-signout");btn.disabled=true;
  const {error}=await customerDB.auth.signOut();
  if(error){btn.disabled=false;alert("Could not sign out: "+error.message);return;}
  window.location.replace("index.html");
});
async function loadCustomerMessages() {
  const contactForm=$("customer-contact-form"); if(!contactForm)return;
  let section=$("customer-messages-section");
  if(!section){section=document.createElement("section");section.id="customer-messages-section";section.className="kc-section";section.innerHTML='<div class="kc-section-inner"><h2 class="kc-section-heading">MY MESSAGES</h2><p id="customer-messages-status"></p><div id="customer-messages-list"></div></div>';contactForm.insertAdjacentElement("afterend",section);}
  const user=currentCustomer||await loadCustomerAccount(); const list=$("customer-messages-list"); if(!list)return;
  if(!user){$("customer-messages-status").textContent="Sign in to view messages.";return;}
  const {data,error}=await customerDB.from("messages").select("id,subject,message,created_at,reply,replied_at").eq("customer_email",user.email).order("created_at",{ascending:false});
  list.replaceChildren();
  if(error){$("customer-messages-status").textContent="Messages unavailable: "+error.message;return;}
  $("customer-messages-status").textContent=data?.length?`${data.length} message(s)`:"No messages yet.";
  (data||[]).forEach(m=>{const c=document.createElement("article");c.className="kc-order-card";safeText(c,"h3",m.subject||"Enquiry");safeText(c,"p",m.message);safeText(c,"p",m.reply?`Owner reply: ${m.reply}`:"Awaiting owner reply.");list.appendChild(c);});
}
async function loadCustomerPage() {
  await loadCustomerAccount(); updateCustomerInfo(); setMinimumDates(); updateCheckoutFields();
  if($("order-name") && currentCustomer) $("order-name").value=currentCustomer.user_metadata?.full_name||"";
  await loadCustomerProducts(); renderCart(); await loadMyOrders(); await loadCustomerMessages();
}
loadCustomerPage();
window.addEventListener("focus",()=>{loadCustomerProducts();loadMyOrders();});
customerDB.channel("customer-product-updates").on("postgres_changes",{event:"*",schema:"public",table:"products"},loadCustomerProducts).subscribe();
