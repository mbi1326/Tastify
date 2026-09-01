export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/restaurants") {
        const { results } = await env.DB.prepare(`
          SELECT
            r.id,
            r.name,
            r.slug,
            r.description,
            r.area,
            r.address,
            r.cuisine,
            r.price_range,
            r.rating,
            r.review_count,
            c.name AS city
          FROM restaurants r
          LEFT JOIN cities c ON r.city_id = c.id
          WHERE r.status = 'published'
          ORDER BY r.featured DESC, r.rating DESC
        `).all();

        return Response.json(results);
      }

      if (url.pathname.startsWith("/restaurant/")) {
        const slug = decodeURIComponent(
          url.pathname.replace("/restaurant/", "")
        );

        const restaurant = await env.DB.prepare(`
          SELECT
            r.*,
            c.name AS city
          FROM restaurants r
          LEFT JOIN cities c ON r.city_id = c.id
          WHERE r.slug = ? AND r.status = 'published'
          LIMIT 1
        `).bind(slug).first();

        if (!restaurant) {
          return new Response("Restaurant not found", { status: 404 });
        }

        const { results: reviews } = await env.DB.prepare(`
          SELECT
            author_name,
            title,
            body,
            overall_rating,
            food_rating,
            service_rating,
            atmosphere_rating,
            value_rating,
            created_at
          FROM reviews
          WHERE restaurant_id = ? AND status = 'approved'
          ORDER BY created_at DESC
        `).bind(restaurant.id).all();

        return new Response(
          restaurantPage(restaurant, reviews),
          {
            headers: {
              "content-type": "text/html;charset=UTF-8"
            }
          }
        );
      }

      return new Response(await homePage(env), {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-cache"
        }
      });

    } catch (error) {
      return new Response(
        "Tastify database error: " + error.message,
        { status: 500 }
      );
    }
  }
};


async function homePage(env) {

  const { results } = await env.DB.prepare(`
    SELECT
      r.id,
      r.name,
      r.slug,
      r.description,
      r.area,
      r.cuisine,
      r.price_range,
      r.rating,
      r.review_count,
      c.name AS city
    FROM restaurants r
    LEFT JOIN cities c ON r.city_id = c.id
    WHERE r.status = 'published'
    ORDER BY r.featured DESC, r.rating DESC
  `).all();

  const cards = results.map(r => `
    <article class="restaurant-card">

      <div class="restaurant-image">🍽️</div>

      <div>
        <div class="rating">★ ${r.rating.toFixed(1)}</div>

        <h3>${escapeHtml(r.name)}</h3>

        <p>
          ${escapeHtml(r.cuisine || "Restaurant")}
        </p>

        <p class="muted">
          📍 ${escapeHtml(r.area || "")},
          ${escapeHtml(r.city || "")}
          · ${escapeHtml(r.price_range || "$$")}
        </p>

        <p class="muted">
          ${escapeHtml(r.description || "")}
        </p>

        <p class="reviews">
          ${r.review_count} reviews
        </p>

        <a class="button"
           href="/restaurant/${encodeURIComponent(r.slug)}">
          View Restaurant →
        </a>
      </div>

    </article>
  `).join("");

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>Tastify — Discover With Tastify</title>

<style>

:root {
  --emerald:#087f6c;
  --deep:#075c50;
  --cream:#fffaf0;
  --paper:#ffffff;
  --gold:#d8a83e;
  --orange:#f28c28;
  --ink:#17211f;
  --muted:#687572;
  --border:#e5e1d6;
}

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:var(--cream);
  color:var(--ink);
  font-family:Arial,sans-serif;
  line-height:1.6;
}

h1,h2,h3 {
  font-family:Georgia,serif;
}

.container {
  width:min(1100px,92%);
  margin:auto;
}

nav {
  background:var(--paper);
  border-bottom:1px solid var(--border);
  padding:18px 0;
}

