const CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

// Catalogue elements
const productsContainer = document.getElementById("customer-products");
const catalogueMessage = document.getElementById("catalogue-message");
const categoryFilter = document.getElementById("category-filter");

let allProducts = [];
let currentCustomer = null;

// General helpers
function priceKES(price) {
  return "KES " + Number(price || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2
  });
}

function addProductText(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

// SHOPPING BAG (saved in this browser so the bag remains after a refresh)
const CUSTOMER_CART_KEY = "kelsiys_closet_customer_cart_v1";
let customerCart = readCustomerCart();

function readCustomerCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOMER_CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn("Could not read the saved shopping bag:", error);
    return [];
  }
}

function saveCustomerCart() {
  try { localStorage.setItem(CUSTOMER_CART_KEY, JSON.stringify(customerCart)); }
  catch (error) { console.warn("Could not save the shopping bag:", error); }
  renderCustomerCart();
}

function optionValues(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return [fallback];
  const values = text.split(/[,/|]/).map(item => item.trim()).filter(Boolean);
  return values.length ? values : [text];
}

function makeOptionSelect(labelText, values, className) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.className = className;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value; option.textContent = value; select.appendChild(option);
  });
  label.appendChild(select);
  return { label, select };
}

function addProductToCart(product, size, color, quantity) {
  const stock = Math.max(0, Number(product.stock) || 0);
  const key = [String(product.id), size, color].join("::");
  const existing = customerCart.find(item => item.key === key);
  const currentQuantity = existing ? Number(existing.quantity) : 0;
  if (currentQuantity + quantity > stock) {
    setCartMessage("Only " + Math.max(0, stock - currentQuantity) + " more item(s) of this product are available.");
    return;
  }
  if (existing) existing.quantity += quantity;
  else customerCart.push({
    key, productId: product.id, name: product.name || "Fashion item",
    price: Number(product.price) || 0, imageUrl: product.image_url || "",
    size, color, quantity, stock
  });
  saveCustomerCart();
  setCartMessage((product.name || "Item") + " added to your shopping bag.");
}

function setCartMessage(message) {
  const element = document.getElementById("customer-cart-message");
  if (element) element.textContent = message;
}

