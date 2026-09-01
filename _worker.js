export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/") {
      return new Response(notFoundPage(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
        status: 404
      });
    }

    return new Response(homePage(), {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-cache"
      }
    });
  }
};

function homePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Tastify — Discover Food, Recipes & Restaurants</title>

<meta name="description" content="Tastify — Discover recipes, food stories, restaurants and honest reviews.">

<style>

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');

:root {
  --emerald: #087f6c;
  --deep-emerald: #075c50;
  --light-emerald: #dff4ee;
  --cream: #fffaf0;
  --gold: #d8a83e;
  --orange: #f28c28;
  --ink: #17211f;
  --muted: #687572;
  --white: #ffffff;
  --border: #e7e5dc;
  --shadow: 0 12px 35px rgba(20, 50, 45, .10);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background: var(--cream);
  color: var(--ink);
  font-family: "DM Sans", sans-serif;
  line-height: 1.6;
}

h1,h2,h3,h4 {
  font-family: "Playfair Display", Georgia, serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.container {
  width: min(1180px, 92%);
  margin: auto;
}

/* NAVIGATION */

.navbar {
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: rgba(255,250,240,.94);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Playfair Display", serif;
  font-size: 28px;
  font-weight: 700;
  color: var(--deep-emerald);
}

.logo-mark {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--emerald);
  color: white;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.nav-links {
  display: flex;
  gap: 30px;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

.nav-links a:hover {
  color: var(--emerald);
}

.nav-button {
  background: var(--emerald);
  color: white;
  padding: 11px 19px;
  border-radius: 24px;
}

/* HERO */

.hero {
  padding: 80px 0 70px;
  background:
    radial-gradient(circle at 85% 15%, rgba(216,168,62,.22), transparent 25%),
    radial-gradient(circle at 10% 80%, rgba(8,127,108,.13), transparent 25%);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 55px;
  align-items: center;
}

.eyebrow {
  display: inline-block;
  color: var(--emerald);
  background: var(--light-emerald);
  padding: 7px 13px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 20px;
}

.hero h1 {
  font-size: clamp(48px, 7vw, 82px);
  line-height: .98;
  letter-spacing: -2px;
  margin-bottom: 25px;
}

.hero h1 span {
  color: var(--emerald);
  font-style: italic;
}

.hero-text {
  max-width: 580px;
  font-size: 18px;
  color: var(--muted);
  margin-bottom: 28px;
}

.tagline {
  border-left: 3px solid var(--gold);
  padding-left: 17px;
  font-family: "Playfair Display", serif;
  font-size: 14px;
  font-style: italic;
  color: #625a48;
  margin-bottom: 30px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn {
  display: inline-block;
  padding: 14px 22px;
  border-radius: 28px;
  font-weight: 700;
  font-size: 14px;
}

.primary-btn {
  background: var(--emerald);
  color: white;
  box-shadow: 0 8px 20px rgba(8,127,108,.20);
}

.secondary-btn {
  border: 1px solid var(--border);
  background: white;
}

/* HERO FOOD CARD */

.hero-card {
  min-height: 430px;
  border-radius: 30px;
  background:
    linear-gradient(145deg, rgba(8,127,108,.95), rgba(5,83,72,.96));
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow);
  padding: 30px;
  display: flex;
  align-items: flex-end;
}

.food-art {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 150px;
  transform: rotate(-7deg);
}

.hero-card-info {
  position: relative;
  z-index: 2;
  color: white;
  width: 100%;
}

.hero-card-info small {
  opacity: .8;
}

.hero-card-info h2 {
  font-size: 30px;
  margin-top: 4px;
}

/* SECTION */

section {
  padding: 80px 0;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
  margin-bottom: 35px;
}

.section-heading h2 {
  font-size: 40px;
}

.section-heading p {
  color: var(--muted);
  max-width: 430px;
}

/* CATEGORIES */

.categories {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 16px;
}

.category {
  background: white;
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 25px;
  transition: .25s;
}

.category:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow);
}

.category-icon {
  font-size: 36px;
  margin-bottom: 15px;
}

.category h3 {
  font-size: 21px;
  margin-bottom: 5px;
}

.category p {
  color: var(--muted);
  font-size: 13px;
}

/* FEATURED */

.featured {
  background: #f3eee1;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 22px;
}

.card {
  background: white;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--border);
  transition: .25s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow);
}