.nav-inner {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.logo {
  font-family:Georgia,serif;
  font-size:28px;
  font-weight:bold;
  color:var(--deep);
}

.logo span {
  display:inline-grid;
  place-items:center;
  width:34px;
  height:34px;
  border-radius:50%;
  background:var(--emerald);
  color:white;
  margin-right:7px;
}

.nav-links {
  display:flex;
  gap:20px;
}

.nav-links a {
  color:var(--deep);
  text-decoration:none;
  font-weight:bold;
}

.hero {
  padding:75px 0;
  background:
    radial-gradient(circle at 85% 20%,
    rgba(216,168,62,.25),
    transparent 25%),
    var(--cream);
}

.eyebrow {
  color:var(--emerald);
  font-size:12px;
  font-weight:bold;
  letter-spacing:2px;
  text-transform:uppercase;
}

.hero h1 {
  font-size:clamp(48px,8vw,78px);
  line-height:1;
  margin:18px 0;
}

.hero h1 span {
  color:var(--emerald);
  font-style:italic;
}

.hero p {
  max-width:650px;
  color:var(--muted);
  font-size:18px;
}

.tagline {
  margin-top:25px;
  border-left:3px solid var(--gold);
  padding-left:15px;
  font-family:Georgia,serif;
  font-style:italic;
  color:#665d4a;
  font-size:13px;
}

section {
  padding:65px 0;
}

.section-heading {
  margin-bottom:30px;
}

.section-heading h2 {
  font-size:40px;
  margin:8px 0;
}

.section-heading p {
  color:var(--muted);
}

.restaurant-list {
  display:grid;
  gap:18px;
}

.restaurant-card {
  background:white;
  border:1px solid var(--border);
  border-radius:20px;
  padding:18px;
  display:grid;
  grid-template-columns:170px 1fr;
  gap:22px;
  transition:.2s;
}

.restaurant-card:hover {
  transform:translateY(-3px);
  box-shadow:0 12px 30px rgba(20,50,45,.1);
}

.restaurant-image {
  min-height:160px;
  border-radius:15px;
  display:grid;
  place-items:center;
  font-size:65px;
  background:
    linear-gradient(135deg,
    #dff4ee,
    #f5dfaa);
}

.restaurant-card h3 {
  font-size:27px;
  margin:4px 0;
}

.restaurant-card p {
  margin:5px 0;
}

.rating {
  color:#b27b0e;
  font-weight:bold;
}

.muted {
  color:var(--muted);
}

.reviews {
  font-size:13px;
  color:var(--muted);
}

.button {
  display:inline-block;
  margin-top:12px;
  padding:10px 17px;
  border-radius:25px;
  background:var(--emerald);
  color:white;
  text-decoration:none;
  font-weight:bold;
  font-size:13px;
}

.quote {
  background:var(--deep);
  color:white;
  text-align:center;
}

.quote h2 {
  max-width:800px;
  margin:auto;
  font-size:38px;
}

footer {
  background:#10201d;
  color:#b8c4c0;
  text-align:center;
  padding:35px 0;
}

footer strong {
  color:var(--gold);
  font-family:Georgia,serif;
  font-size:24px;
}

@media(max-width:650px) {

  .nav-links {
    display:none;
  }

  .restaurant-card {
    grid-template-columns:1fr;
  }

  .restaurant-image {
    min-height:190px;
  }

  .hero {
    padding:55px 0;
  }

}

</style>

</head>

<body>

<nav>

<div class="container nav-inner">

<a href="/" class="logo">
<span>✦</span>Tastify
</a>

<div class="nav-links">
<a href="/">Home</a>
<a href="#restaurants">Restaurants</a>
<a href="#">Recipes</a>
<a href="#">Reviews</a>
</div>

</div>

</nav>


<main>

<section class="hero">

<div class="container">

<div class="eyebrow">
Food • Art • Discovery
</div>

<h1>
Discover<br>
<span>With Tastify.</span>
</h1>

<p>
Discover restaurants, explore recipes,
read reviews and find something worth tasting.
</p>

<div class="tagline">
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</div>

</div>

</section>


<section id="restaurants">

<div class="container">

<div class="section-heading">

<div class="eyebrow">
Discover Nearby
</div>

<h2>
Restaurant Guide
</h2>

<p>
Restaurants currently published on Tastify.
</p>

</div>

<div class="restaurant-list">

${cards || `
<p class="muted">
No restaurants have been published yet.
</p>
`}

</div>

</div>

</section>


<section class="quote">

<div class="container">

<h2>
Good food is an experience worth discovering.
</h2>

</div>

</section>

</main>


<footer>

<div class="container">

<strong>Tastify</strong>

<p>
Discover With Tastify
</p>

<p>
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</p>

</div>

</footer>

</body>

</html>`;
}


function restaurantPage(restaurant, reviews) {

  const reviewHTML = reviews.length
    ? reviews.map(review => `
      <article class="review">

        <div class="rating">
          ★ ${review.overall_rating}/5
        </div>

        <h3>
          ${escapeHtml(review.title || "Tastify Review")}
        </h3>

        <p>
          ${escapeHtml(review.body)}
        </p>

        <small>
          ${escapeHtml(review.author_name)}
        </small>

      </article>
    `).join("")
    : `
      <p class="muted">
        No approved reviews yet.
      </p>
    `;

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>
${escapeHtml(restaurant.name)} — Tastify
</title>

<style>

body {
  margin:0;
  background:#fffaf0;
  color:#17211f;
  font-family:Arial,sans-serif;
}

.container {
  width:min(900px,92%);
  margin:auto;
}

.hero {
  background:#075c50;
  color:white;
  padding:55px 0;
}

h1,h2,h3 {
  font-family:Georgia,serif;
}

h1 {
  font-size:50px;
  margin:10px 0;
}

.rating {
  color:#c18b1a;
  font-weight:bold;
}

.hero .rating {
  color:#f2c95b;
}

main {
  padding:45px 0;
}

.info {
  background:white;
  padding:25px;
  border-radius:20px;
  border:1px solid #e5e1d6;
}

.meta {
  color:#687572;
  line-height:1.9;
}

.button {
  display:inline-block;
  margin-bottom:25px;
  color:#087f6c;
  text-decoration:none;
  font-weight:bold;
}

.review {
  background:white;
  border-bottom:1px solid #e5e1d6;
  padding:20px 0;
}

.review p {
  color:#687572;
}

</style>

</head>

<body>

<header class="hero">

<div class="container">

<a class="button"
   href="/">
← Back to Tastify
</a>

<div>
Restaurant Profile
</div>

<h1>
${escapeHtml(restaurant.name)}
</h1>

<div class="rating">
★ ${Number(restaurant.rating).toFixed(1)}
</div>

</div>

</header>


<main>

<div class="container">

<section class="info">

<h2>About</h2>

<p>
${escapeHtml(restaurant.description || "")}
</p>

<div class="meta">

<strong>📍 Location:</strong>
${escapeHtml(restaurant.area || "")},
${escapeHtml(restaurant.city || "")}
<br>

<strong>🍽 Cuisine:</strong>
${escapeHtml(restaurant.cuisine || "Not specified")}
<br>

<strong>💰 Price:</strong>
${escapeHtml(restaurant.price_range || "$$")}
<br>

<strong>⭐ Reviews:</strong>
${restaurant.review_count}

</div>

</section>


<section>

<h2>Reviews</h2>

${reviewHTML}

</section>

</div>

</main>

</body>

</html>`;
}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
