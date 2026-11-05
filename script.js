/* ==========================================
   KELSIY'S CLOSET
   Login and Account Role Management
   ========================================== */

// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://zqvjaqpqtctnvylgtwjg.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_2sKvDrUEA7KfUKohQ41j1g_54OcXZsR";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// 2. GET PAGE ELEMENTS
const authView = document.getElementById("auth-view");
const authForm = document.getElementById("auth-form");
const appView = document.getElementById("app-view");

const ownerContent = document.getElementById("owner-content");
const customerContent = document.getElementById("customer-content");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const message = document.getElementById("message");
const welcomeTitle = document.getElementById("welcome-title");
const roleMessage = document.getElementById("role-message");

const signOutButton = document.getElementById("sign-out");
const switchModeButton = document.getElementById("switch-mode");
const switchPrompt = document.getElementById("switch-prompt");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");

// 3. ACCOUNT MODE
let isCreatingAccount = false;

// 4. DISPLAY MESSAGES
function showMessage(text, isError = false) {
    if (!message) return;

    message.textContent = text;
    message.style.color = isError ? "#b42318" : "#6d1835";
}

// 5. SHOW THE LOGIN PAGE
function showLogin() {
    authView.hidden = false;
    appView.hidden = true;

    if (ownerContent) ownerContent.hidden = true;
    if (customerContent) customerContent.hidden = true;
}

// 6. SHOW THE CORRECT DASHBOARD
function showDashboard(role) {
    authView.hidden = true;
    appView.hidden = false;

    ownerContent.hidden = role !== "owner";
    customerContent.hidden = role !== "customer";

    if (role === "owner") {
        welcomeTitle.textContent = "Welcome back, Kelsiy!";
        roleMessage.textContent = "OWNER ACCOUNT";
    } else {
        welcomeTitle.textContent = "Welcome back, Customer!";
        roleMessage.textContent = "CUSTOMER ACCOUNT";
    }
}

// 7. CHECK THE USER'S ROLE IN SUPABASE
async function checkUserRole(user) {
    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Profile lookup failed:", error.message);
        showLogin();
        showMessage(
            "We could not verify your account role. Please try again.",
            true
        );
        return;
    }

    if (!profile) {
        showLogin();
        showMessage(
            "Your account profile was not found. Please contact the owner.",
            true
        );
        return;
    }

    const accountRole = String(profile.role || "")
        .trim()
        .toLowerCase();

    if (accountRole === "owner" || accountRole === "admin") {
        showDashboard("owner");
    } else if (accountRole === "customer") {
        showDashboard("customer");
    } else {
        showLogin();
        showMessage(
            "Your account role is not recognized. Please contact the owner.",
            true
        );
    }
}

// 8. SIGN IN OR CREATE AN ACCOUNT
authForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitButton.disabled = true;
    submitButton.textContent = "Please wait...";
    showMessage("");

    try {
        if (isCreatingAccount) {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            if (data.session && data.user) {
                await checkUserRole(data.user);
            } else {
                showMessage(
                    "Account created! Check your email to confirm your account, then sign in."
                );
            }
        } else {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            if (data.user) {
                await checkUserRole(data.user);
            }
        }
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = isCreatingAccount
            ? "Create Account"
            : "Sign In";
    }
});

// 9. SWITCH BETWEEN SIGN IN AND ACCOUNT CREATION
switchModeButton.addEventListener("click", function () {
    isCreatingAccount = !isCreatingAccount;

    formTitle.textContent = isCreatingAccount
        ? "Create Your Account"
        : "Welcome Back";

    submitButton.textContent = isCreatingAccount
        ? "Create Account"
        : "Sign In";

    switchPrompt.textContent = isCreatingAccount
        ? "Already have an account?"
        : "Don't have an account?";

    switchModeButton.textContent = isCreatingAccount
        ? "Sign In"
        : "Create Account";

    passwordInput.value = "";
    showMessage("");
});

// 10. SIGN OUT
signOutButton.addEventListener("click", async function () {
    signOutButton.disabled = true;

    const { error } = await supabaseClient.auth.signOut();

    signOutButton.disabled = false;

    if (error) {
        showMessage(error.message, true);
        return;
    }

    showLogin();
    authForm.reset();
    showMessage("You have signed out successfully.");
});

// 11. RESTORE THE SESSION AFTER A PAGE REFRESH
async function initializeApp() {
    showLogin();

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        showMessage("Could not check your login session.", true);
        return;
    }

    if (data.session?.user) {
        await checkUserRole(data.session.user);
    }
}

initializeApp();
