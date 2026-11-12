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

// PRODUCT CATALOGUE
function displayProducts() {
  if (!productsContainer) return;

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

  catalogueMessage.textContent =
    products.length +
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
