const CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

const productsContainer = document.getElementById("customer-products");
const catalogueMessage = document.getElementById("catalogue-message");
const categoryFilter = document.getElementById("category-filter");

let allProducts = [];

// --------------------
// GENERAL HELPERS
// --------------------

function priceKES(price) {
  return "KES " + Number(price || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2
  });
}

function addProductText(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) element.className = className;

  parent.appendChild(element);
  return element;
}

// --------------------
// CUSTOMER PRODUCT CATALOGUE
// --------------------

function displayProducts() {
  if (!productsContainer || !catalogueMessage) return;

  productsContainer.replaceChildren();

  const selected = (categoryFilter?.value || "all").toLowerCase();

  const products = allProducts.filter((product) => {
    return selected === "all" ||
      String(product.category || "").toLowerCase() === selected;
  });

  if (!products.length) {
    catalogueMessage.textContent = allProducts.length
      ? "There are no products in this category yet."
      : "No active products are available yet. Please check back soon.";
    return;
  }

  catalogueMessage.textContent = products.length +
    (products.length === 1
      ? " product available."
      : " products available.");

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "customer-product-card";

    if (product.image_url) {
      const image = document.createElement("img");
      image.className = "customer-product-image";
      image.src = product.image_url;
      image.alt = product.name || "Fashion product";
      image.loading = "lazy";

      image.onerror = () => {
        image.removeAttribute("src");
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

    addProductText(details, "h3", product.name || "Fashion item");

    addProductText(
      details,
      "p",
      priceKES(product.price),
      "customer-product-price"
    );

    if (product.category) {
      addProductText(details, "p", "Category: " + product.category);
    }

    if (product.size) {
      addProductText(details, "p", "Size: " + product.size);
    }

    if (product.color) {
      addProductText(details, "p", "Colour: " + product.color);
    }

    if (product.description) {
      addProductText(details, "p", product.description);
    }

    const stock = Math.max(0, Number(product.stock) || 0);

    addProductText(
      details,
      "p",
      stock > 0
        ? stock + (stock === 1 ? " item available" : " items available")
        : "OUT OF STOCK",
      stock > 0
        ? "customer-product-stock"
        : "customer-product-stock out-of-stock"
    );

    card.appendChild(details);
    productsContainer.appendChild(card);
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

// --------------------
// CUSTOMER MESSAGES
// --------------------

// Create the messages section automatically, so you do not
// have to add new HTML elements manually.

function createMessagesSection() {
  let section = document.getElementById("customer-messages-section");

  if (section) {
    return {
      section,
      status: document.getElementById("customer-messages-status"),
      list: document.getElementById("customer-messages-list")
    };
  }

  section = document.createElement("section");
  section.id = "customer-messages-section";
  section.style.cssText = `
    margin: 25px 0;
    padding: 20px;
    border: 1px solid #e4d4d8;
    border-radius: 12px;
    background: #fffaf4;
    color: #3e1023;
  `;

  const heading = document.createElement("h2");
  heading.textContent = "My Messages";
  heading.style.color = "#701b39";

  const description = document.createElement("p");
  description.textContent =
    "View your messages and replies from Kelsiy's Closet.";

  const status = document.createElement("p");
  status.id = "customer-messages-status";
  status.textContent = "Loading your messages...";

  const list = document.createElement("div");
  list.id = "customer-messages-list";

  section.append(heading, description, status, list);

  if (productsContainer?.parentElement) {
    productsContainer.parentElement.insertBefore(section, productsContainer);
  } else {
    document.body.appendChild(section);
  }

  return { section, status, list };
}

const customerMessagesUI = createMessagesSection();

function formatMessageDate(dateValue) {
  if (!dateValue) return "Date unavailable";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function displayCustomerMessages(messages) {
  const { status, list } = customerMessagesUI;

  if (!status || !list) return;

  list.replaceChildren();

  if (!messages.length) {
    status.textContent = "You do not have any messages yet.";
    return;
  }

  status.textContent = messages.length +
    (messages.length === 1 ? " message found." : " messages found.");

  messages.forEach((message) => {
    const card = document.createElement("article");

    card.style.cssText = `
      margin-top: 15px;
      padding: 16px;
      border: 1px solid #e4d4d8;
      border-radius: 10px;
      background: white;
    `;

    addProductText(
      card,
      "h3",
      message.subject || "Message to Kelsiy's Closet"
    );

    addProductText(
      card,
      "p",
      "Sent: " + formatMessageDate(message.created_at)
    );

    addProductText(card, "p", "Your message:");

    const originalMessage = document.createElement("p");
    originalMessage.textContent = message.message || "";
    originalMessage.style.whiteSpace = "pre-wrap";
    card.appendChild(originalMessage);

    const divider = document.createElement("hr");
    divider.style.border = "0";
    divider.style.borderTop = "1px solid #e4d4d8";
    card.appendChild(divider);

    if (message.reply && message.reply.trim()) {
      addProductText(card, "h4", "Reply from Kelsiy's Closet");

      const reply = document.createElement("p");
      reply.textContent = message.reply;
      reply.style.whiteSpace = "pre-wrap";
      reply.style.background = "#f8edf1";
      reply.style.padding = "12px";
      reply.style.borderRadius = "8px";
      card.appendChild(reply);

      if (message.replied_at) {
        addProductText(
          card,
          "small",
          "Reply received: " + formatMessageDate(message.replied_at)
        );
      }
    } else {
      const waiting = addProductText(
        card,
        "p",
        "Awaiting a reply from Kelsiy's Closet."
      );

      waiting.style.color = "#8a5b6c";
      waiting.style.fontStyle = "italic";
    }

    list.appendChild(card);
  });
}

async function loadCustomerMessages() {
  const { status } = customerMessagesUI;

  if (!status) return;

  const { data: userResult, error: userError } =
    await customerDB.auth.getUser();

  if (userError || !userResult?.user) {
    status.textContent = "Please sign in to view your messages.";
    return;
  }

  const email = userResult.user.email;

  if (!email) {
    status.textContent = "Your account email could not be found.";
    return;
  }

  status.textContent = "Loading your messages...";

  const { data, error } = await customerDB
    .from("messages")
    .select(
      "id,customer_name,customer_email,subject,message,created_at,reply,replied_at"
    )
    .eq("customer_email", email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load customer messages:", error);
    status.textContent =
      "Messages could not load. Please check the messages table permissions.";
    return;
  }

  displayCustomerMessages(data || []);
}

// --------------------
// CUSTOMER SIGN OUT
// --------------------

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

// --------------------
// LOAD AND REFRESH
// --------------------

loadCustomerProducts();
loadCustomerMessages();

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