function renderCustomerCart() {
  const container = document.getElementById("customer-cart-items");
  const count = document.getElementById("customer-cart-count");
  const subtotalElement = document.getElementById("customer-cart-subtotal");
  if (!container) return;
  container.replaceChildren();
  const totalItems = customerCart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  if (count) count.textContent = String(totalItems);
  const subtotal = customerCart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  if (subtotalElement) subtotalElement.textContent = priceKES(subtotal);

  if (!customerCart.length) {
    addProductText(container, "p", "Your shopping bag is empty. Add something you love from the collection.");
    return;
  }

  customerCart.forEach(item => {
    const row = document.createElement("article");
    row.className = "customer-cart-row";
    const image = document.createElement("img");
    image.alt = item.name || "Fashion item"; image.loading = "lazy";
    if (item.imageUrl) image.src = item.imageUrl;
    image.onerror = () => image.removeAttribute("src");
    row.appendChild(image);
    const details = document.createElement("div");
    addProductText(details, "h3", item.name || "Fashion item");
    addProductText(details, "p", priceKES(item.price) + " each");
    addProductText(details, "p", "Size: " + (item.size || "Not specified") + " · Colour: " + (item.color || "Not specified"));
    const actions = document.createElement("div"); actions.className = "customer-cart-actions";
    const quantity = document.createElement("input"); quantity.type = "number"; quantity.min = "1"; quantity.max = String(Math.max(1, Number(item.stock) || 1)); quantity.value = String(item.quantity); quantity.className = "customer-cart-quantity"; quantity.setAttribute("aria-label", "Quantity for " + item.name);
    quantity.addEventListener("change", () => {
      const requested = Math.floor(Number(quantity.value));
      const stock = Math.max(0, Number(item.stock) || 0);
      if (!Number.isFinite(requested) || requested < 1) { quantity.value = String(item.quantity); return; }
      if (requested > stock) { setCartMessage("Quantity cannot exceed available stock (" + stock + ")."); quantity.value = String(item.quantity); return; }
      item.quantity = requested; saveCustomerCart(); setCartMessage("Shopping bag updated.");
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "customer-cart-remove"; remove.textContent = "REMOVE";
    remove.addEventListener("click", () => { customerCart = customerCart.filter(cartItem => cartItem.key !== item.key); saveCustomerCart(); setCartMessage("Item removed from your bag."); });
    actions.append(quantity, remove); details.appendChild(actions); row.appendChild(details);
    const lineTotal = document.createElement("strong"); lineTotal.textContent = priceKES((Number(item.price) || 0) * (Number(item.quantity) || 0)); row.appendChild(lineTotal);
    container.appendChild(row);
  });
}

const clearCartButton = document.getElementById("customer-clear-cart");
if (clearCartButton) clearCartButton.addEventListener("click", () => {
  customerCart = []; saveCustomerCart(); setCartMessage("Your shopping bag has been cleared.");
});

// PRODUCT CATALOGUE
function displayProducts() {
  if (!productsContainer) return;

  productsContainer.replaceChildren();
  const selected = (categoryFilter?.value || "all").toLowerCase();
  const products = allProducts.filter(product => selected === "all" || String(product.category || "").toLowerCase() === selected);

  if (!products.length) {
    catalogueMessage.textContent = allProducts.length ? "There are no products in this category yet." : "No active products are available yet. Please check back soon.";
    return;
  }

  catalogueMessage.textContent = products.length + (products.length === 1 ? " product available." : " products available.");

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "customer-product-card";
    if (product.image_url) {
      const image = document.createElement("img"); image.className = "customer-product-image"; image.src = product.image_url; image.alt = product.name || "Fashion product"; image.loading = "lazy";
      image.onerror = () => { image.removeAttribute("src"); image.alt = "Product image unavailable"; };
      card.appendChild(image);
    } else {
      const placeholder = document.createElement("div"); placeholder.className = "customer-product-image"; placeholder.style.display = "grid"; placeholder.style.placeItems = "center"; placeholder.textContent = "KELSIY'S CLOSET"; card.appendChild(placeholder);
    }

    const details = document.createElement("div"); details.className = "customer-product-details";
    addProductText(details, "h3", product.name || "Fashion item");
    addProductText(details, "p", priceKES(product.price), "customer-product-price");
    if (product.category) addProductText(details, "p", "Category: " + product.category);
    if (product.description) addProductText(details, "p", product.description);
    const stock = Math.max(0, Number(product.stock) || 0);
    addProductText(details, "p", stock > 0 ? stock + (stock === 1 ? " item available" : " items available") : "OUT OF STOCK", stock > 0 ? "customer-product-stock" : "customer-product-stock out-of-stock");

    const options = document.createElement("div"); options.className = "customer-product-options";
    const sizes = optionValues(product.size, "One size");
    const colors = optionValues(product.color, "As shown");
    const sizeControl = makeOptionSelect("SIZE", sizes, "customer-product-size");
    const colorControl = makeOptionSelect("COLOUR", colors, "customer-product-color");
    options.append(sizeControl.label, colorControl.label);
    details.appendChild(options);

    const quantityLabel = document.createElement("label"); quantityLabel.textContent = "QUANTITY"; quantityLabel.style.display = "block"; quantityLabel.style.fontWeight = "700"; quantityLabel.style.color = "var(--burgundy)"; quantityLabel.style.fontSize = "12px";
    const quantityInput = document.createElement("input"); quantityInput.type = "number"; quantityInput.min = "1"; quantityInput.max = String(Math.max(1, stock)); quantityInput.value = "1"; quantityInput.disabled = stock < 1; quantityInput.style.width = "100%"; quantityInput.style.boxSizing = "border-box"; quantityInput.style.padding = "10px"; quantityInput.style.marginTop = "5px"; quantityInput.style.border = "1px solid #d9c5c8"; quantityInput.style.borderRadius = "5px"; quantityLabel.appendChild(quantityInput); details.appendChild(quantityLabel);

    const addButton = document.createElement("button"); addButton.type = "button"; addButton.className = "customer-add-to-cart"; addButton.textContent = stock > 0 ? "ADD TO BAG" : "OUT OF STOCK"; addButton.disabled = stock < 1;
    addButton.addEventListener("click", () => {
      const quantity = Math.floor(Number(quantityInput.value));
      if (!Number.isFinite(quantity) || quantity < 1) { setCartMessage("Please choose a quantity of at least 1."); return; }
      if (quantity > stock) { setCartMessage("Only " + stock + " item(s) are available in stock."); quantityInput.value = String(Math.max(1, stock)); return; }
      addProductToCart(product, sizeControl.select.value, colorControl.select.value, quantity);
    });
    details.appendChild(addButton); card.appendChild(details); productsContainer.appendChild(card);
  });
}