.card-image {
  height: 210px;
  display: grid;
  place-items: center;
  font-size: 80px;
  background:
    radial-gradient(circle at 50% 35%, #fff 0 12%, transparent 13%),
    linear-gradient(135deg,#dff4ee,#f8e8b9);
}

.card-content {
  padding: 20px;
}

.card-label {
  color: var(--orange);
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
}

.card h3 {
  font-size: 23px;
  margin: 8px 0;
}

.card p {
  color: var(--muted);
  font-size: 14px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
}

/* RESTAURANTS */

.restaurant-section {
  background: white;
}

.restaurant-card {
  display: grid;
  grid-template-columns: 170px 1fr auto;
  gap: 20px;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 20px;
  margin-bottom: 14px;
}

.restaurant-image {
  height: 120px;
  border-radius: 15px;
  background: linear-gradient(135deg,#087f6c,#d8a83e);
  display: grid;
  place-items: center;
  font-size: 50px;
}

.restaurant-info h3 {
  font-size: 24px;
}

.restaurant-info p {
  color: var(--muted);
  font-size: 14px;
}

.rating {
  color: #c58c13;
  font-weight: 700;
  margin: 5px 0;
}

.view-btn {
  border: 1px solid var(--emerald);
  color: var(--emerald);
  padding: 10px 15px;
  border-radius: 22px;
  font-size: 13px;
  font-weight: 700;
}

/* QUOTE */

.quote-section {
  background: var(--deep-emerald);
  color: white;
  text-align: center;
}

.quote-section h2 {
  max-width: 850px;
  margin: auto;
  font-size: clamp(30px,5vw,52px);
  line-height: 1.2;
}

.quote-section p {
  margin-top: 22px;
  color: #cce5df;
  letter-spacing: 2px;
  font-size: 11px;
}

/* NEWSLETTER */

.newsletter {
  background: #f3eee1;
}

.newsletter-box {
  background: white;
  border-radius: 28px;
  padding: 45px;
  text-align: center;
  border: 1px solid var(--border);
}

.newsletter-box h2 {
  font-size: 38px;
}

.newsletter-box p {
  color: var(--muted);
  margin: 10px auto 25px;
  max-width: 520px;
}

.search-box {
  max-width: 560px;
  margin: auto;
  display: flex;
  gap: 8px;
}

.search-box input {
  flex: 1;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 25px;
  outline: none;
  font-family: inherit;
}

.search-box button {
  border: 0;
  background: var(--emerald);
  color: white;
  border-radius: 25px;
  padding: 0 22px;
  font-weight: 700;
}

/* FOOTER */

footer {
  background: #10201d;
  color: white;
  padding: 50px 0 25px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
}

footer h3 {
  margin-bottom: 12px;
}

footer p,
footer a {
  color: #aebcb8;
  font-size: 13px;
}

footer a {
  display: block;
  margin: 7px 0;
}

.copyright {
  border-top: 1px solid #29413c;
  margin-top: 35px;
  padding-top: 20px;
  font-size: 12px;
  color: #83928e;
}

/* MOBILE */

@media(max-width:800px) {

  .nav-links {
    display: none;
  }

  .hero {
    padding: 55px 0;
  }

  .hero-grid {
    grid-template-columns: 1fr;
  }

  .hero-card {
    min-height: 330px;
  }

  .categories {
    grid-template-columns: repeat(2,1fr);
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .restaurant-card {
    grid-template-columns: 100px 1fr;
  }

  .restaurant-image {
    height: 100px;
  }

  .view-btn {
    grid-column: 2;
    width: max-content;
  }

  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }

}

@media(max-width:480px) {

  .logo {
    font-size: 24px;
  }

  .hero h1 {
    font-size: 50px;
  }

  section {
    padding: 60px 0;
  }

  .section-heading {
    display: block;
  }

  .section-heading h2 {
    font-size: 34px;
    margin-bottom: 8px;
  }

  .categories {
    grid-template-columns: 1fr;
  }

  .newsletter-box {
    padding: 30px 18px;
  }

  .search-box {
    display: block;
  }

  .search-box input,
  .search-box button {
    width: 100%;
    height: 48px;
  }

  .search-box button {
    margin-top: 8px;
  }

  .footer-grid {
    grid-template-columns: 1fr;
  }

}

</style>
</head>

<body>

<!-- NAVIGATION -->

<header class="navbar">
  <div class="container" style="display:flex;align-items:center;justify-content:space-between;width:100%;">

    <a href="/" class="logo">
      <span class="logo-mark">✦</span>
      Tastify
    </a>

    <nav class="nav-links">
      <a href="#recipes">Recipes</a>
      <a href="#restaurants">Restaurants</a>
      <a href="#reviews">Reviews</a>
      <a href="#stories">Food Stories</a>
      <a href="#restaurants" class="nav-button">Discover</a>
    </nav>

  </div>
</header>


<!-- HERO -->

<main>

<section class="hero">
<div class="container hero-grid">

  <div>

    <span class="eyebrow">Food • Art • Discovery</span>

    <h1>
      Discover<br>
      <span>With Tastify.</span>
    </h1>

    <p class="hero-text">
      Explore delicious recipes, discover remarkable restaurants,
      read honest reviews and experience food from a different perspective.
    </p>

    <div class="tagline">
      IN THE REALMS WHERE FOOD AND ART UNITE,<br>
      WE ASPIRE TO BE MAGICIANS.
    </div>

    <div class="hero-actions">
      <a href="#restaurants" class="primary-btn">
        Explore Restaurants →
      </a>

      <a href="#recipes" class="secondary-btn">
        Explore Recipes
      </a>
    </div>

  </div>

  <div class="hero-card">

    <div class="food-art">🍜</div>

    <div class="hero-card-info">
      <small>FEATURED DISCOVERY</small>
      <h2>A world of flavour awaits.</h2>
    </div>

  </div>

</div>
</section>


<!-- EXPLORE -->

<section>
<div class="container">

  <div class="section-heading">
    <div>
      <span class="eyebrow">Explore Tastify</span>
      <h2>Something delicious<br>for everyone.</h2>
    </div>

    <p>
      From your next homemade dinner to your next favourite restaurant,
      Tastify helps you discover what to eat.
    </p>
  </div>

  <div class="categories">

    <a class="category" href="#recipes">
      <div class="category-icon">🍳</div>
      <h3>Recipes</h3>
      <p>Simple recipes worth making.</p>
    </a>

    <a class="category" href="#restaurants">
      <div class="category-icon">🍽️</div>
      <h3>Restaurants</h3>
      <p>Find places worth visiting.</p>
    </a>

    <a class="category" href="#reviews">
      <div class="category-icon">⭐</div>
      <h3>Reviews</h3>
      <p>Discover what people really think.</p>
    </a>

    <a class="category" href="#stories">
      <div class="category-icon">📖</div>
      <h3>Food Stories</h3>
      <p>Stories behind memorable food.</p>
    </a>

  </div>

</div>
</section>


<!-- RECIPES -->

<section id="recipes" class="featured">
<div class="container">

  <div class="section-heading">
    <div>
      <span class="eyebrow">From Our Kitchen</span>
      <h2>Featured Recipes</h2>
    </div>

    <p>
      Easy-to-follow recipes for home cooks,
      from everyday favourites to something special.
    </p>
  </div>

  <div class="cards">

    <article class="card">

      <div class="card-image">🍝</div>

      <div class="card-content">

        <span class="card-label">Easy Dinner</span>

        <h3>Creamy Garlic Pasta</h3>

        <p>
          A comforting pasta dish with a rich,
          creamy garlic sauce.
        </p>

        <div class="card-meta">
          <span>⏱ 25 min</span>
          <span>★ Easy</span>
        </div>

      </div>

    </article>


    <article class="card">

      <div class="card-image">🥞</div>

      <div class="card-content">

        <span class="card-label">Breakfast</span>

        <h3>Golden Morning Pancakes</h3>

        <p>
          Light, fluffy pancakes made for slow
          weekend mornings.
        </p>

        <div class="card-meta">
          <span>⏱ 20 min</span>
          <span>★ Easy</span>
        </div>

      </div>

    </article>


    <article class="card">

      <div class="card-image">🍰</div>

      <div class="card-content">

        <span class="card-label">Dessert</span>

        <h3>Classic Chocolate Cake</h3>

        <p>
          Rich chocolate flavour with a soft,
          indulgent crumb.
        </p>

        <div class="card-meta">
          <span>⏱ 55 min</span>
          <span>★ Medium</span>
        </div>

      </div>

    </article>

  </div>

</div>
</section>


<!-- RESTAURANTS -->

<section id="restaurants" class="restaurant-section">
<div class="container">

  <div class="section-heading">
    <div>
      <span class="eyebrow">Discover Nearby</span>
      <h2>Restaurant Guide</h2>
    </div>

    <p>
      Find restaurants by cuisine, location, price,
      atmosphere and what you are craving.
    </p>
  </div>


  <div class="restaurant-card">

    <div class="restaurant-image">🍔</div>

    <div class="restaurant-info">
      <h3>The Green Table</h3>
      <p>Modern • Burgers • Continental</p>
      <div class="rating">★★★★★ 4.8</div>
      <p>📍 Your City · $$</p>
    </div>

    <a href="#restaurants" class="view-btn">
      View Restaurant
    </a>

  </div>


  <div class="restaurant-card">

    <div class="restaurant-image">🍕</div>

    <div class="restaurant-info">
      <h3>Casa Verde</h3>
      <p>Italian • Pizza • Pasta</p>
      <div class="rating">★★★★☆ 4.5</div>
      <p>📍 Your City · $$</p>
    </div>

    <a href="#restaurants" class="view-btn">
      View Restaurant
    </a>

  </div>


  <div class="restaurant-card">

    <div class="restaurant-image">🍛</div>

    <div class="restaurant-info">
      <h3>The Spice Room</h3>
      <p>Asian • Fusion • Family Dining</p>
      <div class="rating">★★★★☆ 4.6</div>
      <p>📍 Your City · $$$</p>
    </div>

    <a href="#restaurants" class="view-btn">
      View Restaurant
    </a>

  </div>

</div>
</section>


<!-- REVIEWS -->

<section id="reviews" class="featured">
<div class="container">

  <div class="section-heading">
    <div>
      <span class="eyebrow">Taste Tested</span>
      <h2>What makes a place worth visiting?</h2>
    </div>
  </div>

  <div class="cards">

    <article class="card">
      <div class="card-content">
        <div class="rating">★★★★★</div>
        <h3>Food</h3>
        <p>
          Taste, presentation, portions and
          overall quality.
        </p>
      </div>
    </article>

    <article class="card">
      <div class="card-content">
        <div class="rating">★★★★★</div>
        <h3>Atmosphere</h3>
        <p>
          Ambience, comfort, cleanliness and
          overall dining experience.
        </p>
      </div>
    </article>

    <article class="card">
      <div class="card-content">
        <div class="rating">★★★★★</div>
        <h3>Value</h3>
        <p>
          Whether the experience is worth
          what you pay.
        </p>
      </div>
    </article>

  </div>

</div>
</section>


<!-- BRAND QUOTE -->

<section id="stories" class="quote-section">

<div class="container">

  <h2>
    “In the realms where food and art unite,
    we aspire to be magicians.”
  </h2>

  <p>
    TASTIFY · FOOD · RECIPES · RESTAURANTS · REVIEWS
  </p>

</div>

</section>


<!-- SEARCH / FUTURE DISCOVERY -->

<section class="newsletter">

<div class="container">

  <div class="newsletter-box">

    <span class="eyebrow">The Tastify Search</span>

    <h2>What are you craving?</h2>

    <p>
      Search for recipes, restaurants, cuisines and
      food experiences. Search will become fully
      connected when we add the Tastify database.
    </p>

    <div class="search-box">

      <input
        type="text"
        placeholder="Try “pizza”, “breakfast”, “restaurants”..."
      >

      <button onclick="demoSearch()">
        Search
      </button>

    </div>

  </div>

</div>

</section>

</main>


<!-- FOOTER -->

<footer>

<div class="container">

  <div class="footer-grid">

    <div>
      <div class="logo" style="color:white;">
        <span class="logo-mark">✦</span>
        Tastify
      </div>

      <p style="margin-top:15px;max-width:300px;">
        Discover food. Discover places.
        Discover something worth tasting.
      </p>
    </div>

    <div>
      <h3>Explore</h3>
      <a href="#recipes">Recipes</a>
      <a href="#restaurants">Restaurants</a>
      <a href="#reviews">Reviews</a>
      <a href="#stories">Food Stories</a>
    </div>

    <div>
      <h3>Tastify</h3>
      <a href="#">About</a>
      <a href="#">Contact</a>
      <a href="#">Submit a Restaurant</a>
      <a href="#">Write a Review</a>
    </div>

    <div>
      <h3>Follow</h3>
      <a href="#">Instagram</a>
      <a href="#">YouTube</a>
      <a href="#">Facebook</a>
    </div>

  </div>

  <div class="copyright">
    © 2026 Tastify. All rights reserved.
  </div>

</div>

</footer>


<script>

function demoSearch() {
  const input = document.querySelector(".search-box input");
  const value = input.value.trim();

  if (!value) {
    alert("What would you like to discover?");
    return;
  }

  alert(
    'Tastify search is coming soon. We will search for "' +
    value +
    '" once the database is connected.'
  );
}

</script>

</body>
</html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tastify — Page Not Found</title>
<style>
body{
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  background:#fffaf0;
  color:#17211f;
  font-family:Arial,sans-serif;
  text-align:center;
}
h1{
  font-family:Georgia,serif;
  font-size:60px;
}
a{
  color:#087f6c;
  font-weight:bold;
}
</style>
</head>
<body>
<div>
<h1>404</h1>
<p>This realm hasn't been discovered yet.</p>
<a href="/">Return to Tastify</a>
</div>
</body>
</html>`;
}
