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

  catalogueMessage.textContent = products.length +
    (products.length === 1 ? " product available." : " products available.");

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
      addProductText(details, "p", "color: " + product.color);
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

// Customer sign-out button
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

// Load and refresh the catalogue
loadCustomerProducts();

window.addEventListener("focus", loadCustomerProducts);

window.setInterval(loadCustomerProducts, 30000);

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
