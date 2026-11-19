/* CUSTOMER CHECKOUT VALIDATION AND PAYMENT STATUS */

function validKenyanPhone(value) {
  const phone = String(value ?? "").replace(/[\s()-]/g, "");

  // Accept exactly 10 digits starting with 01 or 07,
  // or the equivalent +254 / 254 international format.
  return /^(?:0[17]\d{8}|\+254[17]\d{8}|254[17]\d{8})$/.test(phone);
}

function normalisePaymentMethod(value) {
  const method = String(value ?? "").trim().toLowerCase();

  if (method.includes("mpesa") || method.includes("m-pesa")) {
    return "M-Pesa";
  }

  if (method.includes("cash")) {
    return "Cash";
  }

  return "";
}

function validateCheckoutDetails() {
  const firstName = document.getElementById("order-first-name");
  const lastName = document.getElementById("order-last-name");
  const fullName = document.getElementById("order-name");
  const phone = document.getElementById("order-phone");
  const email = document.getElementById("order-email");
  const payment = document.getElementById("payment-method");
  const mpesaPhone = document.getElementById("mpesa-phone");
  const status = document.getElementById("checkout-status");

  const name = firstName || lastName
    ? [firstName?.value, lastName?.value].map(v => String(v ?? "").trim()).filter(Boolean).join(" ")
    : String(fullName?.value ?? "").trim();

  if (!name) {
    status.textContent = "Please enter your first and last name.";
    return false;
  }

  if (!validKenyanPhone(phone?.value)) {
    status.textContent =
      "Enter a valid Kenyan phone number, such as 0712345678 or 0112345678.";
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email?.value ?? "").trim())) {
    status.textContent = "Please enter a valid email address.";
    return false;
  }

  const selectedMethod = normalisePaymentMethod(payment?.value);

  if (!selectedMethod) {
    status.textContent = "Please select M-Pesa or Cash.";
    return false;
  }

  if (
    selectedMethod === "M-Pesa" &&
    mpesaPhone &&
    !validKenyanPhone(mpesaPhone.value)
  ) {
    status.textContent = "Enter a valid Kenyan M-Pesa number.";
    return false;
  }

  return true;
}

/*
 * Important:
 * - Do not add simulated payment success/failure buttons.
 * - Do not mark M-Pesa as Paid just because Pay Now was clicked.
 * - Save payment_status as "pending" until a real payment
 *   confirmation is received securely from the payment provider.
 */