async function loadCustomerProducts() {
  if (!productsContainer || !catalogueMessage) return;

  catalogueMessage.textContent = "Loading our collection...";

  const { data, error } = await customerDB
    .from("products")
    .select(
      "id,name,category,description,size,color,price,stock,image_url,active,created_at"
    )
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load customer products:", error);
    catalogueMessage.textContent =
      "Products could not load: " + error.message;
    return;
  }

  allProducts = data || [];
  displayProducts();
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", displayProducts);
}

// CUSTOMER ACCOUNT
async function loadCustomerAccount() {
  const { data, error } = await customerDB.auth.getUser();

  if (error || !data?.user) {
    currentCustomer = null;
    return null;
  }

  currentCustomer = data.user;
  return currentCustomer;
}

// CUSTOMER MESSAGES AND OWNER REPLIES
function createCustomerMessagesSection() {
  let section = document.getElementById("customer-messages-section");

  if (section) return section;

  section = document.createElement("section");
  section.id = "customer-messages-section";
  section.className = "customer-messages-section";

  section.style.margin = "24px 0";
  section.style.padding = "20px";
  section.style.borderRadius = "12px";
  section.style.background = "#fffaf4";
  section.style.color = "#481027";

  const heading = document.createElement("h2");
  heading.textContent = "My Messages";

  const description = document.createElement("p");
  description.textContent =
    "View your enquiries and replies from Kelsiy's Closet.";

  const list = document.createElement("div");
  list.id = "customer-messages-list";

  section.append(heading, description, list);

  const contactForm = document.getElementById("customer-contact-form");

  if (contactForm) {
    contactForm.insertAdjacentElement("afterend", section);
  } else if (productsContainer?.parentElement) {
    productsContainer.parentElement.insertBefore(section, productsContainer);
  } else {
    document.body.appendChild(section);
  }

  return section;
}

async function loadCustomerMessages() {
  const section = createCustomerMessagesSection();
  const list = document.getElementById("customer-messages-list");

  if (!list) return;

  list.replaceChildren();

  const user = currentCustomer || await loadCustomerAccount();

  if (!user || !user.email) {
    addProductText(
      list,
      "p",
      "Please sign in to your customer account to view your messages."
    );
    return;
  }

  addProductText(list, "p", "Loading your messages...");

  const { data, error } = await customerDB
    .from("messages")
    .select(
      "id,customer_name,customer_email,subject,message,created_at,reply,replied_at"
    )
    .eq("customer_email", user.email)
    .order("created_at", { ascending: false });

  list.replaceChildren();

  if (error) {
    console.error("Could not load customer messages:", error);

    addProductText(
      list,
      "p",
      "Your messages could not load. Please refresh the page and try again."
    );
    return;
  }

  if (!data || data.length === 0) {
    addProductText(
      list,
      "p",
      "You have not sent any messages yet. Your enquiries and replies will appear here."
    );
    return;
  }

  data.forEach((message) => {
    const card = document.createElement("article");

    card.style.padding = "16px";
    card.style.margin = "14px 0";
    card.style.border = "1px solid #e5d4d9";
    card.style.borderRadius = "10px";
    card.style.background = "#ffffff";

    addProductText(
      card,
      "h3",
      message.subject || "Customer enquiry"
    );

    addProductText(
      card,
      "p",
      "Sent: " + (
        message.created_at
          ? new Date(message.created_at).toLocaleString("en-KE")
          : "Date unavailable"
      )
    );

    addProductText(card, "p", "Your message:");
    addProductText(card, "p", message.message || "");

    const replyHeading = document.createElement("h4");
    replyHeading.textContent = "Reply from Kelsiy's Closet";
    replyHeading.style.marginTop = "16px";
    card.appendChild(replyHeading);

    if (message.reply && message.reply.trim()) {
      addProductText(card, "p", message.reply);

      if (message.replied_at) {
        addProductText(
          card,
          "small",
          "Replied: " +
            new Date(message.replied_at).toLocaleString("en-KE")
        );
      }
    } else {
      addProductText(card, "p", "Awaiting a reply from the owner.");
    }

    list.appendChild(card);
  });
}

