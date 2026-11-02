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
