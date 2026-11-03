/* =========================================
   KELSIY'S CLOSET
   Login and Account Management
   ========================================= */

// STEP 1: ENTER YOUR SUPABASE DETAILS HERE

const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";


// STEP 2: CONNECT THE HTML ELEMENTS

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const authForm = document.getElementById("auth-form");
const message = document.getElementById("message");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");
const switchModeButton = document.getElementById("switch-mode");
const switchPrompt = document.getElementById("switch-prompt");

let isSignUp = false;
let supabaseClient = null;


// STEP 3: CHECK SUPABASE CONFIGURATION

function configurationReady() {
    return (
        SUPABASE_URL.startsWith("https://") &&
        !SUPABASE_URL.includes("PASTE_") &&
        SUPABASE_PUBLISHABLE_KEY.length > 20 &&
        !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_")
    );
}


// STEP 4: DISPLAY MESSAGES

function setMessage(text) {
    message.textContent = text;
}


// STEP 5: SHOW THE LOGIN PAGE

function showLogin(text = "") {
    authView.hidden = false;
    appView.hidden = true;
    setMessage(text);
}


// STEP 6: SHOW THE CORRECT DASHBOARD

function showDashboard(user, role) {
    authView.hidden = true;
    appView.hidden = false;

    document.getElementById("welcome-title").textContent =
        "Welcome, " + (user.email || "User");

    const isOwner = role === "owner";

    document.getElementById("owner-content").hidden = !isOwner;
    document.getElementById("customer-content").hidden = isOwner;

    document.getElementById("role-message").textContent = isOwner
        ? "You are signed in as the business owner."
        : "You are signed in as a customer.";
}


// STEP 7: GET THE USER'S ROLE FROM SUPABASE

async function getUserRole(user) {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Role lookup error:", error);

        throw new Error(
            "You signed in, but your user role could not be loaded. " +
            "Please check the profiles table and its permissions."
        );
    }

    // Unknown or missing roles are treated as customer access.
    return data && data.role === "owner"
        ? "owner"
        : "customer";
}


// STEP 8: SIGN IN OR CREATE AN ACCOUNT

authForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!configurationReady() || !supabaseClient) {
        setMessage(
            "Please add your Supabase URL and publishable key in script.js."
        );
        return;
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitButton.disabled = true;
    submitButton.textContent = isSignUp
        ? "Creating account..."
        : "Signing in...";

    setMessage("");

    try {
        if (isSignUp) {

            // CREATE A NEW CUSTOMER ACCOUNT
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            if (!data.session) {
                setMessage(
                    "Your account has been created. Check your email " +
                    "to confirm it, then sign in."
                );
            } else {
                setMessage(
                    "Account created. Your profile needs to be configured " +
                    "before role-based access can work."
                );
            }

        } else {

            // SIGN IN TO AN EXISTING ACCOUNT
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) {
                throw error;
            }

            const role = await getUserRole(data.user);

            showDashboard(data.user, role);
        }

    } catch (error) {
        console.error("Authentication error:", error);

        setMessage(
            error.message || "Unable to sign in. Please try again."
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = isSignUp
            ? "Create Account"
            : "Sign In";
    }
});


// STEP 9: SWITCH BETWEEN SIGN IN AND CREATE ACCOUNT

switchModeButton.addEventListener("click", function() {
    isSignUp = !isSignUp;

    formTitle.textContent = isSignUp
        ? "Create Account"
        : "Welcome Back";

    submitButton.textContent = isSignUp
        ? "Create Account"
        : "Sign In";

    switchPrompt.textContent = isSignUp
        ? "Already have an account?"
        : "Don't have an account?";

    switchModeButton.textContent = isSignUp
        ? "Sign In"
        : "Create Account";

    document.getElementById("password").autocomplete =
        isSignUp ? "new-password" : "current-password";

    setMessage("");
});


// STEP 10: SIGN OUT

document.getElementById("sign-out").addEventListener("click", async function() {
    if (!supabaseClient) {
        return;
    }

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        setMessage(error.message);
        return;
    }

    showLogin("You have signed out successfully.");
});


// STEP 11: CONNECT TO SUPABASE

if (configurationReady() && window.supabase) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    // Restore an existing login session if one exists.
    supabaseClient.auth.onAuthStateChange(function(event, session) {
        if (event === "SIGNED_OUT" || !session) {
            showLogin();
        }
    });

    supabaseClient.auth.getSession().then(async function(result) {
        const session = result.data.session;

        if (result.error) {
            showLogin("Could not check your login session.");
            return;
        }

        if (session) {
            try {
                const role = await getUserRole(session.user);
                showDashboard(session.user, role);
            } catch (error) {
                showLogin(error.message);
            }
        }
    });

} else {
    setMessage(
        "Setup required: enter your Supabase URL and publishable key."
    );
}
/* =========================================
   KELSIY'S CLOSET — PRODUCT MANAGEMENT
   ========================================= */