// CONTACT FORM SUBMISSION
const customerContactForm =
  document.getElementById("customer-contact-form");

const contactStatus = document.getElementById("contact-status");

if (customerContactForm) {
  customerContactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = customerContactForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    const name = document.getElementById("contact-name")?.value.trim();
    const typedEmail = document.getElementById("contact-email")?.value.trim();
    const message = document.getElementById("contact-message")?.value.trim();

    if (contactStatus) {
      contactStatus.textContent = "";
    }

    if (!name || !typedEmail || !message) {
      if (contactStatus) {
        contactStatus.textContent =
          "Please enter your name, email and message.";
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (contactStatus) {
      contactStatus.textContent = "Sending your message...";
    }

    try {
      const user = currentCustomer || await loadCustomerAccount();

      if (!user || !user.email) {
        throw new Error(
          "Please sign in to your customer account before sending a message."
        );
      }

      if (typedEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error(
          "Please use the email address linked to your customer account."
        );
      }

      const { error } = await customerDB
        .from("messages")
        .insert({
          customer_name: name,
          customer_email: user.email,
          subject: "Customer enquiry",
          message: message
        });

      if (error) throw error;

      customerContactForm.reset();

      const emailInput = document.getElementById("contact-email");
      if (emailInput) {
        emailInput.value = user.email;
      }

      if (contactStatus) {
        contactStatus.textContent =
          "Your message was sent successfully!";
      }

      await loadCustomerMessages();
    } catch (error) {
      console.error("Could not send customer message:", error);

      if (contactStatus) {
        contactStatus.textContent =
          error.message || "Your message could not be sent. Please try again.";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

// Keep the form email matched to the signed-in customer account.
async function prepareContactForm() {
  const user = await loadCustomerAccount();
  const emailInput = document.getElementById("contact-email");

  if (emailInput && user?.email) {
    emailInput.value = user.email;
  }
}

// CUSTOMER SIGN-OUT
const customerSignOut = document.getElementById("customer-signout");

if (customerSignOut) {
  customerSignOut.addEventListener("click", async () => {
    customerSignOut.disabled = true;
    customerSignOut.textContent = "SIGNING OUT...";

    const { error } = await customerDB.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error);
      customerSignOut.disabled = false;
      customerSignOut.textContent = "SIGN OUT";

      alert("We could not sign you out. Please try again.");
      return;
    }

    window.location.replace("index.html");
  });
}

// INITIAL LOAD AND REFRESH
async function loadCustomerPage() {
  renderCustomerCart();
  await loadCustomerAccount();
  await prepareContactForm();
  await loadCustomerProducts();
  await loadCustomerMessages();
}

loadCustomerPage();

window.addEventListener("focus", () => {
  loadCustomerProducts();
  loadCustomerMessages();
});

window.setInterval(() => {
  loadCustomerProducts();
  loadCustomerMessages();
}, 30000);

customerDB
  .channel("customer-product-updates")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products"
    },
    () => loadCustomerProducts()
  )
  .subscribe();
