<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Customer Home | Kelsiy's Closet</title>
    <link rel="stylesheet" href="style.css">
</head>

<body class="customer-page">

    <header class="customer-header">
        <a href="customer.html" class="customer-brand">
            <span class="customer-logo">KC</span>
            <span>
                <strong>KELSIY'S CLOSET</strong>
                <small>STYLE THAT SPEAKS</small>
            </span>
        </a>

        <button type="button" id="customer-menu-button"
            aria-label="Open navigation menu">
            ☰
        </button>

        <nav id="customer-navigation">
            <a href="#home">Home</a>
            <a href="#gallery">Gallery</a>
            <a href="#about">About</a>
            <a href="#contacts">Contacts</a>
            <button type="button" id="customer-logout">
                Sign Out
            </button>
        </nav>
    </header>

    <main>

        <!-- HOME SECTION -->
        <section id="home" class="customer-hero">
            <div class="customer-hero-content">
                <p class="customer-eyebrow">WELCOME TO KELSIY'S CLOSET</p>

                <h1>Style That Speaks.<br>
                    Fashion That Defines You.</h1>

                <p>
                    Discover clothing, shoes and accessories that
                    express your personality. Find your next favorite
                    look at Kelsiy's Closet.
                </p>

                <a href="#gallery" class="customer-shop-button">
                    Explore Our Collection
                </a>
            </div>
        </section>

        <!-- GALLERY SECTION -->
        <section id="gallery" class="customer-section">
            <div class="customer-section-heading">
                <p class="customer-eyebrow">FIND YOUR STYLE</p>
                <h2>Our Collection</h2>
                <p>
                    Explore our latest fashion pieces and check
                    prices, sizes, colours and availability.
                </p>
            </div>

            <div class="customer-filters">
                <label for="category-filter">Category</label>
                <select id="category-filter">
                    <option value="all">All Products</option>
                    <option value="women">Women's Clothing</option>
                    <option value="men">Men's Clothing</option>
                    <option value="shoes">Shoes</option>
                    <option value="accessories">Accessories</option>
                </select>
            </div>

            <p id="catalogue-message" role="status">
                Our collection will appear here.
            </p>

            <div id="customer-products" class="customer-products">
                <!-- Products will be loaded from Supabase. -->
            </div>
        </section>

        <!-- ABOUT SECTION -->
        <section id="about" class="customer-section customer-about">
            <div class="customer-about-content">
                <p class="customer-eyebrow">GET TO KNOW US</p>
                <h2>About Kelsiy's Closet</h2>

                <p>
                    Kelsiy's Closet is a fashion business dedicated
                    to helping customers express themselves through
                    stylish and affordable fashion.
                </p>

                <p>
                    Our collection includes women's clothing, men's
                    clothing, shoes and accessories. We aim to make
                    discovering products easier by allowing customers
                    to check prices, sizes, colours and stock
                    availability online.
                </p>

                <p>
                    Our goal is to provide a convenient shopping
                    experience where style, choice and customer
                    satisfaction matter.
                </p>
            </div>
        </section>

        <!-- CONTACTS SECTION -->
        <section id="contacts" class="customer-section">
            <div class="customer-section-heading">
                <p class="customer-eyebrow">WE'RE HERE TO HELP</p>
                <h2>Contact Us</h2>
                <p>
                    Have a question about a product or want to
                    enquire about an order? Send us a message.
                </p>
            </div>

            <form id="customer-contact-form" class="customer-contact-form">
                <div>
                    <label for="contact-name">Your Name</label>
                    <input id="contact-name" name="name"
                        type="text" required>
                </div>

                <div>
                    <label for="contact-email">Email Address</label>
                    <input id="contact-email" name="email"
                        type="email" required>
                </div>

                <div>
                    <label for="contact-phone">Phone Number</label>
                    <input id="contact-phone" name="phone"
                        type="tel">
                </div>

                <div>
                    <label for="contact-message">Your Message</label>
                    <textarea id="contact-message" name="message"
                        rows="5" required></textarea>
                </div>

                <button type="submit">Send Inquiry</button>

                <p id="contact-status" role="status"></p>
            </form>
        </section>

    </main>

    <footer class="customer-footer">
        <a href="#home">KELSIY'S CLOSET</a>
        <p>STYLE THAT SPEAKS</p>
        <p>© Kelsiy's Closet. All rights reserved.</p>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="customer.js" defer></script>

</body>
</html>
