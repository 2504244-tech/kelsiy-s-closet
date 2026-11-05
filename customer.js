const CUSTOMER_SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";
const CUSTOMER_SUPABASE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const customerDB = window.supabase.createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_KEY
);

const productContainer = document.getElementById("customer-products");
const catalogueMessage = document.getElementById("catalogue-message");
const categoryFilter = document.getElementById("category-filter");

let customerProducts = [];

function formatPrice(price) {
  return "KES " + Number(price || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2
  });
}

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

function displayProducts() {
  if (!productContainer) return;

  productContainer.replaceChildren();

  const selectedCategory = categoryFilter
    ? categoryFilter.value.toLowerCase()
    : "all";

  const filteredProducts = customerProducts.filter((product) => {
    const category = String(product.category || "").toLowerCase();

    if (selectedCategory === "all") return true;

    return category === selectedCategory;
  });

  if (filteredProducts.length === 0) {
    catalogueMessage.textContent =
      selectedCategory === "all"
        ? "Our collection is being updated. Please check back soon."
        : "There are currently no products in this category.";

    return;
  }

  catalogueMessage.textContent =
    filteredProducts.length + " product(s) available in our collection.";

  filteredProducts.forEach((product) => {
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

    addText(details, "h3", product.name || "Fashion item");

    addText(
      details,
      "p",
      formatPrice(product.price),
      "customer-product-price"
    );

    if (product.category) {
      addText(details, "p", "Category: " + product.category);
    }

    if (product.size) {
      addText(details, "p", "Size: " + product.size);
    }

    if (product.colour) {
      addText(details, "p", "Colour: " + product.colour);
    }

    if (product.description) {
      addText(details, "p", product.description);
    }

    const stock = Number(product.stock) || 0;

    if (stock > 0) {
      addText(
        details,
        "p",
        stock + (stock === 1 ? " item available" : " items available"),
        "customer-product-stock"
      );
    } else {
      addText(
        details,
        "p",
        "OUT OF STOCK",
        "customer-product-stock out-of-stock"
      );
    }

    card.appendChild(details);
    productContainer.appendChild(card);
  });
}

async function loadCustomerProducts() {
  if (!productContainer || !catalogueMessage) return;

  catalogueMessage.textContent = "Loading our collection...";

  const { data, error } = await customerDB
    .from("products")
    .select(
      "id,name,category,description,size,colour,price,stock,image_url,active,created_at"
    )
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Customer catalogue error:", error);
    catalogueMessage.textContent =
      "We couldn't load the collection right now. Please refresh and try again.";
    return;
  }

  customerProducts = data || [];
  displayProducts();
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", displayProducts);
}

// Load products when the customer page opens.
loadCustomerProducts();

// Refresh the catalogue when the customer returns to the page.
window.addEventListener("focus", loadCustomerProducts);

// Keep the catalogue updated periodically.
window.setInterval(loadCustomerProducts, 30000);

// Listen for live product changes when Supabase Realtime is enabled.
customerDB
  .channel("customer-product-updates")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products"
    },
    () => {
      loadCustomerProducts();
    }
  )
  .subscribe();