// Load products from Supabase
async function loadProducts() {
    const ownerList = document.getElementById("owner-products-list");
    const customerList = document.getElementById("customer-products");
    const catalogueMessage = document.getElementById("catalogue-message");
    const productMessage = document.getElementById("product-message");

    if (!supabaseClient) return;

    if (catalogueMessage) catalogueMessage.textContent = "Loading products...";
    if (productMessage) productMessage.textContent = "";

    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, category, description, size, colour, price, stock, image_url, active")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Product loading error:", error);
        if (catalogueMessage) catalogueMessage.textContent =
            "Could not load products. Please check your Supabase permissions.";
        if (productMessage) productMessage.textContent =
            "Could not load inventory. Check your Supabase permissions.";
        return;
    }

    const products = data || [];
    const ownerProducts = products.filter(product => product.active !== false);
    const customerProducts = ownerProducts.filter(product => Number(product.stock) > 0);

    if (ownerList) {
        ownerList.replaceChildren();

        if (ownerProducts.length === 0) {
            ownerList.innerHTML =
                '<tr><td colspan="5">No active products yet.</td></tr>';
        } else {
            ownerProducts.forEach(product => {
                const row = document.createElement("tr");

                [
                    product.name || "",
                    product.category || "",
                    "KES " + Number(product.price || 0).toLocaleString(),
                    String(product.stock ?? 0),
                    Number(product.stock) > 0 ? "Available" : "Out of stock"
                ].forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                ownerList.appendChild(row);
            });
        }
    }

    if (customerList) {
        customerList.replaceChildren();

        if (customerProducts.length === 0) {
            customerList.textContent = "No products are currently available.";
        } else {
            customerProducts.forEach(product => {
                const card = document.createElement("article");
                card.className = "product-card";

                if (product.image_url) {
                    const image = document.createElement("img");
                    image.src = product.image_url;
                    image.alt = product.name || "Clothing product";
                    image.loading = "lazy";
                    card.appendChild(image);
                }

                const name = document.createElement("h3");
                name.textContent = product.name || "Unnamed product";
                card.appendChild(name);

                const category = document.createElement("p");
                category.textContent = "Category: " + (product.category || "N/A");
                card.appendChild(category);

                const price = document.createElement("p");
                price.textContent =
                    "Price: KES " + Number(product.price || 0).toLocaleString();
                card.appendChild(price);

                const details = document.createElement("p");
                details.textContent =
                    "Size: " + (product.size || "Not specified") +
                    " | Colour: " + (product.colour || "Not specified");
                card.appendChild(details);

                const stock = document.createElement("p");
                stock.textContent = "Available quantity: " + Number(product.stock || 0);
                card.appendChild(stock);

                if (product.description) {
                    const description = document.createElement("p");
                    description.textContent = product.description;
                    card.appendChild(description);
                }

                customerList.appendChild(card);
            });
        }
    }

    const totalProducts = document.getElementById("total-products");
    const totalStock = document.getElementById("total-stock");

    if (totalProducts) totalProducts.textContent = String(ownerProducts.length);
    if (totalStock) {
        totalStock.textContent = String(
            ownerProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0)
        );
    }
}

// Save a new product from the owner's form
const productForm = document.getElementById("product-form");

if (productForm) {
    productForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        if (!supabaseClient) return;

        const saveButton = productForm.querySelector('button[type="submit"]');
        const productMessage = document.getElementById("product-message");

        const product = {
            name: document.getElementById("product-name").value.trim(),
            category: document.getElementById("product-category").value.trim(),
            description: document.getElementById("product-description").value.trim(),
            size: document.getElementById("product-size").value.trim(),
            colour: document.getElementById("product-colour").value.trim(),
            price: Number(document.getElementById("product-price").value),
            stock: Number(document.getElementById("product-stock").value),
            image_url: document.getElementById("product-image").value.trim() || null,
            active: true
        };

        if (!product.name || !product.category ||
            !Number.isFinite(product.price) || product.price < 0 ||
            !Number.isInteger(product.stock) || product.stock < 0) {
            productMessage.textContent =
                "Enter a product name, category, valid price and whole-number stock.";
            return;
        }

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = "Saving...";
        }

        productMessage.textContent = "";

        try {
            const { error } = await supabaseClient
                .from("products")
                .insert([product]);

            if (error) throw error;

            productMessage.textContent = "Product saved successfully!";
            productForm.reset();
            await loadProducts();
        } catch (error) {
            console.error("Product saving error:", error);
            productMessage.textContent =
                "Product was not saved: " + error.message;
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = "Save Product";
            }
        }
    });
}

// Refresh inventory when the owner clicks the button
const refreshProductsButton = document.getElementById("refresh-products");

if (refreshProductsButton) {
    refreshProductsButton.addEventListener("click", loadProducts);
}

// Load the correct data whenever a dashboard opens
const originalShowDashboard = showDashboard;

showDashboard = function(user, role) {
    originalShowDashboard(user, role);
    loadProducts();
};

